# CreateSuite File Reference Guide

## Core System Files

### Main Entry Points
- **`/workspaces/createsuite/src/cli.ts`** (623 lines)
  - All CLI commands (30+)
  - Command parsing with Commander.js
  - Integration with all managers
  - **Key Commands**: init, task, agent, convoy, provider, oauth, status, tour, video, ui

- **`/workspaces/createsuite/src/index.ts`** (17 lines)
  - Public API exports
  - Exports all managers and types for programmatic use

### Core Managers

- **`/workspaces/createsuite/src/config.ts`** (259 lines)
  - ConfigManager class
  - Workspace initialization
  - Task/Agent/Convoy persistence
  - Directory structure: `.createsuite/`
  - **Key Methods**: initialize, saveTask, loadTask, listTasks, saveAgent, loadAgent, listAgents, saveConvoy, loadConvoy, listConvoys

- **`/workspaces/createsuite/src/taskManager.ts`** (142 lines)
  - TaskManager class
  - Task lifecycle management
  - Task ID generation (cs-xxxxx format)
  - **Key Methods**: createTask, getTask, updateTask, assignTask, completeTask, listTasks, getTasksByStatus, getOpenTasks, getAgentTasks

- **`/workspaces/createsuite/src/agentOrchestrator.ts`** (224 lines)
  - AgentOrchestrator class
  - Agent lifecycle management
  - Mailbox system for inter-agent communication
  - OpenCode terminal spawning
  - **Key Methods**: createAgent, getAgent, updateAgent, listAgents, getIdleAgents, sendMessage, getUnreadMessages, markMessageRead, spawnOpenCodeTerminal, assignTaskToAgent, stopAgent

- **`/workspaces/createsuite/src/convoyManager.ts`** (168 lines)
  - ConvoyManager class
  - Convoy (task group) management
  - Progress tracking
  - **Key Methods**: createConvoy, getConvoy, addTasksToConvoy, removeTaskFromConvoy, updateConvoyStatus, listConvoys, getConvoyProgress

- **`/workspaces/createsuite/src/gitIntegration.ts`** (143 lines)
  - GitIntegration class
  - Git repository initialization
  - Automatic commits for task changes
  - Agent branch creation
  - **Key Methods**: initialize, commitTaskChanges, createAgentBranch, getCurrentBranch, switchToMain, getStatus, getLog, stageTaskData, isClean

- **`/workspaces/createsuite/src/providerManager.ts`** (100+ lines)
  - ProviderManager class
  - AI provider configuration
  - Provider setup wizard
  - OpenCode integration
  - **Supported Providers**: Z.ai GLM, Claude, OpenAI, MiniMax, Gemini, GitHub Copilot, OpenCode Zen, Hugging Face
  - **Key Methods**: isOpencodeInstalled, installOpencode, isOhMyOpencodeConfigured, setupProviders, listProviders, authenticateProviders

- **`/workspaces/createsuite/src/oauthManager.ts`**
  - OAuthManager class
  - OAuth token management
  - Coding plan authentication

- **`/workspaces/createsuite/src/localhostOAuth.ts`**
  - LocalhostOAuth class
  - Localhost-based OAuth flow
  - OpenAI authentication

### Type Definitions

- **`/workspaces/createsuite/src/types.ts`** (111 lines)
  - Task interface (id, title, description, status, priority, tags)
  - TaskStatus enum (OPEN, IN_PROGRESS, COMPLETED, BLOCKED)
  - TaskPriority enum (LOW, MEDIUM, HIGH, CRITICAL)
  - Agent interface (id, name, status, currentTask, mailbox, capabilities)
  - AgentStatus enum (IDLE, WORKING, OFFLINE, ERROR)
  - Message interface (id, from, to, kind, subject, body, timestamp, read)
  - MessageKind enum (SYSTEM, STATUS, PROGRESS, THOUGHT, PLAN)
  - Convoy interface (id, name, description, tasks, status)
  - ConvoyStatus enum (ACTIVE, COMPLETED, PAUSED)
  - WorkspaceConfig interface
  - OAuthConfig interface

## Server & UI Files

### Express Server

- **`/workspaces/createsuite/agent-ui/server/index.js`** (335 lines)
  - Express server setup
  - CORS and middleware configuration
  - REST API endpoints:
    - `GET /api/skills` - Agent skills
    - `GET /api/tasks` - Outstanding tasks
    - `GET /api/agents` - Agents list
    - `GET /api/mailbox` - Aggregated messages
    - `GET /api/providers` - Provider status
    - `POST /api/activate` - Activate provider
  - WebSocket handlers:
    - `spawn` - Create PTY session
    - `input` - Send terminal input
    - `resize` - Resize terminal
    - `disconnect` - Cleanup
  - Static file serving
  - PTY management via node-pty

- **`/workspaces/createsuite/agent-ui/server/spriteGenerator.js`**
  - Sprite generation for UI

### React Frontend

- **`/workspaces/createsuite/agent-ui/src/`**
  - React components for UI
  - Windows 95 styled interface
  - Terminal emulation with xterm.js
  - Draggable windows

### Configuration Files

- **`/workspaces/createsuite/package.json`**
  - Main project dependencies
  - Scripts: build, start, dev, test
  - Dependencies: chalk, commander, inquirer, oh-my-opencode, puppeteer, react, remotion, simple-git, uuid
  - DevDependencies: TypeScript, ts-node, @types/*

- **`/workspaces/createsuite/agent-ui/package.json`**
  - Agent UI dependencies
  - Scripts: dev, build, lint, preview
  - Dependencies: xterm, react, react-draggable, react95, socket.io-client, styled-components
  - DevDependencies: Electron, Vite, TypeScript, ESLint

- **`/workspaces/createsuite/tsconfig.json`**
  - TypeScript configuration

## Workspace Structure

### .createsuite Directory

- **`.createsuite/config.json`**
  - Workspace metadata
  - Name, path, repository URL
  - OAuth configuration

- **`.createsuite/tasks/`**
  - Individual task files (cs-xxxxx.json)
  - Each file contains full task object

- **`.createsuite/agents/`**
  - Individual agent state files (uuid.json)
  - Contains agent info, status, mailbox

- **`.createsuite/convoys/`**
  - Individual convoy files (cs-cv-xxxxx.json)
  - Contains convoy info and task list

- **`.createsuite/providers.json`**
  - Provider configuration
  - List of enabled/authenticated providers

- **`.createsuite/openai-credentials.json`** (gitignored)
  - OAuth tokens for OpenAI

- **`.createsuite/hooks/`**
  - Git hooks for persistence

## Documentation Files

- **`/workspaces/createsuite/README.md`**
  - Project overview
  - Installation and quick start
  - CLI commands reference
  - Architecture overview
  - Workflow examples

- **`/workspaces/createsuite/docs/`**
  - Comprehensive documentation
  - Guides, architecture, providers, planning, testing

## Electron App Files (To Create)

- **`/workspaces/createsuite/agent-ui/electron/main.ts`** (To create)
  - Main process
  - Server spawning
  - Window management
  - IPC handlers

- **`/workspaces/createsuite/agent-ui/electron/preload.ts`** (To create)
  - Preload script
  - IPC bridge
  - Security context

- **`/workspaces/createsuite/agent-ui/electron/utils.ts`** (To create)
  - Utility functions
  - Path handling
  - Process management

## Key Statistics

- **Total TypeScript Lines**: ~2,881 (src/)
- **Core Managers**: 7
- **CLI Commands**: 30+
- **API Endpoints**: 6 REST + 4 WebSocket
- **Supported Providers**: 8
- **Task States**: 4
- **Agent States**: 4
- **Message Types**: 5

## File Dependencies

```
cli.ts
├── config.ts
├── taskManager.ts
│   └── config.ts
├── agentOrchestrator.ts
│   └── config.ts
├── convoyManager.ts
│   ├── config.ts
│   └── taskManager.ts
├── gitIntegration.ts
├── oauthManager.ts
├── providerManager.ts
│   └── localhostOAuth.ts
└── types.ts

server/index.js
├── express
├── socket.io
├── node-pty
└── Reads from .createsuite/

React App
├── xterm.js
├── react95
├── socket.io-client
└── Connects to server
```

## How to Navigate the Codebase

1. **Start with types.ts** - Understand the data structures
2. **Read cli.ts** - See all available commands
3. **Study ConfigManager** - Understand persistence
4. **Learn TaskManager** - Task lifecycle
5. **Explore AgentOrchestrator** - Agent management
6. **Check ConvoyManager** - Task grouping
7. **Review GitIntegration** - State tracking
8. **Examine server/index.js** - API and WebSocket
9. **Look at React components** - UI implementation

## Integration Points for Electron

1. **Server spawning** - Main process spawns `server/index.js`
2. **Workspace selection** - IPC dialog for directory selection
3. **React app loading** - Load from `http://localhost:3001`
4. **Terminal management** - WebSocket to server
5. **Native features** - IPC for notifications, tray, shortcuts
6. **File operations** - IPC for safe file access

## Testing Files

- **`/workspaces/createsuite/docs/testing/TESTING.md`**
  - Testing guide for video tour feature

## Planning & Documentation

- **`/workspaces/createsuite/docs/planning/KICKOFF_PROJECT.md`**
  - 10-phase roadmap
- **`/workspaces/createsuite/docs/planning/POLISH_CHECKLIST.md`**
  - Progress tracking
- **`/workspaces/createsuite/docs/planning/IMMEDIATE_ACTIONS.md`**
  - 7-day action plan
