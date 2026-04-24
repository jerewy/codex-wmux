import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearSurfaceCodexActive,
  enrichWorkspacesWithCodexSessionIds,
  isCodexCommandLine,
  markSurfaceAsCodex,
  parseCodexSessionMeta,
  parseCodexTurnContextModel,
} from '../../src/main/codex-session-resolver';

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

describe('Codex session resolver', () => {
  afterEach(() => {
    delete process.env.CODEX_TERMINAL_STATE_ROOT;
    delete process.env.CODEX_SESSIONS_DIR;
  });

  it('parses Codex session metadata from a JSONL first line', () => {
    const meta = parseCodexSessionMeta(JSON.stringify({
      timestamp: '2026-04-20T16:07:20.564Z',
      type: 'session_meta',
      payload: {
        id: '019daba5-0013-7842-a8e7-e8cb11630734',
        timestamp: '2026-04-20T16:06:50.709Z',
        cwd: 'C:\\dev',
      },
    }));

    expect(meta).toEqual({
      id: '019daba5-0013-7842-a8e7-e8cb11630734',
      timestamp: '2026-04-20T16:06:50.709Z',
      cwd: 'C:\\dev',
    });
  });

  it('ignores non-metadata lines', () => {
    expect(parseCodexSessionMeta(JSON.stringify({ type: 'event_msg', payload: {} }))).toBeNull();
  });

  it('parses the recorded model from turn context lines', () => {
    expect(parseCodexTurnContextModel(JSON.stringify({
      type: 'turn_context',
      payload: { model: 'gpt-5.4' },
    }))).toBe('gpt-5.4');
    expect(parseCodexTurnContextModel(JSON.stringify({
      type: 'turn_context',
      payload: { model: 'gpt 5.4; bad' },
    }))).toBeNull();
  });

  it('detects manually entered Codex commands', () => {
    expect(isCodexCommandLine('codex')).toBe(true);
    expect(isCodexCommandLine('codex resume --last --no-alt-screen')).toBe(true);
    expect(isCodexCommandLine('npm run codex')).toBe(false);
  });

  it('uses per-surface directory state when workspace cwd is empty', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-terminal-state-'));
    const stateRoot = path.join(tempRoot, 'state');
    const sessionsRoot = path.join(tempRoot, 'sessions');
    const surfaceId = 'surf-nicheflow';
    const sessionId = '019daba5-0013-7842-a8e7-e8cb11630734';

    process.env.CODEX_TERMINAL_STATE_ROOT = stateRoot;
    process.env.CODEX_SESSIONS_DIR = sessionsRoot;

    writeFile(path.join(stateRoot, 'terminal-directories', `${surfaceId}.txt`), 'C:\\dev');
    writeFile(path.join(stateRoot, 'terminal-active-codex', `${surfaceId}.txt`), '1');
    writeFile(
      path.join(sessionsRoot, '2026', '04', '20', 'rollout-test.jsonl'),
      JSON.stringify({
        type: 'session_meta',
        payload: {
          id: sessionId,
          timestamp: '2026-04-20T16:06:50.709Z',
          cwd: 'C:\\dev',
        },
      }),
    );

    markSurfaceAsCodex(surfaceId);

    const [workspace] = enrichWorkspacesWithCodexSessionIds([{
      title: 'Nicheflow Studio',
      cwd: '',
      splitTree: {
        type: 'leaf',
        paneId: 'pane-1',
        surfaces: [{ id: surfaceId, type: 'terminal', shell: 'powershell.exe' }],
        activeSurfaceIndex: 0,
      },
    }]);

    const surface = workspace.splitTree.surfaces[0];
    expect(surface.cwd).toBe('C:\\dev');
    expect(surface.customTitle).toBe('Codex');
    expect(surface.codexSessionId).toBe(sessionId);
    expect(surface.initialCommand).toBe(`codex resume ${sessionId} --no-alt-screen`);
  });

  it('adds the recorded session model to generated resume commands', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-terminal-state-'));
    const stateRoot = path.join(tempRoot, 'state');
    const sessionsRoot = path.join(tempRoot, 'sessions');
    const surfaceId = 'surf-model';
    const sessionId = '019daba5-0013-7842-a8e7-e8cb11630734';

    process.env.CODEX_TERMINAL_STATE_ROOT = stateRoot;
    process.env.CODEX_SESSIONS_DIR = sessionsRoot;

    writeFile(path.join(stateRoot, 'terminal-directories', `${surfaceId}.txt`), 'C:\\dev');
    writeFile(path.join(stateRoot, 'terminal-sessions', `${surfaceId}.txt`), sessionId);
    writeFile(path.join(stateRoot, 'terminal-active-codex', `${surfaceId}.txt`), '1');
    writeFile(
      path.join(sessionsRoot, '2026', '04', '20', `rollout-test-${sessionId}.jsonl`),
      [
        JSON.stringify({
          type: 'session_meta',
          payload: {
            id: sessionId,
            timestamp: '2026-04-20T16:06:50.709Z',
            cwd: 'C:\\dev',
          },
        }),
        JSON.stringify({
          type: 'turn_context',
          payload: {
            model: 'gpt-5.4',
            cwd: 'C:\\dev',
          },
        }),
      ].join('\n'),
    );

    const [workspace] = enrichWorkspacesWithCodexSessionIds([{
      title: 'Project',
      cwd: '',
      splitTree: {
        type: 'leaf',
        paneId: 'pane-1',
        surfaces: [{ id: surfaceId, type: 'terminal', shell: 'powershell.exe' }],
        activeSurfaceIndex: 0,
      },
    }]);

    const surface = workspace.splitTree.surfaces[0];
    expect(surface.codexSessionModel).toBe('gpt-5.4');
    expect(surface.initialCommand).toBe(`codex resume ${sessionId} --model gpt-5.4 --no-alt-screen`);
  });

  it('does not auto-resume when only a per-surface session id is saved', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-terminal-state-'));
    const stateRoot = path.join(tempRoot, 'state');
    const surfaceId = 'surf-nicheflow';
    const sessionId = '019daba5-0013-7842-a8e7-e8cb11630734';

    process.env.CODEX_TERMINAL_STATE_ROOT = stateRoot;

    writeFile(path.join(stateRoot, 'terminal-directories', `${surfaceId}.txt`), 'C:\\dev');
    writeFile(path.join(stateRoot, 'terminal-sessions', `${surfaceId}.txt`), sessionId);

    const [workspace] = enrichWorkspacesWithCodexSessionIds([{
      title: 'Nicheflow Studio',
      cwd: '',
      splitTree: {
        type: 'leaf',
        paneId: 'pane-1',
        surfaces: [{ id: surfaceId, type: 'terminal', shell: 'powershell.exe' }],
        activeSurfaceIndex: 0,
      },
    }]);

    const surface = workspace.splitTree.surfaces[0];
    expect(surface.cwd).toBe('C:\\dev');
    expect(surface.customTitle).toBeUndefined();
    expect(surface.codexSessionId).toBeUndefined();
    expect(surface.initialCommand).toBeUndefined();
  });

  it('uses an exact per-surface session id when codex is still active', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-terminal-state-'));
    const stateRoot = path.join(tempRoot, 'state');
    const sessionsRoot = path.join(tempRoot, 'sessions');
    const surfaceId = 'surf-nicheflow';
    const sessionId = '019daba5-0013-7842-a8e7-e8cb11630734';

    process.env.CODEX_TERMINAL_STATE_ROOT = stateRoot;
    process.env.CODEX_SESSIONS_DIR = sessionsRoot;

    writeFile(path.join(stateRoot, 'terminal-directories', `${surfaceId}.txt`), 'C:\\dev');
    writeFile(path.join(stateRoot, 'terminal-sessions', `${surfaceId}.txt`), sessionId);
    writeFile(path.join(stateRoot, 'terminal-active-codex', `${surfaceId}.txt`), '1');

    const [workspace] = enrichWorkspacesWithCodexSessionIds([{
      title: 'Nicheflow Studio',
      cwd: '',
      splitTree: {
        type: 'leaf',
        paneId: 'pane-1',
        surfaces: [{ id: surfaceId, type: 'terminal', shell: 'powershell.exe' }],
        activeSurfaceIndex: 0,
      },
    }]);

    const surface = workspace.splitTree.surfaces[0];
    expect(surface.cwd).toBe('C:\\dev');
    expect(surface.customTitle).toBe('Codex');
    expect(surface.codexSessionId).toBe(sessionId);
    expect(surface.initialCommand).toBe(`codex resume ${sessionId} --no-alt-screen`);
  });

  it('persists active codex markers for startup codex commands', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-terminal-state-'));
    const stateRoot = path.join(tempRoot, 'state');
    const sessionsRoot = path.join(tempRoot, 'sessions');
    const surfaceId = 'surf-startup-codex';

    process.env.CODEX_TERMINAL_STATE_ROOT = stateRoot;
    process.env.CODEX_SESSIONS_DIR = sessionsRoot;

    markSurfaceAsCodex(surfaceId);

    expect(fs.readFileSync(
      path.join(stateRoot, 'terminal-active-codex', `${surfaceId}.txt`),
      'utf-8',
    )).toBe('1');

    const [workspace] = enrichWorkspacesWithCodexSessionIds([{
      title: 'Codex',
      cwd: 'C:\\dev',
      splitTree: {
        type: 'leaf',
        paneId: 'pane-1',
        surfaces: [{
          id: surfaceId,
          type: 'terminal',
          customTitle: 'Codex',
          initialCommand: 'codex resume --last --no-alt-screen',
        }],
        activeSurfaceIndex: 0,
      },
    }]);

    const surface = workspace.splitTree.surfaces[0];
    expect(surface.customTitle).toBe('Codex');
    expect(surface.initialCommand).toBe('codex resume --last --no-alt-screen');
  });

  it('removes stale codex restore fields after codex has exited', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-terminal-state-'));
    const stateRoot = path.join(tempRoot, 'state');
    const sessionsRoot = path.join(tempRoot, 'sessions');
    const surfaceId = 'surf-nicheflow';
    const sessionId = '019daba5-0013-7842-a8e7-e8cb11630734';

    process.env.CODEX_TERMINAL_STATE_ROOT = stateRoot;
    process.env.CODEX_SESSIONS_DIR = sessionsRoot;

    writeFile(path.join(stateRoot, 'terminal-directories', `${surfaceId}.txt`), 'C:\\dev');
    writeFile(path.join(stateRoot, 'terminal-sessions', `${surfaceId}.txt`), sessionId);

    const [workspace] = enrichWorkspacesWithCodexSessionIds([{
      title: 'Nicheflow Studio',
      cwd: '',
      splitTree: {
        type: 'leaf',
        paneId: 'pane-1',
        surfaces: [{
          id: surfaceId,
          type: 'terminal',
          shell: 'powershell.exe',
          customTitle: 'Codex',
          codexSessionId: sessionId,
          initialCommand: `codex resume ${sessionId} --no-alt-screen`,
        }],
        activeSurfaceIndex: 0,
      },
    }]);

    const surface = workspace.splitTree.surfaces[0];
    expect(surface.cwd).toBe('C:\\dev');
    expect(surface.customTitle).toBeUndefined();
    expect(surface.codexSessionId).toBeUndefined();
    expect(surface.initialCommand).toBeUndefined();
  });

  it('clears active codex marker for a surface', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-terminal-state-'));
    const stateRoot = path.join(tempRoot, 'state');
    const surfaceId = 'surf-nicheflow';
    const sessionId = '019daba5-0013-7842-a8e7-e8cb11630734';

    process.env.CODEX_TERMINAL_STATE_ROOT = stateRoot;

    writeFile(path.join(stateRoot, 'terminal-directories', `${surfaceId}.txt`), 'C:\\dev');
    writeFile(path.join(stateRoot, 'terminal-sessions', `${surfaceId}.txt`), sessionId);
    writeFile(path.join(stateRoot, 'terminal-active-codex', `${surfaceId}.txt`), '1');

    clearSurfaceCodexActive(surfaceId);

    const [workspace] = enrichWorkspacesWithCodexSessionIds([{
      title: 'Nicheflow Studio',
      cwd: '',
      splitTree: {
        type: 'leaf',
        paneId: 'pane-1',
        surfaces: [{ id: surfaceId, type: 'terminal', shell: 'powershell.exe' }],
        activeSurfaceIndex: 0,
      },
    }]);

    const surface = workspace.splitTree.surfaces[0];
    expect(surface.cwd).toBe('C:\\dev');
    expect(surface.codexSessionId).toBeUndefined();
    expect(surface.initialCommand).toBeUndefined();
  });
});
