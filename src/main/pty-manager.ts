import * as pty from 'node-pty';
import * as path from 'path';
import * as fs from 'fs';
import { execFileSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { SurfaceId } from '../shared/types';
import { isCodexCommandLine, markSurfaceAsCodex } from './codex-session-resolver';

// ─── Shell resolution ──────────────────────────────────────────────────────
// Validates that a shell executable exists before spawning.
// Falls back through: pwsh.exe → powershell.exe → cmd.exe

let cachedDefaultShell: string | null = null;

function isShellAvailable(shell: string): boolean {
  if (!shell) return false;
  if (path.isAbsolute(shell)) {
    return fs.existsSync(shell);
  }
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    execFileSync(cmd, [shell], { windowsHide: true, timeout: 3000, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getDefaultShell(): string {
  if (cachedDefaultShell) return cachedDefaultShell;
  const candidates = process.platform === 'win32'
    ? ['pwsh.exe', 'powershell.exe', 'cmd.exe']
    : [process.env.SHELL || '/bin/sh'];
  for (const cmd of candidates) {
    if (isShellAvailable(cmd)) {
      cachedDefaultShell = cmd;
      return cmd;
    }
  }
  // cmd.exe is always available on Windows
  cachedDefaultShell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
  return cachedDefaultShell;
}

function resolveShell(shell: string | undefined): string {
  if (shell && isShellAvailable(shell)) {
    return shell;
  }
  if (shell) {
    console.warn(`[wmux] Shell not found: "${shell}", falling back to ${getDefaultShell()}`);
  }
  return getDefaultShell();
}

function getCliPath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron') as typeof import('electron');
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'cli', 'wmux.js');
    }
  } catch {
    // Not running in Electron
  }
  return path.join(__dirname, '../cli/wmux.js');
}

function getShellIntegrationPath(scriptName: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron') as typeof import('electron');
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'shell-integration', scriptName);
    }
  } catch {
    // Not running in Electron
  }
  return path.resolve(path.join(__dirname, '../../src/shell-integration', scriptName));
}

function getShellType(shell: string): 'powershell' | 'cmd' | 'wsl' | 'unknown' {
  const lower = shell.toLowerCase();
  if (lower.includes('pwsh') || lower.includes('powershell')) return 'powershell';
  if (lower.includes('cmd')) return 'cmd';
  if (lower.includes('wsl')) return 'wsl';
  return 'unknown';
}

function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

export function getShellLaunchArgs(shell: string): string[] {
  switch (getShellType(shell)) {
    case 'powershell': {
      const integrationPath = getShellIntegrationPath('wmux-powershell-integration.ps1');
      return [
        '-NoLogo',
        '-NoExit',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `. '${escapePowerShellSingleQuoted(integrationPath)}'`,
      ];
    }
    case 'cmd':
      return ['/K', getShellIntegrationPath('wmux-cmd-integration.cmd')];
    default:
      return [];
  }
}

interface PtyEntry {
  pty: pty.IPty;
  dataListeners: Set<(data: string) => void>;
  exitListeners: Set<(code: number) => void>;
}

export interface CreateOptions {
  shell: string;
  cwd: string;
  env: Record<string, string>;
  initialCommand?: string;
  cols?: number;
  rows?: number;
  /** When provided, use this as the PTY key instead of generating a new one.
   *  This keeps Surface IDs and PTY IDs in sync for reliable re-attachment. */
  surfaceId?: SurfaceId;
}

export class PtyManager {
  private ptys = new Map<SurfaceId, PtyEntry>();

  create(options: CreateOptions): { id: SurfaceId; shell: string; cwd: string } {
    const id: SurfaceId = options.surfaceId ?? `surf-${uuidv4()}` as SurfaceId;

    const shell = resolveShell(options.shell);
    const cwd = options.cwd || process.env.USERPROFILE || process.env.HOME || process.cwd();
    const cliPath = getCliPath();
    // Filter out undefined values from process.env before merging
    const processEnvClean = Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
    );
    const env: { [key: string]: string } = {
      ...processEnvClean,
      ...options.env,
      WMUX: '1',
      WMUX_SURFACE_ID: id,
      WMUX_PIPE: '\\\\.\\pipe\\wmux',
      WMUX_CLI: cliPath,
      WMUX_INTEGRATION: '1',
      CODEX_TERMINAL: '1',
      CODEX_TERMINAL_SURFACE_ID: id,
      CODEX_TERMINAL_CLI: cliPath,
      CODEX_TERMINAL_INTEGRATION: '1',
    };

    const args = getShellLaunchArgs(shell);

    const ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-256color',
      cols: options.cols ?? 80,
      rows: options.rows ?? 24,
      cwd,
      env,
      useConpty: true,
    });

    const entry: PtyEntry = {
      pty: ptyProcess,
      dataListeners: new Set(),
      exitListeners: new Set(),
    };

    ptyProcess.onData((data) => {
      for (const listener of entry.dataListeners) {
        listener(data);
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      for (const listener of entry.exitListeners) {
        listener(exitCode);
      }
      this.ptys.delete(id);
    });

    this.ptys.set(id, entry);

    if (options.initialCommand) {
      setTimeout(() => {
        if (this.ptys.has(id)) {
          if (isCodexCommandLine(options.initialCommand!)) {
            markSurfaceAsCodex(id);
          }
          ptyProcess.write(`${options.initialCommand}\r`);
        }
      }, 500);
    }

    return { id, shell, cwd };
  }

  write(id: SurfaceId, data: string): void {
    const entry = this.ptys.get(id);
    if (entry) {
      entry.pty.write(data);
    }
  }

  resize(id: SurfaceId, cols: number, rows: number): void {
    const entry = this.ptys.get(id);
    if (entry) {
      entry.pty.resize(cols, rows);
    }
  }

  kill(id: SurfaceId): void {
    const entry = this.ptys.get(id);
    if (entry) {
      try {
        entry.pty.kill();
      } catch {
        // Process may already be dead
      }
      this.ptys.delete(id);
    }
  }

  killAll(): void {
    for (const id of this.ptys.keys()) {
      this.kill(id);
    }
  }

  has(id: SurfaceId): boolean {
    return this.ptys.has(id);
  }

  onData(id: SurfaceId, callback: (data: string) => void): () => void {
    const entry = this.ptys.get(id);
    if (!entry) {
      return () => {};
    }
    entry.dataListeners.add(callback);
    return () => entry.dataListeners.delete(callback);
  }

  onExit(id: SurfaceId, callback: (code: number) => void): () => void {
    const entry = this.ptys.get(id);
    if (!entry) {
      return () => {};
    }
    entry.exitListeners.add(callback);
    return () => entry.exitListeners.delete(callback);
  }

  getPid(id: SurfaceId): number | undefined {
    const entry = this.ptys.get(id);
    return entry?.pty.pid;
  }
}
