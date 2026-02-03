/**
 * CreateSuite Agent Spawner
 * 
 * Dynamically spawns Fly.io Machines for each AI agent.
 * Each agent runs in its own isolated container with:
 * - OpenCode CLI pre-installed
 * - Provider-specific API keys
 * - Git integration for code sync
 * - WebSocket connection back to the UI
 * 
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                        Fly.io App                               │
 * │  ┌──────────────────┐                                           │
 * │  │   UI Machine     │ ◄──── createsuite-agent-ui.fly.dev       │
 * │  │  (React + API)   │                                           │
 * │  └────────┬─────────┘                                           │
 * │           │ Fly Machines API                                    │
 * │           ▼                                                     │
 * │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
 * │  │  Claude Agent    │  │  OpenAI Agent    │  │  Gemini Agent  │ │
 * │  │  (Machine 1)     │  │  (Machine 2)     │  │  (Machine 3)   │ │
 * │  │  ANTHROPIC_KEY   │  │  OPENAI_KEY      │  │  GOOGLE_KEY    │ │
 * │  └──────────────────┘  └──────────────────┘  └────────────────┘ │
 * └─────────────────────────────────────────────────────────────────┘
 */

const https = require('https');
const { v4: uuidv4 } = require('uuid');

// Fly.io API configuration
const FLY_API_HOST = 'api.machines.dev';
const FLY_APP_NAME = process.env.FLY_APP_NAME || 'createsuite-agent-ui';
const FLY_API_TOKEN = process.env.FLY_API_TOKEN;

// Agent Docker image (same image, different env vars)
const AGENT_IMAGE = process.env.AGENT_IMAGE || `registry.fly.io/${FLY_APP_NAME}:latest`;

// Agent configurations
const AGENT_CONFIGS = {
  claude: {
    name: 'Sisyphus',
    model: 'claude-opus-4.5',
    provider: 'anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    description: 'Task automation and complex reasoning',
    color: '#7c3aed'
  },
  openai: {
    name: 'Oracle', 
    model: 'gpt-5.2',
    provider: 'openai',
    envVar: 'OPENAI_API_KEY',
    description: 'Architecture advice and debugging',
    color: '#10a37f'
  },
  gemini: {
    name: 'Engineer',
    model: 'gemini-3-pro',
    provider: 'google',
    envVar: 'GOOGLE_API_KEY',
    description: 'UI/UX specialist and multimodal tasks',
    color: '#4285f4'
  },
  huggingface: {
    name: 'Artisan',
    model: 'stable-diffusion-3.5-large',
    provider: 'huggingface',
    envVar: 'HF_TOKEN',
    description: 'Asset and image generation',
    color: '#ff9d00'
  }
};

class AgentSpawner {
  constructor(io) {
    this.io = io;
    this.activeAgents = new Map(); // agentId -> machine info
    this.pendingSpawns = new Map(); // agentId -> spawn promise
  }

  /**
   * Make a request to Fly.io Machines API
   */
  async flyRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: FLY_API_HOST,
        port: 443,
        path: `/v1/apps/${FLY_APP_NAME}${path}`,
        method,
        headers: {
          'Authorization': `Bearer ${FLY_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode >= 400) {
              reject(new Error(`Fly API error ${res.statusCode}: ${JSON.stringify(json)}`));
            } else {
              resolve(json);
            }
          } catch (e) {
            resolve(data);
          }
        });
      });

      req.on('error', reject);
      
      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  /**
   * Spawn a new agent machine
   */
  async spawnAgent(agentType, apiKey, options = {}) {
    const config = AGENT_CONFIGS[agentType];
    if (!config) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }

    const agentId = uuidv4().slice(0, 8);
    const machineName = `agent-${agentType}-${agentId}`;

    console.log(`[AgentSpawner] Spawning ${config.name} agent: ${machineName}`);

    // Emit spawning status
    this.io.emit('agent:spawning', {
      agentId,
      type: agentType,
      name: config.name,
      status: 'spawning'
    });

    // Check if we have API token
    if (!FLY_API_TOKEN) {
      console.error('[AgentSpawner] No FLY_API_TOKEN - cannot spawn machines');
      throw new Error('Agent spawning requires FLY_API_TOKEN');
    }

    // Build environment variables for the agent
    const env = {
      // Agent identity
      AGENT_ID: agentId,
      AGENT_TYPE: agentType,
      AGENT_NAME: config.name,
      
      // Provider configuration
      OPENCODE_PROVIDER: config.provider,
      OPENCODE_MODEL: config.model,
      [config.envVar]: apiKey,
      
      // Connect back to UI
      UI_WEBSOCKET_URL: `wss://${FLY_APP_NAME}.fly.dev`,
      
      // Mode
      AGENT_MODE: 'worker',
      NODE_ENV: 'production',
      
      // Git integration (if provided)
      ...(options.githubToken && { GITHUB_TOKEN: options.githubToken }),
      ...(options.repoUrl && { REPO_URL: options.repoUrl }),
      
      // Task assignment (if provided)
      ...(options.taskId && { ASSIGNED_TASK: options.taskId })
    };

    // Machine configuration
    const machineConfig = {
      name: machineName,
      region: process.env.FLY_REGION || 'iad',
      config: {
        image: AGENT_IMAGE,
        env,
        guest: {
          cpu_kind: 'shared',
          cpus: 1,
          memory_mb: 1024
        },
        auto_destroy: true, // Destroy when stopped
        restart: {
          policy: 'no' // Don't auto-restart - let it die when done
        },
        services: [
          {
            ports: [{ port: 8080, handlers: ['http'] }],
            protocol: 'tcp',
            internal_port: 8080
          }
        ],
        metadata: {
          agent_id: agentId,
          agent_type: agentType,
          spawned_at: new Date().toISOString(),
          spawned_by: 'ui'
        }
      }
    };

    try {
      // Create the machine
      const machine = await this.flyRequest('POST', '/machines', machineConfig);
      
      console.log(`[AgentSpawner] Machine created: ${machine.id}`);
      
      // Track the agent
      this.activeAgents.set(agentId, {
        machineId: machine.id,
        type: agentType,
        name: config.name,
        status: 'starting',
        createdAt: new Date(),
        ...config
      });

      // Wait for machine to start
      await this.waitForMachine(machine.id);

      // Update status
      const agentInfo = this.activeAgents.get(agentId);
      agentInfo.status = 'running';
      
      // Emit ready status
      this.io.emit('agent:ready', {
        agentId,
        machineId: machine.id,
        type: agentType,
        name: config.name,
        status: 'running'
      });

      console.log(`[AgentSpawner] Agent ${config.name} is ready: ${machine.id}`);
      
      return {
        agentId,
        machineId: machine.id,
        ...agentInfo
      };

    } catch (error) {
      console.error(`[AgentSpawner] Failed to spawn agent:`, error);
      
      this.io.emit('agent:error', {
        agentId,
        type: agentType,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Wait for a machine to be in 'started' state
   */
  async waitForMachine(machineId, maxWait = 60000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      try {
        const machine = await this.flyRequest('GET', `/machines/${machineId}`);
        
        if (machine.state === 'started') {
          return machine;
        }
        
        if (machine.state === 'failed' || machine.state === 'destroyed') {
          throw new Error(`Machine failed to start: ${machine.state}`);
        }
        
        // Wait 2 seconds before checking again
        await new Promise(r => setTimeout(r, 2000));
        
      } catch (error) {
        console.error(`[AgentSpawner] Error checking machine status:`, error);
        throw error;
      }
    }
    
    throw new Error(`Machine ${machineId} did not start within ${maxWait}ms`);
  }

  /**
   * Stop an agent machine
   */
  async stopAgent(agentId) {
    const agent = this.activeAgents.get(agentId);
    if (!agent) {
      console.warn(`[AgentSpawner] Agent not found: ${agentId}`);
      return;
    }

    console.log(`[AgentSpawner] Stopping agent: ${agent.name} (${agent.machineId})`);

    try {
      // Stop the machine
      await this.flyRequest('POST', `/machines/${agent.machineId}/stop`);
      
      // Remove from tracking
      this.activeAgents.delete(agentId);
      
      this.io.emit('agent:stopped', { agentId });
      
    } catch (error) {
      console.error(`[AgentSpawner] Failed to stop agent:`, error);
      throw error;
    }
  }

  /**
   * List all active agents
   */
  getActiveAgents() {
    return Array.from(this.activeAgents.entries()).map(([id, info]) => ({
      agentId: id,
      ...info
    }));
  }

  /**
   * Get agent configurations
   */
  getAgentConfigs() {
    return AGENT_CONFIGS;
  }

  /**
   * Cleanup - stop all agents
   */
  async cleanup() {
    console.log(`[AgentSpawner] Cleaning up ${this.activeAgents.size} agents`);
    
    for (const [agentId] of this.activeAgents) {
      try {
        await this.stopAgent(agentId);
      } catch (e) {
        console.error(`[AgentSpawner] Failed to stop agent ${agentId}:`, e);
      }
    }
  }
}

/**
 * Git-based Agent Spawning
 * 
 * This is for spawning agents that will:
 * 1. Clone a repository
 * 2. Run OpenCode to complete a task
 * 3. Commit and push changes
 * 4. Open a PR
 * 5. Self-terminate
 */
class GitAgentSpawner extends AgentSpawner {
  
  /**
   * Spawn an agent to work on a GitHub issue/task
   */
  async spawnForTask(task) {
    const { 
      agentType = 'claude',
      apiKey,
      repoUrl,
      githubToken,
      taskDescription,
      branch = `agent/${uuidv4().slice(0, 8)}`
    } = task;

    // Build the task script
    const taskScript = `
      #!/bin/bash
      set -e
      
      echo "🚀 Agent starting task..."
      
      # Clone the repository
      git clone --depth=1 \${REPO_URL} /workspace
      cd /workspace
      
      # Create working branch
      git checkout -b ${branch}
      
      # Run OpenCode with the task
      echo "📝 Task: ${taskDescription}"
      opencode --task "${taskDescription}"
      
      # Commit changes
      git add -A
      git commit -m "feat: ${taskDescription.slice(0, 50)}" || echo "No changes to commit"
      
      # Push and create PR
      git push -u origin ${branch}
      gh pr create --title "${taskDescription.slice(0, 50)}" --body "Automated by CreateSuite Agent" || echo "PR creation skipped"
      
      echo "✅ Task complete!"
    `;

    // Store task script for the agent to execute
    return this.spawnAgent(agentType, apiKey, {
      githubToken,
      repoUrl,
      taskScript,
      taskId: task.id
    });
  }
}

module.exports = { AgentSpawner, GitAgentSpawner, AGENT_CONFIGS };
