import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { apiUrl } from '../utils/api';

interface ProviderData {
  id: string;
  name: string;
  model: string;
  enabled: boolean;
  authenticated: boolean;
  status: 'active' | 'sleeping';
}

interface TaskData {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  tags: string[];
  createdAt: string;
}

const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 8px;
  overflow-y: auto;
  background: #c0c0c0;
`;

const ProvidersGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
`;

const ProviderCard = styled.div<{ active: boolean; isDragging: boolean }>`
  background: ${(props) => props.isDragging ? '#ffff00' : props.active ? '#ffffff' : '#d3d3d3'};
  border: 2px solid #808080;
  padding: 12px;
  cursor: ${(props) => props.active ? 'grab' : 'not-allowed'};
  display: flex;
  flex-direction: column;
  gap: 8px;
  opacity: ${(props) => !props.active ? 0.6 : 1};
  &:active {
    cursor: grabbing;
  }
`;

const ProviderHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
  font-size: 12px;
`;

const StatusBadge = styled.span<{ status: 'active' | 'sleeping' }>`
  padding: 2px 6px;
  font-size: 10px;
  border-radius: 2px;
  background: ${(props) => props.status === 'active' ? '#00ff00' : '#ffa500'};
  color: black;
`;

const ProviderDetails = styled.div`
  font-size: 10px;
  color: #404040;
`;

const Loading = styled.div`
  padding: 20px;
  text-align: center;
  color: #800080;
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
`;

const ModalContainer = styled.div`
  background: #c0c0c0;
  border: 3px solid;
  border-color: #ffffff #808080 #808080 #ffffff;
  width: 400px;
  max-height: 80vh;
  overflow-y: auto;
`;

const ModalHeader = styled.div`
  background: linear-gradient(to right, #000080, #1084d0);
  color: white;
  padding: 8px 12px;
  font-weight: bold;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const CloseButton = styled.button`
  background: #c0c0c0;
  border: 2px solid;
  border-color: #ffffff #808080 #808080 #ffffff;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 12px;
  font-family: ms_sans_serif;
  &:active {
    border-color: #808080 #ffffff #ffffff #808080;
  }
`;

const ModalContent = styled.div`
  padding: 12px;
`;

const TaskItem = styled.div<{ $selected: boolean }>`
  padding: 8px;
  margin-bottom: 8px;
  background: ${(props) => props.$selected ? '#000080' : '#ffffff'};
  color: ${(props) => props.$selected ? 'white' : 'black'};
  border: 1px solid #808080;
  cursor: pointer;
  font-size: 12px;
  &:hover {
    background: #c0c0c0;
  }
`;

const TaskTitle = styled.div`
  font-weight: bold;
  margin-bottom: 4px;
`;

const TaskMeta = styled.div<{ $selected: boolean }>`
  font-size: 10px;
  color: ${(props) => props.$selected ? '#c0c0c0' : '#404040'};
`;

const SelectedSkill = styled.div`
  margin-bottom: 12px;
  padding: 8px;
  background: #ffff00;
  border: 1px solid #808080;
  font-size: 12px;
  font-weight: bold;
`;

const ApiMonitoring: React.FC = () => {
  const [providers, setProviders] = useState<ProviderData[]>([]);
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedProvider, setDraggedProvider] = useState<ProviderData | null>(null);
  const [showTaskSelector, setShowTaskSelector] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [providersRes, tasksRes] = await Promise.all([
          fetch(apiUrl('/api/providers')),
          fetch(apiUrl('/api/tasks'))
        ]);

        const providersData = await providersRes.json();
        const tasksData = await tasksRes.json();

        if (providersData.success) {
          setProviders(providersData.data);
        }

        if (tasksData.success) {
          setTasks(tasksData.data);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDragStart = (provider: ProviderData, e: React.DragEvent) => {
    if (provider.status === 'sleeping') {
      setDraggedProvider(provider);
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  const handleDragEnd = () => {
    setDraggedProvider(null);
  };

  const handleTaskSelect = async (task: TaskData) => {
    if (!draggedProvider || !selectedSkill) return;

    try {
      const response = await fetch(apiUrl('/api/activate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: draggedProvider.id,
          taskId: task.id,
          skillName: selectedSkill
        })
      });

      const result = await response.json();

      if (result.success) {
        setShowTaskSelector(false);
        setSelectedTask(null);
        setSelectedSkill(null);

        const updatedProviders = providers.map(p =>
          p.id === draggedProvider.id ? { ...p, status: 'active' as const } : p
        );
        setProviders(updatedProviders);
      }
    } catch (err) {
      console.error('Failed to activate provider:', err);
    }
  };

  if (loading) {
    return <Loading>Loading providers and tasks...</Loading>;
  }

  return (
    <Container>
      <h3 style={{ margin: '0 0 12px 0', color: '#000080' }}>API Providers</h3>
      <ProvidersGrid>
        {providers.map((provider) => (
          <ProviderCard
            key={provider.id}
            active={provider.status === 'active'}
            isDragging={draggedProvider?.id === provider.id}
            draggable={provider.status === 'sleeping'}
            onDragStart={(e) => handleDragStart(provider, e)}
            onDragEnd={handleDragEnd}
          >
            <ProviderHeader>
              <span>{provider.name}</span>
              <StatusBadge status={provider.status}>
                {provider.status.toUpperCase()}
              </StatusBadge>
            </ProviderHeader>
            <ProviderDetails>
              <div>Model: {provider.model}</div>
              <div>Auth: {provider.authenticated ? 'Yes' : 'No'}</div>
            </ProviderDetails>
          </ProviderCard>
        ))}
      </ProvidersGrid>

      <h3 style={{ margin: '16px 0 12px 0', color: '#000080' }}>
        Outstanding Tasks
      </h3>
      {tasks.length === 0 ? (
        <div style={{ padding: '20px', color: '#404040', textAlign: 'center' }}>
          No outstanding tasks
        </div>
      ) : (
        tasks.map((task) => (
          <TaskItem
            key={task.id}
            $selected={selectedTask === task.id}
            onClick={() => {
              if (draggedProvider) {
                handleTaskSelect(task);
              }
            }}
            onDragOver={(e) => {
              if (draggedProvider) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }
            }}
            onDrop={() => draggedProvider && handleTaskSelect(task)}
          >
            <TaskTitle>{task.title}</TaskTitle>
            <TaskMeta $selected={selectedTask === task.id}>
              Status: {task.status} | Priority: {task.priority} | Tags: {task.tags.join(', ')}
            </TaskMeta>
          </TaskItem>
        ))
      )}

      {showTaskSelector && draggedProvider && (
        <ModalOverlay onClick={() => setShowTaskSelector(false)}>
          <ModalContainer onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <span>Activate {draggedProvider.name}</span>
              <CloseButton onClick={() => setShowTaskSelector(false)}>X</CloseButton>
            </ModalHeader>
            <ModalContent>
              {selectedSkill && (
                <SelectedSkill>Using skill: {selectedSkill}</SelectedSkill>
              )}
              <div style={{ marginTop: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
                Select a task:
              </div>
              {tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  $selected={selectedTask === task.id}
                  onClick={() => handleTaskSelect(task)}
                >
                  <TaskTitle>{task.title}</TaskTitle>
                  <TaskMeta $selected={selectedTask === task.id}>
                    {task.description.substring(0, 60)}
                    {task.description.length > 60 ? '...' : ''}
                  </TaskMeta>
                </TaskItem>
              ))}
            </ModalContent>
          </ModalContainer>
        </ModalOverlay>
      )}
    </Container>
  );
};

export default ApiMonitoring;
