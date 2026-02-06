#!/usr/bin/env bash
set -euo pipefail

# CreateSuite Production Deploy Script
# Deploys the agent-ui to Fly.io and configures secrets for dogfooding.
#
# Prerequisites:
#   1. flyctl installed: curl -L https://fly.io/install.sh | sh
#   2. Authenticated: fly auth login
#   3. API keys ready for at least one provider
#
# Usage:
#   ./scripts/deploy-production.sh              # Deploy to Fly.io
#   ./scripts/deploy-production.sh --secrets    # Set secrets only
#   ./scripts/deploy-production.sh --trigger    # Trigger dogfood pipeline

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
AGENT_UI_DIR="$ROOT_DIR/agent-ui"
FLY_APP_NAME="${FLY_APP_NAME:-createsuite-agent-ui}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[deploy]${NC} $1"; }
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }

# ── Check prerequisites ──
check_prereqs() {
  if ! command -v fly &> /dev/null; then
    err "flyctl not found. Install: curl -L https://fly.io/install.sh | sh"
    exit 1
  fi
  ok "flyctl found"

  if ! fly auth whoami &>/dev/null; then
    err "Not authenticated. Run: fly auth login"
    exit 1
  fi
  ok "Fly.io authenticated as $(fly auth whoami 2>/dev/null)"
}

# ── Set secrets ──
set_secrets() {
  log "Configuring Fly.io secrets for $FLY_APP_NAME..."

  local secrets_to_set=()

  # GitHub Token
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    secrets_to_set+=("GITHUB_TOKEN=$GITHUB_TOKEN")
    ok "GITHUB_TOKEN ready"
  else
    warn "GITHUB_TOKEN not set — agents won't be able to push or create PRs"
  fi

  # Fly API token for spawning agent machines
  if [ -n "${FLY_API_TOKEN:-}" ]; then
    secrets_to_set+=("FLY_API_TOKEN=$FLY_API_TOKEN")
    ok "FLY_API_TOKEN ready (remote agent spawning enabled)"
  else
    warn "FLY_API_TOKEN not set — agents will run locally only"
  fi

  # API token for endpoint auth
  if [ -n "${API_TOKEN:-}" ]; then
    secrets_to_set+=("API_TOKEN=$API_TOKEN")
    ok "API_TOKEN ready"
  else
    warn "API_TOKEN not set — API endpoints will be unauthenticated"
  fi

  # Anthropic
  if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    secrets_to_set+=("ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY")
    ok "ANTHROPIC_API_KEY ready"
  fi

  # OpenAI
  if [ -n "${OPENAI_API_KEY:-}" ]; then
    secrets_to_set+=("OPENAI_API_KEY=$OPENAI_API_KEY")
    ok "OPENAI_API_KEY ready"
  fi

  # Google
  if [ -n "${GOOGLE_API_KEY:-}" ]; then
    secrets_to_set+=("GOOGLE_API_KEY=$GOOGLE_API_KEY")
    ok "GOOGLE_API_KEY ready"
  fi

  if [ ${#secrets_to_set[@]} -gt 0 ]; then
    fly secrets set "${secrets_to_set[@]}" --app "$FLY_APP_NAME" 2>/dev/null
    ok "Secrets configured (${#secrets_to_set[@]} values)"
  else
    warn "No secrets to set. Export env vars first (GITHUB_TOKEN, ANTHROPIC_API_KEY, etc.)"
  fi
}

# ── Deploy ──
deploy() {
  log "Deploying $FLY_APP_NAME from $AGENT_UI_DIR..."

  cd "$AGENT_UI_DIR"

  # Check if app exists, create if not
  if ! fly apps list 2>/dev/null | grep -q "$FLY_APP_NAME"; then
    log "Creating Fly.io app: $FLY_APP_NAME"
    fly apps create "$FLY_APP_NAME" --org personal 2>/dev/null || true
  fi

  # Deploy
  fly deploy \
    --app "$FLY_APP_NAME" \
    --remote-only \
    --strategy rolling \
    --wait-timeout 300

  ok "Deployed to https://$FLY_APP_NAME.fly.dev"

  # Verify health
  log "Verifying health..."
  sleep 5
  if curl -sf "https://$FLY_APP_NAME.fly.dev/api/health" > /dev/null 2>&1; then
    ok "Health check passed"
  else
    warn "Health check didn't respond — the machine may still be starting"
  fi
}

# ── Trigger dogfood pipeline ──
trigger_dogfood() {
  local base_url="https://$FLY_APP_NAME.fly.dev"
  local auth_header=""
  if [ -n "${API_TOKEN:-}" ]; then
    auth_header="-H \"Authorization: Bearer $API_TOKEN\""
  fi

  log "Triggering dogfood pipeline on $base_url..."

  local response
  response=$(curl -sf -X POST "$base_url/api/pipeline/start" \
    -H "Content-Type: application/json" \
    ${API_TOKEN:+-H "Authorization: Bearer $API_TOKEN"} \
    -d '{
      "repoUrl": "https://github.com/awelcing-alm/createsuite",
      "goal": "Add unit test coverage for core modules, fix the OAuth placeholder and hardcoded values, set up CI/CD pipeline, and polish the dashboard UI with real metrics",
      "maxAgents": 4,
      "agentType": "claude"
    }' 2>&1)

  if echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Pipeline {d[\"data\"][\"pipelineId\"]} started (phase: {d[\"data\"][\"phase\"]})')"; then
    ok "Dogfood pipeline triggered!"
    echo ""
    echo "  Monitor at: $base_url"
    echo "  Status API: $base_url/api/pipeline/list"
  else
    err "Failed to trigger pipeline: $response"
  fi
}

# ── Main ──
case "${1:-deploy}" in
  --secrets)
    check_prereqs
    set_secrets
    ;;
  --trigger)
    trigger_dogfood
    ;;
  --full)
    check_prereqs
    set_secrets
    deploy
    trigger_dogfood
    ;;
  *)
    check_prereqs
    set_secrets
    deploy
    ;;
esac
