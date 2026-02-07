/**
 * AgentBuddyList — AIM-inspired agent status panel
 *
 * Pays homage to the AOL Instant Messenger buddy list:
 *   - Category groups (Online / Away / Offline)
 *   - Status dots + away messages
 *   - Door open/close sound concept (visual "signed on" toasts)
 *   - Classic yellow-cream palette with our own CreateSuite twist
 *
 * Data comes from /api/agents and /api/health. Click a buddy to
 * spawn their terminal, double-click for info. It's a friends list
 * for your AI workforce.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';

// ── Types ────────────────────────────────────────────────────

interface AgentBuddy {
  id: string;
  name: string;
  screenName: string;       // AIM-style screen name
  status: 'online' | 'away' | 'idle' | 'offline';
  provider: string;
  model: string;
  awayMessage?: string;
  idleMinutes?: number;
  taskCount?: number;
  capabilities?: string[];
}

interface SignOnEvent {
  id: string;
  name: string;
  type: 'sign-on' | 'sign-off';
  timestamp: number;
}

interface AgentBuddyListProps {
  onLaunchAgent: (name: string, command: string) => void;
}

// ── Hardcoded agent roster (the "Buddy List") ────────────────

const AGENT_ROSTER: Omit<AgentBuddy, 'status'>[] = [
  {
    id: 'sisyphus',
    name: 'Sisyphus',
    screenName: 'xXSisyphusXx',
    provider: 'anthropic',
    model: 'claude-opus-4.5',
    capabilities: ['code', 'refactor', 'debug'],
  },
  {
    id: 'oracle',
    name: 'Oracle',
    screenName: 'Th3Oracle',
    provider: 'openai',
    model: 'gpt-5.2',
    capabilities: ['architecture', 'analysis', 'review'],
  },
  {
    id: 'engineer',
    name: 'Engineer',
    screenName: 'GeminiEng',
    provider: 'google',
    model: 'gemini-3-pro',
    capabilities: ['code', 'test', 'deploy'],
  },
  {
    id: 'architect',
    name: 'Architect',
    screenName: 'KimiArch2k5',
    provider: 'openai',
    model: 'kimi-k2.5',
    capabilities: ['design', 'planning', 'system'],
  },
  {
    id: 'zai',
    name: 'Z.ai Agent',
    screenName: 'Z_Coder47',
    provider: 'zai-coding-plan',
    model: 'glm-4.7',
    capabilities: ['code', 'generate', 'optimize'],
  },
  {
    id: 'asset-gen',
    name: 'Asset Generator',
    screenName: 'HF_Diffusion',
    provider: 'huggingface',
    model: 'stable-diffusion-3.5-large',
    capabilities: ['image', 'asset', 'sprite'],
  },
];

// ── Animations ───────────────────────────────────────────────

const doorOpen = keyframes`
  0% { opacity: 0; transform: translateX(-20px); }
  100% { opacity: 1; transform: translateX(0); }
`;

const fadeSlideOut = keyframes`
  0% { opacity: 1; transform: translateX(0); }
  100% { opacity: 0; transform: translateX(20px); }
`;

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 4px rgba(76, 175, 80, 0.3); }
  50% { box-shadow: 0 0 12px rgba(76, 175, 80, 0.7); }
`;

const idleBounce = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
`;

// ── Styled Components ────────────────────────────────────────

const BuddyListContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(180deg, #fefdf5 0%, #f5f0d8 100%);
  color: #333;
  font-family: 'Tahoma', 'Geneva', 'Verdana', sans-serif;
  font-size: 12px;
  user-select: none;
  overflow: hidden;
`;

const BuddyHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: linear-gradient(180deg, #ffde59 0%, #f5c518 100%);
  border-bottom: 1px solid #d4a800;
  min-height: 44px;
`;

const RunningMan = styled.div`
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  animation: ${idleBounce} 1.5s ease-in-out infinite;
`;

const HeaderInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

const MyScreenName = styled.div`
  font-weight: bold;
  font-size: 13px;
  color: #1a1a1a;
`;

const MyStatus = styled.div`
  font-size: 10px;
  color: #555;
`;

const OnlineCount = styled.div`
  font-size: 10px;
  color: #666;
  padding: 4px 8px;
  background: rgba(0,0,0,0.04);
  border-radius: 3px;
`;

const BuddyScroll = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;

  &::-webkit-scrollbar {
    width: 8px;
  }
  &::-webkit-scrollbar-track {
    background: #ede8cc;
  }
  &::-webkit-scrollbar-thumb {
    background: #c8b86a;
    border-radius: 4px;
  }
`;

const GroupHeader = styled.div<{ $expanded: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  cursor: pointer;
  font-weight: bold;
  font-size: 11px;
  color: #444;
  
  &:hover {
    background: rgba(0,0,0,0.04);
  }

  &::before {
    content: '${(p) => p.$expanded ? '▼' : '►'}';
    font-size: 8px;
    color: #888;
    width: 10px;
  }
`;

const GroupCount = styled.span`
  font-weight: normal;
  color: #999;
  font-size: 10px;
  margin-left: auto;
`;

const BuddyRow = styled.div<{ $status: string }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px 5px 26px;
  cursor: pointer;
  transition: background 0.1s;

  &:hover {
    background: linear-gradient(180deg, #d0e8ff 0%, #b8d4f0 100%);
  }

  &:active {
    background: #a0c4e8;
  }

  ${p => p.$status === 'online' && css`
    animation: ${doorOpen} 0.3s ease-out;
  `}
`;

const StatusDot = styled.div<{ $status: string }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  
  ${p => {
    switch (p.$status) {
      case 'online': return css`
        background: #4caf50;
        animation: ${pulseGlow} 2s ease-in-out infinite;
      `;
      case 'away': return css`
        background: #ff9800;
        box-shadow: 0 0 4px rgba(255, 152, 0, 0.4);
      `;
      case 'idle': return css`
        background: #ffc107;
        box-shadow: 0 0 4px rgba(255, 193, 7, 0.3);
      `;
      default: return css`
        background: #9e9e9e;
      `;
    }
  }}
`;

const BuddyInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const BuddyName = styled.div<{ $status: string }>`
  font-size: 12px;
  font-weight: ${p => p.$status === 'online' ? 'bold' : 'normal'};
  color: ${p => p.$status === 'offline' ? '#999' : '#222'};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const AwayMessage = styled.div`
  font-size: 10px;
  color: #888;
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 1px;
`;

const BuddyBadge = styled.div`
  font-size: 9px;
  color: #fff;
  background: #666;
  padding: 1px 5px;
  border-radius: 8px;
  flex-shrink: 0;
`;

const ModelTag = styled.div`
  font-size: 9px;
  color: #777;
  flex-shrink: 0;
`;

// ── Sign-on/off toast ────────────────────────────────────────

const ToastContainer = styled.div`
  position: absolute;
  bottom: 42px;
  left: 8px;
  right: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 10;
  pointer-events: none;
`;

const Toast = styled.div<{ $type: 'sign-on' | 'sign-off' }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 11px;
  pointer-events: none;
  animation: ${p => p.$type === 'sign-on' ? doorOpen : fadeSlideOut} 0.4s ease-out;
  
  ${p => p.$type === 'sign-on' ? css`
    background: linear-gradient(135deg, #e8f5e9, #c8e6c9);
    border: 1px solid #a5d6a7;
    color: #2e7d32;
  ` : css`
    background: linear-gradient(135deg, #fce4ec, #f8bbd0);
    border: 1px solid #ef9a9a;
    color: #c62828;
  `}
`;

// ── Footer / toolbar ─────────────────────────────────────────

const Footer = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  background: linear-gradient(180deg, #e8e2c0 0%, #ddd6a8 100%);
  border-top: 1px solid #c8b86a;
`;

const FooterButton = styled.button`
  padding: 3px 8px;
  font-size: 10px;
  font-family: 'Tahoma', sans-serif;
  background: linear-gradient(180deg, #fafaf0 0%, #e8e2c0 100%);
  border: 1px solid #b0a870;
  border-radius: 3px;
  cursor: pointer;
  color: #333;

  &:hover {
    background: linear-gradient(180deg, #fffff0 0%, #f0ecd0 100%);
  }
  &:active {
    background: #d0ca9c;
  }
`;

const SearchBox = styled.input`
  flex: 1;
  padding: 3px 6px;
  font-size: 10px;
  font-family: 'Tahoma', sans-serif;
  border: 1px solid #b0a870;
  border-radius: 3px;
  background: #fff;
  outline: none;
  color: #333;

  &::placeholder {
    color: #aaa;
  }
  &:focus {
    border-color: #8888cc;
    box-shadow: 0 0 3px rgba(136,136,204,0.4);
  }
`;

// ── Info panel (shows on buddy hover/select) ─────────────────

const InfoPanel = styled.div`
  padding: 8px 12px;
  background: linear-gradient(180deg, #fff8dc 0%, #f5eecc 100%);
  border-top: 1px solid #d4cc8a;
  font-size: 11px;
  color: #444;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const InfoLabel = styled.span`
  color: #888;
  font-size: 10px;
`;

const InfoValue = styled.span`
  font-weight: bold;
  font-size: 10px;
`;

const CapabilityTags = styled.div`
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
`;

const CapTag = styled.span`
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(0,0,0,0.06);
  color: #555;
`;

const LaunchButton = styled.button`
  margin-top: 4px;
  padding: 4px 0;
  font-size: 11px;
  font-family: 'Tahoma', sans-serif;
  font-weight: bold;
  background: linear-gradient(180deg, #4caf50 0%, #388e3c 100%);
  color: #fff;
  border: 1px solid #2e7d32;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: linear-gradient(180deg, #66bb6a 0%, #43a047 100%);
  }
  &:active {
    background: #2e7d32;
  }
`;

// ── Component ────────────────────────────────────────────────

const AWAY_MESSAGES = [
  'Refactoring the universe...',
  'brb, compiling thoughts',
  '🔨 building something cool',
  'Out to lunch (training data)',
  'Currently vibing in latent space',
  'Pondering P vs NP',
  'Gone fishing in the token stream',
];

const AgentBuddyList: React.FC<AgentBuddyListProps> = ({ onLaunchAgent }) => {
  const [buddies, setBuddies] = useState<AgentBuddy[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    online: true,
    away: true,
    idle: false,
    offline: false,
  });
  const [selectedBuddy, setSelectedBuddy] = useState<string | null>(null);
  const [signOnEvents, setSignOnEvents] = useState<SignOnEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const prevStatusRef = useRef<Record<string, string>>({});

  // Fetch agent data and merge with roster
  useEffect(() => {
    const controller = new AbortController();

    const fetchBuddies = async () => {
      try {
        const [agentsRes, healthRes] = await Promise.all([
          fetch('/api/agents', { signal: controller.signal }).catch(() => null),
          fetch('/api/health', { signal: controller.signal }).catch(() => null),
        ]);

        const agentData = agentsRes?.ok ? await agentsRes.json() : { data: [] };
        const healthData = healthRes?.ok ? await healthRes.json() : {};
        const liveAgents = agentData.data || [];
        const isServerUp = healthData.status === 'ok';

        const merged: AgentBuddy[] = AGENT_ROSTER.map((roster, i) => {
          const live = liveAgents.find(
            (a: { id?: string; name?: string }) => a.id === roster.id || a.name === roster.name
          );

          let status: AgentBuddy['status'] = 'offline';
          let awayMessage: string | undefined;
          let taskCount: number | undefined;

          if (live) {
            const rawStatus = live.status as string;
            if (rawStatus === 'working' || rawStatus === 'active') {
              status = 'online';
            } else if (rawStatus === 'idle') {
              status = 'idle';
              awayMessage = AWAY_MESSAGES[i % AWAY_MESSAGES.length];
            } else if (rawStatus === 'error' || rawStatus === 'away') {
              status = 'away';
              awayMessage = live.statusMessage || 'Experiencing technical difficulties...';
            }
            taskCount = live.taskCount;
          } else if (isServerUp) {
            // Server is up but agent isn't registered — show as away
            status = 'away';
            awayMessage = AWAY_MESSAGES[i % AWAY_MESSAGES.length];
          }

          return { ...roster, status, awayMessage, taskCount };
        });

        // Detect sign-on / sign-off transitions
        const prev = prevStatusRef.current;
        const newEvents: SignOnEvent[] = [];

        for (const buddy of merged) {
          const old = prev[buddy.id];
          if (old && old !== buddy.status) {
            if (buddy.status === 'online' && old !== 'online') {
              newEvents.push({ id: buddy.id, name: buddy.screenName, type: 'sign-on', timestamp: Date.now() });
            } else if (buddy.status === 'offline' && old !== 'offline') {
              newEvents.push({ id: buddy.id, name: buddy.screenName, type: 'sign-off', timestamp: Date.now() });
            }
          }
          prev[buddy.id] = buddy.status;
        }

        if (newEvents.length > 0) {
          setSignOnEvents(evts => [...evts, ...newEvents]);
          // Auto-clear toasts after 3s
          setTimeout(() => {
            setSignOnEvents(evts => evts.filter(e => !newEvents.includes(e)));
          }, 3000);
        }

        setBuddies(merged);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // Server unreachable — everyone offline
        setBuddies(
          AGENT_ROSTER.map(r => ({ ...r, status: 'offline' as const }))
        );
      }
    };

    fetchBuddies();
    const interval = setInterval(fetchBuddies, 4000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  const toggleGroup = useCallback((group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  }, []);

  const handleBuddyClick = useCallback((id: string) => {
    setSelectedBuddy(prev => prev === id ? null : id);
  }, []);

  const handleLaunch = useCallback((buddy: AgentBuddy) => {
    const cmd = `export OPENCODE_PROVIDER=${buddy.provider} OPENCODE_MODEL=${buddy.model}; echo "Starting ${buddy.name}..."; opencode`;
    onLaunchAgent(buddy.name, cmd);
  }, [onLaunchAgent]);

  // Filter + group buddies
  const filteredBuddies = searchQuery
    ? buddies.filter(b =>
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.screenName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.model.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : buddies;

  const groups: Record<string, AgentBuddy[]> = {
    online: filteredBuddies.filter(b => b.status === 'online'),
    away: filteredBuddies.filter(b => b.status === 'away'),
    idle: filteredBuddies.filter(b => b.status === 'idle'),
    offline: filteredBuddies.filter(b => b.status === 'offline'),
  };

  const onlineCount = groups.online.length + groups.away.length + groups.idle.length;
  const selected = selectedBuddy ? buddies.find(b => b.id === selectedBuddy) : null;

  return (
    <BuddyListContainer>
      {/* AIM-style header */}
      <BuddyHeader>
        <RunningMan>🏃</RunningMan>
        <HeaderInfo>
          <MyScreenName>CreateSuite</MyScreenName>
          <MyStatus>Agent Orchestrator v1.0</MyStatus>
        </HeaderInfo>
        <OnlineCount>{onlineCount}/{buddies.length} online</OnlineCount>
      </BuddyHeader>

      {/* Buddy groups */}
      <BuddyScroll>
        {(['online', 'away', 'idle', 'offline'] as const).map(groupKey => {
          const groupBuddies = groups[groupKey];
          if (groupBuddies.length === 0) return null;

          const label = {
            online: 'Agents Online',
            away: 'Agents Away',
            idle: 'Idle',
            offline: 'Offline',
          }[groupKey];

          return (
            <React.Fragment key={groupKey}>
              <GroupHeader
                $expanded={expandedGroups[groupKey] ?? false}
                onClick={() => toggleGroup(groupKey)}
              >
                {label}
                <GroupCount>({groupBuddies.length})</GroupCount>
              </GroupHeader>

              {expandedGroups[groupKey] && groupBuddies.map(buddy => (
                <BuddyRow
                  key={buddy.id}
                  $status={buddy.status}
                  onClick={() => handleBuddyClick(buddy.id)}
                  onDoubleClick={() => handleLaunch(buddy)}
                  title={`Double-click to launch ${buddy.name}`}
                >
                  <StatusDot $status={buddy.status} />
                  <BuddyInfo>
                    <BuddyName $status={buddy.status}>
                      {buddy.screenName}
                    </BuddyName>
                    {buddy.awayMessage && (
                      <AwayMessage>{buddy.awayMessage}</AwayMessage>
                    )}
                  </BuddyInfo>
                  {buddy.taskCount != null && buddy.taskCount > 0 && (
                    <BuddyBadge>{buddy.taskCount} tasks</BuddyBadge>
                  )}
                  <ModelTag>{buddy.model}</ModelTag>
                </BuddyRow>
              ))}
            </React.Fragment>
          );
        })}
      </BuddyScroll>

      {/* Sign-on/off toasts */}
      {signOnEvents.length > 0 && (
        <ToastContainer>
          {signOnEvents.map(evt => (
            <Toast key={`${evt.id}-${evt.timestamp}`} $type={evt.type}>
              {evt.type === 'sign-on' ? '🚪 ' : '👋 '}
              <strong>{evt.name}</strong>
              {evt.type === 'sign-on' ? ' has signed on' : ' has signed off'}
            </Toast>
          ))}
        </ToastContainer>
      )}

      {/* Info panel for selected buddy */}
      {selected && (
        <InfoPanel>
          <InfoRow>
            <span style={{ fontWeight: 'bold', fontSize: 12 }}>{selected.screenName}</span>
            <StatusDot $status={selected.status} />
          </InfoRow>
          <InfoRow>
            <InfoLabel>Provider</InfoLabel>
            <InfoValue>{selected.provider}</InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Model</InfoLabel>
            <InfoValue>{selected.model}</InfoValue>
          </InfoRow>
          {selected.capabilities && (
            <CapabilityTags>
              {selected.capabilities.map(cap => (
                <CapTag key={cap}>{cap}</CapTag>
              ))}
            </CapabilityTags>
          )}
          <LaunchButton onClick={() => handleLaunch(selected)}>
            ▶ Launch {selected.name}
          </LaunchButton>
        </InfoPanel>
      )}

      {/* Footer toolbar */}
      <Footer>
        <SearchBox
          placeholder="Search buddies..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <FooterButton onClick={() => {
          buddies.filter(b => b.status !== 'offline').forEach(b => handleLaunch(b));
        }}>
          Launch All
        </FooterButton>
      </Footer>
    </BuddyListContainer>
  );
};

export default AgentBuddyList;
