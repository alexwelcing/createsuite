# Agent Dashboard Guide

**Your command center for orchestrating AI agents on Fly.io**

The Agent Dashboard provides a polished, intuitive interface for spawning, managing, and monitoring AI agents that run on dedicated Fly.io machines. Each agent operates in its own isolated container with pre-configured AI models and capabilities.

## 🚀 Quick Start

### Accessing the Dashboard

1. Launch the Agent UI:
   ```bash
   npm run dev
   ```

2. Click **"Agents"** in the menu bar
3. Select **"🤖 Agent Dashboard"**

### Prerequisites

The Agent Dashboard requires:
- **FLY_API_TOKEN**: Set in your environment to enable agent spawning
- **Provider API Keys**: Configure in the Setup Wizard (OpenAI, Anthropic, Google, Hugging Face)

If FLY_API_TOKEN is not configured, you'll see a warning banner and spawning will be disabled.

## 🤖 Available Agent Types

The dashboard displays four pre-configured agent types:

### 1. **Sisyphus (Claude Opus 4.5)**
- **Provider**: Anthropic
- **Model**: claude-opus-4.5
- **Best For**: Complex coding tasks, task automation, and advanced reasoning
- **Color**: Purple (#7c3aed)

### 2. **Oracle (GPT-5.2)**
- **Provider**: OpenAI
- **Model**: gpt-5.2
- **Best For**: Architecture advice, debugging, and system design
- **Color**: Green (#10a37f)

### 3. **Engineer (Gemini 3 Pro)**
- **Provider**: Google
- **Model**: gemini-3-pro
- **Best For**: UI/UX work, multimodal tasks, and creative problem-solving
- **Color**: Blue (#4285f4)

### 4. **Artisan (Stable Diffusion)**
- **Provider**: Hugging Face
- **Model**: stable-diffusion-3.5-large
- **Best For**: Asset generation, image creation, and visual content
- **Color**: Orange (#ff9d00)

## 📋 Using the Dashboard

### Spawning an Agent

1. **Click an agent card** to spawn that agent type
2. The dashboard will:
   - Create a new Fly.io machine
   - Install OpenCode CLI
   - Configure provider-specific API keys
   - Establish WebSocket connection to UI
   - Start the agent

3. **Monitor progress**:
   - During spawning: Card shows "Spawning..." with spinner
   - After ~30-60s: Agent appears in "Active Agents" section

### Monitoring Active Agents

The "Active Agents" section shows:
- **Agent Name**: E.g., "Sisyphus", "Oracle"
- **Status Badge**: 
  - 🟢 **running**: Agent is operational
  - 🟡 **starting**: Agent is initializing
  - 🔴 **error**: Agent encountered an error
- **Machine ID**: Fly.io machine identifier
- **Uptime**: How long the agent has been running

### Stopping an Agent

1. Find the agent in the "Active Agents" list
2. Click the **"Stop"** button
3. The agent machine will be stopped and destroyed

## 🏗️ Architecture

### How Agent Spawning Works

```
┌─────────────────────────────────────────────────────────────┐
│                      Fly.io App                             │
│  ┌──────────────────┐                                       │
│  │   UI Machine     │ ◄──── createsuite-agent-ui.fly.dev  │
│  │  (React + API)   │                                       │
│  └────────┬─────────┘                                       │
│           │ Fly Machines API                                │
│           ▼                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐│
│  │  Claude Agent    │  │  OpenAI Agent    │  │  Gemini    ││
│  │  (Machine 1)     │  │  (Machine 2)     │  │  Agent     ││
│  │  ANTHROPIC_KEY   │  │  OPENAI_KEY      │  │  GOOGLE_KEY││
│  └──────────────────┘  └──────────────────┘  └────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Agent Machine Configuration

Each spawned agent runs with:

```typescript
{
  image: "registry.fly.io/createsuite-agent-ui:latest",
  env: {
    AGENT_ID: "uuid",
    AGENT_TYPE: "claude|openai|gemini|huggingface",
    AGENT_NAME: "Sisyphus|Oracle|Engineer|Artisan",
    OPENCODE_PROVIDER: "anthropic|openai|google|huggingface",
    OPENCODE_MODEL: "model-identifier",
    [PROVIDER_API_KEY]: "key-value",
    UI_WEBSOCKET_URL: "wss://your-app.fly.dev",
    AGENT_MODE: "worker"
  },
  guest: {
    cpus: 1,
    memory_mb: 1024
  },
  auto_destroy: true  // Destroy when stopped
}
```

## 🔧 Configuration

### Setting Up FLY_API_TOKEN

1. **Get your token** from Fly.io dashboard:
   ```bash
   fly tokens create
   ```

2. **Set in environment**:
   ```bash
   export FLY_API_TOKEN="your-token-here"
   ```

3. **For production deployment**, set as a secret:
   ```bash
   fly secrets set FLY_API_TOKEN="your-token-here"
   ```

### Configuring Provider API Keys

Use the Setup Wizard to configure provider credentials:

1. Click through the welcome flow
2. Select providers you want to enable
3. Enter API keys for each provider:
   - **Anthropic**: Get from https://console.anthropic.com/
   - **OpenAI**: Get from https://platform.openai.com/api-keys
   - **Google**: Get from https://makersuite.google.com/app/apikey
   - **Hugging Face**: Get from https://huggingface.co/settings/tokens

4. Keys are securely stored in `.createsuite/provider-credentials.json`

## 🎯 Use Cases

### 1. Parallel Task Execution

Spawn multiple agents to work on different tasks simultaneously:

```
1. Spawn "Sisyphus" → Implement backend API
2. Spawn "Engineer" → Design UI components
3. Spawn "Artisan" → Generate assets and icons
```

### 2. Specialized Workflows

Use specific agents for their strengths:

```
Architecture Review: Oracle (GPT-5.2)
Code Implementation: Sisyphus (Claude)
UI Polish: Engineer (Gemini)
Asset Generation: Artisan (Stable Diffusion)
```

### 3. Development Pipeline

Create a full development flow:

```
1. Oracle: Design system architecture
2. Sisyphus: Implement core features
3. Engineer: Build user interface
4. Artisan: Create marketing materials
```

## 📊 Dashboard Features

### Visual Indicators

- **Color Coding**: Each agent has a unique color for quick identification
- **Status Badges**: Real-time status updates (running, starting, error)
- **Uptime Display**: See how long each agent has been running
- **Machine ID**: Track specific Fly.io machines

### Auto-Refresh

The dashboard automatically refreshes every 5 seconds to show:
- Newly spawned agents
- Status changes
- Agent terminations

### Error Handling

If spawning fails:
- Alert shows error message
- Check console for detailed logs
- Common issues:
  - No FLY_API_TOKEN configured
  - No API key for selected provider
  - Fly.io quota or resource limits
  - Network connectivity issues

## 🔒 Security Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** for sensitive data
3. **Rotate keys regularly** in provider dashboards
4. **Set appropriate Fly.io secrets** for production
5. **Monitor agent activity** for unexpected behavior

## 🐛 Troubleshooting

### "Agent spawning requires FLY_API_TOKEN"

**Solution**: Set the FLY_API_TOKEN environment variable:
```bash
export FLY_API_TOKEN="your-token-here"
```

### "No API key found for [agent type]"

**Solution**: Configure the provider in the Setup Wizard:
1. Restart the UI
2. Complete the Setup Wizard
3. Enter the missing API key

### Agent stuck in "starting" status

**Solution**: 
1. Check Fly.io dashboard for machine status
2. View machine logs: `fly logs -a createsuite-agent-ui`
3. Ensure image is built and pushed: `fly deploy`

### Agent spawning is slow

**Expected**: First spawn takes 30-60s as Fly.io creates the machine.
Subsequent spawns may be faster if machines are cached.

## 🚀 Advanced Usage

### API Integration

Access the Agent Dashboard programmatically:

```typescript
// Get agent configurations
GET /api/agents/configs

// List active agents
GET /api/agents/active

// Spawn an agent
POST /api/agents/spawn
{
  "agentType": "claude",
  "apiKey": "optional-override",
  "options": {
    "githubToken": "token",
    "repoUrl": "repo-url",
    "taskId": "task-id"
  }
}

// Stop an agent
POST /api/agents/stop
{
  "agentId": "agent-uuid"
}
```

### Git-Based Task Spawning

Spawn an agent for a specific GitHub task:

```typescript
POST /api/agents/spawn-for-task
{
  "agentType": "claude",
  "repoUrl": "https://github.com/user/repo",
  "taskDescription": "Implement login feature",
  "githubToken": "github-pat"
}
```

The agent will:
1. Clone the repository
2. Create a working branch
3. Execute the task with OpenCode
4. Commit changes
5. Open a pull request
6. Self-terminate

## 📚 Related Documentation

- [Main README](../../README.md) - Project overview
- [Deployment Guide](./DEPLOY_RENDER.md) - Deploying to production
- [Architecture](../architecture/ARCHITECTURE.md) - System design
- [Provider Setup](../providers/PROVIDER_SETUP.md) - Configuring AI providers

## 🎉 Next Steps

1. ✅ Configure FLY_API_TOKEN
2. ✅ Complete Setup Wizard
3. ✅ Open Agent Dashboard
4. ✅ Spawn your first agent
5. ✅ Monitor agent activity
6. ✅ Build amazing things! 🚀
