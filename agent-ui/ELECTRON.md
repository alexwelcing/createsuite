# CreateSuite Agent UI - Electron Desktop App

A Windows 95-styled desktop application for managing your CreateSuite agents, built with Electron, React, and xterm.js.

## Features

- 🪟 **Native Desktop App** - Runs as a standalone application on macOS, Windows, and Linux
- 🖥️ **Multiple Terminal Windows** - Manage multiple agent sessions with draggable windows
- 🎨 **Authentic 90s Aesthetic** - Windows 95 UI with react95
- 🔌 **Full Terminal Emulation** - Real shell access via xterm.js and node-pty
- 🤖 **Agent Management** - View and manage agents, tasks, and convoys
- 🌍 **Agent Village** - Visual representation of your agent ecosystem

## Quick Start

### Development Mode

Run the app in development mode with hot module replacement:

```bash
cd agent-ui
npm install
npm run electron:dev
```

This will:
1. Start the Vite dev server on port 5173
2. Wait for the server to be ready
3. Launch Electron and load the app

### Production Mode

Build and run the production version:

```bash
cd agent-ui
npm run build
npm run electron:start
```

### Package for Distribution

Create installers for your platform:

```bash
cd agent-ui
npm run electron:build
```

This will create installers in the `release/` directory:
- **macOS**: `.dmg` and `.zip`
- **Windows**: `.exe` (NSIS installer) and portable `.exe`
- **Linux**: `.AppImage` and `.deb`

## Architecture

### Main Process (`electron/main.js`)

The main process handles:
- Express server integration (port 3001)
- Socket.io for terminal management
- Window lifecycle management
- API endpoints for agents, tasks, convoys

### Renderer Process

The renderer loads the React app which includes:
- Terminal windows with xterm.js
- Agent Village visualization
- System monitor
- Task/Agent/Convoy management UI

### Preload Script (`electron/preload.js`)

Provides secure IPC bridge between main and renderer processes with:
- Platform detection
- Version information
- Secure context isolation

## API Endpoints

The embedded server provides these REST endpoints:

- `GET /api/skills` - Available skills with sprite assets
- `GET /api/tasks` - Outstanding tasks
- `GET /api/agents` - All agents and their state
- `GET /api/mailbox` - Aggregated agent messages
- `GET /api/providers` - Configured AI providers
- `POST /api/activate` - Activate provider for task

## Socket.io Events

Terminal management via WebSocket:

**Client → Server:**
- `spawn` - Create new terminal
- `input` - Send input to terminal
- `resize` - Resize terminal
- `disconnect` - Close terminal

**Server → Client:**
- `output` - Terminal output data
- `ui-command` - UI commands from terminal
- `exit` - Terminal process exited

## Configuration

### Electron Builder

The `package.json` includes electron-builder configuration:

```json
{
  "build": {
    "appId": "com.createsuite.agentui",
    "productName": "CreateSuite Agent UI",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "electron/**/*",
      "server/**/*",
      "package.json"
    ]
  }
}
```

### Environment Variables

- `NODE_ENV` - Set to `development` or `production`
- `PORT` - Server port (default: 3001)

## Development

### Project Structure

```
agent-ui/
├── electron/
│   ├── main.js          # Main process
│   └── preload.js       # Preload script
├── server/
│   ├── index.js         # Express server (embedded in main.js)
│   ├── spriteGenerator.js
│   └── package.json
├── src/
│   ├── App.tsx          # Main React app
│   ├── components/      # UI components
│   └── toolbench/       # Toolbench system
├── dist/                # Built React app
└── release/             # Packaged installers

```

### Scripts

- `npm run dev` - Start Vite dev server only
- `npm run build` - Build React app
- `npm run electron:dev` - Development mode with HMR
- `npm run electron:start` - Production mode
- `npm run electron:build` - Package for distribution

### Adding Features

To add new Electron features:

1. **Main Process Features** - Edit `electron/main.js`
2. **IPC Communication** - Add to `electron/preload.js`
3. **UI Features** - Edit React components in `src/`

## Troubleshooting

### Electron won't start

Make sure all dependencies are installed:
```bash
npm install
```

### Terminal not working

Check that node-pty is properly installed:
```bash
npm rebuild node-pty
```

### Build fails

Ensure you've built the React app first:
```bash
npm run build
```

### Port 3001 already in use

Kill any existing processes:
```bash
pkill -f "electron ."
```

## Demo Mode

Launch the app with demo data to showcase all features:

```bash
cs ui --demo
```

### What Demo Mode Shows

The demo mode opens 5 terminal windows, each running a specialized agent:

1. **Z.ai Agent (GLM 4.7)** - Coding specialist showing task queue processing
2. **Asset Generator (Hugging Face)** - Shows asset generation pipeline with progress
3. **Sisyphus (Claude)** - Task automation agent showing convoy progress
4. **Oracle (OpenAI)** - Architecture advisor showing system insights
5. **Architect (Kimi-K2.5)** - Deep system design specialist showing Phase 2 roadmap

### Demo Features

- ✅ All agents show meaningful output (no "connection failed")
- ✅ Real-time progress indicators
- ✅ System health monitoring
- ✅ Agent task status tracking
- ✅ Architecture recommendations

### Running Demo Without OpenCode

The demo mode is self-contained and doesn't require OpenCode to be installed. Each terminal shows pre-configured output demonstrating:

- Task management and progress
- Agent specialization
- System architecture insights
- Development recommendations

## Security

The app uses Electron security best practices:

- ✅ Context isolation enabled
- ✅ Node integration disabled
- ✅ Preload script for IPC
- ⚠️ CORS is permissive (development only)
- ⚠️ No authentication (local use only)

## Platform Support

- **macOS** - 10.13+ (High Sierra)
- **Windows** - Windows 10+
- **Linux** - Ubuntu 18.04+, Fedora 32+

## Dependencies

### Core
- `electron` - Desktop app framework
- `express` - Web server
- `socket.io` - WebSocket communication
- `node-pty` - Terminal emulation

### UI
- `react` - UI framework
- `react95` - Windows 95 UI components
- `xterm.js` - Terminal emulator
- `styled-components` - CSS-in-JS

### Build
- `electron-builder` - Packaging and distribution
- `vite` - Build tool
- `typescript` - Type safety

## Contributing

When contributing to the Electron app:

1. Test in both dev and production modes
2. Verify on all platforms if possible
3. Update this documentation
4. Follow the existing code style

## License

MIT

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [Electron Builder](https://www.electron.build/)
- [xterm.js](https://xtermjs.org/)
- [react95](https://react95.io/)
