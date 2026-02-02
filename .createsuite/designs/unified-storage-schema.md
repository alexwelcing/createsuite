# Unified Storage Schema Design

**Goal**: Merge `.sisyphus/` into `.createsuite/` for single source of truth  
**Status**: Design Phase  
**Implementation**: Task 4 (PlanManager Bridge)

---

## Current State Analysis

### .createsuite/ Structure (22 files)
```
.createsuite/
├── config.json                    # Workspace configuration
├── providers.json                 # AI provider configuration
├── openai-credentials.json        # OAuth tokens (gitignored)
├── tasks/                         # 14 task files (cs-xxxxx.json)
│   ├── cs-12rfx.json
│   ├── cs-elneg.json
│   └── ...
├── agents/                        # 2 agent files
│   ├── architect.json
│   └── architect.md
├── convoys/                       # 3 convoy files (cs-cv-xxxxx.json)
│   ├── cs-cv-qgjkc.json
│   ├── cs-cv-k7pgo.json
│   └── cs-cv-7k6nh.json
└── hooks/                         # Git hooks (empty)
```

**Purpose**: Runtime state for CreateSuite CLI  
**Managed by**: ConfigManager, TaskManager, AgentOrchestrator, ConvoyManager  
**Persistence**: JSON files, git-backed

### .sisyphus/ Structure (13 files)
```
.sisyphus/
├── boulder.json                   # Active work session state
├── ralph-loop.local.md            # Ralph loop iteration tracking
├── plans/                         # Prometheus-generated work plans
│   └── agent-team-ux.md
├── demos/                         # Demo scripts (NEW from Task 1)
│   └── 60-second-script.md
├── drafts/                        # Working memory documents
│   └── kickoff-project-execution.md
└── notepads/                      # Persistent notes per plan
    ├── agent-team-ux/
    │   ├── learnings.md
    │   ├── decisions.md
    │   ├── issues.md
    │   └── problems.md
    └── electron-app/
        ├── learnings.md
        ├── decisions.md
        ├── issues.md
        └── problems.md
```

**Purpose**: Planning and execution tracking for oh-my-opencode agents  
**Managed by**: Prometheus (planner), Sisyphus (executor), Atlas (orchestrator)  
**Persistence**: Markdown files, git-backed

### Pain Points

| Issue | Impact | Severity |
|-------|--------|----------|
| **Two separate directories** | Users confused about which is authoritative | 🔴 High |
| **No automatic flow** | Prometheus plans don't become CreateSuite tasks | 🔴 High |
| **Duplicate git tracking** | Both directories tracked separately | 🟡 Medium |
| **Fragmented state** | Task state in .createsuite, plan state in .sisyphus | 🟡 Medium |
| **Unclear ownership** | Which system owns what data? | 🟡 Medium |

---

## Proposed Unified Schema

### New .createsuite/ Structure

```
.createsuite/
├── config.json                    # Workspace configuration (existing)
├── providers.json                 # AI provider configuration (existing)
├── openai-credentials.json        # OAuth tokens (existing, gitignored)
│
├── tasks/                         # Task storage (existing)
│   └── cs-xxxxx.json              # Individual task files
│
├── agents/                        # Agent state (existing)
│   └── <uuid>.json                # Individual agent files
│
├── convoys/                       # Convoy groups (existing)
│   └── cs-cv-xxxxx.json           # Individual convoy files
│
├── plans/                         # Work plans (FROM .sisyphus)
│   ├── agent-team-ux.md           # Prometheus-generated plans
│   ├── electron-app.md
│   └── ...
│
├── drafts/                        # Working memory (FROM .sisyphus)
│   ├── kickoff-project-execution.md
│   └── ...
│
├── demos/                         # Demo scripts (FROM .sisyphus)
│   ├── 60-second-script.md
│   └── ...
│
├── notepads/                      # Persistent notes (FROM .sisyphus)
│   ├── agent-team-ux/
│   │   ├── learnings.md
│   │   ├── decisions.md
│   │   ├── issues.md
│   │   └── problems.md
│   └── ...
│
├── evidence/                      # Verification artifacts (NEW)
│   ├── task-1-demo-script.png
│   ├── task-7-integration-test.png
│   └── ...
│
├── boulder.json                   # Active work session (FROM .sisyphus)
├── ralph-loop.local.md            # Ralph loop tracking (FROM .sisyphus)
│
└── hooks/                         # Git hooks (existing)
```

### What Moves Where

| Current Location | New Location | Reason |
|------------------|--------------|--------|
| `.sisyphus/plans/` | `.createsuite/plans/` | Plans are first-class work items |
| `.sisyphus/drafts/` | `.createsuite/drafts/` | Working memory part of workspace |
| `.sisyphus/demos/` | `.createsuite/demos/` | Demo scripts are project artifacts |
| `.sisyphus/notepads/` | `.createsuite/notepads/` | Persistent knowledge base |
| `.sisyphus/boulder.json` | `.createsuite/boulder.json` | Active session state |
| `.sisyphus/ralph-loop.local.md` | `.createsuite/ralph-loop.local.md` | Iteration tracking |

### What Stays Separate

**NOTHING** - Complete unification under `.createsuite/`

---

## Data Models

### Plan Interface (NEW)

```typescript
/**
 * Work plan generated by Prometheus
 * Stored as markdown in .createsuite/plans/
 */
export interface Plan {
  id: string;                    // Plan name (e.g., "agent-team-ux")
  filePath: string;              // Absolute path to .md file
  name: string;                  // Human-readable name
  createdAt: Date;
  updatedAt: Date;
  status: PlanStatus;
  tasks: PlanTask[];             // Parsed from markdown checkboxes
  metadata: PlanMetadata;
}

export enum PlanStatus {
  PENDING = 'pending',           // Not started
  IN_PROGRESS = 'in_progress',   // Active work
  COMPLETED = 'completed',       // All tasks done
  PAUSED = 'paused'              // Temporarily stopped
}

export interface PlanTask {
  id: string;                    // Generated from checkbox position
  content: string;               // Checkbox text
  completed: boolean;            // Checkbox state [ ] or [x]
  lineNumber: number;            // Line in markdown file
  dependencies: string[];        // Inferred from plan structure
}

export interface PlanMetadata {
  author: string;                // "prometheus"
  estimatedEffort: string;       // From plan TL;DR
  parallelizable: boolean;       // From plan execution strategy
  waves?: number;                // Number of execution waves
}
```

### Draft Interface (NEW)

```typescript
/**
 * Working memory document
 * Stored as markdown in .createsuite/drafts/
 */
export interface Draft {
  id: string;                    // Filename without extension
  filePath: string;              // Absolute path to .md file
  title: string;                 // Extracted from first # heading
  createdAt: Date;
  updatedAt: Date;
  content: string;               // Full markdown content
  tags: string[];                // Extracted from frontmatter or content
}
```

### Evidence Interface (NEW)

```typescript
/**
 * Verification artifact (screenshot, log, etc.)
 * Stored in .createsuite/evidence/
 */
export interface Evidence {
  id: string;                    // Generated UUID
  filePath: string;              // Absolute path to file
  type: EvidenceType;
  taskId?: string;               // Associated task (if any)
  planId?: string;               // Associated plan (if any)
  createdAt: Date;
  metadata: EvidenceMetadata;
}

export enum EvidenceType {
  SCREENSHOT = 'screenshot',     // .png, .jpg
  LOG = 'log',                   // .txt, .log
  VIDEO = 'video',               // .mp4, .webm
  REPORT = 'report'              // .md, .html
}

export interface EvidenceMetadata {
  description: string;
  capturedBy: string;            // Agent or user
  verificationStep?: string;     // Which acceptance criteria
}
```

### Boulder State (EXISTING, moved)

```typescript
/**
 * Active work session state
 * Stored as .createsuite/boulder.json
 */
export interface BoulderState {
  active_plan: string;           // Absolute path to plan file
  started_at: string;            // ISO timestamp
  session_ids: string[];         // oh-my-opencode session IDs
  plan_name: string;             // Plan identifier
}
```

---

## Migration Strategy

### Phase 1: Symlink Transition (Immediate)

**Goal**: Maintain backward compatibility while transitioning

```bash
# Step 1: Move content to .createsuite
mv .sisyphus/plans .createsuite/plans
mv .sisyphus/drafts .createsuite/drafts
mv .sisyphus/demos .createsuite/demos
mv .sisyphus/notepads .createsuite/notepads
mv .sisyphus/boulder.json .createsuite/boulder.json
mv .sisyphus/ralph-loop.local.md .createsuite/ralph-loop.local.md

# Step 2: Create symlinks for backward compatibility
ln -s .createsuite/plans .sisyphus/plans
ln -s .createsuite/drafts .sisyphus/drafts
ln -s .createsuite/demos .sisyphus/demos
ln -s .createsuite/notepads .sisyphus/notepads
ln -s .createsuite/boulder.json .sisyphus/boulder.json
ln -s .createsuite/ralph-loop.local.md .sisyphus/ralph-loop.local.md

# Step 3: Update .gitignore
echo ".sisyphus" >> .gitignore  # Ignore symlink directory
```

**Timeline**: Immediate (can be done in Task 4)

### Phase 2: Code Migration (Task 4)

**Goal**: Update all code references to use .createsuite paths

**Files to update**:
- `src/planManager.ts` (NEW) - Use `.createsuite/plans/`
- oh-my-opencode hooks - Update boulder.json path
- Prometheus agent - Update plan output path
- Atlas orchestrator - Update notepad paths

**Verification**:
```bash
# Find all hardcoded .sisyphus references
grep -r "\.sisyphus" src/
grep -r "\.sisyphus" agent-ui/

# Should return ZERO results after migration
```

### Phase 3: Deprecation (Future)

**Goal**: Remove .sisyphus directory entirely

**Timeline**: After 2-3 releases (v1.1.0+)

**Steps**:
1. Add deprecation warning if .sisyphus exists
2. Provide migration tool: `cs migrate-storage`
3. Remove symlinks
4. Delete .sisyphus directory

---

## Backward Compatibility

### Handling Existing .sisyphus References

**Scenario 1**: User has existing .sisyphus directory

```typescript
// In ConfigManager.initialize()
async initialize(name: string, repository?: string): Promise<void> {
  // Check for legacy .sisyphus directory
  const legacySisyphusPath = path.join(this.workspaceRoot, '.sisyphus');
  const hasLegacy = await this.directoryExists(legacySisyphusPath);
  
  if (hasLegacy) {
    console.log('⚠️  Detected legacy .sisyphus directory');
    console.log('   Migrating to unified .createsuite storage...');
    await this.migrateLegacyStorage(legacySisyphusPath);
    console.log('   ✓ Migration complete');
  }
  
  // Continue with normal initialization
  // ...
}
```

**Scenario 2**: oh-my-opencode still writes to .sisyphus

**Solution**: Symlinks (Phase 1) ensure writes go to .createsuite

**Scenario 3**: User has both directories

**Solution**: .createsuite takes precedence, warn about conflict

```typescript
async detectStorageConflict(): Promise<void> {
  const hasCreatesuite = await this.directoryExists('.createsuite');
  const hasSisyphus = await this.directoryExists('.sisyphus');
  
  if (hasCreatesuite && hasSisyphus && !this.isSymlink('.sisyphus')) {
    console.warn('⚠️  WARNING: Both .createsuite and .sisyphus exist');
    console.warn('   Using .createsuite as source of truth');
    console.warn('   Run `cs migrate-storage` to resolve');
  }
}
```

---

## Implementation Notes for Task 4

### PlanManager Class Structure

```typescript
export class PlanManager {
  private plansDir: string;
  private workspaceRoot: string;
  
  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.plansDir = path.join(workspaceRoot, '.createsuite', 'plans');
  }
  
  /**
   * Create a new plan
   */
  async createPlan(name: string, content: string): Promise<Plan> {
    const filePath = path.join(this.plansDir, `${name}.md`);
    await fsp.writeFile(filePath, content);
    return this.loadPlan(name);
  }
  
  /**
   * Load and parse a plan from markdown
   */
  async loadPlan(name: string): Promise<Plan> {
    const filePath = path.join(this.plansDir, `${name}.md`);
    const content = await fsp.readFile(filePath, 'utf-8');
    
    // Parse markdown to extract tasks
    const tasks = this.parseTasksFromMarkdown(content);
    
    return {
      id: name,
      filePath,
      name: this.extractTitle(content),
      createdAt: await this.getFileCreatedDate(filePath),
      updatedAt: await this.getFileModifiedDate(filePath),
      status: this.inferStatus(tasks),
      tasks,
      metadata: this.extractMetadata(content)
    };
  }
  
  /**
   * Convert plan tasks to CreateSuite tasks
   * KEY BRIDGE FUNCTION
   */
  async convertToTasks(plan: Plan): Promise<Task[]> {
    const tasks: Task[] = [];
    
    for (const planTask of plan.tasks) {
      if (planTask.completed) continue; // Skip completed
      
      const task: Task = {
        id: this.generateTaskId(),
        title: planTask.content,
        description: `From plan: ${plan.name}`,
        status: TaskStatus.OPEN,
        createdAt: new Date(),
        updatedAt: new Date(),
        priority: this.inferPriority(planTask),
        tags: [`plan:${plan.id}`]
      };
      
      tasks.push(task);
    }
    
    return tasks;
  }
  
  /**
   * List all plans
   */
  async listPlans(): Promise<Plan[]> {
    const files = await fsp.readdir(this.plansDir);
    const planFiles = files.filter(f => f.endsWith('.md'));
    
    const plans: Plan[] = [];
    for (const file of planFiles) {
      const name = file.replace('.md', '');
      plans.push(await this.loadPlan(name));
    }
    
    return plans;
  }
  
  /**
   * Delete a plan
   */
  async deletePlan(name: string): Promise<void> {
    const filePath = path.join(this.plansDir, `${name}.md`);
    await fsp.unlink(filePath);
  }
  
  // Private helper methods
  private parseTasksFromMarkdown(content: string): PlanTask[] {
    const lines = content.split('\n');
    const tasks: PlanTask[] = [];
    
    lines.forEach((line, index) => {
      // Match markdown checkboxes: - [ ] or - [x]
      const match = line.match(/^- \[([ x])\] (.+)$/);
      if (match) {
        tasks.push({
          id: `task-${index}`,
          content: match[2],
          completed: match[1] === 'x',
          lineNumber: index + 1,
          dependencies: []
        });
      }
    });
    
    return tasks;
  }
  
  private extractTitle(content: string): string {
    const match = content.match(/^# (.+)$/m);
    return match ? match[1] : 'Untitled Plan';
  }
  
  private inferStatus(tasks: PlanTask[]): PlanStatus {
    if (tasks.length === 0) return PlanStatus.PENDING;
    
    const completed = tasks.filter(t => t.completed).length;
    if (completed === 0) return PlanStatus.PENDING;
    if (completed === tasks.length) return PlanStatus.COMPLETED;
    return PlanStatus.IN_PROGRESS;
  }
  
  private extractMetadata(content: string): PlanMetadata {
    // Parse TL;DR section for metadata
    return {
      author: 'prometheus',
      estimatedEffort: 'Large',
      parallelizable: content.includes('Parallel Execution'),
      waves: this.countWaves(content)
    };
  }
  
  private countWaves(content: string): number {
    const matches = content.match(/Wave \d+/g);
    return matches ? matches.length : 1;
  }
  
  private inferPriority(planTask: PlanTask): TaskPriority {
    // Heuristic: tasks in Wave 1 are high priority
    if (planTask.content.includes('CRITICAL')) return TaskPriority.CRITICAL;
    if (planTask.content.includes('high')) return TaskPriority.HIGH;
    return TaskPriority.MEDIUM;
  }
  
  private generateTaskId(): string {
    // Same format as TaskManager: cs-xxxxx
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = 'cs-';
    for (let i = 0; i < 5; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  }
  
  private async getFileCreatedDate(filePath: string): Promise<Date> {
    const stats = await fsp.stat(filePath);
    return stats.birthtime;
  }
  
  private async getFileModifiedDate(filePath: string): Promise<Date> {
    const stats = await fsp.stat(filePath);
    return stats.mtime;
  }
}
```

### Integration with ConfigManager

```typescript
// In src/config.ts, add:
async savePlan(plan: Plan): Promise<void> {
  // Plans are stored as markdown, not JSON
  // PlanManager handles this
  const planManager = new PlanManager(this.workspaceRoot);
  await planManager.createPlan(plan.id, plan.content);
}

async loadPlan(planId: string): Promise<Plan | null> {
  const planManager = new PlanManager(this.workspaceRoot);
  try {
    return await planManager.loadPlan(planId);
  } catch {
    return null;
  }
}
```

### CLI Integration

```typescript
// In src/cli.ts, add new commands:
program
  .command('plan list')
  .description('List all work plans')
  .action(async () => {
    const planManager = new PlanManager(process.cwd());
    const plans = await planManager.listPlans();
    
    console.log('\nWork Plans:\n');
    plans.forEach(plan => {
      const progress = plan.tasks.filter(t => t.completed).length;
      const total = plan.tasks.length;
      console.log(`  ${plan.name} - ${progress}/${total} tasks`);
    });
  });

program
  .command('plan convert <planName>')
  .description('Convert plan tasks to CreateSuite tasks')
  .action(async (planName) => {
    const planManager = new PlanManager(process.cwd());
    const taskManager = new TaskManager(process.cwd());
    
    const plan = await planManager.loadPlan(planName);
    const tasks = await planManager.convertToTasks(plan);
    
    console.log(`\nConverting ${tasks.length} tasks from plan: ${plan.name}\n`);
    
    for (const task of tasks) {
      await taskManager.createTask(
        task.title,
        task.description,
        task.priority,
        task.tags
      );
      console.log(`  ✓ Created: ${task.id} - ${task.title}`);
    }
  });
```

---

## Rollback Plan

If migration fails or causes issues:

### Step 1: Restore from Git

```bash
# Revert all changes
git checkout -- .createsuite/
git checkout -- .sisyphus/

# Remove symlinks if created
rm .sisyphus/plans .sisyphus/drafts .sisyphus/demos .sisyphus/notepads
```

### Step 2: Restore Backup

```bash
# If backup was created
cp -r .sisyphus.backup/* .sisyphus/
```

### Step 3: Revert Code Changes

```bash
# Revert PlanManager and related code
git revert <commit-hash>
```

---

## Testing Strategy

### Unit Tests

```typescript
// src/__tests__/planManager.test.ts
describe('PlanManager', () => {
  test('createPlan saves to .createsuite/plans/', async () => {
    const pm = new PlanManager('/tmp/test');
    await pm.createPlan('test-plan', '# Test\n- [ ] Task 1');
    
    const exists = await fs.promises.access('/tmp/test/.createsuite/plans/test-plan.md');
    expect(exists).toBeTruthy();
  });
  
  test('loadPlan parses markdown checkboxes', async () => {
    const pm = new PlanManager('/tmp/test');
    const plan = await pm.loadPlan('test-plan');
    
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].content).toBe('Task 1');
    expect(plan.tasks[0].completed).toBe(false);
  });
  
  test('convertToTasks creates Task objects', async () => {
    const pm = new PlanManager('/tmp/test');
    const plan = await pm.loadPlan('test-plan');
    const tasks = await pm.convertToTasks(plan);
    
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toMatch(/^cs-[a-z0-9]{5}$/);
    expect(tasks[0].title).toBe('Task 1');
  });
});
```

### Integration Tests

```bash
# Test migration from .sisyphus to .createsuite
cs init --name "Test Project"
mkdir -p .sisyphus/plans
echo "# Test Plan\n- [ ] Task 1" > .sisyphus/plans/test.md

# Run migration
cs migrate-storage

# Verify
test -f .createsuite/plans/test.md && echo "PASS" || echo "FAIL"
test -L .sisyphus/plans && echo "PASS: Symlink created" || echo "FAIL"
```

---

## Summary

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| **Merge into .createsuite** | Single source of truth, less confusion |
| **Symlink transition** | Backward compatibility during migration |
| **PlanManager bridge** | Automatic flow from Prometheus to CreateSuite |
| **Markdown for plans** | Human-readable, git-friendly, existing format |
| **JSON for tasks** | Machine-readable, existing format |

### Benefits

- ✅ Single directory for all workspace state
- ✅ Automatic plan → task conversion
- ✅ Backward compatible via symlinks
- ✅ Clear ownership (CreateSuite owns everything)
- ✅ Simplified git tracking

### Risks

| Risk | Mitigation |
|------|------------|
| Breaking oh-my-opencode | Symlinks maintain compatibility |
| Data loss during migration | Git history + backup before migration |
| Performance impact | Minimal (same file operations) |
| User confusion | Clear migration guide + warnings |

---

## Next Steps (for Task 4 Implementation)

1. Create `src/planManager.ts` with PlanManager class
2. Add Plan, Draft, Evidence interfaces to `src/types.ts`
3. Update `src/config.ts` to support plan operations
4. Add `cs plan` commands to `src/cli.ts`
5. Write unit tests in `src/__tests__/planManager.test.ts`
6. Implement migration logic in ConfigManager
7. Update documentation to reflect new structure
8. Test with existing .sisyphus workspaces

**Estimated effort**: 4-6 hours (medium complexity)
