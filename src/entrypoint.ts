import { RepoManager } from './repoManager';
import { PlanManager } from './planManager';
import { PRManager } from './prManager';
import { ConvoyManager } from './convoyManager';
import { TaskManager } from './taskManager';
import { AgentOrchestrator } from './agentOrchestrator';
import {
  PipelineConfig,
  PipelineStatus,
  PipelinePhase,
  ConvoyStatus,
  TaskStatus,
  AgentRuntime
} from './types';
import { v4 as uuidv4 } from 'uuid';
import * as fsp from 'fs/promises';
import * as path from 'path';

/**
 * Entrypoint — the top-level orchestrator for a full CreateSuite run.
 *
 * Two modes of operation:
 *
 * 1. **API mode (preferred)** — The UI server's PipelineRunner handles everything.
 *    Agents report back via callback API. No polling. No human required.
 *    Trigger via `POST /api/pipeline/start`.
 *
 * 2. **CLI mode (fallback)** — Runs locally via `cs start <repo>`.
 *    Uses managed child processes with completion callbacks.
 *    The `start()` method orchestrates clone → plan → execute → wait → PR.
 *
 * Pipeline:
 *   1. Clone the target repo
 *   2. Create a plan (decompose goal into tasks + convoy)
 *   3. Assign agents and execute tasks
 *   4. Wait for agent completion (via callbacks, not polling)
 *   5. Commit and push agent work
 *   6. Open a GitHub PR
 *   7. Return PR URL
 */
export class Entrypoint {
  private workspaceRoot: string;
  private repoManager: RepoManager;
  private planManager: PlanManager;
  private prManager: PRManager;
  private convoyManager: ConvoyManager;
  private taskManager: TaskManager;
  private orchestrator: AgentOrchestrator;
  private statusPath: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.repoManager = new RepoManager(workspaceRoot);
    this.planManager = new PlanManager(workspaceRoot);
    this.prManager = new PRManager();
    this.convoyManager = new ConvoyManager(workspaceRoot);
    this.taskManager = new TaskManager(workspaceRoot);
    this.orchestrator = new AgentOrchestrator(workspaceRoot);
    this.statusPath = path.join(workspaceRoot, '.createsuite', 'pipeline-status.json');
  }

  /**
   * Trigger a pipeline via the server's PipelineRunner API.
   * This is the preferred agent-driven mode — returns immediately,
   * agents work autonomously and report back via callbacks.
   */
  async triggerRemote(config: PipelineConfig, serverUrl?: string): Promise<{ pipelineId: string }> {
    const url = serverUrl || process.env.CREATESUITE_SERVER_URL || 'http://localhost:3001';
    const resp = await fetch(`${url}/api/pipeline/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repoUrl: config.repoUrl,
        goal: config.goal,
        provider: config.provider,
        model: config.model,
        githubToken: config.githubToken,
        maxAgents: config.maxAgents
      })
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Pipeline API error: ${resp.status} — ${body}`);
    }

    const result = await resp.json() as { success: boolean; data: { pipelineId: string } };
    console.log(`Pipeline started: ${result.data.pipelineId}`);
    console.log('Agents will work autonomously. Track progress at:');
    console.log(`  ${url}/api/pipeline/status/${result.data.pipelineId}`);
    return result.data;
  }

  /**
   * Run the full CreateSuite pipeline locally (CLI mode).
   * Uses managed child processes with completion callbacks — not polling.
   */
  async start(config: PipelineConfig): Promise<PipelineStatus> {
    const pipelineId = uuidv4().slice(0, 12);
    const status: PipelineStatus = {
      id: pipelineId,
      repoUrl: config.repoUrl,
      goal: config.goal,
      phase: PipelinePhase.CLONING,
      startedAt: new Date()
    };

    try {
      await this.saveStatus(status);

      // ── Phase 1: Clone the target repo ──
      console.log(`\n🔄 Phase 1: Cloning ${config.repoUrl}...`);
      status.phase = PipelinePhase.CLONING;
      await this.saveStatus(status);

      const repoConfig = await this.repoManager.cloneRepo(config.repoUrl, {
        githubToken: config.githubToken
      });
      console.log(`✓ Cloned to ${repoConfig.localPath}`);

      if (config.dryRun) {
        console.log('\n🏁 Dry run complete. Repo cloned, no work executed.');
        status.phase = PipelinePhase.COMPLETED;
        status.completedAt = new Date();
        await this.saveStatus(status);
        return status;
      }

      // ── Phase 2: Create plan ──
      console.log(`\n📋 Phase 2: Planning tasks for "${config.goal}"...`);
      status.phase = PipelinePhase.PLANNING;
      await this.saveStatus(status);

      const runtime = process.env.FLY_API_TOKEN ? AgentRuntime.FLY : AgentRuntime.LOCAL;
      const { plan, convoy, tasks } = await this.planManager.createPlan(
        config.goal,
        repoConfig,
        {
          maxAgents: config.maxAgents || 3,
          runtime,
          provider: config.provider
        }
      );
      status.convoyId = convoy.id;
      await this.saveStatus(status);
      console.log(`✓ Plan created: ${tasks.length} task(s) in convoy ${convoy.id}`);

      // ── Phase 3: Execute ──
      console.log(`\n⚡ Phase 3: Executing convoy ${convoy.id}...`);
      status.phase = PipelinePhase.EXECUTING;
      await this.saveStatus(status);

      // Execute plan — for Fly runtime, this delegates to PipelineRunner via API.
      // For local runtime, agents are managed child processes with callbacks.
      if (runtime === AgentRuntime.FLY && !config.dryRun) {
        // Delegate to the server's PipelineRunner (if running)
        try {
          const remote = await this.triggerRemote(config);
          status.phase = PipelinePhase.EXECUTING;
          await this.saveStatus(status);
          console.log(`Delegated to PipelineRunner: ${remote.pipelineId}`);
          console.log('Agents are working autonomously. Use the API to check status.');
          return status;
        } catch (err: any) {
          console.log(`Server not available (${err.message}), falling back to local execution`);
        }
      }

      // Local execution with completion callbacks
      await this.planManager.executePlan(convoy, repoConfig, {
        provider: config.provider,
        model: config.model,
        githubToken: config.githubToken
      });

      // Wait for all agents to finish (callback-driven, with timeout safety net)
      await this.waitForAgentCompletion(convoy.id, tasks.length);

      // ── Phase 4: Commit ──
      console.log(`\n💾 Phase 4: Committing agent work...`);
      status.phase = PipelinePhase.COMMITTING;
      await this.saveStatus(status);

      const branchName = `createsuite/${convoy.id}`;
      await this.repoManager.createWorkBranch(repoConfig, 'consolidated', convoy.id);

      const commitResult = await this.repoManager.commitAndPush(
        repoConfig,
        branchName,
        `feat: ${config.goal}\n\nAutomated by CreateSuite\nConvoy: ${convoy.id}\nTasks: ${tasks.map(t => t.id).join(', ')}`
      );

      if (!commitResult.pushed) {
        console.log('ℹ No changes to push (agents may not have modified any files)');
        status.phase = PipelinePhase.COMPLETED;
        status.completedAt = new Date();
        await this.saveStatus(status);
        return status;
      }

      console.log(`✓ Pushed branch ${branchName} (${commitResult.commitHash})`);

      // ── Phase 5: Create PR ──
      console.log(`\n🔀 Phase 5: Creating pull request...`);
      status.phase = PipelinePhase.PR_CREATING;
      await this.saveStatus(status);

      if (config.githubToken) {
        this.prManager = new PRManager(config.githubToken);
      }

      const prBody = PRManager.buildPRBody({
        goal: config.goal,
        taskId: tasks.map(t => t.id).join(', '),
        agentName: `CreateSuite (${tasks.length} agent${tasks.length > 1 ? 's' : ''})`,
        convoyId: convoy.id,
        changes: tasks.map(t => t.title)
      });

      try {
        const pr = await this.prManager.createPR({
          repoConfig,
          branch: branchName,
          title: `[CreateSuite] ${config.goal}`,
          body: prBody
        });
        status.prUrl = pr.url;
        console.log(`✓ PR created: ${pr.url}`);
      } catch (prError: any) {
        console.log(`⚠ PR creation failed: ${prError.message}`);
        console.log('Branch was pushed — you can create the PR manually.');
      }

      // ── Done ──
      status.phase = PipelinePhase.COMPLETED;
      status.completedAt = new Date();
      await this.saveStatus(status);

      console.log(`\n🎉 Pipeline complete!`);
      console.log(`   Convoy: ${convoy.id}`);
      console.log(`   Tasks: ${tasks.length}`);
      console.log(`   Branch: ${branchName}`);
      if (status.prUrl) {
        console.log(`   PR: ${status.prUrl}`);
      }
      console.log(`   Duration: ${this.formatDuration(status.startedAt, status.completedAt)}`);

      return status;

    } catch (error: any) {
      status.phase = PipelinePhase.FAILED;
      status.error = error.message;
      status.completedAt = new Date();
      await this.saveStatus(status);

      console.error(`\n❌ Pipeline failed in phase ${status.phase}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get the current pipeline status.
   */
  async getStatus(): Promise<PipelineStatus | null> {
    try {
      const data = await fsp.readFile(this.statusPath, 'utf-8');
      const status = JSON.parse(data);
      status.startedAt = new Date(status.startedAt);
      if (status.completedAt) status.completedAt = new Date(status.completedAt);
      return status;
    } catch {
      return null;
    }
  }

  // -- Private --

  /**
   * Wait for all agents in a convoy to finish their work.
   * Uses a combination of task status checks and a timeout.
   * The orchestrator's managed processes update status on exit.
   */
  private async waitForAgentCompletion(convoyId: string, taskCount: number): Promise<void> {
    const maxWait = 15 * 60 * 1000; // 15 minutes max
    const checkInterval = 3000; // 3 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const progress = await this.convoyManager.getConvoyProgress(convoyId);

      const done = progress.completed + (progress.total - progress.completed - progress.inProgress - progress.open);
      if (done >= progress.total && progress.total > 0) {
        console.log(`✓ All ${progress.total} tasks finished (${progress.completed} completed)`);
        return;
      }

      if (progress.completed === progress.total && progress.total > 0) {
        console.log(`✓ All ${progress.total} tasks completed`);
        return;
      }

      // Check if all non-completed tasks have agents that are no longer working
      const agents = await this.orchestrator.listAgents();
      const workingAgents = agents.filter(a => a.status === 'working' as any);
      if (workingAgents.length === 0 && progress.inProgress === 0 && progress.open === 0) {
        console.log(`✓ No agents still working — convoy done`);
        return;
      }

      console.log(
        `  Progress: ${progress.completed}/${progress.total} tasks ` +
        `(${progress.inProgress} in progress, ${workingAgents.length} agents active)`
      );

      await new Promise(r => setTimeout(r, checkInterval));
    }

    console.log('⚠ Timeout waiting for agents — continuing with what we have');
  }

  private async saveStatus(status: PipelineStatus): Promise<void> {
    const dir = path.dirname(this.statusPath);
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(this.statusPath, JSON.stringify(status, null, 2));
  }

  private formatDuration(start: Date, end: Date): string {
    const ms = end.getTime() - start.getTime();
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}
