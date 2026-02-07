import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { v4 as uuidv4 } from 'uuid';
import TerminalWindow from './components/TerminalWindow';
import ContentWindow from './components/ContentWindow';
import GlobalMapWindow from './components/GlobalMapWindow';
import type { GlobalMapAgent, GlobalMapMessage } from './components/GlobalMapWindow';
import SystemMonitor from './components/SystemMonitor';
import LifecycleNotification from './components/LifecycleNotification';
import SetupWizard from './components/SetupWizard';
import GaussianBackground from './components/GaussianBackground';
import AgentMetricsDashboard from './components/dashboard/AgentMetricsDashboard';
import AgentBuddyList from './components/AgentBuddyList';
import { macosTheme } from './theme/macos';
import { 
  Dock, 
  DockItem, 
  DockDivider, 
  MenuBar, 
  MenuBarItem, 
  MenuBarRight,
  Menu,
  MenuItem,
  MenuDivider
} from './components/ui/MacOS';
import { 
  Monitor, 
  Terminal as TerminalIcon, 
  Cpu, 
  Globe, 
  Play,
  Wifi, 
  Battery,
  Search,
  Activity,
  Users
} from 'lucide-react';

// UI Command payload type
export interface UiCommandPayload {
  type: 'image' | 'browser';
  src?: string;
  url?: string;
  title?: string;
}

const GlobalStyles = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  body {
    font-family: ${macosTheme.fonts.system};
    background: ${macosTheme.colors.desktopBg};
    margin: 0;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  
  input, select, textarea, button {
    font-family: ${macosTheme.fonts.system};
  }
  
  ::selection {
    background: ${macosTheme.colors.accent};
    color: white;
  }
`;

const Desktop = styled.div`
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  padding-top: 28px; /* Space for menu bar */
  padding-bottom: 80px; /* Space for dock */
`;



const AppleLogo = () => (
  <svg width="14" height="17" viewBox="0 0 14 17" fill="currentColor">
    <path d="M13.1 12.2c-.3.6-.6 1.2-1 1.7-.6.7-1.1 1.2-1.6 1.4-.6.3-1.3.5-2 .5-.5 0-1.1-.1-1.7-.4-.6-.3-1.1-.4-1.6-.4s-1 .1-1.6.4c-.6.3-1.1.4-1.5.4-.7 0-1.4-.2-2-.5-.6-.3-1.1-.8-1.6-1.5-.5-.7-.9-1.5-1.2-2.4C.1 10.5 0 9.5 0 8.5c0-1.1.2-2 .7-2.9.4-.7.9-1.2 1.5-1.6.6-.4 1.3-.6 2-.6.5 0 1.2.2 2 .5.8.3 1.3.5 1.5.5.2 0 .7-.2 1.7-.5.9-.3 1.6-.4 2.2-.3 1.6.1 2.8.8 3.6 1.9-1.4.9-2.1 2.1-2.1 3.6 0 1.2.4 2.2 1.3 3 .4.4.8.7 1.3.9-.1.3-.2.5-.6.2zm-3-11.4c0 .9-.3 1.8-1 2.6-.8.9-1.7 1.5-2.7 1.4 0-.1 0-.2 0-.3 0-.9.4-1.8 1-2.5.3-.4.7-.7 1.2-1 .5-.3 1-.4 1.4-.5 0 .1.1.2.1.3z"/>
  </svg>
);

interface BaseWindow {
  id: string;
  title: string;
  zIndex: number;
  position: { x: number; y: number };
}

interface TerminalState extends BaseWindow {
  type: 'terminal';
  initialCommand?: string;
}

interface ImageState extends BaseWindow {
  type: 'image';
  content: string;
}

interface BrowserState extends BaseWindow {
  type: 'browser';
  content: string;
}

interface GlobalMapState extends BaseWindow {
  type: 'global-map';
}

interface SystemMonitorState extends BaseWindow {
  type: 'system-monitor';
}

interface DashboardState extends BaseWindow {
  type: 'dashboard';
}

interface BuddyListState extends BaseWindow {
  type: 'buddy-list';
}

type WindowState = TerminalState | ImageState | BrowserState | GlobalMapState | SystemMonitorState | DashboardState | BuddyListState;

const isDemoRoute = () => {
  const path = window.location.pathname;
  return path === '/demo' || path === '/demo/';
};

const App: React.FC = () => {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const zIndexRef = useRef(1);
  const [globalAgents, setGlobalAgents] = useState<GlobalMapAgent[]>([]);
  const [globalMessages, setGlobalMessages] = useState<GlobalMapMessage[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [showWelcome, setShowWelcome] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === 'true' || params.get('skipWelcome') === 'true') return false;
    if (isDemoRoute()) return false;
    return !localStorage.getItem('createsuite-setup-complete');
  });

  // Update clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Stable window management (ref-based z-index, no state in closures) ──

  const spawnWindow = useCallback((
    type: 'terminal' | 'image' | 'browser' | 'global-map' | 'system-monitor' | 'dashboard' | 'buddy-list',
    title: string,
    contentOrCommand?: string,
    customPosition?: { x: number, y: number }
  ) => {
    const id = uuidv4();
    const newZ = ++zIndexRef.current;

    setWindows(prev => {
      const position = customPosition ?? {
        x: 80 + ((prev.length * 30) % 300),
        y: 60 + ((prev.length * 30) % 200)
      };

      const base = { id, title, zIndex: newZ, position };

      switch (type) {
        case 'terminal':     return [...prev, { ...base, type: 'terminal' as const, initialCommand: contentOrCommand }];
        case 'image':        return [...prev, { ...base, type: 'image' as const, content: contentOrCommand || '' }];
        case 'browser':      return [...prev, { ...base, type: 'browser' as const, content: contentOrCommand || '' }];
        case 'system-monitor': return [...prev, { ...base, type: 'system-monitor' as const }];
        case 'dashboard':    return [...prev, { ...base, type: 'dashboard' as const }];
        case 'buddy-list':   return [...prev, { ...base, type: 'buddy-list' as const }];
        default:             return [...prev, { ...base, type: 'global-map' as const }];
      }
    });

    setActiveMenu(null);
  }, []);

  const spawnTerminal = useCallback((title: string = 'Terminal', command?: string, customPosition?: { x: number, y: number }) => {
    spawnWindow('terminal', title, command, customPosition);
  }, [spawnWindow]);

  const spawnGlobalMap = useCallback(() => {
    spawnWindow('global-map', 'Agent Village');
  }, [spawnWindow]);

  const closeWindow = useCallback((id: string) => {
    setWindows(prev => prev.filter(t => t.id !== id));
  }, []);

  const focusWindow = useCallback((id: string) => {
    const newZ = ++zIndexRef.current;
    setWindows(prev => prev.map(t => t.id === id ? { ...t, zIndex: newZ } : t));
  }, []);

  const handleUiCommand = useCallback((payload: UiCommandPayload) => {
    if (!payload.type) return;
    if (payload.type === 'image') {
      const src = payload.src?.startsWith('http') ? payload.src : `/workspace/${payload.src}`;
      spawnWindow('image', payload.title || 'Preview', src || '');
    } else if (payload.type === 'browser') {
      spawnWindow('browser', payload.title || 'Browser', payload.url);
    }
  }, [spawnWindow]);

  const runConvoyTest = useCallback(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    spawnTerminal('Z.ai Agent (GLM 4.7)', 'export OPENCODE_PROVIDER=zai-coding-plan OPENCODE_MODEL=glm-4.7; echo "Starting Z.ai GLM 4.7 Agent..."; opencode', { x: 20, y: 60 });
    setTimeout(() => spawnTerminal('Asset Generator (HF)', 'export OPENCODE_PROVIDER=huggingface OPENCODE_MODEL=stable-diffusion-3.5-large; echo "Starting Asset Generator..."; opencode', { x: w - 620, y: 60 }), 200);
    setTimeout(() => spawnTerminal('Sisyphus (Claude)', 'export OPENCODE_PROVIDER=anthropic OPENCODE_MODEL=claude-opus-4.5; echo "Starting Sisyphus..."; opencode', { x: 20, y: h - 520 }), 400);
    setTimeout(() => spawnTerminal('Oracle (OpenAI)', 'export OPENCODE_PROVIDER=openai OPENCODE_MODEL=gpt-5.2; echo "Starting Oracle..."; opencode', { x: w - 620, y: h - 520 }), 600);
    setTimeout(() => spawnTerminal('Architect (Kimi-K2.5)', 'export OPENCODE_PROVIDER=openai OPENCODE_MODEL=kimi-k2.5; echo "Starting Architect..."; opencode', { x: w / 2 - 310, y: h / 2 - 200 }), 800);
  }, [spawnTerminal]);

  const handleWelcomeComplete = useCallback((config?: { providers: string[]; launchAgents: string[] }) => {
    setShowWelcome(false);
    const loading = document.getElementById('loading');
    if (loading) loading.classList.add('hidden');
    
    if (config && config.launchAgents && config.launchAgents.length > 0) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      let delay = 0;
      
      config.launchAgents.forEach((agentId, index) => {
        setTimeout(() => {
          const col = index % 2;
          const row = Math.floor(index / 2);
          const position = {
            x: col === 0 ? 20 : w - 620,
            y: row === 0 ? 60 : h - 520
          };
          
          switch (agentId) {
            case 'terminal':
              spawnTerminal('Terminal', undefined, position);
              break;
            case 'claude':
              spawnTerminal('Sisyphus (Claude)', 
                'export OPENCODE_PROVIDER=anthropic OPENCODE_MODEL=claude-opus-4.5; echo "Starting Sisyphus..."; opencode',
                position);
              break;
            case 'openai':
              spawnTerminal('Oracle (OpenAI)',
                'export OPENCODE_PROVIDER=openai OPENCODE_MODEL=gpt-5.2; echo "Starting Oracle..."; opencode',
                position);
              break;
            case 'gemini':
              spawnTerminal('Engineer (Gemini)',
                'export OPENCODE_PROVIDER=google OPENCODE_MODEL=gemini-3-pro; echo "Starting Engineer..."; opencode',
                position);
              break;
          }
        }, delay);
        delay += 200;
      });
    }
  }, [spawnTerminal]);
  
  const handleSetupSkip = useCallback(() => {
    setShowWelcome(false);
    const loading = document.getElementById('loading');
    if (loading) loading.classList.add('hidden');
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        spawnTerminal();
      }
      if (e.key === 'Escape') {
        setActiveMenu(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [spawnTerminal]);

  // Demo mode — spawnTerminal is stable so this only runs once
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === 'true' || isDemoRoute()) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      
      spawnTerminal('Z.ai Agent', 
        'echo "╔══════════════════════════════════════════════════╗"; echo "║  Z.ai Agent - GLM 4.7 Coding Specialist         ║"; echo "╚══════════════════════════════════════════════════╝"; echo ""; echo "✓ Connected to oh-my-opencode provider"; echo "✓ Model: glm-4.7 (coding-optimized)"; echo "✓ Status: Processing task queue"',
        { x: 20, y: 60 });
      
      setTimeout(() => spawnTerminal('Asset Generator',
        'echo "╔══════════════════════════════════════════════════╗"; echo "║  Hugging Face Asset Generator                   ║"; echo "╚══════════════════════════════════════════════════╝"; echo ""; echo "✓ Provider: huggingface-inference"; echo "✓ Model: stable-diffusion-3.5-large"; echo "✓ Status: Generating assets"',
        { x: w - 620, y: 60 }), 200);
      
      setTimeout(() => spawnTerminal('Sisyphus (Claude)',
        'echo "╔══════════════════════════════════════════════════╗"; echo "║  Sisyphus - Task Automation Agent              ║"; echo "╚══════════════════════════════════════════════════╝"; echo ""; echo "✓ Provider: anthropic"; echo "✓ Model: claude-opus-4.5"; echo "✓ Status: Executing plan"',
        { x: 20, y: h - 520 }), 400);
      
      setTimeout(() => spawnTerminal('Oracle (OpenAI)',
        'echo "╔══════════════════════════════════════════════════╗"; echo "║  Oracle - System Architecture Advisor           ║"; echo "╚══════════════════════════════════════════════════╝"; echo ""; echo "✓ Provider: openai"; echo "✓ Model: gpt-5.2"; echo "✓ Status: Analyzing codebase"',
        { x: w - 620, y: h - 520 }), 600);
      
      setTimeout(() => spawnTerminal('Architect',
        'echo "╔══════════════════════════════════════════════════╗"; echo "║  Architect - Deep System Design Specialist     ║"; echo "╚══════════════════════════════════════════════════╝"; echo ""; echo "✓ Provider: openai"; echo "✓ Model: kimi-k2.5"; echo "✓ Status: Designing Phase 2"',
        { x: w / 2 - 310, y: h / 2 - 200 }), 800);
    }
  }, [spawnTerminal]);

  // Fetch agent data
  useEffect(() => {
    let isMounted = true;

    const mapStatus = (status: string): GlobalMapAgent['status'] => {
      switch (status) {
        case 'working': return 'working';
        case 'error': return 'error';
        case 'offline': return 'offline';
        default: return 'idle';
      }
    };

    const fetchGlobalData = async () => {
      try {
        const [agentsRes, mailboxRes] = await Promise.all([
          fetch('/api/agents'),
          fetch('/api/mailbox')
        ]);

        if (!agentsRes.ok || !mailboxRes.ok) return;

        const agentsPayload = await agentsRes.json();
        const mailboxPayload = await mailboxRes.json();

        if (!isMounted) return;

        const agents = (agentsPayload.data || []).map((agent: { id: string; name: string; status: string; capabilities?: string[] }, index: number) => ({
          id: agent.id,
          name: agent.name,
          status: mapStatus(agent.status),
          skills: agent.capabilities || [],
          position: {
            x: 160 + (index % 3) * 200,
            y: 140 + Math.floor(index / 3) * 160
          }
        }));

        const messages = (mailboxPayload.data || []).map((message: { id: string; from: string; to: string; kind?: string; subject: string; body: string; timestamp: string; read: boolean }) => ({
          id: message.id,
          from: message.from,
          to: message.to,
          kind: message.kind || 'system',
          subject: message.subject,
          body: message.body,
          timestamp: message.timestamp,
          snippet: message.subject || message.body?.slice(0, 48) || '',
          status: message.read ? 'sent' : 'queued',
          createdAt: message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : ''
        }));

        setGlobalAgents(agents);
        setGlobalMessages(messages);
      } catch {
        // Silent fail
      }
    };

    fetchGlobalData();
    const interval = window.setInterval(fetchGlobalData, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <>
      <GlobalStyles />
      <GaussianBackground />
      
      {/* macOS Menu Bar */}
      <MenuBar>
        <MenuBarItem $bold onClick={() => setActiveMenu(activeMenu === 'apple' ? null : 'apple')}>
          <AppleLogo />
        </MenuBarItem>
        <MenuBarItem $bold>CreateSuite</MenuBarItem>
        <MenuBarItem onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}>
          File
        </MenuBarItem>
        <MenuBarItem onClick={() => setActiveMenu(activeMenu === 'agents' ? null : 'agents')}>
          Agents
        </MenuBarItem>
        <MenuBarItem onClick={() => setActiveMenu(activeMenu === 'view' ? null : 'view')}>
          View
        </MenuBarItem>
        <MenuBarItem onClick={() => setActiveMenu(activeMenu === 'window' ? null : 'window')}>
          Window
        </MenuBarItem>
        <MenuBarItem>Help</MenuBarItem>
        
        <MenuBarRight>
          <Wifi size={16} />
          <Battery size={16} />
          <Search size={16} />
          <span>{formatDate(currentTime)}</span>
          <span style={{ fontWeight: 500 }}>{formatTime(currentTime)}</span>
        </MenuBarRight>
      </MenuBar>

      {/* Dropdown Menus */}
      {activeMenu === 'file' && (
        <Menu style={{ position: 'fixed', top: 28, left: 140, zIndex: 100000 }}>
          <MenuItem onClick={() => { spawnTerminal(); setActiveMenu(null); }}>
            <TerminalIcon size={16} /> New Terminal
          </MenuItem>
          <MenuDivider />
          <MenuItem onClick={() => { spawnWindow('system-monitor', 'Activity Monitor'); setActiveMenu(null); }}>
            <Monitor size={16} /> Activity Monitor
          </MenuItem>
          <MenuItem onClick={() => { spawnWindow('dashboard', 'Agent Metrics'); setActiveMenu(null); }}>
            <Activity size={16} /> Metrics Dashboard
          </MenuItem>
        </Menu>
      )}

      {activeMenu === 'agents' && (
        <Menu style={{ position: 'fixed', top: 28, left: 180, zIndex: 100000 }}>
          <MenuItem onClick={() => { spawnWindow('buddy-list', 'Buddy List'); setActiveMenu(null); }}>
            <Users size={16} /> Buddy List
          </MenuItem>
          <MenuDivider />
          <MenuItem onClick={() => { spawnTerminal('Sisyphus (Claude)', 'export OPENCODE_PROVIDER=anthropic OPENCODE_MODEL=claude-opus-4.5; opencode'); setActiveMenu(null); }}>
            <Cpu size={16} /> Sisyphus (Claude)
          </MenuItem>
          <MenuItem onClick={() => { spawnTerminal('Oracle (OpenAI)', 'export OPENCODE_PROVIDER=openai OPENCODE_MODEL=gpt-5.2; opencode'); setActiveMenu(null); }}>
            <Cpu size={16} /> Oracle (OpenAI)
          </MenuItem>
          <MenuItem onClick={() => { spawnTerminal('Engineer (Gemini)', 'export OPENCODE_PROVIDER=google OPENCODE_MODEL=gemini-3-pro; opencode'); setActiveMenu(null); }}>
            <Cpu size={16} /> Engineer (Gemini)
          </MenuItem>
          <MenuItem onClick={() => { spawnTerminal('Architect (Kimi)', 'export OPENCODE_PROVIDER=openai OPENCODE_MODEL=kimi-k2.5; opencode'); setActiveMenu(null); }}>
            <Cpu size={16} /> Architect (Kimi)
          </MenuItem>
          <MenuDivider />
          <MenuItem onClick={() => { spawnGlobalMap(); setActiveMenu(null); }}>
            <Globe size={16} /> Agent Village
          </MenuItem>
          <MenuDivider />
          <MenuItem onClick={() => { runConvoyTest(); setActiveMenu(null); }}>
            <Play size={16} /> Launch All Agents
          </MenuItem>
        </Menu>
      )}

      {activeMenu === 'view' && (
        <Menu style={{ position: 'fixed', top: 28, left: 240, zIndex: 100000 }}>
          <MenuItem onClick={() => { spawnGlobalMap(); setActiveMenu(null); }}>
            <Globe size={16} /> Agent Village
          </MenuItem>
          <MenuItem onClick={() => { spawnWindow('system-monitor', 'Activity Monitor'); setActiveMenu(null); }}>
            <Monitor size={16} /> Activity Monitor
          </MenuItem>
        </Menu>
      )}

      {activeMenu === 'window' && (
        <Menu style={{ position: 'fixed', top: 28, left: 295, zIndex: 100000 }}>
          <MenuItem disabled={windows.length === 0}>Minimize</MenuItem>
          <MenuItem disabled={windows.length === 0}>Zoom</MenuItem>
          <MenuDivider />
          {windows.map(win => (
            <MenuItem key={win.id} onClick={() => { focusWindow(win.id); setActiveMenu(null); }}>
              {win.title}
            </MenuItem>
          ))}
          {windows.length === 0 && <MenuItem disabled>No windows open</MenuItem>}
        </Menu>
      )}

      {/* Click to close menus */}
      {activeMenu && (
        <div 
          style={{ position: 'fixed', inset: 0, zIndex: 99998 }} 
          onClick={() => setActiveMenu(null)}
        />
      )}

      <Desktop>
        {/* Setup Wizard */}
        {showWelcome && (
          <SetupWizard 
            onComplete={handleWelcomeComplete}
            onSkip={handleSetupSkip}
          />
        )}
        
        {/* Lifecycle Notification */}
        <LifecycleNotification />
        
        {/* Windows */}
        {windows.map(win => {
          if (win.type === 'terminal') {
            return (
              <TerminalWindow
                key={win.id}
                id={win.id}
                title={win.title}
                initialPosition={win.position}
                zIndex={win.zIndex}
                onClose={() => closeWindow(win.id)}
                onFocus={() => focusWindow(win.id)}
                onUiCommand={handleUiCommand}
                initialCommand={win.initialCommand}
              />
            );
          }
          if (win.type === 'image') {
            return (
              <ContentWindow
                key={win.id}
                id={win.id}
                title={win.title}
                type="image"
                content={win.content}
                initialPosition={win.position}
                zIndex={win.zIndex}
                onClose={() => closeWindow(win.id)}
                onFocus={() => focusWindow(win.id)}
              />
            );
          }
          if (win.type === 'browser') {
            return (
              <ContentWindow
                key={win.id}
                id={win.id}
                title={win.title}
                type="browser"
                content={win.content}
                initialPosition={win.position}
                zIndex={win.zIndex}
                onClose={() => closeWindow(win.id)}
                onFocus={() => focusWindow(win.id)}
              />
            );
          }
          if (win.type === 'global-map') {
            return (
              <GlobalMapWindow
                key={win.id}
                id={win.id}
                title={win.title}
                initialPosition={win.position}
                zIndex={win.zIndex}
                onClose={() => closeWindow(win.id)}
                onFocus={() => focusWindow(win.id)}
                agents={globalAgents}
                messages={globalMessages}
              />
            );
          }
          if (win.type === 'system-monitor') {
            return (
              <SystemMonitor
                key={win.id}
                id={win.id}
                title={win.title}
                initialPosition={win.position}
                zIndex={win.zIndex}
                onClose={() => closeWindow(win.id)}
                onFocus={() => focusWindow(win.id)}
              />
            );
          }
          if (win.type === 'dashboard') {
            return (
              <ContentWindow
                key={win.id}
                id={win.id}
                title={win.title}
                type="custom"
                initialPosition={win.position}
                zIndex={win.zIndex}
                onClose={() => closeWindow(win.id)}
                onFocus={() => focusWindow(win.id)}
                width={900}
                height={600}
              >
                <AgentMetricsDashboard />
              </ContentWindow>
            );
          }
          if (win.type === 'buddy-list') {
            return (
              <ContentWindow
                key={win.id}
                id={win.id}
                title={win.title}
                type="custom"
                initialPosition={win.position}
                zIndex={win.zIndex}
                onClose={() => closeWindow(win.id)}
                onFocus={() => focusWindow(win.id)}
                width={280}
                height={500}
              >
                <AgentBuddyList onLaunchAgent={spawnTerminal} />
              </ContentWindow>
            );
          }
          return null;
        })}
      </Desktop>

      {/* macOS Dock */}
      <Dock>
        <DockItem 
          title="Finder"
          onClick={() => {}}
        >
          <svg viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="7" fill="url(#finder)"/>
            <path d="M10 24c-2 0-3-1-3-3V11c0-2 1-3 3-3h12c2 0 3 1 3 3v10c0 2-1 3-3 3H10z" fill="#39C"/>
            <path d="M10 8h12c2 0 3 1 3 3v2H7v-2c0-2 1-3 3-3z" fill="#6CF"/>
            <circle cx="11" cy="18" r="2" fill="#FFF"/>
            <circle cx="21" cy="18" r="2" fill="#FFF"/>
            <defs>
              <linearGradient id="finder" x1="0" y1="0" x2="32" y2="32">
                <stop stopColor="#70D6FF"/>
                <stop offset="1" stopColor="#0096FF"/>
              </linearGradient>
            </defs>
          </svg>
        </DockItem>
        
        <DockItem 
          $active={windows.some(w => w.type === 'terminal')}
          title="Terminal"
          onClick={() => spawnTerminal()}
        >
          <svg viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7" fill="#1E1E1E"/>
            <path d="M8 10l5 5-5 5" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 20h10" stroke="#FFF" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </DockItem>
        
        <DockItem 
          title="Sisyphus"
          onClick={() => spawnTerminal('Sisyphus (Claude)', 'export OPENCODE_PROVIDER=anthropic OPENCODE_MODEL=claude-opus-4.5; opencode')}
        >
          <svg viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7" fill="#7c3aed"/>
            <text x="16" y="22" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">S</text>
          </svg>
        </DockItem>
        
        <DockItem 
          title="Oracle"
          onClick={() => spawnTerminal('Oracle (OpenAI)', 'export OPENCODE_PROVIDER=openai OPENCODE_MODEL=gpt-5.2; opencode')}
        >
          <svg viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7" fill="#10a37f"/>
            <text x="16" y="22" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">O</text>
          </svg>
        </DockItem>
        
        <DockItem 
          title="Engineer"
          onClick={() => spawnTerminal('Engineer (Gemini)', 'export OPENCODE_PROVIDER=google OPENCODE_MODEL=gemini-3-pro; opencode')}
        >
          <svg viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7" fill="#4285f4"/>
            <text x="16" y="22" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">E</text>
          </svg>
        </DockItem>
        
        <DockDivider />
        
        <DockItem 
          $active={windows.some(w => w.type === 'global-map')}
          title="Agent Village"
          onClick={spawnGlobalMap}
        >
          <svg viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7" fill="url(#globe)"/>
            <circle cx="16" cy="16" r="10" stroke="white" strokeWidth="1.5" fill="none"/>
            <ellipse cx="16" cy="16" rx="4" ry="10" stroke="white" strokeWidth="1.5" fill="none"/>
            <path d="M6 16h20M16 6v20" stroke="white" strokeWidth="1.5"/>
            <defs>
              <linearGradient id="globe" x1="0" y1="0" x2="32" y2="32">
                <stop stopColor="#FF6B6B"/>
                <stop offset="1" stopColor="#4ECDC4"/>
              </linearGradient>
            </defs>
          </svg>
        </DockItem>
        
        <DockItem 
          $active={windows.some(w => w.type === 'system-monitor')}
          title="Activity Monitor"
          onClick={() => spawnWindow('system-monitor', 'Activity Monitor')}
        >
          <svg viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7" fill="#333"/>
            <path d="M6 20l5-8 4 5 6-10 5 13" stroke="#00FF00" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </DockItem>
        
        <DockItem 
          $active={windows.some(w => w.type === 'buddy-list')}
          title="Buddy List"
          onClick={() => spawnWindow('buddy-list', 'Buddy List')}
        >
          <svg viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7" fill="url(#aim)"/>
            <text x="16" y="13" textAnchor="middle" fill="#333" fontSize="7" fontWeight="bold">AIM</text>
            <text x="16" y="25" textAnchor="middle" fontSize="14">🏃</text>
            <defs>
              <linearGradient id="aim" x1="0" y1="0" x2="32" y2="32">
                <stop stopColor="#FFE082"/>
                <stop offset="1" stopColor="#F9A825"/>
              </linearGradient>
            </defs>
          </svg>
        </DockItem>
        
        <DockDivider />
        
        <DockItem 
          title="Settings"
          onClick={() => { localStorage.removeItem('createsuite-setup-complete'); setShowWelcome(true); }}
        >
          <svg viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7" fill="#636366"/>
            <circle cx="16" cy="16" r="6" stroke="white" strokeWidth="2" fill="none"/>
            <path d="M16 6v4M16 22v4M6 16h4M22 16h4M9 9l3 3M20 20l3 3M9 23l3-3M20 12l3-3" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </DockItem>
      </Dock>
    </>
  );
};

export default App;
