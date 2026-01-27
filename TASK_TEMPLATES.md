# CreateSuite Task Templates

This file contains templates for common task types in the CreateSuite professional polish project. Use these templates when creating tasks with `cs task create`.

---

## Template: Unit Test Task

**Title:** Write unit tests for [ComponentName]

**Description:**
Create comprehensive unit tests for the [ComponentName] component.

**Acceptance Criteria:**
- [ ] Test all public methods
- [ ] Test error handling paths
- [ ] Test edge cases
- [ ] Achieve >80% code coverage for this component
- [ ] Tests pass in CI/CD pipeline
- [ ] Mock external dependencies appropriately

**Priority:** high

**Tags:** testing, unit-test, phase-1

**Example Command:**
```bash
cs task create \
  --title "Write unit tests for TaskManager" \
  --description "Create comprehensive unit tests for the TaskManager component" \
  --priority high \
  --tags "testing,unit-test,phase-1"
```

---

## Template: Documentation Task

**Title:** Create [DocumentName].md

**Description:**
Write comprehensive documentation for [Topic].

**Acceptance Criteria:**
- [ ] Document includes clear purpose/overview
- [ ] All features are documented with examples
- [ ] Troubleshooting section included
- [ ] Cross-references to related docs
- [ ] Code examples are tested and working
- [ ] Formatting is consistent with other docs
- [ ] Reviewed by at least one team member

**Priority:** medium

**Tags:** documentation, writing, phase-2

**Example Command:**
```bash
cs task create \
  --title "Create QUICKSTART.md" \
  --description "Write 5-minute quick start guide for new users" \
  --priority high \
  --tags "documentation,writing,phase-2"
```

---

## Template: Feature Implementation Task

**Title:** Implement [FeatureName]

**Description:**
Implement the [FeatureName] feature as described in the specification.

**Acceptance Criteria:**
- [ ] Feature works as specified
- [ ] Unit tests written (>80% coverage)
- [ ] Integration tests added
- [ ] Documentation updated
- [ ] CLI help text updated
- [ ] Error handling implemented
- [ ] Code reviewed and approved
- [ ] Works on all supported platforms

**Priority:** high

**Tags:** feature, implementation, phase-6

**Example Command:**
```bash
cs task create \
  --title "Implement smart task assignment" \
  --description "Add automatic task assignment based on agent capabilities" \
  --priority high \
  --tags "feature,implementation,phase-6"
```

---

## Template: Bug Fix Task

**Title:** Fix: [BugDescription]

**Description:**
**Bug:** [Brief description of the bug]

**Steps to Reproduce:**
1. Step 1
2. Step 2
3. Step 3

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Acceptance Criteria:**
- [ ] Bug is fixed and verified
- [ ] Test added to prevent regression
- [ ] Root cause documented
- [ ] Related bugs checked and fixed
- [ ] Fix verified on all platforms

**Priority:** critical

**Tags:** bug, bug-fix, urgent

**Example Command:**
```bash
cs task create \
  --title "Fix: Task creation fails with special characters" \
  --description "Task creation command crashes when title contains quotes" \
  --priority critical \
  --tags "bug,bug-fix,urgent"
```

---

## Template: Refactoring Task

**Title:** Refactor [ComponentName] for [Reason]

**Description:**
Refactor [ComponentName] to improve [maintainability/performance/readability].

**Acceptance Criteria:**
- [ ] Code is cleaner and more maintainable
- [ ] All existing tests still pass
- [ ] No functional changes (behavior unchanged)
- [ ] Performance improved or maintained
- [ ] Documentation updated if needed
- [ ] Code reviewed

**Priority:** medium

**Tags:** refactoring, code-quality, phase-3

**Example Command:**
```bash
cs task create \
  --title "Refactor error handling in CLI commands" \
  --description "Standardize error handling patterns across all CLI commands" \
  --priority medium \
  --tags "refactoring,code-quality,phase-3"
```

---

## Template: Security Task

**Title:** Security: [SecurityIssue]

**Description:**
Address security vulnerability: [Description]

**Severity:** [Critical/High/Medium/Low]

**Vulnerability Details:**
- Package: [affected package]
- CVE: [if applicable]
- Impact: [description of potential impact]

**Acceptance Criteria:**
- [ ] Vulnerability patched
- [ ] npm audit shows no critical/high issues
- [ ] Security scan passes
- [ ] No functionality broken
- [ ] Documentation updated if needed
- [ ] Security team notified

**Priority:** critical

**Tags:** security, vulnerability, phase-7

**Example Command:**
```bash
cs task create \
  --title "Security: Update vulnerable dependency" \
  --description "Update package X to fix CVE-2024-XXXXX" \
  --priority critical \
  --tags "security,vulnerability,phase-7"
```

---

## Template: Performance Optimization Task

**Title:** Optimize [Operation/Component] performance

**Description:**
Improve performance of [operation] to meet target metrics.

**Current Performance:**
- Metric 1: [current value]
- Metric 2: [current value]

**Target Performance:**
- Metric 1: [target value]
- Metric 2: [target value]

**Acceptance Criteria:**
- [ ] Performance targets met
- [ ] Benchmarks added to CI
- [ ] No functionality broken
- [ ] Memory usage checked
- [ ] Tested under load
- [ ] Documentation updated

**Priority:** medium

**Tags:** performance, optimization, phase-8

**Example Command:**
```bash
cs task create \
  --title "Optimize CLI startup time" \
  --description "Reduce CLI startup time from 2s to <500ms" \
  --priority medium \
  --tags "performance,optimization,phase-8"
```

---

## Template: CI/CD Task

**Title:** Set up [CI/CD Feature]

**Description:**
Configure [feature] in the CI/CD pipeline.

**Acceptance Criteria:**
- [ ] Feature configured correctly
- [ ] Works on all branches
- [ ] Tested with sample PR
- [ ] Documentation updated
- [ ] Team trained on usage
- [ ] Monitoring/alerts set up

**Priority:** high

**Tags:** ci-cd, infrastructure, phase-1

**Example Command:**
```bash
cs task create \
  --title "Set up automated testing in CI" \
  --description "Configure GitHub Actions to run tests on every PR" \
  --priority high \
  --tags "ci-cd,infrastructure,phase-1"
```

---

## Template: Provider Integration Task

**Title:** Improve [ProviderName] integration

**Description:**
Enhance [ProviderName] provider integration.

**Acceptance Criteria:**
- [ ] Authentication flow smooth
- [ ] Error handling comprehensive
- [ ] Health checks implemented
- [ ] Documentation updated
- [ ] Tested with real credentials
- [ ] Troubleshooting guide created

**Priority:** high

**Tags:** provider, integration, phase-4

**Example Command:**
```bash
cs task create \
  --title "Improve OpenAI provider authentication" \
  --description "Add automatic token refresh for OpenAI provider" \
  --priority high \
  --tags "provider,integration,phase-4"
```

---

## Template: UX Improvement Task

**Title:** Improve UX for [Feature/Flow]

**Description:**
Enhance user experience for [feature/flow].

**Current UX Issues:**
- Issue 1
- Issue 2
- Issue 3

**Proposed Improvements:**
- Improvement 1
- Improvement 2
- Improvement 3

**Acceptance Criteria:**
- [ ] User testing completed
- [ ] Feedback incorporated
- [ ] Changes feel intuitive
- [ ] Documentation updated
- [ ] Help text updated
- [ ] Accessibility maintained

**Priority:** medium

**Tags:** ux, user-experience, phase-2

**Example Command:**
```bash
cs task create \
  --title "Improve task creation UX" \
  --description "Add interactive wizard for creating tasks" \
  --priority medium \
  --tags "ux,user-experience,phase-2"
```

---

## Quick Task Creation Commands

### Phase 1: Foundation & Testing
```bash
# Testing tasks
cs task create --title "Set up Jest test framework" --priority critical --tags "testing,infrastructure,phase-1"
cs task create --title "Write unit tests for TaskManager" --priority high --tags "testing,unit-test,phase-1"
cs task create --title "Write unit tests for AgentOrchestrator" --priority high --tags "testing,unit-test,phase-1"
cs task create --title "Set up CI/CD pipeline" --priority critical --tags "ci-cd,infrastructure,phase-1"
cs task create --title "Configure test coverage reporting" --priority medium --tags "testing,infrastructure,phase-1"
```

### Phase 2: Documentation
```bash
# Documentation tasks
cs task create --title "Create QUICKSTART.md" --priority critical --tags "documentation,writing,phase-2"
cs task create --title "Create FAQ.md with 20 questions" --priority high --tags "documentation,writing,phase-2"
cs task create --title "Improve CLI error messages" --priority high --tags "ux,documentation,phase-2"
cs task create --title "Create video tutorial: First Agent" --priority medium --tags "documentation,video,phase-2"
cs task create --title "Add troubleshooting guide" --priority medium --tags "documentation,writing,phase-2"
```

### Phase 3: Code Quality
```bash
# Code quality tasks
cs task create --title "Set up ESLint with TypeScript" --priority high --tags "code-quality,tooling,phase-3"
cs task create --title "Configure Prettier" --priority high --tags "code-quality,tooling,phase-3"
cs task create --title "Add pre-commit hooks with Husky" --priority medium --tags "code-quality,tooling,phase-3"
cs task create --title "Add JSDoc to public APIs" --priority medium --tags "documentation,code-quality,phase-3"
cs task create --title "Run security audit and fix issues" --priority critical --tags "security,code-quality,phase-3"
```

### Phase 4: Provider Polish
```bash
# Provider tasks
cs task create --title "Add provider health check command" --priority high --tags "provider,feature,phase-4"
cs task create --title "Implement OAuth token refresh" --priority high --tags "provider,security,phase-4"
cs task create --title "Add secure credential storage" --priority critical --tags "provider,security,phase-4"
cs task create --title "Create provider troubleshooting guide" --priority medium --tags "provider,documentation,phase-4"
cs task create --title "Test all provider auth flows" --priority high --tags "provider,testing,phase-4"
```

---

## Convoy Templates

### Feature Development Convoy
```bash
cs convoy create "Feature: [FeatureName]" \
  --description "Complete implementation of [FeatureName]" \
  --tasks cs-design,cs-implement,cs-test,cs-document
```

### Bug Fix Sprint Convoy
```bash
cs convoy create "Bug Fix Sprint [Date]" \
  --description "Fix critical bugs identified in sprint planning" \
  --tasks cs-bug1,cs-bug2,cs-bug3
```

### Phase Completion Convoy
```bash
cs convoy create "Phase 1: Foundation Complete" \
  --description "All Phase 1 tasks for professional polish" \
  --tasks cs-test1,cs-test2,cs-ci,cs-coverage
```

---

## Using These Templates

### 1. Copy Template
Copy the appropriate template from above

### 2. Customize
Fill in the specific details for your task

### 3. Create Task
Run the command or create via wizard:
```bash
cs task create --wizard
```

### 4. Assign to Agent
```bash
cs agent list
cs agent assign <task-id> <agent-id>
```

### 5. Track Progress
```bash
cs task show <task-id>
cs convoy show <convoy-id>
```

---

**Pro Tips:**
- Use consistent tags for easy filtering
- Keep titles concise and descriptive
- Include acceptance criteria
- Link related tasks in description
- Use priority levels appropriately
- Tag with phase numbers for tracking

**Last Updated:** 2026-01-27
