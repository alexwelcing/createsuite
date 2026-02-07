import React, { useState, useEffect, useCallback } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { io, Socket } from 'socket.io-client';
import { macosTheme } from '../theme/macos';
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
  Server,
  X,
  Minus
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
  50% { opacity: 0.6; }
`;

const slideIn = keyframes`
  from {
    transform: translateX(-50%) translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }
`;

const slideOut = keyframes`
  from {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }
  to {
    transform: translateX(-50%) translateY(-20px);
    opacity: 0;
  }
`;

const urgentGlow = keyframes`
  0%, 100% { 
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 159, 10, 0.3);
  }
  50% { 
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 0 0 20px rgba(255, 159, 10, 0.4);
  }
`;

const criticalGlow = keyframes`
  0%, 100% { 
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 69, 58, 0.3);
  }
  50% { 
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 0 0 20px rgba(255, 69, 58, 0.5);
  }
`;

// ==================== STYLED COMPONENTS ====================

const NotificationContainer = styled.div<{ $visible: boolean; $isClosing: boolean }>`
  position: fixed;
  top: 40px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 30000;
  animation: ${props => props.$isClosing 
    ? css`${slideOut} 0.3s ease-out forwards` 
    : css`${slideIn} 0.3s ease-out`};
  display: ${props => props.$visible ? 'block' : 'none'};
`;

const NotificationWindow = styled.div<{ $status: string }>`
  min-width: 380px;
  max-width: 420px;
  background: rgba(40, 40, 45, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 0 0 0 0.5px rgba(255, 255, 255, 0.1) inset;
  
  ${props => props.$status === 'grace-period' && css`
    animation: ${urgentGlow} 2s infinite;
  `}
  
  ${props => props.$status === 'shutting-down' && css`
    animation: ${criticalGlow} 0.8s infinite;
  `}
`;

const TitleBar = styled.div`
  height: 38px;
  background: linear-gradient(180deg, #3a3a3c 0%, #2c2c2e 100%);
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.3);
`;

const TrafficLights = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const TrafficLight = styled.button<{ $color: 'close' | 'minimize' }>`
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
  
  background: ${props => props.$color === 'close' ? '#ff5f57' : '#febc2e'};
  
  &:hover {
    filter: brightness(1.1);
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

const TitleText = styled.div`
  flex: 1;
  text-align: center;
  font-family: ${macosTheme.fonts.system};
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

const StatusBadge = styled.span<{ $status: string }>`
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  font-size: 10px;
  font-weight: 600;
  border-radius: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  
  ${props => {
    switch (props.$status) {
      case 'running':
        return css`
          background: rgba(52, 199, 89, 0.2);
          color: #34c759;
        `;
      case 'grace-period':
        return css`
          background: rgba(255, 159, 10, 0.2);
          color: #ff9f0a;
          animation: ${pulse} 1s infinite;
        `;
      case 'shutting-down':
        return css`
          background: rgba(255, 69, 58, 0.2);
          color: #ff453a;
          animation: ${pulse} 0.5s infinite;
        `;
      case 'held':
        return css`
          background: rgba(0, 122, 255, 0.2);
          color: #007aff;
        `;
      default:
        return css`
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.6);
        `;
    }
  }}
`;

const Content = styled.div`
  padding: 20px;
`;

const CountdownDisplay = styled.div`
  font-size: 48px;
  font-weight: 300;
  text-align: center;
  font-family: ${macosTheme.fonts.mono};
  color: #ff9f0a;
  margin: 12px 0;
  letter-spacing: 4px;
`;

const Message = styled.div`
  text-align: center;
  margin-bottom: 16px;
  
  .icon {
    margin-bottom: 8px;
  }
  
  h3 {
    font-family: ${macosTheme.fonts.system};
    font-size: 16px;
    font-weight: 600;
    color: white;
    margin: 0 0 4px 0;
  }
  
  p {
    font-family: ${macosTheme.fonts.system};
    font-size: 13px;
    color: rgba(255, 255, 255, 0.6);
    margin: 0;
  }
`;

const ProgressBar = styled.div`
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin: 16px 0;
`;

const ProgressFill = styled.div<{ $percent: number; $status: string }>`
  height: 100%;
  border-radius: 2px;
  width: ${props => props.$percent}%;
  transition: width 1s linear;
  
  background: ${props => {
    switch (props.$status) {
      case 'grace-period': return 'linear-gradient(90deg, #ff9f0a, #ff6b00)';
      case 'shutting-down': return 'linear-gradient(90deg, #ff453a, #ff2d55)';
      default: return '#007aff';
    }
  }};
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 16px 0;
`;

const InfoItem = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 10px 12px;
  
  .label {
    font-family: ${macosTheme.fonts.system};
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 4px;
  }
  
  .value {
    font-family: ${macosTheme.fonts.system};
    font-size: 14px;
    font-weight: 500;
    color: white;
  }
`;

const SessionList = styled.div`
  max-height: 80px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  margin: 12px 0;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }
`;

const SessionItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-family: ${macosTheme.fonts.system};
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  
  &:last-child {
    border-bottom: none;
  }
  
  .time {
    margin-left: auto;
    color: rgba(255, 255, 255, 0.4);
    font-size: 11px;
  }
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 16px;
`;

const Button = styled.button<{ $primary?: boolean; $danger?: boolean }>`
  flex: 1;
  height: 36px;
  border-radius: 8px;
  border: none;
  font-family: ${macosTheme.fonts.system};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.15s ease;
  
  background: ${props => {
    if (props.$primary) return 'linear-gradient(180deg, #0a84ff 0%, #007aff 100%)';
    if (props.$danger) return 'linear-gradient(180deg, #ff5f57 0%, #ff453a 100%)';
    return 'rgba(255, 255, 255, 0.1)';
  }};
  
  color: ${props => (props.$primary || props.$danger) ? 'white' : 'rgba(255, 255, 255, 0.85)'};
  
  &:hover {
    background: ${props => {
      if (props.$primary) return 'linear-gradient(180deg, #2196ff 0%, #0a84ff 100%)';
      if (props.$danger) return 'linear-gradient(180deg, #ff6961 0%, #ff5f57 100%)';
      return 'rgba(255, 255, 255, 0.15)';
    }};
  }
  
  &:active {
    transform: scale(0.98);
  }
`;

const MinimizedBadge = styled.div<{ $status: string }>`
  position: fixed;
  top: 40px;
  right: 16px;
  z-index: 30000;
  cursor: pointer;
  background: rgba(40, 40, 45, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 6px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
  
  &:hover {
    transform: scale(1.05);
    background: rgba(50, 50, 55, 0.95);
  }
  
  ${props => props.$status === 'grace-period' && css`
    animation: ${urgentGlow} 2s infinite;
  `}
`;

// ==================== COMPONENT ====================

interface LifecycleNotificationProps {
  onKeepWorking?: () => void;
  onViewResults?: () => void;
}

const LifecycleNotification: React.FC<LifecycleNotificationProps> = ({
  onKeepWorking,
}) => {
  const [, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<LifecycleStatus | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [notification, setNotification] = useState<{
    type: 'grace-period' | 'shutdown' | 'rebuilding' | 'held' | 'grace-cancelled' | null;
    message: string;
    data?: unknown;
  }>({ type: null, message: '' });

  // Keep `now` updated for session duration display
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const socketInstance = io();
    setSocket(socketInstance);

    socketInstance.on('lifecycle:status', (data: LifecycleStatus) => {
      setStatus(data);
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
    });

    socketInstance.on('lifecycle:grace-cancelled', () => {
      setNotification({
        type: 'grace-cancelled',
        message: 'Grace period cancelled - new work detected!'
      });
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
  }, [status?.status]);

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

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsMinimized(true);
      setIsClosing(false);
    }, 300);
  }, []);

  const handleRestore = useCallback(() => {
    setIsMinimized(false);
    setIsVisible(true);
  }, []);

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')} : ${seconds.toString().padStart(2, '0')}`;
  };

  const getProgressPercent = (): number => {
    if (!status || !status.gracePeriodRemaining || !status.config.gracePeriodMinutes) return 100;
    const totalMs = status.config.gracePeriodMinutes * 60 * 1000;
    return Math.max(0, (status.gracePeriodRemaining / totalMs) * 100);
  };

  if (!status && !notification.type) return null;

  if (isMinimized && status) {
    return (
      <MinimizedBadge $status={status.status} onClick={handleRestore}>
        <Server size={14} color="rgba(255,255,255,0.7)" />
        <StatusBadge $status={status.status}>
          {status.status === 'grace-period' && status.gracePeriodRemainingFormatted}
          {status.status === 'running' && `${status.sessionCount} sessions`}
          {status.status === 'held' && 'HELD'}
          {status.status === 'shutting-down' && 'SHUTDOWN'}
        </StatusBadge>
      </MinimizedBadge>
    );
  }

  return (
    <NotificationContainer $visible={isVisible} $isClosing={isClosing}>
      <NotificationWindow $status={status?.status || 'running'}>
        <TitleBar>
          <TrafficLights>
            <TrafficLight $color="close" onClick={handleClose}>
              <X size={8} strokeWidth={2.5} />
            </TrafficLight>
            <TrafficLight $color="minimize" onClick={handleClose}>
              <Minus size={8} strokeWidth={2.5} />
            </TrafficLight>
          </TrafficLights>
          <TitleText>
            <Server size={14} />
            Container Lifecycle
            {status && <StatusBadge $status={status.status}>{status.status.replace('-', ' ')}</StatusBadge>}
          </TitleText>
          <div style={{ width: 40 }} />
        </TitleBar>
        
        <Content>
          {/* Grace Period Warning */}
          {status?.status === 'grace-period' && status.gracePeriodRemaining && (
            <>
              <Message>
                <div className="icon">
                  <AlertTriangle size={28} color="#ff9f0a" />
                </div>
                <h3>All work complete!</h3>
                <p>Container will shut down when timer reaches zero.</p>
              </Message>
              
              <CountdownDisplay>
                {formatTime(status.gracePeriodRemaining)}
              </CountdownDisplay>
              
              <ProgressBar>
                <ProgressFill $percent={getProgressPercent()} $status="grace-period" />
              </ProgressBar>
              
              <ButtonRow>
                <Button $primary onClick={handleKeepWorking}>
                  <Play size={14} />
                  Keep Working (+15 min)
                </Button>
                <Button onClick={() => handleHold(60)}>
                  <Pause size={14} />
                  Hold (1 hr)
                </Button>
                <Button $danger onClick={handleShutdownNow}>
                  <Power size={14} />
                  Shutdown Now
                </Button>
              </ButtonRow>
            </>
          )}

          {/* Shutting Down */}
          {status?.status === 'shutting-down' && (
            <Message>
              <div className="icon">
                <XCircle size={32} color="#ff453a" />
              </div>
              <h3>Shutting Down...</h3>
              <p>{status.shutdownReason || 'Container is shutting down'}</p>
              <p style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                Your work has been saved. The container will wake on next request.
              </p>
            </Message>
          )}

          {/* Held */}
          {status?.status === 'held' && (
            <>
              <Message>
                <div className="icon">
                  <Pause size={28} color="#007aff" />
                </div>
                <h3>Container Held</h3>
                <p>{status.holdReason || 'Paused by user'}</p>
                {status.holdUntil && (
                  <p style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                    Until: {new Date(status.holdUntil).toLocaleTimeString()}
                  </p>
                )}
              </Message>
              <ButtonRow>
                <Button $primary onClick={async () => {
                  await fetch('/api/lifecycle/release', { method: 'POST' });
                }}>
                  <Play size={14} />
                  Release Hold
                </Button>
              </ButtonRow>
            </>
          )}

          {/* Running - Show Status */}
          {status?.status === 'running' && (
            <>
              <Message>
                <div className="icon">
                  <CheckCircle size={28} color="#34c759" />
                </div>
                <h3>Container Active</h3>
              </Message>
              
              <InfoGrid>
                <InfoItem>
                  <div className="label"><Clock size={12} /> Uptime</div>
                  <div className="value">{status.uptimeFormatted}</div>
                </InfoItem>
                <InfoItem>
                  <div className="label"><Zap size={12} /> Sessions</div>
                  <div className="value">{status.sessionCount}</div>
                </InfoItem>
              </InfoGrid>
              
              {status.sessions.length > 0 && (
                <SessionList>
                  {status.sessions.map(session => (
                    <SessionItem key={session.id}>
                      <span>🖥️</span>
                      <span>{session.agentId || 'Terminal'}</span>
                      <span className="time">
                        {Math.floor((now - session.createdAt) / 60000)}m
                      </span>
                    </SessionItem>
                  ))}
                </SessionList>
              )}
              
              <ButtonRow>
                <Button onClick={() => handleHold(60)}>
                  <Pause size={14} />
                  Hold
                </Button>
                <Button $danger onClick={handleShutdownNow}>
                  <Power size={14} />
                  Shutdown
                </Button>
              </ButtonRow>
            </>
          )}

          {/* Rebuilding notification */}
          {notification.type === 'rebuilding' && (
            <Message>
              <div className="icon">
                <Hammer size={28} color="#007aff" />
              </div>
              <h3>Rebuilding Container</h3>
              <p>{notification.message}</p>
              <p style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                Your session will transfer to the new version automatically.
              </p>
            </Message>
          )}
        </Content>
      </NotificationWindow>
    </NotificationContainer>
  );
};

export default LifecycleNotification;
