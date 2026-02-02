# Developer Onboarding Improvements

## TL;DR

> **Quick Summary**: Make CreateSuite easier for new developers to get started with by adding test infrastructure, an interactive tutorial command, CLI UX improvements, and essential developer documentation.
> 
> **Deliverables**:
> - Bun runtime + Bun Test setup with ~70% coverage on core modules
> - `cs tutorial` command with 3-lesson interactive walkthrough
> - CLI input validation and improved error messages
> - DEVELOPMENT.md and CONTRIBUTING.md documentation
> 
> **Estimated Effort**: Large (multiple weeks)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 (Bun) -> Task 2 (Tests) -> Task 6 (Tutorial Tests)

---

## Context

### Original Request
User wants to improve the CreateSuite repository to make it "super easy for other developers to get started with" after adding a lot of changes.

### Interview Summary
**Key Discussions**:
- **Approach**: Balanced - tests + docs + polish in parallel (quality over speed)
- **Primary Audience**: New Users who need to learn concepts
- **Pain Point**: People struggle understanding tasks vs agents vs convoys
- **Test Framework**: Install Bun first, then use Bun Test
- **Tutorial Scope**: 3-lesson MVP (~15 min) - Tasks, Agents, Convoys
- **CI/CD**: Skip for now (focus on local testing first)

**Research Findings**:
- 14 TypeScript modules (~3,575 lines) with 0% test coverage
- 18 documentation files exist but missing DEVELOPMENT.md, CONTRIBUTING.md
- CLI uses Commander.js, functionally complete but lacks validation
- Existing POLISH_CHECKLIST.md has overlapping improvement items
- Project uses npm/ts-node currently (Bun not installed)

### Metis Review
**Identified Gaps** (addressed):
- Test framework assumption (Bun not installed) -> Added Bun installation task
- Tutorial scope creep risk -> Limited to 3 lessons max
- Tutorial sandbox needed -> Will use isolated `.createsuite-tutorial/`
- Missing acceptance criteria -> Added executable verification commands
- Edge cases (Ctrl+C, non-TTY) -> Added guardrails for handling

---

## Work Objectives

### Core Objective
Enable new developers to quickly understand and start using CreateSuite through an interactive tutorial, comprehensive tests that validate behavior, and clear developer documentation.

### Concrete Deliverables
1. **Bun runtime installed** with `bun test` working
2. **Test suite** covering 6 core modules at ~70% line coverage
3. **`cs tutorial` command** with 3 interactive lessons
4. **CLI validation** for task/agent/convoy create commands
5. **DEVELOPMENT.md** with setup, build, test instructions
6. **CONTRIBUTING.md** with PR process and code standards

### Definition of Done
- [ ] `bun test` passes with >= 70% line coverage on core modules
- [ ] `cs tutorial` completes all 3 lessons without error in sandbox
- [ ] `cs task create` (missing title) shows helpful error message
- [ ] `cat DEVELOPMENT.md | grep -q "## Setup"` returns 0
- [ ] `cat CONTRIBUTING.md | grep -q "## Pull Request"` returns 0

### Must Have
- Bun Test framework configured and working
- Tests for: taskManager, agentOrchestrator, convoyManager, config, gitIntegration
- Interactive tutorial with Tasks, Agents, Convoys lessons
- Input validation for create commands
- DEVELOPMENT.md and CONTRIBUTING.md files

### Must NOT Have (Guardrails)
- **NO** CI/CD automation in this plan (deferred)
- **NO** E2E tests in initial testing phase
- **NO** Agent UI (Electron) coverage in tutorial v1
- **NO** refactoring production code "for testability"
- **NO** new CLI commands beyond `cs tutorial`
- **NO** tutorial branching paths or conditional logic
- **NO** rewriting existing documentation files
- **NO** auto-generated API docs from all files

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: NO (installing Bun)
- **User wants tests**: YES (Bun Test)
- **Framework**: Bun Test (native)

### TDD Workflow
Each test task follows RED-GREEN-REFACTOR:
1. **RED**: Write failing test first
2. **GREEN**: Implement minimum code to pass
3. **REFACTOR**: Clean up while keeping green

### Test Setup Task (Task 1)
- Install Bun: `curl -fsSL https://bun.sh/install | bash`
- Create `bunfig.toml` if needed
- Verify: `bun test --help` shows help
- Example: Create `src/__tests__/example.test.ts`
- Verify: `bun test` runs and passes

### Automated Verification Standards
All acceptance criteria are executable commands. No "user manually tests" steps.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Install Bun & Setup Test Infrastructure [FOUNDATION]
├── Task 4: Create DEVELOPMENT.md [DOCUMENTATION]
└── Task 5: Create CONTRIBUTING.md [DOCUMENTATION]

Wave 2 (After Wave 1):
├── Task 2: Write Core Module Tests [depends: 1]
└── Task 3: CLI Input Validation & Error Messages [depends: 1]

Wave 3 (After Wave 2):
└── Task 6: Build Interactive Tutorial [depends: 2, 3]

Critical Path: Task 1 -> Task 2 -> Task 6
Parallel Speedup: ~35% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2, 3 | 4, 5 |
| 2 | 1 | 6 | 3 |
| 3 | 1 | 6 | 2 |
| 4 | None | None | 1, 5 |
| 5 | None | None | 1, 4 |
| 6 | 2, 3 | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 4, 5 | 3 parallel agents: quick (task 1), writing (tasks 4, 5) |
| 2 | 2, 3 | 2 parallel agents: unspecified-high (task 2), quick (task 3) |
| 3 | 6 | 1 agent: deep (tutorial is complex) |

---

## TODOs

### Task 1: Install Bun & Setup Test Infrastructure

**What to do**:
- Install Bun runtime globally
- Configure Bun Test in the project
- Create test directory structure (`src/__tests__/`)
- Add test scripts to package.json
- Create an example test to verify setup works
- Document test commands in README or inline

**Must NOT do**:
- Install Jest or Vitest (we chose Bun Test)
- Add CI/CD configuration
- Write actual module tests (that's Task 2)

**Recommended Agent Profile**:
- **Category**: `quick`
  - Reason: Straightforward setup task with clear steps
- **Skills**: [`git-master`]
  - `git-master`: Will need to commit package.json and config changes
- **Skills Evaluated but Omitted**:
  - `frontend-ui-ux`: No UI work
  - `playwright`: No browser testing

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 1 (with Tasks 4, 5)
- **Blocks**: Tasks 2, 3 (need test infrastructure)
- **Blocked By**: None (can start immediately)

**References**:

**Pattern References**:
- `package.json:14` - Current test script placeholder (`"test": "echo \"No tests yet\""`)
- `docs/planning/POLISH_CHECKLIST.md` - Mentions "Jest or Vitest" but we're using Bun Test

**Documentation References**:
- Bun official docs: https://bun.sh/docs/cli/test
- Current project structure shows `src/__tests__/` exists but is empty

**Acceptance Criteria**:

```bash
# Bun is installed and accessible
bun --version
# Assert: Returns version number (e.g., "1.x.x")

# Test command works
bun test --help
# Assert: Shows help text for bun test

# Example test file exists and passes
test -f src/__tests__/example.test.ts && echo "pass"
# Assert: Output is "pass"

bun test src/__tests__/example.test.ts
# Assert: Exit code 0, shows "1 passed"

# Package.json has test script
grep -q '"test".*bun test' package.json
# Assert: Returns 0 (script exists)
```

**Evidence to Capture**:
- [ ] `bun --version` output
- [ ] `bun test` output showing example test passes

**Commit**: YES
- Message: `chore: setup Bun Test infrastructure`
- Files: `package.json`, `bunfig.toml` (if created), `src/__tests__/example.test.ts`
- Pre-commit: `bun test`

---

### Task 2: Write Core Module Tests

**What to do**:
- Write unit tests for 6 core modules:
  1. `taskManager.ts` - Task CRUD, filtering, assignment
  2. `agentOrchestrator.ts` - Agent creation, status, mailbox
  3. `convoyManager.ts` - Convoy creation, progress tracking
  4. `config.ts` - Configuration loading, saving
  5. `gitIntegration.ts` - Git operations (may need mocking)
  6. `types.ts` - Type exports (minimal testing)
- Use temp directories for filesystem operations
- Mock external dependencies (git, child_process)
- Target ~70% line coverage on tested modules
- Ensure all tests run in < 30 seconds total

**Must NOT do**:
- Refactor production code to "improve testability"
- Write integration tests (unit tests only)
- Write E2E tests
- Test CLI commands (that's part of tutorial validation)
- Test providerManager or oauthManager (complex external deps)

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
  - Reason: Substantial effort writing tests for 6 modules, requires understanding code patterns
- **Skills**: [`git-master`]
  - `git-master`: Multiple commits for different modules
- **Skills Evaluated but Omitted**:
  - `playwright`: No browser testing needed
  - `frontend-ui-ux`: No UI work

**Parallelization**:
- **Can Run In Parallel**: YES (after Wave 1)
- **Parallel Group**: Wave 2 (with Task 3)
- **Blocks**: Task 6 (tutorial needs tested foundation)
- **Blocked By**: Task 1 (needs Bun Test setup)

**References**:

**Pattern References** (code to test):
- `src/taskManager.ts:30-49` - `createTask()` method - test task creation with all parameters
- `src/taskManager.ts:61-75` - `updateTask()` method - test updates and error handling
- `src/taskManager.ts:99-118` - `listTasks()` with filters - test filtering logic
- `src/agentOrchestrator.ts:21-36` - `createAgent()` - test agent creation
- `src/agentOrchestrator.ts:81-104` - `sendMessage()` - test mailbox system
- `src/convoyManager.ts` - All CRUD operations
- `src/config.ts` - ConfigManager file I/O operations

**API/Type References** (contracts to test against):
- `src/types.ts:Task` - Task interface shape
- `src/types.ts:Agent` - Agent interface shape
- `src/types.ts:TaskStatus`, `AgentStatus` - Enum values to test

**Test Pattern Reference** (from Bun docs):
```typescript
// Pattern to follow
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('TaskManager', () => {
  let tempDir: string;
  
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cs-test-'));
  });
  
  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });
  
  test('creates task with correct ID format', async () => {
    // test implementation
  });
});
```

**Acceptance Criteria**:

```bash
# All tests pass
bun test
# Assert: Exit code 0, all tests pass

# Coverage report shows >= 70% on core modules
bun test --coverage 2>&1 | grep -E "(taskManager|agentOrchestrator|convoyManager|config)" 
# Assert: Each module shows >= 70% line coverage

# Test files exist for each module
test -f src/__tests__/taskManager.test.ts && \
test -f src/__tests__/agentOrchestrator.test.ts && \
test -f src/__tests__/convoyManager.test.ts && \
test -f src/__tests__/config.test.ts && \
echo "all test files exist"
# Assert: Output is "all test files exist"

# Tests run in under 30 seconds
time bun test 2>&1 | grep real
# Assert: real time < 30s

# TaskManager tests cover key functions
grep -c "test\|it(" src/__tests__/taskManager.test.ts
# Assert: >= 5 tests
```

**Evidence to Capture**:
- [ ] `bun test --coverage` output showing coverage percentages
- [ ] Test count per module

**Commit**: YES (multiple commits, one per module)
- Message: `test(taskManager): add unit tests for task CRUD operations`
- Files: `src/__tests__/taskManager.test.ts`
- Pre-commit: `bun test src/__tests__/taskManager.test.ts`

---

### Task 3: CLI Input Validation & Error Messages

**What to do**:
- Add input validation for these commands:
  - `cs task create` - Require title, validate priority values
  - `cs agent create` - Require name
  - `cs convoy create` - Require name
- Improve error messages to include:
  - What went wrong
  - How to fix it (actionable suggestion)
  - Example of correct usage
- Handle non-TTY/piped input gracefully
- Validate task/agent IDs exist before operations

**Must NOT do**:
- Add new CLI commands (except `cs tutorial` in Task 6)
- Add command aliases
- Change existing flag names
- Refactor CLI architecture
- Add `--verbose` flag or other new flags

**Recommended Agent Profile**:
- **Category**: `quick`
  - Reason: Focused changes to existing commands, clear scope
- **Skills**: [`git-master`]
  - `git-master`: Commit changes to cli.ts
- **Skills Evaluated but Omitted**:
  - `frontend-ui-ux`: CLI not UI
  - `playwright`: No browser needed

**Parallelization**:
- **Can Run In Parallel**: YES (after Wave 1)
- **Parallel Group**: Wave 2 (with Task 2)
- **Blocks**: Task 6 (tutorial exercises CLI)
- **Blocked By**: Task 1 (may want to run tests after changes)

**References**:

**Pattern References** (existing code to modify):
- `src/cli.ts:92-130` - `task create` command - add title validation
- `src/cli.ts:99` - Priority option - validate against enum values
- `src/cli.ts:166-200` - `agent create` command - add name validation
- `src/cli.ts:230-270` - `convoy create` command - add name validation

**Error Handling Pattern** (good example to follow):
- `src/cli.ts:55-56` - Shows "Next steps" after init (follow this pattern for errors)

**API/Type References**:
- `src/types.ts:TaskPriority` - Valid priority values: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

**External Reference**:
- Commander.js validation: https://github.com/tj/commander.js#custom-argument-processing

**Acceptance Criteria**:

```bash
# Missing title shows helpful error
cs task create 2>&1 | grep -i "title"
# Assert: Output contains "title is required" or similar

# Invalid priority shows valid options
cs task create -t "Test" -p invalid 2>&1 | grep -iE "(low|medium|high|critical)"
# Assert: Output lists valid priority values

# Missing agent name shows error
cs agent create 2>&1 | grep -i "name"
# Assert: Output contains "name is required" or similar

# Non-existent task ID shows helpful message
cs task show nonexistent-id 2>&1 | grep -iE "(not found|cs task list)"
# Assert: Output mentions task not found AND suggests cs task list

# Exit codes are correct
cs task create; echo "exit: $?"
# Assert: Exit code is 1 for validation errors

# Error messages include fix suggestion
cs task create 2>&1 | grep -iE "(example|usage|try)"
# Assert: Output includes usage example or suggestion
```

**Evidence to Capture**:
- [ ] Error message output for each validation case
- [ ] Exit codes verification

**Commit**: YES
- Message: `fix(cli): add input validation and improve error messages`
- Files: `src/cli.ts`
- Pre-commit: `bun test && npm run build`

---

### Task 4: Create DEVELOPMENT.md

**What to do**:
- Create DEVELOPMENT.md with these sections:
  - Prerequisites (Node.js, Bun, Git)
  - Initial Setup (clone, install, build)
  - Development Workflow (dev mode, watch)
  - Testing (run tests, coverage, write tests)
  - Debugging tips
  - Project Structure overview
  - Common Issues (troubleshooting)
- Keep under 500 lines
- Use existing docs as style reference

**Must NOT do**:
- Rewrite existing documentation files
- Add detailed API documentation (that's separate)
- Include deployment instructions (out of scope)
- Document Agent UI or Electron setup

**Recommended Agent Profile**:
- **Category**: `writing`
  - Reason: Documentation task, needs clear technical writing
- **Skills**: [`git-master`]
  - `git-master`: Commit the new file
- **Skills Evaluated but Omitted**:
  - `frontend-ui-ux`: Not a design task
  - `playwright`: No testing needed

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 1 (with Tasks 1, 5)
- **Blocks**: None
- **Blocked By**: None (can start immediately)

**References**:

**Pattern References** (existing docs style):
- `docs/guides/GETTING_STARTED.md` - Follow heading structure and formatting
- `README.md` - Follow code block style and command formatting

**Structure References**:
- `package.json:10-21` - Available npm scripts
- `tsconfig.json` - TypeScript configuration
- `src/` directory - Source code location

**Documentation References**:
- Best practices: https://www.writethedocs.org/guide/writing/beginners-guide-to-docs/

**Acceptance Criteria**:

```bash
# File exists
test -f DEVELOPMENT.md && echo "exists"
# Assert: Output is "exists"

# Required sections present
grep -q "## Prerequisites" DEVELOPMENT.md && \
grep -q "## Setup" DEVELOPMENT.md && \
grep -q "## Testing" DEVELOPMENT.md && \
grep -q "## Project Structure" DEVELOPMENT.md && \
echo "all sections present"
# Assert: Output is "all sections present"

# Under 500 lines
wc -l < DEVELOPMENT.md
# Assert: Line count < 500

# Contains actual commands (not just placeholders)
grep -cE "^(npm|bun|git|cd)" DEVELOPMENT.md
# Assert: >= 5 command examples

# Valid markdown (no broken links in same file)
grep -oE '\[.*\]\(#[^)]+\)' DEVELOPMENT.md | while read link; do
  anchor=$(echo "$link" | sed 's/.*#\([^)]*\).*/\1/')
  grep -qi "## .*$anchor" DEVELOPMENT.md || echo "broken: $link"
done
# Assert: No "broken:" output
```

**Evidence to Capture**:
- [ ] Section headings list
- [ ] Line count

**Commit**: YES
- Message: `docs: add DEVELOPMENT.md with setup and testing instructions`
- Files: `DEVELOPMENT.md`
- Pre-commit: None (documentation only)

---

### Task 5: Create CONTRIBUTING.md

**What to do**:
- Create CONTRIBUTING.md with these sections:
  - Welcome & overview
  - Code of Conduct reference
  - How to Contribute (issues, PRs)
  - Development Setup (link to DEVELOPMENT.md)
  - Pull Request Process
  - Code Standards (formatting, naming)
  - Testing Requirements
  - Commit Message Convention
  - Review Process
- Keep under 500 lines
- Reference existing planning docs where appropriate

**Must NOT do**:
- Create a separate CODE_OF_CONDUCT.md
- Add issue/PR templates (out of scope)
- Rewrite existing documentation
- Include CI/CD instructions

**Recommended Agent Profile**:
- **Category**: `writing`
  - Reason: Documentation task requiring clear process writing
- **Skills**: [`git-master`]
  - `git-master`: Commit the new file
- **Skills Evaluated but Omitted**:
  - `frontend-ui-ux`: Not a design task
  - `playwright`: No testing needed

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 1 (with Tasks 1, 4)
- **Blocks**: None
- **Blocked By**: None (can start immediately)

**References**:

**Pattern References** (existing docs style):
- `docs/guides/GETTING_STARTED.md` - Heading and formatting style
- `README.md:374-404` - Contributing section to expand

**Planning References** (roadmap context):
- `docs/planning/KICKOFF_PROJECT.md` - Project roadmap context
- `docs/planning/TASK_TEMPLATES.md` - Task creation patterns

**Documentation References**:
- GitHub guide: https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors

**Acceptance Criteria**:

```bash
# File exists
test -f CONTRIBUTING.md && echo "exists"
# Assert: Output is "exists"

# Required sections present
grep -q "## How to Contribute" CONTRIBUTING.md && \
grep -q "## Pull Request" CONTRIBUTING.md && \
grep -q "## Code Standards" CONTRIBUTING.md && \
grep -q "## Testing" CONTRIBUTING.md && \
echo "all sections present"
# Assert: Output is "all sections present"

# Under 500 lines
wc -l < CONTRIBUTING.md
# Assert: Line count < 500

# Links to DEVELOPMENT.md
grep -q "DEVELOPMENT.md" CONTRIBUTING.md
# Assert: Returns 0 (link exists)

# Contains commit convention
grep -qiE "(conventional|commit.*message|feat|fix|chore)" CONTRIBUTING.md
# Assert: Returns 0 (mentions commit convention)
```

**Evidence to Capture**:
- [ ] Section headings list
- [ ] Line count

**Commit**: YES
- Message: `docs: add CONTRIBUTING.md with PR process and code standards`
- Files: `CONTRIBUTING.md`
- Pre-commit: None (documentation only)

---

### Task 6: Build Interactive Tutorial (`cs tutorial`)

**What to do**:
- Add `cs tutorial` command to CLI
- Create 3 interactive lessons:
  1. **Tasks**: Create, list, show tasks
  2. **Agents**: Create agents, understand capabilities
  3. **Convoys**: Group tasks, track progress
- Use isolated sandbox directory (`.createsuite-tutorial/`)
- Handle Ctrl+C gracefully with cleanup
- Detect non-TTY and exit with helpful message
- Each lesson: intro -> guided steps -> summary
- Max 8 steps per lesson, < 10 minutes each

**Must NOT do**:
- Include Providers lesson (deferred)
- Include Agent UI lesson (deferred)
- Add branching paths or conditional logic
- Modify user's actual `.createsuite/` workspace
- Require AI providers to be configured

**Recommended Agent Profile**:
- **Category**: `deep`
  - Reason: Complex feature requiring careful design, multiple files, edge case handling
- **Skills**: [`git-master`]
  - `git-master`: Commit tutorial implementation
- **Skills Evaluated but Omitted**:
  - `frontend-ui-ux`: CLI not UI (though inquirer prompts need good UX)
  - `playwright`: Not browser-based

**Parallelization**:
- **Can Run In Parallel**: NO
- **Parallel Group**: Wave 3 (final)
- **Blocks**: None (final task)
- **Blocked By**: Tasks 2, 3 (needs tested foundation, validated CLI)

**References**:

**Pattern References** (existing CLI patterns):
- `src/cli.ts:33-87` - `init` command - good example of multi-step command
- `src/cli.ts:63-71` - Inquirer prompt pattern
- `src/entrypoint.ts:50-150` - Interactive onboarding wizard pattern

**Type References**:
- `src/types.ts:Task` - Task structure to explain in lesson
- `src/types.ts:Agent` - Agent structure to explain in lesson
- `src/types.ts:Convoy` - Convoy structure to explain in lesson

**API References** (managers to use in tutorial):
- `src/taskManager.ts` - TaskManager methods tutorial will call
- `src/agentOrchestrator.ts` - AgentOrchestrator methods tutorial will call
- `src/convoyManager.ts` - ConvoyManager methods tutorial will call

**Documentation References** (concepts to explain):
- `docs/guides/GETTING_STARTED.md` - Existing explanations to adapt
- `AGENTS.md:Task Lifecycle` - Task state diagram to reference
- `AGENTS.md:Agent States` - Agent state explanations

**Tutorial Structure Reference**:
```typescript
// Recommended lesson structure
interface Lesson {
  name: string;
  description: string;
  steps: Step[];
}

interface Step {
  instruction: string;
  action: () => Promise<void>;
  verification: () => Promise<boolean>;
}
```

**Acceptance Criteria**:

```bash
# Tutorial command exists
cs tutorial --help 2>&1 | grep -i "interactive"
# Assert: Help text describes interactive tutorial

# Tutorial uses sandbox (not real workspace)
cs tutorial --dry-run 2>&1 | grep -i "tutorial"
# Or check the code:
grep -q "createsuite-tutorial" src/cli.ts || grep -q "createsuite-tutorial" src/tutorial.ts
# Assert: Returns 0 (sandbox path is used)

# All 3 lessons exist
grep -cE "(lesson|Lesson)" src/tutorial.ts 2>/dev/null || grep -cE "(lesson|Lesson)" src/cli.ts
# Assert: >= 3 lessons defined

# Ctrl+C handler exists
grep -qE "(SIGINT|process\.on.*interrupt)" src/tutorial.ts 2>/dev/null || grep -qE "(SIGINT|process\.on.*interrupt)" src/cli.ts
# Assert: Returns 0 (interrupt handler exists)

# Non-TTY detection exists
grep -qE "(isTTY|isatty|process\.stdout\.isTTY)" src/tutorial.ts 2>/dev/null || grep -qE "(isTTY|isatty|process\.stdout\.isTTY)" src/cli.ts
# Assert: Returns 0 (TTY check exists)

# Tutorial completes without error (auto mode for testing)
# Create temp dir, run tutorial, verify cleanup
TEMP_TUTORIAL=$(mktemp -d)
cd "$TEMP_TUTORIAL"
cs tutorial --auto 2>&1 | tail -5
# Assert: Output shows completion message, no errors

# Sandbox is cleaned up
ls -la .createsuite-tutorial 2>&1 | grep -q "No such file"
# Assert: Sandbox directory is removed
```

**Evidence to Capture**:
- [ ] `cs tutorial --help` output
- [ ] Lesson completion output (auto mode)
- [ ] Sandbox cleanup verification

**Commit**: YES
- Message: `feat(cli): add interactive tutorial with 3 lessons`
- Files: `src/cli.ts`, `src/tutorial.ts` (if separate file)
- Pre-commit: `bun test && npm run build`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `chore: setup Bun Test infrastructure` | package.json, src/__tests__/example.test.ts | `bun test` |
| 2 | `test(core): add unit tests for core modules` | src/__tests__/*.test.ts | `bun test --coverage` |
| 3 | `fix(cli): add input validation and improve error messages` | src/cli.ts | `bun test && npm run build` |
| 4 | `docs: add DEVELOPMENT.md` | DEVELOPMENT.md | (manual review) |
| 5 | `docs: add CONTRIBUTING.md` | CONTRIBUTING.md | (manual review) |
| 6 | `feat(cli): add interactive tutorial` | src/cli.ts, src/tutorial.ts | `bun test && cs tutorial --auto` |

---

## Success Criteria

### Verification Commands

```bash
# Test infrastructure works
bun test
# Expected: All tests pass, >= 70% coverage on core modules

# Tutorial works
cs tutorial --auto
# Expected: All 3 lessons complete, sandbox cleaned up

# CLI validation works
cs task create
# Expected: Error message with title required + usage example

# Documentation exists
cat DEVELOPMENT.md | head -20
cat CONTRIBUTING.md | head -20
# Expected: Both files have proper sections
```

### Final Checklist
- [ ] All "Must Have" items present
- [ ] All "Must NOT Have" items absent
- [ ] All tests pass
- [ ] Tutorial completes without error
- [ ] Documentation files exist with required sections
- [ ] CLI shows helpful error messages
