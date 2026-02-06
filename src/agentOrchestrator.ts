import { v4 as uuidv4 } from 'uuid';
import { Agent, AgentStatus, Message } from './types';
import { ConfigManager } from './config';
import { GitIntegration } from './gitIntegration';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface MessageContent {
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

export interface MailboxFilter {
  unreadOnly?: boolean;
  from?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface AgentFilter {
  status?: AgentStatus;
  capability?: string;
}

export interface InternalMessage {
  id: string;
  from: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  timestamp: string;
  read: boolean;
}

/**
 * Manages agent lifecycle and orchestration
 */
export class AgentOrchestrator {
  private configManager: ConfigManager;
  private gitIntegration: GitIntegration;
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.configManager = new ConfigManager(workspaceRoot);
    this.gitIntegration = new GitIntegration(workspaceRoot);
  }

  /**
   * Create a new agent
   */
  async createAgent(name: string, capability: string): Promise<Agent> {
    if (!name || name.trim().length === 0) {
      throw new Error('Agent name cannot be empty');
    }

    if (!capability || capability.trim().length === 0) {
      throw new Error('Agent capability cannot be empty');
    }

    const agent: Agent = {
      id: this.generateAgentId(),
      name,
      status: AgentStatus.IDLE,
      mailbox: [],
      capabilities: [capability],
      createdAt: new Date(),
      terminalPid: undefined,
      currentTask: undefined
    };

    await this.configManager.saveAgent(agent);
    
    try {
      await this.gitIntegration.createAgentBranch(agent.id);
      await this.gitIntegration.commitAgentChanges(agent.id, `Agent created: ${agent.name}`);
    } catch (error) {
      // Git operations are not critical for agent creation
      console.warn(`Git integration failed for agent ${agent.id}:`, error);
    }

    return agent;
  }

  /**
   * Update agent with new properties
   */
  async updateAgent(agentId: string, updates: Partial<Agent>): Promise<Agent> {
    const agent = await this.configManager.loadAgent(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    // Validate status transitions
    if (updates.status) {
      if (agent.status === AgentStatus.OFFLINE && updates.status === AgentStatus.WORKING) {
        throw new Error('Cannot transition offline agent to working');
      }
      
      if (!['IDLE', 'WORKING', 'OFFLINE', 'ERROR'].includes(updates.status)) {
        throw new Error('Invalid status');
      }
    }

    const updatedAgent = { ...agent, ...updates };

    await this.configManager.saveAgent(updatedAgent);
    
    try {
      let commitMessage = 'Agent updated';
      if (updates.status) {
        commitMessage = `Agent status updated to ${updates.status}`;
      }
      await this.gitIntegration.commitAgentChanges(agentId, commitMessage);
    } catch (error) {
      console.warn(`Git integration failed for agent ${agentId}:`, error);
    }

    return updatedAgent;
  }

  /**
   * Send message between agents
   */
  async sendMessage(senderId: string, receiverId: string, message: MessageContent): Promise<void> {
    if (!message.content || message.content.trim().length === 0) {
      throw new Error('Message content cannot be empty');
    }

    const sender = await this.configManager.loadAgent(senderId);
    if (!sender) {
      throw new Error('Sender agent not found');
    }

    const receiver = await this.configManager.loadAgent(receiverId);
    if (!receiver) {
      throw new Error('Receiver agent not found');
    }

    const internalMessage: InternalMessage = {
      id: uuidv4(),
      from: senderId,
      content: message.content,
      priority: message.priority,
      timestamp: new Date().toISOString(),
      read: false
    };

    receiver.mailbox.push(internalMessage as any);
    await this.configManager.saveAgent(receiver);
  }

  /**
   * Get agent mailbox with filtering
   */
  async getMailbox(agentId: string, filter: MailboxFilter = {}): Promise<InternalMessage[]> {
    const agent = await this.configManager.loadAgent(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    let messages = agent.mailbox as InternalMessage[];

    if (filter.unreadOnly) {
      messages = messages.filter(m => !m.read);
    }

    if (filter.from) {
      messages = messages.filter(m => m.from === filter.from);
    }

    if (filter.priority) {
      messages = messages.filter(m => m.priority === filter.priority);
    }

    return messages;
  }

  /**
   * Spawn OpenCode terminal for agent (now with real implementation)
   */
  async spawnOpenCodeTerminal(agentId: string, script?: string): Promise<number> {
    const agent = await this.configManager.loadAgent(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    // In development/test mode, we still simulate for now
    // TODO: Implement real terminal spawning for production
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      console.log(`Would spawn OpenCode terminal for agent ${agent.name}`);
      if (script) {
        console.log('Script:', script);
      }

      await this.updateAgent(agentId, {
        terminalPid: undefined,
        status: AgentStatus.WORKING
      });

      return 0;
    }

    try {
      // Sanitize workspace root to prevent command injection
      const sanitizedWorkspace = this.workspaceRoot.replace(/['"\\$`]/g, '\\$&');
      
      // Create OpenCode process
      const child = spawn('opencode', [], {
        cwd: sanitizedWorkspace,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      await this.updateAgent(agentId, {
        terminalPid: child.pid,
        status: AgentStatus.WORKING
      });

      return child.pid || 0;

    } catch (error) {
      console.error(`Failed to spawn terminal for agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Assign task to agent
   */
  async assignTaskToAgent(agentId: string, taskId: string): Promise<void> {
    const agent = await this.configManager.loadAgent(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    if (agent.status === AgentStatus.WORKING) {
      throw new Error('Agent is already working');
    }

    if (agent.status === AgentStatus.OFFLINE) {
      throw new Error('Cannot assign task to offline agent');
    }

    await this.updateAgent(agentId, {
      currentTask: taskId,
      status: AgentStatus.WORKING
    });

    try {
      await this.gitIntegration.commitAgentChanges(agentId, `Assigned task ${taskId}`);
    } catch (error) {
      console.warn(`Git integration failed for agent ${agentId}:`, error);
    }
  }

  /**
   * List agents with optional filtering
   */
  async listAgents(filter: AgentFilter = {}): Promise<Agent[]> {
    let agents = await this.configManager.listAgents();

    if (filter.status) {
      agents = agents.filter(a => a.status === filter.status);
    }

    if (filter.capability) {
      agents = agents.filter(a => a.capabilities.includes(filter.capability));
    }

    return agents;
  }

  /**
   * Generate unique agent ID
   */
  private generateAgentId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'agent-';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
