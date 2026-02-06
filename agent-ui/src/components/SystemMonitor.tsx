import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import Draggable from 'react-draggable';
import { macosTheme } from '../theme/macos';
import { X, Minus, Maximize2, Activity, Cpu, Wifi, HardDrive, AlertTriangle } from 'lucide-react';
import SkillsCharacters from './SkillsCharacters';
import ApiMonitoring from './ApiMonitoring';

// Types for real system metrics
interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    used: number;
    total: number;
    available: number;
  };
  network: {
    bytesPerSecond: number;
    packetsPerSecond: number;
  };
  agents: {
    active: number;
    idle: number;
    total: number;
    errors: number;
  };
  uptime: number;
  lastUpdated: Date;
}

interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

// Animations
const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
`;

// Styled Components
const WindowWrapper = styled.div`
  position: absolute;
  animation: ${fadeIn} 0.2s ease-out;
`;

const Window = styled.div<{ $active?: boolean }>`
  width: 900px;
  height: 600px;
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

const Toolbar = styled.div`
  display: flex;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const TabButton = styled.button<{ $active?: boolean }>`
  flex: 1;
  padding: 10px 16px;
  border: none;
  background: ${props => props.$active 
    ? 'rgba(255, 255, 255, 0.1)' 
    : 'transparent'};
  color: ${props => props.$active 
    ? 'white' 
    : 'rgba(255, 255, 255, 0.6)'};
  font-family: ${macosTheme.fonts.system};
  font-size: 13px;
  font-weight: ${props => props.$active ? '500' : '400'};
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-bottom: 2px solid ${props => props.$active ? '#007aff' : 'transparent'};
  
  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
`;

const Content = styled.div`
  flex: 1;
  overflow: auto;
  padding: 16px;
  
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

// Status Overview Panel
const StatusGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
`;

const StatusCard = styled.div<{ $color?: string; $loading?: boolean; $error?: boolean }>`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid ${props => props.$error ? 'rgba(255, 69, 58, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
  border-radius: 8px;
  padding: 14px;
  opacity: ${props => props.$loading ? 0.7 : 1};
  animation: ${props => props.$loading ? pulse : 'none'} 2s infinite;
  
  .icon {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    background: ${props => props.$color || 'rgba(0, 122, 255, 0.2)'};
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 10px;
    
    svg {
      color: ${props => props.$color?.replace('0.2', '1') || '#007aff'};
    }
  }
  
  .label {
    font-family: ${macosTheme.fonts.system};
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 4px;
  }
  
  .value {
    font-family: ${macosTheme.fonts.system};
    font-size: 20px;
    font-weight: 600;
    color: ${props => props.$error ? '#ff453a' : 'white'};
  }

  .subtitle {
    font-family: ${macosTheme.fonts.system};
    font-size: 10px;
    color: rgba(255, 255, 255, 0.4);
    margin-top: 2px;
  }
`;

const ErrorMessage = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgba(255, 69, 58, 0.1);
  border: 1px solid rgba(255, 69, 58, 0.2);
  border-radius: 6px;
  color: #ff453a;
  font-family: ${macosTheme.fonts.system};
  font-size: 13px;
  margin-bottom: 16px;
`;

const RefreshButton = styled.button`
  background: rgba(0, 122, 255, 0.2);
  border: 1px solid rgba(0, 122, 255, 0.3);
  border-radius: 6px;
  color: #007aff;
  padding: 6px 12px;
  font-family: ${macosTheme.fonts.system};
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-left: auto;

  &:hover {
    background: rgba(0, 122, 255, 0.3);
  }
`;

interface SystemMonitorProps {
  id: string;
  title?: string;
  zIndex: number;
  initialPosition: { x: number; y: number };
  onClose: (id: string) => void;
  onFocus: (id: string) => void;
}

const SystemMonitor: React.FC<SystemMonitorProps> = ({
  id,
  title = 'Activity Monitor',
  zIndex,
  initialPosition,
  onClose,
  onFocus
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'skills' | 'apis'>('overview');
  const [isActive, setIsActive] = useState(true);
  const nodeRef = useRef<HTMLDivElement>(null);
  
  // Real system metrics state
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: true,
    error: null
  });

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format uptime to human readable
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Fetch real system metrics
  const fetchMetrics = async () => {
    try {
      setLoadingState({ isLoading: true, error: null });
      
      const response = await fetch('/api/system/metrics');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      setMetrics({
        cpu: {
          usage: data.cpu?.usage || 0,
          cores: data.cpu?.cores || 1
        },
        memory: {
          used: data.memory?.used || 0,
          total: data.memory?.total || 8,
          available: data.memory?.available || 8
        },
        network: {
          bytesPerSecond: data.network?.bytesPerSecond || 0,
          packetsPerSecond: data.network?.packetsPerSecond || 0
        },
        agents: {
          active: data.agents?.active || 0,
          idle: data.agents?.idle || 0,
          total: data.agents?.total || 0,
          errors: data.agents?.errors || 0
        },
        uptime: data.uptime || 0,
        lastUpdated: new Date()
      });
      
      setLoadingState({ isLoading: false, error: null });
    } catch (error) {
      console.warn('Failed to fetch system metrics:', error);
      
      // Fallback to mock data for development
      setMetrics({
        cpu: { usage: 15 + Math.random() * 30, cores: 8 },
        memory: { used: 4.2, total: 16, available: 11.8 },
        network: { bytesPerSecond: 1024 * 1024 * 1.5, packetsPerSecond: 1200 },
        agents: { active: 2, idle: 1, total: 3, errors: 0 },
        uptime: 86400 * 3 + 3600 * 4, // 3 days 4 hours
        lastUpdated: new Date()
      });
      
      setLoadingState({
        isLoading: false,
        error: 'Using mock data. API endpoint /api/system/metrics not available.'
      });
    }
  };

  // Auto-refresh metrics
  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

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
          
          <Toolbar>
            <TabButton 
              $active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
            >
              <Activity size={16} /> Overview
            </TabButton>
            <TabButton 
              $active={activeTab === 'skills'}
              onClick={() => setActiveTab('skills')}
            >
              <Cpu size={16} /> Skills
            </TabButton>
            <TabButton 
              $active={activeTab === 'apis'}
              onClick={() => setActiveTab('apis')}
            >
              <Wifi size={16} /> API Monitor
            </TabButton>
          </Toolbar>
          
          <Content>
            {activeTab === 'overview' && (
              <>
                {loadingState.error && (
                  <ErrorMessage>
                    <AlertTriangle size={16} />
                    {loadingState.error}
                    <RefreshButton onClick={fetchMetrics}>
                      Retry
                    </RefreshButton>
                  </ErrorMessage>
                )}
                
                <StatusGrid>
                  <StatusCard 
                    $color="rgba(0, 122, 255, 0.2)" 
                    $loading={loadingState.isLoading}
                  >
                    <div className="icon"><Cpu size={18} /></div>
                    <div className="label">CPU Usage</div>
                    <div className="value">
                      {metrics ? `${metrics.cpu.usage.toFixed(1)}%` : '--'}
                    </div>
                    {metrics && (
                      <div className="subtitle">
                        {metrics.cpu.cores} cores
                      </div>
                    )}
                  </StatusCard>
                  
                  <StatusCard 
                    $color="rgba(52, 199, 89, 0.2)"
                    $loading={loadingState.isLoading}
                  >
                    <div className="icon"><HardDrive size={18} /></div>
                    <div className="label">Memory</div>
                    <div className="value">
                      {metrics ? `${metrics.memory.used.toFixed(1)} GB` : '--'}
                    </div>
                    {metrics && (
                      <div className="subtitle">
                        of {metrics.memory.total.toFixed(1)} GB
                      </div>
                    )}
                  </StatusCard>
                  
                  <StatusCard 
                    $color="rgba(191, 90, 242, 0.2)"
                    $loading={loadingState.isLoading}
                  >
                    <div className="icon"><Wifi size={18} /></div>
                    <div className="label">Network</div>
                    <div className="value">
                      {metrics ? formatBytes(metrics.network.bytesPerSecond) : '--'}
                    </div>
                    {metrics && (
                      <div className="subtitle">
                        {metrics.network.packetsPerSecond} pkt/s
                      </div>
                    )}
                  </StatusCard>
                  
                  <StatusCard 
                    $color="rgba(255, 159, 10, 0.2)"
                    $loading={loadingState.isLoading}
                    $error={metrics?.agents.errors ? metrics.agents.errors > 0 : false}
                  >
                    <div className="icon"><Activity size={18} /></div>
                    <div className="label">Active Agents</div>
                    <div className="value">
                      {metrics ? `${metrics.agents.active}` : '--'}
                    </div>
                    {metrics && (
                      <div className="subtitle">
                        {metrics.agents.idle} idle, {metrics.agents.errors} errors
                      </div>
                    )}
                  </StatusCard>
                </StatusGrid>
                
                <div style={{ 
                  color: 'rgba(255,255,255,0.6)', 
                  fontFamily: macosTheme.fonts.system, 
                  fontSize: 13,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <p style={{ margin: '0 0 8px 0' }}>
                      System uptime: {metrics ? formatUptime(metrics.uptime) : 'Unknown'}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, opacity: 0.7 }}>
                      Last updated: {metrics?.lastUpdated.toLocaleTimeString() || 'Never'}
                    </p>
                  </div>
                  <RefreshButton onClick={fetchMetrics} disabled={loadingState.isLoading}>
                    {loadingState.isLoading ? 'Refreshing...' : 'Refresh'}
                  </RefreshButton>
                </div>
              </>
            )}
            {activeTab === 'skills' && <SkillsCharacters />}
            {activeTab === 'apis' && <ApiMonitoring />}
          </Content>
        </Window>
      </WindowWrapper>
    </Draggable>
  );
};

export default SystemMonitor;
