import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import Draggable from 'react-draggable';
import { macosTheme } from '../theme/macos';
import { X, Minus, Maximize2, Activity, Cpu, Wifi, HardDrive } from 'lucide-react';
import SkillsCharacters from './SkillsCharacters';
import ApiMonitoring from './ApiMonitoring';
import MetricsService, { CombinedMetrics } from '../services/MetricsService';

// Animations
const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
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

const StatusCard = styled.div<{ $color?: string }>`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 14px;
  
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
    color: white;
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
  const [metrics, setMetrics] = useState<CombinedMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const nodeRef = useRef<HTMLDivElement>(null);

  const metricsService = MetricsService.getInstance();

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setIsLoading(true);
        const newMetrics = await metricsService.getMetrics();
        setMetrics(newMetrics);
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
        // Fallback to minimal metrics
        setMetrics({
          system: {
            cpu: { usage: 0, cores: 1, model: 'Unknown' },
            memory: { total: 0, used: 0, available: 0, percentage: 0 },
            network: { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0 },
            disk: { total: 0, used: 0, available: 0, percentage: 0 }
          },
          application: {
            agents: { total: 0, active: 0, idle: 0, error: 0 },
            tasks: { total: 0, completed: 0, inProgress: 0, failed: 0 },
            convoys: { total: 0, active: 0, completed: 0 },
            providers: { connected: [], totalRequests: 0, errors: 0, avgResponseTime: 0 }
          },
          timestamp: new Date()
        });
      } finally {
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchMetrics();

    // Update metrics every 3 seconds
    const interval = setInterval(fetchMetrics, 3000);
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
                {isLoading ? (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    height: '200px',
                    color: 'rgba(255,255,255,0.6)',
                    fontFamily: macosTheme.fonts.system
                  }}>
                    Loading metrics...
                  </div>
                ) : metrics ? (
                  <>
                    <StatusGrid>
                      <StatusCard $color="rgba(0, 122, 255, 0.2)">
                        <div className="icon"><Cpu size={18} /></div>
                        <div className="label">CPU Usage</div>
                        <div className="value">{metrics.system.cpu.usage.toFixed(1)}%</div>
                      </StatusCard>
                      <StatusCard $color="rgba(52, 199, 89, 0.2)">
                        <div className="icon"><HardDrive size={18} /></div>
                        <div className="label">Memory</div>
                        <div className="value">{MetricsService.formatBytes(metrics.system.memory.used)}</div>
                      </StatusCard>
                      <StatusCard $color="rgba(191, 90, 242, 0.2)">
                        <div className="icon"><Wifi size={18} /></div>
                        <div className="label">Network In</div>
                        <div className="value">{MetricsService.formatBytes(metrics.system.network.bytesIn)}</div>
                      </StatusCard>
                      <StatusCard $color="rgba(255, 159, 10, 0.2)">
                        <div className="icon"><Activity size={18} /></div>
                        <div className="label">Active Agents</div>
                        <div className="value">{metrics.application.agents.active}</div>
                      </StatusCard>
                    </StatusGrid>
                    
                    <StatusGrid style={{ marginTop: '16px' }}>
                      <StatusCard $color="rgba(255, 69, 58, 0.2)">
                        <div className="icon"><HardDrive size={18} /></div>
                        <div className="label">Total Tasks</div>
                        <div className="value">{metrics.application.tasks.total}</div>
                      </StatusCard>
                      <StatusCard $color="rgba(48, 209, 88, 0.2)">
                        <div className="icon"><Activity size={18} /></div>
                        <div className="label">Completed</div>
                        <div className="value">{metrics.application.tasks.completed}</div>
                      </StatusCard>
                      <StatusCard $color="rgba(255, 214, 10, 0.2)">
                        <div className="icon"><Cpu size={18} /></div>
                        <div className="label">In Progress</div>
                        <div className="value">{metrics.application.tasks.inProgress}</div>
                      </StatusCard>
                      <StatusCard $color="rgba(162, 132, 94, 0.2)">
                        <div className="icon"><Wifi size={18} /></div>
                        <div className="label">Providers</div>
                        <div className="value">{metrics.application.providers.connected.length}</div>
                      </StatusCard>
                    </StatusGrid>
                    
                    <div style={{ 
                      color: 'rgba(255,255,255,0.6)', 
                      fontFamily: macosTheme.fonts.system, 
                      fontSize: 13,
                      marginTop: '20px',
                      padding: '12px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      borderRadius: '6px'
                    }}>
                      <div style={{ marginBottom: '8px', fontWeight: 500 }}>System Status</div>
                      <div>CPU Cores: {metrics.system.cpu.cores} | Memory: {MetricsService.formatBytes(metrics.system.memory.total)}</div>
                      <div>Connected Providers: {metrics.application.providers.connected.join(', ') || 'None'}</div>
                      <div>Last Updated: {metrics.timestamp.toLocaleTimeString()}</div>
                    </div>
                  </>
                ) : (
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontFamily: macosTheme.fonts.system, fontSize: 13 }}>
                    <p>Failed to load system metrics. Please check your configuration.</p>
                  </div>
                )}
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
