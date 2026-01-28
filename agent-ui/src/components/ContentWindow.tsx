import React, { useRef } from 'react';
import styled from 'styled-components';
import { Window, WindowHeader, WindowContent, Button } from 'react95';
import Draggable from 'react-draggable';

const StyledWindow = styled(Window)`
  width: 600px;
  height: 400px;
  position: absolute;
  display: flex;
  flex-direction: column;
`;

const StyledWindowContent = styled(WindowContent)`
  flex: 1;
  display: flex;
  padding: 0;
  margin: 4px;
  background: white;
  overflow: hidden;
  position: relative;
`;

interface ContentWindowProps {
  id: string;
  title: string;
  type: 'image' | 'browser';
  content: string; // URL for image or browser
  onClose: (id: string) => void;
  zIndex: number;
  onFocus: (id: string) => void;
  initialPosition?: { x: number; y: number };
}

const ContentWindow: React.FC<ContentWindowProps> = ({ 
  id, 
  title, 
  type,
  content,
  onClose, 
  zIndex, 
  onFocus,
  initialPosition = { x: 50, y: 50 }
}) => {
  const nodeRef = useRef<HTMLDivElement>(null);

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".window-header"
      defaultPosition={initialPosition}
      onMouseDown={() => onFocus(id)}
    >
      <div ref={nodeRef} style={{ position: 'absolute', zIndex }}>
        <StyledWindow className='window'>
          <WindowHeader className='window-header' style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ marginLeft: 4 }}>{title}</span>
            <Button onClick={() => onClose(id)} size='sm' square>
              <span style={{ fontWeight: 'bold', transform: 'translateY(-1px)' }}>x</span>
            </Button>
          </WindowHeader>
          <StyledWindowContent>
            {type === 'image' && (
              <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'auto' }}>
                <img src={content} alt={title} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </div>
            )}
            {type === 'browser' && (
               <iframe src={content} style={{ width: '100%', height: '100%', border: 'none' }} title={title} />
            )}
          </StyledWindowContent>
        </StyledWindow>
      </div>
    </Draggable>
  );
};

export default ContentWindow;
