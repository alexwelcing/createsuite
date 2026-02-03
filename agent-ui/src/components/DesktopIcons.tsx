import React from 'react';
import styled, { keyframes } from 'styled-components';

// ==================== ANIMATIONS ====================

const bounce = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
`;

// ==================== STYLED COMPONENTS ====================

const DesktopIconsContainer = styled.div`
  position: absolute;
  top: 20px;
  left: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  z-index: 1;
`;

const IconWrapper = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 8px;
  width: 80px;
  color: white;
  font-family: 'ms_sans_serif', sans-serif;
  font-size: 11px;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  
  &:hover {
    background: rgba(0, 0, 128, 0.3);
    
    .icon-image {
      animation: ${bounce} 0.3s ease-in-out;
    }
  }
  
  &:focus {
    background: rgba(0, 0, 128, 0.5);
    outline: 1px dotted white;
  }
  
  &:active {
    background: rgba(0, 0, 128, 0.7);
  }
`;

const IconImage = styled.div`
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  img {
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }
`;

const IconLabel = styled.span`
  text-align: center;
  word-wrap: break-word;
  max-width: 72px;
  line-height: 1.2;
`;

// ==================== COMPONENT ====================

interface DesktopIconsProps {
  onNewTerminal: () => void;
  onAgentVillage: () => void;
  onSystemMonitor: () => void;
  onConvoyTest: () => void;
}

const DesktopIcons: React.FC<DesktopIconsProps> = ({
  onNewTerminal,
  onAgentVillage,
  onSystemMonitor,
  onConvoyTest
}) => {
  return (
    <DesktopIconsContainer>
      <IconWrapper onClick={onNewTerminal} title="Open a new terminal (Ctrl+N)">
        <IconImage className="icon-image">
          <img 
            src="https://win98icons.alexmeub.com/icons/png/console_prompt-0.png" 
            alt="Terminal"
          />
        </IconImage>
        <IconLabel>Terminal</IconLabel>
      </IconWrapper>
      
      <IconWrapper onClick={onAgentVillage} title="View Agent Village">
        <IconImage className="icon-image">
          <img 
            src="https://win98icons.alexmeub.com/icons/png/world-2.png" 
            alt="Agent Village"
          />
        </IconImage>
        <IconLabel>Agent Village</IconLabel>
      </IconWrapper>
      
      <IconWrapper onClick={onSystemMonitor} title="System Monitor">
        <IconImage className="icon-image">
          <img 
            src="https://win98icons.alexmeub.com/icons/png/monitor-0.png" 
            alt="System Monitor"
          />
        </IconImage>
        <IconLabel>System Monitor</IconLabel>
      </IconWrapper>
      
      <IconWrapper onClick={onConvoyTest} title="Run Convoy Delivery Test">
        <IconImage className="icon-image">
          <img 
            src="https://win98icons.alexmeub.com/icons/png/briefcase-2.png" 
            alt="Convoy Test"
          />
        </IconImage>
        <IconLabel>Convoy Test</IconLabel>
      </IconWrapper>
    </DesktopIconsContainer>
  );
};

export default DesktopIcons;
