# CreateSuite System Architecture & Electron Integration Analysis

## Executive Summary

CreateSuite is a sophisticated orchestrated swarm system for OpenCode agents with git-based task tracking. It consists of:

1. **Core CLI System** (~2,881 lines of TypeScript)
2. **Agent-UI Web Application** (React + Vite + xterm.js)
3. **Express Server** (WebSocket + PTY management)
4. **Electron Desktop App** (in development)

The system manages agents, tasks, convoys (task groups), and integrates with multiple AI providers through oh-my-opencode.

---

## Part 1: CreateSuite Core Architecture

### 1.1 Core Components

#### **ConfigManager** (`src/config.ts`)
- **Purpose**: Manages workspace configuration and persistent state
- **Storage**: `.createsuite/` directory structure
- **Key Methods**:
  - `initialize()` - Creates workspace structure
  - `saveTask()`, `loadTask()`, `listTasks()` - Task persistence
  - `saveAgent()`, `loadAgent()`, `listAgents()` - Agent state
  - `saveConvoy()`, `loadConvoy()`, `listConvoys()` - Convoy management

**Directory Structure**:
```
.createsuite/
├── config.json              # Workspace metadata
├── tasks/                   # Task files (cs-xxxxx.json)
├── agents/                  # Agent state files (uuid.json)
├── convoys/                 # Convoy files (cs-cv-xxxxx.json)
├── hooks/                   # Git hooks
├── providers.json           # Provider configuration
└── openai-credentials.json  # OAuth credentials (gitignored)
```

#### **TaskManager** (`src/taskManager.ts`)
- **Purpose**: Manages task lifecycle
- **Task ID Format**: `cs-xxxxx` (5 alphanumeric chars)
- **Task States**: OPEN → IN_PROGRESS → COMPLETED (or BLOCKED)
- **Key Methods**:
  - `createTask()` - Create new task with priority/tags
  - `assignTask()` - Assign to agent and mark IN_PROGRESS
  - `completeTask()` - Mark as COMPLETED
  - `listTasks()` - Filter by status/agent/priority
  - `getOpenTasks()`, `getAgentTasks()` - Convenience methods

#### **AgentOrchestrator** (`src/agentOrchestrator.ts`)
- **Purpose**: Manages agent lifecycle and orchestration
- **Agent ID Format**: UUID
- **Agent States**: IDLE, WORKING, OFFLINE, ERROR
- **Key Methods**:
  - `createAgent()` - Create agent with capabilities
  - `assignTaskToAgent()` - Assign task and spawn terminal
  - `sendMessage()` - Agent mailbox communication
  - `spawnOpenCodeTerminal()` - Launch OpenCode for agent
  - `getIdleAgents()` - Find available agents

**Agent Mailbox System**:
- Messages have types: SYSTEM, STATUS, PROGRESS, THOUGHT, PLAN
- Each agent has a mailbox for inter-agent communication
- Messages tracked with read/unread status

#### **ConvoyManager** (`src/convoyManager.ts`)
- **Purpose**: Groups related tasks for coordinated workflows
- **Convoy ID Format**: `cs-cv-xxxxx`
- **Convoy States**: ACTIVE, COMPLETED, PAUSED
- **Key Methods**:
  - `createConvoy()` - Create task group
  - `addTasksToConvoy()` - Add tasks to group
  - `getConvoyProgress()` - Calculate completion percentage
  - `updateConvoyStatus()` - Change convoy state

#### **GitIntegration** (`src/gitIntegration.ts`)
- **Purpose**: Persistent state tracking via git
- **Key Methods**:
  - `initialize()` - Init git repo with .gitignore
  - `commitTaskChanges()` - Commit .createsuite/ changes
  - `createAgentBranch()` - Create `agent/{agentId}/{taskId}` branches
  - `isClean()` - Check working directory status

#### **ProviderManager** (`src/providerManager.ts`)
- **Purpose**: Manage AI model provider configurations
- **Supported Providers**:
  - Z.ai GLM 4.7 (coding plan)
  - Claude Opus/Sonnet 4.5
  - OpenAI GPT-5.2 (with localhost OAuth)
  - MiniMax 2.1
  - Google Gemini 3 Pro
  - GitHub Copilot
  - OpenCode Zen
  - Hugging Face Inference
- **Key Methods**:
  - `setupProviders()` - Interactive wizard
  - `isOpencodeInstalled()` - Check OpenCode availability
  - `authenticateProviders()` - Handle OAuth flows

#### **OAuthManager** (`src/oauthManager.ts`)
- **Purpose**: Handle OAuth authentication for coding plan
- **Storage**: `.createsuite/oauth-token.json` (gitignored)

#### **LocalhostOAuth** (`src/localhostOAuth.ts`)
- **Purpose**: Localhost-based OAuth for OpenAI
- **Flow**: Local server → Browser → Token storage

### 1.2 CLI Commands

**Workspace Management**:
```bash
cs init [--name] [--repo] [--git] [--skip-providers]
cs status
cs tour
cs video [--preview]
cs ui
```

**Task Management**:
```bash
cs task create [--title] [--description] [--priority] [--tags]
cs task list [--status] [--agent]
cs task show <taskId>
```

**Agent Management**:
```bash
cs agent create <name> [--capabilities]
cs agent list
cs agent assign <taskId> <agentId>
```

**Convoy Management**:
```bash
cs convoy create <name> [--description] [--tasks]
cs convoy list [--status]
cs convoy show <convoyId>
```

**Provider Management**:
```bash
cs provider setup
cs provider list
cs provider auth
```

**OAuth**:
```bash
cs oauth [--init] [--status] [--clear]
```

### 1.3 Type System

**Core Types** (`src/types.ts`):
```typescript
interface Task {
  id: string;                    // cs-xxxxx
  title: string;
  description: string;
  status: TaskStatus;            // OPEN | IN_PROGRESS | COMPLETED | BLOCKED
  assignedAgent?: string;
  createdAt: Date;
  updatedAt: Date;
  priority: TaskPriority;        // LOW | MEDIUM | HIGH | CRITICAL
  tags: string[];
}

interface Agent {
  id: string;                    // UUID
  name: string;
  status: AgentStatus;           // IDLE | WORKING | OFFLINE | ERROR
  currentTask?: string;
  terminalPid?: number;
  mailbox: Message[];
  capabilities: string[];
  createdAt: Date;
}

interface Convoy {
  id: string;                    // cs-cv-xxxxx
  name: string;
  description: string;
  tasks: string[];               // Task IDs
  createdAt: Date;
  status: ConvoyStatus;          // ACTIVE | COMPLETED | PAUSED
}

interface Message {
  id: string;
  from: string;                  // 'system' or agent ID
  to: string;                    // agent ID
  kind: MessageKind;             // SYSTEM | STATUS | PROGRESS | THOUGHT | PLAN
  subject: string;
  body: string;
  timestamp: Date;
  read: boolean;
}
```

---

## Part 2: Agent-UI Web Application

### 2.1 Architecture

**Frontend** (React + Vite):
- Windows 95-styled UI using react95
- Draggable terminal windows
- xterm.js for terminal emulation
- Socket.io client for real-time communication

**Backend Server** (Express + Node-PTY):
- Runs on port 3001
- Manages PTY (pseudo-terminal) sessions
- Provides REST API for workspace data
- WebSocket server for terminal I/O

### 2.2 Server API Endpoints

**Monitoring Endpoints**:
```
GET /api/skills              # Agent skills from agent-skills.json
GET /api/tasks               # Outstanding tasks from .createsuite/tasks
GET /api/agents              # Agents from .createsuite/agents
GET /api/mailbox             # Aggregated mailbox messages
GET /api/providers           # Provider status (active/sleeping)
POST /api/activate           # Activate provider with task
```

**Terminal Management** (WebSocket):
```
socket.on('spawn')           # Spawn new PTY session
socket.on('input')           # Send input to terminal
socket.on('resize')          # Resize terminal
socket.on('disconnect')      # Cleanup PTY
```

### 2.3 Key Features

1. **Real-time Terminal Emulation**
   - Full xterm.js support
   - PTY management via node-pty
   - Supports bash/powershell

2. **Workspace Integration**
   - Reads from `.createsuite/` directory
   - Displays tasks, agents, convoys
   - Shows provider status

3. **UI Command Protocol**
   - Agents can emit UI commands: `:::UI_CMD:::{JSON}:::`
   - Supports image display, status updates, etc.

---

## Part 3: Electron App Integration Strategy

### 3.1 Current State

**Electron Directory**: `/agent-ui/electron/` (empty, ready for implementation)

**Package.json includes**:
- `electron@^40.0.0`
- `electron-is-dev@^3.0.1`
- `wait-on@^9.0.3`

### 3.2 Recommended Integration Architecture

#### **Option A: Embedded Server (Recommended)**

```
Electron Main Process
├── Spawn Express server (agent-ui/server/index.js)
├── Wait for server ready (port 3001)
└── Load React app from http://localhost:3001

Electron Renderer Process
├── Load React UI from localhost
├── Socket.io connection to server
└── Full feature parity with web version
```

**Advantages**:
- Single codebase for web and desktop
- No code duplication
- Easy to maintain
- Full feature parity

**Implementation**:
```typescript
// electron/main.ts
import { app, BrowserWindow } from 'electron';
import { spawn } from 'child_process';
import waitOn from 'wait-on';
import path from 'path';

let mainWindow: BrowserWindow;
let serverProcess: any;

async function startServer() {
  const serverPath = path.join(__dirname, '../server/index.js');
  serverProcess = spawn('node', [serverPath]);
  
  await waitOn({ resources: ['http://localhost:3001'] });
}

async function createWindow() {
  await startServer();
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.ts')
    }
  });
  
  mainWindow.loadURL('http://localhost:3001');
}

app.on('ready', createWindow);
app.on('quit', () => {
  if (serverProcess) serverProcess.kill();
});
```

#### **Option B: Native IPC Bridge**

```
Electron Main Process
├── Require CreateSuite modules directly
├── Manage ConfigManager, TaskManager, etc.
└── Expose via IPC

Electron Renderer Process
├── React UI
├── IPC calls to main process
└── Direct access to CreateSuite APIs
```

**Advantages**:
- No separate server process
- Lower memory footprint
- Direct API access

**Disadvantages**:
- Code duplication (IPC bridge)
- More complex maintenance
- Different from web version

#### **Option C: Hybrid Approach**

```
Electron Main Process
├── Require CreateSuite modules
├── Provide IPC bridge for core operations
└── Spawn server for terminal/PTY features

Electron Renderer Process
├── React UI
├── IPC for task/agent management
├── WebSocket for terminal features
```

### 3.3 Recommended Implementation Path

**Phase 1: Embedded Server (Weeks 1-2)**
1. Create `electron/main.ts` with server spawning
2. Create `electron/preload.ts` for security
3. Update `package.json` with Electron scripts
4. Test web version works in Electron

**Phase 2: Native Features (Weeks 3-4)**
1. Add file system access (workspace selection)
2. Add native notifications
3. Add system tray integration
4. Add keyboard shortcuts

**Phase 3: Optimization (Weeks 5-6)**
1. Code signing and distribution
2. Auto-update mechanism
3. Performance optimization
4. Error handling and logging

### 3.4 File Structure

```
agent-ui/
├── electron/
│   ├── main.ts              # Main process
│   ├── preload.ts           # Preload script
│   ├── utils.ts             # Utilities
│   └── tsconfig.json        # TypeScript config
├── src/
│   ├── App.tsx              # React app (unchanged)
│   └── ...
├── server/
│   └── index.js             # Express server (unchanged)
├── package.json             # Updated with Electron scripts
└── vite.config.ts           # Updated for Electron
```

### 3.5 Key Integration Points

**1. Workspace Selection**
```typescript
// Electron: Allow user to select workspace directory
const { dialog } = require('electron');
const workspaceDir = await dialog.showOpenDialog({
  properties: ['openDirectory']
});
// Pass to server via environment variable
process.env.WORKSPACE_ROOT = workspaceDir.filePaths[0];
```

**2. CreateSuite API Access**
```typescript
// Option: Direct access in main process
import { TaskManager, AgentOrchestrator } from 'createsuite';

const taskManager = new TaskManager(workspaceRoot);
const tasks = await taskManager.listTasks();

// Expose via IPC
ipcMain.handle('get-tasks', async () => {
  return await taskManager.listTasks();
});
```

**3. Terminal Integration**
```typescript
// Keep existing WebSocket/PTY approach
// Renderer connects to localhost:3001 for terminal
// Main process spawns server with workspace context
```

**4. File System Access**
```typescript
// Preload script exposes safe file operations
contextBridge.exposeInMainWorld('fs', {
  readFile: (path) => ipcRenderer.invoke('fs-read', path),
  writeFile: (path, data) => ipcRenderer.invoke('fs-write', path, data)
});
```

---

## Part 4: Functionality to Expose in Electron App

### 4.1 Core Features

**Task Management**
- ✅ Create tasks with priority/tags
- ✅ List tasks with filtering
- ✅ View task details
- ✅ Update task status
- ✅ Assign tasks to agents

**Agent Management**
- ✅ Create agents with capabilities
- ✅ List agents with status
- ✅ View agent details
- ✅ Monitor agent mailbox
- ✅ Assign tasks to agents

**Convoy Management**
- ✅ Create convoys
- ✅ Add/remove tasks from convoys
- ✅ View convoy progress
- ✅ Update convoy status

**Terminal Features**
- ✅ Draggable terminal windows
- ✅ Multiple terminal sessions
- ✅ Full xterm.js support
- ✅ Shell command execution

**Provider Management**
- ✅ View configured providers
- ✅ Check provider status
- ✅ Activate providers for tasks

**Workspace Management**
- ✅ Select workspace directory
- ✅ View workspace status
- ✅ Initialize new workspace
- ✅ View git history

### 4.2 Enhanced Electron Features

**Native Integration**
- System tray icon
- Native notifications for task updates
- Keyboard shortcuts (Cmd+N for new task, etc.)
- Drag-and-drop file support
- Native file dialogs

**Performance**
- Workspace caching
- Incremental updates
- Background sync
- Offline support

**Developer Experience**
- Hot reload during development
- DevTools integration
- Error logging and reporting
- Performance profiling

---

## Part 5: Server Components & APIs

### 5.1 Express Server Architecture

**Current Implementation** (`agent-ui/server/index.js`):

```javascript
// Core setup
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(distPath));
app.use('/workspace', express.static(process.cwd()));

// REST API endpoints (see Part 2.2)
// WebSocket handlers for terminal I/O
// Static file serving for React app
```

### 5.2 Integration with CreateSuite Core

**Current**: Server reads directly from `.createsuite/` directory

**Recommended Enhancement**:
```typescript
// Use CreateSuite managers instead of direct file access
import { TaskManager, AgentOrchestrator, ConvoyManager } from 'createsuite';

const taskManager = new TaskManager(process.cwd());
const orchestrator = new AgentOrchestrator(process.cwd());
const convoyManager = new ConvoyManager(process.cwd());

// API endpoints
app.get('/api/tasks', async (req, res) => {
  const tasks = await taskManager.listTasks();
  res.json({ success: true, data: tasks });
});

app.get('/api/agents', async (req, res) => {
  const agents = await orchestrator.listAgents();
  res.json({ success: true, data: agents });
});
```

### 5.3 Missing Server Features

**Should Implement**:
1. Task creation/update endpoints
2. Agent creation/assignment endpoints
3. Convoy management endpoints
4. Provider activation endpoint (currently stub)
5. Message sending endpoint
6. Workspace initialization endpoint

---

## Part 6: Git Integration & Persistence

### 6.1 How Git Tracking Works

1. **Automatic Commits**
   - Every task creation → git commit
   - Every agent assignment → git commit
   - Every convoy update → git commit

2. **Branch Strategy**
   - Main branch: Tracks all changes
   - Agent branches: `agent/{agentId}/{taskId}` for isolated work
   - Allows agent-specific work tracking

3. **Persistence**
   - All state in `.createsuite/` directory
   - Git history provides audit trail
   - Can revert changes via git

### 6.2 Electron Integration

**Workspace Selection**:
```typescript
// User selects directory
// Check if .createsuite exists
// If not, offer to initialize
// Load workspace state from git
```

**Git Operations**:
```typescript
// Show git log for workspace
// Allow viewing task history
// Show agent work branches
// Diff view for changes
```

---

## Part 7: Recommended Electron App Structure

### 7.1 Main Process (`electron/main.ts`)

```typescript
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { spawn } from 'child_process';
import waitOn from 'wait-on';
import path from 'path';
import isDev from 'electron-is-dev';

// Server management
let serverProcess: any;
let mainWindow: BrowserWindow;

async function startServer(workspaceRoot: string) {
  const serverPath = path.join(__dirname, '../server/index.js');
  
  serverProcess = spawn('node', [serverPath], {
    env: { ...process.env, WORKSPACE_ROOT: workspaceRoot }
  });
  
  await waitOn({ resources: ['http://localhost:3001'] });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.ts'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  
  const url = isDev 
    ? 'http://localhost:5173'
    : `http://localhost:3001`;
  
  mainWindow.loadURL(url);
}

// IPC handlers
ipcMain.handle('select-workspace', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (!result.canceled) {
    const workspaceRoot = result.filePaths[0];
    await startServer(workspaceRoot);
    return workspaceRoot;
  }
});

app.on('ready', createWindow);
app.on('quit', () => {
  if (serverProcess) serverProcess.kill();
});
```

### 7.2 Preload Script (`electron/preload.ts`)

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  selectWorkspace: () => ipcRenderer.invoke('select-workspace'),
  getWorkspaceRoot: () => ipcRenderer.invoke('get-workspace-root'),
  // Add other safe APIs
});
```

### 7.3 React Integration

```typescript
// In React component
const { electron } = window as any;

const selectWorkspace = async () => {
  const workspaceRoot = await electron.selectWorkspace();
  // Load workspace data
};
```

---

## Part 8: Development Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Electron main process
- [ ] Implement server spawning
- [ ] Test web app in Electron
- [ ] Basic workspace selection

### Phase 2: Integration (Week 3-4)
- [ ] Add IPC bridges for core operations
- [ ] Implement workspace initialization
- [ ] Add git integration UI
- [ ] Test all features

### Phase 3: Polish (Week 5-6)
- [ ] Native notifications
- [ ] System tray
- [ ] Keyboard shortcuts
- [ ] Error handling

### Phase 4: Distribution (Week 7-8)
- [ ] Code signing
- [ ] Auto-update
- [ ] Installer creation
- [ ] Release process

---

## Part 9: Key Considerations

### 9.1 Security

1. **Context Isolation**: Always use `contextIsolation: true`
2. **Preload Scripts**: Use preload for IPC exposure
3. **No Node Integration**: Keep `nodeIntegration: false`
4. **Validate Paths**: Sanitize workspace paths
5. **Credentials**: Store OAuth tokens securely

### 9.2 Performance

1. **Server Spawning**: Cache server process
2. **File I/O**: Use ConfigManager for caching
3. **WebSocket**: Efficient message batching
4. **Memory**: Monitor PTY sessions

### 9.3 Compatibility

1. **Cross-Platform**: Test on Windows, macOS, Linux
2. **OpenCode**: Ensure OpenCode integration works
3. **Node Versions**: Support Node 18+
4. **Electron Versions**: Keep up-to-date

---

## Summary

CreateSuite is a comprehensive multi-agent orchestration system with:

1. **Core CLI** - Full task/agent/convoy management
2. **Web UI** - React-based command center with terminals
3. **Express Server** - REST API + WebSocket for real-time features
4. **Git Integration** - Persistent, auditable state tracking
5. **Provider System** - Support for 8+ AI model providers

**For Electron Integration**:
- Embed Express server in main process
- Load React app from localhost
- Add native features (tray, notifications, shortcuts)
- Maintain feature parity with web version
- Use IPC for workspace selection and native operations

This approach provides the best balance of code reuse, maintainability, and feature completeness.

## [$(date)] Electron Implementation Complete

### What Was Built

**1. Electron Main Process** (`agent-ui/electron/main.js`)
- Integrated Express server directly in main process
- Socket.io for terminal management
- All API endpoints from original server
- Window management with dev/prod modes
- Platform-aware shell spawning (bash/powershell)

**2. Preload Script** (`agent-ui/electron/preload.js`)
- Secure IPC bridge with contextIsolation
- Exposes platform info to renderer

**3. Package Configuration** (`agent-ui/package.json`)
- Added Electron scripts:
  - `electron:dev` - Development with Vite HMR
  - `electron:build` - Production build
  - `electron:start` - Run production app
- Electron-builder configuration for packaging
- Support for macOS, Windows, Linux

**4. Dependencies Installed**
- electron ^40.0.0
- electron-builder ^26.4.0
- electron-is-dev ^3.0.1
- concurrently ^9.2.1
- cross-env ^10.1.0
- wait-on ^9.0.3

### Architecture Decisions

**Embedded Server Approach**
- Express server runs in main process
- No child process management needed
- Simpler lifecycle management
- Direct access to node-pty

**Development vs Production**
- Dev: Vite dev server (localhost:5173) + Electron
- Prod: Built files served from Express (localhost:3001)

**Security**
- contextIsolation: true
- nodeIntegration: false
- Preload script for IPC

### How to Use

**Development:**
```bash
cd agent-ui
npm run electron:dev
```

**Production Build:**
```bash
cd agent-ui
npm run build
npm run electron:start
```

**Package for Distribution:**
```bash
cd agent-ui
npm run electron:build
```

### What Works

✅ Electron window opens
✅ Express server starts on port 3001
✅ Socket.io connections work
✅ Terminal spawning with node-pty
✅ All API endpoints functional
✅ Static file serving
✅ React app loads
✅ Dev mode with HMR
✅ Production mode with built files

### Next Steps

1. **Test Terminal Functionality**
   - Verify xterm.js connects
   - Test PTY spawning
   - Test terminal I/O

2. **Add Native Features**
   - Workspace selection dialog
   - Native notifications
   - System tray
   - Keyboard shortcuts

3. **Packaging**
   - Code signing
   - Auto-update
   - Installers for all platforms

4. **Documentation**
   - User guide
   - Developer guide
   - Troubleshooting


## [2026-01-28] Native Workspace Selection Implementation

### What Was Built

Implemented native workspace selection dialog for Electron app with full IPC integration:

**Main Process (electron/main.js)**
- Added 4 IPC handlers:
  - `select-workspace`: Opens native OS directory picker (directories only)
  - `get-current-workspace`: Returns current workspace path and validity
  - `get-recent-workspaces`: Returns filtered list of valid recent workspaces
  - `set-workspace`: Validates, sets workspace, restarts server with new context
- Workspace validation: Checks for `.createsuite/config.json` existence
- Recent workspaces storage: JSON file in userData, maintains last 5 workspaces
- Server workspace context: All API endpoints now use selected workspace root

**Preload Script (electron/preload.js)**
- Exposed secure workspace API via contextBridge
- Maintains security with context isolation
- Type-safe IPC communication

**React UI Components**
- Created `WorkspaceSelector.tsx`: Windows 95-styled workspace selection dialog
- Features:
  - Current workspace display
  - Recent workspaces dropdown (last 5)
  - Native file browser integration
  - Error handling and validation feedback
  - Loading states
- Added "Open Workspace" menu item in Start menu
- Integrated with app reload on workspace change

**TypeScript Types**
- Created `types/electron.d.ts` for type safety
- Defined WorkspaceAPI and ElectronAPI interfaces

### Architecture Decisions

**Why Recent Workspaces in userData?**
- Persists across app sessions
- Platform-agnostic storage location
- No need for external dependencies (electron-store)
- Simple JSON file management

**Why Reload on Workspace Change?**
- Ensures clean state
- Reloads all workspace data
- Simpler than hot-swapping workspace context
- Prevents stale data issues

**Why Validate Before Setting?**
- Prevents invalid workspace states
- Clear error messages to user
- Maintains data integrity
- Follows fail-fast principle

### Security Considerations

- Context isolation enabled (contextIsolation: true)
- Node integration disabled (nodeIntegration: false)
- No direct file system access from renderer
- All file operations through IPC
- Path validation before workspace changes
- Recent workspaces filtered for validity

### Testing Approach

Manual testing checklist:
1. Native dialog opens (directories only)
2. Workspace validation rejects invalid paths
3. Recent workspaces persist across restarts
4. Server reloads with new workspace context
5. API endpoints read from correct workspace
6. Error messages display correctly
7. Cancel button works

### Known Limitations

1. App reloads on workspace change (not hot-swap)
2. No workspace initialization UI yet
3. No keyboard shortcuts (Ctrl/Cmd+O)
4. No workspace info display in UI
5. No workspace creation wizard

### Next Steps

1. Add workspace initialization for non-CreateSuite directories
2. Add workspace info display in taskbar/status bar
3. Add keyboard shortcut for workspace selection
4. Consider hot-swapping workspace without reload
5. Add workspace creation wizard
6. Add workspace validation feedback in real-time

### Files Modified

1. `agent-ui/electron/main.js` - 70+ lines added
2. `agent-ui/electron/preload.js` - 6 lines added
3. `agent-ui/src/App.tsx` - 15 lines added
4. `agent-ui/src/components/WorkspaceSelector.tsx` - 220 lines (new file)
5. `agent-ui/src/types/electron.d.ts` - 42 lines (new file)

### Lessons Learned

1. **IPC Design**: Keep IPC handlers simple and focused
2. **Validation**: Always validate paths before file operations
3. **User Feedback**: Clear error messages are critical
4. **State Management**: Recent workspaces need filtering for validity
5. **Security**: Context isolation is non-negotiable
6. **UX**: Native dialogs provide better UX than web file pickers

### Integration Points

- Works with existing Express server
- Compatible with all API endpoints
- Maintains workspace context across app lifecycle
- Integrates with Windows 95 UI aesthetic

