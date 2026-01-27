# CreateSuite Architecture

## Overview

CreateSuite is an orchestrated swarm system that enables multiple OpenCode agents to work collaboratively on tasks, with git-backed persistence for reliable state tracking.

## Design Principles

1. **First-Class Agents**: Agents are autonomous entities with identity, state, and communication
2. **Git-Backed Persistence**: All state persists in git for reliability and auditability
3. **Minimal Overhead**: Lightweight design focused on essential features
4. **OpenCode Native**: Built specifically for OpenCode terminal integration

## Component Architecture

### ConfigManager
- Manages workspace configuration
- Handles file-based persistence
- Coordinates storage paths
- Provides CRUD operations for all entities

### TaskManager
- Creates and manages tasks (cs-xxxxx format)
- Tracks task lifecycle (OPEN → IN_PROGRESS → COMPLETED)
- Supports filtering and searching
- Integrates with git for persistence

### AgentOrchestrator
- Creates and manages agents
- Handles agent-to-task assignment
- Manages agent mailboxes for communication
- Coordinates OpenCode terminal spawning
- Tracks agent status (IDLE, WORKING, OFFLINE, ERROR)

### ConvoyManager
- Groups related tasks into convoys
- Tracks convoy progress
- Manages convoy lifecycle
- Provides aggregated views of task completion

### GitIntegration
- Initializes git repositories
- Commits task/agent/convoy changes
- Creates agent-specific branches
- Provides git status and history

### OAuthManager
- Handles OAuth token storage and retrieval
- Manages token expiration
- Provides OAuth flow initialization
- Secures credentials with appropriate file permissions

## Data Models

### Task
```typescript
{
  id: string;              // cs-xxxxx format
  title: string;
  description: string;
  status: TaskStatus;      // open | in_progress | completed | blocked
  assignedAgent?: string;
  createdAt: Date;
  updatedAt: Date;
  priority: TaskPriority;  // low | medium | high | critical
  tags: string[];
}
```

### Agent
```typescript
{
  id: string;              // UUID
  name: string;
  status: AgentStatus;     // idle | working | offline | error
  currentTask?: string;
  terminalPid?: number;
  mailbox: Message[];
  capabilities: string[];
  createdAt: Date;
}
```

### Convoy
```typescript
{
  id: string;              // cs-cv-xxxxx format
  name: string;
  description: string;
  tasks: string[];         // Array of task IDs
  createdAt: Date;
  status: ConvoyStatus;    // active | completed | paused
}
```

## Communication Flow

```
User → CLI → Manager → ConfigManager → File System → Git
                ↓
         AgentOrchestrator → OpenCode Terminal
                ↓
         Agent Mailbox → Agent
```

## Storage Layout

```
workspace/
├── .createsuite/
│   ├── config.json              # Workspace config
│   ├── tasks/
│   │   ├── cs-abc12.json       # Task files
│   │   └── cs-def34.json
│   ├── agents/
│   │   ├── <uuid-1>.json       # Agent state
│   │   └── <uuid-2>.json
│   ├── convoys/
│   │   ├── cs-cv-xyz12.json    # Convoy groups
│   │   └── cs-cv-uvw34.json
│   ├── hooks/                   # Git hooks (future)
│   └── oauth-token.json         # OAuth credentials (gitignored)
└── .git/                        # Git repository
```

## Extension Points

### Custom Agent Capabilities
Agents can be created with specific capabilities that describe their strengths:
- `frontend` - React, Vue, Angular expertise
- `backend` - API, database, server-side
- `testing` - Unit tests, integration tests
- `devops` - CI/CD, deployment
- `general` - General-purpose work

### Task Priority Levels
Tasks support four priority levels:
- `low` - Nice to have, non-urgent
- `medium` - Standard priority (default)
- `high` - Important, needs attention soon
- `critical` - Urgent, blocking work

### Convoy Status
Convoys can be in different states:
- `active` - Currently being worked on
- `completed` - All tasks done
- `paused` - Temporarily on hold

## Future Enhancements

1. **Formula System**: Predefined workflows (similar to Gastown's formulas)
2. **Agent Handoffs**: Transfer work between agents
3. **Task Dependencies**: Define prerequisite relationships
4. **Real-time Monitoring**: Live dashboard for agent activity
5. **Multi-Repo Support**: Work across multiple repositories
6. **Smart Assignment**: Auto-assign tasks based on agent capabilities
7. **Conflict Resolution**: Handle merge conflicts in agent branches
8. **Agent Learning**: Track agent performance and improve assignments
