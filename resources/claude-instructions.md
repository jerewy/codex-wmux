<!-- wmux:start — AUTO-MANAGED BY wmux. Do not edit this section manually. -->

# wmux Environment

You are running inside **wmux**, a terminal multiplexer with an embedded browser panel that the user can see in real-time. The `WMUX=1` environment variable confirms this.

## Browser Panel

wmux has a browser panel on the right side. **Prefer using the wmux browser commands** for web tasks so the user can SEE what you're doing in real-time. If the user explicitly asks you to use Firecrawl, Playwright, or another tool, use that instead.

## wmux CLI

```bash
node "$WMUX_CLI" <command> [args]
```

## Browser Commands

**Always snapshot first to get element refs, then interact.**

```bash
# Navigate
node "$WMUX_CLI" browser open <url>

# Read the page (get accessibility tree with @eN refs)
node "$WMUX_CLI" browser snapshot

# Interact with elements by ref
node "$WMUX_CLI" browser click @eN
node "$WMUX_CLI" browser type @eN <text>
node "$WMUX_CLI" browser fill @eN <value>

# Read content
node "$WMUX_CLI" browser get-text
node "$WMUX_CLI" browser get-text @eN

# Other
node "$WMUX_CLI" browser screenshot
node "$WMUX_CLI" browser eval <js>
node "$WMUX_CLI" browser wait @eN
node "$WMUX_CLI" browser back
node "$WMUX_CLI" browser forward
node "$WMUX_CLI" browser reload
```

### Web Search Example

```bash
node "$WMUX_CLI" browser open "https://www.google.com/search?q=best+sushi+paris"
node "$WMUX_CLI" browser snapshot
# Read results, click a link:
node "$WMUX_CLI" browser click @e10
node "$WMUX_CLI" browser snapshot
node "$WMUX_CLI" browser get-text
```

Refs (`@e1`, `@e2`, ...) are ephemeral — re-snapshot after any page change.
If the browser panel is closed, tell the user to open it with `Ctrl+Shift+I`.

## Sub-Agents: Use wmux agent spawn

**When you need to run parallel tasks or sub-agents, use `wmux agent spawn` instead of the built-in Agent tool.** The built-in Agent tool runs invisibly in memory — the user can't see what agents are doing. `wmux agent spawn` creates visible terminal tabs so the user watches each agent work in real-time.

```bash
# Single agent
node "$WMUX_CLI" agent spawn --cmd "claude -p 'describe the task here'" --label "Task Name"

# Multiple agents distributed across panes
node "$WMUX_CLI" agent spawn-batch --json '[
  {"cmd":"claude -p \"research topic X\"","label":"Research"},
  {"cmd":"claude -p \"write tests for Y\"","label":"Tests"},
  {"cmd":"claude -p \"review code in Z\"","label":"Review"}
]'

# Monitor
node "$WMUX_CLI" agent list
node "$WMUX_CLI" agent status <agentId>
node "$WMUX_CLI" agent kill <agentId>
```

## Notifications & Status

```bash
node "$WMUX_CLI" notify --body "Done!"
node "$WMUX_CLI" set-status build "passing"
node "$WMUX_CLI" set-progress 0.75 --label "Deploying..."
node "$WMUX_CLI" log info "Migration finished"
```

<!-- wmux:end -->
