# CreateSuite - Getting Started Guide

Welcome to CreateSuite! This guide will help you get started with the orchestrated swarm system for OpenCode agents.

## Prerequisites

- Node.js 18+ and npm
- Git 2.25+
- OpenCode CLI (optional, for actual agent execution): `curl -fsSL https://opencode.ai/install | bash`

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/awelcing-alm/createsuite.git
cd createsuite

# Install dependencies
npm install

# Build the project
npm run build

# (Optional) Link for global usage
npm link
```

### Verify Installation

```bash
# Using npm link
cs --version

# Or directly
node dist/cli.js --version
```

## Quick Start Tutorial

### Step 1: Initialize a Workspace

```bash
# Create a new project directory
mkdir my-project
cd my-project

# Initialize CreateSuite with git tracking
cs init --name "My Project" --git

# Check status
cs status
```

You should see:
```
✓ Workspace "My Project" initialized at /path/to/my-project
```

### Step 2: Create Agents

Agents are your autonomous workers. Create specialized agents based on their capabilities:

```bash
# Create a frontend specialist
cs agent create alice --capabilities "frontend,react,css"

# Create a backend specialist
cs agent create bob --capabilities "backend,api,database"

# Create a testing specialist
cs agent create charlie --capabilities "testing,qa,automation"

# List all agents
cs agent list
```

### Step 3: Create Tasks

Tasks represent work items that agents will complete:

```bash
# Create a high-priority frontend task
cs task create \
  --title "Build user dashboard" \
  --description "Create a React dashboard component with charts" \
  --priority high \
  --tags "frontend,ui,dashboard"

# Create a backend task
cs task create \
  --title "Create REST API" \
  --description "Build CRUD endpoints for user management" \
  --priority high \
  --tags "backend,api"

# Create a testing task
cs task create \
  --title "Write integration tests" \
  --description "Add tests for API endpoints" \
  --priority medium \
  --tags "testing,api"

# List all tasks
cs task list
```

### Step 4: Organize with Convoys

Convoys group related tasks for coordinated work:

```bash
# Create a convoy with your tasks (replace with actual task IDs)
cs convoy create "User Management Feature" \
  --description "Complete user management system" \
  --tasks cs-abc12,cs-def34,cs-ghi56

# View convoy progress
cs convoy list
```

### Step 5: Assign Tasks to Agents

Assign tasks to agents based on their capabilities:

```bash
# Get agent IDs
cs agent list

# Assign frontend task to alice
cs agent assign cs-abc12 <alice-agent-id>

# Assign backend task to bob
cs agent assign cs-def34 <bob-agent-id>

# Assign testing task to charlie
cs agent assign cs-ghi56 <charlie-agent-id>

# View agent status
cs agent list
```

### Step 6: Monitor Progress

Track your project's progress:

```bash
# Overall workspace status
cs status

# Specific convoy progress
cs convoy show cs-cv-xxxxx

# Task details
cs task show cs-abc12

# List tasks by status
cs task list --status in_progress
cs task list --status completed
```

## Understanding the Workflow

### Task Lifecycle

```
CREATE → OPEN → (assign) → IN_PROGRESS → (complete) → COMPLETED
                               ↓
                           BLOCKED (if issues)
```

### Agent States

- **IDLE**: Available for new work
- **WORKING**: Currently processing a task
- **OFFLINE**: Not running
- **ERROR**: Encountered a problem

### Git Integration

All state is automatically committed to git:

```bash
# View task tracking history
git log .createsuite/

# See what changed
git diff .createsuite/

# Agent work is on branches
git branch -a | grep agent/
```

## Common Workflows

### Daily Development Flow

```bash
# Morning: Check status
cs status

# Create today's tasks
cs task create --title "Task 1" --priority high
cs task create --title "Task 2" --priority medium

# Assign to agents
cs agent list
cs agent assign cs-xxx <agent-id>

# End of day: Review progress
cs convoy list
cs task list --status completed
```

### Feature Development

```bash
# 1. Plan the feature
cs convoy create "New Feature" --description "Feature X implementation"

# 2. Break down into tasks
cs task create --title "Design" --tags "feature-x,design"
cs task create --title "Implementation" --tags "feature-x,code"
cs task create --title "Testing" --tags "feature-x,test"

# 3. Add tasks to convoy
cs convoy show cs-cv-xxxxx  # Note the tasks

# 4. Assign to team
cs agent assign <task-id> <agent-id>
# Repeat for each task

# 5. Track progress
cs convoy show cs-cv-xxxxx
```

### Bug Triage

```bash
# Create tasks for bugs
cs task create --title "Fix login bug" --priority critical
cs task create --title "Fix memory leak" --priority high

# Create bug fix convoy
cs convoy create "Bug Fixes Sprint 1" --tasks cs-bug1,cs-bug2

# Assign to available agents
cs agent list
cs agent assign cs-bug1 <agent-id>
```

## OAuth Configuration

For coding plan integration:

```bash
# Initialize OAuth (development mode)
cs oauth --init

# Check status
cs oauth --status

# Clear token if needed
cs oauth --clear
```

Note: The current OAuth implementation is a development placeholder. See ARCHITECTURE.md for production requirements.

## Directory Structure

After initialization, your workspace will have:

```
my-project/
├── .createsuite/
│   ├── config.json          # Workspace configuration
│   ├── tasks/               # Task storage
│   │   └── cs-xxxxx.json
│   ├── agents/              # Agent state
│   │   └── <uuid>.json
│   ├── convoys/             # Convoy groups
│   │   └── cs-cv-xxxxx.json
│   └── hooks/               # Future: git hooks
├── .git/                    # Git repository
└── .gitignore
```

## Tips and Best practices

1. **Name agents descriptively**: Use names that reflect their specialization
2. **Use capabilities wisely**: Tag agents with their actual strengths
3. **Tag tasks consistently**: Use consistent tags for better filtering
4. **Review git history**: Check `.createsuite/` commits to track decisions
5. **Use convoys for features**: Group related work for better organization
6. **Check status regularly**: Run `cs status` to stay informed
7. **Prioritize appropriately**: Use critical/high/medium/low meaningfully

## Troubleshooting

### Workspace not initialized
```
Error: Workspace not initialized. Run: cs init
```
**Solution**: Run `cs init` in your project directory

### Task not found
```
Error: Task not found: cs-xxxxx
```
**Solution**: Check task ID with `cs task list`

### Agent not found
```
Error: Agent not found: <id>
```
**Solution**: Check agent ID with `cs agent list`

### Git errors
```
Error: Author identity unknown
```
**Solution**: Configure git:
```bash
git config --global user.email "you@example.com"
git config --global user.name "Your Name"
```

## Next Steps

- Read [ARCHITECTURE.md](ARCHITECTURE.md) for system design details
- Check [EXAMPLES.md](EXAMPLES.md) for more usage examples
- Explore the [README.md](README.md) for comprehensive documentation

## Getting Help

- Check the documentation files in the repository
- Review example workflows in EXAMPLES.md
- Examine the TypeScript source code in `src/`

## Contributing

CreateSuite is an early-stage project. Contributions are welcome! Focus areas:

- Enhanced OpenCode terminal integration
- Real OAuth implementation
- Advanced agent coordination
- Web-based monitoring dashboard
- Formula system for workflows

Happy orchestrating! 🚀
