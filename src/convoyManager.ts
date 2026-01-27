import { v4 as uuidv4 } from 'uuid';
import { Convoy, ConvoyStatus, TaskStatus } from './types';
import { ConfigManager } from './config';
import { TaskManager } from './taskManager';

/**
 * Manages convoys - groups of related tasks
 */
export class ConvoyManager {
  private configManager: ConfigManager;
  private taskManager: TaskManager;

  constructor(workspaceRoot: string) {
    this.configManager = new ConfigManager(workspaceRoot);
    this.taskManager = new TaskManager(workspaceRoot);
  }

  /**
   * Generate a convoy ID in format: cs-cv-xxxxx
   */
  private generateConvoyId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = 'cs-cv-';
    for (let i = 0; i < 5; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  /**
   * Create a new convoy
   */
  async createConvoy(
    name: string,
    description: string,
    taskIds: string[] = []
  ): Promise<Convoy> {
    // Validate that all tasks exist
    for (const taskId of taskIds) {
      const task = await this.taskManager.getTask(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }
    }

    const convoy: Convoy = {
      id: this.generateConvoyId(),
      name,
      description,
      tasks: taskIds,
      createdAt: new Date(),
      status: ConvoyStatus.ACTIVE
    };

    await this.configManager.saveConvoy(convoy);
    return convoy;
  }

  /**
   * Get convoy by ID
   */
  async getConvoy(convoyId: string): Promise<Convoy | null> {
    return await this.configManager.loadConvoy(convoyId);
  }

  /**
   * Add tasks to convoy
   */
  async addTasksToConvoy(convoyId: string, taskIds: string[]): Promise<Convoy> {
    const convoy = await this.getConvoy(convoyId);
    if (!convoy) {
      throw new Error(`Convoy not found: ${convoyId}`);
    }

    // Validate tasks exist
    for (const taskId of taskIds) {
      const task = await this.taskManager.getTask(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }
      
      // Don't add duplicates
      if (!convoy.tasks.includes(taskId)) {
        convoy.tasks.push(taskId);
      }
    }

    await this.configManager.saveConvoy(convoy);
    return convoy;
  }

  /**
   * Remove task from convoy
   */
  async removeTaskFromConvoy(convoyId: string, taskId: string): Promise<Convoy> {
    const convoy = await this.getConvoy(convoyId);
    if (!convoy) {
      throw new Error(`Convoy not found: ${convoyId}`);
    }

    convoy.tasks = convoy.tasks.filter(id => id !== taskId);
    await this.configManager.saveConvoy(convoy);
    return convoy;
  }

  /**
   * Update convoy status
   */
  async updateConvoyStatus(convoyId: string, status: ConvoyStatus): Promise<Convoy> {
    const convoy = await this.getConvoy(convoyId);
    if (!convoy) {
      throw new Error(`Convoy not found: ${convoyId}`);
    }

    convoy.status = status;
    await this.configManager.saveConvoy(convoy);
    return convoy;
  }

  /**
   * List all convoys
   */
  async listConvoys(status?: ConvoyStatus): Promise<Convoy[]> {
    let convoys = await this.configManager.listConvoys();
    
    if (status) {
      convoys = convoys.filter(c => c.status === status);
    }

    return convoys;
  }

  /**
   * Get convoy progress
   */
  async getConvoyProgress(convoyId: string): Promise<{
    total: number;
    completed: number;
    inProgress: number;
    open: number;
    percentage: number;
  }> {
    const convoy = await this.getConvoy(convoyId);
    if (!convoy) {
      throw new Error(`Convoy not found: ${convoyId}`);
    }

    const tasks = await Promise.all(
      convoy.tasks.map(id => this.taskManager.getTask(id))
    );

    const validTasks = tasks.filter(t => t !== null);
    const completed = validTasks.filter(t => t!.status === TaskStatus.COMPLETED).length;
    const inProgress = validTasks.filter(t => t!.status === TaskStatus.IN_PROGRESS).length;
    const open = validTasks.filter(t => t!.status === TaskStatus.OPEN).length;
    const total = validTasks.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      inProgress,
      open,
      percentage
    };
  }
}
