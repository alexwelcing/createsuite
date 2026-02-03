/**
 * macOS-style UI Components
 * Modern, clean design inspired by Tim Cook era macOS
 */

import styled, { css, keyframes } from 'styled-components';
import { macosTheme } from '../../theme/macos';

// ==================== ANIMATIONS ====================

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
`;

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const bounce = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
`;

// ==================== WINDOW ====================

interface WindowProps {
  $active?: boolean;
  $width?: string;
  $height?: string;
}

export const Window = styled.div<WindowProps>`
  background: ${macosTheme.colors.windowBg};
  border-radius: ${macosTheme.radius.window};
  box-shadow: ${props => props.$active ? macosTheme.shadows.window : macosTheme.shadows.windowInactive};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: ${fadeIn} 0.2s ease-out;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  ${props => props.$width && `width: ${props.$width};`}
  ${props => props.$height && `height: ${props.$height};`}
`;

export const WindowHeader = styled.div<{ $active?: boolean }>`
  background: ${props => props.$active ? macosTheme.colors.titleBarActive : macosTheme.colors.titleBar};
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid ${macosTheme.colors.border};
  cursor: default;
  user-select: none;
  min-height: 22px;
`;

export const TrafficLights = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

interface TrafficLightProps {
  $color: 'close' | 'minimize' | 'maximize';
  $active?: boolean;
  onClick?: () => void;
}

const trafficLightColors = {
  close: { normal: macosTheme.colors.close, hover: macosTheme.colors.closeHover },
  minimize: { normal: macosTheme.colors.minimize, hover: macosTheme.colors.minimizeHover },
  maximize: { normal: macosTheme.colors.maximize, hover: macosTheme.colors.maximizeHover },
};

export const TrafficLight = styled.button<TrafficLightProps>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  padding: 0;
  cursor: pointer;
  background: ${props => props.$active 
    ? trafficLightColors[props.$color].normal 
    : macosTheme.colors.trafficLightInactive};
  transition: ${macosTheme.transitions.fast};
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: ${props => trafficLightColors[props.$color].hover};
  }
  
  svg {
    width: 8px;
    height: 8px;
    opacity: 0;
    transition: opacity 0.1s;
  }
  
  ${TrafficLights}:hover & svg {
    opacity: 0.6;
  }
`;

export const WindowTitle = styled.div`
  flex: 1;
  text-align: center;
  font-family: ${macosTheme.fonts.system};
  font-size: 13px;
  font-weight: 500;
  color: ${macosTheme.colors.textPrimary};
  opacity: 0.85;
`;

export const WindowContent = styled.div`
  flex: 1;
  overflow: auto;
  padding: ${macosTheme.spacing.md};
  font-family: ${macosTheme.fonts.system};
`;

// ==================== BUTTONS ====================

interface ButtonProps {
  $primary?: boolean;
  $danger?: boolean;
  $size?: 'sm' | 'md' | 'lg';
}

export const Button = styled.button<ButtonProps>`
  font-family: ${macosTheme.fonts.system};
  font-size: ${props => props.$size === 'sm' ? '12px' : props.$size === 'lg' ? '15px' : '13px'};
  font-weight: 500;
  padding: ${props => props.$size === 'sm' ? '4px 10px' : props.$size === 'lg' ? '10px 20px' : '6px 14px'};
  border-radius: ${macosTheme.radius.button};
  border: none;
  cursor: pointer;
  transition: ${macosTheme.transitions.fast};
  display: inline-flex;
  align-items: center;
  gap: 6px;
  
  ${props => props.$primary ? css`
    background: ${macosTheme.colors.accent};
    color: white;
    box-shadow: 0 1px 2px rgba(0, 122, 255, 0.3);
    
    &:hover {
      background: ${macosTheme.colors.accentHover};
    }
    
    &:active {
      transform: scale(0.98);
    }
  ` : props.$danger ? css`
    background: ${macosTheme.colors.error};
    color: white;
    
    &:hover {
      background: #e5342a;
    }
  ` : css`
    background: linear-gradient(180deg, #fafafa 0%, #e8e8e8 100%);
    color: ${macosTheme.colors.textPrimary};
    border: 1px solid ${macosTheme.colors.borderDark};
    box-shadow: ${macosTheme.shadows.button};
    
    &:hover {
      background: linear-gradient(180deg, #ffffff 0%, #f0f0f0 100%);
    }
    
    &:active {
      background: linear-gradient(180deg, #e0e0e0 0%, #d0d0d0 100%);
    }
  `}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// ==================== INPUTS ====================

export const Input = styled.input`
  font-family: ${macosTheme.fonts.system};
  font-size: 13px;
  padding: 8px 12px;
  border-radius: ${macosTheme.radius.input};
  border: 1px solid ${macosTheme.colors.border};
  background: white;
  color: ${macosTheme.colors.textPrimary};
  outline: none;
  transition: ${macosTheme.transitions.fast};
  width: 100%;
  box-sizing: border-box;
  
  &:focus {
    border-color: ${macosTheme.colors.accent};
    box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.2);
  }
  
  &::placeholder {
    color: ${macosTheme.colors.textSecondary};
  }
`;

export const TextArea = styled.textarea`
  font-family: ${macosTheme.fonts.system};
  font-size: 13px;
  padding: 8px 12px;
  border-radius: ${macosTheme.radius.input};
  border: 1px solid ${macosTheme.colors.border};
  background: white;
  color: ${macosTheme.colors.textPrimary};
  outline: none;
  transition: ${macosTheme.transitions.fast};
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  min-height: 80px;
  
  &:focus {
    border-color: ${macosTheme.colors.accent};
    box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.2);
  }
`;

// ==================== CHECKBOX ====================

export const Checkbox = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-family: ${macosTheme.fonts.system};
  font-size: 13px;
  color: ${macosTheme.colors.textPrimary};
  
  input {
    appearance: none;
    width: 16px;
    height: 16px;
    border: 1px solid ${macosTheme.colors.borderDark};
    border-radius: 4px;
    background: white;
    cursor: pointer;
    position: relative;
    transition: ${macosTheme.transitions.fast};
    
    &:checked {
      background: ${macosTheme.colors.accent};
      border-color: ${macosTheme.colors.accent};
      
      &::after {
        content: '';
        position: absolute;
        left: 5px;
        top: 2px;
        width: 4px;
        height: 8px;
        border: solid white;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
      }
    }
    
    &:focus {
      box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.2);
    }
  }
`;

// ==================== MENU ====================

export const Menu = styled.div`
  background: ${macosTheme.colors.windowBg};
  border-radius: 6px;
  box-shadow: ${macosTheme.shadows.window};
  padding: 4px 0;
  min-width: 200px;
  backdrop-filter: blur(20px);
  animation: ${slideUp} 0.15s ease-out;
`;

export const MenuItem = styled.button<{ $destructive?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 16px;
  border: none;
  background: none;
  cursor: pointer;
  font-family: ${macosTheme.fonts.system};
  font-size: 13px;
  color: ${props => props.$destructive ? macosTheme.colors.error : macosTheme.colors.textPrimary};
  text-align: left;
  
  &:hover {
    background: ${macosTheme.colors.accent};
    color: white;
  }
  
  svg {
    width: 16px;
    height: 16px;
    opacity: 0.7;
  }
`;

export const MenuDivider = styled.div`
  height: 1px;
  background: ${macosTheme.colors.border};
  margin: 4px 0;
`;

// ==================== DOCK ====================

export const Dock = styled.div`
  position: fixed;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
  padding: 6px 10px;
  background: ${macosTheme.colors.dockBg};
  border: 1px solid ${macosTheme.colors.dockBorder};
  border-radius: ${macosTheme.radius.dock};
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: ${macosTheme.shadows.dock};
`;

export const DockItem = styled.button<{ $active?: boolean }>`
  width: 54px;
  height: 54px;
  border-radius: ${macosTheme.radius.dockIcon};
  border: none;
  background: ${props => props.$active 
    ? 'rgba(255, 255, 255, 0.3)' 
    : 'rgba(255, 255, 255, 0.1)'};
  cursor: pointer;
  transition: ${macosTheme.transitions.fast};
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  
  &:hover {
    transform: translateY(-8px) scale(1.15);
    background: rgba(255, 255, 255, 0.25);
  }
  
  img, svg {
    width: 38px;
    height: 38px;
    object-fit: contain;
  }
  
  ${props => props.$active && css`
    &::after {
      content: '';
      position: absolute;
      bottom: -4px;
      left: 50%;
      transform: translateX(-50%);
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: white;
    }
  `}
`;

export const DockDivider = styled.div`
  width: 1px;
  height: 40px;
  background: rgba(255, 255, 255, 0.3);
  margin: 7px 4px;
`;

// ==================== TOP MENU BAR ====================

export const MenuBar = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 28px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid ${macosTheme.colors.border};
  display: flex;
  align-items: center;
  padding: 0 12px;
  z-index: 99999;
`;

export const MenuBarItem = styled.button<{ $bold?: boolean }>`
  font-family: ${macosTheme.fonts.system};
  font-size: 13px;
  font-weight: ${props => props.$bold ? 600 : 400};
  color: ${macosTheme.colors.textPrimary};
  background: none;
  border: none;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  
  &:hover {
    background: rgba(0, 0, 0, 0.08);
  }
`;

export const MenuBarRight = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: ${macosTheme.fonts.system};
  font-size: 13px;
  color: ${macosTheme.colors.textPrimary};
`;

// ==================== BADGES & TAGS ====================

interface BadgeProps {
  $variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

const badgeColors = {
  default: { bg: '#e5e5e7', text: '#1d1d1f' },
  success: { bg: '#d1f2d9', text: '#1d7a3a' },
  warning: { bg: '#fff3cd', text: '#856404' },
  error: { bg: '#ffd7d5', text: '#c62828' },
  info: { bg: '#d4e5ff', text: '#0056b3' },
};

export const Badge = styled.span<BadgeProps>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 12px;
  font-family: ${macosTheme.fonts.system};
  font-size: 11px;
  font-weight: 500;
  background: ${props => badgeColors[props.$variant || 'default'].bg};
  color: ${props => badgeColors[props.$variant || 'default'].text};
`;

// ==================== PROGRESS ====================

export const ProgressBar = styled.div<{ $value: number }>`
  height: 6px;
  background: ${macosTheme.colors.border};
  border-radius: 3px;
  overflow: hidden;
  
  &::after {
    content: '';
    display: block;
    height: 100%;
    width: ${props => props.$value}%;
    background: ${macosTheme.colors.accent};
    border-radius: 3px;
    transition: width 0.3s ease;
  }
`;

// ==================== SPINNER ====================

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

export const Spinner = styled.div<{ $size?: number }>`
  width: ${props => props.$size || 20}px;
  height: ${props => props.$size || 20}px;
  border: 2px solid ${macosTheme.colors.border};
  border-top-color: ${macosTheme.colors.accent};
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`;

// ==================== TOOLTIP ====================

export const Tooltip = styled.div`
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  font-family: ${macosTheme.fonts.system};
  font-size: 12px;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  margin-bottom: 8px;
  animation: ${fadeIn} 0.1s ease-out;
`;

// ==================== CARD ====================

export const Card = styled.div`
  background: white;
  border-radius: 12px;
  padding: ${macosTheme.spacing.md};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid ${macosTheme.colors.border};
`;

// ==================== LINK ====================

export const Link = styled.a`
  color: ${macosTheme.colors.accent};
  text-decoration: none;
  cursor: pointer;
  
  &:hover {
    text-decoration: underline;
  }
`;

export { fadeIn, slideUp, bounce };
