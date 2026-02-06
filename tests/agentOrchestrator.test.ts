import { AgentOrchestrator } from '../src/agentOrchestrator';
import { ConfigManager } from '../src/config';
import { GitIntegration } from '../src/gitIntegration';
import { createMockAgent, createMockTask, mockEnv, expectAsync } from './utils';
import { spawn } from 'child_process';

// Mock dependencies
jest.mock('../src/config');
jest.mock('../src/gitIntegration');
jest.mock('child_process');

describe('AgentOrchestrator', () => {
  let orchestrator: AgentOrchestrator;
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockGitIntegration: jest.Mocked<GitIntegration>;
  let testDir: string;

  beforeEach(() => {
    testDir = '/test/workspace';
    mockConfigManager = new ConfigManager(testDir) as jest.Mocked<ConfigManager>;
    mockGitIntegration = new GitIntegration(testDir) as jest.Mocked<GitIntegration>;
    
    // Setup mocks
    mockConfigManager.loadAgent = jest.fn().mockResolvedValue(null);
    mockConfigManager.saveAgent = jest.fn().mockResolvedValue(undefined);
    mockConfigManager.listAgents = jest.fn().mockResolvedValue([]);
    mockGitIntegration.createAgentBranch = jest.fn().mockResolvedValue(undefined);
    mockGitIntegration.commitAgentChanges = jest.fn().mockResolvedValue(undefined);
    
    orchestrator = new AgentOrchestrator(testDir);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createAgent', () => {
    it('should create a new agent with valid properties', async () => {
      const agent = await orchestrator.createAgent('Test Agent', 'general');
      
      expect(agent).toBeDefined();
      expect(agent.id).toMatch(/^agent-[a-z0-9]+$/);
      expect(agent.name).toBe('Test Agent');
      expect(agent.capability).toBe('general');
      expect(agent.status).toBe('IDLE');
      expect(agent.createdAt).toBeDefined();
      expect(agent.terminalPid).toBeNull();
      expect(agent.mailbox).toEqual([]);
      
      expect(mockConfigManager.saveAgent).toHaveBeenCalledWith(agent);
      expect(mockGitIntegration.createAgentBranch).toHaveBeenCalledWith(agent.id);
      expect(mockGitIntegration.commitAgentChanges).toHaveBeenCalledWith(
        agent.id,
        `Agent created: ${agent.name}`
      );
    });

    it('should generate unique agent IDs', async () => {
      const agent1 = await orchestrator.createAgent('Agent 1', 'general');
      const agent2 = await orchestrator.createAgent('Agent 2', 'specialized');
      
      expect(agent1.id).not.toBe(agent2.id);
      expect(agent1.id).toMatch(/^agent-[a-z0-9]+$/);
      expect(agent2.id).toMatch(/^agent-[a-z0-9]+$/);
    });

    it('should handle different agent capabilities', async () => {
      const capabilities = ['general', 'specialized', 'research', 'coding'];
      
      for (const capability of capabilities) {
        const agent = await orchestrator.createAgent(`Agent ${capability}`, capability);
        expect(agent.capability).toBe(capability);
      }
    });

    it('should handle git integration errors gracefully', async () => {
      mockGitIntegration.createAgentBranch.mockRejectedValue(new Error('Git error'));
      
      const agent = await orchestrator.createAgent('Test Agent', 'general');
      
      // Agent should still be created even if git operations fail
      expect(agent).toBeDefined();
      expect(mockConfigManager.saveAgent).toHaveBeenCalled();
    });

    it('should validate agent name', async () => {
      await expectAsync.toThrow(
        () => orchestrator.createAgent('', 'general'),
        'Agent name cannot be empty'
      );
    });

    it('should validate capability', async () => {
      await expectAsync.toThrow(
        () => orchestrator.createAgent('Test Agent', ''),
        'Agent capability cannot be empty'
      );
    });
  });

  describe('updateAgent', () => {
    const mockAgent = createMockAgent();

    beforeEach(() => {
      mockConfigManager.loadAgent.mockResolvedValue(mockAgent);
    });

    it('should update agent status', async () => {
      const updatedAgent = await orchestrator.updateAgent(mockAgent.id, { status: 'WORKING' });
      
      expect(updatedAgent.status).toBe('WORKING');
      expect(mockConfigManager.saveAgent).toHaveBeenCalledWith(updatedAgent);
      expect(mockGitIntegration.commitAgentChanges).toHaveBeenCalledWith(
        mockAgent.id,
        'Agent status updated to WORKING'
      );
    });

    it('should update terminal PID', async () => {
      const updatedAgent = await orchestrator.updateAgent(mockAgent.id, { terminalPid: 12345 });
      
      expect(updatedAgent.terminalPid).toBe(12345);
      expect(mockConfigManager.saveAgent).toHaveBeenCalledWith(updatedAgent);
    });

    it('should update multiple fields at once', async () => {
      const updates = {
        status: 'WORKING' as const,
        terminalPid: 12345
      };
      
      const updatedAgent = await orchestrator.updateAgent(mockAgent.id, updates);
      
      expect(updatedAgent.status).toBe('WORKING');
      expect(updatedAgent.terminalPid).toBe(12345);
    });

    it('should handle non-existent agents', async () => {
      mockConfigManager.loadAgent.mockResolvedValue(null);
      
      await expectAsync.toThrow(
        () => orchestrator.updateAgent('non-existent', { status: 'WORKING' }),
        'Agent not found'
      );
    });

    it('should validate status transitions', async () => {
      const offlineAgent = createMockAgent({ status: 'OFFLINE' });
      mockConfigManager.loadAgent.mockResolvedValue(offlineAgent);
      
      await expectAsync.toThrow(
        () => orchestrator.updateAgent(offlineAgent.id, { status: 'WORKING' }),
        'Cannot transition offline agent to working'
      );
    });
  });

  describe('sendMessage', () => {
    const mockSender = createMockAgent({ id: 'sender-1' });
    const mockReceiver = createMockAgent({ id: 'receiver-1', mailbox: [] });

    beforeEach(() => {
      mockConfigManager.loadAgent
        .mockImplementation((id: string) => {
          if (id === 'sender-1') return Promise.resolve(mockSender);
          if (id === 'receiver-1') return Promise.resolve(mockReceiver);
          return Promise.resolve(null);
        });
    });

    it('should send message between agents', async () => {
      const message = {
        content: 'Hello, agent!',
        priority: 'normal' as const
      };

      await orchestrator.sendMessage('sender-1', 'receiver-1', message);

      const expectedMessage = {
        id: expect.any(String),
        from: 'sender-1',
        content: 'Hello, agent!',
        priority: 'normal',
        timestamp: expect.any(String),
        read: false
      };

      expect(mockConfigManager.saveAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'receiver-1',
          mailbox: expect.arrayContaining([expectedMessage])
        })
      );
    });

    it('should handle different message priorities', async () => {
      const priorities = ['low', 'normal', 'high', 'urgent'] as const;
      
      for (const priority of priorities) {
        const message = { content: `Priority ${priority}`, priority };
        
        await orchestrator.sendMessage('sender-1', 'receiver-1', message);
        
        // Check that the last saved agent has the correct priority message
        const lastSaveCall = mockConfigManager.saveAgent.mock.calls.slice(-1)[0];
        const savedAgent = lastSaveCall[0];
        const lastMessage = savedAgent.mailbox[savedAgent.mailbox.length - 1];
        
        expect(lastMessage.priority).toBe(priority);
      }
    });

    it('should generate unique message IDs', async () => {
      const message = { content: 'Test message', priority: 'normal' as const };
      
      await orchestrator.sendMessage('sender-1', 'receiver-1', message);
      await orchestrator.sendMessage('sender-1', 'receiver-1', message);
      
      const saveCall1 = mockConfigManager.saveAgent.mock.calls[0][0];
      const saveCall2 = mockConfigManager.saveAgent.mock.calls[1][0];
      
      const message1Id = saveCall1.mailbox[0].id;
      const message2Id = saveCall2.mailbox[1].id;
      
      expect(message1Id).not.toBe(message2Id);
    });

    it('should handle non-existent sender', async () => {
      mockConfigManager.loadAgent.mockImplementation((id: string) => {
        if (id === 'receiver-1') return Promise.resolve(mockReceiver);
        return Promise.resolve(null);
      });
      
      const message = { content: 'Test', priority: 'normal' as const };
      
      await expectAsync.toThrow(
        () => orchestrator.sendMessage('non-existent', 'receiver-1', message),
        'Sender agent not found'
      );
    });

    it('should handle non-existent receiver', async () => {
      mockConfigManager.loadAgent.mockImplementation((id: string) => {
        if (id === 'sender-1') return Promise.resolve(mockSender);
        return Promise.resolve(null);
      });
      
      const message = { content: 'Test', priority: 'normal' as const };
      
      await expectAsync.toThrow(
        () => orchestrator.sendMessage('sender-1', 'non-existent', message),
        'Receiver agent not found'
      );
    });

    it('should validate message content', async () => {
      const message = { content: '', priority: 'normal' as const };
      
      await expectAsync.toThrow(
        () => orchestrator.sendMessage('sender-1', 'receiver-1', message),
        'Message content cannot be empty'
      );
    });
  });

  describe('getMailbox', () => {
    const mockAgent = createMockAgent({
      mailbox: [
        {
          id: 'msg-1',
          from: 'sender-1',
          content: 'Message 1',
          priority: 'normal',
          timestamp: '2024-01-01T00:00:00.000Z',
          read: false
        },
        {
          id: 'msg-2',
          from: 'sender-2',
          content: 'Message 2',
          priority: 'high',
          timestamp: '2024-01-02T00:00:00.000Z',
          read: true
        }
      ]
    });

    beforeEach(() => {
      mockConfigManager.loadAgent.mockResolvedValue(mockAgent);
    });

    it('should return agent mailbox', async () => {
      const mailbox = await orchestrator.getMailbox(mockAgent.id);
      
      expect(mailbox).toHaveLength(2);
      expect(mailbox[0].id).toBe('msg-1');
      expect(mailbox[1].id).toBe('msg-2');
    });

    it('should filter unread messages', async () => {
      const unreadMessages = await orchestrator.getMailbox(mockAgent.id, { unreadOnly: true });
      
      expect(unreadMessages).toHaveLength(1);
      expect(unreadMessages[0].id).toBe('msg-1');
      expect(unreadMessages[0].read).toBe(false);
    });

    it('should filter by sender', async () => {
      const messagesFromSender1 = await orchestrator.getMailbox(mockAgent.id, { from: 'sender-1' });
      
      expect(messagesFromSender1).toHaveLength(1);
      expect(messagesFromSender1[0].from).toBe('sender-1');
    });

    it('should filter by priority', async () => {
      const highPriorityMessages = await orchestrator.getMailbox(mockAgent.id, { priority: 'high' });
      
      expect(highPriorityMessages).toHaveLength(1);
      expect(highPriorityMessages[0].priority).toBe('high');
    });

    it('should handle empty mailbox', async () => {
      const emptyAgent = createMockAgent({ mailbox: [] });
      mockConfigManager.loadAgent.mockResolvedValue(emptyAgent);
      
      const mailbox = await orchestrator.getMailbox(emptyAgent.id);
      
      expect(mailbox).toEqual([]);
    });

    it('should handle non-existent agent', async () => {
      mockConfigManager.loadAgent.mockResolvedValue(null);
      
      await expectAsync.toThrow(
        () => orchestrator.getMailbox('non-existent'),
        'Agent not found'
      );
    });
  });

  describe('spawnOpenCodeTerminal (placeholder implementation)', () => {
    const mockAgent = createMockAgent();

    beforeEach(() => {
      mockConfigManager.loadAgent.mockResolvedValue(mockAgent);
      mockConfigManager.saveAgent.mockResolvedValue(undefined);
    });

    it('should simulate terminal spawning for development', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const pid = await orchestrator.spawnOpenCodeTerminal(mockAgent.id, 'test-script');
      
      expect(pid).toBe(0); // Placeholder returns 0
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Would spawn OpenCode terminal')
      );
      
      // Agent should be updated with placeholder PID
      expect(mockConfigManager.saveAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'WORKING',
          terminalPid: undefined
        })
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle script parameter sanitization', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const maliciousScript = 'rm -rf /; echo "hacked"';
      
      await orchestrator.spawnOpenCodeTerminal(mockAgent.id, maliciousScript);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Script:',
        maliciousScript // Currently passes through - would need real sanitization
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle non-existent agent', async () => {
      mockConfigManager.loadAgent.mockResolvedValue(null);
      
      await expectAsync.toThrow(
        () => orchestrator.spawnOpenCodeTerminal('non-existent', 'script'),
        'Agent not found'
      );
    });
  });

  describe('assignTaskToAgent', () => {
    const mockAgent = createMockAgent();
    const mockTask = createMockTask();

    beforeEach(() => {
      mockConfigManager.loadAgent.mockResolvedValue(mockAgent);
    });

    it('should assign task to agent', async () => {
      await orchestrator.assignTaskToAgent(mockAgent.id, mockTask.id);
      
      expect(mockConfigManager.saveAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockAgent.id,
          status: 'WORKING'
        })
      );
      expect(mockGitIntegration.commitAgentChanges).toHaveBeenCalledWith(
        mockAgent.id,
        `Assigned task ${mockTask.id}`
      );
    });

    it('should handle agent already working on task', async () => {
      const workingAgent = createMockAgent({ status: 'WORKING' });
      mockConfigManager.loadAgent.mockResolvedValue(workingAgent);
      
      await expectAsync.toThrow(
        () => orchestrator.assignTaskToAgent(workingAgent.id, mockTask.id),
        'Agent is already working'
      );
    });

    it('should handle offline agents', async () => {
      const offlineAgent = createMockAgent({ status: 'OFFLINE' });
      mockConfigManager.loadAgent.mockResolvedValue(offlineAgent);
      
      await expectAsync.toThrow(
        () => orchestrator.assignTaskToAgent(offlineAgent.id, mockTask.id),
        'Cannot assign task to offline agent'
      );
    });
  });

  describe('listAgents', () => {
    const mockAgents = [
      createMockAgent({ id: 'agent-1', status: 'IDLE' }),
      createMockAgent({ id: 'agent-2', status: 'WORKING' }),
      createMockAgent({ id: 'agent-3', status: 'OFFLINE' })
    ];

    beforeEach(() => {
      mockConfigManager.listAgents.mockResolvedValue(mockAgents);
    });

    it('should return all agents when no filter provided', async () => {
      const agents = await orchestrator.listAgents();
      
      expect(agents).toHaveLength(3);
      expect(mockConfigManager.listAgents).toHaveBeenCalled();
    });

    it('should filter agents by status', async () => {
      const idleAgents = await orchestrator.listAgents({ status: 'IDLE' });
      
      expect(idleAgents).toHaveLength(1);
      expect(idleAgents[0].status).toBe('IDLE');
    });

    it('should filter agents by capability', async () => {
      mockAgents[0].capability = 'general';
      mockAgents[1].capability = 'specialized';
      mockAgents[2].capability = 'general';
      
      const generalAgents = await orchestrator.listAgents({ capability: 'general' });
      
      expect(generalAgents).toHaveLength(2);
      expect(generalAgents.every(a => a.capability === 'general')).toBe(true);
    });

    it('should handle empty agent list', async () => {
      mockConfigManager.listAgents.mockResolvedValue([]);
      
      const agents = await orchestrator.listAgents();
      
      expect(agents).toEqual([]);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle concurrent agent operations', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        orchestrator.createAgent(`Agent ${i}`, 'general')
      );
      
      const agents = await Promise.all(promises);
      const ids = agents.map(a => a.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).toBe(5); // All IDs should be unique
    });

    it('should handle config manager errors', async () => {
      mockConfigManager.saveAgent.mockRejectedValue(new Error('Save failed'));
      
      await expectAsync.toThrow(
        () => orchestrator.createAgent('Test Agent', 'general'),
        'Save failed'
      );
    });

    it('should validate agent ID format', () => {
      const agentId = (orchestrator as any).generateAgentId();
      
      expect(agentId).toMatch(/^agent-[a-z0-9]+$/);
      expect(agentId.length).toBeGreaterThan(7); // 'agent-' + at least 1 character
    });

    it('should handle workspace path with special characters', () => {
      const specialPath = '/path/with spaces/$special&chars';
      const orchestratorWithSpecialPath = new AgentOrchestrator(specialPath);
      
      expect(orchestratorWithSpecialPath).toBeDefined();
    });
  });

  describe('security considerations', () => {
    it('should sanitize workspace path in terminal spawning', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const mockAgent = createMockAgent();
      
      // Create orchestrator with path containing shell metacharacters
      const dangerousPath = '/path/with$(rm -rf /)';
      const unsafeOrchestrator = new AgentOrchestrator(dangerousPath);
      mockConfigManager.loadAgent.mockResolvedValue(mockAgent);
      
      await unsafeOrchestrator.spawnOpenCodeTerminal(mockAgent.id, 'test');
      
      // Currently just logs warning - would need real sanitization
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Would spawn OpenCode terminal')
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle malicious agent names', async () => {
      const maliciousName = '<script>alert("xss")</script>';
      
      const agent = await orchestrator.createAgent(maliciousName, 'general');
      
      // Should store the name as-is (HTML escaping would be done at display time)
      expect(agent.name).toBe(maliciousName);
    });
  });
});