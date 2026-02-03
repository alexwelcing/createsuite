import React, { useCallback, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import Draggable from 'react-draggable';
import { macosTheme } from '../theme/macos';
import { X, Minus, Maximize2, Users, MessageSquare, Activity, Wifi } from 'lucide-react';

export interface GlobalMapAgent {
  id: string;
  name: string;
  status: 'idle' | 'working' | 'error' | 'offline';
  skills: string[];
  position: { x: number; y: number };
}

export interface GlobalMapMessage {
  id: string;
  from: string;
  to: string;
  kind: string;
  subject?: string;
  body?: string;
  timestamp?: string;
  snippet?: string;
  status?: string;
  createdAt?: string;
}

interface GlobalMapWindowProps {
  id: string;
  title: string;
  zIndex: number;
  initialPosition: { x: number; y: number };
  onClose: (id: string) => void;
  onFocus: (id: string) => void;
  agents: GlobalMapAgent[];
  messages: GlobalMapMessage[];
  maxAgentSkills?: number;
  maxRecentMessages?: number;
}

// Animations
const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.8; }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
`;

// Styled Components
const WindowWrapper = styled.div`
  position: absolute;
  animation: ${fadeIn} 0.2s ease-out;
`;

const Window = styled.div<{ $active?: boolean }>`
  width: min(800px, calc(100vw - 80px));
  height: min(560px, calc(100vh - 120px));
  min-width: 600px;
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

const Content = styled.div`
  flex: 1;
  display: flex;
  overflow: hidden;
`;

const MapArea = styled.div`
  flex: 1;
  position: relative;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: 
      radial-gradient(circle at 30% 70%, rgba(78, 205, 196, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 70% 30%, rgba(120, 119, 198, 0.1) 0%, transparent 50%);
    pointer-events: none;
  }
  
  /* Grid pattern */
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
  }
`;

const Sidebar = styled.div`
  width: 240px;
  background: rgba(0, 0, 0, 0.3);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Panel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  
  &:not(:last-child) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
`;

const PanelHeader = styled.div`
  padding: 12px 14px;
  font-family: ${macosTheme.fonts.system};
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0, 0, 0, 0.2);
`;

const PanelContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }
`;

const AgentNode = styled.div<{ $status: GlobalMapAgent['status'] }>`
  position: absolute;
  min-width: 120px;
  padding: 10px 12px;
  background: rgba(40, 40, 45, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: all 0.2s ease;
  animation: ${float} 3s ease-in-out infinite;
  animation-delay: ${() => Math.random() * 2}s;
  
  &:hover {
    transform: translateY(-5px) scale(1.02);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    border-color: ${props => {
      switch (props.$status) {
        case 'working': return 'rgba(52, 199, 89, 0.5)';
        case 'error': return 'rgba(255, 69, 58, 0.5)';
        case 'offline': return 'rgba(142, 142, 147, 0.5)';
        default: return 'rgba(255, 204, 0, 0.5)';
      }
    }};
  }
`;

const AgentName = styled.div`
  font-family: ${macosTheme.fonts.system};
  font-size: 13px;
  font-weight: 500;
  color: white;
  margin-bottom: 6px;
`;

const StatusIndicator = styled.div<{ $status: GlobalMapAgent['status'] }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: 10px;
  font-family: ${macosTheme.fonts.system};
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  
  background: ${props => {
    switch (props.$status) {
      case 'working': return 'rgba(52, 199, 89, 0.2)';
      case 'error': return 'rgba(255, 69, 58, 0.2)';
      case 'offline': return 'rgba(142, 142, 147, 0.2)';
      default: return 'rgba(255, 204, 0, 0.2)';
    }
  }};
  
  color: ${props => {
    switch (props.$status) {
      case 'working': return '#34c759';
      case 'error': return '#ff453a';
      case 'offline': return '#8e8e93';
      default: return '#ffcc00';
    }
  }};
`;

const StatusDot = styled.span<{ $status: GlobalMapAgent['status'] }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  
  background: ${props => {
    switch (props.$status) {
      case 'working': return '#34c759';
      case 'error': return '#ff453a';
      case 'offline': return '#8e8e93';
      default: return '#ffcc00';
    }
  }};
  
  ${props => props.$status === 'working' && `
    animation: ${pulse} 1.5s ease-in-out infinite;
  `}
`;

const AgentListItem = styled.div`
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 6px;
  background: rgba(255, 255, 255, 0.05);
  transition: background 0.15s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`;

const AgentListName = styled.div`
  font-family: ${macosTheme.fonts.system};
  font-size: 13px;
  font-weight: 500;
  color: white;
  margin-bottom: 4px;
`;

const AgentListSkills = styled.div`
  font-family: ${macosTheme.fonts.system};
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
`;

const MessageItem = styled.div`
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 6px;
  background: rgba(255, 255, 255, 0.05);
  transition: background 0.15s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`;

const MessageTitle = styled.div`
  font-family: ${macosTheme.fonts.system};
  font-size: 12px;
  font-weight: 500;
  color: white;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const MessageMeta = styled.div`
  font-family: ${macosTheme.fonts.system};
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  display: flex;
  align-items: center;
  gap: 4px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 20px;
  font-family: ${macosTheme.fonts.system};
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  font-style: italic;
`;

const ConnectionLine = styled.svg`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
`;

const DEFAULT_MAX_AGENT_SKILLS = 3;
const DEFAULT_MAX_RECENT_MESSAGES = 6;

const GlobalMapWindow: React.FC<GlobalMapWindowProps> = ({
  id,
  title,
  zIndex,
  initialPosition,
  onClose,
  onFocus,
  agents,
  messages,
  maxAgentSkills,
  maxRecentMessages
}) => {
  const resolvedMaxAgentSkills = maxAgentSkills ?? DEFAULT_MAX_AGENT_SKILLS;
  const resolvedMaxRecentMessages = maxRecentMessages ?? DEFAULT_MAX_RECENT_MESSAGES;
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(true);
  
  const hasAgents = agents.length > 0;
  
  const getMessageTitle = useCallback(
    (message: GlobalMapMessage) => message.snippet || message.subject || 'Untitled',
    []
  );

  const handleFocus = () => {
    setIsActive(true);
    onFocus(id);
  };

  // Generate connection lines between agents
  const renderConnections = () => {
    if (agents.length < 2) return null;
    
    const lines: React.ReactNode[] = [];
    for (let i = 0; i < agents.length - 1; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        const a1 = agents[i];
        const a2 = agents[j];
        lines.push(
          <line
            key={`${a1.id}-${a2.id}`}
            x1={a1.position.x + 60}
            y1={a1.position.y + 25}
            x2={a2.position.x + 60}
            y2={a2.position.y + 25}
            stroke="rgba(120, 119, 198, 0.2)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        );
      }
    }
    return lines;
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
            <Title>
              <Wifi size={14} />
              {title}
            </Title>
            <div style={{ width: 52 }} />
          </TitleBar>
          
          <Content>
            <MapArea>
              {/* Connection lines */}
              <ConnectionLine>
                {renderConnections()}
              </ConnectionLine>
              
              {/* Empty state */}
              {!hasAgents && (
                <EmptyState style={{ 
                  position: 'absolute', 
                  top: '50%', 
                  left: '50%', 
                  transform: 'translate(-50%, -50%)',
                  background: 'rgba(0,0,0,0.3)',
                  padding: '20px 30px',
                  borderRadius: 12
                }}>
                  <Users size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
                  <div>No agents connected</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>
                    Launch an agent to see them here
                  </div>
                </EmptyState>
              )}
              
              {/* Agent nodes */}
              {agents.map((agent) => (
                <AgentNode
                  key={agent.id}
                  $status={agent.status}
                  style={{ left: agent.position.x, top: agent.position.y }}
                >
                  <AgentName>{agent.name}</AgentName>
                  <StatusIndicator $status={agent.status}>
                    <StatusDot $status={agent.status} />
                    {agent.status}
                  </StatusIndicator>
                </AgentNode>
              ))}
            </MapArea>
            
            <Sidebar>
              <Panel>
                <PanelHeader>
                  <Activity size={12} />
                  Active Agents ({agents.length})
                </PanelHeader>
                <PanelContent>
                  {!hasAgents && <EmptyState>No agents connected</EmptyState>}
                  {agents.map((agent) => (
                    <AgentListItem key={agent.id}>
                      <AgentListName>
                        <StatusDot $status={agent.status} style={{ display: 'inline-block', marginRight: 8 }} />
                        {agent.name}
                      </AgentListName>
                      <AgentListSkills>
                        {agent.skills.length > 0
                          ? agent.skills.slice(0, resolvedMaxAgentSkills).join(' • ')
                          : 'No skills registered'}
                      </AgentListSkills>
                    </AgentListItem>
                  ))}
                </PanelContent>
              </Panel>
              
              <Panel>
                <PanelHeader>
                  <MessageSquare size={12} />
                  Recent Messages
                </PanelHeader>
                <PanelContent>
                  {messages.length === 0 && <EmptyState>No messages yet</EmptyState>}
                  {messages.slice(0, resolvedMaxRecentMessages).map((message) => (
                    <MessageItem key={message.id}>
                      <MessageTitle>{getMessageTitle(message)}</MessageTitle>
                      <MessageMeta>
                        <span>{message.from}</span>
                        <span>→</span>
                        <span>{message.to}</span>
                      </MessageMeta>
                    </MessageItem>
                  ))}
                </PanelContent>
              </Panel>
            </Sidebar>
          </Content>
        </Window>
      </WindowWrapper>
    </Draggable>
  );
};

export default GlobalMapWindow;
