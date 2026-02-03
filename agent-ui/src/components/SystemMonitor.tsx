import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Tabs, Tab } from 'react95';
import SkillsCharacters from './SkillsCharacters';
import ApiMonitoring from './ApiMonitoring';

interface SystemMonitorProps {
  id: string;
  zIndex: number;
  initialPosition: { x: number; y: number };
  onClose: (id: string) => void;
  onFocus: (id: string) => void;
}

const Container = styled.div`
  width: 900px;
  height: 600px;
  display: flex;
  flex-direction: column;
  background: #c0c0c0;
  border: 2px solid;
  border-color: #ffffff #808080 #808080 #ffffff;
`;

const Header = styled.div`
  padding: 4px 8px;
  background: linear-gradient(to right, #000080, #1084d0);
  color: white;
  font-weight: bold;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Icon = styled.img`
  width: 16px;
  height: 16px;
`;

const Content = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const SystemMonitor: React.FC<SystemMonitorProps> = ({
  id,
  zIndex,
  initialPosition,
  onClose,
  onFocus
}) => {
  void onClose;
  const [activeTab, setActiveTab] = useState<'skills' | 'apis'>('skills');
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.no-drag')) return;

    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    onFocus(id);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  return (
    <div
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex
      }}
    >
      <Container onMouseDown={handleMouseDown}>
        <Header>
          <Icon src="https://win98icons.alexmeub.com/icons/png/monitor-0.png" alt="monitor" />
          <span>System Monitor</span>
        </Header>
        <Content>
          <Tabs value={activeTab} onChange={(value) => setActiveTab(value as 'skills' | 'apis')}>
            <Tab value="skills">Skills</Tab>
            <Tab value="apis">API Monitor</Tab>
          </Tabs>

          {activeTab === 'skills' && <SkillsCharacters />}
          {activeTab === 'apis' && <ApiMonitoring />}
        </Content>
      </Container>
    </div>
  );
};

export default SystemMonitor;
