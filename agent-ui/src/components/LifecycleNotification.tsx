import React, { useState, useEffect, useCallback } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { Window, WindowHeader, WindowContent, Button, Progress, Separator } from 'react95';
import { io, Socket } from 'socket.io-client';
import { 
  Clock, 
  Power, 
  Hammer, 
  Pause, 
  Play,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Server
} from 'lucide-react';

// ==================== TYPES ====================

interface LifecycleStatus {
  status: 'running' | 'grace-period' | 'shutting-down' | 'held';
  uptime: number;
  uptimeFormatted: string;
  startedAt: string;
  lastActivity: string;
  sessionCount: number;
  sessions: Array<{
    id: string;
    agentId: string | null;
    taskId: string | null;
    createdAt: number;
    lastActivity: number;
    durationMs: number;
  }>;
  holdUntil: string | null;
  holdReason: string | null;
  gracePeriodRemaining: number | null;
  gracePeriodRemainingFormatted: string | null;
  shutdownReason: string | null;
  config: {
    autoShutdown: boolean;
    gracePeriodMinutes: number;
  };
}

interface GracePeriodEvent {
  reason: string;
  gracePeriodMs: number;
  shutdownAt: string;
}

interface ShutdownEvent {
  reason: string;
  countdown: number;
}

interface RebuildingEvent {
  reason: string;
  branch: string;
  commitSha: string | null;
}

// ==================== ANIMATIONS ====================

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const slideIn = keyframes`
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`;

const slideOut = keyframes`
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(-100%);
    opacity: 0;
  }
`;

const urgentPulse = keyframes`
  0%, 100% { 
    box-shadow: 0 0 0 0 rgba(170, 0, 0, 0.4);
  }
  50% { 
    box-shadow: 0 0 0 10px rgba(170, 0, 0, 0);
  }
`;

// ==================== STYLED COMPONENTS ====================

const NotificationContainer = styled.div<{ $visible: boolean; $isClosing: boolean }>`
  position: fixed;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 30000;
  animation: ${props => props.$isClosing ? css`${slideOut} 0.3s ease-out forwards` : css`${slideIn} 0.3s ease-out`};
  display: ${props => props.$visible ? 'block' : 'none'};
`;

const NotificationWindow = styled(Window)<{ $status: string }>`
  min-width: 400px;
  max-width: 500px;
  
  ${props => props.$status === 'grace-period' && css`
    animation: ${urgentPulse} 2s infinite;
  `}
  
  ${props => props.$status === 'shutting-down' && css`
    animation: ${urgentPulse} 0.5s infinite;
  `}
`;

const StatusBadge = styled.span<{ $status: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: bold;
  border-radius: 2px;
  
  ${props => {
    switch (props.$status) {
      case 'running':
        return css`
          background: #00aa00;
          color: white;
        `;
      case 'grace-period':
        return css`
          background: #aaaa00;
          color: black;
          animation: ${pulse} 1s infinite;
        `;
      case 'shutting-down':
        return css`
          background: #aa0000;
          color: white;
          animation: ${pulse} 0.5s infinite;
        `;
      case 'held':
        return css`
          background: #0000aa;
          color: white;
        `;
      default:
        return css`
          background: #808080;
          color: white;
        `;
    }
  }}
`;

const CountdownDisplay = styled.div`
  font-size: 32px;
  font-weight: bold;
  text-align: center;
  font-family: 'Courier New', monospace;
  color: #aa0000;
  margin: 8px 0;
  animation: ${pulse} 1s infinite;
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 12px;
`;

const InfoLabel = styled.span`
  color: #555;
`;

const InfoValue = styled.span`
  font-weight: bold;
`;

const SessionList = styled.div`
  max-height: 100px;
  overflow-y: auto;
  background: #fff;
  border: 1px inset #808080;
  padding: 4px;
  margin: 8px 0;
`;

const SessionItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 4px;
  font-size: 11px;
  
  &:hover {
    background: #000080;
    color: white;
  }
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 12px;
`;

const MinimizedBadge = styled.div<{ $status: string }>`
  position: fixed;
  top: 10px;
  right: 10px;
  z-index: 30000;
  cursor: pointer;
  
  ${props => props.$status === 'grace-period' && css`
    animation: ${urgentPulse} 2s infinite;
  `}
`;

const ProgressContainer = styled.div`
  margin: 8px 0;
`;

// ==================== COMPONENT ====================

interface LifecycleNotificationProps {
  onKeepWorking?: () => void;
  onViewResults?: () => void;
}

const LifecycleNotification: React.FC<LifecycleNotificationProps> = ({
  onKeepWorking,
  onViewResults: _onViewResults
}) => {
  const [_socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<LifecycleStatus | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'grace-period' | 'shutdown' | 'rebuilding' | 'held' | 'grace-cancelled' | null;
    message: string;
    data?: any;
  }>({ type: null, message: '' });

  // Initialize socket connection
  useEffect(() => {
    const socketInstance = io();
    setSocket(socketInstance);

    // Listen for lifecycle events
    socketInstance.on('lifecycle:status', (data: LifecycleStatus) => {
      setStatus(data);
      
      // Auto-show when in grace period or shutting down
      if (data.status === 'grace-period' || data.status === 'shutting-down') {
        setIsVisible(true);
        setIsMinimized(false);
      }
    });

    socketInstance.on('lifecycle:grace-period', (data: GracePeriodEvent) => {
      setNotification({
        type: 'grace-period',
        message: `All work complete! Container will shut down in ${Math.floor(data.gracePeriodMs / 60000)} minutes.`,
        data
      });
      setIsVisible(true);
      setIsMinimized(false);
      
      // Play notification sound (if available)
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp+dmph/ZWNQVXB+kaCqrqmmnYx0XltKT2V4i5ujp6Wjm49+b2NXT1tie4qXn6KgnZWLgHRoXFRXYnF+i5SZmpeUj4Z8cmlhWVtjbnmEi5GSko+MiIJ7c21nYmVrcHh+goWGhYWDgH15dHBtamtra3B0eHt9fn5+fX17eXZ0cW9ubm5wcnR2eHl5eXl4d3Z0c3Fwb25ubm9wcXN0dXZ2dnZ1dHNycXBvb29vb3BxcnN0dHR0dHNycXFwb29vb29wcHFycnNzc3NycnFxcHBwcHBwcHFxcXJycnJycnFxcXBwcHBwcA==');
        audio.volume = 0.3;
        audio.play().catch(() => {});
      } catch (e) {}
    });

    socketInstance.on('lifecycle:grace-cancelled', () => {
      setNotification({
        type: 'grace-cancelled',
        message: 'Grace period cancelled - new work detected!'
      });
      
      // Auto-hide after 5 seconds if running normally
      setTimeout(() => {
        if (status?.status === 'running') {
          setIsMinimized(true);
        }
      }, 5000);
    });

    socketInstance.on('lifecycle:shutdown', (data: ShutdownEvent) => {
      setNotification({
        type: 'shutdown',
        message: `Shutting down: ${data.reason}`,
        data
      });
      setIsVisible(true);
      setIsMinimized(false);
    });

    socketInstance.on('lifecycle:rebuilding', (data: RebuildingEvent) => {
      setNotification({
        type: 'rebuilding',
        message: `Rebuilding from ${data.branch}: ${data.reason}`,
        data
      });
      setIsVisible(true);
      setIsMinimized(false);
    });

    socketInstance.on('lifecycle:held', (data: { holdUntil: string; reason: string }) => {
      setNotification({
        type: 'held',
        message: `Container held: ${data.reason}`,
        data
      });
    });

    socketInstance.on('lifecycle:hold-released', () => {
      setNotification({
        type: null,
        message: 'Hold released'
      });
    });

    socketInstance.on('lifecycle:grace-extended', (data: { additionalMs: number; newShutdownAt: string }) => {
      setNotification({
        type: 'grace-period',
        message: `Grace period extended! New shutdown time: ${new Date(data.newShutdownAt).toLocaleTimeString()}`
      });
    });

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Handle keep working button
  const handleKeepWorking = useCallback(async () => {
    try {
      const response = await fetch('/api/lifecycle/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalMinutes: 15 })
      });
      const data = await response.json();
      if (data.success) {
        setNotification({
          type: 'grace-period',
          message: 'Extended! You have 15 more minutes.'
        });
      }
      onKeepWorking?.();
    } catch (e) {
      console.error('Failed to extend grace period:', e);
    }
  }, [onKeepWorking]);

  // Handle hold button
  const handleHold = useCallback(async (minutes: number = 60) => {
    try {
      const response = await fetch('/api/lifecycle/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMinutes: minutes, reason: 'User requested hold' })
      });
      const data = await response.json();
      if (data.success) {
        setNotification({
          type: 'held',
          message: `Container held for ${minutes} minutes.`
        });
      }
    } catch (e) {
      console.error('Failed to hold:', e);
    }
  }, []);

  // Handle shutdown button
  const handleShutdownNow = useCallback(async () => {
    if (window.confirm('Are you sure you want to shut down the container?')) {
      try {
        await fetch('/api/lifecycle/shutdown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: false, reason: 'User requested shutdown' })
        });
      } catch (e) {
        console.error('Failed to shutdown:', e);
      }
    }
  }, []);

  // Close notification
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsMinimized(true);
      setIsClosing(false);
    }, 300);
  }, []);

  // Restore from minimized
  const handleRestore = useCallback(() => {
    setIsMinimized(false);
    setIsVisible(true);
  }, []);

  // Format remaining time
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage (inverted - shows time remaining)
  const getProgressPercent = (): number => {
    if (!status || !status.gracePeriodRemaining || !status.config.gracePeriodMinutes) return 100;
    const totalMs = status.config.gracePeriodMinutes * 60 * 1000;
    return Math.max(0, (status.gracePeriodRemaining / totalMs) * 100);
  };

  // Don't render if no status and nothing to show
  if (!status && !notification.type) return null;

  // Render minimized badge when minimized
  if (isMinimized && status) {
    return (
      <MinimizedBadge $status={status.status} onClick={handleRestore}>
        <Button>
          <Server size={14} style={{ marginRight: 4 }} />
          <StatusBadge $status={status.status}>
            {status.status === 'grace-period' && status.gracePeriodRemainingFormatted}
            {status.status === 'running' && `${status.sessionCount} sessions`}
            {status.status === 'held' && 'HELD'}
            {status.status === 'shutting-down' && 'SHUTDOWN'}
          </StatusBadge>
        </Button>
      </MinimizedBadge>
    );
  }

  return (
    <NotificationContainer $visible={isVisible} $isClosing={isClosing}>
      <NotificationWindow $status={status?.status || 'running'}>
        <WindowHeader>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Server size={14} />
            Container Lifecycle
            {status && (
              <StatusBadge $status={status.status}>
                {status.status.toUpperCase().replace('-', ' ')}
              </StatusBadge>
            )}
          </span>
          <Button onClick={handleClose} style={{ marginLeft: 'auto' }}>
            <span style={{ fontWeight: 'bold' }}>_</span>
          </Button>
        </WindowHeader>
        
        <WindowContent>
          {/* Grace Period Warning */}
          {status?.status === 'grace-period' && status.gracePeriodRemaining && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <AlertTriangle size={24} color="#aaaa00" />
                <p style={{ margin: '8px 0', fontWeight: 'bold' }}>
                  All work complete!
                </p>
                <p style={{ margin: 0, fontSize: 12, color: '#555' }}>
                  Container will shut down when timer reaches zero.
                </p>
              </div>
              
              <CountdownDisplay>
                {formatTime(status.gracePeriodRemaining)}
              </CountdownDisplay>
              
              <ProgressContainer>
                <Progress value={getProgressPercent()} />
              </ProgressContainer>
              
              <ButtonRow>
                <Button onClick={handleKeepWorking} primary>
                  <Play size={14} style={{ marginRight: 4 }} />
                  Keep Working (+15 min)
                </Button>
                <Button onClick={() => handleHold(60)}>
                  <Pause size={14} style={{ marginRight: 4 }} />
                  Hold (1 hr)
                </Button>
                <Button onClick={handleShutdownNow}>
                  <Power size={14} style={{ marginRight: 4 }} />
                  Shutdown Now
                </Button>
              </ButtonRow>
            </>
          )}

          {/* Shutting Down */}
          {status?.status === 'shutting-down' && (
            <div style={{ textAlign: 'center' }}>
              <XCircle size={32} color="#aa0000" />
              <p style={{ fontWeight: 'bold', fontSize: 16 }}>Shutting Down...</p>
              <p style={{ fontSize: 12, color: '#555' }}>
                {status.shutdownReason || 'Container is shutting down'}
              </p>
              <p style={{ fontSize: 11, color: '#888', marginTop: 8 }}>
                Your work has been saved. The container will wake on next request.
              </p>
            </div>
          )}

          {/* Held */}
          {status?.status === 'held' && (
            <div style={{ textAlign: 'center' }}>
              <Pause size={24} color="#0000aa" />
              <p style={{ fontWeight: 'bold' }}>Container Held</p>
              <p style={{ fontSize: 12 }}>
                Reason: {status.holdReason || 'Unknown'}
              </p>
              {status.holdUntil && (
                <p style={{ fontSize: 11, color: '#555' }}>
                  Until: {new Date(status.holdUntil).toLocaleTimeString()}
                </p>
              )}
              <ButtonRow>
                <Button onClick={async () => {
                  await fetch('/api/lifecycle/release', { method: 'POST' });
                }}>
                  <Play size={14} style={{ marginRight: 4 }} />
                  Release Hold
                </Button>
              </ButtonRow>
            </div>
          )}

          {/* Running - Show Status */}
          {status?.status === 'running' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <CheckCircle size={24} color="#00aa00" />
                <p style={{ margin: '4px 0', fontWeight: 'bold' }}>
                  Container Active
                </p>
              </div>
              
              <Separator />
              
              <InfoRow>
                <InfoLabel><Clock size={12} /> Uptime:</InfoLabel>
                <InfoValue>{status.uptimeFormatted}</InfoValue>
              </InfoRow>
              
              <InfoRow>
                <InfoLabel><Zap size={12} /> Active Sessions:</InfoLabel>
                <InfoValue>{status.sessionCount}</InfoValue>
              </InfoRow>
              
              {status.sessions.length > 0 && (
                <SessionList>
                  {status.sessions.map(session => (
                    <SessionItem key={session.id}>
                      <span>🖥️</span>
                      <span>{session.agentId || 'Terminal'}</span>
                      <span style={{ marginLeft: 'auto', color: '#888' }}>
                        {Math.floor((Date.now() - session.createdAt) / 60000)}m
                      </span>
                    </SessionItem>
                  ))}
                </SessionList>
              )}
              
              <InfoRow>
                <InfoLabel>Auto-shutdown:</InfoLabel>
                <InfoValue>{status.config.autoShutdown ? 'Enabled' : 'Disabled'}</InfoValue>
              </InfoRow>
              
              <InfoRow>
                <InfoLabel>Grace Period:</InfoLabel>
                <InfoValue>{status.config.gracePeriodMinutes} minutes</InfoValue>
              </InfoRow>
              
              <ButtonRow>
                <Button onClick={() => handleHold(60)}>
                  <Pause size={14} style={{ marginRight: 4 }} />
                  Hold
                </Button>
                <Button onClick={handleShutdownNow}>
                  <Power size={14} style={{ marginRight: 4 }} />
                  Shutdown
                </Button>
              </ButtonRow>
            </>
          )}

          {/* Rebuilding notification */}
          {notification.type === 'rebuilding' && (
            <div style={{ textAlign: 'center' }}>
              <Hammer size={24} color="#0000aa" />
              <p style={{ fontWeight: 'bold' }}>Rebuilding Container</p>
              <p style={{ fontSize: 12 }}>{notification.message}</p>
              <p style={{ fontSize: 11, color: '#555', marginTop: 8 }}>
                Your session will transfer to the new version automatically.
              </p>
            </div>
          )}
        </WindowContent>
      </NotificationWindow>
    </NotificationContainer>
  );
};

export default LifecycleNotification;
