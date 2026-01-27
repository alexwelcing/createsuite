# CreateSuite

**Orchestrated swarm system for OpenCode agents with git-based task tracking**

CreateSuite enables coordinated multi-agent workflows using OpenCode terminals, with persistent work state tracked in git. Inspired by [Gastown](https://github.com/steveyegge/gastown), CreateSuite provides first-class agent citizens capable of powerful autonomous work.

## Features

- 🤖 **First-Class Agents**: Autonomous agents running in dedicated OpenCode terminals
- 📋 **Git-Based Task Tracking**: Persistent task state using git-backed storage
- 🚚 **Convoys**: Organize related tasks into groups for coordinated work
- 📬 **Agent Mailboxes**: Communication system for inter-agent coordination
- 🔐 **OAuth Integration**: Support for coding plan authentication
- 💬 **Terminal Orchestration**: Manage multiple OpenCode instances seamlessly

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Make CLI available globally (optional)
npm link
```

## Quick Start

### 1. Initialize Workspace

```bash
# Create a new workspace with git tracking
cs init --name my-project --git

# Or initialize in an existing directory
cs init
```

### 2. Create Agents

```bash
# Create specialized agents
cs agent create alice --capabilities "frontend,testing"
cs agent create bob --capabilities "backend,api"

# List all agents
cs agent list
```

### 3. Create Tasks

```bash
# Create a task
cs task create \
  --title "Implement login feature" \
  --description "Add OAuth login to the application" \
  --priority high \
  --tags "auth,frontend"

# List all tasks
cs task list

# Show task details
cs task show cs-abc12
```

### 4. Assign Work

```bash
# Assign task to agent
cs agent assign cs-abc12 <agent-id>

# The agent will receive a message and can start working
```

### 5. Create Convoys

```bash
# Group related tasks into a convoy
cs convoy create "Auth Feature" \
  --description "Complete authentication system" \
  --tasks cs-abc12,cs-def34,cs-ghi56

# Check convoy progress
cs convoy list
cs convoy show cs-cv-abc12
```

### 6. Configure OAuth

```bash
# Initialize OAuth for coding plan
cs oauth --init

# Check OAuth status
cs oauth --status
```

## Architecture

### Core Components

```
CreateSuite
├── Agents: First-class autonomous workers
│   ├── Identity & State Management
│   ├── Mailbox for Communication
│   └── OpenCode Terminal Integration
├── Tasks: Git-backed work items
│   ├── ID Format: cs-xxxxx
│   ├── Status Tracking
│   └── Priority Management
├── Convoys: Task Groups
│   ├── ID Format: cs-cv-xxxxx
│   ├── Progress Tracking
│   └── Coordinated Workflows
└── Git Integration
    ├── Persistent State
    ├── Agent Branches
    └── Change Tracking
```

### Task Lifecycle

```
OPEN → IN_PROGRESS → COMPLETED
  ↓
BLOCKED (if issues arise)
```

### Agent States

- **IDLE**: Agent is available for work
- **WORKING**: Agent is actively processing a task
- **OFFLINE**: Agent is not running
- **ERROR**: Agent encountered an error

## CLI Commands

### Workspace Management

```bash
cs init [options]              # Initialize workspace
cs status                      # Show workspace status
```

### Task Management

```bash
cs task create [options]       # Create a new task
cs task list [options]         # List tasks
cs task show <taskId>          # Show task details
```

### Agent Management

```bash
cs agent create <name> [opts]  # Create an agent
cs agent list                  # List all agents
cs agent assign <task> <agent> # Assign task to agent
```

### Convoy Management

```bash
cs convoy create <name> [opts] # Create a convoy
cs convoy list [options]       # List convoys
cs convoy show <convoyId>      # Show convoy details
```

### OAuth

```bash
cs oauth --init                # Initialize OAuth
cs oauth --status              # Check OAuth status
cs oauth --clear               # Clear stored token
```

## Configuration

CreateSuite stores configuration in `.createsuite/` directory:

```
.createsuite/
├── config.json          # Workspace configuration
├── tasks/               # Task storage
│   └── cs-xxxxx.json    # Individual task files
├── agents/              # Agent state
│   └── <uuid>.json      # Individual agent files
├── convoys/             # Convoy groups
│   └── cs-cv-xxxxx.json # Individual convoy files
├── hooks/               # Git hooks and persistence
└── oauth-token.json     # OAuth credentials (gitignored)
```

## OpenCode Integration

CreateSuite is designed to work with OpenCode terminals. Each agent can spawn an OpenCode instance:

```bash
# Install OpenCode (if not already installed)
curl -fsSL https://opencode.ai/install | bash

# Agents will automatically use OpenCode when assigned tasks
```

## Programmatic Usage

```typescript
import {
  ConfigManager,
  TaskManager,
  AgentOrchestrator,
  ConvoyManager,
  GitIntegration,
  TaskPriority,
} from 'createsuite';

// Initialize managers
const workspaceRoot = process.cwd();
const taskManager = new TaskManager(workspaceRoot);
const orchestrator = new AgentOrchestrator(workspaceRoot);
const convoyManager = new ConvoyManager(workspaceRoot);

// Create a task
const task = await taskManager.createTask(
  'Build API endpoint',
  'Create REST API for user management',
  TaskPriority.HIGH,
  ['api', 'backend']
);

// Create an agent
const agent = await orchestrator.createAgent('api-worker', ['backend', 'api']);

// Assign task to agent
await orchestrator.assignTaskToAgent(agent.id, task.id);

// Create a convoy
const convoy = await convoyManager.createConvoy(
  'API Development',
  'Complete API implementation',
  [task.id]
);
```

## Workflow Examples

### Example 1: Feature Development

```bash
# 1. Create tasks for the feature
cs task create --title "Design API schema" --priority high
cs task create --title "Implement endpoints" --priority high
cs task create --title "Write tests" --priority medium

# 2. Create a convoy
cs convoy create "User API" --tasks cs-abc12,cs-def34,cs-ghi56

# 3. Create agents
cs agent create api-designer --capabilities "api,design"
cs agent create api-developer --capabilities "api,backend"

# 4. Assign tasks
cs agent assign cs-abc12 <designer-id>
cs agent assign cs-def34 <developer-id>

# 5. Monitor progress
cs convoy show cs-cv-xxxxx
```

### Example 2: Bug Fixing Sprint

```bash
# Create tasks for bugs
cs task create --title "Fix login bug" --priority critical
cs task create --title "Fix memory leak" --priority high

# Create convoy
cs convoy create "Bug Fixes Sprint" --tasks cs-bug01,cs-bug02

# Assign to available agents
cs agent list
cs agent assign cs-bug01 <agent-id>
```

## Git Integration

All task state is automatically committed to git:

```bash
# View task tracking history
git log .createsuite/

# See recent changes
git diff .createsuite/

# Create agent-specific branches
# Automatically done when assigning tasks
```

## Inspiration

CreateSuite is inspired by [Gastown](https://github.com/steveyegge/gastown), Steve Yegge's multi-agent orchestration system. Key concepts borrowed include:

- Git-backed persistent storage (like Beads)
- Agent mailboxes for communication
- Convoy-based task grouping
- First-class agent citizenship

## Contributing

Contributions are welcome! This is an early-stage project focused on:

1. Orchestrating multiple OpenCode agents
2. Git-based task tracking and persistence
3. Agent communication and coordination
4. OAuth integration for coding plans

## License

MIT

## Roadmap

- [ ] Enhanced OpenCode terminal integration
- [ ] Advanced agent communication protocols
- [ ] Web-based dashboard for monitoring
- [ ] Formula system for repeatable workflows
- [ ] Multi-repository support
- [ ] Enhanced OAuth flows
- [ ] Agent capability matching and auto-assignment
- [ ] Task dependency management
- [ ] Real-time collaboration features
