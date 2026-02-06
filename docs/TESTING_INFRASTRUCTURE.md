# Testing Infrastructure Documentation

## Overview

This document provides comprehensive documentation for the testing infrastructure implemented in CreateSuite, including the Jest framework setup, test utilities, and comprehensive test suites for all core components.

## Testing Framework Setup

### Jest Configuration

**File:** `jest.config.js`

The project uses Jest as the primary testing framework with the following configuration:

- **Preset:** `ts-jest` for TypeScript support
- **Test Environment:** Node.js environment for backend testing
- **Test Patterns:** `tests/**/*.test.ts` and `src/**/*.test.ts`
- **Coverage:** Configured for comprehensive code coverage reporting
- **Module Mapping:** Proper TypeScript path resolution

### Key Features:
- TypeScript compilation via ts-jest
- Automatic test discovery
- Coverage reporting with HTML output
- Support for ES6 modules and async/await
- Mock support for external dependencies

### Dependencies Added

The following testing dependencies were added to `package.json`:

```json
{
  "devDependencies": {
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "@types/jest": "^29.5.8",
    "supertest": "^6.3.3"
  }
}
```

## Test Utilities Framework

**File:** `tests/utils.ts`

A comprehensive test utilities framework providing:

### Mock Data Generators
- `createMockTask()` - Generates realistic test tasks
- `createMockAgent()` - Creates mock agents with various states
- `createMockConvoy()` - Generates convoy test data
- `createMockConfig()` - Creates workspace configuration mocks

### Test Helpers
- `createTestWorkspace()` - Sets up isolated test environments
- `cleanupTestWorkspace()` - Removes test artifacts
- File system utilities for test isolation
- Git repository setup for integration tests

### Mock Implementations
- Git command mocking
- File system operation mocking
- OAuth service mocking
- System metrics mocking

## Test Setup Configuration

**File:** `tests/setup.ts`

Global test setup providing:

- **Timeout Configuration:** 30-second timeout for complex operations
- **Mock Implementations:** Jest mocks for external services
- **Environment Variables:** Test-specific environment setup
- **Global Cleanup:** After-test cleanup utilities
- **Console Suppression:** Reduces noise during test runs

## Core Test Suites

### 1. Task Management Tests

**File:** `tests/taskManager.test.ts` (80+ test cases)

Comprehensive testing for the task management system:

#### Test Categories:
- **Task Creation** (15 tests)
  - Basic task creation with all fields
  - Validation of required fields
  - Priority assignment
  - Tag handling
  - ID generation uniqueness

- **Task Retrieval** (12 tests)  
  - Get task by ID
  - List all tasks
  - Filter by status, priority, tags
  - Pagination support
  - Non-existent task handling

- **Task Updates** (18 tests)
  - Status transitions (OPEN → IN_PROGRESS → COMPLETED)
  - Invalid status transitions
  - Field updates (title, description, priority)
  - Tag management (add/remove)
  - Concurrent update handling

- **Task Assignment** (10 tests)
  - Agent assignment
  - Assignment validation
  - Multiple agent handling
  - Unassignment operations

- **Task Dependencies** (8 tests)
  - Dependency creation
  - Circular dependency prevention
  - Dependency resolution
  - Cascade operations

- **Task Search & Filtering** (12 tests)
  - Text search in title/description
  - Status filtering
  - Priority filtering
  - Date range filtering
  - Combined filters

- **Error Handling** (5 tests)
  - Invalid task IDs
  - Missing required fields
  - Validation errors
  - File system errors

### 2. Configuration Management Tests

**File:** `tests/configManager.test.ts` (60+ test cases)

Testing for workspace configuration management:

#### Test Categories:
- **Initialization** (10 tests)
  - New workspace setup
  - Existing workspace loading
  - Configuration validation
  - Default value handling

- **Configuration Updates** (15 tests)
  - Setting updates
  - Configuration validation
  - Type checking
  - Nested object handling

- **File Persistence** (12 tests)
  - Save/load operations
  - Atomic writes
  - Backup creation
  - Corruption recovery

- **Migration** (8 tests)
  - Version migration
  - Schema updates
  - Backwards compatibility
  - Migration rollback

- **Git Integration** (10 tests)
  - Git hook setup
  - Configuration tracking
  - Branch-specific configs
  - Merge conflict handling

- **Error Handling** (5 tests)
  - File system errors
  - JSON parsing errors
  - Permission issues
  - Validation failures

### 3. Git Integration Tests

**File:** `tests/gitIntegration.test.ts` (50+ test cases)

Testing for git-backed persistence:

#### Test Categories:
- **Repository Setup** (8 tests)
  - Git initialization
  - Hook installation
  - Branch creation
  - Remote configuration

- **Commit Operations** (12 tests)
  - Automatic commits
  - Commit message generation
  - Staging area management
  - Conflict resolution

- **Branch Management** (10 tests)
  - Agent branch creation
  - Branch switching
  - Merge operations
  - Branch cleanup

- **State Tracking** (15 tests)
  - Task state persistence
  - Configuration tracking
  - History preservation
  - Rollback operations

- **Synchronization** (5 tests)
  - Remote push/pull
  - Conflict detection
  - Merge conflict resolution
  - Sync validation

### 4. Agent Orchestration Tests

**File:** `tests/agentOrchestrator.test.ts` (70+ test cases)

Testing for agent lifecycle management:

#### Test Categories:
- **Agent Creation** (15 tests)
  - Basic agent creation
  - Capability validation
  - ID uniqueness
  - Configuration setup

- **Agent States** (12 tests)
  - State transitions (IDLE → WORKING → OFFLINE)
  - Invalid state changes
  - State persistence
  - State recovery

- **Task Assignment** (18 tests)
  - Agent-task matching
  - Capability-based assignment
  - Load balancing
  - Assignment validation

- **Communication** (10 tests)
  - Mailbox creation
  - Message routing
  - Inter-agent communication
  - Message persistence

- **Terminal Integration** (8 tests)
  - OpenCode terminal spawning
  - Terminal lifecycle
  - Command execution
  - Terminal cleanup

- **Error Handling** (7 tests)
  - Agent failures
  - Terminal errors
  - Communication failures
  - Recovery procedures

### 5. OAuth Management Tests

**File:** `tests/oauthManager.test.ts` (40+ test cases)

Testing for authentication system:

#### Test Categories:
- **OAuth Flow** (15 tests)
  - Authorization URL generation
  - PKCE implementation
  - Token exchange
  - Refresh token handling

- **Token Management** (10 tests)
  - Token storage
  - Token validation
  - Token expiration
  - Token refresh

- **Security** (8 tests)
  - CSRF protection
  - State parameter validation
  - Secure storage
  - Token encryption

- **Error Handling** (7 tests)
  - Network errors
  - Invalid tokens
  - Expired tokens
  - OAuth provider errors

## Test Coverage Goals

### Current Coverage Targets:
- **TaskManager:** 85%+ statement coverage
- **ConfigManager:** 80%+ statement coverage  
- **GitIntegration:** 75%+ statement coverage
- **AgentOrchestrator:** 80%+ statement coverage
- **OAuthManager:** 90%+ statement coverage

### Coverage Reporting:
```bash
# Generate coverage report
npm test -- --coverage

# View HTML coverage report
open coverage/lcov-report/index.html
```

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Suites
```bash
# Task management tests only
npm test tests/taskManager.test.ts

# Configuration tests only  
npm test tests/configManager.test.ts

# Git integration tests only
npm test tests/gitIntegration.test.ts

# Agent orchestration tests only
npm test tests/agentOrchestrator.test.ts

# OAuth tests only
npm test tests/oauthManager.test.ts
```

### Watch Mode
```bash
npm test -- --watch
```

### Debug Mode
```bash
npm test -- --verbose
```

## Test Isolation

### Workspace Isolation
Each test suite runs in isolated workspaces to prevent cross-test contamination:

- Temporary directories created per test
- Git repositories isolated
- Configuration files separate
- Cleanup after each test

### Mock Isolation
External dependencies are properly mocked:

- File system operations
- Git commands
- Network requests
- System resources

## Best Practices

### Test Structure
- **Arrange-Act-Assert** pattern
- Descriptive test names
- Single assertion per test when possible
- Proper setup/teardown

### Mock Usage
- Mock external dependencies
- Use real implementations for core logic
- Verify mock interactions
- Reset mocks between tests

### Async Testing
- Proper async/await usage
- Timeout handling
- Promise rejection testing
- Cleanup in finally blocks

## Continuous Integration

### GitHub Actions Integration
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

### Pre-commit Hooks
```bash
# Install pre-commit hook
npm run test:pre-commit
```

## Maintenance

### Adding New Tests
1. Create test file in `tests/` directory
2. Import necessary utilities from `tests/utils.ts`
3. Follow existing naming conventions
4. Include setup/teardown as needed
5. Update this documentation

### Test Data Management
- Use factory functions for test data
- Keep test data minimal but realistic
- Update mock data when models change
- Version test data with schema changes

### Performance Considerations
- Mock heavy operations
- Use test-specific timeouts
- Parallel test execution where possible
- Cleanup resources properly

## Integration with Development Workflow

### Local Development
```bash
# Run tests before committing
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode during development
npm run test:watch
```

### Code Quality Gates
- All tests must pass before merge
- Coverage must meet minimum thresholds
- No test-specific eslint violations
- Documentation must be updated

## Troubleshooting

### Common Issues

**Tests timing out:**
- Increase timeout in jest.config.js
- Check for unresolved promises
- Verify mock implementations

**File system errors:**
- Ensure proper cleanup
- Check permissions
- Verify test isolation

**Git-related failures:**
- Ensure git is available in test environment
- Check git configuration
- Verify repository isolation

### Debugging Tests
```bash
# Run with verbose output
npm test -- --verbose

# Run specific test with debugging
node --inspect-brk node_modules/.bin/jest tests/taskManager.test.ts

# Enable debug logging
DEBUG=* npm test
```

## Future Improvements

### Planned Enhancements:
1. **Integration Tests** - End-to-end workflow testing
2. **Performance Tests** - Load and stress testing  
3. **UI Testing** - React component testing
4. **API Testing** - REST endpoint testing
5. **Security Testing** - Vulnerability scanning

### Test Infrastructure Evolution:
- Test data factories
- Visual regression testing
- Automated test generation
- Performance benchmarking
- Cross-platform testing

## Documentation Updates

This documentation should be updated when:
- New test suites are added
- Test utilities are enhanced
- Coverage targets change
- Testing tools are upgraded
- Best practices evolve

**Last Updated:** 2026-02-06  
**Version:** 1.0  
**Maintainer:** CreateSuite Development Team