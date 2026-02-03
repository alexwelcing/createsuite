#!/bin/bash
# CreateSuite Fly.io Deploy Script
# Deploys the agent-ui to Fly.io with proper secrets and configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="createsuite-agent-ui"
REGION="iad"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
AGENT_UI_DIR="$PROJECT_ROOT/agent-ui"

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       CreateSuite Fly.io Deployment            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Check for flyctl
if ! command -v flyctl &> /dev/null; then
    echo -e "${RED}Error: flyctl is not installed.${NC}"
    echo "Install it from: https://fly.io/docs/getting-started/installing-flyctl/"
    exit 1
fi

# Check if logged in
if ! flyctl auth whoami &> /dev/null; then
    echo -e "${YELLOW}Not logged in to Fly.io. Running 'flyctl auth login'...${NC}"
    flyctl auth login
fi

# Parse arguments
COMMAND=${1:-deploy}
shift || true

case $COMMAND in
    secrets)
        echo -e "${BLUE}📦 Managing secrets...${NC}"
        echo ""
        echo "Current secrets:"
        flyctl secrets list -a $APP_NAME 2>/dev/null || echo "No app found or no secrets set"
        echo ""
        echo -e "${YELLOW}To set secrets, run:${NC}"
        echo ""
        echo -e "${GREEN}# Authentication${NC}"
        echo "  flyctl secrets set API_TOKEN=\"your-token\" -a $APP_NAME"
        echo "  flyctl secrets set BASIC_AUTH_USER=\"admin\" -a $APP_NAME"
        echo "  flyctl secrets set BASIC_AUTH_PASS=\"password\" -a $APP_NAME"
        echo ""
        echo -e "${GREEN}# Webhooks (Slack/Discord notifications)${NC}"
        echo "  flyctl secrets set WEBHOOK_URL=\"https://hooks.slack.com/...\" -a $APP_NAME"
        echo ""
        echo -e "${GREEN}# GitHub (for agent-initiated rebuilds)${NC}"
        echo "  flyctl secrets set GITHUB_TOKEN=\"ghp_...\" -a $APP_NAME"
        echo ""
        echo -e "${GREEN}# AI Provider Keys${NC}"
        echo "  flyctl secrets set ANTHROPIC_API_KEY=\"sk-ant-...\" -a $APP_NAME"
        echo "  flyctl secrets set OPENAI_API_KEY=\"sk-...\" -a $APP_NAME"
        ;;
        
    status)
        echo -e "${BLUE}📊 Checking deployment status...${NC}"
        flyctl status -a $APP_NAME
        echo ""
        echo -e "${BLUE}🏥 Health check:${NC}"
        curl -s "https://$APP_NAME.fly.dev/api/health" | jq . 2>/dev/null || echo "App not responding"
        ;;
        
    logs)
        echo -e "${BLUE}📜 Streaming logs...${NC}"
        flyctl logs -a $APP_NAME
        ;;
        
    lifecycle)
        echo -e "${BLUE}🔄 Lifecycle status:${NC}"
        curl -s "https://$APP_NAME.fly.dev/api/lifecycle/status" | jq . 2>/dev/null || echo "App not responding"
        ;;
        
    hold)
        DURATION=${1:-60}
        REASON=${2:-"Manual hold via deploy script"}
        echo -e "${BLUE}⏸️  Holding container for $DURATION minutes...${NC}"
        curl -s -X POST "https://$APP_NAME.fly.dev/api/lifecycle/hold" \
            -H "Content-Type: application/json" \
            -d "{\"durationMinutes\": $DURATION, \"reason\": \"$REASON\"}" | jq .
        ;;
        
    release)
        echo -e "${BLUE}▶️  Releasing hold...${NC}"
        curl -s -X POST "https://$APP_NAME.fly.dev/api/lifecycle/release" \
            -H "Content-Type: application/json" | jq .
        ;;
        
    shutdown)
        FORCE=${1:-false}
        REASON=${2:-"Manual shutdown via deploy script"}
        echo -e "${YELLOW}🛑 Requesting shutdown (force=$FORCE)...${NC}"
        curl -s -X POST "https://$APP_NAME.fly.dev/api/lifecycle/shutdown" \
            -H "Content-Type: application/json" \
            -d "{\"force\": $FORCE, \"reason\": \"$REASON\"}" | jq .
        ;;
        
    restart)
        REASON=${1:-"Manual restart via deploy script"}
        echo -e "${YELLOW}🔄 Requesting restart...${NC}"
        curl -s -X POST "https://$APP_NAME.fly.dev/api/lifecycle/restart" \
            -H "Content-Type: application/json" \
            -d "{\"reason\": \"$REASON\"}" | jq .
        ;;
        
    rebuild)
        BRANCH=${1:-main}
        REASON=${2:-"Manual rebuild via deploy script"}
        echo -e "${YELLOW}🏗️  Requesting rebuild from branch: $BRANCH...${NC}"
        curl -s -X POST "https://$APP_NAME.fly.dev/api/lifecycle/rebuild" \
            -H "Content-Type: application/json" \
            -d "{\"branch\": \"$BRANCH\", \"reason\": \"$REASON\"}" | jq .
        ;;
        
    scale)
        COUNT=${1:-1}
        echo -e "${BLUE}📐 Scaling to $COUNT machine(s)...${NC}"
        flyctl scale count $COUNT -a $APP_NAME
        ;;
        
    wake)
        echo -e "${BLUE}👋 Waking up container...${NC}"
        curl -s "https://$APP_NAME.fly.dev/api/health" | jq . 2>/dev/null || echo "Waking up..."
        sleep 2
        curl -s "https://$APP_NAME.fly.dev/api/health" | jq . 2>/dev/null || echo "Still waking..."
        ;;
        
    ssh)
        echo -e "${BLUE}🔌 Opening SSH connection...${NC}"
        flyctl ssh console -a $APP_NAME
        ;;
        
    deploy|*)
        echo -e "${BLUE}🚀 Deploying to Fly.io...${NC}"
        echo ""
        
        cd "$AGENT_UI_DIR"
        
        # Check if app exists
        if ! flyctl apps list | grep -q $APP_NAME; then
            echo -e "${YELLOW}App doesn't exist. Creating...${NC}"
            flyctl apps create $APP_NAME --org personal
        fi
        
        # Deploy
        echo -e "${BLUE}Building and deploying...${NC}"
        flyctl deploy --ha=false --wait-timeout=300
        
        echo ""
        echo -e "${GREEN}✅ Deployment complete!${NC}"
        echo ""
        echo -e "${BLUE}🌐 Your app is live at:${NC} https://$APP_NAME.fly.dev"
        echo ""
        
        # Show health status
        echo -e "${BLUE}🏥 Health check:${NC}"
        sleep 3
        curl -s "https://$APP_NAME.fly.dev/api/health" | jq . 2>/dev/null || echo "Waiting for app to start..."
        ;;
esac

echo ""
echo -e "${BLUE}────────────────────────────────────────────────${NC}"
echo -e "${GREEN}Available commands:${NC}"
echo "  ./scripts/fly-deploy.sh deploy      - Deploy to Fly.io"
echo "  ./scripts/fly-deploy.sh status      - Check deployment status"
echo "  ./scripts/fly-deploy.sh logs        - Stream logs"
echo "  ./scripts/fly-deploy.sh lifecycle   - Check lifecycle status"
echo "  ./scripts/fly-deploy.sh hold [min]  - Hold container (prevent shutdown)"
echo "  ./scripts/fly-deploy.sh release     - Release hold"
echo "  ./scripts/fly-deploy.sh shutdown    - Request graceful shutdown"
echo "  ./scripts/fly-deploy.sh restart     - Request restart"
echo "  ./scripts/fly-deploy.sh rebuild     - Request rebuild from latest"
echo "  ./scripts/fly-deploy.sh scale [n]   - Scale to n machines"
echo "  ./scripts/fly-deploy.sh wake        - Wake up sleeping container"
echo "  ./scripts/fly-deploy.sh ssh         - SSH into container"
echo "  ./scripts/fly-deploy.sh secrets     - Manage secrets"
