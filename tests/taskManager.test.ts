import { TaskManager } from '../src/taskManager';
import { ConfigManager } from '../src/config';
import { GitIntegration } from '../src/gitIntegration';
import { createMockTask, mockFileSystem, mockEnv, expectAsync } from './utils';

// Mock dependencies
jest.mock('../src/config');
jest.mock('../src/gitIntegration');

describe('TaskManager', () => {
  let taskManager: TaskManager;
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockGitIntegration: jest.Mocked<GitIntegration>;

  beforeEach(() => {
    mockConfigManager = new ConfigManager('test-workspace') as jest.Mocked<ConfigManager>;
    mockGitIntegration = new GitIntegration('test-workspace') as jest.Mocked<GitIntegration>;
    
    // Setup mocks
    mockConfigManager.loadTask = jest.fn().mockResolvedValue(null);
    mockConfigManager.saveTask = jest.fn().mockResolvedValue(undefined);
    mockConfigManager.listTasks = jest.fn().mockResolvedValue([]);
    mockGitIntegration.commitTaskChanges = jest.fn().mockResolvedValue(undefined);
    
    taskManager = new TaskManager('test-workspace');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTask', () => {
    it('should create a new task with valid ID format', async () => {
      const task = await taskManager.createTask('Test Task', 'Test Description');
      
      expect(task).toBeDefined();
      expect(task.id).toMatch(/^cs-[a-z0-9]{5}$/);
      expect(task.title).toBe('Test Task');
      expect(task.description).toBe('Test Description');
      expect(task.status).toBe('OPEN');
      expect(task.createdAt).toBeDefined();
      expect(task.updatedAt).toBeDefined();
      expect(mockConfigManager.saveTask).toHaveBeenCalledWith(task);
      expect(mockGitIntegration.commitTaskChanges).toHaveBeenCalledWith(
        task.id,
        `Task created: ${task.title}`
      );
    });

    it('should generate unique task IDs', async () => {
      const task1 = await taskManager.createTask('Task 1', 'Description 1');
      const task2 = await taskManager.createTask('Task 2', 'Description 2');
      
      expect(task1.id).not.toBe(task2.id);
      expect(task1.id).toMatch(/^cs-[a-z0-9]{5}$/);
      expect(task2.id).toMatch(/^cs-[a-z0-9]{5}$/);
    });

    it('should handle title validation', async () => {
      await expectAsync.toThrow(
        () => taskManager.createTask('', 'Description'),
        'Title cannot be empty'
      );
      
      await expectAsync.toThrow(
        () => taskManager.createTask('a'.repeat(201), 'Description'),
        'Title too long'
      );
    });

    it('should handle git integration errors gracefully', async () => {
      mockGitIntegration.commitTaskChanges.mockRejectedValue(new Error('Git error'));
      
      const task = await taskManager.createTask('Test Task', 'Description');
      
      // Task should still be created even if git commit fails
      expect(task).toBeDefined();
      expect(mockConfigManager.saveTask).toHaveBeenCalled();
    });
  });

  describe('updateTask', () => {
    const mockTask = createMockTask();

    beforeEach(() => {
      mockConfigManager.loadTask.mockResolvedValue(mockTask);
    });

    it('should update task status with valid transitions', async () => {
      const updatedTask = await taskManager.updateTask(mockTask.id, { status: 'IN_PROGRESS' });
      
      expect(updatedTask.status).toBe('IN_PROGRESS');
      expect(updatedTask.updatedAt).not.toBe(mockTask.updatedAt);
      expect(mockConfigManager.saveTask).toHaveBeenCalledWith(updatedTask);
      expect(mockGitIntegration.commitTaskChanges).toHaveBeenCalled();
    });

    it('should validate status transitions', async () => {
      const completedTask = createMockTask({ status: 'COMPLETED' });
      mockConfigManager.loadTask.mockResolvedValue(completedTask);
      
      await expectAsync.toThrow(
        () => taskManager.updateTask(completedTask.id, { status: 'OPEN' }),
        'Cannot change completed task back to open'
      );
    });

    it('should handle non-existent tasks', async () => {
      mockConfigManager.loadTask.mockResolvedValue(null);
      
      await expectAsync.toThrow(
        () => taskManager.updateTask('cs-nonex', { status: 'IN_PROGRESS' }),
        'Task not found'
      );
    });

    it('should update multiple fields at once', async () => {
      const updates = {
        status: 'IN_PROGRESS' as const,
        assignedAgent: 'agent-1'
      };
      
      const updatedTask = await taskManager.updateTask(mockTask.id, updates);
      
      expect(updatedTask.status).toBe('IN_PROGRESS');
      expect(updatedTask.assignedAgent).toBe('agent-1');
    });
  });

  describe('assignTask', () => {
    const mockTask = createMockTask();

    beforeEach(() => {
      mockConfigManager.loadTask.mockResolvedValue(mockTask);
    });

    it('should assign task to agent', async () => {
      const assignedTask = await taskManager.assignTask(mockTask.id, 'agent-1');
      
      expect(assignedTask.assignedAgent).toBe('agent-1');
      expect(assignedTask.status).toBe('IN_PROGRESS');
      expect(mockConfigManager.saveTask).toHaveBeenCalledWith(assignedTask);
    });

    it('should not assign already assigned task to different agent', async () => {
      const assignedTask = createMockTask({ assignedAgent: 'agent-1' });
      mockConfigManager.loadTask.mockResolvedValue(assignedTask);
      
      await expectAsync.toThrow(
        () => taskManager.assignTask(assignedTask.id, 'agent-2'),
        'Task is already assigned to agent-1'
      );
    });

    it('should allow reassigning to same agent', async () => {
      const assignedTask = createMockTask({ assignedAgent: 'agent-1' });
      mockConfigManager.loadTask.mockResolvedValue(assignedTask);
      
      const result = await taskManager.assignTask(assignedTask.id, 'agent-1');
      expect(result.assignedAgent).toBe('agent-1');
    });
  });

  describe('listTasks', () => {
    const mockTasks = [
      createMockTask({ id: 'cs-task1', status: 'OPEN' }),
      createMockTask({ id: 'cs-task2', status: 'IN_PROGRESS' }),
      createMockTask({ id: 'cs-task3', status: 'COMPLETED' })
    ];

    beforeEach(() => {
      mockConfigManager.listTasks.mockResolvedValue(mockTasks);
    });

    it('should return all tasks when no filter provided', async () => {
      const tasks = await taskManager.listTasks();
      
      expect(tasks).toHaveLength(3);
      expect(mockConfigManager.listTasks).toHaveBeenCalled();
    });

    it('should filter tasks by status', async () => {
      const tasks = await taskManager.listTasks({ status: 'OPEN' });
      
      expect(tasks).toHaveLength(1);
      expect(tasks[0].status).toBe('OPEN');
    });

    it('should filter tasks by assigned agent', async () => {
      mockTasks[0].assignedAgent = 'agent-1';
      mockTasks[1].assignedAgent = 'agent-1';
      
      const tasks = await taskManager.listTasks({ assignedAgent: 'agent-1' });
      
      expect(tasks).toHaveLength(2);
      expect(tasks.every(t => t.assignedAgent === 'agent-1')).toBe(true);
    });

    it('should sort tasks by creation date', async () => {
      // Modify dates to ensure proper sorting
      mockTasks[0].createdAt = '2024-01-01T00:00:00.000Z';
      mockTasks[1].createdAt = '2024-01-03T00:00:00.000Z';
      mockTasks[2].createdAt = '2024-01-02T00:00:00.000Z';
      
      const tasks = await taskManager.listTasks();
      
      expect(new Date(tasks[0].createdAt).getTime())
        .toBeLessThan(new Date(tasks[1].createdAt).getTime());
    });
  });

  describe('generateTaskId', () => {
    it('should generate valid task ID format', () => {
      // Access private method through type assertion
      const taskId = (taskManager as any).generateTaskId();
      
      expect(taskId).toMatch(/^cs-[a-z0-9]{5}$/);
    });

    it('should generate unique IDs on multiple calls', () => {
      const id1 = (taskManager as any).generateTaskId();
      const id2 = (taskManager as any).generateTaskId();
      const id3 = (taskManager as any).generateTaskId();
      
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle concurrent task creation', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => 
        taskManager.createTask(`Task ${i}`, `Description ${i}`)
      );
      
      const tasks = await Promise.all(promises);
      const ids = tasks.map(t => t.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).toBe(10); // All IDs should be unique
    });

    it('should handle config manager errors', async () => {
      mockConfigManager.saveTask.mockRejectedValue(new Error('Save failed'));
      
      await expectAsync.toThrow(
        () => taskManager.createTask('Test', 'Description'),
        'Save failed'
      );
    });

    it('should validate task update inputs', async () => {
      const mockTask = createMockTask();
      mockConfigManager.loadTask.mockResolvedValue(mockTask);
      
      await expectAsync.toThrow(
        () => taskManager.updateTask(mockTask.id, { status: 'INVALID' as any }),
        'Invalid status'
      );
    });
  });
});