const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const pty = require('node-pty');
const os = require('os');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const basicAuth = require('basic-auth');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { generateAllSprites } = require('./spriteGenerator');
const { LifecycleManager } = require('./lifecycleManager');
const { AgentSpawner, GitAgentSpawner, AGENT_CONFIGS } = require('./agentSpawner');
const { PipelineRunner } = require('./pipelineRunner');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const corsOrigin = process.env.CORS_ORIGIN || (isProduction ? false : '*');
const apiToken = process.env.API_TOKEN || '';
const basicAuthUser = process.env.BASIC_AUTH_USER || '';
const basicAuthPass = process.env.BASIC_AUTH_PASS || '';
app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST']
}));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

if (basicAuthUser && basicAuthPass) {
  app.use((req, res, next) => {
    const credentials = basicAuth(req);
    if (!credentials || credentials.name !== basicAuthUser || credentials.pass !== basicAuthPass) {
      res.set('WWW-Authenticate', 'Basic realm="CreateSuite"');
      return res.status(401).send('Authentication required');
    }
    return next();
  });
}

if (apiToken) {
  app.use('/api', (req, res, next) => {
    // Exempt agent callback routes from bearer token auth — agents don't have the token
    // and these endpoints are called from spawned agent processes to report status.
    const agentCallbackPaths = ['/api/agent/status', '/api/agent/complete', '/api/agent/fail'];
    if (agentCallbackPaths.some(p => req.path === p.replace('/api', '') || req.originalUrl.startsWith(p))) {
      return next();
    }
    const header = req.headers.authorization || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
    const token = bearer || req.query.token;
    if (token !== apiToken) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    return next();
  });
}

app.use('/api', limiter);

// Serve static files from the React app build directory
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Serve project workspace files (disabled by default in production)
const enableWorkspaceStatic = process.env.ENABLE_WORKSPACE_STATIC === 'true';
if (!isProduction || enableWorkspaceStatic) {
  app.use('/workspace', express.static(process.cwd()));
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST']
  }
});

// Initialize lifecycle manager for intelligent container management
const lifecycle = new LifecycleManager(io, server);
lifecycle.setupSignalHandlers();

// Initialize agent spawner for dynamic Fly.io machine spawning
const agentSpawner = new AgentSpawner(io);
const gitAgentSpawner = new GitAgentSpawner(io);

// Initialize pipeline runner for autonomous agent orchestration
const pipelineRunner = new PipelineRunner(io, gitAgentSpawner, process.cwd());

// Cleanup agents on shutdown
process.on('SIGTERM', async () => {
  await agentSpawner.cleanup();
});

if (apiToken) {
  io.use((socket, next) => {
    const authHeader = socket.handshake.headers?.authorization || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const token = bearer || socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token !== apiToken) {
      return next(new Error('Unauthorized'));
    }
    return next();
  });
}

const SHELL = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

// ==================== MONITORING API ENDPOINTS ====================

const generatedSprites = generateAllSprites();

// GET /api/skills - Return skills from agent-skills.json
app.get('/api/skills', (req, res) => {
  try {
    const skillsPath = path.join(process.cwd(), 'agent-skills.json');
    if (fs.existsSync(skillsPath)) {
      const skillsData = JSON.parse(fs.readFileSync(skillsPath, 'utf-8'));
      res.json({ success: true, data: skillsData.agentSkills, sprites: generatedSprites });
    } else {
      res.json({ success: false, error: 'agent-skills.json not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/tasks - List outstanding tasks from .createsuite/tasks
app.get('/api/tasks', (req, res) => {
  try {
    const tasksDir = path.join(process.cwd(), '.createsuite', 'tasks');
    const tasks = [];

    if (fs.existsSync(tasksDir)) {
      const taskFiles = fs.readdirSync(tasksDir).filter(f => f.endsWith('.json'));

      for (const file of taskFiles) {
        try {
          const taskData = JSON.parse(fs.readFileSync(path.join(tasksDir, file), 'utf-8'));
          // Only return tasks that are not completed
          if (taskData.status !== 'completed') {
            tasks.push({
              id: taskData.id,
              title: taskData.title,
              description: taskData.description,
              status: taskData.status,
              priority: taskData.priority,
              tags: taskData.tags || [],
              createdAt: taskData.createdAt
            });
          }
        } catch (e) {
          console.error(`Error reading task file ${file}:`, e);
        }
      }
    }

    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/providers - Get provider status (sleeping/active)
app.get('/api/providers', (req, res) => {
  try {
    const providersPath = path.join(process.cwd(), '.createsuite', 'providers.json');

    if (fs.existsSync(providersPath)) {
      const providersData = JSON.parse(fs.readFileSync(providersPath, 'utf-8'));

      // Track active providers by checking authentication status and credential files
      const credsPath = path.join(process.cwd(), '.createsuite', 'provider-credentials.json');
      let creds = {};
      if (fs.existsSync(credsPath)) {
        try { creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8')); } catch {}
      }

      const providers = (providersData.providers || []).map(p => ({
        id: p.provider,
        name: getProviderDisplayName(p.provider),
        model: p.model,
        enabled: p.enabled,
        authenticated: p.authenticated,
        status: (p.authenticated && creds[p.provider]) ? 'active' : 'sleeping'
      }));

      res.json({ success: true, data: providers });
    } else {
      // Return empty list if no config
      res.json({ success: true, data: [] });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/providers/save - Save selected providers from UI wizard
app.post('/api/providers/save', (req, res) => {
  try {
    const { providers, claudeTier } = req.body;
    if (!Array.isArray(providers)) {
      return res.status(400).json({ success: false, error: 'providers array required' });
    }

    const providersPath = path.join(process.cwd(), '.createsuite', 'providers.json');
    const providersDir = path.dirname(providersPath);
    if (!fs.existsSync(providersDir)) {
      fs.mkdirSync(providersDir, { recursive: true });
    }

    let existing = [];
    if (fs.existsSync(providersPath)) {
      try {
        const existingData = JSON.parse(fs.readFileSync(providersPath, 'utf-8'));
        existing = existingData.providers || [];
      } catch {
        existing = [];
      }
    }

    const existingByProvider = new Map(existing.map((p) => [p.provider, p]));
    const claudeModel = claudeTier === 'Max (20x mode)'
      ? 'anthropic/claude-sonnet-4-20250514'
      : 'anthropic/claude-sonnet-4-20250514';

    const modelMap = {
      'zai-coding-plan': 'anthropic/claude-sonnet-4-20250514',
      'anthropic': claudeModel,
      'openai': 'openai/gpt-4o',
      'minimax': 'minimax/minimax-01',
      'google': 'google/gemini-2.0-flash',
      'github-copilot': 'github-copilot/claude-sonnet-4-20250514',
      'opencode-zen': 'opencode/claude-sonnet-4-20250514',
      'huggingface': 'huggingface/stable-diffusion-xl-base-1.0'
    };

    const updatedProviders = providers.map((provider) => {
      const existingProvider = existingByProvider.get(provider);
      return {
        provider,
        enabled: true,
        authenticated: existingProvider?.authenticated || false,
        model: modelMap[provider] || existingProvider?.model,
        lastValidated: existingProvider?.lastValidated || undefined
      };
    });

    fs.writeFileSync(providersPath, JSON.stringify({
      providers: updatedProviders,
      updatedAt: new Date().toISOString()
    }, null, 2));

    res.json({ success: true, data: updatedProviders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/providers/credentials - Save credentials securely
app.post('/api/providers/credentials', (req, res) => {
  try {
    const { credentials } = req.body;
    if (!credentials || typeof credentials !== 'object') {
      return res.status(400).json({ success: false, error: 'credentials object required' });
    }

    const credPath = path.join(process.cwd(), '.createsuite', 'provider-credentials.json');
    const credDir = path.dirname(credPath);
    if (!fs.existsSync(credDir)) {
      fs.mkdirSync(credDir, { recursive: true });
    }

    let existing = {};
    if (fs.existsSync(credPath)) {
      try {
        existing = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
      } catch {
        existing = {};
      }
    }

    const updated = { ...existing };
    Object.entries(credentials).forEach(([provider, value]) => {
      if (typeof value === 'string' && value.trim().length > 0) {
        updated[provider] = {
          value: value.trim(),
          updatedAt: new Date().toISOString()
        };
      }
    });

    fs.writeFileSync(credPath, JSON.stringify(updated, null, 2), { mode: 0o600 });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/providers/mark-authenticated - Update auth status
app.post('/api/providers/mark-authenticated', (req, res) => {
  try {
    const { authenticatedProviders } = req.body;
    if (!Array.isArray(authenticatedProviders)) {
      return res.status(400).json({ success: false, error: 'authenticatedProviders array required' });
    }

    const providersPath = path.join(process.cwd(), '.createsuite', 'providers.json');
    if (!fs.existsSync(providersPath)) {
      return res.status(200).json({ success: true, data: [] });
    }

    const config = JSON.parse(fs.readFileSync(providersPath, 'utf-8'));
    const updatedProviders = (config.providers || []).map((provider) => {
      if (authenticatedProviders.includes(provider.provider)) {
        return {
          ...provider,
          authenticated: true,
          lastValidated: new Date().toISOString()
        };
      }
      return {
        ...provider,
        authenticated: false
      };
    });

    fs.writeFileSync(providersPath, JSON.stringify({
      providers: updatedProviders,
      updatedAt: new Date().toISOString()
    }, null, 2));

    res.json({ success: true, data: updatedProviders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/activate - Activate a provider with a task
app.post('/api/activate', async (req, res) => {
  try {
    const { providerId, taskId, skillName } = req.body;

    if (!providerId || !taskId || !skillName) {
      return res.status(400).json({ success: false, error: 'Missing required fields: providerId, taskId, skillName' });
    }

    // Spawn an agent for this provider/skill/task combination
    console.log(`Activating provider ${providerId} with skill ${skillName} for task ${taskId}`);

    // Determine agent type from provider ID
    const providerToAgent = {
      'zai-coding-plan': 'zai',
      'anthropic': 'claude',
      'openai': 'openai',
      'google': 'gemini',
      'huggingface': 'huggingface'
    };
    const agentType = providerToAgent[providerId] || 'zai';

    // Look up API key from stored credentials
    const credsFile = path.join(process.cwd(), '.createsuite', 'provider-credentials.json');
    let apiKey = '';
    if (fs.existsSync(credsFile)) {
      try {
        const allCreds = JSON.parse(fs.readFileSync(credsFile, 'utf-8'));
        apiKey = allCreds[providerId] || '';
      } catch {}
    }

    // If we have an agent spawner and API token, spawn a Fly.io machine
    if (agentSpawner && apiKey) {
      try {
        const agentInfo = await agentSpawner.spawnForTask({
          agentType,
          apiKey,
          repoUrl: req.body.repoUrl || process.env.REPO_URL,
          githubToken: req.body.githubToken || process.env.GITHUB_TOKEN,
          taskDescription: `${skillName}: ${taskId}`,
          id: taskId
        });
        res.json({
          success: true,
          message: `Agent spawned for ${providerId}`,
          data: { ...agentInfo, activatedAt: new Date().toISOString() }
        });
        return;
      } catch (spawnErr) {
        console.error('Agent spawn failed:', spawnErr.message);
        // Fall through to return basic success
      }
    }

    res.json({
      success: true,
      message: `Provider ${providerId} activated with skill ${skillName} for task ${taskId}`,
      data: {
        providerId,
        taskId,
        skillName,
        activatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to get provider display name
function getProviderDisplayName(provider) {
  const names = {
    'zai-coding-plan': 'Z.ai (Anthropic)',
    'anthropic': 'Claude Sonnet 4',
    'openai': 'OpenAI GPT-4o',
    'minimax': 'MiniMax',
    'google': 'Google Gemini 2.0 Flash',
    'github-copilot': 'GitHub Copilot',
    'opencode-zen': 'OpenCode Zen',
    'huggingface': 'Hugging Face Inference'
  };
  return names[provider] || provider;
}

// ==================== HEALTH CHECK ENDPOINT ====================

// GET /api/health - Health check for Fly.io and monitoring
app.get('/api/health', (req, res) => {
  const status = lifecycle.getStatus();
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: status.uptime,
    uptimeFormatted: status.uptimeFormatted,
    sessionCount: status.sessionCount,
    lifecycleStatus: status.status,
    memoryUsage: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// ==================== LIFECYCLE CONTROL API ====================

// GET /api/lifecycle/status - Get detailed lifecycle status
app.get('/api/lifecycle/status', (req, res) => {
  res.json({ success: true, data: lifecycle.getStatus() });
});

// POST /api/lifecycle/hold - Keep container alive (prevent auto-shutdown)
app.post('/api/lifecycle/hold', (req, res) => {
  try {
    const { durationMinutes = 60, reason = 'Agent requested hold' } = req.body;
    const durationMs = durationMinutes * 60 * 1000;
    
    const result = lifecycle.hold(durationMs, reason);
    
    res.json({
      success: true,
      message: `Container held until ${new Date(result.holdUntil).toISOString()}`,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/lifecycle/release - Release hold early
app.post('/api/lifecycle/release', (req, res) => {
  try {
    const released = lifecycle.releaseHold();
    
    if (released) {
      res.json({ success: true, message: 'Hold released' });
    } else {
      res.json({ success: false, message: 'Container was not being held' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/lifecycle/extend - Extend grace period
app.post('/api/lifecycle/extend', (req, res) => {
  try {
    const { additionalMinutes = 15 } = req.body;
    const additionalMs = additionalMinutes * 60 * 1000;
    
    const result = lifecycle.extendGracePeriod(additionalMs);
    
    res.json({
      success: result.success,
      message: result.success 
        ? `Grace period extended by ${additionalMinutes} minutes`
        : result.reason,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/lifecycle/shutdown - Request graceful shutdown
app.post('/api/lifecycle/shutdown', (req, res) => {
  try {
    const { force = false, reason = 'Agent requested shutdown' } = req.body;
    
    res.json({ 
      success: true, 
      message: force ? 'Force shutdown initiated' : 'Graceful shutdown initiated'
    });
    
    // Execute after response
    setImmediate(() => {
      if (force) {
        lifecycle.forceShutdown(reason);
      } else {
        lifecycle.gracefulShutdown(reason);
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/lifecycle/restart - Request container restart
app.post('/api/lifecycle/restart', (req, res) => {
  try {
    const { reason = 'Agent requested restart' } = req.body;
    
    res.json({ success: true, message: 'Restart initiated' });
    
    // Execute after response
    setImmediate(() => {
      lifecycle.restart(reason);
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/lifecycle/rebuild - Request container rebuild and redeploy
app.post('/api/lifecycle/rebuild', (req, res) => {
  try {
    const { 
      branch = 'main', 
      commitSha = null, 
      reason = 'Agent requested rebuild' 
    } = req.body;
    
    res.json({ 
      success: true, 
      message: `Rebuild initiated from branch: ${branch}`,
      data: { branch, commitSha, reason }
    });
    
    // Execute after response
    setImmediate(() => {
      lifecycle.rebuild({ branch, commitSha, reason });
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/lifecycle/sessions - Get active terminal sessions
app.get('/api/lifecycle/sessions', (req, res) => {
  res.json({ success: true, data: lifecycle.getSessions() });
});

// POST /api/lifecycle/webhook/test - Test webhook notification
app.post('/api/lifecycle/webhook/test', async (req, res) => {
  try {
    const { event = 'test', data = {} } = req.body;
    await lifecycle.sendWebhook(event, { 
      ...data, 
      test: true, 
      message: 'This is a test notification from CreateSuite' 
    });
    res.json({ success: true, message: 'Webhook test sent' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/lifecycle/notify - Send custom notification
app.post('/api/lifecycle/notify', async (req, res) => {
  try {
    const { event, message, resultsUrl } = req.body;
    if (!event || !message) {
      return res.status(400).json({ success: false, error: 'event and message required' });
    }
    
    await lifecycle.sendWebhook(event, { reason: message, resultsUrl });
    
    // Also emit to connected clients
    lifecycle.io.emit(`lifecycle:${event}`, { message, resultsUrl });
    
    res.json({ success: true, message: 'Notification sent' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== AGENT CALLBACK API ====================
// These endpoints are called BY agents (running in Fly.io or locally)
// to report their status back to the pipeline runner.

// POST /api/agent/status — agent heartbeat / progress update
app.post('/api/agent/status', (req, res) => {
  try {
    const { agentId, taskId, status, message } = req.body;
    if (!agentId) {
      return res.status(400).json({ success: false, error: 'agentId required' });
    }

    pipelineRunner.agentHeartbeat(agentId, { taskId, status, message });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/agent/complete — agent reports task completion
app.post('/api/agent/complete', (req, res) => {
  try {
    const { agentId, taskId, commitHash, branch } = req.body;
    if (!agentId) {
      return res.status(400).json({ success: false, error: 'agentId required' });
    }

    const found = pipelineRunner.agentComplete(agentId, { taskId, commitHash, branch });
    res.json({ success: true, found });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/agent/fail — agent reports task failure
app.post('/api/agent/fail', (req, res) => {
  try {
    const { agentId, taskId, error: agentError } = req.body;
    if (!agentId) {
      return res.status(400).json({ success: false, error: 'agentId required' });
    }

    const found = pipelineRunner.agentFail(agentId, { taskId, error: agentError });
    res.json({ success: true, found });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== PIPELINE API ====================
// API-driven pipeline triggering — no CLI required.
// Call POST /api/pipeline/start and the agents do the rest.

// POST /api/pipeline/start — kick off a new pipeline
app.post('/api/pipeline/start', async (req, res) => {
  try {
    const { repoUrl, goal, provider, model, githubToken, maxAgents, agentType } = req.body;

    if (!repoUrl || !goal) {
      return res.status(400).json({ success: false, error: 'repoUrl and goal are required' });
    }

    const result = await pipelineRunner.startPipeline({
      repoUrl,
      goal,
      provider,
      model,
      githubToken: githubToken || process.env.GITHUB_TOKEN,
      maxAgents: maxAgents || 3,
      agentType: agentType || 'claude'
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/pipeline/status/:id — get pipeline status
app.get('/api/pipeline/status/:id', (req, res) => {
  const pipeline = pipelineRunner.getPipeline(req.params.id);
  if (!pipeline) {
    return res.status(404).json({ success: false, error: 'Pipeline not found' });
  }
  res.json({ success: true, data: pipeline });
});

// GET /api/pipeline/list — list all pipelines
app.get('/api/pipeline/list', (req, res) => {
  const pipelines = pipelineRunner.listPipelines();
  res.json({ success: true, data: pipelines });
});

// ==================== AGENT SPAWNING API ====================

// GET /api/agents/configs - Get available agent configurations
app.get('/api/agents/configs', (req, res) => {
  res.json({ 
    success: true, 
    data: agentSpawner.getAgentConfigs(),
    flyEnabled: !!process.env.FLY_API_TOKEN
  });
});

// GET /api/agents/active - List currently running agents
app.get('/api/agents/active', (req, res) => {
  res.json({ 
    success: true, 
    data: agentSpawner.getActiveAgents()
  });
});

// POST /api/agents/spawn - Spawn a new agent machine
app.post('/api/agents/spawn', async (req, res) => {
  try {
    const { agentType, apiKey, options = {} } = req.body;
    
    if (!agentType) {
      return res.status(400).json({ success: false, error: 'agentType required' });
    }
    
    // Get API key from request or from stored credentials
    let effectiveApiKey = apiKey;
    if (!effectiveApiKey) {
      const credPath = path.join(process.cwd(), '.createsuite', 'provider-credentials.json');
      if (fs.existsSync(credPath)) {
        try {
          const creds = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
          const providerMapping = {
            claude: 'anthropic',
            openai: 'openai', 
            gemini: 'google',
            huggingface: 'huggingface'
          };
          const provider = providerMapping[agentType] || agentType;
          effectiveApiKey = creds[provider]?.value;
        } catch (e) {
          console.error('Error reading credentials:', e);
        }
      }
    }
    
    if (!effectiveApiKey) {
      return res.status(400).json({ 
        success: false, 
        error: `No API key found for ${agentType}. Configure in Setup Wizard or provide apiKey.` 
      });
    }
    
    const agent = await agentSpawner.spawnAgent(agentType, effectiveApiKey, options);
    
    res.json({ success: true, data: agent });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/agents/spawn-for-task - Spawn an agent for a specific GitHub task
app.post('/api/agents/spawn-for-task', async (req, res) => {
  try {
    const { agentType, repoUrl, taskDescription, githubToken } = req.body;
    
    if (!repoUrl || !taskDescription) {
      return res.status(400).json({ 
        success: false, 
        error: 'repoUrl and taskDescription required' 
      });
    }
    
    // Get API key from stored credentials
    const credPath = path.join(process.cwd(), '.createsuite', 'provider-credentials.json');
    let apiKey = null;
    if (fs.existsSync(credPath)) {
      try {
        const creds = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
        const providerMapping = { claude: 'anthropic', openai: 'openai', gemini: 'google' };
        const provider = providerMapping[agentType || 'claude'] || 'anthropic';
        apiKey = creds[provider]?.value;
      } catch (e) {
        console.error('Error reading credentials:', e);
      }
    }
    
    if (!apiKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'No API key configured. Use Setup Wizard first.' 
      });
    }
    
    const agent = await gitAgentSpawner.spawnForTask({
      agentType: agentType || 'claude',
      apiKey,
      repoUrl,
      taskDescription,
      githubToken: githubToken || process.env.GITHUB_TOKEN
    });
    
    res.json({ success: true, data: agent });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/agents/stop - Stop an agent
app.post('/api/agents/stop', async (req, res) => {
  try {
    const { agentId } = req.body;
    
    if (!agentId) {
      return res.status(400).json({ success: false, error: 'agentId required' });
    }
    
    await agentSpawner.stopAgent(agentId);
    
    res.json({ success: true, message: `Agent ${agentId} stopped` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/agents/stop-all - Stop all running agents
app.post('/api/agents/stop-all', async (req, res) => {
  try {
    await agentSpawner.cleanup();
    res.json({ success: true, message: 'All agents stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== OPENCODE SETUP ====================

// Check for opencode
try {
  const opencodePath = execSync('which opencode', { encoding: 'utf-8' }).trim();
  console.log('Found opencode at:', opencodePath);
} catch (e) {
  console.warn('⚠️  Warning: opencode command not found in PATH. Agents may not start correctly.');
}

const enablePty = process.env.ENABLE_PTY === 'true';
io.on('connection', (socket) => {
  console.log('Client connected', socket.id);
  
  let ptyProcess = null;
  const sessionId = socket.id;

  // Send current lifecycle status on connect
  socket.emit('lifecycle:status', lifecycle.getStatus());

  socket.on('spawn', ({ cols, rows, agentId, taskId }) => {
    if (isProduction && !enablePty) {
      socket.emit('output', '\r\nPTY disabled on this deployment. Set ENABLE_PTY=true to enable.\r\n');
      return;
    }
    
    // Kill existing PTY if any
    if (ptyProcess) {
      lifecycle.unregisterSession(sessionId);
      ptyProcess.kill();
    }

    console.log(`Spawning shell: ${SHELL}`);

    // Spawn the shell. In a real scenario, this might be 'opencode' directly
    // or a shell that has opencode in the path.
    // We add '-l' to bash to make it a login shell and load .bashrc/.profile
    const args = SHELL === 'bash' ? ['-l'] : [];

    try {
      ptyProcess = pty.spawn(SHELL, args, {
        name: 'xterm-color',
        cols: cols || 80,
        rows: rows || 30,
        cwd: process.env.HOME,
        env: {
            ...process.env,
            // Inject helper function for UI commands
            // usage: echo ":::UI_CMD:::{\"type\":\"image\",\"src\":\"path.png\"}"
            CREATESUITE_SESSION_ID: sessionId,
            CREATESUITE_AGENT_ID: agentId || '',
            CREATESUITE_TASK_ID: taskId || ''
        }
      });
      
      // Register session with lifecycle manager
      lifecycle.registerSession(sessionId, ptyProcess, { agentId, taskId });
      
    } catch (err) {
      console.error('Failed to spawn pty:', err);
      return;
    }

    ptyProcess.onData((data) => {
      socket.emit('output', data);
      
      // Update session activity
      lifecycle.touchSession(sessionId);
      
      // Simple parsing for UI commands
      // Look for :::UI_CMD:::{JSON}:::
      const cmdRegex = /:::UI_CMD:::({.+?})(?:::)?/g;
      let match;
      while ((match = cmdRegex.exec(data)) !== null) {
          try {
              const payload = JSON.parse(match[1]);
              socket.emit('ui-command', payload);
          } catch (e) {
              console.error('Failed to parse UI command:', e);
          }
      }
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`PTY exited with code ${exitCode} and signal ${signal}`);
      socket.emit('exit', { exitCode, signal });
      
      // Unregister session when PTY exits
      lifecycle.unregisterSession(sessionId);
      ptyProcess = null;
    });
  });

  socket.on('input', (data) => {
    if (ptyProcess) {
      lifecycle.touchSession(sessionId);
      ptyProcess.write(data);
    }
  });

  socket.on('resize', ({ cols, rows }) => {
    if (ptyProcess) {
      ptyProcess.resize(cols, rows);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
    if (ptyProcess) {
      lifecycle.unregisterSession(sessionId);
      ptyProcess.kill();
    }
  });
});

// Handle client-side routing, return all requests to React app
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Lifecycle management: ${process.env.AUTO_SHUTDOWN !== 'false' ? 'enabled' : 'disabled'}`);
  console.log(`Grace period: ${(parseInt(process.env.GRACE_PERIOD_MS) || 15 * 60 * 1000) / 60000} minutes`);
  
  // Start completion checks after server is ready
  lifecycle.startCompletionChecks();
});
