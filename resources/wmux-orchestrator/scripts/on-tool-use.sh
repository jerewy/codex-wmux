#!/usr/bin/env bash
# PostToolUse hook: increment toolUses counter for the active agent.
# Called by Claude Code after each tool use. Must complete in <5s.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/orchestration-state.sh"

ORCH_DIR=$(find_active_orch)
[ -z "$ORCH_DIR" ] && exit 0

AGENT_ID="${WMUX_AGENT_ID:-}"
[ -z "$AGENT_ID" ] && exit 0

update_state "$ORCH_DIR" \
  "(.waves[].agents[] | select(.id == \"$AGENT_ID\")) .toolUses += 1"

if command -v wmux &>/dev/null; then
  DASHBOARD_SID=$(read_state "$ORCH_DIR" '.dashboardSurfaceId')
  if [ "$DASHBOARD_SID" != "null" ] && [ -n "$DASHBOARD_SID" ]; then
    bash "$SCRIPT_DIR/check-status.sh" "$ORCH_DIR" > "$ORCH_DIR/dashboard.md"
    wmux markdown set "$DASHBOARD_SID" --file "$ORCH_DIR/dashboard.md" 2>/dev/null || true
  fi
fi
