const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const pty = require('node-pty');
const os = require('os');
const cors = require('cors');
const { execSync } = require('child_process');
const path = require('path');

const app = express();
app.use(cors());

// Serve static files from the React app build directory
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Serve project workspace files (allows accessing generated assets)
app.use('/workspace', express.static(process.cwd()));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const SHELL = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

// Check for opencode
try {
  const opencodePath = execSync('which opencode', { encoding: 'utf-8' }).trim();
  console.log('Found opencode at:', opencodePath);
} catch (e) {
  console.warn('⚠️  Warning: opencode command not found in PATH. Agents may not start correctly.');
}

io.on('connection', (socket) => {
  console.log('Client connected', socket.id);
  
  let ptyProcess = null;

  socket.on('spawn', ({ cols, rows }) => {
    if (ptyProcess) {
      ptyProcess.kill();
    }

    console.log(`Spawning shell: ${SHELL}`);

    // Spawn the shell. In a real scenario, this might be 'opencode' directly
    // or a shell that has opencode in the path.
    // We add '-l' to bash to make it a login shell and load .bashrc/.profile
    const args = SHELL === 'bash' ? ['-l'] : [];

    try {
      ptyProcess = pty.spawn(SHELL, args, {
        name: 'xterm-color',
        cols: cols || 80,
        rows: rows || 30,
        cwd: process.env.HOME,
        env: {
            ...process.env,
            // Inject helper function for UI commands
            // usage: echo ":::UI_CMD:::{\"type\":\"image\",\"src\":\"path.png\"}"
        }
      });
    } catch (err) {
      console.error('Failed to spawn pty:', err);
      return;
    }

    ptyProcess.onData((data) => {
      socket.emit('output', data);
      
      // Simple parsing for UI commands
      // Look for :::UI_CMD:::{JSON}:::
      const cmdRegex = /:::UI_CMD:::({.+?})(?:::)?/g;
      let match;
      while ((match = cmdRegex.exec(data)) !== null) {
          try {
              const payload = JSON.parse(match[1]);
              socket.emit('ui-command', payload);
          } catch (e) {
              console.error('Failed to parse UI command:', e);
          }
      }
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`PTY exited with code ${exitCode} and signal ${signal}`);
      socket.emit('exit', { exitCode, signal });
    });
  });

  socket.on('input', (data) => {
    if (ptyProcess) {
      // console.log(`Input received: ${JSON.stringify(data)}`); // verbose
      ptyProcess.write(data);
    }
  });

  socket.on('resize', ({ cols, rows }) => {
    if (ptyProcess) {
      ptyProcess.resize(cols, rows);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
    if (ptyProcess) {
      ptyProcess.kill();
    }
  });
});

// Handle client-side routing, return all requests to React app
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
