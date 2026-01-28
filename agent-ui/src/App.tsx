import React, { useState, useEffect } from 'react';
import styled, { createGlobalStyle, ThemeProvider } from 'styled-components';
import { styleReset, AppBar, Toolbar, Button, MenuList, MenuListItem, Separator } from 'react95';
import original from 'react95/dist/themes/original';
import ms_sans_serif from 'react95/dist/fonts/ms_sans_serif.woff2';
import ms_sans_serif_bold from 'react95/dist/fonts/ms_sans_serif_bold.woff2';
import TerminalWindow from './components/TerminalWindow';
import ContentWindow from './components/ContentWindow';
import { Monitor, Terminal as TerminalIcon, Cpu } from 'lucide-react';

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

type WindowState = TerminalState | ImageState | BrowserState;

const App: React.FC = () => {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [agentsMenuOpen, setAgentsMenuOpen] = useState(false);
  const [topZIndex, setTopZIndex] = useState(1);

  const spawnWindow = (
    type: 'terminal' | 'image' | 'browser', 
    title: string, 
    contentOrCommand?: string, 
    customPosition?: { x: number, y: number }
  ) => {
    const id = Math.random().toString(36).substr(2, 9);
    
    setWindows(prev => {
      const maxZ = prev.reduce((max, t) => Math.max(max, t.zIndex), topZIndex);
      const newZ = maxZ + 1;
      setTopZIndex(newZ); // Keep state in sync eventually
      
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
        title: `${title}`, // - ${id.substr(0, 4)}`, // Cleaner titles
        zIndex: newZ,
        position
      };

      if (type === 'terminal') {
        return [...prev, { ...base, type: 'terminal', initialCommand: contentOrCommand }];
      } else if (type === 'image') {
        return [...prev, { ...base, type: 'image', content: contentOrCommand || '' }];
      } else {
        return [...prev, { ...base, type: 'browser', content: contentOrCommand || '' }];
      }
    });
    
    // Only close menus if initiated manually, but hard to tell here.
    // For now, always close.
    setStartMenuOpen(false);
    setAgentsMenuOpen(false);
  };

  const spawnTerminal = (title: string = 'OpenCode Terminal', command?: string, customPosition?: { x: number, y: number }) => {
    spawnWindow('terminal', title, command, customPosition);
  };

  const closeWindow = (id: string) => {
    setWindows(prev => prev.filter(t => t.id !== id));
  };

  const focusWindow = (id: string) => {
    const newZ = topZIndex + 1;
    setTopZIndex(newZ);
    setWindows(prev => prev.map(t => t.id === id ? { ...t, zIndex: newZ } : t));
  };

  const handleUiCommand = (payload: any) => {
    console.log('Received UI Command:', payload);
    if (!payload.type) return;

    if (payload.type === 'image') {
      // Assuming payload.src is relative to workspace root
      // We prepend /workspace/ to make it accessible via our static route
      const src = payload.src.startsWith('http') ? payload.src : `/workspace/${payload.src}`;
      spawnWindow('image', payload.title || 'Image Preview', src);
    } else if (payload.type === 'browser') {
      spawnWindow('browser', payload.title || 'Web Preview', payload.url);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === 'true') {
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
    }
  }, []);

  return (
    <ThemeProvider theme={original}>
      <GlobalStyles />
      <Desktop>
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
                        </MenuList>
                      )}
                    </MenuListItem>
                    <Separator />
                    <MenuListItem onClick={() => {
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
                    }}>
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
                    <MenuListItem disabled>
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
