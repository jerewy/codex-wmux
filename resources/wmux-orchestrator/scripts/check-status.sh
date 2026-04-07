#!/usr/bin/env bash
# check-status.sh <orch-dir>
# Outputs a markdown dashboard of the current orchestration state.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/orchestration-state.sh"

ORCH_DIR="$1"
[ -z "$ORCH_DIR" ] && ORCH_DIR=$(find_active_orch)
[ -z "$ORCH_DIR" ] && { echo "No active orchestration"; exit 1; }

TASK=$(read_state "$ORCH_DIR" '.task')
STATUS=$(read_state "$ORCH_DIR" '.status')
STARTED=$(read_state "$ORCH_DIR" '.startedAt')
WAVE_COUNT=$(jq '.waves | length' "$ORCH_DIR/state.json")
TOTAL_AGENTS=$(jq '[.waves[].agents[]] | length' "$ORCH_DIR/state.json")
COMPLETED_AGENTS=$(jq '[.waves[].agents[] | select(.status == "completed")] | length' "$ORCH_DIR/state.json")
RUNNING_AGENTS=$(jq '[.waves[].agents[] | select(.status == "running")] | length' "$ORCH_DIR/state.json")
FAILED_AGENTS=$(jq '[.waves[].agents[] | select(.status == "failed")] | length' "$ORCH_DIR/state.json")

cat <<EOF
# Orchestration: $TASK
**Status:** $STATUS | **Agents:** $COMPLETED_AGENTS/$TOTAL_AGENTS complete | **Running:** $RUNNING_AGENTS | **Failed:** $FAILED_AGENTS

EOF

for i in $(seq 0 $((WAVE_COUNT - 1))); do
  WAVE_STATUS=$(jq -r ".waves[$i].status" "$ORCH_DIR/state.json")
  echo "## Wave $((i + 1)) — $WAVE_STATUS"
  echo ""
  echo "| Agent | Status | Tools | Started | Finished |"
  echo "|-------|--------|-------|---------|----------|"
  jq -r ".waves[$i].agents[] | \"| \(.label) | \(.status) | \(.toolUses // 0) | \(.startedAt // \"-\") | \(.finishedAt // \"-\") |\"" "$ORCH_DIR/state.json"
  echo ""
done

REVIEWER_STATUS=$(read_state "$ORCH_DIR" '.reviewer.status')
echo "## Reviewer — $REVIEWER_STATUS"
