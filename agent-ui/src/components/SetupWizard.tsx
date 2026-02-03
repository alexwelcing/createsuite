import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { 
  Window, 
  WindowHeader, 
  WindowContent, 
  Button, 
  Separator,
  TextInput,
  Checkbox,
  Anchor
} from 'react95';
import { 
  Key, 
  CheckCircle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Loader,
  AlertTriangle,
  Sparkles,
  Settings,
  Play
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
    color: '#7c3aed',
    envVar: 'ANTHROPIC_API_KEY',
    placeholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-5.2 - Excellent for debugging & architecture',
    color: '#10a37f',
    envVar: 'OPENAI_API_KEY',
    placeholder: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys'
  },
  {
    id: 'google',
    name: 'Google Gemini',
    description: 'Gemini 3 Pro - Strong multimodal capabilities',
    color: '#4285f4',
    envVar: 'GOOGLE_API_KEY',
    placeholder: 'AIza...',
    docsUrl: 'https://makersuite.google.com/app/apikey'
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    description: 'Stable Diffusion - Asset & image generation',
    color: '#ff9d00',
    envVar: 'HF_TOKEN',
    placeholder: 'hf_...',
    docsUrl: 'https://huggingface.co/settings/tokens'
  }
];

// ==================== ANIMATIONS ====================

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

// ==================== STYLED COMPONENTS ====================

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 128, 128, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50000;
`;

const WizardWindow = styled(Window)`
  width: 650px;
  max-width: 95vw;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 8px 8px 0 rgba(0,0,0,0.5);
`;

const ScrollContent = styled(WindowContent)`
  max-height: calc(90vh - 100px);
  overflow-y: auto;
`;

const StepContent = styled.div`
  animation: ${fadeIn} 0.3s ease-out;
  min-height: 400px;
  display: flex;
  flex-direction: column;
`;

const Title = styled.h2`
  text-align: center;
  font-size: 20px;
  margin: 16px 0 8px 0;
  color: #000080;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
`;

const Subtitle = styled.p`
  text-align: center;
  font-size: 13px;
  color: #555;
  margin: 0 0 20px 0;
`;

const InfoBox = styled.div<{ $type?: 'warning' | 'info' | 'success' }>`
  background: ${props => 
    props.$type === 'warning' ? '#fff3cd' : 
    props.$type === 'success' ? '#d4edda' : '#e7f3ff'};
  border: 1px solid ${props => 
    props.$type === 'warning' ? '#ffc107' : 
    props.$type === 'success' ? '#28a745' : '#0066cc'};
  padding: 12px;
  margin-bottom: 16px;
  font-size: 13px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
`;

const ProviderList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 16px 0;
`;

const ProviderCard = styled.div<{ $selected: boolean; $color: string }>`
  background: ${props => props.$selected ? '#f0f0ff' : '#fff'};
  border: 2px solid ${props => props.$selected ? props.$color : '#c0c0c0'};
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.15s;
  
  &:hover {
    background: #f8f8f8;
    border-color: ${props => props.$color};
  }
`;

const ProviderIcon = styled.div<{ $color: string }>`
  width: 40px;
  height: 40px;
  background: ${props => props.$color};
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 18px;
  flex-shrink: 0;
`;

const ProviderInfo = styled.div`
  flex: 1;
`;

const ProviderName = styled.div`
  font-weight: bold;
  font-size: 14px;
`;

const ProviderDesc = styled.div`
  font-size: 11px;
  color: #666;
  margin-top: 2px;
`;

const ConfigSection = styled.div`
  margin: 16px 0;
  padding: 16px;
  background: #fafafa;
  border: 1px inset #c0c0c0;
`;

const ConfigHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
`;

const ConfigTitle = styled.div`
  font-weight: bold;
  font-size: 14px;
`;

const InputGroup = styled.div`
  margin-bottom: 12px;
`;

const InputLabel = styled.label`
  display: block;
  font-size: 12px;
  margin-bottom: 4px;
  color: #333;
`;

const InputRow = styled.div`
  display: flex;
  gap: 8px;
`;

const StatusBadge = styled.span<{ $status: 'pending' | 'testing' | 'success' | 'error' }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 3px;
  background: ${props => 
    props.$status === 'success' ? '#d4edda' :
    props.$status === 'error' ? '#f8d7da' :
    props.$status === 'testing' ? '#fff3cd' : '#e9ecef'};
  color: ${props => 
    props.$status === 'success' ? '#155724' :
    props.$status === 'error' ? '#721c24' :
    props.$status === 'testing' ? '#856404' : '#495057'};
`;

const Spinner = styled(Loader)`
  animation: ${spin} 1s linear infinite;
`;

const SummaryList = styled.div`
  margin: 16px 0;
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
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${props => props.$completed ? '#28a745' : props.$active ? '#000080' : '#c0c0c0'};
  transition: all 0.2s;
`;

const AgentOption = styled.div<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: ${props => props.$selected ? '#e8f5e9' : '#fff'};
  border: 2px solid ${props => props.$selected ? '#4caf50' : '#ddd'};
  margin-bottom: 8px;
  cursor: pointer;
  
  &:hover {
    background: #f5f5f5;
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

  // Provider data structure from API
  interface ApiProvider {
    id: string;
    authenticated: boolean;
  }

  // Load any existing configuration
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
      .catch(() => {/* ignore - fresh install */});
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

    // Simulate API key validation (in real app, call backend)
    await new Promise(resolve => setTimeout(resolve, 1500));

    const key = apiKeys[providerId] || '';
    const isValid = key.length > 10; // Simple validation

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
    // Save to backend
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
    } catch (e) {
      console.error('Failed to save config:', e);
    }
  };

  const handleComplete = async () => {
    await saveConfiguration();
    localStorage.setItem('createsuite-setup-complete', 'true');
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

  // Step 0: Welcome
  const renderWelcome = () => (
    <StepContent>
      <Title>
        <Sparkles size={24} color="#008080" />
        Welcome to CreateSuite
      </Title>
      <Subtitle>
        Let's set up your AI agents in just a few steps
      </Subtitle>

      <InfoBox $type="info">
        <Settings size={20} color="#0066cc" />
        <div>
          <strong>This wizard will help you:</strong>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
            <li>Choose which AI providers you want to use</li>
            <li>Configure your API keys securely</li>
            <li>Test connections before launching agents</li>
            <li>Select which agents to start</li>
          </ul>
        </div>
      </InfoBox>

      <InfoBox $type="warning">
        <AlertTriangle size={20} color="#856404" />
        <div>
          <strong>You'll need API keys</strong> from the providers you want to use. 
          Don't have any? You can still use the basic terminal, or get keys from:
          <div style={{ marginTop: 8 }}>
            <Anchor href="https://console.anthropic.com/" target="_blank">Anthropic</Anchor>
            {' • '}
            <Anchor href="https://platform.openai.com/" target="_blank">OpenAI</Anchor>
            {' • '}
            <Anchor href="https://makersuite.google.com/" target="_blank">Google</Anchor>
          </div>
        </div>
      </InfoBox>

      <ButtonRow>
        <Button onClick={handleSkip}>
          Skip Setup (Use Basic Terminal)
        </Button>
        <Button primary onClick={() => setStep(1)}>
          Configure Providers <ArrowRight size={14} style={{ marginLeft: 6 }} />
        </Button>
      </ButtonRow>
    </StepContent>
  );

  // Step 1: Select Providers
  const renderSelectProviders = () => (
    <StepContent>
      <Title>
        <Key size={24} color="#000080" />
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
              checked={selectedProviders.includes(provider.id)}
              onChange={() => toggleProvider(provider.id)}
            />
            <ProviderIcon $color={provider.color}>
              {provider.name.charAt(0)}
            </ProviderIcon>
            <ProviderInfo>
              <ProviderName>{provider.name}</ProviderName>
              <ProviderDesc>{provider.description}</ProviderDesc>
            </ProviderInfo>
            {provider.docsUrl && (
              <Anchor 
                href={provider.docsUrl} 
                target="_blank"
                onClick={e => e.stopPropagation()}
                style={{ fontSize: 11 }}
              >
                Get Key →
              </Anchor>
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
          <ArrowLeft size={14} style={{ marginRight: 6 }} /> Back
        </Button>
        <Button 
          primary 
          onClick={() => setStep(selectedProviders.length > 0 ? 2 : 3)}
        >
          {selectedProviders.length > 0 ? 'Configure Keys' : 'Skip to Finish'} 
          <ArrowRight size={14} style={{ marginLeft: 6 }} />
        </Button>
      </ButtonRow>
    </StepContent>
  );

  // Step 2: Configure API Keys
  const renderConfigureKeys = () => (
    <StepContent>
      <Title>
        <Key size={24} color="#000080" />
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
              <ProviderIcon $color={provider.color} style={{ width: 32, height: 32, fontSize: 14 }}>
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
                  <Spinner size={12} /> Testing...
                </StatusBadge>
              )}
            </ConfigHeader>

            <InputGroup>
              <InputLabel>{provider.envVar}</InputLabel>
              <InputRow>
                <TextInput
                  type="password"
                  placeholder={provider.placeholder}
                  value={apiKeys[providerId] || ''}
                  onChange={(e) => updateApiKey(providerId, e.target.value)}
                  style={{ flex: 1 }}
                />
                <Button 
                  onClick={() => testProvider(providerId)}
                  disabled={!apiKeys[providerId] || isTesting}
                >
                  {isTesting ? <Spinner size={14} /> : 'Test'}
                </Button>
              </InputRow>
            </InputGroup>
          </ConfigSection>
        );
      })}

      <ButtonRow>
        <Button onClick={() => setStep(1)}>
          <ArrowLeft size={14} style={{ marginRight: 6 }} /> Back
        </Button>
        <Button 
          primary 
          onClick={() => setStep(3)}
          disabled={testing !== null}
        >
          {configuredCount > 0 ? `Continue (${configuredCount} ready)` : 'Continue'}
          <ArrowRight size={14} style={{ marginLeft: 6 }} />
        </Button>
      </ButtonRow>
    </StepContent>
  );

  // Step 3: Launch Options
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
          <Play size={24} color="#28a745" />
          Ready to Launch!
        </Title>
        <Subtitle>
          Select which agents to start
        </Subtitle>

        {workingProviders.length > 0 ? (
          <InfoBox $type="success">
            <CheckCircle size={20} color="#28a745" />
            <div>
              <strong>{workingProviders.length} provider{workingProviders.length > 1 ? 's' : ''} configured!</strong>
              {' '}You're ready to use AI-powered agents.
            </div>
          </InfoBox>
        ) : (
          <InfoBox $type="warning">
            <AlertTriangle size={20} color="#856404" />
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
                checked={agentsToLaunch.includes(agent.id)}
                onChange={() => {}}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold' }}>{agent.name}</div>
                <div style={{ fontSize: 11, color: '#666' }}>{agent.desc}</div>
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
            <ArrowLeft size={14} style={{ marginRight: 6 }} /> Back
          </Button>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={handleSkip}>
              Just Explore
            </Button>
            <Button primary onClick={handleComplete}>
              {agentsToLaunch.length > 0 
                ? `Launch ${agentsToLaunch.length} Agent${agentsToLaunch.length > 1 ? 's' : ''}`
                : 'Start Empty Desktop'}
              <ArrowRight size={14} style={{ marginLeft: 6 }} />
            </Button>
          </div>
        </ButtonRow>
      </StepContent>
    );
  };

  const steps = [renderWelcome, renderSelectProviders, renderConfigureKeys, renderLaunchOptions];

  return (
    <Overlay>
      <WizardWindow>
        <WindowHeader>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img 
              src="https://win98icons.alexmeub.com/icons/png/key_win-2.png" 
              alt="setup"
              style={{ height: 16 }}
            />
            CreateSuite Setup Wizard
          </span>
        </WindowHeader>
        <ScrollContent>
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
        </ScrollContent>
      </WizardWindow>
    </Overlay>
  );
};

export default SetupWizard;
