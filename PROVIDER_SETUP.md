# Provider Setup Guide

This guide walks you through setting up AI model providers for CreateSuite agents using OpenCode and oh-my-opencode.

## Overview

CreateSuite integrates with [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode), a powerful OpenCode plugin that provides:

- **Multi-model orchestration** - Use different models for different tasks
- **Parallel agent execution** - Run multiple agents simultaneously
- **Advanced LSP/AST tools** - Precise code refactoring
- **Claude Code compatibility** - Full hook system and skills
- **Curated MCPs** - Built-in web search, documentation, and code search

## Supported Providers

CreateSuite supports the following AI model providers via coding plans:

### 🔷 Z.ai GLM 4.7
- **Models**: GLM 4.7, GLM 4.7 Flash
- **Best for**: Librarian agent (documentation and code search)
- **Setup**: Via Z.ai coding plan dashboard

### 🟣 Claude (Anthropic)
- **Models**: Claude Opus 4.5, Claude Sonnet 4.5
- **Tiers**: Pro, Max (20x mode)
- **Best for**: Main orchestrator (Sisyphus agent)
- **Setup**: OAuth via Claude Pro/Max subscription

### 🟢 OpenAI
- **Models**: GPT-5.2, GPT-5 Nano
- **Best for**: Oracle agent (debugging and architecture)
- **Setup**: API key via coding plan

### 🔵 MiniMax 2.1
- **Models**: MiniMax 2.1
- **Best for**: Specialized tasks
- **Setup**: MiniMax API credentials

### 🔴 Google Gemini
- **Models**: Gemini 3 Pro, Gemini 3 Flash
- **Setup**: Antigravity OAuth (requires opencode-antigravity-auth plugin)
- **Best for**: Frontend UI/UX Engineer, Multimodal Looker

### 🐙 GitHub Copilot (Fallback)
- **Models**: Claude Opus 4.5, GPT-5.2 (via proxy)
- **Priority**: Used when native providers are unavailable
- **Setup**: GitHub OAuth

### 🧘 OpenCode Zen
- **Models**: opencode/claude-opus-4.5, opencode/gpt-5.2
- **Priority**: Used when Copilot and native providers unavailable
- **Setup**: Automatic if you have access

## Quick Start

### 1. Install CreateSuite

```bash
npm install -g createsuite
# or
npm install
npm link
```

### 2. Initialize Workspace

```bash
cs init --name my-project --git
```

The init command will prompt you to set up providers. Say yes!

### 3. Run Provider Setup

If you skipped setup during init, run:

```bash
cs provider setup
```

This interactive wizard will:

1. ✅ Check if OpenCode is installed
2. ✅ Check if oh-my-opencode is configured
3. ✅ Ask about your provider subscriptions
4. ✅ Configure provider settings
5. ✅ Guide you through authentication

### 4. Authenticate Providers

After setup, authenticate your providers:

```bash
cs provider auth
```

Or authenticate during the setup wizard when prompted.

## Detailed Setup Instructions

### Prerequisites

1. **Install OpenCode**

   Visit [https://opencode.ai/docs](https://opencode.ai/docs) and follow the installation instructions for your platform.

   Verify installation:
   ```bash
   opencode --version
   ```

2. **Install oh-my-opencode**

   Run the installer:
   ```bash
   bunx oh-my-opencode install
   # or
   npx oh-my-opencode install
   ```

   This will:
   - Register the plugin in your OpenCode config
   - Configure default agents (Sisyphus, Oracle, Librarian, Explore)
   - Set up MCPs (websearch, context7, grep_app)

### Provider-Specific Setup

#### Z.ai GLM 4.7

1. Ensure you have a Z.ai coding plan subscription
2. Visit your Z.ai dashboard and configure API access
3. Run: `opencode auth login`
4. Select Provider: Z.ai
5. Enter your credentials

**Agent Assignment**:
- Librarian agent always uses `zai-coding-plan/glm-4.7`

#### Claude Opus & Sonnet 4.5

1. Subscribe to Claude Pro or Max
2. Run the setup wizard: `cs provider setup`
3. Select Claude access
4. Choose tier (Pro or Max 20x mode)
5. Authenticate:
   ```bash
   opencode auth login
   ```
6. Select Provider: Anthropic
7. Select Login method: Claude Pro/Max
8. Complete OAuth flow in browser

**Agent Assignment**:
- Sisyphus (main agent) uses Opus 4.5 High

#### OpenAI

1. Ensure you have OpenAI API access via coding plan
2. Run: `opencode auth login`
3. Select Provider: OpenAI
4. Enter your API key

**Agent Assignment**:
- Oracle agent (debugging) uses GPT-5.2 Medium

#### Google Gemini (Antigravity)

1. Install the Antigravity auth plugin:
   ```bash
   npm install -g opencode-antigravity-auth
   ```

2. Add to OpenCode config (`~/.config/opencode/opencode.json`):
   ```json
   {
     "plugin": [
       "oh-my-opencode",
       "opencode-antigravity-auth@latest"
     ]
   }
   ```

3. Configure models as per [opencode-antigravity-auth docs](https://github.com/NoeFabris/opencode-antigravity-auth)

4. Authenticate:
   ```bash
   opencode auth login
   ```
5. Select Provider: Google
6. Select: OAuth with Google (Antigravity)
7. Complete sign-in in browser

**Agent Assignment**:
- Frontend Engineer uses Gemini 3 Pro
- Multimodal Looker uses Gemini 3 Flash

#### GitHub Copilot

1. Ensure you have GitHub Copilot subscription
2. Run: `opencode auth login`
3. Select Provider: GitHub
4. Complete OAuth flow

**Usage**: Automatically used as fallback when native providers unavailable

#### MiniMax 2.1

1. Obtain MiniMax API credentials
2. Configure via OpenCode or direct API key setup

## Managing Providers

### List Configured Providers

```bash
cs provider list
```

Shows all configured providers with:
- Display name
- Model
- Authentication status
- Last validation time

### Re-authenticate

If authentication expires or fails:

```bash
cs provider auth
```

### Check Status

```bash
cs oauth --status
```

## Agent Model Priority

oh-my-opencode assigns models based on provider priority:

**Priority**: Native (anthropic/, openai/, google/) > GitHub Copilot > OpenCode Zen > Z.ai Coding Plan

### Default Assignments (with native providers)

| Agent | Model | Provider |
|-------|-------|----------|
| Sisyphus (Main) | Claude Opus 4.5 High | Anthropic |
| Oracle (Debug) | GPT-5.2 Medium | OpenAI |
| Librarian (Docs) | GLM 4.7 | Z.ai (if available) or Claude Sonnet 4.5 |
| Explore (Search) | Grok Code | OpenCode Zen (if available) |
| Frontend Engineer | Gemini 3 Pro | Google |
| Multimodal Looker | Gemini 3 Flash | Google |

### Fallback to GitHub Copilot

When native providers aren't available:

| Agent | Model |
|-------|-------|
| Sisyphus | github-copilot/claude-opus-4.5 |
| Oracle | github-copilot/gpt-5.2 |
| Explore | opencode/gpt-5-nano |
| Librarian | zai-coding-plan/glm-4.7 (if available) |

## Customizing Agent Models

You can override agent models in `.opencode/oh-my-opencode.json`:

```json
{
  "agents": {
    "sisyphus": {
      "model": "anthropic/claude-opus-4.5",
      "variant": "max20"
    },
    "oracle": {
      "model": "openai/gpt-5.2",
      "temperature": 0.3
    },
    "librarian": {
      "model": "zai-coding-plan/glm-4.7"
    }
  }
}
```

## Troubleshooting

### OpenCode Not Found

```bash
# Check if OpenCode is installed
which opencode

# If not, visit: https://opencode.ai/docs
```

### oh-my-opencode Not Configured

```bash
# Check OpenCode config
cat ~/.config/opencode/opencode.json

# Should contain "oh-my-opencode" in plugin array
# If not, run:
bunx oh-my-opencode install
```

### Authentication Failures

```bash
# Clear credentials and re-authenticate
opencode auth logout
opencode auth login

# Or for specific provider
cs provider auth
```

### Model Not Available

- Check your subscription status
- Verify provider is authenticated
- Check provider priority (native > Copilot > Zen > Z.ai)
- Review oh-my-opencode logs

### Rate Limits

oh-my-opencode handles rate limits automatically by:
- Queuing requests
- Switching to fallback providers
- Using multi-account load balancing (Gemini)

## Best Practices

1. **Use Native Providers**: Native (anthropic/, openai/, google/) providers offer best performance
2. **Configure All Providers**: Set up multiple providers for redundancy
3. **Monitor Usage**: Track provider costs via their dashboards
4. **Keep Updated**: Run `npm update oh-my-opencode` periodically
5. **Test Authentication**: Run `cs provider list` to verify status

## Advanced Configuration

### Background Tasks

Configure concurrency limits in `oh-my-opencode.json`:

```json
{
  "background_tasks": {
    "max_concurrent_tasks_per_provider": 3,
    "max_concurrent_tasks_per_model": 2
  }
}
```

### Agent Permissions

Control what agents can do:

```json
{
  "agents": {
    "oracle": {
      "permissions": {
        "edit_files": false,
        "run_commands": true,
        "web_search": true
      }
    }
  }
}
```

### Hooks

Customize behavior with hooks:

```json
{
  "hooks": {
    "disabled_hooks": [
      "comment_checker",
      "todo_enforcer"
    ]
  }
}
```

## Resources

- [oh-my-opencode Documentation](https://github.com/code-yeongyu/oh-my-opencode)
- [OpenCode Documentation](https://opencode.ai/docs)
- [oh-my-opencode Configuration Guide](https://github.com/code-yeongyu/oh-my-opencode/blob/master/docs/configurations.md)
- [CreateSuite GitHub](https://github.com/awelcing-alm/createsuite)

## Getting Help

- CreateSuite Issues: [GitHub Issues](https://github.com/awelcing-alm/createsuite/issues)
- oh-my-opencode Discord: [Join Discord](https://discord.gg/PUwSMR9XNk)
- OpenCode Support: [OpenCode Docs](https://opencode.ai/docs)
