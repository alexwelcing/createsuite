# Draft: KICKOFF_PROJECT Execution Plan

## Project Understanding

**CreateSuite** is an orchestrated swarm system for OpenCode agents with git-based task tracking.

### Tech Stack
- TypeScript + Node.js
- Commander.js (CLI)
- Remotion v4.0.410 (video generation)
- simple-git (git operations)
- oh-my-opencode 3.1.3 (AI provider orchestration)

### Core Architecture
| Component | Purpose |
|-----------|---------|
| ConfigManager | Workspace configuration & persistence |
| TaskManager | Task lifecycle (cs-xxxxx IDs) |
| AgentOrchestrator | Agent management (UUID IDs) |
| ConvoyManager | Task grouping (cs-cv-xxxxx IDs) |
| GitIntegration | Git-backed persistence |
| ProviderManager | AI model provider configuration |

### Provider Status (from .createsuite/providers.json)
| Provider | Status | Model |
|----------|--------|-------|
| Z.ai GLM 4.7 | ✅ Authenticated | zai-coding-plan/glm-4.7 |
| Claude Opus 4.5 | ✅ Authenticated | anthropic/claude-opus-4.5 |
| OpenAI GPT-5.2 | ✅ Authenticated | openai/gpt-5.2 |
| MiniMax 2.1 | ✅ Authenticated | minimax/minimax-2.1 |
| Google Gemini 3 Pro | ⚠️ Not authenticated | google/gemini-3-pro |
| GitHub Copilot | ⚠️ Not authenticated | github-copilot/claude-opus-4.5 |

### How to Test Providers
```bash
cs provider list          # See all configured providers
cs provider auth          # Authenticate providers
cs provider setup         # Re-run setup wizard
```

### Remotion Video Tooling
```bash
npm run remotion:preview   # Preview in Remotion Studio (browser)
npm run video:build        # Build tour video to public/tour.mp4
cs video                   # CLI wrapper for video build
cs video --preview         # CLI wrapper for preview
```

**Video Specs:** 30s, 1920x1080, 30fps, MP4 H.264

### KICKOFF_PROJECT.md Summary
- **10 phases** over 8-10 weeks (~520 hours total)
- **Goal:** Transform CreateSuite from prototype to production-ready

| Phase | Focus | Priority | Est. Hours |
|-------|-------|----------|------------|
| 1 | Foundation & Testing | Critical | 80 |
| 2 | Developer Experience | High | 60 |
| 3 | Code Quality & Standards | High | 40 |
| 4 | Provider Excellence | High | 50 |
| 5 | Visual & Marketing Polish | Medium | 70 |
| 6 | Advanced Features | Medium | 90 |
| 7 | Security & Reliability | Critical | 60 |
| 8 | Performance & Scale | Medium | 40 |
| 9 | Release Preparation | Critical | 30 |
| 10 | Community & Growth | High | Ongoing |

### CONVOY_EXAMPLES.md Structure
- 10 convoy definitions matching each phase
- Each convoy has:
  - CLI commands to create tasks
  - Success criteria
  - Agent assignment recommendations

---

## Google Cloud OAuth Investigation

### Current Status
- **User authenticated**: Yes (via gcloud, ultra plan)
- **gcloud status**: `gcloud auth list` shows "gcloud not configured" in this environment
  - User's authenticated session is likely in a different shell/environment
- **CreateSuite provider status**: Google gemini-3-pro is **enabled but NOT authenticated**
- **Google Cloud ADC**: Not found in `~/.config/google-cloud/`

### CreateSuite's Gemini Authentication
Current implementation (lines 485-506 of providerManager.ts):
```typescript
private async authenticateGemini(): Promise<void> {
  console.log(chalk.gray('Setting up Gemini Antigravity authentication...'));
  console.log(chalk.yellow('\nSteps:'));
  console.log(chalk.gray('  1. Install: npm install -g opencode-antigravity-auth'));
  console.log(chalk.gray('  2. Add to opencode.json plugin array'));
  console.log(chalk.gray('  3. Run: opencode auth login'));
  console.log(chalk.gray('  4. Select Provider: Google'));
  console.log(chalk.gray('  5. Select: OAuth with Google (Antigravity)'));
  // User confirms completion
}
```

**Issue**: This is just INSTRUCTIONS, not actual integration.

### oh-my-opencode + Antigravity Flow
From research findings:
- **Plugin**: `opencode-google-antigravity-auth`
- **Storage**: `~/.local/share/opencode/antigravity-accounts.json`
- **Integration**: Add to `~/.config/opencode/opencode.json`:
  ```json
  {
    "plugin": ["oh-my-opencode", "opencode-google-antigravity-auth"]
  }
  ```
- **Models available**:
  - `google/gemini-3-pro-preview` (Antigravity)
  - `google/gemini-3-flash` (Antigravity)
  - `google/gemini-claude-sonnet-4.5-thinking` (Claude via Antigravity)

### The Problem
**CreateSuite doesn't know about oh-my-opencode's stored Google OAuth tokens**. It expects a separate CreateSuite OAuth flow.

### Possible Solutions

#### Solution 1: Use oh-my-opencode's Antigravity OAuth (RECOMMENDED)
1. Install Antigravity plugin:
   ```bash
   npm install -g opencode-google-antigravity-auth
   ```
2. Add to oh-my-opencode config:
   ```bash
   # Edit ~/.config/opencode/opencode.json
   # Add "opencode-google-antigravity-auth" to plugin array
   ```
3. Run OpenCode auth:
   ```bash
   opencode auth login
   # Select: Google
   # Select: OAuth with Google (Antigravity)
   # Complete OAuth flow in browser
   ```
4. Mark as authenticated in CreateSuite:
   ```bash
   cs provider auth
   # When prompted, confirm completion
   ```

**Pros**: Uses your existing gcloud session, integrates with oh-my-opencode
**Cons**: Requires re-authentication if gcloud session isn't in same shell

#### Solution 2: Read oh-my-opencode's tokens
Modify CreateSuite to read from oh-my-opencode's token storage:
- Source: `~/.local/share/opencode/antigravity-accounts.json`
- Update `ProviderManager.authenticateGemini()` to check this file
- Mark provider as authenticated if valid token exists

**Pros**: No re-authentication needed
**Cons**: Requires code changes to ProviderManager

#### Solution 3: GOOGLE_APPLICATION_CREDENTIALS (Alternative)
If you have a service account key:
1. Export path:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
   ```
2. Configure oh-my-opencode to use ADC
3. Use models via `google/gemini-3-pro` prefix

**Pros**: Production-ready, supports service accounts
**Cons**: Requires service account creation (different from user OAuth)

---

## User's Stated Requirements
1. Get acclimated to project ✓
2. Identify how to start/test providers ✓
3. Undertake KICKOFF_PROJECT.md work
4. Document work using REMOTION tooling
5. Go through convoy examples
6. **NEW**: Use existing Google Cloud OAuth (Ultra plan) for Gemini 3 Pro

---

*Last Updated: Added Google Cloud OAuth investigation and solutions*
