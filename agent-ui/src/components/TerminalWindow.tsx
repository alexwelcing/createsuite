import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { io, Socket } from 'socket.io-client';
import styled, { keyframes } from 'styled-components';
import Draggable from 'react-draggable';
import { macosTheme } from '../theme/macos';
import { X, Minus, Maximize2 } from 'lucide-react';
import type { UiCommandPayload } from '../App';

// Animations
const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
`;

// macOS Window Styles
const WindowWrapper = styled.div`
  position: absolute;
  animation: ${fadeIn} 0.2s ease-out;
`;

const Window = styled.div<{ $active?: boolean }>`
  width: 600px;
  height: 400px;
  min-width: 400px;
  min-height: 250px;
  background: #1e1e1e;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: ${props => props.$active 
    ? '0 22px 70px 4px rgba(0, 0, 0, 0.56), 0 0 0 0.5px rgba(255, 255, 255, 0.1) inset'
    : '0 10px 30px rgba(0, 0, 0, 0.3), 0 0 0 0.5px rgba(255, 255, 255, 0.1) inset'};
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.2s ease;
`;

const TitleBar = styled.div<{ $active?: boolean }>`
  height: 38px;
  background: ${props => props.$active 
    ? 'linear-gradient(180deg, #3a3a3c 0%, #2c2c2e 100%)'
    : 'linear-gradient(180deg, #2c2c2e 0%, #1c1c1e 100%)'};
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 8px;
  cursor: default;
  user-select: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.3);
`;

const TrafficLights = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const TrafficLight = styled.button<{ $color: 'close' | 'minimize' | 'maximize'; $active?: boolean }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  
  background: ${props => {
    if (!props.$active) return '#4a4a4c';
    switch (props.$color) {
      case 'close': return '#ff5f57';
      case 'minimize': return '#febc2e';
      case 'maximize': return '#28c840';
    }
  }};
  
  &:hover {
    background: ${props => {
      switch (props.$color) {
        case 'close': return '#ff3b30';
        case 'minimize': return '#ff9500';
        case 'maximize': return '#34c759';
      }
    }};
  }
  
  svg {
    width: 8px;
    height: 8px;
    opacity: 0;
    color: rgba(0, 0, 0, 0.6);
    transition: opacity 0.1s;
  }
  
  ${TrafficLights}:hover & svg {
    opacity: 1;
  }
`;

const Title = styled.div`
  flex: 1;
  text-align: center;
  font-family: ${macosTheme.fonts.system};
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
`;

const TerminalContainer = styled.div`
  flex: 1;
  background: #000;
  padding: 8px;
  overflow: hidden;
  position: relative;
  
  .xterm {
    height: 100%;
  }
  
  .xterm-viewport {
    overflow-y: auto;
    
    &::-webkit-scrollbar {
      width: 8px;
    }
    
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    
    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 4px;
    }
    
    &::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.3);
    }
  }
`;

const LoadingOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  z-index: 10;
`;

const Spinner = styled.div`
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: #007aff;
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`;

const LoadingText = styled.span`
  font-family: ${macosTheme.fonts.system};
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
`;

interface TerminalWindowProps {
  id: string;
  title: string;
  onClose: (id: string) => void;
  zIndex: number;
  onFocus: (id: string) => void;
  initialPosition?: { x: number; y: number };
  initialCommand?: string;
  onUiCommand?: (command: UiCommandPayload) => void;
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
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    socketRef.current = io({ transports: ['websocket'], upgrade: false });

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"SF Mono", "Fira Code", "Monaco", "Menlo", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      theme: {
        background: '#000000',
        foreground: '#f0f0f0',
        cursor: '#f0f0f0',
        cursorAccent: '#000000',
        selectionBackground: 'rgba(255, 255, 255, 0.3)',
        black: '#000000',
        red: '#ff5f57',
        green: '#28c840',
        yellow: '#febc2e',
        blue: '#007aff',
        magenta: '#bf5af2',
        cyan: '#5ac8fa',
        white: '#f0f0f0',
        brightBlack: '#636366',
        brightRed: '#ff6961',
        brightGreen: '#34c759',
        brightYellow: '#ffd60a',
        brightBlue: '#64d2ff',
        brightMagenta: '#ff6ff2',
        brightCyan: '#70d7ff',
        brightWhite: '#ffffff',
      }
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    if (terminalRef.current) {
      term.open(terminalRef.current);
      setTimeout(() => fitAddon.fit(), 0);
    }

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const handleResize = () => {
      fitAddon.fit();
      if (socketRef.current) {
        socketRef.current.emit('resize', { cols: term.cols, rows: term.rows });
      }
    };
    
    window.addEventListener('resize', handleResize);

    socketRef.current.on('connect', () => {
      setConnectionStatus('connected');
      term.writeln('\x1b[38;2;0;122;255mConnected to Agent Backend\x1b[0m');
      term.writeln('');
      socketRef.current?.emit('spawn', { cols: term.cols, rows: term.rows });
      setIsLoading(false);
      
      if (initialCommand) {
        setTimeout(() => {
          socketRef.current?.emit('input', initialCommand + '\r');
        }, 500);
      }
    });

    let connectAttempts = 0;
    socketRef.current.on('connect_error', (err) => {
      connectAttempts++;
      console.warn(`Socket connect_error (attempt ${connectAttempts}):`, err.message);
      // Only show error after several retries — Socket.IO auto-reconnects
      if (connectAttempts >= 3) {
        setConnectionStatus('error');
        setIsLoading(false);
        term.writeln('\x1b[38;2;255;95;87mConnection failed\x1b[0m');
        term.writeln('The agent backend is not available.');
        term.writeln('\x1b[38;2;142;142;147mRetrying...\x1b[0m');
      }
    });

    socketRef.current.on('disconnect', (reason) => {
      console.warn('Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server forcibly disconnected — reconnect manually
        socketRef.current?.connect();
      }
      // For other reasons, socket.io auto-reconnects
    });

    socketRef.current.on('output', (data: string) => {
      term.write(data);
    });

    socketRef.current.on('ui-command', (payload: UiCommandPayload) => {
      if (onUiCommand) {
        onUiCommand(payload);
      }
    });

    term.onData((data) => {
      socketRef.current?.emit('input', data);
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      socketRef.current?.disconnect();
    };
  }, [initialCommand, onUiCommand]);

  const handleFocus = () => {
    setIsActive(true);
    onFocus(id);
  };

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".title-bar"
      defaultPosition={initialPosition}
      onMouseDown={handleFocus}
    >
      <WindowWrapper ref={nodeRef} style={{ zIndex }}>
        <Window $active={isActive} onMouseDown={handleFocus}>
          <TitleBar className="title-bar" $active={isActive}>
            <TrafficLights>
              <TrafficLight 
                $color="close" 
                $active={isActive}
                onClick={(e) => { e.stopPropagation(); onClose(id); }}
              >
                <X size={8} strokeWidth={2.5} />
              </TrafficLight>
              <TrafficLight 
                $color="minimize" 
                $active={isActive}
                onClick={(e) => e.stopPropagation()}
              >
                <Minus size={8} strokeWidth={2.5} />
              </TrafficLight>
              <TrafficLight 
                $color="maximize" 
                $active={isActive}
                onClick={(e) => e.stopPropagation()}
              >
                <Maximize2 size={6} strokeWidth={2.5} />
              </TrafficLight>
            </TrafficLights>
            <Title>{title}</Title>
            <div style={{ width: 52 }} /> {/* Spacer for centering */}
          </TitleBar>
          
          <TerminalContainer>
            <div ref={terminalRef} style={{ height: '100%' }} onMouseDown={(e) => e.stopPropagation()} />
            {isLoading && (
              <LoadingOverlay>
                <Spinner />
                <LoadingText>
                  {connectionStatus === 'error' 
                    ? 'Connection failed' 
                    : 'Connecting to agent...'}
                </LoadingText>
              </LoadingOverlay>
            )}
          </TerminalContainer>
        </Window>
      </WindowWrapper>
    </Draggable>
  );
};

export default TerminalWindow;
