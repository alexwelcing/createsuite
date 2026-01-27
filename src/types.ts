/**
 * Task representation using git-backed storage
 * Inspired by Gastown's Beads system
 */
export interface Task {
  id: string; // Format: cs-xxxxx (5 alphanumeric chars)
  title: string;
  description: string;
  status: TaskStatus;
  assignedAgent?: string;
  createdAt: Date;
  updatedAt: Date;
  priority: TaskPriority;
  tags: string[];
}

export enum TaskStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked'
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Agent representation - first-class citizens
 */
export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  currentTask?: string; // Task ID
  terminalPid?: number;
  mailbox: Message[];
  capabilities: string[];
  createdAt: Date;
}

export enum AgentStatus {
  IDLE = 'idle',
  WORKING = 'working',
  OFFLINE = 'offline',
  ERROR = 'error'
}

/**
 * Message for agent communication
 */
export interface Message {
  id: string;
  from: string; // 'system' or agent ID
  to: string; // agent ID
  subject: string;
  body: string;
  timestamp: Date;
  read: boolean;
}

/**
 * Convoy - group of related tasks
 */
export interface Convoy {
  id: string;
  name: string;
  description: string;
  tasks: string[]; // Task IDs
  createdAt: Date;
  status: ConvoyStatus;
}

export enum ConvoyStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  PAUSED = 'paused'
}

/**
 * Workspace configuration
 */
export interface WorkspaceConfig {
  name: string;
  path: string;
  repository?: string;
  agents: Agent[];
  oauthConfig?: OAuthConfig;
}

/**
 * OAuth configuration for coding plan
 */
export interface OAuthConfig {
  clientId?: string;
  tokenPath?: string;
  scopes: string[];
}
