# Draft: Developer Onboarding Improvements

## Requirements (confirmed)

### Primary Focus
- **Approach**: Balanced - Mix of tests + docs + polish in parallel
- **Rationale**: More comprehensive, quality over speed

### Target Audience
- **Primary**: New Users (people learning to USE CreateSuite)
- **Focus**: Tutorials, examples, getting started experience
- **Note**: Contributors are secondary but still important

### Timeline
- **Constraint**: Ongoing / No Rush
- **Philosophy**: Thorough planning, quality over speed

## Analysis Findings

### Current State
| Area | Score | Status |
|------|-------|--------|
| Documentation | 8/10 | Comprehensive but gaps for contributors |
| Code Structure | 8/10 | Well-organized, modular |
| CLI Completeness | 7/10 | Functionally complete, needs UX polish |
| Test Coverage | 0/10 | CRITICAL: Zero unit tests |
| Developer Onboarding | 6.5/10 | Ready for users, not contributors |

### Critical Gaps Identified
1. Zero unit tests (0% coverage, target 70%)
2. No test framework configured (Jest/Vitest needed)
3. No CI/CD pipeline
4. No DEVELOPMENT.md (dev setup guide)
5. No CONTRIBUTING.md
6. No API documentation

### Important Gaps
1. CLI input validation missing
2. Generic error messages
3. No architecture diagrams
4. No TROUBLESHOOTING.md
5. No command aliases
6. Missing help examples

### Recent Work (19 unpushed commits)
- Agent UI modernization (90s command center)
- Electron desktop app
- Toolbench system
- 16 tasks + 3 convoys created
- Wave 1 foundation complete

## Technical Decisions
- **Test Framework**: Bun Test (native, fast, zero config)
- **Onboarding Format**: Interactive Tutorial (`cs tutorial` command)
- **Primary Pain Point**: Understanding Concepts (tasks, agents, convoys mental model)

## Key Insight: Conceptual Clarity
User's main observation: People struggle with the mental model
- What is a task vs convoy vs agent?
- When to use each?
- How do they relate?

This suggests we need:
1. Clear conceptual explainers (not just API docs)
2. Interactive "learn by doing" tutorial
3. Visual diagrams showing relationships
4. Real-world analogies

## Additional Decisions

### CI/CD
- **Decision**: Skip for now
- **Rationale**: Focus on local testing first, CI/CD can come later

### Tutorial Scope
- **Decision**: Full Walkthrough (30+ minutes)
- **Coverage**: Tasks + Agents + Convoys + Providers + UI
- **Format**: Interactive `cs tutorial` command

## Scope Boundaries

### IN SCOPE
1. **Test Infrastructure** - Bun Test setup, core module tests
2. **Documentation** - DEVELOPMENT.md, CONTRIBUTING.md, API docs
3. **CLI Polish** - Input validation, error messages, help examples
4. **Interactive Tutorial** - `cs tutorial` command with full walkthrough
5. **Conceptual Clarity** - Diagrams, analogies, mental model explainers
6. **Onboarding Flow** - Improved getting started experience

### OUT OF SCOPE (for this plan)
- CI/CD automation (deferred)
- Agent UI (Electron) in tutorial v1
- E2E tests in initial testing phase
- Refactoring production code for testability
- New CLI commands (beyond `cs tutorial`)

---

## Metis Gap Analysis Findings

### Critical Finding: Test Framework
- **Issue**: Bun was not installed (project uses npm/ts-node)
- **Resolution**: Install Bun first, then use Bun Test
- **Rationale**: User prefers Bun for modern, fast testing

### Scope Revision: Tutorial
- **Issue**: "Full Walkthrough (30+ min)" flagged as scope creep risk
- **Resolution**: 3-Lesson MVP (~15 min total)
- **Lessons**: Tasks, Agents, Convoys only
- **Deferred**: Providers, UI to future iteration

### Guardrails (from Metis)

**Tutorial Guardrails:**
- Maximum 3 lessons in v1
- Maximum 8 steps per lesson
- Each lesson < 10 minutes
- Must work WITHOUT providers configured
- Must run in isolated sandbox (`.createsuite-tutorial/`)
- Graceful Ctrl+C handling with resume option

**Testing Guardrails:**
- Target 70% LINE coverage (not branch)
- Test only 6 core modules first: taskManager, agentOrchestrator, convoyManager, gitIntegration, config, types
- All tests must run in < 30 seconds
- Use temp directories for filesystem tests

**CLI UX Guardrails:**
- Only improve existing commands
- Only add validation for: task create, agent create, convoy create
- Error messages must include: what went wrong + how to fix
- No new flags or commands (except `cs tutorial`)

**Documentation Guardrails:**
- Create exactly: DEVELOPMENT.md, CONTRIBUTING.md
- API docs: only public exports from src/index.ts
- Keep each doc under 500 lines

### Edge Cases to Handle
1. Tutorial: Ctrl+C mid-tutorial → Graceful cleanup + resume option
2. Tutorial: Use isolated `.createsuite-tutorial/` sandbox
3. Tutorial: Detect non-TTY → Exit with helpful message
4. Testing: Use temp directories → Cleanup in afterEach
5. CLI: Non-interactive mode → Detect and exit gracefully
