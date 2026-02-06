import { jest } from '@jest/globals';

/**
 * Test utilities for CreateSuite unit tests
 */

/**
 * Mock task data generator
 */
export const createMockTask = (overrides: any = {}) => ({
  id: 'cs-test1',
  title: 'Test Task',
  description: 'A test task for unit tests',
  status: 'OPEN' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  assignedAgent: null,
  ...overrides,
});

/**
 * Mock agent data generator
 */
export const createMockAgent = (overrides: any = {}) => ({
  id: 'agent-test1',
  name: 'Test Agent',
  capability: 'general',
  status: 'IDLE' as const,
  createdAt: new Date().toISOString(),
  terminalPid: null,
  mailbox: [],
  ...overrides,
});

/**
 * Mock convoy data generator
 */
export const createMockConvoy = (overrides: any = {}) => ({
  id: 'cs-cv-test1',
  name: 'Test Convoy',
  description: 'A test convoy',
  tasks: ['cs-test1'],
  createdAt: new Date().toISOString(),
  ...overrides,
});

/**
 * Create temporary test directory
 */
export const createTempTestDir = () => {
  const tmpDir = `/tmp/createsuite-test-${Date.now()}`;
  const fs = require('fs');
  fs.mkdirSync(tmpDir, { recursive: true });
  return tmpDir;
};

/**
 * Clean up test directory
 */
export const cleanupTestDir = (dir: string) => {
  const fs = require('fs');
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

/**
 * Mock file system operations
 */
export const mockFileSystem = {
  files: new Map<string, string>(),
  
  writeFileSync: jest.fn((path: string, content: string) => {
    mockFileSystem.files.set(path, content);
  }),
  
  readFileSync: jest.fn((path: string) => {
    const content = mockFileSystem.files.get(path);
    if (!content) throw new Error(`File not found: ${path}`);
    return content;
  }),
  
  existsSync: jest.fn((path: string) => {
    return mockFileSystem.files.has(path);
  }),
  
  clear: () => {
    mockFileSystem.files.clear();
  }
};

/**
 * Async test helper for promise-based operations
 */
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mock environment variables for tests
 */
export const mockEnv = (vars: Record<string, string>) => {
  const original = { ...process.env };
  Object.assign(process.env, vars);
  
  return () => {
    // Restore original env
    process.env = original;
  };
};

/**
 * Error test helper
 */
export const expectAsync = {
  toThrow: async (asyncFn: () => Promise<any>, expectedError?: string | RegExp) => {
    try {
      await asyncFn();
      throw new Error('Expected function to throw');
    } catch (error) {
      if (expectedError) {
        if (typeof expectedError === 'string') {
          expect((error as Error).message).toContain(expectedError);
        } else {
          expect((error as Error).message).toMatch(expectedError);
        }
      }
    }
  }
};