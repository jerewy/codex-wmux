#!/usr/bin/env bash
# collect-results.sh <orch-dir>
# Aggregates all agent result files into a single summary for the reviewer.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/orchestration-state.sh"

ORCH_DIR="$1"
[ -z "$ORCH_DIR" ] && { echo "Usage: collect-results.sh <orch-dir>"; exit 1; }

echo "# Orchestration Results Summary"
echo ""

WAVE_COUNT=$(jq '.waves | length' "$ORCH_DIR/state.json")

for i in $(seq 0 $((WAVE_COUNT - 1))); do
  echo "## Wave $((i + 1))"
  echo ""

  jq -r ".waves[$i].agents[] | .id" "$ORCH_DIR/state.json" | while IFS= read -r agent_id; do
    LABEL=$(jq -r ".waves[$i].agents[] | select(.id == \"$agent_id\") | .label" "$ORCH_DIR/state.json")
    RESULT_FILE="$ORCH_DIR/agent-${agent_id}-result.md"

    echo "### $LABEL"
    echo ""
    if [ -f "$RESULT_FILE" ]; then
      cat "$RESULT_FILE"
    else
      echo "_No result file found._"
    fi
    echo ""
  done
done
