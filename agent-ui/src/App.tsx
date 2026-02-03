import React, { useState, useEffect, useCallback } from 'react';
import styled, { createGlobalStyle, ThemeProvider } from 'styled-components';
import { styleReset, AppBar, Toolbar, Button, MenuList, MenuListItem, Separator } from 'react95';
import original from 'react95/dist/themes/original';
import ms_sans_serif from 'react95/dist/fonts/ms_sans_serif.woff2';
import ms_sans_serif_bold from 'react95/dist/fonts/ms_sans_serif_bold.woff2';
import { v4 as uuidv4 } from 'uuid';
import TerminalWindow from './components/TerminalWindow';
import ContentWindow from './components/ContentWindow';
import GlobalMapWindow from './components/GlobalMapWindow';
import type { GlobalMapAgent, GlobalMapMessage } from './components/GlobalMapWindow';
import SystemMonitor from './components/SystemMonitor';
import LifecycleNotification from './components/LifecycleNotification';
import SetupWizard from './components/SetupWizard';
import DesktopIcons from './components/DesktopIcons';
import { Monitor, Terminal as TerminalIcon, Cpu } from 'lucide-react';

// UI Command payload type
export interface UiCommandPayload {
  type: 'image' | 'browser';
  src?: string;
  url?: string;
  title?: string;
}

const GlobalStyles = createGlobalStyle`
  ${styleReset}
  @font-face {
    font-family: 'ms_sans_serif';
    src: url('${ms_sans_serif}') format('woff2');
    font-weight: 400;
    font-style: normal;
  }
  @font-face {
    font-family: 'ms_sans_serif';
    src: url('${ms_sans_serif_bold}') format('woff2');
    font-weight: bold;
    font-style: normal;
  }
  body, input, select, textarea {
    font-family: 'ms_sans_serif';
  }
  body {
    background-color: #008080; /* Classic Windows Teal */
    margin: 0;
    overflow: hidden;
  }
`;

const Desktop = styled.div`
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
`;

const TaskbarContainer = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 10000;
`;

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
  content: string; // URL
}

interface BrowserState extends BaseWindow {
  type: 'browser';
  content: string; // URL
}

interface GlobalMapState extends BaseWindow {
  type: 'global-map';
}

interface SystemMonitorState extends BaseWindow {
  type: 'system-monitor';
}

type WindowState = TerminalState | ImageState | BrowserState | GlobalMapState | SystemMonitorState;

// Check if we're on a demo route
const isDemoRoute = () => {
  const path = window.location.pathname;
  return path === '/demo' || path === '/demo/';
};

const App: React.FC = () => {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [agentsMenuOpen, setAgentsMenuOpen] = useState(false);
  const [topZIndex, setTopZIndex] = useState(1);
  const [globalAgents, setGlobalAgents] = useState<GlobalMapAgent[]>([]);
  
  // Welcome wizard state
  const [showWelcome, setShowWelcome] = useState(() => {
    // Check URL params, path, and localStorage
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === 'true' || params.get('skipWelcome') === 'true') return false;
    if (isDemoRoute()) return false;
    return !localStorage.getItem('createsuite-setup-complete');
  });
  const [globalMessages, setGlobalMessages] = useState<GlobalMapMessage[]>([]);

  const spawnWindow = (
    type: 'terminal' | 'image' | 'browser' | 'global-map' | 'system-monitor',
    title: string,
    contentOrCommand?: string,
    customPosition?: { x: number, y: number }
  ) => {
    const id = uuidv4();

    setWindows(prev => {
      const maxZ = prev.reduce((max, t) => Math.max(max, t.zIndex), topZIndex);
      const newZ = maxZ + 1;
      setTopZIndex(newZ);

      let position;
      if (customPosition) {
        position = customPosition;
      } else {
        const offset = prev.length * 20;
        position = {
          x: 50 + (offset % 300),
          y: 50 + (offset % 300)
        };
      }

      const base = {
        id,
        title: `${title}`,
        zIndex: newZ,
        position
      };

      if (type === 'terminal') {
        return [...prev, { ...base, type: 'terminal', initialCommand: contentOrCommand }];
      } else if (type === 'image') {
        return [...prev, { ...base, type: 'image', content: contentOrCommand || '' }];
      } else if (type === 'browser') {
        return [...prev, { ...base, type: 'browser', content: contentOrCommand || '' }];
      } else if (type === 'system-monitor') {
        return [...prev, { ...base, type: 'system-monitor' }];
      }
      return [...prev, { ...base, type: 'global-map' }];
    });

    setStartMenuOpen(false);
    setAgentsMenuOpen(false);
  };

  const spawnTerminal = (title: string = 'OpenCode Terminal', command?: string, customPosition?: { x: number, y: number }) => {
    spawnWindow('terminal', title, command, customPosition);
  };

  const spawnGlobalMap = () => {
    spawnWindow('global-map', 'Agent Village');
  };

  const closeWindow = (id: string) => {
    setWindows(prev => prev.filter(t => t.id !== id));
  };

  const focusWindow = (id: string) => {
    const newZ = topZIndex + 1;
    setTopZIndex(newZ);
    setWindows(prev => prev.map(t => t.id === id ? { ...t, zIndex: newZ } : t));
  };

  const handleUiCommand = (payload: UiCommandPayload) => {
    console.log('Received UI Command:', payload);
    if (!payload.type) return;

    if (payload.type === 'image') {
      // Assuming payload.src is relative to workspace root
      // We prepend /workspace/ to make it accessible via our static route
      const src = payload.src?.startsWith('http') ? payload.src : `/workspace/${payload.src}`;
      spawnWindow('image', payload.title || 'Image Preview', src || '');
    } else if (payload.type === 'browser') {
      spawnWindow('browser', payload.title || 'Web Preview', payload.url);
    }
  };

  // Convoy test function
  const runConvoyTest = useCallback(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    // Top Left
    spawnTerminal('Z.ai Agent (GLM 4.7)', 'export OPENCODE_PROVIDER=zai-coding-plan OPENCODE_MODEL=glm-4.7; echo "Starting Z.ai GLM 4.7 Agent..."; opencode', { x: 20, y: 20 });
    
    // Top Right
    setTimeout(() => spawnTerminal('Asset Generator (HF)', 'export OPENCODE_PROVIDER=huggingface OPENCODE_MODEL=stable-diffusion-3.5-large; echo "Starting Asset Generator (Hugging Face)..."; opencode', { x: w - 620, y: 20 }), 200);
    
    // Bottom Left
    setTimeout(() => spawnTerminal('Sisyphus (Claude)', 'export OPENCODE_PROVIDER=anthropic OPENCODE_MODEL=claude-opus-4.5; echo "Starting Sisyphus (Claude)..."; opencode', { x: 20, y: h - 480 }), 400);
    
    // Bottom Right
    setTimeout(() => spawnTerminal('Oracle (OpenAI)', 'export OPENCODE_PROVIDER=openai OPENCODE_MODEL=gpt-5.2; echo "Starting Oracle (OpenAI)..."; opencode', { x: w - 620, y: h - 480 }), 600);
    
    setTimeout(() => spawnTerminal('Architect (Kimi-K2.5)', 'export OPENCODE_PROVIDER=openai OPENCODE_MODEL=kimi-k2.5; echo "Starting Architect (Kimi-K2.5) - Deep System Design Specialist..."; opencode', { x: w / 2 - 310, y: h / 2 - 240 }), 800);
  }, []);

  // Handle welcome wizard completion
  const handleWelcomeComplete = useCallback((config?: { providers: string[]; launchAgents: string[] }) => {
    setShowWelcome(false);
    
    // Hide the loading screen
    const loading = document.getElementById('loading');
    if (loading) loading.classList.add('hidden');
    
    // If user selected agents to launch, spawn them based on working providers
    if (config && config.launchAgents && config.launchAgents.length > 0) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      let delay = 0;
      
      config.launchAgents.forEach((agentId, index) => {
        setTimeout(() => {
          // Position agents in a grid
          const col = index % 2;
          const row = Math.floor(index / 2);
          const position = {
            x: col === 0 ? 20 : w - 620,
            y: row === 0 ? 20 : h - 480
          };
          
          switch (agentId) {
            case 'terminal':
              spawnTerminal('Terminal', undefined, position);
              break;
            case 'claude':
              spawnTerminal('Sisyphus (Claude)', 
                'export OPENCODE_PROVIDER=anthropic OPENCODE_MODEL=claude-opus-4.5; echo "Starting Sisyphus Agent..."; opencode',
                position);
              break;
            case 'openai':
              spawnTerminal('Oracle (OpenAI)',
                'export OPENCODE_PROVIDER=openai OPENCODE_MODEL=gpt-5.2; echo "Starting Oracle Agent..."; opencode',
                position);
              break;
            case 'gemini':
              spawnTerminal('Engineer (Gemini)',
                'export OPENCODE_PROVIDER=google OPENCODE_MODEL=gemini-3-pro; echo "Starting Engineer Agent..."; opencode',
                position);
              break;
          }
        }, delay);
        delay += 200;
      });
    }
  }, []);
  
  // Handle skip (just close wizard, show empty desktop)
  const handleSetupSkip = useCallback(() => {
    setShowWelcome(false);
    const loading = document.getElementById('loading');
    if (loading) loading.classList.add('hidden');
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N = New Terminal
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        spawnTerminal();
      }
      // Ctrl+Shift+N = Agent Village
      if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        spawnGlobalMap();
      }
      // Escape = Close start menu
      if (e.key === 'Escape') {
        setStartMenuOpen(false);
        setAgentsMenuOpen(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-start demo mode from /demo route or ?demo=true
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === 'true' || isDemoRoute()) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      
      // Top Left - Z.ai Coding Agent
      spawnTerminal('Z.ai Agent (GLM 4.7)', 
        'echo "╔══════════════════════════════════════════════════╗";' +
        'echo "║  Z.ai Agent - GLM 4.7 Coding Specialist         ║";' +
        'echo "╚══════════════════════════════════════════════════╝";' +
        'echo "";' +
        'echo "✓ Connected to oh-my-opencode provider";' +
        'echo "✓ Model: glm-4.7 (coding-optimized)";' +
        'echo "✓ Status: Processing task queue";' +
        'echo "";' +
        'echo "Current Tasks:";' +
        'echo "  → cs-r6w71: Fix demo mode terminals";' +
        'echo "  → cs-abc12: Add dark mode support";' +
        'echo "  → cs-def34: Optimize agent routing";' +
        'echo "";' +
        'echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";' +
        'echo "Working on: cs-r6w71 [████████████████░░░] 75%"' +
        'echo "  → Analyzing terminal connection issues...";' +
        'echo "  → Found: Socket.io server not responding";' +
        'echo "  → Fix: Updating connection retry logic";' +
        'echo ""',
        { x: 20, y: 20 });
      
      // Top Right - Asset Generator  
      setTimeout(() => spawnTerminal('Asset Generator (HF)',
        'echo "╔══════════════════════════════════════════════════╗";' +
        'echo "║  Hugging Face Asset Generator                   ║";' +
        'echo "╚══════════════════════════════════════════════════╝";' +
        'echo "";' +
        'echo "✓ Provider: huggingface-inference";' +
        'echo "✓ Model: stable-diffusion-3.5-large";' +
        'echo "✓ Status: Generating assets";' +
        'echo "";' +
        'echo "Recent Generations:";' +
        'echo "  → agent-sprite-001.png [DONE]";' +
        'echo "  → hero-background.jpg [DONE]";' +
        'echo "  → icon-pack-v2.zip [PROCESSING]";' +
        'echo "";' +
        'echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";' +
        'echo "Generating: icon-pack-v2.zip";' +
        'echo "  → Icons: [███████████████░░] 85%";' +
        'echo "  → Sprites: [████████████░░░░] 70%";' +
        'echo "  → Export: [███████████░░░░░░] 60%";',
        { x: w - 620, y: 20 }), 200);
      
      // Bottom Left - Sisyphus (Task Automation)
      setTimeout(() => spawnTerminal('Sisyphus (Claude)',
        'echo "╔══════════════════════════════════════════════════╗";' +
        'echo "║  Sisyphus - Task Automation Agent              ║";' +
        'echo "╚══════════════════════════════════════════════════╝";' +
        'echo "";' +
        'echo "✓ Provider: anthropic";' +
        'echo "✓ Model: claude-opus-4.5";' +
        'echo "✓ Status: Executing plan";' +
        'echo "";' +
        'echo "Active Convoys:";' +
        'echo "  → agent-team-ux: 7/7 tasks complete";' +
        'echo "  → dark-mode-rollout: 3/8 tasks";' +
        'echo "  → api-refactor: 1/12 tasks";' +
        'echo "";' +
        'echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";' +
        'echo "Executing: agent-team-ux";' +
        'echo "  ✓ Task 1: Demo script written";' +
        'echo "  ✓ Task 2: Storage schema designed";' +
        'echo "  ✓ Task 3: Entry point CLI built";' +
        'echo "  ✓ Task 4: PlanManager bridge completed";' +
        'echo "  ✓ Task 5: Desktop single-process fixed";' +
        'echo "  ✓ Task 6: Smart Router implemented";' +
        'echo "  ✓ Task 7: Integration tests passing";' +
        'echo "";' +
        'echo "🎉 ALL 18 ACCEPTANCE CRITERIA COMPLETE! 🎉";',
        { x: 20, y: h - 480 }), 400);
      
      // Bottom Right - Oracle (Architecture)
      setTimeout(() => spawnTerminal('Oracle (OpenAI)',
        'echo "╔══════════════════════════════════════════════════╗";' +
        'echo "║  Oracle - System Architecture Advisor           ║";' +
        'echo "╚══════════════════════════════════════════════════╝";' +
        'echo "";' +
        'echo "✓ Provider: openai";' +
        'echo "✓ Model: gpt-5.2";' +
        'echo "✓ Status: Analyzing codebase";' +
        'echo "";' +
        'echo "Architecture Insights:";' +
        'echo "  → Storage: Unified .createsuite/ schema";' +
        'echo "  → Routing: 4-tier complexity model";' +
        'echo "  → Agents: 5 specialized personas";' +
        'echo "  → Integration: 6 test scenarios passing";' +
        'echo "";' +
        'echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";' +
        'echo "Recommendations:";' +
        'echo "  1. Add WebSocket for real-time updates";' +
        'echo "  2. Implement agent handoff protocol";' +
        'echo "  3. Add Prometheus metrics dashboard";' +
        'echo "  4. Consider caching layer for tasks";' +
        'echo "";' +
        'echo "Code Health: 🟢 EXCELLENT";' +
        'echo "  → 0 TypeScript errors";' +
        'echo "  → 6/6 integration tests passing";' +
        'echo "  → All acceptance criteria met";',
        { x: w - 620, y: h - 480 }), 600);
      
      // Center - Architect (Deep Design)
      setTimeout(() => spawnTerminal('Architect (Kimi-K2.5)',
        'echo "╔══════════════════════════════════════════════════╗";' +
        'echo "║  Architect - Deep System Design Specialist     ║";' +
        'echo "╚══════════════════════════════════════════════════╝";' +
        'echo "";' +
        'echo "✓ Provider: openai";' +
        'echo "✓ Model: kimi-k2.5";' +
        'echo "✓ Status: Designing Phase 2 features";' +
        'echo "";' +
        'echo "Phase 2 Roadmap:";' +
        'echo "  → Multi-agent orchestration";' +
        'echo "  → Real-time collaboration";' +
        'echo "  → Custom agent frames";' +
        'echo "  → Enterprise deployment";' +
        'echo "";' +
        'echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";' +
        'echo "System Design Document:";' +
        'echo "  ✓ Architecture: Layered microservice";' +
        'echo "  ✓ Data Model: Unified storage schema";' +
        'echo "  ✓ API Design: REST + WebSocket";' +
        'echo "  ✓ Security: OAuth + provider auth";' +
        'echo "  ✓ Scale: Horizontal agent scaling";' +
        'echo "";' +
        'echo "📐 Design Score: 94/100 ⭐";',
        { x: w / 2 - 310, y: h / 2 - 240 }), 800);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const mapStatus = (status: string): GlobalMapAgent['status'] => {
      switch (status) {
        case 'working':
          return 'working';
        case 'error':
          return 'error';
        case 'offline':
          return 'offline';
        default:
          return 'idle';
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

        const agents = (agentsPayload.data || []).map((agent: any, index: number) => ({
          id: agent.id,
          name: agent.name,
          status: mapStatus(agent.status),
          skills: agent.capabilities || [],
          position: {
            x: 160 + (index % 3) * 200,
            y: 140 + Math.floor(index / 3) * 160
          }
        }));

        const messages = (mailboxPayload.data || []).map((message: any) => ({
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
      } catch (error) {
        // fail silent; fallback UI handles missing data
      }
    };

    fetchGlobalData();
    const interval = window.setInterval(fetchGlobalData, 4000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <ThemeProvider theme={original}>
      <GlobalStyles />
      <Desktop>
        {/* Setup Wizard for first-time users */}
        {showWelcome && (
          <SetupWizard 
            onComplete={handleWelcomeComplete}
            onSkip={handleSetupSkip}
          />
        )}
        
        {/* Desktop Icons for quick access */}
        <DesktopIcons
          onNewTerminal={spawnTerminal}
          onAgentVillage={spawnGlobalMap}
          onSystemMonitor={() => spawnWindow('system-monitor', 'System Monitor')}
          onConvoyTest={runConvoyTest}
        />
        
        {/* Lifecycle Notification - Always rendered at top */}
        <LifecycleNotification 
          onKeepWorking={() => console.log('User clicked keep working')}
          onViewResults={() => console.log('User clicked view results')}
        />
        
        {windows.map(win => {
          if (win.type === 'terminal') {
            return (
              <TerminalWindow
                key={win.id}
                id={win.id}
                title={win.title}
                zIndex={win.zIndex}
                initialPosition={win.position}
                onClose={closeWindow}
                onFocus={focusWindow}
                initialCommand={win.initialCommand}
                onUiCommand={handleUiCommand}
              />
            );
          } else if (win.type === 'global-map') {
            return (
              <GlobalMapWindow
                key={win.id}
                id={win.id}
                title={win.title}
                zIndex={win.zIndex}
                initialPosition={win.position}
                onClose={closeWindow}
                onFocus={focusWindow}
                agents={globalAgents}
                messages={globalMessages}
              />
            );
          } else if (win.type === 'system-monitor') {
            return (
              <SystemMonitor
                key={win.id}
                id={win.id}
                zIndex={win.zIndex}
                initialPosition={win.position}
                onClose={closeWindow}
                onFocus={focusWindow}
              />
            );
          } else {
            return (
               <ContentWindow
                 key={win.id}
                 id={win.id}
                 title={win.title}
                 type={win.type}
                 content={win.content}
                 zIndex={win.zIndex}
                 initialPosition={win.position}
                 onClose={closeWindow}
                 onFocus={focusWindow}
                />
            );
          }
        })}

        <TaskbarContainer>
          <AppBar style={{ position: 'static', top: 'auto', bottom: 0 }}>
            <Toolbar style={{ justifyContent: 'space-between' }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <Button 
                  onClick={() => setStartMenuOpen(!startMenuOpen)} 
                  active={startMenuOpen} 
                  style={{ fontWeight: 'bold' }}
                >
                  <img
                    src="https://win98icons.alexmeub.com/icons/png/windows-0.png"
                    alt="logo"
                    style={{ height: '20px', marginRight: 4 }}
                  />
                  Start
                </Button>
                {startMenuOpen && (
                  <MenuList 
                    style={{
                      position: 'absolute',
                      left: 0,
                      bottom: '100%',
                      zIndex: 10001
                    }}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    <MenuListItem onClick={() => setAgentsMenuOpen(!agentsMenuOpen)}>
                      <Cpu size={16} style={{ marginRight: 8 }} />
                      Agents
                      <span style={{ marginLeft: 'auto' }}>▶</span>
                      {agentsMenuOpen && (
                        <MenuList
                          style={{
                            position: 'absolute',
                            left: '100%',
                            bottom: '0',
                            zIndex: 10002
                          }}
                        >
                          <MenuListItem onClick={() => spawnTerminal('Z.ai Agent (GLM 4.7)', 'export OPENCODE_PROVIDER=zai-coding-plan OPENCODE_MODEL=glm-4.7; echo "Starting Z.ai GLM 4.7 Agent..."; opencode')}>
                            <img
                              src="https://win98icons.alexmeub.com/icons/png/network_internet_pcs_installer-0.png"
                              alt="zai"
                              style={{ height: '16px', marginRight: 8 }}
                            />
                            Z.ai GLM 4.7
                          </MenuListItem>
                          <MenuListItem onClick={() => spawnTerminal('Asset Generator (HF)', 'export OPENCODE_PROVIDER=huggingface OPENCODE_MODEL=stable-diffusion-3.5-large; echo "Starting Asset Generator (Hugging Face)..."; opencode')}>
                            <img
                              src="https://win98icons.alexmeub.com/icons/png/paint_file-2.png"
                              alt="hf"
                              style={{ height: '16px', marginRight: 8 }}
                            />
                            Asset Generator
                          </MenuListItem>
                          <MenuListItem onClick={() => spawnTerminal('Sisyphus (Claude)', 'export OPENCODE_PROVIDER=anthropic OPENCODE_MODEL=claude-opus-4.5; echo "Starting Sisyphus (Claude)..."; opencode')}>
                            <img
                              src="https://win98icons.alexmeub.com/icons/png/msg_information-0.png"
                              alt="claude"
                              style={{ height: '16px', marginRight: 8 }}
                            />
                            Sisyphus (Claude)
                          </MenuListItem>
                          <MenuListItem onClick={() => spawnTerminal('Oracle (OpenAI)', 'export OPENCODE_PROVIDER=openai OPENCODE_MODEL=gpt-5.2; echo "Starting Oracle (OpenAI)..."; opencode')}>
                            <img
                              src="https://win98icons.alexmeub.com/icons/png/help_book_big-0.png"
                              alt="openai"
                              style={{ height: '16px', marginRight: 8 }}
                            />
                            Oracle (OpenAI)
                          </MenuListItem>
                          <MenuListItem onClick={() => spawnTerminal('Architect (Kimi-K2.5)', 'export OPENCODE_PROVIDER=openai OPENCODE_MODEL=kimi-k2.5; echo "Starting Architect (Kimi-K2.5) - Deep System Design Specialist..."; opencode')}>
                            <img
                              src="https://win98icons.alexmeub.com/icons/png/building-0.png"
                              alt="architect"
                              style={{ height: '16px', marginRight: 8 }}
                            />
                            Architect (Kimi-K2.5)
                          </MenuListItem>
                        </MenuList>
                      )}
                    </MenuListItem>
                    <Separator />
                    <MenuListItem onClick={spawnGlobalMap}>
                      <img
                        src="https://win98icons.alexmeub.com/icons/png/world-2.png"
                        alt="map"
                        style={{ height: '16px', marginRight: 8 }}
                      />
                      Agent Village
                    </MenuListItem>
                    <Separator />
                    <MenuListItem onClick={runConvoyTest}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <img
                          src="https://win98icons.alexmeub.com/icons/png/briefcase-2.png"
                          alt="test"
                          style={{ height: '16px', marginRight: 8 }}
                        />
                        Convoy Delivery Test
                      </div>
                    </MenuListItem>
                    <MenuListItem onClick={() => spawnTerminal()}>
                      <TerminalIcon size={16} style={{ marginRight: 8 }} />
                      New Terminal
                    </MenuListItem>
                    <Separator />
                    <MenuListItem onClick={() => spawnWindow('system-monitor', 'System Monitor')}>
                      <Monitor size={16} style={{ marginRight: 8 }} />
                      System Monitor
                    </MenuListItem>
                  </MenuList>
                )}
              </div>
              
              {/* Taskbar Items */}
              <div style={{ flex: 1, display: 'flex', marginLeft: 10, overflowX: 'auto' }}>
                   {windows.map(win => (
                    <Button
                     key={win.id}
                     active={win.zIndex === topZIndex}
                     onClick={() => focusWindow(win.id)}
                     style={{ marginRight: 4, minWidth: 100, textAlign: 'left', display: 'flex', alignItems: 'center' }}
                     >
                       {win.type === 'terminal' && <img src="https://win98icons.alexmeub.com/icons/png/console_prompt-0.png" alt="term" style={{ height: '16px', marginRight: 4 }} />}
                       {win.type === 'image' && <img src="https://win98icons.alexmeub.com/icons/png/paint_file-2.png" alt="img" style={{ height: '16px', marginRight: 4 }} />}
                       {win.type === 'browser' && <img src="https://win98icons.alexmeub.com/icons/png/msie1-0.png" alt="web" style={{ height: '16px', marginRight: 4 }} />}
                       {win.type === 'global-map' && <img src="https://win98icons.alexmeub.com/icons/png/world-2.png" alt="map" style={{ height: '16px', marginRight: 4 }} />}
                       {win.type === 'system-monitor' && <img src="https://win98icons.alexmeub.com/icons/png/monitor-0.png" alt="monitor" style={{ height: '16px', marginRight: 4 }} />}
                       <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {win.title}
                      </span>
                     </Button>
                  ))}
              </div>

              <div style={{ paddingRight: 6 }}>
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </Toolbar>
          </AppBar>
        </TaskbarContainer>
      </Desktop>
    </ThemeProvider>
  );
};

export default App;
