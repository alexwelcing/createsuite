#!/bin/bash
set -e

# CreateSuite Container Entrypoint
# Two modes:
#   1. Task mode: TASK_SCRIPT_B64 env var is set → decode and execute the task script
#   2. Interactive mode: No task script → run the UI server as usual

if [ -n "$TASK_SCRIPT_B64" ]; then
  echo "🤖 CreateSuite Agent — Task Mode"
  echo "Agent: ${AGENT_NAME:-unnamed}"
  echo "Task:  ${ASSIGNED_TASK:-unassigned}"
  echo "Provider: ${OPENCODE_PROVIDER:-default}"
  echo "Model: ${OPENCODE_MODEL:-default}"
  echo ""

  # Decode and execute the task script
  echo "$TASK_SCRIPT_B64" | base64 -d > /tmp/task.sh
  chmod +x /tmp/task.sh
  
  echo "Executing task script..."
  exec /tmp/task.sh
else
  echo "🖥️  CreateSuite Agent — Interactive Mode"
  echo "Starting UI server on port ${PORT:-8080}..."
  exec node server/index.js "$@"
fi
