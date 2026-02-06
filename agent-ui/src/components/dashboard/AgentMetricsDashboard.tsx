import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Clock, Users, Zap, CheckCircle } from 'lucide-react';

const DashboardContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-template-rows: auto auto 1fr;
  gap: 16px;
  padding: 16px;
  height: 100%;
  width: 100%;
  background-color: #f0f2f5;
  color: #1a1a1a;
  font-family: 'Inter', sans-serif;
  overflow-y: auto;
`;

const Header = styled.header`
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 700;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const StatCard = styled.div`
  grid-column: span 3;
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  
  @media (max-width: 1024px) {
    grid-column: span 6;
  }
  @media (max-width: 600px) {
    grid-column: span 12;
  }
`;

const StatValue = styled.div`
  font-size: 32px;
  font-weight: 700;
  margin-top: 8px;
`;

const StatLabel = styled.div`
  font-size: 14px;
  color: #666;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const MainChartContainer = styled.div`
  grid-column: span 8;
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  min-height: 400px;
  
  @media (max-width: 1024px) {
    grid-column: span 12;
  }
`;

const QueueContainer = styled.div`
  grid-column: span 4;
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  overflow-y: auto;
  max-height: 400px;

  @media (max-width: 1024px) {
    grid-column: span 12;
  }
`;

const QueueItem = styled.div<{ $priority: string }>`
  padding: 12px;
  margin-bottom: 8px;
  border-radius: 8px;
  background: #f8f9fa;
  border-left: 4px solid ${props => {
    switch(props.$priority?.toLowerCase()) {
      case 'critical': return '#ef4444';
      case 'high': return '#f97316';
      case 'medium': return '#3b82f6';
      default: return '#10b981';
    }
  }};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Badge = styled.span<{ type: string }>`
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: ${props => props.type === 'active' ? '#dcfce7' : '#e5e7eb'};
  color: ${props => props.type === 'active' ? '#166534' : '#374151'};
`;

interface MetricPoint {
  time: string;
  activeAgents: number;
  memoryUsage: number;
}

interface QueueTask {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'processing' | 'completed';
  timestamp: Date;
}

export const AgentMetricsDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricPoint[]>([]);
  const [queue, setQueue] = useState<QueueTask[]>([]);
  const [stats, setStats] = useState({
    activeAgents: 0,
    completedTasks: 0,
    uptime: '0m',
    avgResponseTime: '—'
  });

  const fetchData = async () => {
    try {
      // Fetch Tasks
      const tasksRes = await fetch('/api/tasks');
      const tasksData = await tasksRes.json();
      if (tasksData.success && Array.isArray(tasksData.data)) {
        const tasks = tasksData.data.map((t: any) => ({
          id: t.id,
          title: t.title,
          priority: t.priority || 'medium',
          status: t.status,
          timestamp: new Date(t.createdAt)
        }));
        
        // Sort by priority
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        tasks.sort((a: any, b: any) => {
          const pA = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2;
          const pB = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2;
          return pA - pB;
        });

        setQueue(tasks);
        setStats(prev => ({ 
          ...prev, 
          completedTasks: tasks.filter((t: any) => t.status === 'completed').length 
        }));
      }

      // Fetch Active Agents & Health (measure response time)
      const healthStart = performance.now();
      const [agentsRes, healthRes] = await Promise.all([
        fetch('/api/agents/active'),
        fetch('/api/health')
      ]);
      const healthLatency = Math.round(performance.now() - healthStart);
      
      const agentsData = await agentsRes.json();
      const healthData = await healthRes.json();

      const activeCount = agentsData.success ? agentsData.data.length : 0;
      const memUsage = healthData.memoryUsage ? Math.round(healthData.memoryUsage.rss / 1024 / 1024) : 0;
      const uptime = healthData.uptimeFormatted || '0m';

      setStats(prev => ({
        ...prev,
        activeAgents: activeCount,
        uptime,
        avgResponseTime: `${healthLatency}ms`
      }));

      // Update Chart
      const now = new Date();
      const timeStr = now.toLocaleTimeString();
      setMetrics(prev => {
        const newPoint = {
          time: timeStr,
          activeAgents: activeCount,
          memoryUsage: memUsage
        };
        const newMetrics = [...prev, newPoint];
        if (newMetrics.length > 20) newMetrics.shift();
        return newMetrics;
      });

    } catch (error) {
      console.error("Failed to fetch dashboard metrics", error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <DashboardContainer>
      <Header>
        <Title>
          <Activity size={24} color="#3b82f6" />
          Agent Performance Dashboard
        </Title>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Badge type="active">System Online</Badge>
          <span style={{ color: '#666', fontSize: '14px' }}>Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </Header>

      <StatCard>
        <StatLabel><Users size={16} /> Active Agents</StatLabel>
        <StatValue>{stats.activeAgents}</StatValue>
      </StatCard>
      
      <StatCard>
        <StatLabel><CheckCircle size={16} /> Tasks Completed</StatLabel>
        <StatValue>{stats.completedTasks}</StatValue>
      </StatCard>
      
      <StatCard>
        <StatLabel><Zap size={16} /> Avg Response Time</StatLabel>
        <StatValue>{stats.avgResponseTime}</StatValue>
      </StatCard>
      
      <StatCard>
        <StatLabel><Clock size={16} /> System Uptime</StatLabel>
        <StatValue>{stats.uptime}</StatValue>
      </StatCard>

      <MainChartContainer>
        <h3>Real-time System Metrics</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={metrics}>
            <defs>
              <linearGradient id="colorAgents" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="time" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <CartesianGrid strokeDasharray="3 3" />
            <Tooltip />
            <Area yAxisId="left" type="monotone" dataKey="activeAgents" stroke="#3b82f6" fillOpacity={1} fill="url(#colorAgents)" name="Active Agents" />
            <Area yAxisId="right" type="monotone" dataKey="memoryUsage" stroke="#10b981" fillOpacity={1} fill="url(#colorMem)" name="Memory (MB)" />
          </AreaChart>
        </ResponsiveContainer>
      </MainChartContainer>

      <QueueContainer>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3>Task Queue</h3>
          <Badge type="neutral">{queue.length} Tasks</Badge>
        </div>
        {queue.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>No active tasks</div>
        ) : (
          queue.map(task => (
            <QueueItem key={task.id} $priority={task.priority}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>{task.title}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>{task.id} • {task.priority.toUpperCase()}</div>
              </div>
              {task.status === 'processing' && <Activity size={16} className="animate-pulse" color="#3b82f6" />}
              {task.status === 'completed' && <CheckCircle size={16} color="#10b981" />}
            </QueueItem>
          ))
        )}
      </QueueContainer>
    </DashboardContainer>
  );
};

export default AgentMetricsDashboard;
