// Global test setup and mocks
import fs from 'fs';
import path from 'path';

// Mock fs operations for tests
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

// Mock simple-git for git operations
jest.mock('simple-git', () => {
  return jest.fn(() => ({
    init: jest.fn().mockResolvedValue(undefined),
    add: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue({ hash: 'mock-hash' }),
    status: jest.fn().mockResolvedValue({ files: [] }),
    checkout: jest.fn().mockResolvedValue(undefined),
    branch: jest.fn().mockResolvedValue(undefined),
  }));
});

// Mock child_process for terminal spawning
jest.mock('child_process', () => ({
  spawn: jest.fn().mockReturnValue({
    pid: 12345,
    stdout: {
      on: jest.fn(),
    },
    stderr: {
      on: jest.fn(),
    },
    on: jest.fn(),
    kill: jest.fn(),
  }),
}));

// Mock inquirer for interactive prompts
jest.mock('inquirer', () => ({
  prompt: jest.fn().mockResolvedValue({}),
}));

// Create test workspace directory
const testWorkspaceDir = path.join(__dirname, '.test-workspace');
if (!fs.existsSync(testWorkspaceDir)) {
  fs.mkdirSync(testWorkspaceDir, { recursive: true });
}

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.TEST_WORKSPACE = testWorkspaceDir;

// Clean up after tests
afterEach(() => {
  jest.clearAllMocks();
});

beforeEach(() => {
  // Reset mocked fs calls
  const mockedFs = fs as jest.Mocked<typeof fs>;
  mockedFs.existsSync.mockReturnValue(true);
  mockedFs.readFileSync.mockReturnValue('{}');
});