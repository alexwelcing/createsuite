import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceConfig, Agent, Task, Convoy } from './types';

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
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
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
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Load workspace configuration
   */
  async loadConfig(): Promise<WorkspaceConfig> {
    if (!fs.existsSync(this.configPath)) {
      throw new Error('Workspace not initialized. Run: cs init');
    }

    const data = fs.readFileSync(this.configPath, 'utf-8');
    return JSON.parse(data);
  }

  /**
   * Save workspace configuration
   */
  async saveConfig(config: WorkspaceConfig): Promise<void> {
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
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
    fs.writeFileSync(taskPath, JSON.stringify(task, null, 2));
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

    if (!fs.existsSync(taskPath)) {
      return null;
    }

    const data = fs.readFileSync(taskPath, 'utf-8');
    const task = JSON.parse(data);
    
    // Convert date strings back to Date objects
    task.createdAt = new Date(task.createdAt);
    task.updatedAt = new Date(task.updatedAt);
    
    return task;
  }

  /**
   * List all tasks
   */
  async listTasks(): Promise<Task[]> {
    const tasksDir = path.join(this.workspaceRoot, '.createsuite', 'tasks');
    
    if (!fs.existsSync(tasksDir)) {
      return [];
    }

    const files = fs.readdirSync(tasksDir).filter(f => f.endsWith('.json'));
    const tasks: Task[] = [];

    for (const file of files) {
      const taskId = file.replace('.json', '');
      const task = await this.loadTask(taskId);
      if (task) {
        tasks.push(task);
      }
    }

    return tasks;
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
    fs.writeFileSync(agentPath, JSON.stringify(agent, null, 2));
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

    if (!fs.existsSync(agentPath)) {
      return null;
    }

    const data = fs.readFileSync(agentPath, 'utf-8');
    const agent = JSON.parse(data);
    agent.createdAt = new Date(agent.createdAt);
    return agent;
  }

  /**
   * List all agents
   */
  async listAgents(): Promise<Agent[]> {
    const agentsDir = path.join(this.workspaceRoot, '.createsuite', 'agents');
    
    if (!fs.existsSync(agentsDir)) {
      return [];
    }

    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.json'));
    const agents: Agent[] = [];

    for (const file of files) {
      const agentId = file.replace('.json', '');
      const agent = await this.loadAgent(agentId);
      if (agent) {
        agents.push(agent);
      }
    }

    return agents;
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
    fs.writeFileSync(convoyPath, JSON.stringify(convoy, null, 2));
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

    if (!fs.existsSync(convoyPath)) {
      return null;
    }

    const data = fs.readFileSync(convoyPath, 'utf-8');
    const convoy = JSON.parse(data);
    convoy.createdAt = new Date(convoy.createdAt);
    return convoy;
  }

  /**
   * List all convoys
   */
  async listConvoys(): Promise<Convoy[]> {
    const convoysDir = path.join(this.workspaceRoot, '.createsuite', 'convoys');
    
    if (!fs.existsSync(convoysDir)) {
      return [];
    }

    const files = fs.readdirSync(convoysDir).filter(f => f.endsWith('.json'));
    const convoys: Convoy[] = [];

    for (const file of files) {
      const convoyId = file.replace('.json', '');
      const convoy = await this.loadConvoy(convoyId);
      if (convoy) {
        convoys.push(convoy);
      }
    }

    return convoys;
  }
}
