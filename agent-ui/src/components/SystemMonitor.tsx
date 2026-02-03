import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import Draggable from 'react-draggable';
import { macosTheme } from '../theme/macos';
import { X, Minus, Maximize2, Activity, Cpu, Wifi, HardDrive } from 'lucide-react';
import SkillsCharacters from './SkillsCharacters';
import ApiMonitoring from './ApiMonitoring';

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
  const nodeRef = useRef<HTMLDivElement>(null);
  
  // Fake stats for overview
  const [stats, setStats] = useState({
    cpu: 23,
    memory: 4.2,
    network: '1.2 MB/s',
    agents: 3
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        cpu: Math.min(100, Math.max(10, prev.cpu + (Math.random() * 10 - 5))),
        memory: Math.min(8, Math.max(2, prev.memory + (Math.random() * 0.4 - 0.2))),
        network: `${(Math.random() * 2 + 0.5).toFixed(1)} MB/s`,
        agents: prev.agents
      }));
    }, 2000);
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
                <StatusGrid>
                  <StatusCard $color="rgba(0, 122, 255, 0.2)">
                    <div className="icon"><Cpu size={18} /></div>
                    <div className="label">CPU Usage</div>
                    <div className="value">{stats.cpu.toFixed(0)}%</div>
                  </StatusCard>
                  <StatusCard $color="rgba(52, 199, 89, 0.2)">
                    <div className="icon"><HardDrive size={18} /></div>
                    <div className="label">Memory</div>
                    <div className="value">{stats.memory.toFixed(1)} GB</div>
                  </StatusCard>
                  <StatusCard $color="rgba(191, 90, 242, 0.2)">
                    <div className="icon"><Wifi size={18} /></div>
                    <div className="label">Network</div>
                    <div className="value">{stats.network}</div>
                  </StatusCard>
                  <StatusCard $color="rgba(255, 159, 10, 0.2)">
                    <div className="icon"><Activity size={18} /></div>
                    <div className="label">Active Agents</div>
                    <div className="value">{stats.agents}</div>
                  </StatusCard>
                </StatusGrid>
                
                <div style={{ color: 'rgba(255,255,255,0.6)', fontFamily: macosTheme.fonts.system, fontSize: 13 }}>
                  <p>System is running normally. All agents are operational.</p>
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
