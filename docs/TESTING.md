# CreateSuite Testing Documentation

## Overview

This document outlines the comprehensive unit testing strategy implemented for CreateSuite, a sophisticated orchestrated swarm system for OpenCode agents with git-based task tracking.

## Testing Framework

### Technology Stack
- **Jest** - Primary testing framework for unit and integration tests
- **ts-jest** - TypeScript support for Jest
- **@testing-library/react** - React component testing utilities
- **Supertest** - HTTP assertion testing for API endpoints

### Configuration

#### Jest Configuration (`jest.config.js`)
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/cli.ts', // Exclude CLI entry point from coverage
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 10000,
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

### Test Structure

#### Directory Layout
```
tests/
├── setup.ts              # Global test setup and mocks
├── utils.ts               # Test utilities and helpers
├── taskManager.test.ts    # Task management tests
├── configManager.test.ts  # Configuration management tests
├── gitIntegration.test.ts # Git operations tests
├── agentOrchestrator.test.ts # Agent orchestration tests
└── oauthManager.test.ts   # OAuth authentication tests
```

## Test Coverage Areas

### 1. TaskManager Tests (`tests/taskManager.test.ts`)

**Critical Paths Covered:**
- Task creation with unique ID generation
- Task status transitions and validation
- Task assignment to agents
- Task filtering and listing operations

**Edge Cases Tested:**
- Concurrent task creation (ID uniqueness)
- Invalid status transitions
- Error handling for missing tasks
- Git integration failures

**Key Test Examples:**
```typescript
describe('createTask', () => {
  it('should create a new task with valid ID format', async () => {
    const task = await taskManager.createTask('Test Task', 'Test Description');
    
    expect(task.id).toMatch(/^cs-[a-z0-9]{5}$/);
    expect(task.status).toBe('OPEN');
    expect(mockConfigManager.saveTask).toHaveBeenCalledWith(task);
  });
});
```

### 2. ConfigManager Tests (`tests/configManager.test.ts`)

**Critical Paths Covered:**
- File system operations (save/load)
- JSON serialization/deserialization
- Directory creation and management
- Concurrent file operations

**Security Tests:**
- Path traversal prevention
- File permission validation (0o600 for credentials)
- Input sanitization

### 3. GitIntegration Tests (`tests/gitIntegration.test.ts`)

**Critical Operations:**
- Repository initialization
- Commit operations with proper messages
- Branch management for agents
- Error handling for git failures

**Reliability Tests:**
- Concurrent git operations
- Invalid commit message handling
- Repository state validation

### 4. AgentOrchestrator Tests (`tests/agentOrchestrator.test.ts`)

**Agent Lifecycle:**
- Agent creation and ID generation
- Status transitions and validation
- Message passing between agents
- Terminal spawning (development mode)

**Communication Tests:**
- Inter-agent messaging
- Message filtering and retrieval
- Mailbox management

### 5. OAuthManager Tests (`tests/oauthManager.test.ts`)

**Authentication Flow:**
- Token storage and retrieval
- Token expiration validation
- Secure file permissions
- Error handling for corrupted tokens

## Test Utilities

### Mock System (`tests/setup.ts`)
Provides comprehensive mocking for:
- File system operations
- Git commands
- Child process spawning
- Interactive prompts

### Test Helpers (`tests/utils.ts`)
- Mock data generators
- Async test utilities
- Environment variable mocking
- Error assertion helpers

## Running Tests

### Commands
```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run integration tests only
npm run test:integration
```

### Coverage Goals
- **Minimum**: 80% line coverage
- **Target**: 90% line coverage
- **Critical paths**: 100% coverage

## Continuous Integration

### Pre-commit Hooks
Tests are automatically run before commits to ensure code quality.

### GitHub Actions (Recommended)
```yaml
- name: Run Tests
  run: |
    npm install
    npm run test:coverage
    
- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage/lcov.info
```

## Testing Best Practices

### 1. Test Naming Convention
- Describe behavior, not implementation
- Use "should" statements
- Be specific about expected outcomes

### 2. Test Organization
- Group related tests in describe blocks
- Use beforeEach/afterEach for setup/cleanup
- Keep tests independent and idempotent

### 3. Assertion Quality
- Test both success and failure cases
- Verify all side effects
- Use specific assertions over generic ones

### 4. Mock Management
- Mock external dependencies only
- Verify mock interactions when relevant
- Clean up mocks between tests

## Known Limitations

### Current Gaps
1. **UI Component Tests**: React components need testing setup
2. **E2E Tests**: Full workflow testing not yet implemented
3. **Performance Tests**: Load testing for concurrent operations
4. **Integration Tests**: Real API endpoint testing

### Future Improvements
1. **Snapshot Testing**: For UI component regression detection
2. **Property-Based Testing**: For edge case discovery
3. **Visual Regression Testing**: For UI consistency
4. **Contract Testing**: For API compatibility

## Debugging Tests

### Common Issues
1. **Async Test Failures**: Ensure proper await usage
2. **Mock Leakage**: Check afterEach cleanup
3. **File System Races**: Use proper mocking
4. **Timeout Errors**: Increase test timeout for slow operations

### Debugging Tools
- Use `--verbose` flag for detailed output
- Enable `console.log` in tests for debugging
- Use `--runInBand` to run tests serially
- Use `--detectOpenHandles` to find resource leaks

## Maintenance

### Regular Tasks
1. Update test dependencies quarterly
2. Review and update test coverage goals
3. Refactor tests when refactoring source code
4. Add tests for new features immediately

### Monitoring
- Track coverage trends over time
- Monitor test execution time
- Review flaky test patterns
- Update documentation as tests evolve

This testing framework provides a solid foundation for ensuring CreateSuite's reliability and maintainability as it evolves.

## Related Documentation

For comprehensive details on the testing implementation and related improvements, see:

- **[Testing Infrastructure Documentation](TESTING_INFRASTRUCTURE.md)** - Complete technical documentation of the Jest framework setup, test utilities, and all test suites with 300+ test cases
- **[Bug Fixes & Security Improvements](BUG_FIXES_SECURITY.md)** - Documentation of critical security fixes including OAuth PKCE implementation, agent orchestration improvements, and input validation
- **[Dashboard UI Enhancements](DASHBOARD_UI_ENHANCEMENTS.md)** - Real-time system metrics integration, professional toast notifications, and React performance optimizations

## Complete Testing Implementation Summary

### Test Coverage Statistics:
- **Total Test Cases:** 300+ comprehensive tests
- **Test Files:** 5 major test suites  
- **Core Components Covered:** TaskManager, ConfigManager, GitIntegration, AgentOrchestrator, OAuthManager
- **Code Coverage Target:** 80%+ across all core modules

### Security Testing:
- OAuth PKCE flow validation
- Input sanitization and validation
- File permission verification
- Path traversal prevention
- Credential encryption testing

### Major Bug Fixes Implemented:
- ✅ **OAuth Security Overhaul** - Replaced dangerous placeholder with secure PKCE implementation
- ✅ **Agent Terminal Integration** - Added real OpenCode terminal spawning logic
- ✅ **System Metrics Integration** - Replaced fake data with real-time system monitoring
- ✅ **Professional UI Patterns** - Toast notifications instead of browser alerts
- ✅ **Comprehensive Error Handling** - User-friendly error messages with retry logic

### Infrastructure Improvements:
- Jest test framework with TypeScript support
- Comprehensive mock system for external dependencies
- Test utilities with mock data generators
- Global test setup with proper cleanup
- Automated test execution with coverage reporting