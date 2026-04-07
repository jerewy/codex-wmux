#!/usr/bin/env bash
# SessionStart hook: detect wmux, check for interrupted orchestrations.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/orchestration-state.sh"

ORCH_DIR=$(find_active_orch)
if [ -n "$ORCH_DIR" ]; then
  ORCH_ID=$(read_state "$ORCH_DIR" '.id')
  TASK=$(read_state "$ORCH_DIR" '.task')
  RUNNING=$(jq '[.waves[].agents[] | select(.status == "running")] | length' "$ORCH_DIR/state.json" 2>/dev/null)
  echo "Found interrupted orchestration: $ORCH_ID"
  echo "Task: $TASK"
  echo "Running agents: $RUNNING"
fi
