import { v4 as uuidv4 } from 'uuid';
import { Task, TaskStatus, TaskPriority } from './types';
import { ConfigManager } from './config';

/**
 * Manages task lifecycle and git-backed persistence
 */
export class TaskManager {
  private configManager: ConfigManager;

  constructor(workspaceRoot: string) {
    this.configManager = new ConfigManager(workspaceRoot);
  }

  /**
   * Generate a task ID in format: cs-xxxxx
   */
  private generateTaskId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = 'cs-';
    for (let i = 0; i < 5; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  /**
   * Create a new task
   */
  async createTask(
    title: string,
    description: string,
    priority: TaskPriority = TaskPriority.MEDIUM,
    tags: string[] = []
  ): Promise<Task> {
    const task: Task = {
      id: this.generateTaskId(),
      title,
      description,
      status: TaskStatus.OPEN,
      createdAt: new Date(),
      updatedAt: new Date(),
      priority,
      tags
    };

    await this.configManager.saveTask(task);
    return task;
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<Task | null> {
    return await this.configManager.loadTask(taskId);
  }

  /**
   * Update task
   */
  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const updatedTask = {
      ...task,
      ...updates,
      updatedAt: new Date()
    };

    await this.configManager.saveTask(updatedTask);
    return updatedTask;
  }

  /**
   * Assign task to agent
   */
  async assignTask(taskId: string, agentId: string): Promise<Task> {
    return await this.updateTask(taskId, {
      assignedAgent: agentId,
      status: TaskStatus.IN_PROGRESS
    });
  }

  /**
   * Complete a task
   */
  async completeTask(taskId: string): Promise<Task> {
    return await this.updateTask(taskId, {
      status: TaskStatus.COMPLETED
    });
  }

  /**
   * List all tasks with optional filters
   */
  async listTasks(filters?: {
    status?: TaskStatus;
    assignedAgent?: string;
    priority?: TaskPriority;
  }): Promise<Task[]> {
    let tasks = await this.configManager.listTasks();

    if (filters) {
      if (filters.status) {
        tasks = tasks.filter(t => t.status === filters.status);
      }
      if (filters.assignedAgent) {
        tasks = tasks.filter(t => t.assignedAgent === filters.assignedAgent);
      }
      if (filters.priority) {
        tasks = tasks.filter(t => t.priority === filters.priority);
      }
    }

    return tasks;
  }

  /**
   * Get tasks by status
   */
  async getTasksByStatus(status: TaskStatus): Promise<Task[]> {
    return await this.listTasks({ status });
  }

  /**
   * Get open tasks
   */
  async getOpenTasks(): Promise<Task[]> {
    return await this.getTasksByStatus(TaskStatus.OPEN);
  }

  /**
   * Get tasks assigned to an agent
   */
  async getAgentTasks(agentId: string): Promise<Task[]> {
    return await this.listTasks({ assignedAgent: agentId });
  }
}
