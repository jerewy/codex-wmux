# Codex Terminal

Codex Terminal is a local Windows terminal app forked from `wmux` and stripped down for one purpose: running Codex comfortably in a real desktop terminal.

This is not the previous `codex-session` script/dashboard prototype. This is an Electron + xterm.js + node-pty terminal application.

## Attribution

This repository is based on the upstream `wmux` project:

```text
https://github.com/amirlehmam/wmux
```

Codex Terminal keeps the upstream MIT license and adds local changes focused on Codex session restore, usage status, and safer Windows terminal behavior.

## What It Does

- Opens as a desktop terminal app.
- Keeps wmux's panes, tabs, workspaces, sidebar, settings, and session layout foundation.
- Starts a Codex workspace and runs:

```powershell
codex --no-alt-screen
```

## Safety Changes From wmux

This fork intentionally disables the high-risk or nonessential wmux behaviors:

- No edits to `~\.claude\CLAUDE.md`.
- No edits to `~\.claude\settings.json`.
- No auto-installed Claude plugins.
- No named pipe automation server.
- No localhost CDP browser proxy.
- No auto-updater.
- No Mark-of-the-Web stripping.
- No shell integration script injection.

Session layout state is stored under:

```text
%APPDATA%\CodexTerminal
```

User config is read from:

```text
%USERPROFILE%\.codex-terminal\config.toml
```

## Run In Development

```powershell
cd C:\dev\codex-terminal
npm run build:main
npm run build:renderer
npx electron .
```

For live development:

```powershell
npm run dev
```

## Reopening After Accidental Close

Codex Terminal auto-saves the workspace layout while it is running and again when the app quits. On the next launch, it restores the last workspace and changes saved Codex terminals to:

```powershell
codex resume --last --no-alt-screen
```

That resumes the most recent Codex interactive session in the restored project folder. This depends on Codex CLI's own session history; the terminal process itself cannot survive after Windows closes the app.

## Current Scope

This is the first safe fork, not the final polished product. The next useful improvements are:

- Rename remaining internal `wmux` API labels to `codex-terminal`.
- Add readable Codex chat archive import from `~\.codex\sessions`.
- Simplify the UI by removing browser, orchestration, and Claude-specific panels from the renderer.
- Package a portable `.zip` build with a desktop shortcut.
