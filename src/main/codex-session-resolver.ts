import fs from 'fs';
import os from 'os';
import path from 'path';

interface CodexSessionMeta {
  id: string;
  cwd: string;
  timestamp: string;
}

interface CodexSessionCandidate extends CodexSessionMeta {
  mtimeMs: number;
  model?: string;
}

const SESSION_ID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const MODEL_PATTERN = /^[A-Za-z0-9._:-]+$/;
const codexSurfaceIds = new Set<string>();
const ptyInputBuffers = new Map<string, string>();

function normalizePathForCompare(value: string): string {
  return path.resolve(value).toLowerCase();
}

function isValidCodexSessionId(value: unknown): value is string {
  return typeof value === 'string' && SESSION_ID_PATTERN.test(value.trim());
}

function isSafeCodexModel(value: unknown): value is string {
  return typeof value === 'string' && MODEL_PATTERN.test(value.trim());
}

export function parseCodexSessionMeta(line: string): CodexSessionMeta | null {
  try {
    const entry = JSON.parse(line);
    const payload = entry?.payload;
    if (entry?.type !== 'session_meta') return null;
    if (typeof payload?.id !== 'string' || typeof payload?.cwd !== 'string') return null;

    return {
      id: payload.id,
      cwd: payload.cwd,
      timestamp: typeof payload.timestamp === 'string' ? payload.timestamp : '',
    };
  } catch {
    return null;
  }
}

export function parseCodexTurnContextModel(line: string): string | null {
  try {
    const entry = JSON.parse(line);
    if (entry?.type !== 'turn_context') return null;
    const model = entry?.payload?.model;
    return isSafeCodexModel(model) ? model.trim() : null;
  } catch {
    return null;
  }
}

export function isCodexCommandLine(command: string): boolean {
  return /^\s*codex(\s|$)/i.test(command.trim());
}

function collectJsonlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsonlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      files.push(fullPath);
    }
  }
  return files;
}

function findCodexSessionModelInFile(filePath: string): string {
  try {
    const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
    for (const line of lines) {
      const model = parseCodexTurnContextModel(line);
      if (model) return model;
    }
  } catch {
    // Codex may be writing the file while we scan; treat the model as unknown.
  }
  return '';
}

export function findCodexSessionModelById(sessionId: string): string {
  if (!isValidCodexSessionId(sessionId)) return '';

  const sessionsDir = process.env.CODEX_SESSIONS_DIR || path.join(os.homedir(), '.codex', 'sessions');
  for (const filePath of collectJsonlFiles(sessionsDir)) {
    try {
      const firstLine = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/, 1)[0];
      const meta = parseCodexSessionMeta(firstLine);
      if (meta?.id !== sessionId && !path.basename(filePath).includes(sessionId)) continue;
      return findCodexSessionModelInFile(filePath);
    } catch {
      // Skip locked or partial session files.
    }
  }
  return '';
}

export function findLatestCodexSessionForCwd(cwd: string): { id: string; model?: string } | null {
  if (!cwd.trim()) return null;

  const sessionsDir = process.env.CODEX_SESSIONS_DIR || path.join(os.homedir(), '.codex', 'sessions');
  const targetCwd = normalizePathForCompare(cwd);
  const candidates: CodexSessionCandidate[] = [];

  for (const filePath of collectJsonlFiles(sessionsDir)) {
    try {
      const firstLine = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/, 1)[0];
      const meta = parseCodexSessionMeta(firstLine);
      if (!meta || normalizePathForCompare(meta.cwd) !== targetCwd) continue;

      candidates.push({
        ...meta,
        mtimeMs: fs.statSync(filePath).mtimeMs,
        model: findCodexSessionModelInFile(filePath) || undefined,
      });
    } catch {
      // Codex may be writing the file while we scan; skip partial reads.
    }
  }

  candidates.sort((a, b) => {
    const byMtime = b.mtimeMs - a.mtimeMs;
    if (byMtime !== 0) return byMtime;
    return Date.parse(b.timestamp || '0') - Date.parse(a.timestamp || '0');
  });

  const latest = candidates[0];
  return latest ? { id: latest.id, model: latest.model } : null;
}

export function findLatestCodexSessionIdForCwd(cwd: string): string | null {
  return findLatestCodexSessionForCwd(cwd)?.id ?? null;
}

function getCodexStateRoot(): string {
  return process.env.CODEX_TERMINAL_STATE_ROOT || path.join(os.homedir(), '.codex', 'state');
}

function getSurfaceStateKey(surfaceId: string): string {
  return surfaceId.replace(/[^A-Za-z0-9_.-]/g, '_');
}

function getSurfaceStatePath(surfaceId: unknown, stateType: SurfaceStateType): string {
  if (typeof surfaceId !== 'string' || !surfaceId.trim()) return '';
  return path.join(getCodexStateRoot(), stateType, `${getSurfaceStateKey(surfaceId)}.txt`);
}

type SurfaceStateType = 'terminal-directories' | 'terminal-sessions' | 'terminal-active-codex';

function readSurfaceState(surfaceId: unknown, stateType: SurfaceStateType): string {
  try {
    const filePath = getSurfaceStatePath(surfaceId, stateType);
    if (!filePath) return '';
    if (!fs.existsSync(filePath)) return '';
    return fs.readFileSync(filePath, 'utf-8').trim();
  } catch {
    return '';
  }
}

function writeSurfaceState(surfaceId: unknown, stateType: SurfaceStateType, value: string): void {
  try {
    const filePath = getSurfaceStatePath(surfaceId, stateType);
    if (!filePath) return;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, value, 'utf-8');
  } catch {
    // Shell metadata is best-effort and should never interrupt terminal startup.
  }
}

function getSavedSurfaceCwd(surfaceId: unknown): string {
  return readSurfaceState(surfaceId, 'terminal-directories');
}

function getSavedSurfaceSessionId(surfaceId: unknown): string {
  const sessionId = readSurfaceState(surfaceId, 'terminal-sessions');
  return isValidCodexSessionId(sessionId) ? sessionId : '';
}

function isSurfaceCodexActive(surfaceId: unknown): boolean {
  return Boolean(readSurfaceState(surfaceId, 'terminal-active-codex'));
}

export function clearSurfaceCodexActive(surfaceId: string): void {
  try {
    codexSurfaceIds.delete(surfaceId);
    ptyInputBuffers.delete(surfaceId);
    const filePath = getSurfaceStatePath(surfaceId, 'terminal-active-codex');
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Active-marker cleanup should never interrupt shell metadata handling.
  }
}

function isCodexSurface(surface: any): boolean {
  const startsCodex = typeof surface?.initialCommand === 'string' && /^codex(\s|$)/i.test(surface.initialCommand.trim());
  return surface?.customTitle === 'Codex' || startsCodex || codexSurfaceIds.has(surface?.id);
}

export function markSurfaceAsCodex(surfaceId: string): void {
  if (!surfaceId) return;
  codexSurfaceIds.add(surfaceId);
  writeSurfaceState(surfaceId, 'terminal-active-codex', '1');
}

export function observePtyInputForCodex(surfaceId: string, data: string): void {
  if (!surfaceId || !data) return;

  let buffer = ptyInputBuffers.get(surfaceId) || '';
  for (const char of data) {
    if (char === '\b' || char === '\x7f') {
      buffer = buffer.slice(0, -1);
      continue;
    }

    if (char === '\r' || char === '\n') {
      if (isCodexCommandLine(buffer)) {
        markSurfaceAsCodex(surfaceId);
      }
      buffer = '';
      continue;
    }

    if (char >= ' ') {
      buffer += char;
    }
  }

  ptyInputBuffers.set(surfaceId, buffer.slice(-500));
}

function buildCodexResumeCommand(codexSessionId: string, codexSessionModel?: string): string {
  const modelArg = isSafeCodexModel(codexSessionModel) ? ` --model ${codexSessionModel.trim()}` : '';
  return `codex resume ${codexSessionId}${modelArg} --no-alt-screen`;
}

function enrichSplitTreeWithCodexState(node: any, workspaceCwd: string): any {
  if (!node) return node;
  if (node.type === 'branch') {
    return {
      ...node,
      children: node.children?.map((child: any) => enrichSplitTreeWithCodexState(child, workspaceCwd)) ?? node.children,
    };
  }
  if (node.type !== 'leaf' || !Array.isArray(node.surfaces)) return node;

  return {
    ...node,
    surfaces: node.surfaces.map((surface: any) => {
      const savedCwd = getSavedSurfaceCwd(surface?.id);
      const cwd = surface.cwd || savedCwd || workspaceCwd || '';
      const savedSessionId = getSavedSurfaceSessionId(surface?.id);
      const isCodexActive = isSurfaceCodexActive(surface?.id);
      const isCodex = isCodexActive && (isCodexSurface(surface) || !!savedSessionId);
      const latestSession = !isValidCodexSessionId(surface?.codexSessionId) && !savedSessionId && isCodex
        ? findLatestCodexSessionForCwd(cwd)
        : null;
      const codexSessionId = isValidCodexSessionId(surface?.codexSessionId)
        ? surface.codexSessionId
        : savedSessionId || latestSession?.id || '';
      const codexSessionModel = isSafeCodexModel(surface?.codexSessionModel)
        ? surface.codexSessionModel
        : codexSessionId
          ? findCodexSessionModelById(codexSessionId) || latestSession?.model || ''
          : '';

      const {
        initialCommand: _initialCommand,
        codexSessionId: _codexSessionId,
        codexSessionModel: _codexSessionModel,
        customTitle: _customTitle,
        ...surfaceWithoutCodexRestore
      } = surface;
      const nextSurface = {
        ...(isCodexActive ? surface : surfaceWithoutCodexRestore),
        ...(cwd ? { cwd } : {}),
      };

      if (!isCodex) return nextSurface;

      return {
        ...nextSurface,
        customTitle: nextSurface.customTitle || 'Codex',
        ...(codexSessionId ? {
          initialCommand: buildCodexResumeCommand(codexSessionId, codexSessionModel),
          codexSessionId,
          ...(codexSessionModel ? { codexSessionModel } : {}),
        } : {}),
      };
    }),
  };
}

export function enrichWorkspacesWithCodexSessionIds<T extends Array<any>>(workspaces: T): T {
  return workspaces.map((workspace) => {
    return {
      ...workspace,
      splitTree: enrichSplitTreeWithCodexState(workspace.splitTree, workspace.cwd || ''),
    };
  }) as T;
}
