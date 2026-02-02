# Agent Team UX: First-Time Wow Experience

## TL;DR

> **Quick Summary**: Transform CreateSuite into the easiest way for small teams (2-5 people) to use AI coding agents by creating a compelling "first-time wow" demo experience with unified storage, progressive concept disclosure, and smart routing.
> 
> **Deliverables**:
> - The "60-second demo script" (storyboard + screenplay)
> - `npx createsuite` one-command onboarding wizard
> - Unified storage (merge .sisyphus into .createsuite)
> - Smart Router (complexity-based workflow selection)
> - PlanManager (bridge Prometheus plans to CreateSuite tasks)
> - `cs ui --demo` instant demo mode
> 
> **Estimated Effort**: Large (multiple work sessions)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 (Demo Script) → Task 3 (Entry Point) → Task 7 (Integration Test)

---

## Context

### Original Request

> "invest your time wisely to plan our next steps. I desire this to be the easiest way to use our agent team, easy for my colleagues to follow and understand, and easy to use for new and existing projects."

### Interview Summary

**Key Discussions**:
- **Primary Audience**: Small teams (2-5 people)
- **System Position**: CreateSuite is THE command center; oh-my-opencode is execution layer
- **Onboarding Vision**: One command setup → guided wizard → ready
- **Priority**: Daily workflow smoothness, but FIRST nail the "first-time wow demo"
- **Interfaces**: Desktop app and CLI have equal weight (both first-class)
- **Routing**: Hybrid - AI suggests complexity level, user can override
- **Storage**: Merge .sisyphus/ into .createsuite/ for single source of truth
- **Concepts**: Progressive disclosure - max 4 core concepts (Plan, Execute, Task, Agent)

**Research Findings**:
- Current system has 20+ CLI commands (cognitive overload)
- Two separate storage systems causing fragmentation
- Desktop app exists with Windows 95 aesthetic and demo mode
- No automatic flow from Prometheus plans to CreateSuite tasks
- 8 AI providers available but overwhelming for onboarding

### Metis Review

**Identified Gaps** (addressed in plan):
1. **Demo script undefined** → Task 1 defines it before any coding
2. **No `cs` zero-args entry** → Task 3 creates the smart entry point
3. **No PlanManager bridge** → Task 4 builds Prometheus → CreateSuite integration
4. **Desktop requires 2 terminals** → Task 5 fixes single-process launch
5. **Too many providers** → Guardrail: Only Claude + OpenAI for v1 onboarding

---

## Work Objectives

### Core Objective

Create a compelling "first-time wow" experience that demonstrates CreateSuite's value within 60 seconds, while establishing the foundation for daily team workflow.

### Concrete Deliverables

1. **Demo Script**: Written screenplay + storyboard for the 60-second wow moment
2. **Entry Point**: `npx createsuite` command that auto-detects and guides
3. **Unified Storage**: .sisyphus merged into .createsuite
4. **PlanManager**: Bridge to convert Prometheus plans to CreateSuite tasks
5. **Smart Router**: Complexity analyzer for workflow routing
6. **Demo Mode**: `cs ui --demo` flag for instant showcase

### Definition of Done

- [x] Running `npx createsuite` in empty folder produces demo experience
- [x] Running `npx createsuite` in existing project auto-detects and configures
- [ ] Team member can describe task and system routes to correct workflow
- [ ] All storage unified under `.createsuite/`
- [ ] Desktop app launches with single command

### Must Have

- 60-second demo script approved before implementation starts
- One-command entry point (`npx createsuite` or `cs`)
- Auto-detection for existing projects (package.json, tsconfig, etc.)
- Desktop app single-process launch
- Provider setup limited to Claude + OpenAI initially

### Must NOT Have (Guardrails)

- **NO** more than 4 core concepts in onboarding (Plan, Execute, Task, Agent)
- **NO** requirement to configure all 8 providers in initial setup
- **NO** separate terminal windows for Desktop app
- **NO** implementation before demo script is approved
- **NO** changes to oh-my-opencode core agent logic
- **NO** new AI capabilities or model integrations
- **NO** removal of existing features (only additions/unification)

---

## Verification Strategy (MANDATORY)

### Test Decision

- **Infrastructure exists**: YES (bun test exists per TESTING_FRAMEWORK.md)
- **User wants tests**: TDD for core logic, manual verification for UX flows
- **Framework**: bun test

### TDD for Core Logic (Tasks 3, 4, 6)

Each logic task follows RED-GREEN-REFACTOR:
1. Write failing test for the behavior
2. Implement minimum code to pass
3. Refactor while keeping green

### Manual UX Verification (Tasks 1, 2, 5, 7)

For UX-focused tasks, verification is via agent-executable procedures:
- Playwright for Desktop app interactions
- Bash commands for CLI flows
- Screenshots captured as evidence

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Write Demo Script (no dependencies, blocks everything)
└── Task 2: Design Unified Storage Schema (research only)

Wave 2 (After Task 1 approved):
├── Task 3: Build Entry Point CLI
├── Task 4: Build PlanManager Bridge
├── Task 5: Fix Desktop Single-Process
└── Task 6: Build Smart Router

Wave 3 (After Wave 2):
└── Task 7: Integration Test - Full Demo Flow
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 3, 4, 5, 6 | 2 |
| 2 | None | 3, 4 | 1 |
| 3 | 1, 2 | 7 | 4, 5, 6 |
| 4 | 1, 2 | 7 | 3, 5, 6 |
| 5 | 1 | 7 | 3, 4, 6 |
| 6 | 1 | 7 | 3, 4, 5 |
| 7 | 3, 4, 5, 6 | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Dispatch |
|------|-------|---------------------|
| 1 | 1, 2 | Both run immediately (parallel) |
| 2 | 3, 4, 5, 6 | All 4 in parallel after Wave 1 |
| 3 | 7 | Sequential (integration test) |

---

## TODOs

### Wave 1: Foundation (Start Immediately)

- [x] 1. Write the "60-Second Demo Script"

  **What to do**:
  - Create a storyboard document showing exactly what user sees at each second
  - Write screenplay with exact CLI commands and expected outputs
  - Define the "wow moment" (when user says "whoa, that's cool")
  - Include both CLI and Desktop app paths
  - Answer: "What does user see 60 seconds after `npx createsuite`?"
  
  **Output format**:
  ```markdown
  # 60-Second Demo Script
  
  ## Scene 1: Entry (0-10 seconds)
  User runs: `npx createsuite`
  They see: [exact output]
  
  ## Scene 2: Setup (10-30 seconds)
  [wizard interactions]
  
  ## Scene 3: Wow Moment (30-45 seconds)
  [the impressive part]
  
  ## Scene 4: First Task (45-60 seconds)
  [user accomplishes something]
  ```

  **Must NOT do**:
  - Do not implement any code
  - Do not design systems
  - Focus ONLY on user experience screenplay

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: This is creative/narrative work - defining the user experience story
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: UX design expertise for compelling user journey

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Tasks 3, 4, 5, 6, 7 (nothing builds until demo script approved)
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References**:
  - `agent-ui/QUICKSTART.md` - Existing 5-minute quick start structure
  - `docs/guides/GETTING_STARTED.md` - Current onboarding flow

  **Context References**:
  - `README.md:30-40` - Video tour section (existing demo pattern)
  - `agent-ui/src/App.tsx:1-50` - Desktop app components available

  **Research References**:
  - User interview answers from this planning session (in draft)
  - Target: Small teams (2-5), first-time wow, 4 max concepts

  **WHY Each Reference Matters**:
  - QUICKSTART.md shows what "quick" means in this project
  - GETTING_STARTED.md shows current user journey to improve upon
  - README video tour shows existing demo thinking to build on
  - App.tsx shows what visual elements are available

  **Acceptance Criteria**:

  **Agent-Executable Verification**:
  - [ ] Document exists at `.sisyphus/demos/60-second-script.md`
  - [ ] Contains all 4 scenes (Entry, Setup, Wow, First Task)
  - [ ] Each scene has exact commands/outputs defined
  - [ ] "Wow moment" is explicitly identified
  - [ ] Both CLI and Desktop paths documented

  ```bash
  # Agent verifies document exists and has required sections:
  test -f .sisyphus/demos/60-second-script.md && \
  grep -q "Scene 1:" .sisyphus/demos/60-second-script.md && \
  grep -q "Scene 2:" .sisyphus/demos/60-second-script.md && \
  grep -q "Scene 3:" .sisyphus/demos/60-second-script.md && \
  grep -q "Scene 4:" .sisyphus/demos/60-second-script.md && \
  grep -q "Wow Moment" .sisyphus/demos/60-second-script.md && \
  echo "PASS: Demo script complete"
  ```

  **Commit**: NO (groups with Task 2 foundation wave)

---

- [x] 2. Design Unified Storage Schema

  **What to do**:
  - Analyze current .sisyphus/ and .createsuite/ structures
  - Design merged schema under .createsuite/
  - Document migration path for existing workspaces
  - Define schema for plans/, drafts/, evidence/
  
  **New unified structure**:
  ```
  .createsuite/
  ├── config.json              # Workspace configuration
  ├── tasks/                   # Task storage (existing)
  ├── agents/                  # Agent state (existing)
  ├── convoys/                 # Convoy groups (existing)
  ├── plans/                   # Work plans (from .sisyphus)
  ├── drafts/                  # Working memory (from .sisyphus)
  ├── notepads/               # Persistent notes (from .sisyphus)
  ├── evidence/               # Verification artifacts (new)
  └── providers.json          # Provider config (existing)
  ```

  **Must NOT do**:
  - Do not implement migration code
  - Do not modify existing files
  - Design only, implementation in Task 4

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Schema design requires careful architectural thinking
  - **Skills**: []
    - No specific skills needed; pure architecture task

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Tasks 3, 4
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References**:
  - `src/config.ts:1-100` - Current ConfigManager patterns
  - `src/types.ts:1-111` - Existing type definitions

  **Structure References**:
  - `.createsuite/` directory - Current task/agent/convoy structure
  - `.sisyphus/` directory - Current plans/drafts/notepads structure

  **WHY Each Reference Matters**:
  - config.ts shows how persistence is currently handled
  - types.ts shows existing data models to extend
  - Both directories show what needs to be merged

  **Acceptance Criteria**:

  **Agent-Executable Verification**:
  - [ ] Schema document exists at `.sisyphus/designs/unified-storage-schema.md`
  - [ ] Document includes complete directory structure
  - [ ] Migration path documented for existing .sisyphus content
  - [ ] JSON schemas defined for new entities

  ```bash
  # Agent verifies design document:
  test -f .sisyphus/designs/unified-storage-schema.md && \
  grep -q "plans/" .sisyphus/designs/unified-storage-schema.md && \
  grep -q "drafts/" .sisyphus/designs/unified-storage-schema.md && \
  grep -q "migration" .sisyphus/designs/unified-storage-schema.md && \
  echo "PASS: Storage schema complete"
  ```

  **Commit**: YES
  - Message: `docs(architecture): design unified storage schema`
  - Files: `.sisyphus/designs/unified-storage-schema.md`
  - Pre-commit: None (documentation only)

---

### Wave 2: Implementation (After Task 1 Approved)

- [x] 3. Build Entry Point CLI (`npx createsuite`)

  **What to do**:
  - Create `bin/createsuite.js` as npm package entry point
  - Implement zero-args smart detection:
    - If no .createsuite/ → Run onboarding wizard
    - If .createsuite/ exists → Show status + offer actions
    - If --demo flag → Launch demo mode
  - Integrate with existing `cs` CLI as fallback
  - Add to package.json bin field
  
  **Smart detection logic**:
  ```typescript
  // Detect project type
  const hasPackageJson = await exists('package.json');
  const hasTsConfig = await exists('tsconfig.json');
  const hasCreatesuite = await exists('.createsuite');
  
  if (!hasCreatesuite) {
    // First time - run wizard
    await runOnboardingWizard({ hasPackageJson, hasTsConfig });
  } else {
    // Existing - show status
    await showStatusAndOfferActions();
  }
  ```

  **Must NOT do**:
  - Do not implement the wizard content (Task 3 part 2)
  - Do not add new dependencies beyond what's needed
  - Keep to the demo script's Scene 1-2 requirements

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single-file CLI entry point, straightforward logic
  - **Skills**: []
    - No specific skills needed; standard TypeScript/Node work

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5, 6)
  - **Blocks**: Task 7
  - **Blocked By**: Tasks 1, 2

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References**:
  - `src/cli.ts:1-50` - Existing CLI structure with Commander.js
  - `src/providerManager.ts:94-290` - Interactive wizard pattern

  **NPM References**:
  - `package.json:bin` field - Current CLI registration

  **Demo Script Reference**:
  - `.sisyphus/demos/60-second-script.md` - Scene 1-2 requirements

  **WHY Each Reference Matters**:
  - cli.ts shows the existing command structure to integrate with
  - providerManager.ts shows how to build interactive wizards
  - Demo script defines EXACTLY what this CLI must produce

  **Acceptance Criteria**:

  **TDD Test Cases**:
  - [ ] Test: `npx createsuite` with no .createsuite runs wizard
  - [ ] Test: `npx createsuite` with existing .createsuite shows status
  - [ ] Test: `npx createsuite --demo` launches demo mode

  **Agent-Executable Verification**:
  ```bash
  # Test 1: Entry point exists and is executable
  test -f bin/createsuite.js && echo "PASS: Entry point exists"
  
  # Test 2: Package.json has bin field
  bun -e "const p = require('./package.json'); console.log(p.bin?.createsuite ? 'PASS' : 'FAIL')"
  
  # Test 3: Run unit tests
  bun test src/__tests__/entrypoint.test.ts
  # Expected: All tests pass
  ```

  **Commit**: YES
  - Message: `feat(cli): add npx createsuite entry point with smart detection`
  - Files: `bin/createsuite.js`, `src/entrypoint.ts`, `src/__tests__/entrypoint.test.ts`, `package.json`
  - Pre-commit: `bun test src/__tests__/entrypoint.test.ts`

---

- [x] 4. Build PlanManager Bridge

  **What to do**:
  - Create `src/planManager.ts` to manage plans in unified storage
  - Implement CRUD operations for plans
  - Add conversion: Prometheus plan → CreateSuite tasks
  - Register with ConfigManager for persistence
  
  **Core interface**:
  ```typescript
  interface PlanManager {
    createPlan(name: string, content: string): Promise<Plan>;
    loadPlan(name: string): Promise<Plan>;
    listPlans(): Promise<Plan[]>;
    convertToTasks(plan: Plan): Promise<Task[]>;  // Key bridge function
    deletePlan(name: string): Promise<void>;
  }
  ```

  **Must NOT do**:
  - Do not modify Prometheus's plan format
  - Do not change how oh-my-opencode generates plans
  - Bridge only, no changes to source systems

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Core integration logic, needs careful implementation
  - **Skills**: []
    - No specific skills needed; TypeScript module development

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 5, 6)
  - **Blocks**: Task 7
  - **Blocked By**: Tasks 1, 2

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References**:
  - `src/taskManager.ts` - Task CRUD pattern to follow
  - `src/config.ts:ConfigManager` - Persistence pattern

  **Type References**:
  - `src/types.ts:Task` - Task interface to create from plans
  - `.sisyphus/plans/*.md` - Plan format to parse

  **Design Reference**:
  - `.sisyphus/designs/unified-storage-schema.md` - Storage location

  **WHY Each Reference Matters**:
  - taskManager.ts is the model for how PlanManager should work
  - config.ts shows persistence integration
  - Plan files show the markdown format to parse

  **Acceptance Criteria**:

  **TDD Test Cases**:
  - [ ] Test: createPlan saves to .createsuite/plans/
  - [ ] Test: loadPlan reads and parses plan markdown
  - [ ] Test: convertToTasks extracts TODOs as Task objects
  - [ ] Test: listPlans returns all plans in directory

  **Agent-Executable Verification**:
  ```bash
  # Run unit tests
  bun test src/__tests__/planManager.test.ts
  # Expected: All tests pass
  
  # Verify module exports
  bun -e "import { PlanManager } from './src/planManager'; console.log(typeof PlanManager === 'function' ? 'PASS' : 'FAIL')"
  ```

  **Commit**: YES
  - Message: `feat(core): add PlanManager to bridge Prometheus plans to tasks`
  - Files: `src/planManager.ts`, `src/__tests__/planManager.test.ts`, `src/types.ts`, `src/index.ts`
  - Pre-commit: `bun test src/__tests__/planManager.test.ts`

---

- [x] 5. Fix Desktop App Single-Process Launch

  **What to do**:
  - Modify `cs ui` command to use electron:dev pattern
  - Ensure Electron main.js embeds server (already does)
  - Update QUICKSTART.md to reflect single command
  - Add `--demo` flag support to launch with demo=true
  
  **Implementation**:
  ```typescript
  // In cli.ts, update 'ui' command:
  program
    .command('ui')
    .option('--demo', 'Launch in demo mode with pre-configured agents')
    .action(async (options) => {
      const demoFlag = options.demo ? '?demo=true' : '';
      // Launch Electron directly, not separate dev servers
      execSync(`npm run electron:dev`, { 
        cwd: path.join(__dirname, '../agent-ui'),
        stdio: 'inherit',
        env: { ...process.env, DEMO_MODE: options.demo ? 'true' : '' }
      });
    });
  ```

  **Must NOT do**:
  - Do not change Windows 95 aesthetic
  - Do not modify core app functionality
  - Only fix the launch mechanism

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small CLI change, straightforward shell integration
  - **Skills**: []
    - No specific skills needed; shell scripting

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4, 6)
  - **Blocks**: Task 7
  - **Blocked By**: Task 1

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References**:
  - `src/cli.ts:ui command` - Current ui command to modify
  - `agent-ui/electron/main.js` - Electron main process (has embedded server)

  **Script References**:
  - `agent-ui/package.json:scripts.electron:dev` - Working single-process command

  **WHY Each Reference Matters**:
  - cli.ts ui command is what we're modifying
  - main.js shows the server is already embedded (just need to use it)
  - package.json shows the correct script to invoke

  **Acceptance Criteria**:

  **Agent-Executable Verification**:
  ```bash
  # Test 1: cs ui command accepts --demo flag
  node dist/cli.js ui --help | grep -q "\-\-demo" && echo "PASS: Demo flag exists"
  
  # Test 2: Verify electron:dev script exists in agent-ui
  grep -q "electron:dev" agent-ui/package.json && echo "PASS: Script exists"
  ```
  
  **Playwright Verification** (after build):
  ```
  # Agent uses playwright skill:
  1. Run: cs ui --demo
  2. Wait for: Electron window to appear (10s timeout)
  3. Assert: Window title contains "CreateSuite" or "Agent"
  4. Assert: Demo agents visible in Agent Village
  5. Screenshot: .sisyphus/evidence/task-5-desktop-launch.png
  6. Close Electron app
  ```

  **Commit**: YES
  - Message: `fix(cli): make cs ui launch single-process Electron with --demo flag`
  - Files: `src/cli.ts`, `agent-ui/QUICKSTART.md`
  - Pre-commit: `bun run build && node dist/cli.js ui --help | grep demo`

---

- [x] 6. Build Smart Router (Complexity Analyzer)

  **What to do**:
  - Create `src/smartRouter.ts` module
  - Implement complexity analysis for user input
  - Return recommended workflow: trivial/simple/complex/team
  - Allow user override via explicit flags
  
  **Routing logic**:
  ```typescript
  type WorkflowType = 'trivial' | 'simple' | 'complex' | 'team';
  
  interface RouterResult {
    recommended: WorkflowType;
    confidence: number;
    reasoning: string;
    override?: WorkflowType;  // User's explicit choice
  }
  
  function analyzeComplexity(input: string): RouterResult {
    // Heuristics:
    // - Single file mentioned → trivial
    // - "fix", "typo", "rename" → trivial
    // - "add", "implement", "create" → simple or complex
    // - Multiple components → complex
    // - "team", "sprint", "coordinate" → team
  }
  ```

  **Must NOT do**:
  - Do not use AI for classification (keep it fast/local)
  - Do not block on external services
  - Simple heuristics, not ML

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Pattern matching logic, not complex
  - **Skills**: []
    - No specific skills needed; algorithm implementation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4, 5)
  - **Blocks**: Task 7
  - **Blocked By**: Task 1

  **References** (CRITICAL - Be Exhaustive):

  **Concept References**:
  - `.sisyphus/drafts/agent-team-ux.md` - Progressive disclosure model
  
  **Pattern References**:
  - User interview: "Hybrid with override" routing decision

  **WHY Each Reference Matters**:
  - Draft contains the 4-level complexity model to implement
  - User chose hybrid approach - AI suggests, user overrides

  **Acceptance Criteria**:

  **TDD Test Cases**:
  - [ ] Test: "fix typo in login.ts" → trivial
  - [ ] Test: "add dark mode" → simple
  - [ ] Test: "refactor authentication system" → complex
  - [ ] Test: "coordinate sprint tasks" → team
  - [ ] Test: "--workflow=complex" overrides analysis

  **Agent-Executable Verification**:
  ```bash
  # Run unit tests
  bun test src/__tests__/smartRouter.test.ts
  # Expected: All 5 test cases pass
  ```

  **Commit**: YES
  - Message: `feat(core): add SmartRouter for complexity-based workflow selection`
  - Files: `src/smartRouter.ts`, `src/__tests__/smartRouter.test.ts`
  - Pre-commit: `bun test src/__tests__/smartRouter.test.ts`

---

### Wave 3: Integration (After Wave 2)

- [x] 7. Integration Test - Full Demo Flow

  **What to do**:
  - Execute the 60-second demo script end-to-end
  - Verify all components work together
  - Capture evidence (screenshots, terminal output)
  - Document any gaps between script and reality
  - Create quick-fix list if needed
  
  **Test scenarios**:
  1. Fresh folder: `npx createsuite` → wizard → status
  2. Existing project: `npx createsuite` → auto-detect → configure
  3. Demo mode: `cs ui --demo` → Desktop with agents
  4. Smart routing: Input task → correct workflow selected
  5. Plan bridge: Prometheus plan → CreateSuite tasks

  **Must NOT do**:
  - Do not implement new features
  - Do not fix bugs in this task (create issues instead)
  - Verify only, document gaps

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Requires browser automation, screenshot capture, UX verification
  - **Skills**: [`playwright`, `frontend-ui-ux`]
    - `playwright`: Browser automation for Desktop app testing
    - `frontend-ui-ux`: UX quality assessment

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (final, sequential)
  - **Blocks**: None (final task)
  - **Blocked By**: Tasks 3, 4, 5, 6

  **References** (CRITICAL - Be Exhaustive):

  **Script Reference**:
  - `.sisyphus/demos/60-second-script.md` - THE source of truth for what to test

  **Component References**:
  - `bin/createsuite.js` - Entry point (Task 3)
  - `src/planManager.ts` - Plan bridge (Task 4)
  - `src/cli.ts:ui` - Desktop launch (Task 5)
  - `src/smartRouter.ts` - Complexity router (Task 6)

  **WHY Each Reference Matters**:
  - Demo script is exactly what we're testing
  - Component files are what we're verifying work together

  **Acceptance Criteria**:

  **Playwright Verification**:
  ```
  # Full demo flow via playwright skill:
  
  ## Scenario 1: Fresh folder
  1. Create temp directory
  2. Run: npx createsuite
  3. Assert: Wizard prompts appear
  4. Screenshot: .sisyphus/evidence/task-7-fresh-wizard.png
  
  ## Scenario 2: Demo mode
  1. Run: cs ui --demo
  2. Wait: Electron window (10s)
  3. Assert: Agent Village shows 5 agents
  4. Screenshot: .sisyphus/evidence/task-7-demo-agents.png
  
  ## Scenario 3: Smart routing
  1. Input: "fix typo in login.ts"
  2. Assert: Router returns "trivial"
  3. Input: "refactor auth"
  4. Assert: Router returns "complex"
  ```

  **Evidence to Capture**:
  - [ ] Screenshots in `.sisyphus/evidence/task-7-*.png`
  - [ ] Terminal outputs in `.sisyphus/evidence/task-7-logs.txt`
  - [ ] Gap report in `.sisyphus/evidence/task-7-gaps.md`

  **Commit**: YES
  - Message: `test: add integration tests for 60-second demo flow`
  - Files: `src/__tests__/integration/demo-flow.test.ts`, `.sisyphus/evidence/*`
  - Pre-commit: `bun test src/__tests__/integration/`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 2 | `docs(architecture): design unified storage schema` | `.sisyphus/designs/` | None |
| 3 | `feat(cli): add npx createsuite entry point` | `bin/`, `src/entrypoint.ts`, `package.json` | `bun test` |
| 4 | `feat(core): add PlanManager bridge` | `src/planManager.ts` | `bun test` |
| 5 | `fix(cli): make cs ui single-process with --demo` | `src/cli.ts` | `bun run build` |
| 6 | `feat(core): add SmartRouter` | `src/smartRouter.ts` | `bun test` |
| 7 | `test: add integration tests for demo flow` | `src/__tests__/integration/` | `bun test` |

---

## Success Criteria

### Verification Commands

```bash
# All tests pass
bun test
# Expected: 0 failures

# Entry point works
npx createsuite --help
# Expected: Shows help with wizard, status, demo options

# Desktop launches
cs ui --demo
# Expected: Electron window with 5 demo agents

# Smart routing works
node -e "const r = require('./dist/smartRouter'); console.log(r.analyzeComplexity('fix typo').recommended)"
# Expected: "trivial"
```

### Final Checklist

- [ ] All "Must Have" features implemented and working
- [x] All "Must NOT Have" guardrails respected
- [ ] Demo script can be executed end-to-end in 60 seconds
- [ ] All tests pass
- [x] Evidence captured for all scenarios
- [ ] Team member can run `npx createsuite` and be productive
