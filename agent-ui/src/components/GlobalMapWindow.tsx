import React, { useRef } from 'react';
import styled from 'styled-components';
import { Window, WindowHeader, WindowContent, Button } from 'react95';
import Draggable from 'react-draggable';

/**
 * Represents an agent in the global map
 */
export interface GlobalMapAgent {
  id: string;
  name: string;
  status: 'idle' | 'working' | 'error' | 'offline';
  skills: string[];
  position: { x: number; y: number };
}

/**
 * Represents a message in the global map
 */
export interface GlobalMapMessage {
  id: string;
  from: string;
  to: string;
  kind: string;
  subject: string;
  body: string;
  timestamp: string;
  snippet: string;
  status: 'queued' | 'sent';
  createdAt: string;
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
}

const StyledWindow = styled(Window)`
  width: min(800px, calc(100vw - 100px));
  height: min(600px, calc(100vh - 100px));
  position: absolute;
  display: flex;
  flex-direction: column;
  min-width: 400px;
  min-height: 300px;
`;

const StyledWindowContent = styled(WindowContent)`
  flex: 1;
  display: flex;
  padding: 8px;
  background: #c0c0c0;
  overflow: hidden;
  position: relative;
`;

const MapContainer = styled.div`
  flex: 1;
  position: relative;
  background: linear-gradient(135deg, #87CEEB 0%, #98FB98 100%);
  border: 2px inset #808080;
  overflow: hidden;
`;

const AgentNode = styled.div<{ $status: GlobalMapAgent['status'] }>`
  position: absolute;
  width: 80px;
  height: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #c0c0c0;
  border: 2px solid;
  border-color: #ffffff #808080 #808080 #ffffff;
  padding: 4px;
  cursor: pointer;
  
  &:hover {
    background: #d0d0d0;
  }
`;

const AgentIcon = styled.div<{ $status: GlobalMapAgent['status'] }>`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: ${props => {
    switch (props.$status) {
      case 'working': return '#00ff00';
      case 'error': return '#ff0000';
      case 'offline': return '#808080';
      default: return '#0000ff';
    }
  }};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
`;

const AgentName = styled.div`
  font-size: 10px;
  text-align: center;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 72px;
`;

const StatusIndicator = styled.div<{ $status: GlobalMapAgent['status'] }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => {
    switch (props.$status) {
      case 'working': return '#00ff00';
      case 'error': return '#ff0000';
      case 'offline': return '#808080';
      default: return '#ffff00';
    }
  }};
  position: absolute;
  top: 4px;
  right: 4px;
  box-shadow: 0 0 4px ${props => {
    switch (props.$status) {
      case 'working': return '#00ff00';
      case 'error': return '#ff0000';
      default: return 'transparent';
    }
  }};
`;

const Sidebar = styled.div`
  width: 200px;
  background: #c0c0c0;
  border-left: 2px solid #808080;
  padding: 8px;
  overflow-y: auto;
`;

const SidebarTitle = styled.div`
  font-weight: bold;
  font-size: 12px;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #808080;
`;

const MessageItem = styled.div`
  background: white;
  border: 1px solid #808080;
  padding: 4px;
  margin-bottom: 4px;
  font-size: 10px;
`;

const GlobalMapWindow: React.FC<GlobalMapWindowProps> = ({
  id,
  title,
  zIndex,
  initialPosition,
  onClose,
  onFocus,
  agents,
  messages
}) => {
  const nodeRef = useRef<HTMLDivElement>(null);

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".window-header"
      defaultPosition={initialPosition}
      onMouseDown={() => onFocus(id)}
    >
      <div ref={nodeRef} style={{ position: 'absolute', zIndex }}>
        <StyledWindow className="window">
          <WindowHeader
            className="window-header"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <span style={{ marginLeft: 4 }}>
              <img
                src="https://win98icons.alexmeub.com/icons/png/world-2.png"
                alt="map"
                style={{ width: 16, height: 16, marginRight: 4, verticalAlign: 'middle' }}
              />
              {title}
            </span>
            <Button onClick={() => onClose(id)} size="sm" square>
              <span style={{ fontWeight: 'bold', transform: 'translateY(-1px)' }}>x</span>
            </Button>
          </WindowHeader>
          <StyledWindowContent>
            <MapContainer>
              {agents.length === 0 ? (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  color: '#666'
                }}>
                  <img
                    src="https://win98icons.alexmeub.com/icons/png/world-2.png"
                    alt="map"
                    style={{ width: 48, height: 48, opacity: 0.5 }}
                  />
                  <div style={{ marginTop: 8 }}>No agents connected</div>
                  <div style={{ fontSize: 10 }}>Start some terminals to see agents here</div>
                </div>
              ) : (
                agents.map((agent) => (
                  <AgentNode
                    key={agent.id}
                    $status={agent.status}
                    style={{ left: agent.position.x, top: agent.position.y }}
                  >
                    <StatusIndicator $status={agent.status} />
                    <AgentIcon $status={agent.status}>
                      🤖
                    </AgentIcon>
                    <AgentName title={agent.name}>{agent.name}</AgentName>
                  </AgentNode>
                ))
              )}
            </MapContainer>
            <Sidebar>
              <SidebarTitle>📬 Messages ({messages.length})</SidebarTitle>
              {messages.length === 0 ? (
                <div style={{ fontSize: 10, color: '#666', textAlign: 'center', padding: 8 }}>
                  No messages yet
                </div>
              ) : (
                messages.slice(0, 10).map((msg) => (
                  <MessageItem key={msg.id}>
                    <div style={{ fontWeight: 'bold' }}>{msg.from} → {msg.to}</div>
                    <div style={{ color: '#666' }}>{msg.snippet}</div>
                    <div style={{ color: '#999', fontSize: 9 }}>{msg.createdAt}</div>
                  </MessageItem>
                ))
              )}
            </Sidebar>
          </StyledWindowContent>
        </StyledWindow>
      </div>
    </Draggable>
  );
};

export default GlobalMapWindow;
