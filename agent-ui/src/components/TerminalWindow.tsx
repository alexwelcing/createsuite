import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { io, Socket } from 'socket.io-client';
import styled from 'styled-components';
import { Window, WindowHeader, WindowContent, Button } from 'react95';
import Draggable from 'react-draggable';

const TerminalContainer = styled.div`
  width: 100%;
  height: 100%;
  background: black;
  padding: 4px;
  overflow: hidden;
  
  /* Custom scrollbar for xterm if needed */
  .xterm-viewport {
    overflow-y: auto;
  }
`;

const StyledWindow = styled(Window)`
  width: 600px;
  height: 400px;
  position: absolute;
  display: flex;
  flex-direction: column;
`;

const StyledWindowContent = styled(WindowContent)`
  flex: 1;
  display: flex;
  padding: 0;
  margin: 4px;
`;

interface TerminalWindowProps {
  id: string;
  title: string;
  onClose: (id: string) => void;
  zIndex: number;
  onFocus: (id: string) => void;
  initialPosition?: { x: number; y: number };
  initialCommand?: string;
  onUiCommand?: (command: any) => void;
}

const TerminalWindow: React.FC<TerminalWindowProps> = ({ 
  id, 
  title, 
  onClose, 
  zIndex, 
  onFocus,
  initialPosition = { x: 50, y: 50 },
  initialCommand,
  onUiCommand
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize Socket - use relative path for production compatibility
    // In dev, Vite proxy handles this. In prod, served from same origin.
    socketRef.current = io();

    // Initialize Terminal
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"Cascadia Code", Menlo, monospace',
      fontSize: 14,
      theme: {
        background: '#000000',
        foreground: '#ffffff',
      }
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    if (terminalRef.current) {
      term.open(terminalRef.current);
      fitAddon.fit();
    }

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle Resize
    const handleResize = () => {
      fitAddon.fit();
      if (socketRef.current) {
        socketRef.current.emit('resize', { cols: term.cols, rows: term.rows });
      }
    };
    
    window.addEventListener('resize', handleResize);

    // Socket Events
    socketRef.current.on('connect', () => {
      term.writeln('\x1b[32mConnected to Agent Backend...\x1b[0m');
      socketRef.current?.emit('spawn', { cols: term.cols, rows: term.rows });
      
      if (initialCommand) {
        // Send initial command once connected and spawned
        // We add a small delay to ensure shell is ready
        setTimeout(() => {
          socketRef.current?.emit('input', initialCommand + '\r');
        }, 500);
      }
    });

    socketRef.current.on('output', (data: string) => {
      term.write(data);
    });

    socketRef.current.on('ui-command', (payload: any) => {
      if (onUiCommand) {
        onUiCommand(payload);
      }
    });

    term.onData((data) => {
      socketRef.current?.emit('input', data);
    });

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      socketRef.current?.disconnect();
    };
  }, []);

  // Re-fit when window size changes (e.g. dragging might not change size, but specific resize handles would)
  // For now we just have fixed size windows with dragging.

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".window-header"
      defaultPosition={initialPosition}
      onMouseDown={() => onFocus(id)}
    >
      <div ref={nodeRef} style={{ position: 'absolute', zIndex }}>
        <StyledWindow className='window'>
          <WindowHeader className='window-header' style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ marginLeft: 4 }}>{title}</span>
            <Button onClick={() => onClose(id)} size='sm' square>
              <span style={{ fontWeight: 'bold', transform: 'translateY(-1px)' }}>x</span>
            </Button>
          </WindowHeader>
          <StyledWindowContent>
            <TerminalContainer ref={terminalRef} onMouseDown={(e) => e.stopPropagation()} />
          </StyledWindowContent>
        </StyledWindow>
      </div>
    </Draggable>
  );
};

export default TerminalWindow;
