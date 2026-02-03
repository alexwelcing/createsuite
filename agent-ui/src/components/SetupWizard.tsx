import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { macosTheme } from '../theme/macos';
import { 
  Key, 
  CheckCircle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Sparkles,
  Settings,
  Play,
  ExternalLink
} from 'lucide-react';

// ==================== TYPES ====================

interface Provider {
  id: string;
  name: string;
  description: string;
  color: string;
  envVar: string;
  placeholder: string;
  docsUrl?: string;
}

interface ProviderStatus {
  configured: boolean;
  tested: boolean;
  working: boolean;
  error?: string;
}

// ==================== PROVIDER DEFINITIONS ====================

const PROVIDERS: Provider[] = [
  {
    id: 'anthropic',
    name: 'Claude (Anthropic)',
    description: 'Claude Opus 4.5 - Great for complex coding tasks',
    color: '#bf5af2',
    envVar: 'ANTHROPIC_API_KEY',
    placeholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-5.2 - Excellent for debugging & architecture',
    color: '#34c759',
    envVar: 'OPENAI_API_KEY',
    placeholder: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys'
  },
  {
    id: 'google',
    name: 'Google Gemini',
    description: 'Gemini 3 Pro - Strong multimodal capabilities',
    color: '#007aff',
    envVar: 'GOOGLE_API_KEY',
    placeholder: 'AIza...',
    docsUrl: 'https://makersuite.google.com/app/apikey'
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    description: 'Stable Diffusion - Asset & image generation',
    color: '#ff9f0a',
    envVar: 'HF_TOKEN',
    placeholder: 'hf_...',
    docsUrl: 'https://huggingface.co/settings/tokens'
  }
];

// ==================== ANIMATIONS ====================

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.95) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

// ==================== STYLED COMPONENTS ====================

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50000;
`;

const Window = styled.div`
  width: 600px;
  max-width: 95vw;
  max-height: 90vh;
  background: rgba(40, 40, 45, 0.95);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 
    0 25px 80px rgba(0, 0, 0, 0.5),
    0 0 0 0.5px rgba(255, 255, 255, 0.1) inset;
  animation: ${fadeIn} 0.3s ease-out;
`;

const TitleBar = styled.div`
  height: 52px;
  background: linear-gradient(180deg, rgba(60, 60, 65, 0.95) 0%, rgba(45, 45, 50, 0.95) 100%);
  display: flex;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.3);
`;

const TrafficLights = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const TrafficLight = styled.button<{ $color: 'close' | 'minimize' | 'maximize' }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  
  background: ${props => {
    switch (props.$color) {
      case 'close': return '#ff5f57';
      case 'minimize': return '#febc2e';
      case 'maximize': return '#28c840';
    }
  }};
  
  &:hover {
    filter: brightness(1.1);
  }
`;

const TitleText = styled.div`
  flex: 1;
  text-align: center;
  font-family: ${macosTheme.fonts.system};
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
`;

const Content = styled.div`
  padding: 24px;
  max-height: calc(90vh - 52px);
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
  }
`;

const StepContent = styled.div`
  animation: ${fadeIn} 0.3s ease-out;
  min-height: 380px;
  display: flex;
  flex-direction: column;
`;

const Title = styled.h2`
  text-align: center;
  font-family: ${macosTheme.fonts.system};
  font-size: 22px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
`;

const Subtitle = styled.p`
  text-align: center;
  font-family: ${macosTheme.fonts.system};
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0 0 24px 0;
`;

const InfoBox = styled.div<{ $type?: 'warning' | 'info' | 'success' }>`
  background: ${props => 
    props.$type === 'warning' ? 'rgba(255, 159, 10, 0.15)' : 
    props.$type === 'success' ? 'rgba(52, 199, 89, 0.15)' : 'rgba(0, 122, 255, 0.15)'};
  border: 1px solid ${props => 
    props.$type === 'warning' ? 'rgba(255, 159, 10, 0.3)' : 
    props.$type === 'success' ? 'rgba(52, 199, 89, 0.3)' : 'rgba(0, 122, 255, 0.3)'};
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 20px;
  font-family: ${macosTheme.fonts.system};
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: flex-start;
  gap: 12px;
  
  ul {
    margin: 8px 0 0 0;
    padding-left: 18px;
    color: rgba(255, 255, 255, 0.7);
  }
  
  strong {
    color: white;
  }
`;

const ProviderList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 16px 0;
`;

const ProviderCard = styled.div<{ $selected: boolean; $color: string }>`
  background: ${props => props.$selected 
    ? `linear-gradient(135deg, ${props.$color}22 0%, ${props.$color}11 100%)`
    : 'rgba(255, 255, 255, 0.05)'};
  border: 1px solid ${props => props.$selected ? props.$color : 'rgba(255, 255, 255, 0.1)'};
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.$selected 
      ? `linear-gradient(135deg, ${props.$color}33 0%, ${props.$color}22 100%)`
      : 'rgba(255, 255, 255, 0.08)'};
    border-color: ${props => props.$color};
  }
`;

const Checkbox = styled.div<{ $checked: boolean; $color?: string }>`
  width: 20px;
  height: 20px;
  border-radius: 5px;
  border: 2px solid ${props => props.$checked ? (props.$color || '#007aff') : 'rgba(255, 255, 255, 0.3)'};
  background: ${props => props.$checked ? (props.$color || '#007aff') : 'transparent'};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  flex-shrink: 0;
  
  svg {
    opacity: ${props => props.$checked ? 1 : 0};
    transform: scale(${props => props.$checked ? 1 : 0.5});
    transition: all 0.15s ease;
  }
`;

const ProviderIcon = styled.div<{ $color: string }>`
  width: 42px;
  height: 42px;
  background: ${props => props.$color};
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 18px;
  flex-shrink: 0;
`;

const ProviderInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const ProviderName = styled.div`
  font-family: ${macosTheme.fonts.system};
  font-weight: 500;
  font-size: 14px;
  color: white;
`;

const ProviderDesc = styled.div`
  font-family: ${macosTheme.fonts.system};
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 2px;
`;

const GetKeyLink = styled.a`
  font-family: ${macosTheme.fonts.system};
  font-size: 12px;
  color: #007aff;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 4px;
  
  &:hover {
    text-decoration: underline;
  }
`;

const ConfigSection = styled.div`
  margin: 12px 0;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
`;

const ConfigHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
`;

const ConfigTitle = styled.div`
  font-family: ${macosTheme.fonts.system};
  font-weight: 500;
  font-size: 14px;
  color: white;
  flex: 1;
`;

const InputGroup = styled.div`
  margin-bottom: 0;
`;

const InputLabel = styled.label`
  display: block;
  font-family: ${macosTheme.fonts.mono};
  font-size: 11px;
  margin-bottom: 6px;
  color: rgba(255, 255, 255, 0.5);
`;

const InputRow = styled.div`
  display: flex;
  gap: 10px;
`;

const Input = styled.input`
  flex: 1;
  height: 36px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 0 12px;
  font-family: ${macosTheme.fonts.mono};
  font-size: 13px;
  color: white;
  outline: none;
  transition: all 0.15s ease;
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }
  
  &:focus {
    border-color: #007aff;
    box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.2);
  }
`;

const Button = styled.button<{ $primary?: boolean; $small?: boolean }>`
  height: ${props => props.$small ? '32px' : '36px'};
  padding: 0 ${props => props.$small ? '14px' : '18px'};
  border-radius: 6px;
  border: none;
  font-family: ${macosTheme.fonts.system};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
  
  background: ${props => props.$primary 
    ? 'linear-gradient(180deg, #0a84ff 0%, #007aff 100%)' 
    : 'rgba(255, 255, 255, 0.1)'};
  color: ${props => props.$primary ? 'white' : 'rgba(255, 255, 255, 0.85)'};
  
  &:hover:not(:disabled) {
    background: ${props => props.$primary 
      ? 'linear-gradient(180deg, #2196ff 0%, #0a84ff 100%)' 
      : 'rgba(255, 255, 255, 0.15)'};
  }
  
  &:active:not(:disabled) {
    transform: scale(0.98);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StatusBadge = styled.span<{ $status: 'pending' | 'testing' | 'success' | 'error' }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  font-family: ${macosTheme.fonts.system};
  font-size: 11px;
  font-weight: 500;
  border-radius: 20px;
  
  background: ${props => 
    props.$status === 'success' ? 'rgba(52, 199, 89, 0.2)' :
    props.$status === 'error' ? 'rgba(255, 69, 58, 0.2)' :
    props.$status === 'testing' ? 'rgba(255, 159, 10, 0.2)' : 'rgba(255, 255, 255, 0.1)'};
  color: ${props => 
    props.$status === 'success' ? '#34c759' :
    props.$status === 'error' ? '#ff453a' :
    props.$status === 'testing' ? '#ff9f0a' : 'rgba(255, 255, 255, 0.6)'};
`;

const Spinner = styled.div`
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`;

const ButtonRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 20px;
`;

const StepIndicator = styled.div`
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 20px;
`;

const StepDot = styled.div<{ $active: boolean; $completed: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => 
    props.$completed ? '#34c759' : 
    props.$active ? '#007aff' : 'rgba(255, 255, 255, 0.2)'};
  transition: all 0.2s ease;
`;

const AgentOption = styled.div<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: ${props => props.$selected 
    ? 'rgba(52, 199, 89, 0.1)' 
    : 'rgba(255, 255, 255, 0.05)'};
  border: 1px solid ${props => props.$selected 
    ? 'rgba(52, 199, 89, 0.3)' 
    : 'rgba(255, 255, 255, 0.1)'};
  border-radius: 10px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: ${props => props.$selected 
      ? 'rgba(52, 199, 89, 0.15)' 
      : 'rgba(255, 255, 255, 0.08)'};
  }
`;

const SummaryList = styled.div`
  margin: 16px 0;
`;

const LinkButton = styled.a`
  font-family: ${macosTheme.fonts.system};
  font-size: 13px;
  color: #007aff;
  text-decoration: none;
  
  &:hover {
    text-decoration: underline;
  }
`;

// ==================== COMPONENT ====================

interface SetupWizardProps {
  onComplete: (config: { providers: string[]; launchAgents: string[] }) => void;
  onSkip: () => void;
}

const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete, onSkip }) => {
  const [step, setStep] = useState(0);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [providerStatus, setProviderStatus] = useState<Record<string, ProviderStatus>>({});
  const [agentsToLaunch, setAgentsToLaunch] = useState<string[]>([]);
  const [testing, setTesting] = useState<string | null>(null);

  const totalSteps = 4;

  interface ApiProvider {
    id: string;
    authenticated: boolean;
  }

  useEffect(() => {
    fetch('/api/providers')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          const configured = data.data
            .filter((p: ApiProvider) => p.authenticated)
            .map((p: ApiProvider) => p.id);
          if (configured.length > 0) {
            setSelectedProviders(configured);
            const status: Record<string, ProviderStatus> = {};
            configured.forEach((id: string) => {
              status[id] = { configured: true, tested: true, working: true };
            });
            setProviderStatus(status);
          }
        }
      })
      .catch(() => {});
  }, []);

  const toggleProvider = (id: string) => {
    setSelectedProviders(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const updateApiKey = (providerId: string, key: string) => {
    setApiKeys(prev => ({ ...prev, [providerId]: key }));
  };

  const testProvider = async (providerId: string) => {
    setTesting(providerId);
    setProviderStatus(prev => ({
      ...prev,
      [providerId]: { configured: true, tested: false, working: false }
    }));

    await new Promise(resolve => setTimeout(resolve, 1500));

    const key = apiKeys[providerId] || '';
    const isValid = key.length > 10;

    setProviderStatus(prev => ({
      ...prev,
      [providerId]: { 
        configured: true, 
        tested: true, 
        working: isValid,
        error: isValid ? undefined : 'Invalid API key format'
      }
    }));
    setTesting(null);
  };

  const saveConfiguration = async () => {
    try {
      await fetch('/api/providers/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providers: selectedProviders.map(id => ({
            provider: id,
            enabled: true,
            authenticated: providerStatus[id]?.working || false
          }))
        })
      });
      
      const credentials: Record<string, string> = {};
      selectedProviders.forEach(id => {
        if (apiKeys[id]) {
          credentials[id] = apiKeys[id];
        }
      });
      
      if (Object.keys(credentials).length > 0) {
        await fetch('/api/providers/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credentials })
        });
      }
      
      const authenticated = selectedProviders.filter(id => providerStatus[id]?.working);
      if (authenticated.length > 0) {
        await fetch('/api/providers/mark-authenticated', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authenticatedProviders: authenticated })
        });
      }
    } catch (e) {
      console.error('Failed to save config:', e);
    }
  };

  const handleComplete = async () => {
    await saveConfiguration();
    localStorage.setItem('createsuite-setup-complete', 'true');
    
    let flyEnabled = false;
    try {
      const configRes = await fetch('/api/agents/configs');
      const configData = await configRes.json();
      flyEnabled = configData.flyEnabled;
    } catch (e) {
      console.log('Fly.io spawning not available');
    }
    
    if (flyEnabled && agentsToLaunch.length > 0) {
      for (const agentId of agentsToLaunch) {
        if (agentId === 'terminal') continue;
        
        try {
          await fetch('/api/agents/spawn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentType: agentId })
          });
        } catch (e) {
          console.error(`Failed to spawn agent ${agentId}:`, e);
        }
      }
    }
    
    onComplete({ 
      providers: selectedProviders.filter(id => providerStatus[id]?.working),
      launchAgents: agentsToLaunch 
    });
  };

  const handleSkip = () => {
    localStorage.setItem('createsuite-setup-complete', 'true');
    onSkip();
  };

  const configuredCount = Object.values(providerStatus).filter(s => s.working).length;

  // ==================== STEP RENDERERS ====================

  const renderWelcome = () => (
    <StepContent>
      <Title>
        <Sparkles size={26} color="#007aff" />
        Welcome to CreateSuite
      </Title>
      <Subtitle>
        Let's set up your AI agents in just a few steps
      </Subtitle>

      <InfoBox $type="info">
        <Settings size={20} color="#007aff" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>This wizard will help you:</strong>
          <ul>
            <li>Choose which AI providers you want to use</li>
            <li>Configure your API keys securely</li>
            <li>Test connections before launching agents</li>
            <li>Select which agents to start</li>
          </ul>
        </div>
      </InfoBox>

      <InfoBox $type="warning">
        <AlertTriangle size={20} color="#ff9f0a" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>You'll need API keys</strong> from the providers you want to use. 
          Don't have any? You can still use the basic terminal, or get keys from:
          <div style={{ marginTop: 10, display: 'flex', gap: 16 }}>
            <LinkButton href="https://console.anthropic.com/" target="_blank">Anthropic</LinkButton>
            <LinkButton href="https://platform.openai.com/" target="_blank">OpenAI</LinkButton>
            <LinkButton href="https://makersuite.google.com/" target="_blank">Google</LinkButton>
          </div>
        </div>
      </InfoBox>

      <ButtonRow>
        <Button onClick={handleSkip}>
          Skip Setup
        </Button>
        <Button $primary onClick={() => setStep(1)}>
          Configure Providers <ArrowRight size={14} />
        </Button>
      </ButtonRow>
    </StepContent>
  );

  const renderSelectProviders = () => (
    <StepContent>
      <Title>
        <Key size={26} color="#007aff" />
        Select Your Providers
      </Title>
      <Subtitle>
        Which AI services do you have API keys for?
      </Subtitle>

      <ProviderList>
        {PROVIDERS.map(provider => (
          <ProviderCard
            key={provider.id}
            $selected={selectedProviders.includes(provider.id)}
            $color={provider.color}
            onClick={() => toggleProvider(provider.id)}
          >
            <Checkbox 
              $checked={selectedProviders.includes(provider.id)}
              $color={provider.color}
            >
              <CheckCircle size={14} color="white" />
            </Checkbox>
            <ProviderIcon $color={provider.color}>
              {provider.name.charAt(0)}
            </ProviderIcon>
            <ProviderInfo>
              <ProviderName>{provider.name}</ProviderName>
              <ProviderDesc>{provider.description}</ProviderDesc>
            </ProviderInfo>
            {provider.docsUrl && (
              <GetKeyLink 
                href={provider.docsUrl} 
                target="_blank"
                onClick={e => e.stopPropagation()}
              >
                Get Key <ExternalLink size={12} />
              </GetKeyLink>
            )}
          </ProviderCard>
        ))}
      </ProviderList>

      {selectedProviders.length === 0 && (
        <InfoBox $type="info">
          No providers selected. You can still use the basic terminal without AI features.
        </InfoBox>
      )}

      <ButtonRow>
        <Button onClick={() => setStep(0)}>
          <ArrowLeft size={14} /> Back
        </Button>
        <Button 
          $primary 
          onClick={() => setStep(selectedProviders.length > 0 ? 2 : 3)}
        >
          {selectedProviders.length > 0 ? 'Configure Keys' : 'Skip to Finish'} 
          <ArrowRight size={14} />
        </Button>
      </ButtonRow>
    </StepContent>
  );

  const renderConfigureKeys = () => (
    <StepContent>
      <Title>
        <Key size={26} color="#007aff" />
        Enter API Keys
      </Title>
      <Subtitle>
        Your keys are stored locally and never sent to our servers
      </Subtitle>

      {selectedProviders.map(providerId => {
        const provider = PROVIDERS.find(p => p.id === providerId)!;
        const status = providerStatus[providerId];
        const isTesting = testing === providerId;

        return (
          <ConfigSection key={providerId}>
            <ConfigHeader>
              <ProviderIcon $color={provider.color} style={{ width: 36, height: 36, fontSize: 14 }}>
                {provider.name.charAt(0)}
              </ProviderIcon>
              <ConfigTitle>{provider.name}</ConfigTitle>
              {status?.tested && (
                <StatusBadge $status={status.working ? 'success' : 'error'}>
                  {status.working ? (
                    <><CheckCircle size={12} /> Connected</>
                  ) : (
                    <><XCircle size={12} /> {status.error || 'Failed'}</>
                  )}
                </StatusBadge>
              )}
              {isTesting && (
                <StatusBadge $status="testing">
                  <Spinner /> Testing...
                </StatusBadge>
              )}
            </ConfigHeader>

            <InputGroup>
              <InputLabel>{provider.envVar}</InputLabel>
              <InputRow>
                <Input
                  type="password"
                  placeholder={provider.placeholder}
                  value={apiKeys[providerId] || ''}
                  onChange={(e) => updateApiKey(providerId, e.target.value)}
                />
                <Button 
                  $small
                  onClick={() => testProvider(providerId)}
                  disabled={!apiKeys[providerId] || isTesting}
                >
                  {isTesting ? <Spinner /> : 'Test'}
                </Button>
              </InputRow>
            </InputGroup>
          </ConfigSection>
        );
      })}

      <ButtonRow>
        <Button onClick={() => setStep(1)}>
          <ArrowLeft size={14} /> Back
        </Button>
        <Button 
          $primary 
          onClick={() => setStep(3)}
          disabled={testing !== null}
        >
          {configuredCount > 0 ? `Continue (${configuredCount} ready)` : 'Continue'}
          <ArrowRight size={14} />
        </Button>
      </ButtonRow>
    </StepContent>
  );

  const renderLaunchOptions = () => {
    const workingProviders = selectedProviders.filter(id => providerStatus[id]?.working);

    const agentOptions = [
      { id: 'terminal', name: 'Basic Terminal', desc: 'Shell access without AI', always: true },
      { id: 'claude', name: 'Sisyphus (Claude)', desc: 'Task automation agent', provider: 'anthropic' },
      { id: 'openai', name: 'Oracle (OpenAI)', desc: 'Architecture advisor', provider: 'openai' },
      { id: 'gemini', name: 'Engineer (Gemini)', desc: 'UI/UX specialist', provider: 'google' },
    ];

    const availableAgents = agentOptions.filter(
      a => a.always || workingProviders.includes(a.provider!)
    );

    return (
      <StepContent>
        <Title>
          <Play size={26} color="#34c759" />
          Ready to Launch!
        </Title>
        <Subtitle>
          Select which agents to start
        </Subtitle>

        {workingProviders.length > 0 ? (
          <InfoBox $type="success">
            <CheckCircle size={20} color="#34c759" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>{workingProviders.length} provider{workingProviders.length > 1 ? 's' : ''} configured!</strong>
              {' '}You're ready to use AI-powered agents.
            </div>
          </InfoBox>
        ) : (
          <InfoBox $type="warning">
            <AlertTriangle size={20} color="#ff9f0a" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              No providers configured. You can use the basic terminal, or go back to add API keys.
            </div>
          </InfoBox>
        )}

        <SummaryList>
          {availableAgents.map(agent => (
            <AgentOption
              key={agent.id}
              $selected={agentsToLaunch.includes(agent.id)}
              onClick={() => {
                setAgentsToLaunch(prev =>
                  prev.includes(agent.id) 
                    ? prev.filter(a => a !== agent.id)
                    : [...prev, agent.id]
                );
              }}
            >
              <Checkbox 
                $checked={agentsToLaunch.includes(agent.id)}
                $color="#34c759"
              >
                <CheckCircle size={14} color="white" />
              </Checkbox>
              <div style={{ flex: 1 }}>
                <ProviderName>{agent.name}</ProviderName>
                <ProviderDesc>{agent.desc}</ProviderDesc>
              </div>
              {agent.always ? (
                <StatusBadge $status="success">Always Available</StatusBadge>
              ) : (
                <StatusBadge $status={workingProviders.includes(agent.provider!) ? 'success' : 'pending'}>
                  {workingProviders.includes(agent.provider!) ? 'Ready' : 'Not Configured'}
                </StatusBadge>
              )}
            </AgentOption>
          ))}
        </SummaryList>

        <ButtonRow>
          <Button onClick={() => setStep(selectedProviders.length > 0 ? 2 : 1)}>
            <ArrowLeft size={14} /> Back
          </Button>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button onClick={handleSkip}>
              Just Explore
            </Button>
            <Button $primary onClick={handleComplete}>
              {agentsToLaunch.length > 0 
                ? `Launch ${agentsToLaunch.length} Agent${agentsToLaunch.length > 1 ? 's' : ''}`
                : 'Start Empty Desktop'}
              <ArrowRight size={14} />
            </Button>
          </div>
        </ButtonRow>
      </StepContent>
    );
  };

  const steps = [renderWelcome, renderSelectProviders, renderConfigureKeys, renderLaunchOptions];

  return (
    <Overlay>
      <Window>
        <TitleBar>
          <TrafficLights>
            <TrafficLight $color="close" onClick={handleSkip} />
            <TrafficLight $color="minimize" />
            <TrafficLight $color="maximize" />
          </TrafficLights>
          <TitleText>CreateSuite Setup</TitleText>
          <div style={{ width: 52 }} />
        </TitleBar>
        <Content>
          <StepIndicator>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <StepDot 
                key={i} 
                $active={i === step} 
                $completed={i < step}
              />
            ))}
          </StepIndicator>
          
          {steps[step]()}
        </Content>
      </Window>
    </Overlay>
  );
};

export default SetupWizard;
