import { v4 as uuidv4 } from 'uuid';
import { Agent, AgentStatus, Message } from './types';
import { ConfigManager } from './config';
import * as child_process from 'child_process';

/**
 * Manages agent lifecycle and orchestration
 */
export class AgentOrchestrator {
  private configManager: ConfigManager;
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.configManager = new ConfigManager(workspaceRoot);
  }

  /**
   * Create a new agent
   */
  async createAgent(
    name: string,
    capabilities: string[] = ['general']
  ): Promise<Agent> {
    const agent: Agent = {
      id: uuidv4(),
      name,
      status: AgentStatus.IDLE,
      mailbox: [],
      capabilities,
      createdAt: new Date()
    };

    await this.configManager.saveAgent(agent);
    return agent;
  }

  /**
   * Get agent by ID
   */
  async getAgent(agentId: string): Promise<Agent | null> {
    return await this.configManager.loadAgent(agentId);
  }

  /**
   * Update agent status
   */
  async updateAgent(agentId: string, updates: Partial<Agent>): Promise<Agent> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const updatedAgent = {
      ...agent,
      ...updates
    };

    await this.configManager.saveAgent(updatedAgent);
    return updatedAgent;
  }

  /**
   * List all agents
   */
  async listAgents(): Promise<Agent[]> {
    return await this.configManager.listAgents();
  }

  /**
   * Get idle agents
   */
  async getIdleAgents(): Promise<Agent[]> {
    const agents = await this.listAgents();
    return agents.filter(a => a.status === AgentStatus.IDLE);
  }

  /**
   * Send message to agent
   */
  async sendMessage(
    from: string,
    toAgentId: string,
    subject: string,
    body: string
  ): Promise<void> {
    const agent = await this.getAgent(toAgentId);
    if (!agent) {
      throw new Error(`Agent not found: ${toAgentId}`);
    }

    const message: Message = {
      id: uuidv4(),
      from,
      to: toAgentId,
      subject,
      body,
      timestamp: new Date(),
      read: false
    };

    agent.mailbox.push(message);
    await this.configManager.saveAgent(agent);
  }

  /**
   * Get unread messages for agent
   */
  async getUnreadMessages(agentId: string): Promise<Message[]> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    return agent.mailbox.filter(m => !m.read);
  }

  /**
   * Mark message as read
   */
  async markMessageRead(agentId: string, messageId: string): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const message = agent.mailbox.find(m => m.id === messageId);
    if (message) {
      message.read = true;
      await this.configManager.saveAgent(agent);
    }
  }

  /**
   * Spawn OpenCode terminal for agent
   */
  async spawnOpenCodeTerminal(agentId: string): Promise<number> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Sanitize workspace root to prevent command injection
    const sanitizedWorkspace = this.workspaceRoot.replace(/['"\\$`]/g, '\\$&');
    
    // Create a script to install and run OpenCode
    const script = `
      #!/bin/bash
      # Install OpenCode if not already installed
      if ! command -v opencode &> /dev/null; then
        curl -fsSL https://opencode.ai/install | bash
      fi
      
      # Run OpenCode in the workspace
      cd "${sanitizedWorkspace}"
      opencode
    `;

    // For now, we'll simulate terminal spawning
    // In production, this would integrate with actual terminal emulators
    console.log(`Would spawn OpenCode terminal for agent ${agent.name}`);
    console.log('Script:', script);

    // Placeholder PID - use null in production until actual terminal spawning is implemented
    const pid = undefined;
    
    await this.updateAgent(agentId, {
      terminalPid: pid,
      status: AgentStatus.WORKING
    });

    return pid || 0;
  }

  /**
   * Assign task to agent and spawn terminal
   */
  async assignTaskToAgent(agentId: string, taskId: string): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Update agent with current task
    await this.updateAgent(agentId, {
      currentTask: taskId,
      status: AgentStatus.WORKING
    });

    // Send message with task details
    await this.sendMessage(
      'system',
      agentId,
      'New Task Assignment',
      `You have been assigned task: ${taskId}`
    );

    // Spawn terminal if not already running
    if (!agent.terminalPid) {
      await this.spawnOpenCodeTerminal(agentId);
    }
  }

  /**
   * Stop agent and cleanup
   */
  async stopAgent(agentId: string): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Update agent status
    await this.updateAgent(agentId, {
      status: AgentStatus.OFFLINE,
      currentTask: undefined,
      terminalPid: undefined
    });
  }
}
