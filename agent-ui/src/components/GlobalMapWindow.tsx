import React, { useRef } from 'react';
import styled from 'styled-components';
import { Window, WindowHeader, WindowContent, Button } from 'react95';
import Draggable from 'react-draggable';

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
}

const StyledWindow = styled(Window)`
  width: min(720px, calc(100vw - 80px));
  height: min(520px, calc(100vh - 80px));
  position: absolute;
  display: flex;
  flex-direction: column;
  min-width: 320px;
  min-height: 240px;
`;

const StyledWindowContent = styled(WindowContent)`
  flex: 1;
  display: flex;
  padding: 8px;
  gap: 8px;
  background: #c0c0c0;
  overflow: hidden;
`;

const MapArea = styled.div`
  flex: 1;
  position: relative;
  border: 2px solid;
  border-color: #ffffff #808080 #808080 #ffffff;
  background: #008080;
  overflow: hidden;
`;

const Sidebar = styled.div`
  width: 220px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Panel = styled.div`
  flex: 1;
  background: #ffffff;
  border: 2px solid;
  border-color: #ffffff #808080 #808080 #ffffff;
  padding: 6px;
  overflow-y: auto;
  font-size: 11px;
`;

const PanelTitle = styled.div`
  font-weight: bold;
  margin-bottom: 6px;
  font-size: 12px;
`;

const AgentNode = styled.div<{ $status: GlobalMapAgent['status'] }>`
  position: absolute;
  min-width: 110px;
  padding: 4px 6px;
  background: #c0c0c0;
  border: 2px solid #808080;
  font-size: 10px;
  color: #000;
  box-shadow: 1px 1px 0 #0000004d;
  border-left-color: ${({ $status }) =>
    $status === 'working'
      ? '#00ff00'
      : $status === 'error'
        ? '#ff0000'
        : $status === 'offline'
          ? '#808080'
          : '#ffff00'};
`;

const StatusTag = styled.span<{ $status: GlobalMapAgent['status'] }>`
  display: inline-block;
  margin-top: 2px;
  padding: 1px 4px;
  background: ${({ $status }) =>
    $status === 'working'
      ? '#00ff00'
      : $status === 'error'
        ? '#ff0000'
        : $status === 'offline'
          ? '#808080'
          : '#ffff00'};
  color: #000;
  font-size: 9px;
`;

const EmptyState = styled.div`
  color: #404040;
  font-style: italic;
  text-align: center;
  margin-top: 8px;
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
            <span style={{ marginLeft: 4 }}>{title}</span>
            <Button onClick={() => onClose(id)} size="sm" square>
              <span style={{ fontWeight: 'bold', transform: 'translateY(-1px)' }}>x</span>
            </Button>
          </WindowHeader>
          <StyledWindowContent>
            <MapArea>
              {agents.length === 0 && <EmptyState>No active agents.</EmptyState>}
              {agents.map((agent) => (
                <AgentNode
                  key={agent.id}
                  $status={agent.status}
                  style={{ left: agent.position.x, top: agent.position.y }}
                >
                  <div>{agent.name}</div>
                  <StatusTag $status={agent.status}>{agent.status}</StatusTag>
                </AgentNode>
              ))}
            </MapArea>
            <Sidebar>
              <Panel>
                <PanelTitle>Active Agents</PanelTitle>
                {agents.length === 0 && <EmptyState>No agents connected.</EmptyState>}
                {agents.map((agent) => (
                  <div key={agent.id} style={{ marginBottom: 6 }}>
                    <div>{agent.name}</div>
                    <div style={{ color: '#404040' }}>{agent.skills.slice(0, 2).join(', ') || 'No skills'}</div>
                  </div>
                ))}
              </Panel>
              <Panel>
                <PanelTitle>Recent Messages</PanelTitle>
                {messages.length === 0 && <EmptyState>No messages yet.</EmptyState>}
                {messages.slice(0, 5).map((message) => (
                  <div key={message.id} style={{ marginBottom: 6 }}>
                    <div>{message.snippet || message.subject || 'Untitled'}</div>
                    <div style={{ color: '#404040' }}>
                      {message.from} → {message.to}
                    </div>
                  </div>
                ))}
              </Panel>
            </Sidebar>
          </StyledWindowContent>
        </StyledWindow>
      </div>
    </Draggable>
  );
};

export default GlobalMapWindow;
