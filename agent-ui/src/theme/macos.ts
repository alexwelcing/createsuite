/**
 * macOS Design System (Tim Cook Era)
 * Clean, modern, with the signature traffic light window controls
 */

export const macosTheme = {
  // Colors
  colors: {
    // Window chrome
    windowBg: 'rgba(246, 246, 246, 0.95)',
    windowBgDark: 'rgba(40, 40, 40, 0.95)',
    titleBar: 'linear-gradient(180deg, #e8e8e8 0%, #d4d4d4 100%)',
    titleBarActive: 'linear-gradient(180deg, #f0f0f0 0%, #e0e0e0 100%)',
    
    // Traffic lights
    close: '#ff5f57',
    closeHover: '#ff3b30',
    minimize: '#ffbd2e', 
    minimizeHover: '#ff9500',
    maximize: '#28c840',
    maximizeHover: '#34c759',
    trafficLightInactive: '#ddd',
    
    // System colors
    accent: '#007aff',
    accentHover: '#0056b3',
    success: '#34c759',
    warning: '#ff9500',
    error: '#ff3b30',
    
    // Backgrounds
    desktopBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    sidebarBg: 'rgba(245, 245, 247, 0.8)',
    
    // Text
    textPrimary: '#1d1d1f',
    textSecondary: '#86868b',
    textInverse: '#ffffff',
    
    // Borders
    border: 'rgba(0, 0, 0, 0.1)',
    borderDark: 'rgba(0, 0, 0, 0.2)',
    
    // Dock
    dockBg: 'rgba(255, 255, 255, 0.2)',
    dockBorder: 'rgba(255, 255, 255, 0.3)',
  },
  
  // Typography
  fonts: {
    system: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    mono: '"SF Mono", "Fira Code", "Monaco", "Consolas", monospace',
  },
  
  // Shadows
  shadows: {
    window: '0 22px 70px 4px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.1)',
    windowInactive: '0 10px 30px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.08)',
    button: '0 1px 2px rgba(0, 0, 0, 0.1)',
    dock: '0 0 30px rgba(0, 0, 0, 0.3)',
    modal: '0 25px 80px rgba(0, 0, 0, 0.35)',
  },
  
  // Border radius
  radius: {
    window: '10px',
    button: '6px',
    input: '6px',
    dock: '22px',
    dockIcon: '12px',
  },
  
  // Spacing
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  
  // Transitions
  transitions: {
    fast: '0.15s ease',
    normal: '0.25s ease',
    slow: '0.4s ease',
  },
};

export type MacOSTheme = typeof macosTheme;
