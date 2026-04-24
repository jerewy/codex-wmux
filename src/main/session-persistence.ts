import fs from 'fs';
import path from 'path';
import os from 'os';

const APPDATA_DIR = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'CodexTerminal');
const SESSIONS_DIR = path.join(APPDATA_DIR, 'sessions');
const SESSION_FILE = path.join(SESSIONS_DIR, 'session.json');
const VERSION_FILE = path.join(APPDATA_DIR, 'app-version.txt');
const SAVED_DIR = path.join(APPDATA_DIR, 'sessions', 'saved');
const LAST_SESSION_FILE = path.join(APPDATA_DIR, 'sessions', 'last-session.txt');

export interface SessionData {
  version: 1;
  windows: Array<{
    bounds: { x: number; y: number; width: number; height: number };
    sidebarWidth: number;
    activeWorkspaceId: string | null;
    workspaces: Array<{
      id: string;
      title: string;
      customColor?: string;
      pinned: boolean;
      shell: string;
      cwd?: string;
      splitTree: any; // SplitNode serialized
      browserUrl?: string;
    }>;
  }>;
}

function isCodexSurface(surface: any): boolean {
  const startsCodex = typeof surface?.initialCommand === 'string' && /^codex(\s|$)/i.test(surface.initialCommand.trim());
  return surface?.customTitle === 'Codex' || startsCodex || Boolean(surface?.codexSessionId);
}

function refreshCodexSurfaces(node: any): any {
  if (!node) return node;
  if (node.type === 'branch') {
    return {
      ...node,
      children: Array.isArray(node.children)
        ? node.children.map(refreshCodexSurfaces)
        : node.children,
    };
  }
  if (node.type !== 'leaf' || !Array.isArray(node.surfaces)) return node;

  return {
    ...node,
    surfaces: node.surfaces.map((surface: any) => {
      if (!isCodexSurface(surface)) return surface;
      const {
        codexSessionId: _codexSessionId,
        codexSessionModel: _codexSessionModel,
        ...surfaceWithoutOldSession
      } = surface;
      return {
        ...surfaceWithoutOldSession,
        customTitle: surfaceWithoutOldSession.customTitle || 'Codex',
        initialCommand: 'codex --no-alt-screen',
        codexAccountRefreshed: true,
      };
    }),
  };
}

export function refreshCodexWorkspacesForAccountSwitch<T extends { splitTree?: any }>(workspaces: T[] | undefined): T[] | undefined {
  if (!Array.isArray(workspaces)) return workspaces;
  return workspaces.map((workspace) => ({
    ...workspace,
    splitTree: refreshCodexSurfaces(workspace.splitTree),
  }));
}

function refreshSessionDataCodexAccount(data: SessionData): SessionData {
  return {
    ...data,
    windows: data.windows.map((window) => ({
      ...window,
      workspaces: refreshCodexWorkspacesForAccountSwitch(window.workspaces) ?? window.workspaces,
    })),
  };
}

function refreshNamedSessionCodexAccount(session: import('../shared/types').SavedSession): import('../shared/types').SavedSession {
  return {
    ...session,
    workspaces: refreshCodexWorkspacesForAccountSwitch(session.workspaces) ?? session.workspaces,
  };
}

export function ensureDirectories(): void {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

export function saveSession(data: SessionData): void {
  ensureDirectories();
  // Atomic write: write to temp file, then rename
  const tmpFile = SESSION_FILE + '.tmp';
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    // On Windows, rename won't overwrite, so remove first
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
    }
    fs.renameSync(tmpFile, SESSION_FILE);
  } catch (err) {
    // Clean up temp file if it exists
    try { fs.unlinkSync(tmpFile); } catch {}
    console.error('Failed to save session:', err);
  }
}

export function loadSession(): SessionData | null {
  try {
    if (!fs.existsSync(SESSION_FILE)) return null;
    const raw = fs.readFileSync(SESSION_FILE, 'utf-8');
    const data = JSON.parse(raw) as SessionData;
    if (data.version !== 1) return null;
    return data;
  } catch {
    // Corrupted file — fall back to default
    return null;
  }
}

export function getSessionPath(): string {
  return SESSION_FILE;
}

export function refreshSavedCodexAccountState(): void {
  ensureDirectories();
  try {
    const session = loadSession();
    if (session) {
      saveSession(refreshSessionDataCodexAccount(session));
    }
  } catch {
    // Account refresh must not block logout/login if session metadata is partial.
  }

  if (!fs.existsSync(SAVED_DIR)) return;
  for (const fileName of fs.readdirSync(SAVED_DIR)) {
    if (!fileName.endsWith('.json')) continue;
    const filePath = path.join(SAVED_DIR, fileName);
    try {
      const session = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as import('../shared/types').SavedSession;
      fs.writeFileSync(filePath, JSON.stringify(refreshNamedSessionCodexAccount(session), null, 2), 'utf-8');
    } catch {
      // Leave unreadable user snapshots untouched.
    }
  }
}

/** Returns true if the app version changed (or first launch). Preserves saved sessions across upgrades. */
export function handleVersionChange(currentVersion: string): boolean {
  ensureDirectories();
  try {
    const saved = fs.existsSync(VERSION_FILE) ? fs.readFileSync(VERSION_FILE, 'utf-8').trim() : '';
    if (saved === currentVersion) return false;
    fs.writeFileSync(VERSION_FILE, currentVersion, 'utf-8');
    return true;
  } catch { return false; }
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\- ]/g, '_').substring(0, 100);
}

export function saveNamedSession(session: import('../shared/types').SavedSession): void {
  if (!fs.existsSync(SAVED_DIR)) fs.mkdirSync(SAVED_DIR, { recursive: true });
  const filePath = path.join(SAVED_DIR, sanitizeName(session.name) + '.json');
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
  setLastSessionName(session.name);
}

export function loadNamedSession(name: string): import('../shared/types').SavedSession | null {
  try {
    const filePath = path.join(SAVED_DIR, sanitizeName(name) + '.json');
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch { return null; }
}

export function listNamedSessions(): Array<{ name: string; savedAt: number; workspaceCount: number }> {
  if (!fs.existsSync(SAVED_DIR)) return [];
  try {
    return fs.readdirSync(SAVED_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(SAVED_DIR, f), 'utf-8'));
          return { name: data.name, savedAt: data.savedAt, workspaceCount: data.workspaces?.length || 0 };
        } catch { return null; }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch { return []; }
}

export function deleteNamedSession(name: string): boolean {
  try {
    const filePath = path.join(SAVED_DIR, sanitizeName(name) + '.json');
    if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); return true; }
    return false;
  } catch { return false; }
}

export function getLastSessionName(): string | null {
  try {
    if (!fs.existsSync(LAST_SESSION_FILE)) return null;
    return fs.readFileSync(LAST_SESSION_FILE, 'utf-8').trim() || null;
  } catch { return null; }
}

export function setLastSessionName(name: string): void {
  if (!fs.existsSync(SAVED_DIR)) fs.mkdirSync(SAVED_DIR, { recursive: true });
  fs.writeFileSync(LAST_SESSION_FILE, name, 'utf-8');
}
