#!/usr/bin/env bash
set -euo pipefail

# ===================================================
# CreateSuite — Production Dogfood Deployment Script
# ===================================================
# Deploys the agent-ui to Fly.io and triggers a dogfood pipeline run.
#
# Prerequisites:
#   1. `fly` CLI installed and authenticated
#   2. `FLY_API_TOKEN` env var (or run `fly auth token`)
#   3. At least one AI provider API key (ANTHROPIC_API_KEY recommended)
#   4. GITHUB_TOKEN with `repo` scope
#
# Usage:
#   ./scripts/deploy-dogfood.sh [deploy|trigger|status|full]
#
#   deploy   — Build & deploy to Fly.io only
#   trigger  — Trigger the dogfood pipeline on the running instance
#   status   — Check pipeline status
#   full     — Deploy, set secrets, trigger pipeline

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_NAME="${FLY_APP_NAME:-createsuite-agent-ui}"
APP_URL="https://${APP_NAME}.fly.dev"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${BLUE}[deploy]${NC} $*"; }
ok()   { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[⚠]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*" >&2; }

# ── Check Prerequisites ──
check_prereqs() {
  log "Checking prerequisites..."

  if ! command -v fly &>/dev/null; then
    err "fly CLI not found. Install: curl -L https://fly.io/install.sh | sh"
    exit 1
  fi
  ok "fly CLI found"

  if ! fly auth whoami &>/dev/null 2>&1; then
    err "Not authenticated with Fly.io. Run: fly auth login"
    exit 1
  fi
  ok "Fly.io authenticated as $(fly auth whoami 2>/dev/null)"

  if [ -z "${GITHUB_TOKEN:-}" ]; then
    warn "GITHUB_TOKEN not set — agents won't be able to push branches or create PRs"
  else
    ok "GITHUB_TOKEN set"
  fi

  if [ -z "${ANTHROPIC_API_KEY:-}" ] && [ -z "${OPENAI_API_KEY:-}" ]; then
    warn "No AI provider API key set. Set ANTHROPIC_API_KEY or OPENAI_API_KEY for agents to work."
  fi
}

# ── Deploy to Fly.io ──
deploy() {
  log "Deploying to Fly.io..."
  cd "$ROOT_DIR/agent-ui"

  # Check if app exists, create if not
  if ! fly apps list 2>/dev/null | grep -q "$APP_NAME"; then
    log "Creating Fly.io app: $APP_NAME"
    fly apps create "$APP_NAME" --org personal 2>/dev/null || true
  fi

  # Set secrets if env vars are available
  log "Setting Fly.io secrets..."
  local secrets_args=""

  [ -n "${GITHUB_TOKEN:-}" ]       && secrets_args+="GITHUB_TOKEN=${GITHUB_TOKEN} "
  [ -n "${ANTHROPIC_API_KEY:-}" ]  && secrets_args+="ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY} "
  [ -n "${OPENAI_API_KEY:-}" ]     && secrets_args+="OPENAI_API_KEY=${OPENAI_API_KEY} "
  [ -n "${GOOGLE_API_KEY:-}" ]     && secrets_args+="GOOGLE_API_KEY=${GOOGLE_API_KEY} "
  [ -n "${FLY_API_TOKEN:-}" ]      && secrets_args+="FLY_API_TOKEN=${FLY_API_TOKEN} "
  [ -n "${API_TOKEN:-}" ]          && secrets_args+="API_TOKEN=${API_TOKEN} "

  if [ -n "$secrets_args" ]; then
    # shellcheck disable=SC2086
    fly secrets set $secrets_args --app "$APP_NAME" 2>/dev/null || warn "Some secrets may have failed"
    ok "Secrets set"
  fi

  # Deploy
  log "Building and deploying Docker image..."
  fly deploy --app "$APP_NAME" --remote-only

  ok "Deployed to $APP_URL"

  # Wait for health check
  log "Waiting for health check..."
  local retries=30
  while [ $retries -gt 0 ]; do
    if curl -sf "${APP_URL}/api/health" >/dev/null 2>&1; then
      ok "Health check passed"
      return 0
    fi
    retries=$((retries - 1))
    sleep 5
  done

  err "Health check failed after 150s"
  return 1
}

# ── Seed Provider Credentials ──
seed_credentials() {
  log "Seeding provider credentials..."
  local creds='{}'

  if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    creds=$(echo "$creds" | python3 -c "
import sys, json
d = json.load(sys.stdin)
d['anthropic'] = '$ANTHROPIC_API_KEY'
print(json.dumps(d))
")
  fi

  if [ -n "${OPENAI_API_KEY:-}" ]; then
    creds=$(echo "$creds" | python3 -c "
import sys, json
d = json.load(sys.stdin)
d['openai'] = '$OPENAI_API_KEY'
print(json.dumps(d))
")
  fi

  local auth_header=""
  [ -n "${API_TOKEN:-}" ] && auth_header="-H \"Authorization: Bearer ${API_TOKEN}\""

  curl -sf -X POST "${APP_URL}/api/providers/credentials" \
    -H "Content-Type: application/json" \
    ${auth_header:+$auth_header} \
    -d "{\"credentials\": $creds}" || warn "Credential seeding failed"

  ok "Provider credentials seeded"
}

# ── Trigger Dogfood Pipeline ──
trigger_pipeline() {
  local target_url="${1:-$APP_URL}"
  log "Triggering dogfood pipeline on $target_url..."

  local auth_header=""
  [ -n "${API_TOKEN:-}" ] && auth_header="-H \"Authorization: Bearer ${API_TOKEN}\""

  local result
  result=$(curl -sf -X POST "${target_url}/api/pipeline/start" \
    -H "Content-Type: application/json" \
    ${auth_header:+$auth_header} \
    -d '{
      "repoUrl": "https://github.com/awelcing-alm/createsuite",
      "goal": "Add unit test coverage for core modules, fix the OAuth placeholder and hardcoded values, set up CI/CD pipeline, and polish the dashboard UI with real metrics",
      "provider": "github-copilot",
      "model": "claude-sonnet-4",
      "maxAgents": 4,
      "agentType": "claude"
    }' 2>&1) || {
    err "Pipeline trigger failed"
    echo "$result"
    return 1
  }

  local pipeline_id
  pipeline_id=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['pipelineId'])" 2>/dev/null)

  ok "Pipeline started: $pipeline_id"
  echo ""
  echo "  Monitor:  ${target_url}/api/pipeline/status/${pipeline_id}"
  echo "  UI:       ${target_url}"
  echo ""
  echo "$pipeline_id"
}

# ── Check Pipeline Status ──
check_status() {
  local pipeline_id="${1:-}"
  local target_url="${2:-$APP_URL}"

  if [ -z "$pipeline_id" ]; then
    # List all pipelines
    log "Listing pipelines on $target_url..."
    curl -sf "${target_url}/api/pipeline/list" | python3 -m json.tool
    return
  fi

  curl -sf "${target_url}/api/pipeline/status/${pipeline_id}" | python3 -c "
import sys, json
d = json.load(sys.stdin)['data']
print(f\"Pipeline: {d['id']}\")
print(f\"Phase:    {d['phase']}\")
print(f\"Goal:     {d['goal'][:80]}\")
print(f\"Started:  {d['startedAt']}\")
print()
for t in d['tasks']:
    status = t['status']
    icon = '✓' if status == 'completed' else '✗' if status == 'failed' else '⟳'
    err = f\" — {t['error'][:60]}\" if t.get('error') else ''
    print(f\"  {icon} {t['title'][:60]}: {status}{err}\")
"
}

# ── Main ──
case "${1:-full}" in
  deploy)
    check_prereqs
    deploy
    ;;
  trigger)
    trigger_pipeline "${2:-$APP_URL}"
    ;;
  trigger-local)
    trigger_pipeline "http://localhost:3001"
    ;;
  status)
    check_status "${2:-}" "${3:-$APP_URL}"
    ;;
  status-local)
    check_status "${2:-}" "http://localhost:3001"
    ;;
  seed)
    seed_credentials
    ;;
  full)
    check_prereqs
    deploy
    seed_credentials
    trigger_pipeline
    ;;
  *)
    echo "Usage: $0 [deploy|trigger|trigger-local|status|status-local|seed|full]"
    exit 1
    ;;
esac
