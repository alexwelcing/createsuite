import { ConfigManager } from '../src/config';
import { createMockTask, createMockAgent, mockFileSystem, createTempTestDir, cleanupTestDir } from './utils';
import fs from 'fs';
import path from 'path';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let testDir: string;

  beforeEach(() => {
    testDir = createTempTestDir();
    configManager = new ConfigManager(testDir);
    mockFileSystem.clear();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create config directory structure', () => {
      configManager.initialize();
      
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        path.join(testDir, '.createsuite'),
        { recursive: true }
      );
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        path.join(testDir, '.createsuite', 'tasks'),
        { recursive: true }
      );
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        path.join(testDir, '.createsuite', 'agents'),
        { recursive: true }
      );
    });

    it('should not fail if directories already exist', () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.mkdirSync.mockImplementation(() => {
        throw { code: 'EEXIST' };
      });

      expect(() => configManager.initialize()).not.toThrow();
    });

    it('should throw for other filesystem errors', () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.mkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => configManager.initialize()).toThrow('Permission denied');
    });
  });

  describe('task operations', () => {
    const mockTask = createMockTask();

    describe('saveTask', () => {
      it('should save task to correct file path', async () => {
        await configManager.saveTask(mockTask);
        
        const expectedPath = path.join(testDir, '.createsuite', 'tasks', `${mockTask.id}.json`);
        expect(fs.writeFileSync).toHaveBeenCalledWith(
          expectedPath,
          JSON.stringify(mockTask, null, 2)
        );
      });

      it('should create tasks directory if it does not exist', async () => {
        const mockedFs = fs as jest.Mocked<typeof fs>;
        mockedFs.existsSync.mockReturnValue(false);
        mockedFs.mkdirSync.mockImplementation();

        await configManager.saveTask(mockTask);

        expect(fs.mkdirSync).toHaveBeenCalledWith(
          path.join(testDir, '.createsuite', 'tasks'),
          { recursive: true }
        );
      });

      it('should handle file write errors', async () => {
        const mockedFs = fs as jest.Mocked<typeof fs>;
        mockedFs.writeFileSync.mockImplementation(() => {
          throw new Error('Write failed');
        });

        await expect(configManager.saveTask(mockTask)).rejects.toThrow('Write failed');
      });

      it('should validate task object before saving', async () => {
        const invalidTask = { ...mockTask, id: undefined };
        
        await expect(configManager.saveTask(invalidTask as any))
          .rejects.toThrow('Invalid task: missing id');
      });
    });

    describe('loadTask', () => {
      beforeEach(() => {
        const mockedFs = fs as jest.Mocked<typeof fs>;
        mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockTask));
        mockedFs.existsSync.mockReturnValue(true);
      });

      it('should load task from correct file path', async () => {
        const task = await configManager.loadTask(mockTask.id);
        
        const expectedPath = path.join(testDir, '.createsuite', 'tasks', `${mockTask.id}.json`);
        expect(fs.readFileSync).toHaveBeenCalledWith(expectedPath, 'utf-8');
        expect(task).toEqual(mockTask);
      });

      it('should return null for non-existent task', async () => {
        const mockedFs = fs as jest.Mocked<typeof fs>;
        mockedFs.existsSync.mockReturnValue(false);
        
        const task = await configManager.loadTask('non-existent');
        expect(task).toBeNull();
      });

      it('should handle corrupted JSON files', async () => {
        const mockedFs = fs as jest.Mocked<typeof fs>;
        mockedFs.readFileSync.mockReturnValue('invalid json');
        
        await expect(configManager.loadTask(mockTask.id))
          .rejects.toThrow(/Unexpected token/);
      });

      it('should validate loaded task structure', async () => {
        const invalidTaskJson = JSON.stringify({ id: 'test', title: null });
        const mockedFs = fs as jest.Mocked<typeof fs>;
        mockedFs.readFileSync.mockReturnValue(invalidTaskJson);
        
        await expect(configManager.loadTask('test'))
          .rejects.toThrow('Invalid task structure');
      });
    });

    describe('listTasks', () => {
      const mockTasks = [
        createMockTask({ id: 'cs-task1' }),
        createMockTask({ id: 'cs-task2' }),
        createMockTask({ id: 'cs-task3' })
      ];

      beforeEach(() => {
        const mockedFs = fs as jest.Mocked<typeof fs>;
        mockedFs.readdirSync.mockReturnValue(['cs-task1.json', 'cs-task2.json', 'cs-task3.json'] as any);
        mockedFs.existsSync.mockReturnValue(true);
        
        // Mock readFileSync to return different tasks based on filename
        mockedFs.readFileSync.mockImplementation((filePath: any) => {
          const filename = path.basename(filePath);
          const taskIndex = parseInt(filename.match(/task(\d+)/)?.[1] || '1') - 1;
          return JSON.stringify(mockTasks[taskIndex]);
        });
      });

      it('should list all tasks from tasks directory', async () => {
        const tasks = await configManager.listTasks();
        
        expect(tasks).toHaveLength(3);
        expect(tasks.map(t => t.id)).toEqual(['cs-task1', 'cs-task2', 'cs-task3']);
      });

      it('should handle empty tasks directory', async () => {
        const mockedFs = fs as jest.Mocked<typeof fs>;
        mockedFs.readdirSync.mockReturnValue([] as any);
        
        const tasks = await configManager.listTasks();
        expect(tasks).toEqual([]);
      });

      it('should ignore non-JSON files', async () => {
        const mockedFs = fs as jest.Mocked<typeof fs>;
        mockedFs.readdirSync.mockReturnValue(['cs-task1.json', 'README.md', 'cs-task2.json'] as any);
        
        const tasks = await configManager.listTasks();
        expect(tasks).toHaveLength(2);
      });

      it('should handle directory read errors', async () => {
        const mockedFs = fs as jest.Mocked<typeof fs>;
        mockedFs.readdirSync.mockImplementation(() => {
          throw new Error('Permission denied');
        });
        
        await expect(configManager.listTasks()).rejects.toThrow('Permission denied');
      });

      it('should skip corrupted task files and continue', async () => {
        const mockedFs = fs as jest.Mocked<typeof fs>;
        mockedFs.readdirSync.mockReturnValue(['cs-task1.json', 'cs-corrupt.json', 'cs-task2.json'] as any);
        
        // Mock readFileSync to return corrupted JSON for second file
        mockedFs.readFileSync.mockImplementation((filePath: any) => {
          const filename = path.basename(filePath);
          if (filename === 'cs-corrupt.json') {
            return 'invalid json';
          }
          const taskIndex = filename.includes('task1') ? 0 : 1;
          return JSON.stringify(mockTasks[taskIndex]);
        });
        
        const tasks = await configManager.listTasks();
        expect(tasks).toHaveLength(2); // Should skip corrupted file
      });
    });
  });

  describe('agent operations', () => {
    const mockAgent = createMockAgent();

    describe('saveAgent', () => {
      it('should save agent to correct file path', async () => {
        await configManager.saveAgent(mockAgent);
        
        const expectedPath = path.join(testDir, '.createsuite', 'agents', `${mockAgent.id}.json`);
        expect(fs.writeFileSync).toHaveBeenCalledWith(
          expectedPath,
          JSON.stringify(mockAgent, null, 2)
        );
      });

      it('should validate agent object before saving', async () => {
        const invalidAgent = { ...mockAgent, id: undefined };
        
        await expect(configManager.saveAgent(invalidAgent as any))
          .rejects.toThrow('Invalid agent: missing id');
      });
    });

    describe('loadAgent', () => {
      beforeEach(() => {
        const mockedFs = fs as jest.Mocked<typeof fs>;
        mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockAgent));
        mockedFs.existsSync.mockReturnValue(true);
      });

      it('should load agent from correct file path', async () => {
        const agent = await configManager.loadAgent(mockAgent.id);
        
        const expectedPath = path.join(testDir, '.createsuite', 'agents', `${mockAgent.id}.json`);
        expect(fs.readFileSync).toHaveBeenCalledWith(expectedPath, 'utf-8');
        expect(agent).toEqual(mockAgent);
      });

      it('should return null for non-existent agent', async () => {
        const mockedFs = fs as jest.Mocked<typeof fs>;
        mockedFs.existsSync.mockReturnValue(false);
        
        const agent = await configManager.loadAgent('non-existent');
        expect(agent).toBeNull();
      });
    });

    describe('listAgents', () => {
      const mockAgents = [
        createMockAgent({ id: 'agent-1' }),
        createMockAgent({ id: 'agent-2' })
      ];

      beforeEach(() => {
        const mockedFs = fs as jest.Mocked<typeof fs>;
        mockedFs.readdirSync.mockReturnValue(['agent-1.json', 'agent-2.json'] as any);
        mockedFs.existsSync.mockReturnValue(true);
        
        mockedFs.readFileSync.mockImplementation((filePath: any) => {
          const filename = path.basename(filePath);
          const agentIndex = filename.includes('agent-1') ? 0 : 1;
          return JSON.stringify(mockAgents[agentIndex]);
        });
      });

      it('should list all agents from agents directory', async () => {
        const agents = await configManager.listAgents();
        
        expect(agents).toHaveLength(2);
        expect(agents.map(a => a.id)).toEqual(['agent-1', 'agent-2']);
      });
    });
  });

  describe('workspace operations', () => {
    describe('getWorkspaceInfo', () => {
      beforeEach(() => {
        const mockedFs = fs as jest.Mocked<typeof fs>;
        mockedFs.existsSync.mockImplementation((path: any) => {
          return path.includes('.createsuite');
        });
        mockedFs.readdirSync.mockImplementation((dirPath: any) => {
          if (dirPath.includes('tasks')) {
            return ['cs-task1.json', 'cs-task2.json'];
          }
          if (dirPath.includes('agents')) {
            return ['agent-1.json'];
          }
          return [];
        });
      });

      it('should return workspace status information', () => {
        const info = configManager.getWorkspaceInfo();
        
        expect(info.initialized).toBe(true);
        expect(info.tasksCount).toBe(2);
        expect(info.agentsCount).toBe(1);
        expect(info.path).toBe(testDir);
      });

      it('should return false for uninitialized workspace', () => {
        const mockedFs = fs as jest.Mocked<typeof fs>;
        mockedFs.existsSync.mockReturnValue(false);
        
        const info = configManager.getWorkspaceInfo();
        
        expect(info.initialized).toBe(false);
        expect(info.tasksCount).toBe(0);
        expect(info.agentsCount).toBe(0);
      });
    });
  });

  describe('file path operations', () => {
    it('should generate correct task file paths', () => {
      const taskPath = (configManager as any).getTaskPath('cs-test1');
      const expectedPath = path.join(testDir, '.createsuite', 'tasks', 'cs-test1.json');
      
      expect(taskPath).toBe(expectedPath);
    });

    it('should generate correct agent file paths', () => {
      const agentPath = (configManager as any).getAgentPath('agent-1');
      const expectedPath = path.join(testDir, '.createsuite', 'agents', 'agent-1.json');
      
      expect(agentPath).toBe(expectedPath);
    });

    it('should sanitize file paths to prevent directory traversal', () => {
      const maliciousId = '../../../etc/passwd';
      const taskPath = (configManager as any).getTaskPath(maliciousId);
      
      expect(taskPath).not.toContain('../');
      expect(taskPath).toContain('.createsuite/tasks');
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent task saves without corruption', async () => {
      const tasks = Array.from({ length: 10 }, (_, i) => 
        createMockTask({ id: `cs-task${i}` })
      );
      
      const savePromises = tasks.map(task => configManager.saveTask(task));
      await Promise.all(savePromises);
      
      // All tasks should have been saved
      expect(fs.writeFileSync).toHaveBeenCalledTimes(10);
    });

    it('should handle concurrent reads without issues', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(createMockTask()));
      mockedFs.existsSync.mockReturnValue(true);
      
      const loadPromises = Array.from({ length: 5 }, () => 
        configManager.loadTask('cs-test1')
      );
      
      const results = await Promise.all(loadPromises);
      expect(results).toHaveLength(5);
      expect(results.every(task => task?.id === 'cs-test1')).toBe(true);
    });
  });
});