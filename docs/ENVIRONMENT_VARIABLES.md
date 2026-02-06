# Environment Variables Configuration

This document describes all environment variables used by CreateSuite for configuration.

## 🔐 Authentication & OAuth

### OAuth Configuration
```bash
# GitHub OAuth Application
OAUTH_CLIENT_ID=ghp_xxxxxxxxxxxxxxxxxxxx    # Required for GitHub integration
OAUTH_CLIENT_SECRET=xxxxxxxxxxxxxxxxx       # Optional for public clients
OAUTH_REDIRECT_PORT=8080                    # Port for OAuth callback server
OAUTH_SCOPES=repo,workflow,read:org,user:email  # Comma-separated OAuth scopes

# Alternative GitHub variables (fallback)
GITHUB_CLIENT_ID=ghp_xxxxxxxxxxxxxxxxxxxx   # Alternative to OAUTH_CLIENT_ID
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxx      # Alternative to OAUTH_CLIENT_SECRET
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx      # Personal access token
GITHUB_DEFAULT_BRANCH=main                 # Default branch for repositories
GITHUB_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxx    # For webhook validation
```

## 🤖 AI Provider Configuration

### OpenAI
```bash
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx  # OpenAI API key
OPENAI_BASE_URL=https://api.openai.com/v1   # Custom API endpoint (optional)
OPENAI_DEFAULT_MODEL=gpt-4                  # Default model to use
```

### Anthropic (Claude)
```bash
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxx  # Anthropic API key
ANTHROPIC_BASE_URL=https://api.anthropic.com   # Custom API endpoint (optional)
ANTHROPIC_DEFAULT_MODEL=claude-3-sonnet-20240229  # Default model to use
```

### Google (Gemini)
```bash
GOOGLE_API_KEY=xxxxxxxxxxxxxxxxxxxx         # Google AI API key
GEMINI_API_KEY=xxxxxxxxxxxxxxxxxxxx         # Alternative to GOOGLE_API_KEY
GOOGLE_DEFAULT_MODEL=gemini-pro             # Default model to use
```

## 🌐 Server Configuration

### Web Server
```bash
PORT=3001                                   # Server port
HOST=localhost                              # Server host
NODE_ENV=development                        # Environment: development|production|test
```

### CORS Configuration
```bash
CORS_ORIGIN=http://localhost:3000           # Allowed origins (comma-separated)
CORS_CREDENTIALS=true                       # Enable credentials in CORS
```

### Rate Limiting
```bash
RATE_LIMIT_WINDOW_MS=900000                 # Rate limit window (15 minutes)
RATE_LIMIT_MAX=100                          # Max requests per window
```

## 🤖 Agent Configuration

### Agent Behavior
```bash
DEFAULT_PROVIDER=openai                     # Default AI provider
MAX_CONCURRENT_AGENTS=5                     # Maximum concurrent agents
AGENT_TIMEOUT_MS=300000                     # Agent timeout (5 minutes)
```

## 📝 Logging Configuration

### Log Settings
```bash
LOG_LEVEL=info                              # error|warn|info|debug|trace
LOG_FORMAT=pretty                           # json|pretty
LOG_COLORS=true                             # Enable colored output
```

## ☁️ Fly.io Configuration

### Fly.io Deployment
```bash
FLY_API_TOKEN=xxxxxxxxxxxxxxxxx             # Fly.io API token
FLY_APP_NAME=createsuite                    # Fly.io application name
FLY_REGION=ord                              # Deployment region
FLY_CPU_KIND=shared                         # CPU type: shared|performance
FLY_CPUS=1                                  # Number of CPUs
FLY_MEMORY_MB=512                           # Memory allocation in MB
```

## 📁 File Paths & Storage

### Custom Paths
```bash
WORKSPACE_ROOT=/path/to/workspace           # Override workspace root
CONFIG_PATH=/path/to/config                 # Custom config directory
```

## 🔧 Development & Testing

### Development Mode
```bash
DEBUG=createsuite:*                         # Enable debug logging
VERBOSE=true                                # Verbose output
DEV_MODE=true                               # Enable development features
```

### Testing
```bash
TEST_TIMEOUT=30000                          # Test timeout in milliseconds
COVERAGE_THRESHOLD=70                       # Code coverage threshold
```

## 📋 Configuration Examples

### Minimal Setup (Development)
```bash
# .env.development
NODE_ENV=development
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
OAUTH_CLIENT_ID=ghp_xxxxxxxxxxxxxxxxxxxx
LOG_LEVEL=debug
```

### Production Setup
```bash
# .env.production
NODE_ENV=production
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxx
OAUTH_CLIENT_ID=ghp_xxxxxxxxxxxxxxxxxxxx
OAUTH_CLIENT_SECRET=xxxxxxxxxxxxxxxxx
FLY_API_TOKEN=xxxxxxxxxxxxxxxxx
LOG_LEVEL=info
LOG_FORMAT=json
```

### Full Feature Setup
```bash
# .env
NODE_ENV=development
LOG_LEVEL=info

# AI Providers
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxx
GOOGLE_API_KEY=xxxxxxxxxxxxxxxxxxxx
DEFAULT_PROVIDER=openai

# GitHub OAuth
OAUTH_CLIENT_ID=ghp_xxxxxxxxxxxxxxxxxxxx
OAUTH_CLIENT_SECRET=xxxxxxxxxxxxxxxxx
OAUTH_SCOPES=repo,workflow,read:org,user:email

# Server
PORT=3001
CORS_ORIGIN=http://localhost:3000,https://yourdomain.com

# Agents
MAX_CONCURRENT_AGENTS=10
AGENT_TIMEOUT_MS=600000

# Fly.io
FLY_API_TOKEN=xxxxxxxxxxxxxxxxx
FLY_APP_NAME=my-createsuite
FLY_REGION=ord
```

## 🚀 Quick Start

1. **Copy example configuration**:
   ```bash
   cp .env.example .env
   ```

2. **Set required variables**:
   ```bash
   # At minimum, you need:
   OPENAI_API_KEY=your-key-here
   OAUTH_CLIENT_ID=your-github-app-id
   ```

3. **Start the application**:
   ```bash
   npm run dev
   ```

## 🔍 Configuration Validation

CreateSuite validates your configuration on startup. Missing required variables will show helpful error messages:

```
Configuration validation failed:
- OAuth client ID is required. Set OAUTH_CLIENT_ID environment variable.
- At least one AI provider API key is required. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY.
```

## 🛡️ Security Notes

1. **Never commit `.env` files** to version control
2. **Use different configurations** for different environments
3. **Rotate API keys** regularly
4. **Use secure tokens** for production deployments
5. **Set restrictive CORS origins** in production

## 📚 Related Documentation

- [OAuth Setup Guide](./OAUTH_SETUP.md)
- [Provider Configuration](./PROVIDER_SETUP.md)
- [Deployment Guide](./DEPLOY.md)
- [Security Best Practices](./SECURITY.md)