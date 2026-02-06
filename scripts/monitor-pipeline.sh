#!/usr/bin/env bash
set -euo pipefail

# ===================================================
# CreateSuite Pipeline Monitor
# ===================================================
# Observability tool for watching dogfood pipeline runs.
# Polls pipeline status, agent logs, and system health.
#
# Usage:
#   ./scripts/monitor-pipeline.sh [pipeline_id] [base_url]
#   ./scripts/monitor-pipeline.sh                        # auto-detect latest pipeline on Fly
#   ./scripts/monitor-pipeline.sh latest local            # monitor localhost:3001
#   ./scripts/monitor-pipeline.sh abc123def               # specific pipeline on Fly
#   ./scripts/monitor-pipeline.sh --snapshot              # one-shot snapshot (no loop)
#   ./scripts/monitor-pipeline.sh --logs                  # dump agent logs
#   ./scripts/monitor-pipeline.sh --report                # generate iteration report

PIPELINE_ID="${1:-latest}"
BASE_URL="${2:-https://createsuite-agent-ui.fly.dev}"
POLL_INTERVAL="${POLL_INTERVAL:-10}"
REPORT_DIR="/workspaces/createsuite/.createsuite/reports"
LOG_DIR="/workspaces/createsuite/.createsuite/monitor-logs"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

# Handle 'local' shorthand
[[ "$BASE_URL" == "local" ]] && BASE_URL="http://localhost:3001"

# Ensure dirs
mkdir -p "$REPORT_DIR" "$LOG_DIR"

# ── Helpers ──
api() {
  local path="$1"
  local auth=""
  [[ -n "${API_TOKEN:-}" ]] && auth="-H 'Authorization: Bearer $API_TOKEN'"
  curl -sf --max-time 10 ${auth:+$auth} "${BASE_URL}${path}" 2>/dev/null
}

timestamp() { date '+%H:%M:%S'; }

# ── Resolve latest pipeline ──
resolve_pipeline_id() {
  if [[ "$PIPELINE_ID" == "latest" || "$PIPELINE_ID" == "--snapshot" || "$PIPELINE_ID" == "--logs" || "$PIPELINE_ID" == "--report" ]]; then
    local list
    list=$(api "/api/pipeline/list" 2>/dev/null) || { echo ""; return; }
    local resolved
    resolved=$(echo "$list" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    pipelines = data.get('data', data) if isinstance(data, dict) else data
    if isinstance(pipelines, list) and len(pipelines) > 0:
        # Sort by startedAt descending
        pipelines.sort(key=lambda p: p.get('startedAt', ''), reverse=True)
        print(pipelines[0]['id'])
    else:
        print('')
except:
    print('')
" 2>/dev/null)
    echo "$resolved"
  else
    echo "$PIPELINE_ID"
  fi
}

# ── Health snapshot ──
health_snapshot() {
  local health
  health=$(api "/api/health" 2>/dev/null) || { echo -e "${RED}Health check failed${NC}"; return 1; }
  
  python3 -c "
import sys, json
d = json.load(sys.stdin)
mem_mb = d.get('memoryUsage', {}).get('rss', 0) / 1024 / 1024
uptime = d.get('uptimeFormatted', 'unknown')
sessions = d.get('sessionCount', 0)
status = d.get('lifecycleStatus', 'unknown')
print(f'  Status: {status} | Uptime: {uptime} | Memory: {mem_mb:.0f}MB | Sessions: {sessions}')
" <<< "$health" 2>/dev/null
}

# ── Pipeline status ──
pipeline_snapshot() {
  local pid="$1"
  local data
  data=$(api "/api/pipeline/status/${pid}" 2>/dev/null) || { echo -e "${RED}Pipeline ${pid} not found${NC}"; return 1; }
  
  python3 -c "
import sys, json
raw = json.load(sys.stdin)
d = raw.get('data', raw)
phase = d.get('phase', 'unknown')
goal = d.get('goal', '')[:90]
started = d.get('startedAt', '')
provider = d.get('provider', 'unknown')
model = d.get('model', 'unknown')
tasks = d.get('tasks', [])

# Phase color
phase_colors = {'planning': '33', 'executing': '34', 'completed': '32', 'failed': '31'}
pc = phase_colors.get(phase, '37')

print(f'  \033[{pc}m● {phase.upper()}\033[0m | {provider}/{model}')
print(f'  Goal: {goal}')
print(f'  Started: {started}')
print()

# Count stats
total = len(tasks)
completed = sum(1 for t in tasks if t.get('status') == 'completed')
running = sum(1 for t in tasks if t.get('status') == 'running')
failed = sum(1 for t in tasks if t.get('status') == 'failed')
pending = total - completed - running - failed

print(f'  Tasks: {total} total | \033[32m{completed} done\033[0m | \033[34m{running} running\033[0m | \033[31m{failed} failed\033[0m | {pending} pending')
print()

for i, t in enumerate(tasks):
    status = t.get('status', 'unknown')
    title = t.get('title', 'Untitled')[:65]
    tid = t.get('id', '?')
    aid = t.get('agentId', '?')[:8]
    commit = t.get('commitHash', '') or ''
    err = (t.get('error') or '')[:60]
    
    icons = {'completed': '\033[32m✓\033[0m', 'running': '\033[34m⟳\033[0m', 'failed': '\033[31m✗\033[0m', 'pending': '\033[2m○\033[0m'}
    icon = icons.get(status, '?')
    
    line = f'  {icon} [{aid}] {title}'
    if commit and commit != 'no-changes':
        line += f' \033[2m({commit[:8]})\033[0m'
    elif commit == 'no-changes':
        line += f' \033[2m(no changes)\033[0m'
    if err:
        line += f' \033[31m— {err}\033[0m'
    print(line)
" <<< "$data" 2>/dev/null
}

# ── Agent logs ──
dump_agent_logs() {
  local pid="$1"
  echo -e "${BOLD}Agent Logs for pipeline ${pid}${NC}"
  echo ""
  
  # Check for local log files first
  local log_dir="/workspaces/createsuite/agent-ui/.createsuite/logs"
  if [[ -d "$log_dir" ]]; then
    for log in "$log_dir"/agent-*.log; do
      [[ -f "$log" ]] || continue
      local agent_id
      agent_id=$(basename "$log" .log | sed 's/agent-//')
      echo -e "${CYAN}── Agent ${agent_id} ──${NC}"
      tail -30 "$log" 2>/dev/null || echo "  (empty)"
      echo ""
    done
  fi
  
  # Also check Fly.io logs if available
  if command -v fly &>/dev/null; then
    echo -e "${CYAN}── Fly.io app logs (last 50 lines) ──${NC}"
    fly logs --app createsuite-agent-ui --no-tail 2>&1 | tail -50 || echo "  (no fly logs)"
  fi
}

# ── Generate iteration report ──
generate_report() {
  local pid="$1"
  local report_file="${REPORT_DIR}/report-${pid}-$(date +%Y%m%d-%H%M%S).md"
  
  local data
  data=$(api "/api/pipeline/status/${pid}" 2>/dev/null) || { echo "Cannot fetch pipeline"; return 1; }
  
  local health
  health=$(api "/api/health" 2>/dev/null) || health="{}"
  
  python3 -c "
import sys, json, datetime

pipeline_raw = json.loads('''${data}''')
health_raw = json.loads('''${health}''')

d = pipeline_raw.get('data', pipeline_raw)
h = health_raw

phase = d.get('phase', 'unknown')
goal = d.get('goal', '')
provider = d.get('provider', 'unknown')
model = d.get('model', 'unknown')
started = d.get('startedAt', '')
tasks = d.get('tasks', [])

completed = [t for t in tasks if t.get('status') == 'completed']
failed = [t for t in tasks if t.get('status') == 'failed']
running = [t for t in tasks if t.get('status') == 'running']

mem_mb = h.get('memoryUsage', {}).get('rss', 0) / 1024 / 1024
uptime = h.get('uptimeFormatted', '?')

report = f'''# Pipeline Report: {d.get('id', '?')}

**Generated:** {datetime.datetime.now().isoformat()}
**Phase:** {phase}
**Provider:** {provider}/{model}
**Started:** {started}

## Goal
{goal}

## Results Summary
- **Total tasks:** {len(tasks)}
- **Completed:** {len(completed)}
- **Failed:** {len(failed)}
- **Running:** {len(running)}

## Task Details
'''

for t in tasks:
    status = t.get('status', '?')
    icon = '✓' if status == 'completed' else '✗' if status == 'failed' else '⟳' if status == 'running' else '○'
    commit = t.get('commitHash', '') or 'none'
    err = t.get('error', '') or ''
    report += f'''
### {icon} {t.get('title', '?')}
- **ID:** {t.get('id', '?')}
- **Agent:** {t.get('agentId', '?')}
- **Status:** {status}
- **Commit:** {commit}
'''
    if err:
        report += f'- **Error:** {err}\n'

report += f'''
## System Health
- **Memory:** {mem_mb:.0f}MB RSS
- **Uptime:** {uptime}

## Observations & Next Actions
<!-- Fill in after reviewing -->
- [ ] 
- [ ] 
- [ ] 

## Iteration Decision
<!-- What to do next based on these results -->
- **If all tasks completed:** Review PRs, merge, trigger next pipeline
- **If some failed:** Check agent logs, fix the failure mode, re-trigger
- **If agents stuck:** Check opencode auth, verify provider access
'''

print(report)
" > "$report_file" 2>/dev/null

  echo -e "${GREEN}Report saved to: ${report_file}${NC}"
  echo ""
  cat "$report_file"
}

# ── Main loop ──
main() {
  local mode="$PIPELINE_ID"
  
  # Resolve actual pipeline ID
  local pid
  pid=$(resolve_pipeline_id)
  
  if [[ -z "$pid" ]]; then
    echo -e "${YELLOW}No pipelines found. Trigger one first:${NC}"
    echo "  ./scripts/deploy-dogfood.sh trigger"
    exit 0
  fi
  
  case "$mode" in
    --snapshot)
      echo -e "${BOLD}═══ Pipeline Snapshot @ $(timestamp) ═══${NC}"
      echo ""
      echo -e "${BOLD}System Health:${NC}"
      health_snapshot
      echo ""
      echo -e "${BOLD}Pipeline ${pid}:${NC}"
      pipeline_snapshot "$pid"
      ;;
    --logs)
      dump_agent_logs "$pid"
      ;;
    --report)
      generate_report "$pid"
      ;;
    *)
      # Continuous monitoring loop
      echo -e "${BOLD}═══ CreateSuite Pipeline Monitor ═══${NC}"
      echo -e "${DIM}Pipeline: ${pid} | URL: ${BASE_URL} | Poll: ${POLL_INTERVAL}s${NC}"
      echo -e "${DIM}Press Ctrl+C to stop${NC}"
      echo ""
      
      local prev_phase=""
      while true; do
        clear 2>/dev/null || true
        echo -e "${BOLD}═══ CreateSuite Monitor @ $(timestamp) ═══${NC}"
        echo ""
        
        echo -e "${BOLD}Health:${NC}"
        health_snapshot || true
        echo ""
        
        echo -e "${BOLD}Pipeline ${pid}:${NC}"
        pipeline_snapshot "$pid" || true
        
        # Check if pipeline is done
        local phase
        phase=$(api "/api/pipeline/status/${pid}" 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    p = d.get('data', d)
    print(p.get('phase', 'unknown'))
except:
    print('unknown')
" 2>/dev/null)
        
        if [[ "$phase" == "completed" && "$prev_phase" != "completed" ]]; then
          echo ""
          echo -e "${GREEN}${BOLD}═══ PIPELINE COMPLETED ═══${NC}"
          echo ""
          echo "Generating report..."
          generate_report "$pid"
          break
        elif [[ "$phase" == "failed" && "$prev_phase" != "failed" ]]; then
          echo ""
          echo -e "${RED}${BOLD}═══ PIPELINE FAILED ═══${NC}"
          echo ""
          echo "Generating report..."
          generate_report "$pid"
          break
        fi
        
        prev_phase="$phase"
        
        echo ""
        echo -e "${DIM}Next poll in ${POLL_INTERVAL}s... (Ctrl+C to stop)${NC}"
        sleep "$POLL_INTERVAL"
      done
      ;;
  esac
}

main
