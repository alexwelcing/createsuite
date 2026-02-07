# CreateSuite Agent UI Architecture

## Overview

The Agent UI is the central command center for CreateSuite, providing a visual interface for orchestrating AI agents. Designed with a nostalgic macOS-inspired aesthetic, it allows users to manage multiple AI assistants (like Claude, GPT, and Gemini) in parallel terminal sessions.

The UI serves as a dashboard where users can:
- **Spawn Agents:** Launch new agent instances on Fly.io machines.
- **Monitor Activities:** Watch agents work in real-time through terminal windows.
- **Manage Lifecycle:** Control the startup and shutdown of agent environments.
- **Orchestrate Work:** Use the "Agent Village" concept to coordinate multiple agents working on complex tasks.

## Architecture

The Agent UI is built as a full-stack application with a React frontend and an Express/Socket.IO backend.

### Frontend (`agent-ui/src`)

- **Framework:** React with TypeScript and Vite.
- **Styling:** Custom CSS and Styled Components implementing a macOS desktop theme (`agent-ui/src/theme/macos.ts`).
- **Terminal Emulation:** Uses `xterm.js` to render full-featured terminal windows in the browser.
- **State Management:** React hooks and context for managing window states, active agents, and desktop environment.

**Key Components:**
- `App.tsx`: The main desktop environment container.
- `TerminalWindow`: Wraps xterm.js to provide the CLI interface for agents.
- `AgentDashboard`: The control panel for spawning and managing agent instances.
- `LifecycleNotification`: UI for handling auto-shutdown warnings and activity monitoring.

### Backend (`agent-ui/server`)

- **Server:** Node.js with Express.
- **Real-time Communication:** Socket.IO for streaming terminal output and status updates between the server and the frontend.
- **Terminal Management:** Uses `node-pty` to spawn real shell sessions that are piped to the frontend terminals.
- **Agent Orchestration:**
  - `agentSpawner.js`: Handles the logic for spinning up new agent processes or containers (specifically on Fly.io).
  - `lifecycleManager.js`: Monitors activity and handles automatic shutdown to save costs when agents are idle.

### Connection to CLI/Backend

The Agent UI connects to the core CreateSuite backend logic through the server's API and shell sessions. When a user interacts with the terminal in the UI, commands are executed on the server, which can then invoke the CreateSuite CLI (`cs`) or direct library calls to perform tasks.

## Setup & Development

To run the Agent UI locally for development:

1.  **Navigate to the directory:**
    ```bash
    cd agent-ui
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    cd server && npm install && cd ..
    ```

3.  **Run the development servers:**
    You need to run both the frontend and backend servers.

    **Option A: Concurrent (Recommended)**
    ```bash
    npm run dev:all
    ```
    *(Note: Check `package.json` if this script exists, otherwise use Option B)*

    **Option B: Separate Terminals**
    
    *Terminal 1 (Frontend):*
    ```bash
    npm run dev
    ```
    
    *Terminal 2 (Backend):*
    ```bash
    cd server
    node index.js
    ```

4.  **Access the UI:**
    Open your browser and navigate to `http://localhost:5173` (or the port shown in your terminal).

## Deployment

The Agent UI is configured for deployment on platforms like Fly.io or Render.
- **Fly.io:** Uses `fly.toml` for configuration.
- **Docker:** A `Dockerfile` is included for containerized deployments.

See `docs/guides/DEPLOY_RENDER.md` for detailed deployment instructions.
