# wmux — Development Guide

Electron-based Windows terminal multiplexer for AI agents. TypeScript, React 19, Zustand, xterm.js, node-pty.

## Build & Dev

```bash
npm run dev          # Start dev (Vite + Electron)
npm run build:main   # Compile main/preload/cli only (fast)
npm run build        # Full production build
npm test             # Vitest
```

## Architecture

- `src/main/` — Electron main process (pipe server, CDP bridge, agent manager, PTY, session persistence)
- `src/renderer/` — React UI (split panes, browser, sidebar, titlebar)
- `src/preload/` — contextBridge API (`window.wmux`)
- `src/cli/wmux.ts` — CLI that talks to the named pipe `\\.\pipe\wmux`
- `src/shared/types.ts` — Shared types (IPC channels, branded IDs)
- `src/shell-integration/` — Shell hooks (bash/zsh/PowerShell/cmd)

## Key Systems

- **Named pipe** (`pipe-server.ts`): JSON-RPC v2 on `\\.\pipe\wmux`. V1 text protocol for shell integration, V2 JSON for CLI/agents.
- **CDP bridge** (`cdp-bridge.ts`): Controls browser webview via Chrome DevTools Protocol. Accessibility tree with @eN refs.
- **Agent manager** (`agent-manager.ts`): Spawns sub-agent PTYs, round-robin distribution across panes.
- **Claude context** (`claude-context.ts`): Auto-injects wmux instructions into `~/.claude/CLAUDE.md` on startup using `<!-- wmux:start -->` / `<!-- wmux:end -->` markers.

## Conventions

- Branded ID types: `WorkspaceId`, `PaneId`, `SurfaceId`, `WindowId`
- State management: Zustand slices in `src/renderer/store/`
- IPC channels defined in `src/shared/types.ts` → `IPC_CHANNELS`
- CSS in `src/renderer/styles/`, component-scoped by class prefix
