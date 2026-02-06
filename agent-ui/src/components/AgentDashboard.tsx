import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import Draggable from 'react-draggable';
import { macosTheme } from '../theme/macos';
import { 
  Square, 
  RefreshCw,
  Cpu,
  Activity,
  Zap,
  Check,
  AlertCircle
} from 'lucide-react';

// ==================== TYPES ====================

export interface AgentConfig {
  name: string;
  model: string;
  provider: string;
  envVar: string;
  description: string;
  color: string;
}

export interface ActiveAgent {
  agentId: string;
  machineId: string;
  type: string;
  name: string;
  status: 'starting' | 'running' | 'stopping' | 'error';
  createdAt: Date;
  model: string;
  provider: string;
  color: string;
}

interface AgentDashboardProps {
  id: string;
  title: string;
  zIndex: number;
  initialPosition: { x: number; y: number };
  onClose: (id: string) => void;
  onFocus: (id: string) => void;
  serverUrl: string;
}

// ==================== ANIMATIONS ====================

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

// ==================== STYLED COMPONENTS ====================

const WindowWrapper = styled.div`
  position: absolute;
  animation: ${fadeIn} 0.2s ease-out;
`;

const Window = styled.div<{ $active?: boolean }>`
  width: 700px;
  height: 600px;
  min-width: 500px;
  min-height: 400px;
  background: rgba(30, 30, 35, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
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
  cursor: move;
  user-select: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.3);
`;

const TrafficLights = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const TrafficLight = styled.button<{ color: string }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  background: ${props => props.color};
  cursor: pointer;
  transition: filter 0.2s;

  &:hover {
    filter: brightness(1.2);
  }
`;

const WindowTitle = styled.span`
  flex: 1;
  font-size: 13px;
  color: ${macosTheme.colors.textSecondary};
  font-weight: 500;
  text-align: center;
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SectionTitle = styled.h3`
  font-size: 14px;
  font-weight: 600;
  color: ${macosTheme.colors.textPrimary};
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const AgentGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
`;

const AgentCard = styled.div<{ $color: string; $disabled?: boolean }>`
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s;
  opacity: ${props => props.$disabled ? 0.5 : 1};
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: ${props => props.$color};
  }

  &:hover {
    ${props => !props.$disabled && `
      border-color: ${props.$color};
      transform: translateY(-2px);
      box-shadow: 0 4px 12px ${props.$color}33;
    `}
  }
`;

const AgentName = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${macosTheme.colors.textPrimary};
`;

const AgentDescription = styled.div`
  font-size: 12px;
  color: ${macosTheme.colors.textSecondary};
  line-height: 1.4;
`;

const AgentModel = styled.div`
  font-size: 11px;
  color: ${macosTheme.colors.textSecondary};
  font-family: 'Monaco', 'Menlo', monospace;
  background: rgba(0, 0, 0, 0.3);
  padding: 4px 8px;
  border-radius: 4px;
  margin-top: auto;
`;

const ActiveAgentsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ActiveAgentItem = styled.div<{ $color: string }>`
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-left: 3px solid ${props => props.$color};
  border-radius: 6px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const AgentInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const AgentTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${macosTheme.colors.textPrimary};
  display: flex;
  align-items: center;
  gap: 8px;
`;

const AgentMeta = styled.div`
  font-size: 11px;
  color: ${macosTheme.colors.textSecondary};
  font-family: 'Monaco', 'Menlo', monospace;
`;

const StatusBadge = styled.div<{ $status: string }>`
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  background: ${props => {
    switch (props.$status) {
      case 'running': return 'rgba(52, 199, 89, 0.2)';
      case 'starting': return 'rgba(255, 159, 10, 0.2)';
      case 'error': return 'rgba(255, 69, 58, 0.2)';
      default: return 'rgba(142, 142, 147, 0.2)';
    }
  }};
  color: ${props => {
    switch (props.$status) {
      case 'running': return '#34c759';
      case 'starting': return '#ff9f0a';
      case 'error': return '#ff453a';
      default: return '#8e8e93';
    }
  }};
`;

const ActionButton = styled.button<{ $variant?: 'danger' }>`
  padding: 6px 12px;
  border-radius: 6px;
  border: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
  background: ${props => props.$variant === 'danger' 
    ? 'rgba(255, 69, 58, 0.2)' 
    : 'rgba(52, 199, 89, 0.2)'};
  color: ${props => props.$variant === 'danger' ? '#ff453a' : '#34c759'};

  &:hover {
    background: ${props => props.$variant === 'danger' 
      ? 'rgba(255, 69, 58, 0.3)' 
      : 'rgba(52, 199, 89, 0.3)'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const EmptyState = styled.div`
  padding: 40px 20px;
  text-align: center;
  color: ${macosTheme.colors.textSecondary};
  font-size: 13px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;

const SpinningIcon = styled.div`
  animation: ${spin} 2s linear infinite;
  display: inline-block;
`;

const Banner = styled.div<{ $variant: 'info' | 'warning' | 'error' }>`
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: ${props => {
    switch (props.$variant) {
      case 'warning': return 'rgba(255, 159, 10, 0.15)';
      case 'error': return 'rgba(255, 69, 58, 0.15)';
      default: return 'rgba(10, 132, 255, 0.15)';
    }
  }};
  color: ${props => {
    switch (props.$variant) {
      case 'warning': return '#ff9f0a';
      case 'error': return '#ff453a';
      default: return '#0a84ff';
    }
  }};
  border: 1px solid ${props => {
    switch (props.$variant) {
      case 'warning': return 'rgba(255, 159, 10, 0.3)';
      case 'error': return 'rgba(255, 69, 58, 0.3)';
      default: return 'rgba(10, 132, 255, 0.3)';
    }
  }};
`;

// ==================== COMPONENT ====================

const AgentDashboard: React.FC<AgentDashboardProps> = ({
  id,
  title,
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

  // Fetch agent configurations and active agents
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch configurations
        const configRes = await fetch(`${serverUrl}/api/agents/configs`);
        const configData = await configRes.json();
        if (configData.success) {
          setAgentConfigs(configData.data);
          setFlyEnabled(configData.flyEnabled);
        }

        // Fetch active agents
        const activeRes = await fetch(`${serverUrl}/api/agents/active`);
        const activeData = await activeRes.json();
        if (activeData.success) {
          setActiveAgents(activeData.data);
        }
      } catch (error) {
        console.error('Error fetching agent data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Poll for updates every 5 seconds
    const interval = setInterval(fetchData, 5000);
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

      const data = await response.json();
      
      if (data.success) {
        // Refresh active agents
        const activeRes = await fetch(`${serverUrl}/api/agents/active`);
        const activeData = await activeRes.json();
        if (activeData.success) {
          setActiveAgents(activeData.data);
        }
      } else {
        alert(`Failed to spawn agent: ${data.error}`);
      }
    } catch (error) {
      console.error('Error spawning agent:', error);
      alert('Failed to spawn agent. Check console for details.');
    } finally {
      setSpawning(prev => {
        const next = new Set(prev);
        next.delete(agentType);
        return next;
      });
    }
  };

  const handleStopAgent = async (agentId: string) => {
    try {
      const response = await fetch(`${serverUrl}/api/agents/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId })
      });

      const data = await response.json();
      
      if (data.success) {
        // Remove from active agents
        setActiveAgents(prev => prev.filter(a => a.agentId !== agentId));
      } else {
        alert(`Failed to stop agent: ${data.error}`);
      }
    } catch (error) {
      console.error('Error stopping agent:', error);
      alert('Failed to stop agent. Check console for details.');
    }
  };

  const formatDuration = (date: Date) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  return (
    <Draggable handle=".drag-handle" defaultPosition={initialPosition}>
      <WindowWrapper style={{ zIndex }} onMouseDown={() => onFocus(id)}>
        <Window $active={true}>
          <TitleBar className="drag-handle" $active={true}>
            <TrafficLights>
              <TrafficLight color="#ff5f56" onClick={() => onClose(id)} />
              <TrafficLight color="#ffbd2e" />
              <TrafficLight color="#27c93f" />
            </TrafficLights>
            <WindowTitle>{title}</WindowTitle>
            <div style={{ width: 60 }} /> {/* Spacer for centering */}
          </TitleBar>

          <Content>
            {!flyEnabled && (
              <Banner $variant="warning">
                <AlertCircle size={16} />
                <div>
                  Agent spawning requires FLY_API_TOKEN to be configured. 
                  Set it in your environment to enable dynamic agent deployment.
                </div>
              </Banner>
            )}

            <Section>
              <SectionTitle>
                <Cpu size={16} />
                Available Agent Types
              </SectionTitle>
              
              {loading ? (
                <EmptyState>
                  <SpinningIcon>
                    <RefreshCw size={24} />
                  </SpinningIcon>
                  Loading agent configurations...
                </EmptyState>
              ) : (
                <AgentGrid>
                  {Object.entries(agentConfigs).map(([type, config]) => (
                    <AgentCard
                      key={type}
                      $color={config.color}
                      $disabled={!flyEnabled || spawning.has(type)}
                      onClick={() => flyEnabled && !spawning.has(type) && handleSpawnAgent(type)}
                    >
                      <AgentName>{config.name}</AgentName>
                      <AgentDescription>{config.description}</AgentDescription>
                      <AgentModel>{config.model}</AgentModel>
                      {spawning.has(type) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                          <SpinningIcon>
                            <RefreshCw size={14} />
                          </SpinningIcon>
                          <span style={{ fontSize: '11px' }}>Spawning...</span>
                        </div>
                      )}
                    </AgentCard>
                  ))}
                </AgentGrid>
              )}
            </Section>

            <Section>
              <SectionTitle>
                <Activity size={16} />
                Active Agents ({activeAgents.length})
              </SectionTitle>

              {activeAgents.length === 0 ? (
                <EmptyState>
                  <Zap size={24} />
                  No agents currently running. Click an agent type above to spawn one.
                </EmptyState>
              ) : (
                <ActiveAgentsList>
                  {activeAgents.map(agent => (
                    <ActiveAgentItem key={agent.agentId} $color={agent.color}>
                      <AgentInfo>
                        <AgentTitle>
                          {agent.name}
                          <StatusBadge $status={agent.status}>
                            {agent.status === 'running' && <Check size={10} />}
                            {agent.status}
                          </StatusBadge>
                        </AgentTitle>
                        <AgentMeta>
                          Machine: {agent.machineId} • Uptime: {formatDuration(agent.createdAt)}
                        </AgentMeta>
                      </AgentInfo>
                      <ActionButton
                        $variant="danger"
                        onClick={() => handleStopAgent(agent.agentId)}
                      >
                        <Square size={12} />
                        Stop
                      </ActionButton>
                    </ActiveAgentItem>
                  ))}
                </ActiveAgentsList>
              )}
            </Section>
          </Content>
        </Window>
      </WindowWrapper>
    </Draggable>
  );
};

export default AgentDashboard;
