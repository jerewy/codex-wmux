<!-- wmux:start — AUTO-MANAGED BY wmux. Do not edit this section manually. -->

# wmux Environment

You are running inside **wmux**, a terminal multiplexer with an embedded browser panel that the user can see. The `WMUX=1` environment variable confirms this.

## CRITICAL: wmux Tools Override Built-in Tools

wmux gives you a real browser panel and visible agent terminals. **The user expects to SEE your actions in real-time.** You MUST use the wmux CLI instead of your built-in tools for these cases:

### Web browsing: USE wmux browser, NOT built-in tools
**DO NOT use** Firecrawl, WebFetch, WebSearch, Playwright, or any other web/browsing tool. They are invisible to the user. Use the wmux browser commands instead — the user watches you navigate, click, and read pages live.

- Search the web → `browser open https://www.google.com/search?q=...` then read results
- Look up something → navigate to the relevant site in the wmux browser
- Check a URL → `browser open <url>` then `browser snapshot`
- Interact with a web page → use snapshot + click/type/fill

### Sub-agents: USE wmux agent spawn, NOT the built-in Agent tool
**DO NOT use** the built-in Agent tool to spawn sub-agents. It runs them invisibly in the background. Use `wmux agent spawn` instead — this creates **visible terminal tabs** in wmux's panes where the user can watch each agent work.

When the user asks to run parallel tasks or spawn sub-agents:
```bash
node "$WMUX_CLI" agent spawn --cmd "claude -p 'task description here'" --label "Task Name"
```

For multiple agents:
```bash
node "$WMUX_CLI" agent spawn-batch --json '[
  {"cmd":"claude -p \"research X\"","label":"Research"},
  {"cmd":"claude -p \"write tests for Y\"","label":"Tests"},
  {"cmd":"claude -p \"review code in Z\"","label":"Review"}
]'
```

Each agent appears as its own tab — the user sees all of them working simultaneously.

## wmux CLI

```bash
node "$WMUX_CLI" <command> [args]
```

The `WMUX_CLI` env var points to the CLI script.

## Browser Commands

The browser panel is on the right side of the wmux window. Every action you take is visible to the user in real-time.

**Always snapshot first to get element refs, then interact.**

```bash
# Navigate to a URL
node "$WMUX_CLI" browser open <url>

# Get accessibility tree with @eN refs (MUST do before clicking/typing)
node "$WMUX_CLI" browser snapshot

# Interact with elements by ref
node "$WMUX_CLI" browser click @eN
node "$WMUX_CLI" browser type @eN <text>
node "$WMUX_CLI" browser fill @eN <value>

# Read content
node "$WMUX_CLI" browser get-text
node "$WMUX_CLI" browser get-text @eN

# Screenshot
node "$WMUX_CLI" browser screenshot

# Run JavaScript
node "$WMUX_CLI" browser eval <js>

# Wait for element
node "$WMUX_CLI" browser wait @eN

# Navigation
node "$WMUX_CLI" browser back
node "$WMUX_CLI" browser forward
node "$WMUX_CLI" browser reload
```

### Browser Workflow

1. `browser open <url>` — navigate (user sees the page load)
2. `browser snapshot` — get accessibility tree with @eN refs
3. Find the element ref you need in the tree
4. `browser click/type/fill @eN` — interact (user sees the action)
5. `browser snapshot` again after mutations (refs expire on page change)
6. Repeat as needed

Refs (`@e1`, `@e2`, ...) are ephemeral — always re-snapshot after any page change.
If the browser panel is closed, tell the user to open it with `Ctrl+Shift+I`.

### Web Search Example

When the user asks to search the web:
```bash
node "$WMUX_CLI" browser open "https://www.google.com/search?q=best+sushi+paris"
node "$WMUX_CLI" browser snapshot
# Read the results from the accessibility tree
# Click on a result to see more details
node "$WMUX_CLI" browser click @e10
node "$WMUX_CLI" browser snapshot
node "$WMUX_CLI" browser get-text
```

## Agent Spawning

Spawn visible sub-agent terminals distributed across panes:

```bash
node "$WMUX_CLI" agent spawn --cmd "claude --resume abc" --label "Research"
node "$WMUX_CLI" agent spawn-batch --json '[{"cmd":"...","label":"A1"},{"cmd":"...","label":"A2"}]'
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

## Terminal

```bash
node "$WMUX_CLI" read-screen        # Read visible terminal content
node "$WMUX_CLI" send "npm test"    # Send text to active terminal
node "$WMUX_CLI" send-key Enter     # Send a keypress
```

<!-- wmux:end -->
