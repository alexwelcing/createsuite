# CreateSuite Examples

## Example 1: Setting Up a New Project

```bash
# Initialize workspace
mkdir my-app
cd my-app
cs init --name "My App" --git

# Create specialized agents
cs agent create frontend-alice --capabilities "frontend,react,testing"
cs agent create backend-bob --capabilities "backend,api,database"
cs agent create devops-charlie --capabilities "devops,ci-cd"

# Check status
cs status
```

## Example 2: Building a Feature

```bash
# Create tasks for a new auth feature
cs task create \
  --title "Design auth API schema" \
  --description "Define the authentication API endpoints and data models" \
  --priority high \
  --tags "api,auth,design"

cs task create \
  --title "Implement JWT authentication" \
  --description "Add JWT token generation and validation" \
  --priority high \
  --tags "api,auth,backend"

cs task create \
  --title "Create login UI" \
  --description "Build the login form component" \
  --priority medium \
  --tags "frontend,auth,ui"

cs task create \
  --title "Write auth tests" \
  --description "Unit and integration tests for auth system" \
  --priority medium \
  --tags "testing,auth"

# Create a convoy for the feature
cs convoy create "Authentication System" \
  --description "Complete authentication feature" \
  --tasks cs-abc12,cs-def34,cs-ghi56,cs-jkl78

# Assign tasks to appropriate agents
cs agent list  # Get agent IDs
cs agent assign cs-abc12 <backend-bob-id>
cs agent assign cs-def34 <backend-bob-id>
cs agent assign cs-ghi56 <frontend-alice-id>
cs agent assign cs-jkl78 <frontend-alice-id>

# Monitor progress
cs convoy show cs-cv-xxxxx
cs task list --status in_progress
```

## Example 3: Bug Fix Sprint

```bash
# Create tasks for bug fixes
cs task create --title "Fix login redirect bug" --priority critical
cs task create --title "Fix memory leak in dashboard" --priority high
cs task create --title "Fix broken unit tests" --priority high

# Create convoy
cs convoy create "Bug Fix Sprint Week 1" \
  --tasks cs-bug01,cs-bug02,cs-bug03

# List idle agents
cs agent list

# Assign bugs to available agents
cs agent assign cs-bug01 <agent-1>
cs agent assign cs-bug02 <agent-2>
cs agent assign cs-bug03 <agent-3>

# Track completion
watch -n 5 'cs convoy show cs-cv-bug01'
```

## Example 4: Using OAuth

```bash
# Set up OAuth for coding plan
export OAUTH_CLIENT_ID="your-client-id"

# Initialize OAuth
cs oauth --init

# Check status
cs oauth --status

# If token expires, reinitialize
cs oauth --clear
cs oauth --init
```

## Example 5: Programmatic Usage

```typescript
import {
  ConfigManager,
  TaskManager,
  AgentOrchestrator,
  ConvoyManager,
  TaskPriority,
  TaskStatus
} from 'createsuite';

async function setupProject() {
  const workspaceRoot = '/path/to/workspace';
  
  // Initialize managers
  const config = new ConfigManager(workspaceRoot);
  const taskMgr = new TaskManager(workspaceRoot);
  const agentOrch = new AgentOrchestrator(workspaceRoot);
  const convoyMgr = new ConvoyManager(workspaceRoot);
  
  // Initialize workspace
  await config.initialize('My Project', 'https://github.com/user/repo.git');
  
  // Create agents
  const frontendAgent = await agentOrch.createAgent('frontend-worker', ['frontend', 'react']);
  const backendAgent = await agentOrch.createAgent('backend-worker', ['backend', 'api']);
  
  // Create tasks
  const task1 = await taskMgr.createTask(
    'Build login page',
    'Create React component for user login',
    TaskPriority.HIGH,
    ['frontend', 'auth']
  );
  
  const task2 = await taskMgr.createTask(
    'Create auth API',
    'Build authentication endpoints',
    TaskPriority.HIGH,
    ['backend', 'auth']
  );
  
  // Create convoy
  const convoy = await convoyMgr.createConvoy(
    'Auth Feature',
    'Complete authentication system',
    [task1.id, task2.id]
  );
  
  // Assign tasks
  await agentOrch.assignTaskToAgent(frontendAgent.id, task1.id);
  await agentOrch.assignTaskToAgent(backendAgent.id, task2.id);
  
  // Check progress
  const progress = await convoyMgr.getConvoyProgress(convoy.id);
  console.log(`Progress: ${progress.percentage}%`);
  
  // List tasks by status
  const openTasks = await taskMgr.listTasks({ status: TaskStatus.OPEN });
  console.log(`Open tasks: ${openTasks.length}`);
}
```

## Example 6: Multi-Agent Coordination

```bash
# Create a large feature requiring multiple agents
cs task create --title "Design database schema" --priority high
cs task create --title "Implement database migrations" --priority high
cs task create --title "Create API endpoints" --priority high
cs task create --title "Build frontend components" --priority medium
cs task create --title "Add form validation" --priority medium
cs task create --title "Write unit tests" --priority medium
cs task create --title "Write integration tests" --priority low
cs task create --title "Update documentation" --priority low

# Create convoy
cs convoy create "User Profile Feature" \
  --tasks cs-t001,cs-t002,cs-t003,cs-t004,cs-t005,cs-t006,cs-t007,cs-t008

# Create specialized team
cs agent create db-expert --capabilities "database,sql,migrations"
cs agent create api-expert --capabilities "backend,api,nodejs"
cs agent create ui-expert --capabilities "frontend,react,css"
cs agent create qa-expert --capabilities "testing,qa"
cs agent create doc-expert --capabilities "documentation,writing"

# Assign based on expertise
cs agent assign cs-t001 <db-expert-id>
cs agent assign cs-t002 <db-expert-id>
cs agent assign cs-t003 <api-expert-id>
cs agent assign cs-t004 <ui-expert-id>
cs agent assign cs-t005 <ui-expert-id>
cs agent assign cs-t006 <qa-expert-id>
cs agent assign cs-t007 <qa-expert-id>
cs agent assign cs-t008 <doc-expert-id>

# Monitor the convoy
cs convoy show cs-cv-xxxxx
```

## Example 7: Working with Git Branches

```bash
# CreateSuite automatically creates branches for agent work
# When you assign a task to an agent, it creates: agent/<agent-id>/<task-id>

# View all agent branches
git branch -a | grep agent/

# Check an agent's work
git checkout agent/<agent-id>/<task-id>
git log
git diff main

# Merge agent work when task is complete
git checkout main
git merge agent/<agent-id>/<task-id>
```

## Example 8: Monitoring Workspace

```bash
# Get overall status
cs status

# Filter tasks by status
cs task list --status open
cs task list --status in_progress
cs task list --status completed

# Filter tasks by agent
cs agent list  # Get agent ID
cs task list --agent <agent-id>

# Show detailed task info
cs task show cs-abc12

# Show detailed convoy info
cs convoy show cs-cv-xyz12

# List active convoys
cs convoy list --status active
```

## Example 9: Agent Communication

Agents communicate via mailboxes. Here's how to use it programmatically:

```typescript
import { AgentOrchestrator } from 'createsuite';

const orchestrator = new AgentOrchestrator('/path/to/workspace');

// Send a message to an agent
await orchestrator.sendMessage(
  'system',
  'agent-id',
  'Task Update',
  'The API schema has been updated. Please review before continuing.'
);

// Get unread messages for an agent
const unread = await orchestrator.getUnreadMessages('agent-id');
console.log(`Agent has ${unread.length} unread messages`);

// Mark message as read
await orchestrator.markMessageRead('agent-id', 'message-id');
```
