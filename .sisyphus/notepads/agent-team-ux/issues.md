# Issues: agent-team-ux

## [2026-01-28T23:16:32] Pre-existing Issues Noted
- LSP errors in agent-ui/src/components/ApiMonitoring.tsx (unrelated to this plan)

## [2026-01-28T23:17] Wave 1 Delegation Failed
- Task 1 (Demo Script): Agent failed with JSON parse error
- Task 2 (Storage Schema): Agent failed with JSON parse error
- Neither deliverable was created (.sisyphus/demos/ and .sisyphus/designs/ don't exist)
- Agents made unrelated changes to agent-ui and src files instead
- Root cause: Likely prompt complexity or delegation system issue
- Action: Retry with simpler, more direct prompts

## [2026-01-29T00:20] Post-Integration Test Issues

### CRITICAL: Desktop App Cannot Launch
**Issue**: `cs ui --demo` fails with "npm run electron:dev not found"
**Root Cause**: agent-ui/package.json missing electron:dev script
**Impact**: Blocks all Desktop testing, Scene 4 untestable
**Fix**: Add script: `"electron:dev": "electron electron/main.js"`
**Effort**: 15 minutes
**Priority**: P0 (blocker)

### MAJOR: SmartRouter Not Integrated
**Issue**: CLI task create doesn't use SmartRouter for workflow recommendation
**Root Cause**: Components built separately, no integration work done
**Impact**: No automatic workflow routing, "wow moment" missing
**Fix**: Modify src/cli.ts task create command to:
  1. Import SmartRouter
  2. Call analyzeComplexity(taskDescription)
  3. Display recommendation to user
  4. Ask for confirmation/override
**Effort**: 2 hours
**Priority**: P1 (major feature)

### MAJOR: Prometheus Integration Missing
**Issue**: No automatic plan generation for complex tasks
**Root Cause**: PlanManager exists but not connected to task workflow
**Impact**: Manual planning required, no "Plan → Execute" automation
**Fix**: 
  1. Integrate with oh-my-opencode Prometheus
  2. Auto-generate plans for complex/team workflows
  3. Save via PlanManager
  4. Display plan steps before execution
**Effort**: 4 hours
**Priority**: P1 (major feature)

### MEDIUM: Demo Mode Not Functional
**Issue**: Can't verify demo mode pre-configures 5 agents
**Root Cause**: Desktop app can't launch (blocked by P0)
**Impact**: Demo experience untested
**Fix**: After P0 fixed, verify DEMO_MODE env var works
**Effort**: 1 hour (after P0)
**Priority**: P2 (demo quality)

### MEDIUM: Plan→Execute Workflow Missing
**Issue**: Plans created but no automatic execution
**Root Cause**: No workflow to convert plan tasks to executable actions
**Impact**: Manual execution required
**Fix**: Build execution engine for plan tasks
**Effort**: 3 hours
**Priority**: P2 (automation)

### Total Fix Effort: ~11 hours
