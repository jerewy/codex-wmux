<h1 align="center">wmux</h1>

<p align="center">The terminal for multitasking on Windows.</p>

<p align="center">
  Native Windows app built on Electron + xterm.js. Vertical tabs, notification rings when agents need attention, split panes, and a socket API for automation.
</p>

---

## Features

**Notification rings** -- Panes flash blue when an AI agent needs your input. OSC 9/99/777 escape sequences, `wmux notify` CLI command, or idle detection. Cmd+Shift+U jumps to the most recent unread.

**Vertical tabs** -- See all your sessions at a glance in a sidebar. Git branch, PR status, working directory, listening ports, and notification text per workspace. Double-click to rename.

**Split panes** -- Horizontal and vertical splits within each workspace. Drag dividers to resize. Toggle zoom on any pane with Ctrl+Shift+Enter.

**In-app browser** -- A Chromium-based browser panel alongside your terminals. Scriptable API for clicking, filling forms, evaluating JS, and snapshotting the accessibility tree.

**Draggable surface tabs** -- Each pane supports multiple surfaces (terminals, browser, markdown). Drag tabs between panes to reorganize your layout.

- **Scriptable** -- Named pipe server (`\\.\pipe\wmux`) with a JSON-RPC API. Create workspaces, split panes, send keystrokes, read terminal content, and control the browser programmatically.
- **Windows native** -- Built with Electron 33, ConPTY for proper terminal emulation, Windows toast notifications, taskbar flash on alerts.
- **Windows Terminal + Ghostty compatible** -- Import your themes, fonts, and colors from Windows Terminal `settings.json` or `~/.config/ghostty/config`. Ships with 450+ bundled Ghostty themes.
- **GPU-accelerated** -- xterm.js with WebGL rendering for smooth terminal output at any speed.

## Install

### From source (current)

```bash
git clone https://github.com/amirlehmam/wmux.git
cd wmux
npm install
npm run build:main
npm run dev
```

### Portable / Installer (coming soon)

```bash
npm run build
# Produces: release/wmux-setup.exe and release/wmux-portable.exe
```

## Why wmux?

Running multiple Claude Code sessions in parallel is the fastest way to ship. But on Windows, there was no good way to do it. Windows Terminal has tabs, but no notification system -- you have to manually check each tab to see if an agent finished or is waiting for input. tmux works in WSL but loses all Windows integration. Electron-based terminals exist but none focus on the AI agent workflow.

wmux is a Windows port of [cmux](https://github.com/manaflow-ai/cmux), built from scratch with the same design philosophy. It gives you a sidebar that shows exactly what each agent is doing -- the git branch it is on, the PR it opened, the ports it is listening on, and whether it needs your attention. When an agent finishes a task or hits a question, the pane gets a blue notification ring, the sidebar badge increments, and a Windows toast notification fires.

The sidebar is not just a list of tabs. Each workspace shows live metadata reported by shell integration scripts that run inside your PowerShell, CMD, or WSL sessions. The scripts report CWD changes, git branch switches, and PR status via a named pipe. The main process polls for listening ports and forwards everything to the UI.

The in-app browser is for previewing what your agents build. `localhost:3000` running in one terminal, visible in the browser panel next to it. The browser is scriptable -- AI agents can navigate, click, fill forms, and read the accessibility tree through the socket API.

Everything is automatable through the `wmux` CLI or the named pipe directly. Create workspaces, split panes, send text to terminals, read screen content, trigger notifications. The protocol matches cmux so tools built for one work with the other.

## Shell Integration

wmux automatically injects integration scripts into your shells:

- **PowerShell** -- Overrides the `prompt` function. Reports CWD, git branch, dirty state, and shell idle/running status via `NamedPipeClientStream`. Background job polls `gh pr view` every 45 seconds.
- **CMD** -- Embeds OSC 9 escape sequences in the `PROMPT` variable for CWD reporting. Git branch detected via filesystem watcher on `.git/HEAD`.
- **WSL (Bash/Zsh)** -- `PROMPT_COMMAND` / `precmd` hooks, near-identical to cmux's integration. Communicates via temp file bridge.

Environment variables available in all shells:

| Variable | Description |
|---|---|
| `WMUX` | Always `1` inside wmux |
| `WMUX_WORKSPACE_ID` | Current workspace ID |
| `WMUX_PANE_ID` | Current pane ID |
| `WMUX_SURFACE_ID` | Current surface ID |
| `WMUX_PIPE` | Named pipe path |

## Keyboard Shortcuts

All shortcuts are rebindable via Settings (Ctrl+,).

### Workspaces

| Shortcut | Action |
|---|---|
| Ctrl+N | New workspace |
| Ctrl+Shift+W | Close workspace |
| Ctrl+B | Toggle sidebar |
| Ctrl+PageDown | Next workspace |
| Ctrl+PageUp | Previous workspace |
| Ctrl+1...9 | Select workspace by number |
| Ctrl+Shift+R | Rename workspace |
| F2 | Rename surface tab |

### Surfaces

| Shortcut | Action |
|---|---|
| Ctrl+T | New surface (tab in pane) |
| Ctrl+W | Close active surface / pane |
| Ctrl+Shift+] | Next surface |
| Ctrl+Shift+[ | Previous surface |
| Alt+1...9 | Select surface by number |

### Split Panes

| Shortcut | Action |
|---|---|
| Ctrl+D | Split right |
| Ctrl+Shift+D | Split down |
| Ctrl+Shift+Enter | Toggle pane zoom |
| Ctrl+Alt+Arrow | Focus pane in direction |

### Browser

| Shortcut | Action |
|---|---|
| Ctrl+Shift+I | Toggle browser panel |
| Ctrl+Alt+I | Browser DevTools |
| Ctrl+Alt+C | Browser console |

### Notifications

| Shortcut | Action |
|---|---|
| Ctrl+Shift+U | Jump to latest unread |
| Ctrl+Shift+H | Flash focused pane |

### Terminal

| Shortcut | Action |
|---|---|
| Ctrl+F | Find in terminal |
| Ctrl+Shift+C | Copy |
| Ctrl+Shift+V | Paste |
| Ctrl+Shift+M | Toggle copy mode |

### General

| Shortcut | Action |
|---|---|
| Ctrl+, | Settings |
| Ctrl+Shift+P | Command palette |
| Ctrl+Shift+N | New window |

## CLI

The `wmux` CLI communicates with the running app over the named pipe.

```bash
wmux ping                          # Check if wmux is running
wmux notify "Build complete"       # Send a notification
wmux new-workspace --title "API"   # Create a workspace
wmux list-workspaces               # List all workspaces
wmux split --right                 # Split focused pane
wmux send "npm test"               # Send text to terminal
wmux read-screen --lines 50        # Read terminal content
wmux browser open http://localhost:3000
wmux tree                          # Show workspace/pane/surface hierarchy
```

Full command reference: `wmux --help`

## Socket API

Connect to `\\.\pipe\wmux` for programmatic control.

**V1 protocol** (text, used by shell integration):
```
report_pwd <surface_id> <path>
report_git_branch <surface_id> <branch> [dirty]
notify <surface_id> <text>
ping
```

**V2 protocol** (JSON-RPC, used by CLI and automation):
```json
{"method": "workspace.create", "params": {"title": "Agent 1"}}
{"method": "surface.send_text", "params": {"id": "surf-...", "text": "npm test\n"}}
{"method": "surface.read_text", "params": {"id": "surf-...", "lines": 50}}
{"method": "browser.navigate", "params": {"surfaceId": "surf-...", "url": "http://localhost:3000"}}
{"method": "browser.snapshot", "params": {"surfaceId": "surf-..."}}
```

## Session Restore

On restart, wmux restores:
- Window position and size
- All workspaces with titles, colors, pin state
- Split pane layout (directions and ratios)
- Working directory per terminal (new shell spawned in saved CWD)
- Browser panel URLs
- Active workspace and pane selection

**Not restored:** running processes, shell history, notification state. Shells are respawned fresh in the saved working directories.

## Config

wmux reads configuration from two sources:

1. **Windows Terminal** -- `%LOCALAPPDATA%\Packages\Microsoft.WindowsTerminal_...\LocalState\settings.json`
2. **Ghostty** -- `~/.config/ghostty/config`

Import either via Settings > Terminal > Import buttons. Extracts font family, font size, color scheme, and palette.

Default theme is Monokai. 450+ Ghostty themes bundled and available in Settings > Terminal > Theme.

## Architecture

Two-process Electron model. Main process manages PTY spawning (node-pty/ConPTY), named pipe server, port scanning, git/PR polling, notifications, session persistence, and multi-window lifecycle. Renderer process runs a React/Zustand app with xterm.js (WebGL), recursive split pane layout, and the sidebar UI. Communication via typed contextBridge IPC.

```
src/
  main/           # Electron main process
  renderer/       # React app
  preload/        # contextBridge API
  cli/            # wmux CLI
  shared/         # Types shared between processes
  shell-integration/  # PowerShell, CMD, WSL scripts
```

## Based on cmux

wmux is a Windows reimplementation of [cmux](https://github.com/manaflow-ai/cmux), the macOS terminal for multitasking. Same design, same socket protocol, same philosophy. Tools built for cmux's API work with wmux.

## Contributing

- [GitHub Issues](https://github.com/amirlehmam/wmux/issues) -- bug reports and feature requests
- [GitHub Discussions](https://github.com/amirlehmam/wmux/discussions) -- questions and ideas

## License

AGPL-3.0-or-later. See [LICENSE](LICENSE) for details.
