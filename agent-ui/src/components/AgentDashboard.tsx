import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import Draggable from 'react-draggable';
import { macosTheme } from '../theme/macos';
import { 
  X, 
  Minus, 
  Maximize2, 
  AlertCircle, 
  Play, 
  Square, 
  Clock, 
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';

// Types
interface AgentConfig {
  name: string;
  description: string;
  provider: string;
  model: string;
  capabilities: string[];
}

interface ActiveAgent {
  agentId: string;
  agentType: string;
  status: string;
  machineId: string;
  region: string;
  ipAddress?: string;
  connectedAt: string;
  lastActivity?: string;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Animations
const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
`;

const slideIn = keyframes`
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;

const slideOut = keyframes`
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(100%); opacity: 0; }
`;

// Styled Components
const WindowWrapper = styled.div`
  position: absolute;
  animation: ${fadeIn} 0.2s ease-out;
`;

const Window = styled.div<{ $active?: boolean }>`
  width: 760px;
  height: 620px;
  background: rgba(40, 40, 45, 0.95);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: ${props => props.$active 
    ? '0 22px 70px 4px rgba(0, 0, 0, 0.56), 0 0 0 0.5px rgba(255, 255, 255, 0.1) inset'
    : '0 10px 30px rgba(0, 0, 0, 0.3), 0 0 0 0.5px rgba(255, 255, 255, 0.1) inset'};
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.2s ease;
  backdrop-filter: blur(20px);
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
  cursor: move;
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

const Content = styled.div`
  flex: 1;
  overflow: auto;
  padding: 20px;
  
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
`;

// Enhanced Banner component with better UX
const Banner = styled.div<{ $variant: 'warning' | 'error' | 'success' | 'info' }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 6px;
  margin-bottom: 20px;
  font-family: ${macosTheme.fonts.system};
  font-size: 13px;
  
  background: ${props => {
    switch (props.$variant) {
      case 'warning': return 'rgba(255, 159, 10, 0.1)';
      case 'error': return 'rgba(255, 69, 58, 0.1)';
      case 'success': return 'rgba(52, 199, 89, 0.1)';
      case 'info': return 'rgba(0, 122, 255, 0.1)';
    }
  }};
  
  border: 1px solid ${props => {
    switch (props.$variant) {
      case 'warning': return 'rgba(255, 159, 10, 0.3)';
      case 'error': return 'rgba(255, 69, 58, 0.3)';
      case 'success': return 'rgba(52, 199, 89, 0.3)';
      case 'info': return 'rgba(0, 122, 255, 0.3)';
    }
  }};
  
  color: ${props => {
    switch (props.$variant) {
      case 'warning': return '#ff9f0a';
      case 'error': return '#ff453a';
      case 'success': return '#34c759';
      case 'info': return '#007aff';
    }
  }};
`;

// Toast notification component
const ToastContainer = styled.div`
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ToastWrapper = styled.div<{ $type: Toast['type']; $isExiting?: boolean }>`
  background: rgba(40, 40, 45, 0.95);
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(20px);
  border: 1px solid ${props => {
    switch (props.$type) {
      case 'success': return 'rgba(52, 199, 89, 0.3)';
      case 'error': return 'rgba(255, 69, 58, 0.3)';
      case 'warning': return 'rgba(255, 159, 10, 0.3)';
      case 'info': return 'rgba(0, 122, 255, 0.3)';
    }
  }};
  
  animation: ${props => props.$isExiting ? slideOut : slideIn} 0.3s ease-out;
  
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 300px;
  max-width: 400px;
`;

const ToastIcon = styled.div<{ $type: Toast['type'] }>`
  color: ${props => {
    switch (props.$type) {
      case 'success': return '#34c759';
      case 'error': return '#ff453a';
      case 'warning': return '#ff9f0a';
      case 'info': return '#007aff';
    }
  }};
  
  display: flex;
  align-items: center;
`;

const ToastContent = styled.div`
  flex: 1;
  font-family: ${macosTheme.fonts.system};
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
`;

const ToastAction = styled.button`
  background: rgba(0, 122, 255, 0.2);
  border: 1px solid rgba(0, 122, 255, 0.3);
  border-radius: 4px;
  color: #007aff;
  padding: 4px 8px;
  font-family: ${macosTheme.fonts.system};
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(0, 122, 255, 0.3);
  }
`;

// Section headers
const SectionHeader = styled.h3`
  font-family: ${macosTheme.fonts.system};
  font-size: 16px;
  font-weight: 600;
  color: white;
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ConfigGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
`;

const ConfigCard = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 16px;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
  }
`;

const ConfigTitle = styled.div`
  font-family: ${macosTheme.fonts.system};
  font-size: 14px;
  font-weight: 600;
  color: white;
  margin-bottom: 6px;
`;

const ConfigDescription = styled.div`
  font-family: ${macosTheme.fonts.system};
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 12px;
  line-height: 1.4;
`;

const ConfigDetails = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const ConfigProvider = styled.span`
  font-family: ${macosTheme.fonts.system};
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
`;

const SpawnButton = styled.button<{ $spawning?: boolean }>`
  background: ${props => props.$spawning 
    ? 'rgba(255, 159, 10, 0.2)' 
    : 'rgba(52, 199, 89, 0.2)'};
  border: 1px solid ${props => props.$spawning 
    ? 'rgba(255, 159, 10, 0.3)' 
    : 'rgba(52, 199, 89, 0.3)'};
  border-radius: 6px;
  color: ${props => props.$spawning ? '#ff9f0a' : '#34c759'};
  padding: 8px 16px;
  font-family: ${macosTheme.fonts.system};
  font-size: 12px;
  font-weight: 500;
  cursor: ${props => props.$spawning ? 'not-allowed' : 'pointer'};
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  justify-content: center;
  transition: all 0.15s ease;
  
  &:hover:not(:disabled) {
    background: ${props => props.$spawning 
      ? 'rgba(255, 159, 10, 0.2)' 
      : 'rgba(52, 199, 89, 0.3)'};
  }
  
  &:disabled {
    opacity: 0.6;
  }
`;

const ActiveAgentsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
`;

const AgentCard = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 16px;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
  }
`;

const AgentHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
`;

const AgentTitle = styled.div`
  font-family: ${macosTheme.fonts.system};
  font-size: 14px;
  font-weight: 600;
  color: white;
`;

const StatusBadge = styled.div<{ $status: string }>`
  padding: 2px 8px;
  border-radius: 10px;
  font-family: ${macosTheme.fonts.system};
  font-size: 10px;
  font-weight: 500;
  
  background: ${props => {
    switch (props.$status.toLowerCase()) {
      case 'running': return 'rgba(52, 199, 89, 0.2)';
      case 'starting': return 'rgba(255, 159, 10, 0.2)';
      case 'stopping': return 'rgba(255, 69, 58, 0.2)';
      default: return 'rgba(255, 255, 255, 0.2)';
    }
  }};
  
  color: ${props => {
    switch (props.$status.toLowerCase()) {
      case 'running': return '#34c759';
      case 'starting': return '#ff9f0a';
      case 'stopping': return '#ff453a';
      default: return 'rgba(255, 255, 255, 0.8)';
    }
  }};
`;

const AgentDetails = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 16px;
`;

const AgentDetail = styled.div`
  font-family: ${macosTheme.fonts.system};
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  
  .label {
    opacity: 0.7;
    margin-bottom: 2px;
  }
  
  .value {
    color: rgba(255, 255, 255, 0.9);
    font-weight: 500;
  }
`;

const StopButton = styled.button`
  background: rgba(255, 69, 58, 0.2);
  border: 1px solid rgba(255, 69, 58, 0.3);
  border-radius: 6px;
  color: #ff453a;
  padding: 6px 12px;
  font-family: ${macosTheme.fonts.system};
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  justify-content: center;
  transition: all 0.15s ease;
  
  &:hover {
    background: rgba(255, 69, 58, 0.3);
  }
`;

// Helper function to get user-friendly error messages
const getUserFriendlyMessage = (error: string): string => {
  if (error.includes('API key')) {
    return 'API key configuration issue. Please check your provider settings.';
  }
  if (error.includes('FLY_API_TOKEN')) {
    return 'Fly.io API token not configured. Please set up your deployment credentials.';
  }
  if (error.includes('network') || error.includes('fetch')) {
    return 'Network connection issue. Please check your internet connection.';
  }
  if (error.includes('timeout')) {
    return 'Operation timed out. The service may be busy, please try again.';
  }
  if (error.includes('not found')) {
    return 'Resource not found. The agent may have been removed.';
  }
  return error;
};

interface AgentDashboardProps {
  id: string;
  title?: string;
  zIndex: number;
  initialPosition: { x: number; y: number };
  onClose: (id: string) => void;
  onFocus: (id: string) => void;
  serverUrl: string;
}

const AgentDashboard: React.FC<AgentDashboardProps> = ({
  id,
  title = 'Agent Dashboard',
  zIndex,
  initialPosition,
  onClose,
  onFocus,
  serverUrl
}) => {
  const [agentConfigs, setAgentConfigs] = useState<Record<string, AgentConfig>>({});
  const [activeAgents, setActiveAgents] = useState<ActiveAgent[]>([]);
  const [flyEnabled, setFlyEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [spawning, setSpawning] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isActive, setIsActive] = useState(true);
  
  // Toast management
  const showToast = (type: Toast['type'], message: string, action?: Toast['action']) => {
    const toast: Toast = {
      id: Date.now().toString(),
      type,
      message: getUserFriendlyMessage(message),
      action
    };
    
    setToasts(prev => [...prev, toast]);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id));
    }, 5000);
  };

  const dismissToast = (toastId: string) => {
    setToasts(prev => prev.filter(t => t.id !== toastId));
  };

  // Fetch agent configurations and active agents
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch configurations
        const configRes = await fetch(`${serverUrl}/api/agents/configs`);
        if (!configRes.ok) {
          throw new Error(`Failed to fetch configurations: ${configRes.statusText}`);
        }
        
        const configData = await configRes.json();
        if (configData.success) {
          setAgentConfigs(configData.data);
          setFlyEnabled(configData.flyEnabled);
        }

        // Fetch active agents
        const activeRes = await fetch(`${serverUrl}/api/agents/active`);
        if (!activeRes.ok) {
          throw new Error(`Failed to fetch active agents: ${activeRes.statusText}`);
        }
        
        const activeData = await activeRes.json();
        if (activeData.success) {
          setActiveAgents(activeData.data);
        }
      } catch (error) {
        console.error('Error fetching agent data:', error);
        showToast('error', error instanceof Error ? error.message : 'Failed to load agent data', {
          label: 'Retry',
          onClick: fetchData
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Poll for updates every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [serverUrl]);

  const handleSpawnAgent = async (agentType: string) => {
    setSpawning(prev => new Set(prev).add(agentType));
    
    try {
      const response = await fetch(`${serverUrl}/api/agents/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentType })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        showToast('success', `${agentType} agent spawned successfully!`);
        
        // Refresh active agents
        const activeRes = await fetch(`${serverUrl}/api/agents/active`);
        if (activeRes.ok) {
          const activeData = await activeRes.json();
          if (activeData.success) {
            setActiveAgents(activeData.data);
          }
        }
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Error spawning agent:', error);
      showToast('error', error instanceof Error ? error.message : 'Failed to spawn agent', {
        label: 'Try Again',
        onClick: () => handleSpawnAgent(agentType)
      });
    } finally {
      setSpawning(prev => {
        const next = new Set(prev);
        next.delete(agentType);
        return next;
      });
    }
  };

  const handleStopAgent = async (agentId: string, agentType: string) => {
    try {
      const response = await fetch(`${serverUrl}/api/agents/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        showToast('success', `${agentType} agent stopped successfully`);
        // Remove from active agents
        setActiveAgents(prev => prev.filter(a => a.agentId !== agentId));
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Error stopping agent:', error);
      showToast('error', error instanceof Error ? error.message : 'Failed to stop agent', {
        label: 'Try Again',
        onClick: () => handleStopAgent(agentId, agentType)
      });
    }
  };

  const formatDuration = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const getToastIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success': return <CheckCircle size={16} />;
      case 'error': return <XCircle size={16} />;
      case 'warning': return <AlertTriangle size={16} />;
      case 'info': return <AlertCircle size={16} />;
    }
  };

  const handleFocus = () => {
    setIsActive(true);
    onFocus(id);
  };

  return (
    <>
      {/* Toast notifications */}
      <ToastContainer>
        {toasts.map(toast => (
          <ToastWrapper key={toast.id} $type={toast.type}>
            <ToastIcon $type={toast.type}>
              {getToastIcon(toast.type)}
            </ToastIcon>
            <ToastContent>{toast.message}</ToastContent>
            {toast.action && (
              <ToastAction onClick={toast.action.onClick}>
                {toast.action.label}
              </ToastAction>
            )}
            <button 
              onClick={() => dismissToast(toast.id)}
              style={{ 
                background: 'none', 
                border: 'none', 
                color: 'rgba(255,255,255,0.6)', 
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={12} />
            </button>
          </ToastWrapper>
        ))}
      </ToastContainer>

      <Draggable handle=".drag-handle" defaultPosition={initialPosition}>
        <WindowWrapper style={{ zIndex }} onMouseDown={handleFocus}>
          <Window $active={isActive}>
            <TitleBar className="drag-handle" $active={isActive}>
              <TrafficLights>
                <TrafficLight 
                  $color="close" 
                  $active={isActive}
                  onClick={(e) => { e.stopPropagation(); onClose(id); }}
                >
                  <X size={8} strokeWidth={2.5} />
                </TrafficLight>
                <TrafficLight $color="minimize" $active={isActive}>
                  <Minus size={8} strokeWidth={2.5} />
                </TrafficLight>
                <TrafficLight $color="maximize" $active={isActive}>
                  <Maximize2 size={6} strokeWidth={2.5} />
                </TrafficLight>
              </TrafficLights>
              <Title>{title}</Title>
              <div style={{ width: 52 }} />
            </TitleBar>

            <Content>
              {!flyEnabled && (
                <Banner $variant="warning">
                  <AlertCircle size={16} />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Agent spawning is disabled</div>
                    <div>Configure FLY_API_TOKEN in your environment to enable dynamic agent deployment on Fly.io infrastructure.</div>
                  </div>
                </Banner>
              )}

              {/* Available Agents Section */}
              <SectionHeader>
                <Play size={20} />
                Available Agents {!flyEnabled && '(Disabled)'}
              </SectionHeader>

              {loading ? (
                <div style={{ 
                  textAlign: 'center', 
                  color: 'rgba(255,255,255,0.6)', 
                  padding: '40px',
                  fontFamily: macosTheme.fonts.system 
                }}>
                  Loading agent configurations...
                </div>
              ) : (
                <ConfigGrid>
                  {Object.entries(agentConfigs).map(([type, config]) => (
                    <ConfigCard key={type}>
                      <ConfigTitle>{config.name}</ConfigTitle>
                      <ConfigDescription>{config.description}</ConfigDescription>
                      <ConfigDetails>
                        <ConfigProvider>
                          {config.provider} • {config.model}
                        </ConfigProvider>
                      </ConfigDetails>
                      <SpawnButton
                        $spawning={spawning.has(type)}
                        onClick={() => handleSpawnAgent(type)}
                        disabled={!flyEnabled || spawning.has(type)}
                      >
                        {spawning.has(type) ? (
                          <>
                            <Activity size={14} className="animate-spin" />
                            Spawning...
                          </>
                        ) : (
                          <>
                            <Play size={14} />
                            Spawn Agent
                          </>
                        )}
                      </SpawnButton>
                    </ConfigCard>
                  ))}
                </ConfigGrid>
              )}

              {/* Active Agents Section */}
              <SectionHeader>
                <Activity size={20} />
                Active Agents ({activeAgents.length})
              </SectionHeader>

              {activeAgents.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  color: 'rgba(255,255,255,0.6)',
                  padding: '40px',
                  fontFamily: macosTheme.fonts.system,
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  borderRadius: '8px',
                  border: '1px dashed rgba(255,255,255,0.1)'
                }}>
                  <Activity size={32} style={{ marginBottom: 16, opacity: 0.5 }} />
                  <div>No agents are currently running</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>
                    Spawn an agent above to get started
                  </div>
                </div>
              ) : (
                <ActiveAgentsGrid>
                  {activeAgents.map(agent => (
                    <AgentCard key={agent.agentId}>
                      <AgentHeader>
                        <AgentTitle>{agent.agentType}</AgentTitle>
                        <StatusBadge $status={agent.status}>
                          {agent.status}
                        </StatusBadge>
                      </AgentHeader>
                      
                      <AgentDetails>
                        <AgentDetail>
                          <div className="label">Machine ID</div>
                          <div className="value">{agent.machineId || 'N/A'}</div>
                        </AgentDetail>
                        <AgentDetail>
                          <div className="label">Region</div>
                          <div className="value">{agent.region || 'Unknown'}</div>
                        </AgentDetail>
                        <AgentDetail>
                          <div className="label">Runtime</div>
                          <div className="value">
                            <Clock size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                            {formatDuration(agent.connectedAt)}
                          </div>
                        </AgentDetail>
                        <AgentDetail>
                          <div className="label">IP Address</div>
                          <div className="value">{agent.ipAddress || 'Pending'}</div>
                        </AgentDetail>
                      </AgentDetails>

                      <StopButton onClick={() => handleStopAgent(agent.agentId, agent.agentType)}>
                        <Square size={12} />
                        Stop Agent
                      </StopButton>
                    </AgentCard>
                  ))}
                </ActiveAgentsGrid>
              )}
            </Content>
          </Window>
        </WindowWrapper>
      </Draggable>
    </>
  );
};

export default AgentDashboard;