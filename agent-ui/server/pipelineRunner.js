/**
 * PipelineRunner — server-side autonomous pipeline orchestrator.
 *
 * Owns the full lifecycle:
 *   1. Accept a pipeline request (repoUrl + goal)
 *   2. Decompose the goal into tasks
 *   3. Spawn agents (Fly.io or local) for each task
 *   4. Track agent progress via callback API
 *   5. When all tasks complete → commit, push, create PR
 *   6. Emit socket events throughout so the UI updates live
 *
 * This replaces the human-driven entrypoint.ts approach.
 * Agents report back to us — we don't poll them.
 */

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { execSync, spawn } = require('child_process');

class PipelineRunner {
  constructor(io, gitAgentSpawner, workspaceRoot, lifecycleManager) {
    this.io = io;
    this.gitAgentSpawner = gitAgentSpawner;
    this.workspaceRoot = workspaceRoot || process.cwd();
    this.lifecycleManager = lifecycleManager || null;

    // Track active pipelines: pipelineId → PipelineState
    this.pipelines = new Map();

    // Track agent → pipeline/task mapping: agentId → { pipelineId, taskId }
    this.agentTasks = new Map();

    // Local child processes: agentId → ChildProcess
    this.localProcesses = new Map();
  }

  /**
   * Start a new pipeline. Returns immediately with the pipeline ID.
   * Agents are spawned asynchronously and report back via callbacks.
   */
  async startPipeline({ repoUrl, goal, provider, model, githubToken, maxAgents, agentType }) {
    const pipelineId = uuidv4().slice(0, 12);
    const now = new Date();

    const pipeline = {
      id: pipelineId,
      repoUrl,
      goal,
      provider: provider || 'github-copilot',
      model: model || 'claude-sonnet-4',
      githubToken,
      agentType: agentType || 'claude',
      maxAgents: maxAgents || 3,
      phase: 'planning',
      tasks: [],       // Array of { id, title, description, agentId, status, branch, commitHash, error }
      convoyId: null,
      prUrl: null,
      startedAt: now,
      completedAt: null,
      error: null
    };

    this.pipelines.set(pipelineId, pipeline);
    this._emitStatus(pipeline);
    this._savePipelineState(pipeline);

    // Hold lifecycle manager alive while pipeline executes (4 hours max)
    if (this.lifecycleManager) {
      this.lifecycleManager.hold(4 * 60 * 60 * 1000, `Pipeline ${pipelineId} executing`);
    }

    // Run the planning + spawning in background (non-blocking)
    this._executePipeline(pipeline).catch(err => {
      pipeline.phase = 'failed';
      pipeline.error = err.message;
      pipeline.completedAt = new Date();
      this._emitStatus(pipeline);
      this._savePipelineState(pipeline);
      console.error(`[PipelineRunner] Pipeline ${pipelineId} failed:`, err.message);
      // Release lifecycle hold on failure
      if (this.lifecycleManager) {
        this.lifecycleManager.releaseHold();
      }
    });

    return { pipelineId, phase: 'planning' };
  }

  /**
   * Agent reports a heartbeat — "I'm alive and working"
   */
  agentHeartbeat(agentId, data = {}) {
    const mapping = this.agentTasks.get(agentId);
    if (!mapping) return false;

    const pipeline = this.pipelines.get(mapping.pipelineId);
    if (!pipeline) return false;

    const task = pipeline.tasks.find(t => t.id === mapping.taskId);
    if (task) {
      task.lastHeartbeat = new Date();
      if (data.progress) task.progress = data.progress;
    }

    this.io.emit('pipeline:heartbeat', { pipelineId: pipeline.id, agentId, taskId: mapping.taskId, ...data });
    return true;
  }

  /**
   * Agent reports task completion — triggers the post-work phases.
   */
  agentComplete(agentId, data = {}) {
    const mapping = this.agentTasks.get(agentId);
    if (!mapping) {
      console.warn(`[PipelineRunner] agentComplete from unknown agent ${agentId}`);
      return false;
    }

    const pipeline = this.pipelines.get(mapping.pipelineId);
    if (!pipeline) return false;

    const task = pipeline.tasks.find(t => t.id === mapping.taskId);
    if (!task) return false;

    task.status = 'completed';
    task.completedAt = new Date();
    task.commitHash = data.commitHash || null;
    task.branch = data.branch || task.branch;

    console.log(`[PipelineRunner] Task ${task.id} completed by agent ${agentId}`);
    this.io.emit('pipeline:task-complete', { pipelineId: pipeline.id, taskId: task.id, agentId, ...data });
    this._savePipelineState(pipeline);

    // Remove local process reference if exists
    this.localProcesses.delete(agentId);

    // Check if all tasks are done
    this._checkPipelineCompletion(pipeline);
    return true;
  }

  /**
   * Agent reports task failure.
   */
  agentFail(agentId, data = {}) {
    const mapping = this.agentTasks.get(agentId);
    if (!mapping) return false;

    const pipeline = this.pipelines.get(mapping.pipelineId);
    if (!pipeline) return false;

    const task = pipeline.tasks.find(t => t.id === mapping.taskId);
    if (!task) return false;

    task.status = 'failed';
    task.completedAt = new Date();
    task.error = data.error || 'Unknown error';

    console.error(`[PipelineRunner] Task ${task.id} failed: ${task.error}`);
    this.io.emit('pipeline:task-failed', { pipelineId: pipeline.id, taskId: task.id, agentId, error: task.error });
    this._savePipelineState(pipeline);

    // Remove local process reference
    this.localProcesses.delete(agentId);

    // Still check completion (some tasks may have failed but pipeline can finish)
    this._checkPipelineCompletion(pipeline);
    return true;
  }

  /**
   * Get pipeline status.
   */
  getPipeline(pipelineId) {
    return this.pipelines.get(pipelineId) || null;
  }

  /**
   * List all pipelines.
   */
  listPipelines() {
    return Array.from(this.pipelines.values());
  }

  // ── Internal ──

  /**
   * The main pipeline execution: decompose goal → spawn agents.
   * This runs async after startPipeline returns.
   */
  async _executePipeline(pipeline) {
    const { repoUrl, goal, maxAgents, agentType, provider, model, githubToken } = pipeline;

    // ── Step 1: Decompose goal into tasks ──
    const subtasks = this._decomposeGoal(goal, repoUrl);
    const taskCount = Math.min(subtasks.length, maxAgents);

    pipeline.tasks = subtasks.slice(0, taskCount).map((sub, i) => ({
      id: `task-${pipeline.id}-${i}`,
      title: sub.title,
      description: sub.description,
      agentId: null,
      status: 'pending',
      branch: `agent/${pipeline.id}/${i}`,
      commitHash: null,
      error: null,
      lastHeartbeat: null,
      progress: null,
      completedAt: null
    }));

    pipeline.convoyId = `convoy-${pipeline.id}`;
    pipeline.phase = 'spawning';
    this._emitStatus(pipeline);
    this._savePipelineState(pipeline);

    console.log(`[PipelineRunner] Pipeline ${pipeline.id}: ${pipeline.tasks.length} task(s) to spawn`);

    // ── Step 2: Spawn agents for each task ──
    const callbackBaseUrl = this._getCallbackUrl();

    for (const task of pipeline.tasks) {
      try {
        const agentResult = await this._spawnAgentForTask(pipeline, task, callbackBaseUrl);
        task.agentId = agentResult.agentId;
        task.status = 'running';

        // Register for callback tracking
        this.agentTasks.set(agentResult.agentId, {
          pipelineId: pipeline.id,
          taskId: task.id
        });

        console.log(`[PipelineRunner] Spawned agent ${agentResult.agentId} for task ${task.id}`);
      } catch (err) {
        task.status = 'failed';
        task.error = `Spawn failed: ${err.message}`;
        console.error(`[PipelineRunner] Failed to spawn for task ${task.id}:`, err.message);
      }

      this.io.emit('pipeline:task-spawned', { pipelineId: pipeline.id, taskId: task.id, agentId: task.agentId, status: task.status });
    }

    pipeline.phase = 'executing';
    this._emitStatus(pipeline);
    this._savePipelineState(pipeline);

    // If all tasks already failed during spawning, handle it
    this._checkPipelineCompletion(pipeline);
  }

  /**
   * Spawn an agent for a single task.
   * Uses Fly.io if FLY_API_TOKEN is set, otherwise spawns locally.
   */
  async _spawnAgentForTask(pipeline, task, callbackBaseUrl) {
    const { repoUrl, provider, model, githubToken, agentType } = pipeline;

    // Build the task script that the agent will execute
    const taskScript = this._buildTaskScript({
      taskId: task.id,
      taskDescription: task.description,
      repoUrl,
      branch: task.branch,
      provider,
      model,
      callbackBaseUrl
    });

    // If FLY_API_TOKEN is present, try spawning remote via Fly.io
    if (process.env.FLY_API_TOKEN && this.gitAgentSpawner) {
      // Look up API key from stored credentials
      const apiKey = this._getApiKey(agentType);
      if (!apiKey) {
        console.log(`[PipelineRunner] No API key for "${agentType}" — falling back to local spawn`);
        // Fall through to local spawning below
      } else {

        return await this.gitAgentSpawner.spawnAgent(agentType, apiKey, {
          githubToken,
          repoUrl,
          taskScript,
          taskId: task.id
        });
      }
    }

    // Otherwise, run locally as a managed child process
    return this._spawnLocalAgent({
      taskId: task.id,
      taskScript,
      repoUrl,
      provider,
      model,
      githubToken,
      callbackBaseUrl
    });
  }

  /**
   * Spawn a local agent as a managed child process.
   * Captures stdout/stderr, monitors exit, and reports back.
   */
  _spawnLocalAgent({ taskId, taskScript, repoUrl, provider, model, githubToken, callbackBaseUrl }) {
    const agentId = uuidv4().slice(0, 8);
    const logDir = path.join(this.workspaceRoot, '.createsuite', 'logs');
    try { fs.mkdirSync(logDir, { recursive: true }); } catch {}

    const logFile = path.join(logDir, `agent-${agentId}.log`);
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });

    const env = {
      ...process.env,
      AGENT_ID: agentId,
      ASSIGNED_TASK: taskId,
      REPO_URL: repoUrl,
      OPENCODE_PROVIDER: provider || 'github-copilot',
      OPENCODE_MODEL: model || 'claude-sonnet-4',
      CALLBACK_BASE_URL: callbackBaseUrl,
      ...(githubToken && { GITHUB_TOKEN: githubToken })
    };

    const child = spawn('bash', ['-c', taskScript], {
      cwd: this.workspaceRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout.on('data', (data) => {
      logStream.write(data);
      // Forward to socket for live monitoring
      this.io.emit('pipeline:agent-log', { agentId, taskId, data: data.toString() });
    });

    child.stderr.on('data', (data) => {
      logStream.write(`[STDERR] ${data}`);
      this.io.emit('pipeline:agent-log', { agentId, taskId, data: `[ERR] ${data.toString()}` });
    });

    child.on('exit', (code, signal) => {
      logStream.end();
      console.log(`[PipelineRunner] Local agent ${agentId} exited (code=${code}, signal=${signal})`);

      if (code === 0) {
        // Successful exit — agentComplete should have been called via callback.
        // But if it wasn't (e.g. curl failed), mark complete anyway.
        if (!this._isTaskDone(taskId)) {
          this.agentComplete(agentId, { commitHash: 'local' });
        }
      } else {
        // Non-zero exit — mark failed if not already
        if (!this._isTaskDone(taskId)) {
          this.agentFail(agentId, { error: `Process exited with code ${code}` });
        }
      }
    });

    this.localProcesses.set(agentId, child);

    return { agentId, machineId: `local-${child.pid}`, type: 'local' };
  }

  _isTaskDone(taskId) {
    for (const pipeline of this.pipelines.values()) {
      const task = pipeline.tasks.find(t => t.id === taskId);
      if (task && (task.status === 'completed' || task.status === 'failed')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Build the fully autonomous task script.
   * This is what runs inside each agent container (or locally).
   */
  _buildTaskScript({ taskId, taskDescription, repoUrl, branch, provider, model, callbackBaseUrl }) {
    // Escape for embedding in bash
    const esc = (s) => (s || '').replace(/'/g, "'\\''");

    return `#!/bin/bash
set -euo pipefail

# ── Agent Autonomous Task Script ──
# Task: ${esc(taskId)}
# Generated by CreateSuite PipelineRunner

AGENT_ID="\${AGENT_ID:-$(cat /proc/sys/kernel/random/uuid 2>/dev/null | head -c 8 || echo unknown)}"
CALLBACK_BASE="\${CALLBACK_BASE_URL:-${esc(callbackBaseUrl)}}"
TASK_ID="${esc(taskId)}"
BRANCH="${esc(branch)}"

# ── Callback helpers ──
report_status() {
  local status="$1"
  local message="\${2:-}"
  local extra="\${3:-}"
  local payload="{\\"agentId\\":\\"\${AGENT_ID}\\",\\"taskId\\":\\"\${TASK_ID}\\",\\"status\\":\\"\${status}\\",\\"message\\":\\"\${message}\\"}"
  curl -s -X POST "\${CALLBACK_BASE}/api/agent/status" \\
    -H "Content-Type: application/json" \\
    -d "\${payload}" \\
    --max-time 10 2>/dev/null || true
}

report_complete() {
  local commit_hash="\${1:-none}"
  curl -s -X POST "\${CALLBACK_BASE}/api/agent/complete" \\
    -H "Content-Type: application/json" \\
    -d "{\\"agentId\\":\\"\${AGENT_ID}\\",\\"taskId\\":\\"\${TASK_ID}\\",\\"commitHash\\":\\"\${commit_hash}\\",\\"branch\\":\\"\${BRANCH}\\"}" \\
    --max-time 10 2>/dev/null || true
}

report_fail() {
  local error="\${1:-Unknown error}"
  curl -s -X POST "\${CALLBACK_BASE}/api/agent/fail" \\
    -H "Content-Type: application/json" \\
    -d "{\\"agentId\\":\\"\${AGENT_ID}\\",\\"taskId\\":\\"\${TASK_ID}\\",\\"error\\":\\"\${error}\\"}" \\
    --max-time 10 2>/dev/null || true
}

# ── Error trap ──
on_error() {
  local exit_code=$?
  local line_no=$1
  echo "ERROR at line \${line_no}, exit code \${exit_code}"
  report_fail "Script error at line \${line_no} (exit \${exit_code})"
  exit \${exit_code}
}
trap 'on_error \${LINENO}' ERR

# ── Start ──
echo "=== CreateSuite Agent ==="
echo "Agent:    \${AGENT_ID}"
echo "Task:     \${TASK_ID}"
echo "Repo:     ${esc(repoUrl)}"
echo "Branch:   \${BRANCH}"
echo "Provider: ${esc(provider)}"
echo "Model:    ${esc(model)}"
echo "========================="

report_status "started" "Agent initializing"

# ── Step 0: Ensure Bun is available (fast package manager) ──
export PATH="$HOME/.bun/bin:$HOME/.opencode/bin:$HOME/.local/bin:/usr/local/bin:$PATH"
if ! command -v bun &> /dev/null; then
  echo "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash 2>&1 || true
  export PATH="$HOME/.bun/bin:$PATH"
  hash -r 2>/dev/null || true
fi
echo "Bun: $(bun --version 2>/dev/null || echo 'not available')"

# ── Step 1: Install OpenCode if needed ──
if ! command -v opencode &> /dev/null; then
  echo "Installing OpenCode..."
  report_status "running" "Installing OpenCode"
  curl -fsSL https://opencode.ai/install | bash 2>&1 || true
  export PATH="$HOME/.opencode/bin:$HOME/.local/bin:/usr/local/bin:$PATH"
  hash -r 2>/dev/null || true
fi

# ── Step 2: Clone repository ──
WORK_DIR="/tmp/agent-work-\${TASK_ID}"
rm -rf "\${WORK_DIR}"
echo "Cloning ${esc(repoUrl)}..."
report_status "running" "Cloning repository"

if [ -n "\${GITHUB_TOKEN:-}" ]; then
  # Inject token for private repos
  CLONE_URL=$(echo "${esc(repoUrl)}" | sed "s|https://|https://\${GITHUB_TOKEN}@|")
  git clone --depth=50 "\${CLONE_URL}" "\${WORK_DIR}" 2>&1
else
  git clone --depth=50 "${esc(repoUrl)}" "\${WORK_DIR}" 2>&1
fi

cd "\${WORK_DIR}"

# Configure git
git config user.name "CreateSuite Agent"
git config user.email "agent@createsuite.dev"

# ── Step 3: Create working branch ──
echo "Creating branch \${BRANCH}..."
git checkout -b "\${BRANCH}"

# ── Step 4: Run OpenCode with the task ──
echo "Running OpenCode task..."
report_status "running" "OpenCode working on task"

export OPENCODE_PROVIDER="${esc(provider)}"
export OPENCODE_MODEL="${esc(model)}"

TASK_DESC='${esc(taskDescription)}'

# Try multiple opencode invocation syntaxes (varies by version)
if command -v opencode &> /dev/null; then
  echo "OpenCode found at: $(which opencode)"
  opencode run -m "${esc(provider)}/${esc(model)}" "\${TASK_DESC}" 2>&1 || \
  opencode run "\${TASK_DESC}" 2>&1 || \
  opencode "\${TASK_DESC}" 2>&1 || {
    echo "All opencode invocations failed — checking for changes anyway"
  }
else
  echo "WARNING: opencode not found on PATH after install attempt"
  echo "PATH=\$PATH"
  report_status "running" "opencode not available, skipping AI execution"
fi

# ── Step 5: Commit changes ──
echo "Checking for changes..."
report_status "running" "Committing changes"

git add -A
DIFF_STAT=$(git diff --cached --stat 2>/dev/null || echo "")

if [ -n "\${DIFF_STAT}" ]; then
  COMMIT_MSG="feat: \${TASK_DESC}"
  if [ \${#COMMIT_MSG} -gt 72 ]; then
    COMMIT_MSG="\${COMMIT_MSG:0:69}..."
  fi
  git commit -m "\${COMMIT_MSG}" -m "Automated by CreateSuite Agent \${AGENT_ID}" -m "Task: \${TASK_ID}"
  COMMIT_HASH=$(git rev-parse HEAD)
  echo "Committed: \${COMMIT_HASH}"

  # ── Step 6: Push ──
  echo "Pushing branch \${BRANCH}..."
  report_status "running" "Pushing changes"
  git push -u origin "\${BRANCH}" 2>&1 || echo "Push failed (may need token)"

  # ── Step 7: Create PR (if gh is available) ──
  if command -v gh &> /dev/null && [ -n "\${GITHUB_TOKEN:-}" ]; then
    echo "Creating pull request..."
    report_status "running" "Creating PR"
    PR_URL=$(gh pr create \\
      --title "[CreateSuite] \${TASK_DESC:0:60}" \\
      --body "## Automated by CreateSuite Agent

**Agent:** \${AGENT_ID}
**Task:** \${TASK_ID}
**Model:** ${esc(model)}

### Changes
\${DIFF_STAT}

---
_This PR was created autonomously by a CreateSuite agent._" \\
      --head "\${BRANCH}" 2>&1) || PR_URL=""
    
    if [ -n "\${PR_URL}" ]; then
      echo "PR created: \${PR_URL}"
    fi
  fi

  # ── Report success ──
  report_complete "\${COMMIT_HASH}"
  echo "=== Task Complete ==="
else
  echo "No changes detected"
  report_complete "no-changes"
  echo "=== Task Complete (no changes) ==="
fi

exit 0
`;
  }

  /**
   * Check if all tasks in a pipeline are done. If so, run post-completion.
   */
  _checkPipelineCompletion(pipeline) {
    const allDone = pipeline.tasks.every(t => t.status === 'completed' || t.status === 'failed');
    if (!allDone) return;

    const completed = pipeline.tasks.filter(t => t.status === 'completed').length;
    const failed = pipeline.tasks.filter(t => t.status === 'failed').length;

    console.log(`[PipelineRunner] Pipeline ${pipeline.id} finished: ${completed} completed, ${failed} failed`);

    if (completed > 0) {
      pipeline.phase = 'completed';
    } else {
      pipeline.phase = 'failed';
      pipeline.error = `All ${failed} task(s) failed`;
    }

    pipeline.completedAt = new Date();
    this._emitStatus(pipeline);
    this._savePipelineState(pipeline);

    // Release lifecycle hold if no other pipelines are active
    if (this.lifecycleManager) {
      const anyActive = [...this.pipelines.values()].some(p => p.phase === 'executing' || p.phase === 'spawning' || p.phase === 'planning');
      if (!anyActive) {
        this.lifecycleManager.releaseHold();
      }
    }

    // Clean up agent mappings
    for (const task of pipeline.tasks) {
      if (task.agentId) {
        this.agentTasks.delete(task.agentId);
      }
    }
  }

  /**
   * Decompose a goal into tasks (rule-based, same logic as planManager).
   */
  _decomposeGoal(goal, repoUrl) {
    const lower = goal.toLowerCase();
    const repoName = (repoUrl || '').split('/').pop() || 'repo';
    const subtasks = [];

    if (/test|coverage|spec/i.test(lower)) {
      subtasks.push({ title: `Add unit tests for ${repoName}`, description: `Analyze ${repoName} source code and add comprehensive unit tests. Focus on critical paths and edge cases. Goal: ${goal}` });
    }
    if (/refactor|restructure|clean|organiz|simplif/i.test(lower)) {
      subtasks.push({ title: `Refactor ${repoName} codebase`, description: `Review and refactor code for clarity, maintainability, and best practices. Goal: ${goal}` });
    }
    if (/fix|bug|issue|error|broken|placeholder|hardcoded/i.test(lower)) {
      subtasks.push({ title: `Fix issues in ${repoName}`, description: `Identify and fix bugs, lint errors, and broken functionality. Goal: ${goal}` });
    }
    if (/document|readme|doc|guide|comment/i.test(lower)) {
      subtasks.push({ title: `Improve documentation for ${repoName}`, description: `Add or improve documentation, README, code comments, and guides. Goal: ${goal}` });
    }
    if (/ci[\s/]*cd|pipeline|workflow|github.actions|deploy/i.test(lower)) {
      subtasks.push({ title: `Set up CI/CD for ${repoName}`, description: `Create or improve CI/CD pipelines including GitHub Actions workflows, automated testing, linting, and deployment. Goal: ${goal}` });
    }
    if (/polish|ui|dashboard|ux|design|style|visual/i.test(lower)) {
      subtasks.push({ title: `Polish UI for ${repoName}`, description: `Improve the UI/UX, fix visual issues, update dashboard with real metrics, and enhance styling. Goal: ${goal}` });
    }
    if (/add|implement|build|create|feature|new/i.test(lower) && subtasks.length === 0) {
      subtasks.push({ title: `Implement: ${goal.slice(0, 80)}`, description: `Implement the following in ${repoName}: ${goal}` });
    }
    if (/performance|optimiz|speed|fast|slow/i.test(lower)) {
      subtasks.push({ title: `Optimize performance in ${repoName}`, description: `Profile and optimize performance bottlenecks. Goal: ${goal}` });
    }
    if (/security|vulnerab|auth|permission|xss|injection/i.test(lower)) {
      subtasks.push({ title: `Security review for ${repoName}`, description: `Audit code for security vulnerabilities and apply fixes. Goal: ${goal}` });
    }

    if (subtasks.length === 0) {
      subtasks.push({ title: goal.slice(0, 100), description: `Complete the following work on ${repoName}: ${goal}` });
    }

    return subtasks;
  }

  /**
   * Get the callback URL that agents use to phone home.
   */
  _getCallbackUrl() {
    // In production (Fly.io), use the public URL
    if (process.env.FLY_APP_NAME) {
      return `https://${process.env.FLY_APP_NAME}.fly.dev`;
    }
    // Locally, use the server's own URL
    const port = process.env.PORT || 3001;
    return process.env.CALLBACK_BASE_URL || `http://localhost:${port}`;
  }

  /**
   * Look up stored API key for an agent type.
   */
  _getApiKey(agentType) {
    const credPath = path.join(this.workspaceRoot, '.createsuite', 'provider-credentials.json');
    if (!fs.existsSync(credPath)) return null;

    try {
      const creds = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
      const providerMapping = {
        claude: 'anthropic',
        openai: 'openai',
        gemini: 'google',
        huggingface: 'huggingface',
        zai: 'anthropic',
        'github-copilot': 'github-copilot'
      };
      const provider = providerMapping[agentType] || agentType;
      const entry = creds[provider];
      // Also check env vars as fallback
      if (!entry) {
        const envMapping = {
          anthropic: 'ANTHROPIC_API_KEY',
          openai: 'OPENAI_API_KEY',
          google: 'GOOGLE_API_KEY',
          huggingface: 'HF_TOKEN',
          'github-copilot': 'GITHUB_TOKEN'
        };
        return process.env[envMapping[provider]] || null;
      }
      return typeof entry === 'object' ? entry.value : entry;
    } catch {
      return null;
    }
  }

  _emitStatus(pipeline) {
    this.io.emit('pipeline:status', {
      id: pipeline.id,
      phase: pipeline.phase,
      repoUrl: pipeline.repoUrl,
      goal: pipeline.goal,
      tasks: pipeline.tasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        agentId: t.agentId,
        branch: t.branch,
        error: t.error
      })),
      startedAt: pipeline.startedAt,
      completedAt: pipeline.completedAt,
      error: pipeline.error
    });
  }

  _savePipelineState(pipeline) {
    const dir = path.join(this.workspaceRoot, '.createsuite', 'pipelines');
    try { fs.mkdirSync(dir, { recursive: true }); } catch {}
    const filePath = path.join(dir, `${pipeline.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(pipeline, null, 2));
  }
}

module.exports = { PipelineRunner };
