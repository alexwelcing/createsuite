import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { WorkspaceConfig, Agent, Task, Convoy, AgentRuntime } from './types';

/**
 * Manages workspace configuration and state
 */
export class ConfigManager {
  private configPath: string;
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.configPath = path.join(workspaceRoot, '.createsuite', 'config.json');
  }

  /**
   * Initialize workspace configuration
   */
  async initialize(name: string, repository?: string): Promise<void> {
    const configDir = path.dirname(this.configPath);
    
    try {
      await fsp.access(configDir);
    } catch {
      await fsp.mkdir(configDir, { recursive: true });
    }

    const config: WorkspaceConfig = {
      name,
      path: this.workspaceRoot,
      repository,
      agents: [],
      oauthConfig: {
        scopes: ['repo', 'workflow']
      }
    };

    await this.saveConfig(config);
    
    // Create additional directories
    const dirs = [
      path.join(this.workspaceRoot, '.createsuite', 'tasks'),
      path.join(this.workspaceRoot, '.createsuite', 'agents'),
      path.join(this.workspaceRoot, '.createsuite', 'convoys'),
      path.join(this.workspaceRoot, '.createsuite', 'hooks')
    ];

    for (const dir of dirs) {
      try {
        await fsp.access(dir);
      } catch {
        await fsp.mkdir(dir, { recursive: true });
      }
    }
  }

  /**
   * Load workspace configuration
   */
  async loadConfig(): Promise<WorkspaceConfig> {
    try {
      const data = await fsp.readFile(this.configPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      throw new Error('Workspace not initialized. Run: cs init');
    }
  }

  /**
   * Save workspace configuration
   */
  async saveConfig(config: WorkspaceConfig): Promise<void> {
    await fsp.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }

  /**
   * Save task to git-backed storage
   */
  async saveTask(task: Task): Promise<void> {
    const taskPath = path.join(
      this.workspaceRoot,
      '.createsuite',
      'tasks',
      `${task.id}.json`
    );
    await fsp.writeFile(taskPath, JSON.stringify(task, null, 2));
  }

  /**
   * Load task from storage
   */
  async loadTask(taskId: string): Promise<Task | null> {
    const taskPath = path.join(
      this.workspaceRoot,
      '.createsuite',
      'tasks',
      `${taskId}.json`
    );

    try {
      const data = await fsp.readFile(taskPath, 'utf-8');
      const task = JSON.parse(data);
      
      // Convert date strings back to Date objects
      task.createdAt = new Date(task.createdAt);
      task.updatedAt = new Date(task.updatedAt);
      
      return task;
    } catch {
      return null;
    }
  }

  /**
   * List all tasks
   */
  async listTasks(): Promise<Task[]> {
    const tasksDir = path.join(this.workspaceRoot, '.createsuite', 'tasks');
    
    try {
      const files = await fsp.readdir(tasksDir);
      const jsonFiles = files.filter((f: string) => f.endsWith('.json'));
      const tasks: Task[] = [];

      for (const file of jsonFiles) {
        const taskId = file.replace('.json', '');
        const task = await this.loadTask(taskId);
        if (task) {
          tasks.push(task);
        }
      }

      return tasks;
    } catch {
      return [];
    }
  }

  /**
   * Save agent state
   */
  async saveAgent(agent: Agent): Promise<void> {
    const agentPath = path.join(
      this.workspaceRoot,
      '.createsuite',
      'agents',
      `${agent.id}.json`
    );
    await fsp.writeFile(agentPath, JSON.stringify(agent, null, 2));
  }

  /**
   * Load agent state
   */
  async loadAgent(agentId: string): Promise<Agent | null> {
    const agentPath = path.join(
      this.workspaceRoot,
      '.createsuite',
      'agents',
      `${agentId}.json`
    );

    try {
      const data = await fsp.readFile(agentPath, 'utf-8');
      const agent = JSON.parse(data);
      agent.createdAt = new Date(agent.createdAt);
      agent.runtime = agent.runtime ?? AgentRuntime.LOCAL;
      return agent;
    } catch {
      return null;
    }
  }

  /**
   * List all agents
   */
  async listAgents(): Promise<Agent[]> {
    const agentsDir = path.join(this.workspaceRoot, '.createsuite', 'agents');
    
    try {
      const files = await fsp.readdir(agentsDir);
      const jsonFiles = files.filter((f: string) => f.endsWith('.json'));
      const agents: Agent[] = [];

      for (const file of jsonFiles) {
        const agentId = file.replace('.json', '');
        const agent = await this.loadAgent(agentId);
        if (agent) {
          agents.push(agent);
        }
      }

      return agents;
    } catch {
      return [];
    }
  }

  /**
   * Save convoy
   */
  async saveConvoy(convoy: Convoy): Promise<void> {
    const convoyPath = path.join(
      this.workspaceRoot,
      '.createsuite',
      'convoys',
      `${convoy.id}.json`
    );
    await fsp.writeFile(convoyPath, JSON.stringify(convoy, null, 2));
  }

  /**
   * Load convoy
   */
  async loadConvoy(convoyId: string): Promise<Convoy | null> {
    const convoyPath = path.join(
      this.workspaceRoot,
      '.createsuite',
      'convoys',
      `${convoyId}.json`
    );

    try {
      const data = await fsp.readFile(convoyPath, 'utf-8');
      const convoy = JSON.parse(data);
      convoy.createdAt = new Date(convoy.createdAt);
      return convoy;
    } catch {
      return null;
    }
  }

  /**
   * List all convoys
   */
  async listConvoys(): Promise<Convoy[]> {
    const convoysDir = path.join(this.workspaceRoot, '.createsuite', 'convoys');
    
    try {
      const files = await fsp.readdir(convoysDir);
      const jsonFiles = files.filter((f: string) => f.endsWith('.json'));
      const convoys: Convoy[] = [];

      for (const file of jsonFiles) {
        const convoyId = file.replace('.json', '');
        const convoy = await this.loadConvoy(convoyId);
        if (convoy) {
          convoys.push(convoy);
        }
      }

      return convoys;
    } catch {
      return [];
    }
  }
}
