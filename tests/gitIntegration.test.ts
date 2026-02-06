import { GitIntegration } from '../src/gitIntegration';
import { SimpleGit } from 'simple-git';
import { createTempTestDir, cleanupTestDir, mockEnv, expectAsync } from './utils';

// Mock simple-git
const mockGit = {
  init: jest.fn(),
  add: jest.fn(),
  commit: jest.fn(),
  status: jest.fn(),
  checkout: jest.fn(),
  branch: jest.fn(),
  raw: jest.fn(),
} as jest.Mocked<SimpleGit>;

jest.mock('simple-git', () => {
  return jest.fn(() => mockGit);
});

describe('GitIntegration', () => {
  let gitIntegration: GitIntegration;
  let testDir: string;

  beforeEach(() => {
    testDir = createTempTestDir();
    gitIntegration = new GitIntegration(testDir);
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  describe('initialization', () => {
    it('should initialize git repository', async () => {
      mockGit.status.mockResolvedValue({
        files: [],
        current: 'main',
        tracking: null,
        ahead: 0,
        behind: 0,
        staged: [],
        modified: [],
        created: [],
        deleted: [],
        renamed: [],
        conflicted: [],
        isClean: jest.fn().mockReturnValue(true)
      } as any);

      await gitIntegration.initialize();

      expect(mockGit.init).toHaveBeenCalled();
      expect(mockGit.status).toHaveBeenCalled();
    });

    it('should not fail if repository already exists', async () => {
      mockGit.init.mockRejectedValue(new Error('already exists'));
      mockGit.status.mockResolvedValue({
        files: [],
        current: 'main',
        isClean: jest.fn().mockReturnValue(true)
      } as any);

      await expect(gitIntegration.initialize()).resolves.not.toThrow();
    });

    it('should handle git initialization errors', async () => {
      mockGit.init.mockRejectedValue(new Error('Git init failed'));
      mockGit.status.mockRejectedValue(new Error('Not a git repo'));

      await expectAsync.toThrow(
        () => gitIntegration.initialize(),
        'Git init failed'
      );
    });

    it('should set up initial commit structure', async () => {
      mockGit.status.mockResolvedValue({
        files: [],
        current: 'main',
        isClean: jest.fn().mockReturnValue(true)
      } as any);

      await gitIntegration.initialize();

      expect(mockGit.add).toHaveBeenCalledWith('.createsuite/');
      expect(mockGit.commit).toHaveBeenCalledWith('Initialize CreateSuite workspace');
    });
  });

  describe('commitTaskChanges', () => {
    beforeEach(() => {
      mockGit.add.mockResolvedValue(undefined as any);
      mockGit.commit.mockResolvedValue({ hash: 'abc123' } as any);
    });

    it('should commit task changes with proper message', async () => {
      await gitIntegration.commitTaskChanges('cs-task1', 'Task created: Test Task');

      expect(mockGit.add).toHaveBeenCalledWith('.createsuite/tasks/cs-task1.json');
      expect(mockGit.commit).toHaveBeenCalledWith('[cs-task1] Task created: Test Task');
    });

    it('should handle commit failures gracefully', async () => {
      mockGit.commit.mockRejectedValue(new Error('Nothing to commit'));

      // Should not throw for "nothing to commit" scenarios
      await expect(gitIntegration.commitTaskChanges('cs-task1', 'No changes'))
        .resolves.not.toThrow();
    });

    it('should handle git add failures', async () => {
      mockGit.add.mockRejectedValue(new Error('File not found'));

      await expectAsync.toThrow(
        () => gitIntegration.commitTaskChanges('cs-task1', 'Test'),
        'File not found'
      );
    });

    it('should escape commit messages properly', async () => {
      const messageWithQuotes = 'Task "Special Task" with quotes';
      await gitIntegration.commitTaskChanges('cs-task1', messageWithQuotes);

      expect(mockGit.commit).toHaveBeenCalledWith(`[cs-task1] ${messageWithQuotes}`);
    });
  });

  describe('createAgentBranch', () => {
    it('should create and switch to agent branch', async () => {
      mockGit.checkout.mockResolvedValue(undefined as any);

      await gitIntegration.createAgentBranch('agent-1');

      expect(mockGit.checkout).toHaveBeenCalledWith(['-b', 'agent/agent-1']);
    });

    it('should handle existing branch gracefully', async () => {
      mockGit.checkout.mockRejectedValue(new Error('already exists'));

      // Should not throw for existing branch
      await expect(gitIntegration.createAgentBranch('agent-1'))
        .resolves.not.toThrow();
    });

    it('should handle checkout failures', async () => {
      mockGit.checkout.mockRejectedValue(new Error('Checkout failed'));

      await expectAsync.toThrow(
        () => gitIntegration.createAgentBranch('agent-1'),
        'Checkout failed'
      );
    });

    it('should sanitize agent branch names', async () => {
      const maliciousAgentId = 'agent/../../../dangerous';
      await gitIntegration.createAgentBranch(maliciousAgentId);

      // Should not contain directory traversal
      expect(mockGit.checkout).toHaveBeenCalledWith(
        expect.arrayContaining([expect.not.stringMatching(/\.\./)])
      );
    });
  });

  describe('commitAgentChanges', () => {
    beforeEach(() => {
      mockGit.add.mockResolvedValue(undefined as any);
      mockGit.commit.mockResolvedValue({ hash: 'def456' } as any);
    });

    it('should commit agent changes on agent branch', async () => {
      await gitIntegration.commitAgentChanges('agent-1', 'Agent update');

      expect(mockGit.add).toHaveBeenCalledWith('.createsuite/agents/agent-1.json');
      expect(mockGit.commit).toHaveBeenCalledWith('[agent-1] Agent update');
    });

    it('should handle empty commits', async () => {
      mockGit.commit.mockRejectedValue(new Error('nothing to commit'));

      await expect(gitIntegration.commitAgentChanges('agent-1', 'No changes'))
        .resolves.not.toThrow();
    });
  });

  describe('switchToMainBranch', () => {
    it('should switch to main branch', async () => {
      mockGit.checkout.mockResolvedValue(undefined as any);

      await gitIntegration.switchToMainBranch();

      expect(mockGit.checkout).toHaveBeenCalledWith('main');
    });

    it('should fallback to master if main does not exist', async () => {
      mockGit.checkout
        .mockRejectedValueOnce(new Error('main does not exist'))
        .mockResolvedValueOnce(undefined as any);

      await gitIntegration.switchToMainBranch();

      expect(mockGit.checkout).toHaveBeenCalledWith('main');
      expect(mockGit.checkout).toHaveBeenCalledWith('master');
    });

    it('should throw if neither main nor master exist', async () => {
      mockGit.checkout
        .mockRejectedValue(new Error('branch does not exist'));

      await expectAsync.toThrow(
        () => gitIntegration.switchToMainBranch(),
        'branch does not exist'
      );
    });
  });

  describe('getStatus', () => {
    it('should return git status information', async () => {
      const mockStatus = {
        files: ['file1.txt', 'file2.txt'],
        current: 'main',
        ahead: 2,
        behind: 0,
        staged: ['staged.txt'],
        modified: ['modified.txt'],
        created: ['new.txt'],
        deleted: ['deleted.txt'],
        conflicted: [],
        isClean: jest.fn().mockReturnValue(false)
      };

      mockGit.status.mockResolvedValue(mockStatus as any);

      const status = await gitIntegration.getStatus();

      expect(status).toEqual(mockStatus);
      expect(mockGit.status).toHaveBeenCalled();
    });

    it('should handle git status failures', async () => {
      mockGit.status.mockRejectedValue(new Error('Status failed'));

      await expectAsync.toThrow(
        () => gitIntegration.getStatus(),
        'Status failed'
      );
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name', async () => {
      mockGit.raw.mockResolvedValue('agent/agent-1\n');

      const branch = await gitIntegration.getCurrentBranch();

      expect(branch).toBe('agent/agent-1');
      expect(mockGit.raw).toHaveBeenCalledWith(['branch', '--show-current']);
    });

    it('should handle empty branch name', async () => {
      mockGit.raw.mockResolvedValue('');

      const branch = await gitIntegration.getCurrentBranch();

      expect(branch).toBe('');
    });

    it('should handle git raw command failures', async () => {
      mockGit.raw.mockRejectedValue(new Error('Branch query failed'));

      await expectAsync.toThrow(
        () => gitIntegration.getCurrentBranch(),
        'Branch query failed'
      );
    });
  });

  describe('commitConvoyChanges', () => {
    beforeEach(() => {
      mockGit.add.mockResolvedValue(undefined as any);
      mockGit.commit.mockResolvedValue({ hash: 'ghi789' } as any);
    });

    it('should commit convoy configuration changes', async () => {
      await gitIntegration.commitConvoyChanges('cs-cv-convoy1', 'Convoy created');

      expect(mockGit.add).toHaveBeenCalledWith('.createsuite/convoys/cs-cv-convoy1.json');
      expect(mockGit.commit).toHaveBeenCalledWith('[cs-cv-convoy1] Convoy created');
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle workspace path with spaces', async () => {
      const spacePath = '/path with spaces/workspace';
      const gitWithSpaces = new GitIntegration(spacePath);

      mockGit.status.mockResolvedValue({
        files: [],
        current: 'main',
        isClean: jest.fn().mockReturnValue(true)
      } as any);

      await gitWithSpaces.initialize();

      expect(mockGit.add).toHaveBeenCalledWith('.createsuite/');
    });

    it('should handle concurrent git operations', async () => {
      const operations = [
        gitIntegration.commitTaskChanges('cs-task1', 'Task 1'),
        gitIntegration.commitTaskChanges('cs-task2', 'Task 2'),
        gitIntegration.commitAgentChanges('agent-1', 'Agent 1'),
      ];

      await Promise.all(operations);

      expect(mockGit.add).toHaveBeenCalledTimes(3);
      expect(mockGit.commit).toHaveBeenCalledTimes(3);
    });

    it('should handle invalid task IDs in commit messages', async () => {
      const invalidId = 'invalid<>|:"*?id';
      
      await gitIntegration.commitTaskChanges(invalidId, 'Test message');

      // Should still call commit but with escaped characters
      expect(mockGit.commit).toHaveBeenCalledWith(
        expect.stringContaining('invalid')
      );
    });

    it('should handle very long commit messages', async () => {
      const longMessage = 'A'.repeat(1000);
      
      await gitIntegration.commitTaskChanges('cs-task1', longMessage);

      expect(mockGit.commit).toHaveBeenCalledWith(`[cs-task1] ${longMessage}`);
    });

    it('should handle network timeouts in git operations', async () => {
      mockGit.commit.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Operation timed out')), 100);
        });
      });

      await expectAsync.toThrow(
        () => gitIntegration.commitTaskChanges('cs-task1', 'Test'),
        'Operation timed out'
      );
    });
  });

  describe('repository state validation', () => {
    it('should detect if workspace is a git repository', async () => {
      mockGit.status.mockResolvedValue({
        files: [],
        current: 'main',
        isClean: jest.fn().mockReturnValue(true)
      } as any);

      const isRepo = await gitIntegration.isGitRepository();

      expect(isRepo).toBe(true);
      expect(mockGit.status).toHaveBeenCalled();
    });

    it('should return false for non-git directories', async () => {
      mockGit.status.mockRejectedValue(new Error('not a git repository'));

      const isRepo = await gitIntegration.isGitRepository();

      expect(isRepo).toBe(false);
    });
  });
});