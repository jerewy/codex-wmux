# wmux — Windows Terminal Multiplexer for AI Agents

**Date:** 2026-03-25
**Status:** Approved
**Based on:** [cmux](https://github.com/manaflow-ai/cmux) (macOS)

## Overview

wmux is a Windows desktop application that replicates cmux's full feature set — a terminal multiplexer designed for running multiple AI coding agents (Claude Code) in parallel, with workspace-aware notifications, live sidebar metadata, split panes, an in-app browser, and a scriptable CLI.

**Tech stack:** Electron + React + TypeScript + xterm.js + node-pty + Zustand

---

## 1. Application Architecture

Two-process Electron model:

**Main process (Node.js):**
- PTY Manager — spawns shells via node-pty (ConPTY on Windows)
- Named Pipe Server — `\\.\pipe\wmux` for CLI and shell integration communication
- Port Scanner — detects listening TCP ports per pane via `netstat -ano` or Win32 `GetExtendedTcpTable`
- Git/PR Poller — runs `git rev-parse`, `git status --porcelain`, `gh pr view` per workspace
- Notification Manager — Windows toast notifications, taskbar flash
- Session Persister — saves/restores workspace state to `%APPDATA%\wmux\sessions\`
- Config Loader — parses Windows Terminal `settings.json` and Ghostty `~/.config/ghostty/config`
- Theme Loader — 450+ bundled Ghostty color themes
- Shell Detector — auto-detects available shells (pwsh, powershell, cmd, wsl)
- Auto-Updater — via electron-updater + GitHub Releases

**Renderer process (Chromium):**
- React app with Zustand state management
- xterm.js terminal instances with WebGL addon
- Split pane layout system (tree-based)
- Sidebar with live workspace metadata
- Browser panels via `<webview>` tag
- Settings UI

**IPC:** Secure contextBridge API — no `nodeIntegration` in renderer. Typed API contract between main and renderer.

**Data flow:**
- Terminal input: xterm.js `onData` → IPC → main → `pty.write()`
- Terminal output: `pty.onData` → IPC → renderer → xterm.js `write()`
- Metadata: shell integration → named pipe → main process → IPC → Zustand store → React UI

---

## 2. Window Layout & Chrome

**Frameless window:**
- `BrowserWindow` with `frame: false`, `titleBarStyle: 'hidden'`, `titleBarOverlay: true`
- Native Windows minimize/maximize/close buttons in top-right
- Custom drag region across the top bar (`-webkit-app-region: drag`)
- Toolbar height: 38px
- Toolbar shows focused pane command/title: 12px system font, medium weight, secondary color

**Layout:**
- Sidebar (left) + Content area (right)
- Sidebar default: 200px, min 180px, max 600px or 1/3 window width
- Resizable via drag handle on right edge
- Sidebar background: `#000000` at 82% opacity with `backdrop-filter: blur(12px)` — emulates cmux's HUD window material
- Toggle with `Ctrl+B`

**Presentation modes:**
- Standard: full titlebar with workspace controls
- Minimal: reduced 30px height strip, controls auto-hidden

---

## 3. Sidebar — Workspace Rows

Each workspace row displays live metadata from shell integration.

**Row layout (top to bottom):**
1. Title (12.5px semibold) + unread badge (16x16 blue circle) + close button (on hover)
2. Notification text (10px, secondary color, 2-line max)
3. Git branch (10px monospace, 75% opacity) with optional branch icon
4. Working directory (10px monospace, 75% opacity, `~` shortened)
5. PR info (10px semibold): status icon + underlined `#number` + state text
6. Listening ports (10px monospace, 75% opacity): `:3000, :8080`

**Dimensions:**
- Row padding: 10px horizontal, 8px vertical
- Row corner radius: 6px
- Row spacing: 2px
- Row margin from sidebar edge: 6px horizontal

**Active tab indicator (default "left rail"):**
- 3px wide colored capsule, 5px vertical padding, 4px leading offset
- Fill: accent blue `#0091FF`
- Alternative "solid fill": accent background + 1.5px border at white 50% opacity

**Selected row:**
- Background: accent blue `#0091FF`
- All text: white (title 100%, metadata 75%, secondary 60%)

**Unread badge:**
- 16x16px blue filled circle (`#0091FF` on inactive, `white @ 25%` on selected)
- Count text: 9px semibold white

**Close button:**
- `x` icon, 9px medium, 16px hit target, visible on hover only

**Context menu (right-click):**
1. Pin / Unpin Workspace
2. Rename Workspace...
3. Remove Custom Workspace Name
4. Workspace Color → submenu (16 presets + custom picker)
5. Move Up / Move Down / Move to Top
6. Move Workspace to Window → submenu
7. Close Workspace / Close Other / Close Above / Close Below
8. Mark as Read / Mark as Unread

**Drag-to-reorder:** supported, multi-selection via Ctrl+click / Shift+click.

**16 preset workspace colors:**
Red `#C0392B`, Crimson `#922B21`, Orange `#A04000`, Amber `#7D6608`, Olive `#4A5C18`, Green `#196F3D`, Teal `#006B6B`, Aqua `#0E6B8C`, Blue `#1565C0`, Navy `#1A5276`, Indigo `#283593`, Purple `#6A1B9A`, Magenta `#AD1457`, Rose `#880E4F`, Brown `#7B3F00`, Charcoal `#3E4B5E`

---

## 4. Terminal Emulation

**xterm.js per pane:**
- WebGL addon for GPU-accelerated rendering
- FitAddon for auto-resize
- WebLinksAddon for clickable URLs
- SearchAddon for find-in-terminal
- Unicode11Addon for Unicode
- ImageAddon for inline images (Sixel/iTerm2)

**Shell spawning (node-pty, main process):**

| Shell | Command | Notes |
|---|---|---|
| PowerShell 7 | `pwsh.exe` | Preferred if available |
| PowerShell 5 | `powershell.exe` | Fallback |
| CMD | `cmd.exe` | Classic prompt |
| WSL | `wsl.exe -d <distro>` | Linux shell |

- Default: auto-detect (pwsh → powershell → cmd)
- Configurable per-workspace
- Environment injected: `WMUX=1`, `WMUX_PANE_ID`, `WMUX_PIPE`

**Theme/config loading (dual source):**
1. Windows Terminal `settings.json` at `%LOCALAPPDATA%\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json`
2. Ghostty config at `~/.config/ghostty/config`
3. 450+ bundled Ghostty themes
4. Fallback defaults (Monokai): background `#272822`, foreground `#fdfff1`, cursor `#c0c1b5`, selection bg `#57584f`, selection fg `#fdfff1`

**Copy/paste:**
- `Ctrl+Shift+C` / `Ctrl+Shift+V`
- `Ctrl+C` copies when selection exists, sends SIGINT when no selection

---

## 5. Split Pane System

Tree-based split layout (equivalent to cmux's Bonsplit library).

**Data structure:**
```typescript
type SplitNode =
  | { type: 'leaf'; panelId: string; panelType: 'terminal' | 'browser' }
  | { type: 'branch'; direction: 'horizontal' | 'vertical';
      ratio: number; children: [SplitNode, SplitNode] }
```

**Shortcuts:**
- Split Right: `Ctrl+D`
- Split Down: `Ctrl+Shift+D`
- Split Browser Right: `Ctrl+Alt+D`
- Split Browser Down: `Ctrl+Shift+Alt+D`
- Toggle Pane Zoom: `Ctrl+Shift+Enter`
- Focus Left/Right/Up/Down: `Ctrl+Alt+Arrow`
- Next/Previous Pane: `Ctrl+Shift+]` / `Ctrl+Shift+[`

**Divider:**
- 1px rendered line, 4-6px invisible hit target
- Color: terminal background darkened 40% (dark) or 8% (light)
- Cursor: `col-resize` / `row-resize` on hover

**Behavior:**
- Min pane size: 80px in either dimension
- Resize triggers FitAddon recalculation + `pty.resize()`
- Unfocused pane dimming: 30% opacity overlay (configurable, default `unfocused-split-opacity: 0.7`)
- Zoom: focused pane fills content area, others hidden
- Pane close: leaf removed, branch collapses if one child remains

---

## 6. Notification System

**Three input sources:**
1. OSC escape sequences (OSC 9/99/777) — parsed via xterm.js `parser.registerOscHandler()`
2. `wmux notify` CLI command — sent over named pipe
3. Shell integration detecting agent idle state

**Notification effects (in order):**

**1. Pane ring (blue glow):**
- 2.5px rounded-rect stroke, `#007AFF` (systemBlue), inset 2px from pane bounds
- Corner radius: 6px
- Shadow: `#007AFF`, opacity 0.35, radius 3px
- Flash animation: 0.9s double-pulse, opacity `[0, 1, 0, 1, 0]` at times `[0, 0.25, 0.5, 0.75, 1.0]`, ease-in/ease-out
- Ring stays visible until pane is focused

**2. Sidebar badge:**
- Blue circle `#0091FF`, 16x16px, white count text 9px semibold
- Workspace auto-reorders to top (configurable)

**3. Windows toast:**
- Electron `new Notification()` API
- Click: focuses window, switches to workspace
- Sound: configurable

**4. Taskbar flash:**
- `BrowserWindow.flashFrame(true)`
- Stops when window focused

**Two accent types:**
- Notification blue: `#007AFF`, glow opacity 0.6, radius 6px
- Navigation teal: `#5AC8FA`, glow opacity 0.14, radius 3px

**Clearing:** Focus pane = mark read. `Ctrl+Shift+U` = jump to latest unread.

---

## 7. Socket Server & CLI

**Named pipe server (main process):**
- Path: `\\.\pipe\wmux` (default), `\\.\pipe\wmux-<username>` for multi-user
- Current-user-only security descriptor
- Multiple simultaneous clients

**V1 protocol (text, shell integration):**
```
report_pwd <surface_id> <path>
report_git_branch <surface_id> <branch> [dirty]
clear_git_branch <surface_id>
report_pr <surface_id> <number> <status> <label>
clear_pr <surface_id>
report_tty <surface_id> <tty_path>
report_shell_state <surface_id> idle|running
ports_kick <surface_id>
notify <surface_id> <text>
ping
```

**V2 protocol (JSON-RPC, CLI and automation):**
```json
{"method": "workspace.create", "params": {"title": "...", "shell": "pwsh"}}
{"method": "workspace.select", "params": {"id": "..."}}
{"method": "workspace.list", "params": {}}
{"method": "pane.split", "params": {"direction": "right", "type": "terminal"}}
{"method": "pane.focus", "params": {"id": "..."}}
{"method": "browser.navigate", "params": {"url": "..."}}
{"method": "browser.snapshot", "params": {}}
{"method": "browser.click", "params": {"selector": "..."}}
{"method": "browser.fill", "params": {"selector": "...", "value": "..."}}
{"method": "browser.evaluate", "params": {"script": "..."}}
{"method": "notification.list", "params": {}}
{"method": "notification.clear", "params": {"id": "..."}}
```

**CLI (`wmux.exe`):**
```
wmux notify "Build done"
wmux list
wmux select <id>
wmux split --right
wmux browser open <url>
wmux ping
wmux list-notifications
wmux clear-notifications
```

**Authentication:** Windows named pipe security descriptors (current user only). Optional password file at `%APPDATA%\wmux\socket-password`.

---

## 8. Shell Integration

**Three integration scripts, auto-injected when wmux spawns a pane:**

### PowerShell (`wmux-powershell-integration.ps1`)
- Overrides `prompt` function
- Reports: CWD (`$PWD`), git branch + dirty, shell state (idle/running)
- PR polling: background job with `gh pr view` every 45 seconds
- Port scan kick after command completion
- Injected via `-NoExit -Command ". 'path\to\integration.ps1'"`

### CMD (`wmux-cmd-integration.cmd`)
- CWD reporting via OSC 9 escape sequences in `PROMPT`
- Git branch via filesystem watcher on `.git/HEAD` (main process fallback)
- Injected via `cmd.exe /K "path\to\integration.cmd"`

### WSL Bash/Zsh (`wmux-bash-integration.sh`)
- Near-identical to cmux's bash/zsh integration
- `PROMPT_COMMAND` (bash) or `precmd`/`preexec` (zsh) hooks
- Communicates via temp file or named pipe through `/mnt/c/` interop
- Reports: CWD, git branch, PR status, shell state, port kicks
- Sourced via `WMUX_INTEGRATION=1` env var detection in `.bashrc`/`.zshrc`

**Environment variables injected into all shells:**

| Variable | Value | Purpose |
|---|---|---|
| `WMUX` | `1` | Detect running inside wmux |
| `WMUX_PANE_ID` | `pane-<uuid>` | Pane identity |
| `WMUX_PIPE` | `\\.\pipe\wmux` | Named pipe path |
| `WMUX_SURFACE_ID` | `<uuid>` | Surface ID for socket protocol |

**Port scanning (main process):**
- `netstat -ano` parsed output or Win32 `GetExtendedTcpTable` API
- Coalesce pattern: 200ms after kick, burst at `[0.5, 1.5, 3, 5, 7.5, 10]` seconds
- Maps PIDs to panes via process tree tracking

---

## 9. Browser Panel

**Electron `<webview>` tag** — sandboxed Chromium instance per panel.

**Address bar (omnibar):**
- Back/Forward/Refresh-Stop buttons
- URL pill: corner radius 10px, editable
- DevTools toggle: 11px icon, 16 icon options, configurable
- Button size: 22px, hit target: 26px, vertical padding: 4px
- Hover state: rounded rect, corner radius 8, bg opacity 0.08, pressed 0.16
- Chrome background: terminal bg color, pill darkened 5% (dark) / 4% (light)

**Scriptable API (via named pipe V2):**
- `browser.navigate` — go to URL
- `browser.snapshot` — dump accessibility tree (for AI agents)
- `browser.click` — click by CSS selector
- `browser.fill` — fill input by selector
- `browser.evaluate` — execute JS, return result
- `browser.back` / `browser.forward` / `browser.reload`

**Accessibility snapshot:** injected script walks DOM, extracts roles/labels/text as structured data. Enables Claude Code to "see" pages without screenshots.

**Search engine:** configurable (Google default), suggestions toggle.

---

## 10. Session Persistence

**Saved to `%APPDATA%\wmux\sessions\session.json`:**
- Window bounds (position, size)
- Sidebar width
- All workspaces: id, title, color, pin state, shell type
- Split tree per workspace (directions, ratios, panel types)
- Working directory per terminal pane
- Browser panel URLs
- Active workspace and pane
- Terminal scrollback (optional, configurable max)

**NOT restored:** running processes, shell state/history, notifications, port state, git/PR state.

**Save triggers:** auto-save every 30s (debounced), on workspace/split changes, on window resize, on quit.

**Crash recovery:** atomic write (temp file + rename). Corrupted file → single default workspace fallback.

---

## 11. Settings & Preferences

Settings window via `Ctrl+,`. Stored at `%APPDATA%\wmux\settings.json`.

**Sidebar tab:**
- Toggle: git branch, branch icon, branch vertical layout, working directory, PR, SSH, ports, log, progress, status pills, notification message, hide all details
- Active tab indicator: Left Rail / Solid Fill
- Background opacity slider, background preset dropdown (6 presets)

**Workspace tab:**
- New workspace placement: After Current / Top / End
- Auto-reorder on notification, close on last pane, presentation mode, button fade, titlebar visible
- Default shell: PowerShell / CMD / WSL / Auto-detect

**Terminal tab:**
- Font family picker, font size, theme (450+ themes with preview), background opacity, unfocused pane opacity, cursor style/blink, scrollback lines
- Import from Windows Terminal / Import from Ghostty buttons

**Notifications tab:**
- Toggle: toast notifications, taskbar flash, pane ring, pane flash animation
- Sound: Default / None / Custom file

**Browser tab:**
- Search engine, suggestions, DevTools icon, PR links in wmux browser

**Keyboard Shortcuts tab:**
- All ~30 shortcuts listed, each with record button for rebinding
- Conflict detection, Reset All button
- Stored in `%APPDATA%\wmux\keybindings.json`

---

## 12. Keyboard Shortcuts

All cmux `Cmd` shortcuts mapped to `Ctrl` on Windows.

**Workspace:**
| Action | Shortcut |
|---|---|
| New Workspace | `Ctrl+N` |
| New Window | `Ctrl+Shift+N` |
| Close Workspace | `Ctrl+Shift+W` |
| Close Window | `Ctrl+Alt+W` |
| Open Folder | `Ctrl+O` |
| Toggle Sidebar | `Ctrl+B` |
| Next Workspace | `Ctrl+PageDown` |
| Previous Workspace | `Ctrl+PageUp` |
| Select Workspace 1-9 | `Ctrl+1...9` |
| Rename Workspace | `Ctrl+Shift+R` |

**Panes:**
| Action | Shortcut |
|---|---|
| Split Right | `Ctrl+D` |
| Split Down | `Ctrl+Shift+D` |
| Split Browser Right | `Ctrl+Alt+D` |
| Split Browser Down | `Ctrl+Shift+Alt+D` |
| Toggle Zoom | `Ctrl+Shift+Enter` |
| Focus Left/Right/Up/Down | `Ctrl+Alt+Arrow` |
| Next/Previous Pane | `Ctrl+Shift+]` / `[` |
| Close Pane | `Ctrl+W` |

**Notifications:**
| Action | Shortcut |
|---|---|
| Jump to Unread | `Ctrl+Shift+U` |
| Show Notifications | `Ctrl+I` |
| Flash Focused | `Ctrl+Shift+H` |

**Browser:**
| Action | Shortcut |
|---|---|
| Open Browser | `Ctrl+Shift+L` |
| Browser DevTools | `Ctrl+Alt+I` |
| Browser Console | `Ctrl+Alt+C` |

**Terminal:**
| Action | Shortcut |
|---|---|
| Find | `Ctrl+Shift+F` |
| Copy Mode | `Ctrl+Shift+M` |
| Copy | `Ctrl+Shift+C` |
| Paste | `Ctrl+Shift+V` |
| Font Size +/- | `Ctrl+=` / `Ctrl+-` |
| Settings | `Ctrl+,` |
| Command Palette | `Ctrl+Shift+P` |

All shortcuts fully rebindable.

---

## 13. Project Structure

```
wmux/
├── package.json
├── tsconfig.json
├── electron-builder.json
├── .gitignore
├── README.md
├── src/
│   ├── main/
│   │   ├── index.ts                # app entry, window creation, menu
│   │   ├── pty-manager.ts          # node-pty spawning & lifecycle
│   │   ├── pipe-server.ts          # named pipe server (V1 + V2)
│   │   ├── port-scanner.ts         # netstat-based port detection
│   │   ├── git-poller.ts           # git branch + dirty detection
│   │   ├── pr-poller.ts            # gh pr view polling
│   │   ├── notification-manager.ts # toast + taskbar flash
│   │   ├── session-persistence.ts  # save/restore state
│   │   ├── config-loader.ts        # Windows Terminal + Ghostty parsing
│   │   ├── theme-loader.ts         # 450+ bundled themes
│   │   ├── shell-detector.ts       # auto-detect shells
│   │   ├── ipc-handlers.ts         # contextBridge registration
│   │   └── updater.ts              # auto-update
│   ├── renderer/
│   │   ├── index.html
│   │   ├── index.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Sidebar/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── WorkspaceRow.tsx
│   │   │   │   ├── UnreadBadge.tsx
│   │   │   │   ├── PrStatusIcon.tsx
│   │   │   │   ├── WorkspaceContextMenu.tsx
│   │   │   │   └── SidebarResizeHandle.tsx
│   │   │   ├── SplitPane/
│   │   │   │   ├── SplitContainer.tsx
│   │   │   │   ├── SplitDivider.tsx
│   │   │   │   └── PaneWrapper.tsx
│   │   │   ├── Terminal/
│   │   │   │   ├── TerminalPane.tsx
│   │   │   │   ├── NotificationRing.tsx
│   │   │   │   ├── UnfocusedOverlay.tsx
│   │   │   │   ├── FindBar.tsx
│   │   │   │   └── CopyMode.tsx
│   │   │   ├── Browser/
│   │   │   │   ├── BrowserPane.tsx
│   │   │   │   ├── AddressBar.tsx
│   │   │   │   └── DevToolsToggle.tsx
│   │   │   ├── Titlebar/
│   │   │   │   └── Titlebar.tsx
│   │   │   └── Settings/
│   │   │       ├── SettingsWindow.tsx
│   │   │       ├── SidebarSettings.tsx
│   │   │       ├── WorkspaceSettings.tsx
│   │   │       ├── TerminalSettings.tsx
│   │   │       ├── NotificationSettings.tsx
│   │   │       ├── BrowserSettings.tsx
│   │   │       ├── KeyboardSettings.tsx
│   │   │       └── ShortcutRecorder.tsx
│   │   ├── store/
│   │   │   ├── index.ts
│   │   │   ├── workspace-slice.ts
│   │   │   ├── split-slice.ts
│   │   │   ├── notification-slice.ts
│   │   │   ├── settings-slice.ts
│   │   │   └── terminal-slice.ts
│   │   ├── hooks/
│   │   │   ├── useTerminal.ts
│   │   │   ├── useSplitPane.ts
│   │   │   ├── useKeyboardShortcuts.ts
│   │   │   └── useIpc.ts
│   │   └── styles/
│   │       ├── global.css
│   │       ├── sidebar.css
│   │       ├── terminal.css
│   │       ├── browser.css
│   │       ├── settings.css
│   │       └── titlebar.css
│   ├── preload/
│   │   └── index.ts
│   ├── cli/
│   │   └── wmux.ts
│   └── shell-integration/
│       ├── wmux-powershell-integration.ps1
│       ├── wmux-bash-integration.sh
│       └── wmux-cmd-integration.cmd
├── resources/
│   ├── icons/
│   ├── themes/                     # 450+ Ghostty themes
│   └── sounds/
└── tests/
    ├── unit/
    └── e2e/
```

**Build tooling:** Vite (renderer), electron-builder (packaging), electron-updater (auto-update)

**Key dependencies:** electron, node-pty, @xterm/xterm, @xterm/addon-webgl, @xterm/addon-fit, @xterm/addon-web-links, @xterm/addon-search, @xterm/addon-unicode11, @xterm/addon-image, react, react-dom, zustand, vite, electron-builder, electron-updater
