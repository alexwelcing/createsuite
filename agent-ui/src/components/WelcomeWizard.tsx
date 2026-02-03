import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { 
  Window, 
  WindowHeader, 
  WindowContent, 
  Button, 
  Separator,
  Anchor
} from 'react95';
import { 
  Terminal, 
  Rocket, 
  Users, 
  Zap, 
  Settings,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Sparkles,
  Globe
} from 'lucide-react';

// ==================== ANIMATIONS ====================

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
`;

const sparkle = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

// ==================== STYLED COMPONENTS ====================

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 128, 128, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50000;
  animation: ${fadeIn} 0.5s ease-out;
`;

const WizardWindow = styled(Window)`
  width: 600px;
  max-width: 90vw;
  box-shadow: 8px 8px 0 rgba(0,0,0,0.5);
`;

const StepContent = styled.div`
  animation: ${fadeIn} 0.3s ease-out;
  min-height: 350px;
  display: flex;
  flex-direction: column;
`;

const IconContainer = styled.div`
  display: flex;
  justify-content: center;
  margin: 20px 0;
  animation: ${float} 3s ease-in-out infinite;
`;

const BigIcon = styled.div<{ $color?: string }>`
  width: 80px;
  height: 80px;
  background: ${props => props.$color || '#000080'};
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: inset -2px -2px 0 rgba(0,0,0,0.3), inset 2px 2px 0 rgba(255,255,255,0.3);
`;

const Title = styled.h2`
  text-align: center;
  font-size: 24px;
  margin: 0 0 8px 0;
  color: #000080;
`;

const Subtitle = styled.p`
  text-align: center;
  font-size: 14px;
  color: #555;
  margin: 0 0 20px 0;
`;

const FeatureGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin: 16px 0;
`;

const FeatureCard = styled.div`
  background: #fff;
  border: 2px solid #808080;
  padding: 12px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  
  &:hover {
    background: #f0f0f0;
    border-color: #000080;
  }
`;

const FeatureIcon = styled.div<{ $color: string }>`
  width: 32px;
  height: 32px;
  background: ${props => props.$color};
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
`;

const FeatureText = styled.div`
  flex: 1;
`;

const FeatureTitle = styled.div`
  font-weight: bold;
  font-size: 13px;
  margin-bottom: 2px;
`;

const FeatureDesc = styled.div`
  font-size: 11px;
  color: #555;
`;

const QuickActionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin: 20px 0;
`;

const QuickAction = styled.button<{ $primary?: boolean }>`
  background: ${props => props.$primary ? '#000080' : '#fff'};
  color: ${props => props.$primary ? '#fff' : '#000'};
  border: 2px outset ${props => props.$primary ? '#0000aa' : '#dfdfdf'};
  padding: 16px 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-family: 'ms_sans_serif', sans-serif;
  font-size: 12px;
  
  &:hover {
    background: ${props => props.$primary ? '#0000aa' : '#f0f0f0'};
  }
  
  &:active {
    border-style: inset;
  }
`;

const ActionIcon = styled.div`
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ButtonRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 16px;
`;

const StepIndicator = styled.div`
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
`;

const StepDot = styled.div<{ $active: boolean; $completed: boolean }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: ${props => props.$completed ? '#00aa00' : props.$active ? '#000080' : '#c0c0c0'};
  border: 2px solid ${props => props.$active ? '#000080' : '#808080'};
  transition: all 0.2s;
`;

const ChecklistItem = styled.div<{ $checked: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: ${props => props.$checked ? '#e8f5e9' : '#fff'};
  border: 1px solid #c0c0c0;
  margin-bottom: 8px;
  cursor: pointer;
  
  &:hover {
    background: ${props => props.$checked ? '#c8e6c9' : '#f5f5f5'};
  }
`;

const SparkleIcon = styled(Sparkles)`
  animation: ${sparkle} 1.5s ease-in-out infinite;
`;

// ==================== COMPONENT ====================

interface WelcomeWizardProps {
  onComplete: (action?: string) => void;
  onSkip: () => void;
}

const WelcomeWizard: React.FC<WelcomeWizardProps> = ({ onComplete, onSkip }) => {
  const [step, setStep] = useState(0);

  const totalSteps = 3;

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleComplete = (action?: string) => {
    localStorage.setItem('createsuite-welcomed', 'true');
    onComplete(action);
  };

  const handleSkip = () => {
    localStorage.setItem('createsuite-welcomed', 'true');
    onSkip();
  };

  // Step 0: Welcome
  const renderWelcome = () => (
    <StepContent>
      <IconContainer>
        <BigIcon $color="#008080">
          <SparkleIcon size={48} />
        </BigIcon>
      </IconContainer>
      
      <Title>Welcome to CreateSuite! 🎉</Title>
      <Subtitle>
        Your AI-powered agent command center with Windows 95 charm
      </Subtitle>
      
      <FeatureGrid>
        <FeatureCard>
          <FeatureIcon $color="#5865F2">
            <Terminal size={18} />
          </FeatureIcon>
          <FeatureText>
            <FeatureTitle>Multi-Agent Terminals</FeatureTitle>
            <FeatureDesc>Run multiple AI agents in parallel terminal sessions</FeatureDesc>
          </FeatureText>
        </FeatureCard>
        
        <FeatureCard>
          <FeatureIcon $color="#00AA00">
            <Users size={18} />
          </FeatureIcon>
          <FeatureText>
            <FeatureTitle>Agent Village</FeatureTitle>
            <FeatureDesc>Visualize your agents working together in real-time</FeatureDesc>
          </FeatureText>
        </FeatureCard>
        
        <FeatureCard>
          <FeatureIcon $color="#AA6600">
            <Zap size={18} />
          </FeatureIcon>
          <FeatureText>
            <FeatureTitle>Smart Lifecycle</FeatureTitle>
            <FeatureDesc>Auto-shutdown when work completes, saving you money</FeatureDesc>
          </FeatureText>
        </FeatureCard>
        
        <FeatureCard>
          <FeatureIcon $color="#AA0000">
            <Globe size={18} />
          </FeatureIcon>
          <FeatureText>
            <FeatureTitle>Deploy Anywhere</FeatureTitle>
            <FeatureDesc>Fly.io, Render, or run locally with one command</FeatureDesc>
          </FeatureText>
        </FeatureCard>
      </FeatureGrid>
      
      <ButtonRow>
        <Button onClick={handleSkip}>
          Skip Intro
        </Button>
        <Button primary onClick={handleNext}>
          Let's Go! <ArrowRight size={14} style={{ marginLeft: 6 }} />
        </Button>
      </ButtonRow>
    </StepContent>
  );

  // Step 1: Quick Setup
  const renderSetup = () => (
    <StepContent>
      <IconContainer>
        <BigIcon $color="#000080">
          <Settings size={48} />
        </BigIcon>
      </IconContainer>
      
      <Title>Quick Setup</Title>
      <Subtitle>
        CreateSuite works with multiple AI providers
      </Subtitle>
      
      <div style={{ background: '#ffffcc', padding: 12, border: '1px solid #aaaa00', marginBottom: 16 }}>
        <strong>💡 Tip:</strong> You can use CreateSuite right away with the built-in terminal! 
        AI providers are optional enhancements.
      </div>
      
      <ChecklistItem $checked={true}>
        <CheckCircle size={16} color="#00aa00" />
        <span><strong>Terminal Ready</strong> - Full shell access included</span>
      </ChecklistItem>
      
      <ChecklistItem $checked={false}>
        <div style={{ width: 16, height: 16, border: '2px solid #808080', background: '#fff' }} />
        <span><strong>OpenCode</strong> - Optional: Install for AI-powered coding</span>
      </ChecklistItem>
      
      <ChecklistItem $checked={false}>
        <div style={{ width: 16, height: 16, border: '2px solid #808080', background: '#fff' }} />
        <span><strong>API Keys</strong> - Optional: Add AI provider credentials</span>
      </ChecklistItem>
      
      <div style={{ marginTop: 16, fontSize: 12, color: '#666' }}>
        <Anchor href="https://github.com/awelcing-alm/createsuite" target="_blank">
          📚 View full documentation →
        </Anchor>
      </div>
      
      <ButtonRow>
        <Button onClick={handlePrev}>
          <ArrowLeft size={14} style={{ marginRight: 6 }} /> Back
        </Button>
        <Button primary onClick={handleNext}>
          Continue <ArrowRight size={14} style={{ marginLeft: 6 }} />
        </Button>
      </ButtonRow>
    </StepContent>
  );

  // Step 2: Quick Actions
  const renderQuickActions = () => (
    <StepContent>
      <IconContainer>
        <BigIcon $color="#00AA00">
          <Rocket size={48} />
        </BigIcon>
      </IconContainer>
      
      <Title>Ready to Start!</Title>
      <Subtitle>
        Choose how you'd like to begin
      </Subtitle>
      
      <QuickActionGrid>
        <QuickAction $primary onClick={() => handleComplete('terminal')}>
          <ActionIcon>
            <img 
              src="https://win98icons.alexmeub.com/icons/png/console_prompt-0.png" 
              alt="terminal"
              style={{ width: 40, height: 40 }}
            />
          </ActionIcon>
          <span>New Terminal</span>
        </QuickAction>
        
        <QuickAction onClick={() => handleComplete('village')}>
          <ActionIcon>
            <img 
              src="https://win98icons.alexmeub.com/icons/png/world-2.png" 
              alt="village"
              style={{ width: 40, height: 40 }}
            />
          </ActionIcon>
          <span>Agent Village</span>
        </QuickAction>
        
        <QuickAction onClick={() => handleComplete('demo')}>
          <ActionIcon>
            <img 
              src="https://win98icons.alexmeub.com/icons/png/briefcase-2.png" 
              alt="demo"
              style={{ width: 40, height: 40 }}
            />
          </ActionIcon>
          <span>Demo Mode</span>
        </QuickAction>
      </QuickActionGrid>
      
      <div style={{ 
        textAlign: 'center', 
        fontSize: 11, 
        color: '#666',
        padding: '8px 16px',
        background: '#f0f0f0',
        border: '1px inset #808080'
      }}>
        💡 <strong>Pro tip:</strong> Press <kbd style={{ background: '#fff', padding: '2px 6px', border: '1px outset #ccc' }}>Ctrl+N</kbd> anytime to open a new terminal
      </div>
      
      <ButtonRow>
        <Button onClick={handlePrev}>
          <ArrowLeft size={14} style={{ marginRight: 6 }} /> Back
        </Button>
        <Button onClick={() => handleComplete()}>
          Just Explore
        </Button>
      </ButtonRow>
    </StepContent>
  );

  const steps = [renderWelcome, renderSetup, renderQuickActions];

  return (
    <Overlay>
      <WizardWindow>
        <WindowHeader>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img 
              src="https://win98icons.alexmeub.com/icons/png/key_win-2.png" 
              alt="cs"
              style={{ height: 16 }}
            />
            CreateSuite Setup
          </span>
        </WindowHeader>
        <WindowContent>
          <StepIndicator>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <StepDot 
                key={i} 
                $active={i === step} 
                $completed={i < step}
              />
            ))}
          </StepIndicator>
          
          <Separator />
          
          {steps[step]()}
        </WindowContent>
      </WizardWindow>
    </Overlay>
  );
};

export default WelcomeWizard;
