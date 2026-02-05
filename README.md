# CreateSuite

**Orchestrated swarm system for OpenCode agents with git-based task tracking**

CreateSuite enables coordinated multi-agent workflows using OpenCode terminals, with persistent work state tracked in git. Inspired by [Gastown](https://github.com/steveyegge/gastown), CreateSuite provides first-class agent citizens capable of powerful autonomous work.

## 🎥 Video Tour

Experience CreateSuite in action! Watch our interactive tour to see how easy it is to orchestrate multi-agent workflows.

```bash
# View the landing page with video tour
cs tour

# Build the tour video (requires @remotion packages)
cs video

# Preview the video in Remotion studio
cs video --preview

# Build Agent UI demo video
npm run video:build:agent-ui
```

## ✨ AI Provider Management

CreateSuite now integrates with [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) to provide seamless configuration and management of AI model providers:

- 🔷 **Z.ai GLM 4.7** - Access via coding plan
- 🟣 **Claude Opus & Sonnet 4.5** - Pro and Max (20x mode) tiers
- 🟢 **OpenAI GPT-5.2** - **NEW: Localhost OAuth + API Key support** ✨
- 🔵 **MiniMax 2.1** - Latest model access
- 🔴 **Google Gemini 3 Pro** - Antigravity OAuth support
- 🐙 **GitHub Copilot** - Fallback provider
- 🧘 **OpenCode Zen** - OpenCode native models
- 🤗 **Hugging Face Inference** - **NEW: Image & Asset Generation** ✨

Use the interactive setup wizard: `cs provider setup`

**New:** Secure localhost-based authentication for OpenAI with API key support. See [OpenAI Authentication Guide](OPENAI_AUTH.md) for details.

## 🚀 Professional Polish Project

CreateSuite is currently undergoing professional polish to prepare for public release! We're focusing on:

- ✅ **Comprehensive Testing** - Building robust test infrastructure (70%+ coverage target)
- ✅ **Enhanced Documentation** - Creating quick starts, FAQs, and video tutorials
- ✅ **Code Quality** - Establishing standards with ESLint, Prettier, and pre-commit hooks
- ✅ **Provider Excellence** - Perfecting authentication and integration
- ✅ **Security Hardening** - Ensuring production-ready security posture
- ✅ **Performance Optimization** - Making everything fast and responsive

**Want to help?** Check out the [Kickoff Project Plan](KICKOFF_PROJECT.md) or [Quick Checklist](POLISH_CHECKLIST.md) to see what we're working on!

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

## Deployment

CreateSuite is ready to deploy to the cloud! We include a `render.yaml` Blueprint for instant deployment on [Render](https://render.com).

### Deploy to Render

1. Fork or copy this repository to the GitHub account connected to Render.
2. Log in to the [Render Dashboard](https://dashboard.render.com).
3. Click **New +** and select **Blueprint**.
4. Choose your forked repo.
5. Click **Apply**.

Render will automatically build the `agent-ui` frontend and start the backend server.

For a step-by-step solo deploy flow, see [docs/guides/DEPLOY_RENDER.md](docs/guides/DEPLOY_RENDER.md).

Production deployments disable terminal spawn and `/workspace` static serving unless explicitly enabled. See [docs/guides/DEPLOY_RENDER.md](docs/guides/DEPLOY_RENDER.md).

Optional security: API token auth, Basic Auth for the UI, and rate limiting are documented in [docs/guides/DEPLOY_RENDER.md](docs/guides/DEPLOY_RENDER.md).

### Deploy Landing Page + Docs to Netlify

The static landing page and documentation can be deployed to Netlify using the bundled `netlify.toml`.

1. Connect the repository to Netlify.
2. Set the build command to `npm run build:netlify`.
3. Set the publish directory to `public`.

Netlify will publish the landing page (`/`) and documentation (`/docs/`) including the project README.

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

# Create a Fly-backed agent with its own app
cs agent create atlas --runtime fly
cs agent create helia --runtime fly --fly-app my-fly-agent-app

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

### 6. Configure AI Providers

```bash
# Set up AI model providers (Z.ai, Claude, OpenAI, MiniMax)
cs provider setup

# This interactive wizard will:
# - Check for OpenCode installation
# - Configure oh-my-opencode
# - Set up provider connections
# - Guide you through authentication

# List configured providers
cs provider list

# Authenticate providers
cs provider auth
```

### 7. Configure OAuth (Legacy)

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
cs ui [options]                # Start the Agent UI dashboard
cs tour                        # Open the video tour and landing page
```

### Video Tour

```bash
cs video                       # Build the CreateSuite tour video
cs video --preview             # Preview video in Remotion studio
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

### Provider Management

```bash
cs provider setup              # Interactive provider setup wizard
cs provider list               # List all configured providers
cs provider auth               # Authenticate configured providers
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

## Documentation

CreateSuite has comprehensive documentation organized by topic:

### 📚 User Guides
- [Getting Started Guide](docs/guides/GETTING_STARTED.md) - Quick start tutorial
- [Examples](docs/guides/EXAMPLES.md) - Common workflows and patterns

### 🏗️ Architecture
- [Architecture Overview](docs/architecture/ARCHITECTURE.md) - System design and components

### ⚙️ Providers
- [Provider Setup Guide](docs/providers/PROVIDER_SETUP.md) - Configure AI model providers
- [Integration Guide](docs/providers/INTEGRATION_GUIDE.md) - oh-my-opencode integration
- [OpenAI Authentication](docs/providers/OPENAI_AUTH.md) - OpenAI setup with API key support
- [Remotion Implementation](docs/providers/REMOTION_IMPLEMENTATION.md) - Video tour system
- [Provider Implementation](docs/providers/PROVIDER_IMPLEMENTATION.md) - Provider management system

### 📋 Planning & Roadmap
- [Kickoff Project](docs/planning/KICKOFF_PROJECT.md) - Complete 10-phase roadmap
- [Executive Summary](docs/planning/EXECUTIVE_SUMMARY.md) - High-level overview
- [Immediate Actions](docs/planning/IMMEDIATE_ACTIONS.md) - 7-day action plan
- [Polish Checklist](docs/planning/POLISH_CHECKLIST.md) - Progress tracking
- [Task Templates](docs/planning/TASK_TEMPLATES.md) - Create tasks quickly
- [Convoy Examples](docs/planning/CONVOY_EXAMPLES.md) - Organize work effectively
- [Project Overview](docs/planning/PROJECT_OVERVIEW.txt) - Visual project structure

### 🧪 Testing
- [Testing Guide](docs/testing/TESTING.md) - Test the video tour feature

### 📂 Legacy Documentation
- [Provider Setup Demo](docs/legacy/PROVIDER_SETUP_DEMO.md) - Historical UI flow demonstrations

## Contributing

Contributions are welcome! We're actively working on the professional polish project. See:

- **[Kickoff Project Plan](docs/planning/KICKOFF_PROJECT.md)** - Complete 10-phase roadmap
- **[Quick Checklist](docs/planning/POLISH_CHECKLIST.md)** - Progress tracking and quick wins
- **[Immediate Actions](docs/planning/IMMEDIATE_ACTIONS.md)** - 7-day action plan
- **[Task Templates](docs/planning/TASK_TEMPLATES.md)** - Templates for creating tasks
- **[Convoy Examples](docs/planning/CONVOY_EXAMPLES.md)** - How to organize work

Key focus areas:

1. Testing infrastructure and coverage
2. Documentation and user experience
3. Code quality and standards
4. Provider integration excellence
5. Security and reliability
6. Performance optimization

Check out the [issues](https://github.com/awelcing-alm/createsuite/issues) or join our community discussions!

## Project Status

**Current Version:** 0.1.0 (Pre-release)  
**Target:** v1.0.0 Production Release  
**Timeline:** 8-10 weeks  

See [Kickoff Project Plan](docs/planning/KICKOFF_PROJECT.md) for the complete roadmap.

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
