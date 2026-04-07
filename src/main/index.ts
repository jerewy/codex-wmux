import { app, BrowserWindow, ipcMain } from 'electron';
import { registerIpcHandlers, cdpBridge, agentManager, ptyManager, setupAgentPtyForwarding } from './ipc-handlers';
import { distributeAgents } from './agent-manager';
import { PipeServer } from './pipe-server';
import { PortScanner } from './port-scanner';
import { GitPoller } from './git-poller';
import { PrPoller } from './pr-poller';
import { CDPProxy } from './cdp-proxy';
import { IPC_CHANNELS } from '../shared/types';
import { loadSession, saveSession, handleVersionChange, SessionData } from './session-persistence';
import { WindowManager } from './window-manager';
import { initAutoUpdater } from './updater';
import { ensureClaudeContext, ensureClaudeHooks, ensureChromeDevtoolsConfig, ensureOrchestratorPlugin } from './claude-context';
import fs from 'fs';
import path from 'path';

const windowManager = new WindowManager();
const pipeServer = new PipeServer();
const portScanner = new PortScanner();
const gitPoller = new GitPoller();
const prPoller = new PrPoller();
const cdpProxy = new CDPProxy();

// Strip MOTW (Mark of the Web) Zone.Identifier ADS from app directory.
// Windows blocks taskbar pinning and shows security warnings for downloaded files.
// Removing the :Zone.Identifier alternate data stream fixes this transparently.
function stripMotw(): void {
  if (process.platform !== 'win32') return;
  const appDir = path.dirname(process.execPath);
  const stripDir = (dir: string) => {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stripDir(full);
      } else if (/\.(exe|dll|node|lnk)$/i.test(entry.name)) {
        fs.unlink(full + ':Zone.Identifier', () => {});
      }
    }
  };
  stripDir(appDir);
}

// Auto-save debounce handle
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
const AUTO_SAVE_INTERVAL_MS = 30_000;

function scheduleAutoSave(): void {
  if (autoSaveTimer !== null) {
    clearTimeout(autoSaveTimer);
  }
  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = null;
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('session:request');
      }
    });
  }, AUTO_SAVE_INTERVAL_MS);
}

// Set Windows AppUserModelId so taskbar pinning uses the correct icon & identity
app.setAppUserModelId('com.wmux.app');

// Auto-strip MOTW on startup so users never see security warnings or pinning failures
stripMotw();

app.whenReady().then(() => {
  // Inject wmux instructions into ~/.claude/CLAUDE.md for Claude Code awareness
  ensureClaudeContext();
  ensureClaudeHooks();
  ensureChromeDevtoolsConfig();
  ensureOrchestratorPlugin();

  // IPC: renderer pushes session state (auto-save response or explicit save)
  ipcMain.on('session:save', (event, data: SessionData) => {
    // Augment with actual window bounds (renderer can't know these)
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed() && data.windows?.[0]) {
      data.windows[0].bounds = win.getBounds();
    }
    saveSession(data);
    scheduleAutoSave();
  });

  registerIpcHandlers(windowManager, cdpProxy);

  // Clear stale session data on version change (clean start for upgrades/fresh installs)
  handleVersionChange(app.getVersion());

  // Attempt to restore last saved window bounds
  const savedSession = loadSession();
  const savedBounds = savedSession?.windows?.[0]?.bounds;
  windowManager.createWindow(savedBounds);

  // Initialize auto-updater only when packaged (avoids errors in dev)
  if (app.isPackaged) {
    initAutoUpdater();
  }

  // Kick off the first auto-save cycle after the window is ready
  scheduleAutoSave();

  // Start named pipe server
  pipeServer.start();
  cdpProxy.start().catch(() => {}); // CDP proxy is optional — don't crash if ports are busy

  portScanner.onResults((portsByPid) => {
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.METADATA_UPDATE, {
          command: 'ports_update',
          surfaceId: '',
          args: [JSON.stringify(Object.fromEntries(portsByPid))],
        });
      }
    });
  });

  gitPoller.onUpdate((cwd, state) => {
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.METADATA_UPDATE, {
          command: state.branch ? 'report_git_branch' : 'clear_git_branch',
          surfaceId: '', // will be mapped via cwd → workspace
          args: state.branch ? [state.branch, state.dirty ? 'dirty' : ''] : [],
        });
      }
    });
  });

  prPoller.onUpdate((cwd, pr) => {
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        if (pr) {
          win.webContents.send(IPC_CHANNELS.METADATA_UPDATE, {
            command: 'report_pr',
            surfaceId: '',
            args: [String(pr.number), pr.state, pr.title],
          });
        }
      }
    });
  });

  pipeServer.on('v1', (cmd) => {
    // Trigger port scan when requested from shell integration
    if (cmd.command === 'ports_kick') {
      portScanner.kick();
    }
    // Forward metadata updates to all windows
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.METADATA_UPDATE, cmd);
      }
    });
  });

  pipeServer.on('v2', (request, respond, respondError) => {
    switch (request.method) {
      case 'system.identify':
        respond({ name: 'wmux', version: '0.5.0', platform: 'win32' });
        break;
      case 'system.capabilities':
        respond({ protocols: ['v1', 'v2'], features: ['workspaces', 'splits', 'notifications'] });
        break;
      // ─── Workspace V2 handlers ──────────────────────────────────────────────
      case 'workspace.create': {
        (async () => {
          try {
            const win = BrowserWindow.getAllWindows()[0];
            if (!win || win.isDestroyed()) { respondError(-32000, 'No window'); return; }
            const result = await win.webContents.executeJavaScript(
              `window.__wmux_createWorkspace?.(${JSON.stringify(request.params || {})})`
            );
            respond(result || { ok: true });
          } catch (err: any) { respondError(-32000, err.message); }
        })();
        break;
      }
      case 'workspace.close': {
        (async () => {
          try {
            const win = BrowserWindow.getAllWindows()[0];
            if (!win || win.isDestroyed()) { respondError(-32000, 'No window'); return; }
            await win.webContents.executeJavaScript(
              `window.__wmux_closeWorkspace?.(${JSON.stringify(request.params?.id || request.params?.workspaceId)})`
            );
            respond({ ok: true });
          } catch (err: any) { respondError(-32000, err.message); }
        })();
        break;
      }
      case 'workspace.select': {
        (async () => {
          try {
            const win = BrowserWindow.getAllWindows()[0];
            if (!win || win.isDestroyed()) { respondError(-32000, 'No window'); return; }
            await win.webContents.executeJavaScript(
              `window.__wmux_selectWorkspace?.(${JSON.stringify(request.params?.id || request.params?.workspaceId)})`
            );
            respond({ ok: true });
          } catch (err: any) { respondError(-32000, err.message); }
        })();
        break;
      }
      case 'workspace.rename': {
        (async () => {
          try {
            const win = BrowserWindow.getAllWindows()[0];
            if (!win || win.isDestroyed()) { respondError(-32000, 'No window'); return; }
            await win.webContents.executeJavaScript(
              `window.__wmux_renameWorkspace?.(${JSON.stringify(request.params?.id || request.params?.workspaceId)}, ${JSON.stringify(request.params?.title || '')})`
            );
            respond({ ok: true });
          } catch (err: any) { respondError(-32000, err.message); }
        })();
        break;
      }
      case 'workspace.list': {
        (async () => {
          try {
            const win = BrowserWindow.getAllWindows()[0];
            if (!win || win.isDestroyed()) { respond({ workspaces: [] }); return; }
            const workspaces = await win.webContents.executeJavaScript(
              `window.__wmux_listWorkspaces?.()`
            );
            respond({ workspaces: workspaces || [] });
          } catch (err: any) { respondError(-32000, err.message); }
        })();
        break;
      }

      // ─── Pane V2 handlers ──────────────────────────────────────────────────
      case 'pane.split': {
        (async () => {
          try {
            const win = BrowserWindow.getAllWindows()[0];
            if (!win || win.isDestroyed()) { respondError(-32000, 'No window'); return; }
            const result = await win.webContents.executeJavaScript(
              `window.__wmux_splitPane?.(${JSON.stringify(request.params || {})})`
            );
            if (!result) { respondError(-32000, 'No active workspace or panes'); return; }
            respond(result);
          } catch (err: any) { respondError(-32000, err.message); }
        })();
        break;
      }
      case 'pane.close': {
        (async () => {
          try {
            const win = BrowserWindow.getAllWindows()[0];
            if (!win || win.isDestroyed()) { respondError(-32000, 'No window'); return; }
            await win.webContents.executeJavaScript(
              `window.__wmux_closePane?.(${JSON.stringify(request.params?.paneId)}, ${JSON.stringify(request.params?.workspaceId)})`
            );
            respond({ ok: true });
          } catch (err: any) { respondError(-32000, err.message); }
        })();
        break;
      }
      case 'pane.focus': {
        // Focus the first surface in the specified pane
        (async () => {
          try {
            const win = BrowserWindow.getAllWindows()[0];
            if (!win || win.isDestroyed()) { respondError(-32000, 'No window'); return; }
            // Get pane's first surface and focus it
            const panes = await win.webContents.executeJavaScript(
              `window.__wmux_listPanes?.(${JSON.stringify(request.params?.workspaceId)})`
            );
            const pane = (panes || []).find((p: any) => p.paneId === request.params?.paneId);
            if (pane && pane.surfaces.length > 0) {
              await win.webContents.executeJavaScript(
                `window.__wmux_focusSurface?.(${JSON.stringify(pane.surfaces[0].id)})`
              );
            }
            respond({ ok: true });
          } catch (err: any) { respondError(-32000, err.message); }
        })();
        break;
      }
      case 'pane.zoom': {
        // Zoom toggles are UI-only; acknowledge for now
        respond({ ok: true, note: 'Zoom toggle is a renderer-only action' });
        break;
      }
      case 'pane.list': {
        (async () => {
          try {
            const win = BrowserWindow.getAllWindows()[0];
            if (!win || win.isDestroyed()) { respond({ panes: [] }); return; }
            const panes = await win.webContents.executeJavaScript(
              `window.__wmux_listPanes?.(${JSON.stringify(request.params?.workspaceId)})`
            );
            respond({ panes: panes || [] });
          } catch (err: any) { respondError(-32000, err.message); }
        })();
        break;
      }

      // ─── System tree ──────────────────────────────────────────────────────
      case 'system.tree': {
        (async () => {
          try {
            const win = BrowserWindow.getAllWindows()[0];
            if (!win || win.isDestroyed()) { respond({ tree: null }); return; }
            const tree = await win.webContents.executeJavaScript(
              `window.__wmux_getTree?.(${JSON.stringify(request.params?.workspaceId)})`
            );
            respond({ tree: tree || null });
          } catch (err: any) { respondError(-32000, err.message); }
        })();
        break;
      }

      // ─── Surface V2 handlers ──────────────────────────────────────────────
      case 'surface.create': {
        (async () => {
          try {
            const win = BrowserWindow.getAllWindows()[0];
            if (!win || win.isDestroyed()) { respondError(-32000, 'No window'); return; }
            const result = await win.webContents.executeJavaScript(
              `window.__wmux_createSurface?.(${JSON.stringify(request.params || {})})`
            );
            if (!result) { respondError(-32000, 'No active workspace or panes'); return; }
            respond(result);
          } catch (err: any) { respondError(-32000, err.message); }
        })();
        break;
      }
      case 'surface.close': {
        (async () => {
          try {
            const win = BrowserWindow.getAllWindows()[0];
            if (!win || win.isDestroyed()) { respondError(-32000, 'No window'); return; }
            await win.webContents.executeJavaScript(
              `window.__wmux_closeSurface?.(${JSON.stringify(request.params?.id || request.params?.surfaceId)}, ${JSON.stringify(request.params?.workspaceId)})`
            );
            respond({ ok: true });
          } catch (err: any) { respondError(-32000, err.message); }
        })();
        break;
      }
      case 'surface.focus': {
        (async () => {
          try {
            const win = BrowserWindow.getAllWindows()[0];
            if (!win || win.isDestroyed()) { respondError(-32000, 'No window'); return; }
            await win.webContents.executeJavaScript(
              `window.__wmux_focusSurface?.(${JSON.stringify(request.params?.id || request.params?.surfaceId)}, ${JSON.stringify(request.params?.workspaceId)})`
            );
            respond({ ok: true });
          } catch (err: any) { respondError(-32000, err.message); }
        })();
        break;
      }
      case 'surface.list': {
        (async () => {
          try {
            const win = BrowserWindow.getAllWindows()[0];
            if (!win || win.isDestroyed()) { respond({ surfaces: [] }); return; }
            const surfaces = await win.webContents.executeJavaScript(
              `window.__wmux_listSurfaces?.(${JSON.stringify(request.params?.workspaceId)})`
            );
            respond({ surfaces: surfaces || [] });
          } catch (err: any) { respondError(-32000, err.message); }
        })();
        break;
      }

      // ─── Terminal I/O V2 handlers ─────────────────────────────────────────
      case 'surface.send_text': {
        (async () => {
          try {
            const surfaceId = request.params?.surfaceId || request.params?.id;
            if (!surfaceId) {
              // Use active surface if none specified
              const win = BrowserWindow.getAllWindows()[0];
              if (!win || win.isDestroyed()) { respondError(-32000, 'No window'); return; }
              const activeId = await win.webContents.executeJavaScript(
                `window.__wmux_getActiveSurfaceId?.()`
              );
              if (!activeId) { respondError(-32000, 'No active surface'); return; }
              ptyManager.write(activeId, request.params?.text || '');
            } else {
              ptyManager.write(surfaceId, request.params?.text || '');
            }
            respond({ ok: true });
          } catch (err: any) { respondError(-32000, err.message); }
        })();
        break;
      }
      case 'surface.send_key': {
        (async () => {
          try {
            const surfaceId = request.params?.surfaceId || request.params?.id;
            let key = request.params?.key || '';
            // Apply modifiers
            if (request.params?.ctrl) {
              // Convert to control character (Ctrl+A = \x01, etc.)
              const code = key.toUpperCase().charCodeAt(0) - 64;
              if (code > 0 && code < 27) key = String.fromCharCode(code);
            }
            if (request.params?.alt) key = '\x1b' + key;

            if (!surfaceId) {
              const win = BrowserWindow.getAllWindows()[0];
              if (!win || win.isDestroyed()) { respondError(-32000, 'No window'); return; }
              const activeId = await win.webContents.executeJavaScript(
                `window.__wmux_getActiveSurfaceId?.()`
              );
              if (!activeId) { respondError(-32000, 'No active surface'); return; }
              ptyManager.write(activeId, key);
            } else {
              ptyManager.write(surfaceId, key);
            }
            respond({ ok: true });
          } catch (err: any) { respondError(-32000, err.message); }
        })();
        break;
      }
      case 'surface.read_text': {
        // Read screen content — not easily available from PTY buffer directly.
        // Return a note that this requires xterm.js serializer addon in the renderer.
        respond({ text: '', note: 'Screen reading requires renderer-side xterm serializer' });
        break;
      }
      case 'surface.trigger_flash': {
        BrowserWindow.getAllWindows().forEach(w => {
          if (!w.isDestroyed()) {
            w.webContents.send(IPC_CHANNELS.NOTIFICATION_FIRE, {
              surfaceId: request.params?.surfaceId,
              text: 'Flash triggered via CLI',
            });
          }
        });
        respond({ ok: true });
        break;
      }

      // ─── Markdown V2 handlers ─────────────────────────────────────────────
      case 'markdown.set_content': {
        (async () => {
          try {
            const win = BrowserWindow.getAllWindows()[0];
            if (!win || win.isDestroyed()) { respondError(-32000, 'No window'); return; }
            await win.webContents.executeJavaScript(
              `window.__wmux_setMarkdownContent?.(${JSON.stringify(request.params?.surfaceId || '')}, ${JSON.stringify(request.params?.markdown || '')})`
            );
            respond({ ok: true });
          } catch (err: any) { respondError(-32000, err.message); }
        })();
        break;
      }
      case 'markdown.load_file': {
        (async () => {
          try {
            const filePath = request.params?.path || request.params?.file;
            if (!filePath) { respondError(-32000, 'No file path provided'); return; }
            const content = fs.readFileSync(filePath, 'utf-8');
            const win = BrowserWindow.getAllWindows()[0];
            if (!win || win.isDestroyed()) { respondError(-32000, 'No window'); return; }
            await win.webContents.executeJavaScript(
              `window.__wmux_setMarkdownContent?.(${JSON.stringify(request.params?.surfaceId || '')}, ${JSON.stringify(content)})`
            );
            respond({ ok: true, length: content.length });
          } catch (err: any) { respondError(-32000, err.message); }
        })();
        break;
      }

      // ─── Notification V2 handlers ─────────────────────────────────────────
      case 'notification.list': {
        (async () => {
          try {
            const win = BrowserWindow.getAllWindows()[0];
            if (!win || win.isDestroyed()) { respond({ notifications: [] }); return; }
            const notifications = await win.webContents.executeJavaScript(
              `window.__wmux_listNotifications?.()`
            );
            respond({ notifications: notifications || [] });
          } catch (err: any) { respondError(-32000, err.message); }
        })();
        break;
      }
      case 'notification.clear': {
        (async () => {
          try {
            const win = BrowserWindow.getAllWindows()[0];
            if (!win || win.isDestroyed()) { respondError(-32000, 'No window'); return; }
            if (request.params?.all) {
              await win.webContents.executeJavaScript(
                `window.__wmux_clearAllNotifications?.()`
              );
            } else {
              await win.webContents.executeJavaScript(
                `window.__wmux_clearNotification?.(${JSON.stringify(request.params?.id || '')})`
              );
            }
            respond({ ok: true });
          } catch (err: any) { respondError(-32000, err.message); }
        })();
        break;
      }

      // ─── Sidebar V2 handlers ──────────────────────────────────────────────
      case 'sidebar.set_status': {
        // Forward as metadata update to renderer
        BrowserWindow.getAllWindows().forEach(w => {
          if (!w.isDestroyed()) {
            w.webContents.send(IPC_CHANNELS.METADATA_UPDATE, {
              command: 'status',
              surfaceId: request.params?.surfaceId,
              args: [request.params?.key || '', request.params?.value || ''],
            });
          }
        });
        respond({ ok: true });
        break;
      }
      case 'sidebar.set_progress': {
        BrowserWindow.getAllWindows().forEach(w => {
          if (!w.isDestroyed()) {
            w.webContents.send(IPC_CHANNELS.METADATA_UPDATE, {
              command: 'progress',
              surfaceId: request.params?.surfaceId,
              args: [String(request.params?.value ?? 0), request.params?.label || ''],
            });
          }
        });
        respond({ ok: true });
        break;
      }
      case 'sidebar.log': {
        BrowserWindow.getAllWindows().forEach(w => {
          if (!w.isDestroyed()) {
            w.webContents.send(IPC_CHANNELS.METADATA_UPDATE, {
              command: 'log',
              surfaceId: request.params?.surfaceId,
              args: [request.params?.level || 'info', request.params?.message || ''],
            });
          }
        });
        respond({ ok: true });
        break;
      }
      case 'sidebar.get_state': {
        // Return current sidebar metadata — this is stored in the renderer
        (async () => {
          try {
            const win = BrowserWindow.getAllWindows()[0];
            if (!win || win.isDestroyed()) { respond({ state: null }); return; }
            const workspaces = await win.webContents.executeJavaScript(
              `window.__wmux_listWorkspaces?.()`
            );
            respond({ workspaces: workspaces || [] });
          } catch (err: any) { respondError(-32000, err.message); }
        })();
        break;
      }

      case 'browser.navigate':
        if (!cdpBridge.isAttached) { respondError(-32000, 'Browser panel is not open'); break; }
        cdpBridge.navigate(request.params.url, request.params.timeout)
          .then(() => respond({ ok: true }))
          .catch((err) => respondError(-32000, err.message));
        break;
      case 'browser.snapshot':
        if (!cdpBridge.isAttached) { respondError(-32000, 'Browser panel is not open'); break; }
        cdpBridge.snapshot().then((snap) => respond(snap)).catch((err) => respondError(-32000, err.message));
        break;
      case 'browser.click':
        if (!cdpBridge.isAttached) { respondError(-32000, 'Browser panel is not open'); break; }
        cdpBridge.click(request.params.ref).then(() => respond({ ok: true })).catch((err) => respondError(-32000, err.message));
        break;
      case 'browser.type':
        if (!cdpBridge.isAttached) { respondError(-32000, 'Browser panel is not open'); break; }
        cdpBridge.type(request.params.ref, request.params.text).then(() => respond({ ok: true })).catch((err) => respondError(-32000, err.message));
        break;
      case 'browser.fill':
        if (!cdpBridge.isAttached) { respondError(-32000, 'Browser panel is not open'); break; }
        cdpBridge.fill(request.params.ref, request.params.value).then(() => respond({ ok: true })).catch((err) => respondError(-32000, err.message));
        break;
      case 'browser.screenshot':
        if (!cdpBridge.isAttached) { respondError(-32000, 'Browser panel is not open'); break; }
        cdpBridge.screenshot(request.params.fullPage).then((data) => respond({ data })).catch((err) => respondError(-32000, err.message));
        break;
      case 'browser.get_text':
        if (!cdpBridge.isAttached) { respondError(-32000, 'Browser panel is not open'); break; }
        cdpBridge.getText(request.params.ref).then((text) => respond({ text })).catch((err) => respondError(-32000, err.message));
        break;
      case 'browser.eval':
        if (!cdpBridge.isAttached) { respondError(-32000, 'Browser panel is not open'); break; }
        cdpBridge.evaluate(request.params.js).then((result) => respond({ result })).catch((err) => respondError(-32000, err.message));
        break;
      case 'browser.wait':
        if (!cdpBridge.isAttached) { respondError(-32000, 'Browser panel is not open'); break; }
        cdpBridge.wait(request.params.ref, request.params.timeout).then(() => respond({ ok: true })).catch((err) => respondError(-32000, err.message));
        break;
      case 'browser.batch': {
        if (!cdpBridge.isAttached) { respondError(-32000, 'Browser panel is not open'); break; }
        const results: any[] = [];
        (async () => {
          for (const cmd of request.params.commands || []) {
            try {
              const handlers: Record<string, () => Promise<any>> = {
                'browser.navigate': () => cdpBridge.navigate(cmd.params?.url, cmd.params?.timeout).then(() => ({ ok: true })),
                'browser.snapshot': () => cdpBridge.snapshot(),
                'browser.click': () => cdpBridge.click(cmd.params?.ref).then(() => ({ ok: true })),
                'browser.type': () => cdpBridge.type(cmd.params?.ref, cmd.params?.text).then(() => ({ ok: true })),
                'browser.fill': () => cdpBridge.fill(cmd.params?.ref, cmd.params?.value).then(() => ({ ok: true })),
                'browser.screenshot': () => cdpBridge.screenshot(cmd.params?.fullPage).then((d: string) => ({ data: d })),
                'browser.get_text': () => cdpBridge.getText(cmd.params?.ref).then((t: string) => ({ text: t })),
                'browser.eval': () => cdpBridge.evaluate(cmd.params?.js).then((r: any) => ({ result: r })),
                'browser.wait': () => cdpBridge.wait(cmd.params?.ref, cmd.params?.timeout).then(() => ({ ok: true })),
              };
              const handler = handlers[cmd.method];
              if (!handler) { results.push({ error: { code: -32601, message: `Unknown: ${cmd.method}` } }); break; }
              results.push({ result: await handler() });
            } catch (err: any) {
              results.push({ error: { code: -32000, message: err.message } });
              break;
            }
          }
          respond({ results });
        })().catch((err) => respondError(-32000, err.message));
        break;
      }
      case 'agent.spawn': {
        (async () => {
          try {
            const params = request.params;
            let workspaceId = params.workspaceId;
            if (!workspaceId) {
              const wins = BrowserWindow.getAllWindows();
              if (wins.length > 0) {
                workspaceId = await wins[0].webContents.executeJavaScript('window.__wmux_getActiveWorkspaceId?.()');
              }
            }
            if (!workspaceId) { respondError(-32000, 'No active workspace'); return; }

            let paneId = params.paneId;
            if (!paneId) {
              const paneLoads = await BrowserWindow.getAllWindows()[0]?.webContents.executeJavaScript('window.__wmux_getPaneLoads?.()');
              if (paneLoads && paneLoads.length > 0) paneId = distributeAgents(1, paneLoads)[0];
            }
            if (!paneId) { respondError(-32000, 'No panes available'); return; }

            const result = agentManager.spawn({ cmd: params.cmd, label: params.label, cwd: params.cwd, env: params.env, paneId, workspaceId });

            const win = BrowserWindow.getAllWindows()[0];
            if (win && !win.isDestroyed()) setupAgentPtyForwarding(result.surfaceId, win);

            BrowserWindow.getAllWindows().forEach(w => {
              if (!w.isDestroyed()) w.webContents.send(IPC_CHANNELS.AGENT_UPDATE, { type: 'spawned', ...result, paneId, workspaceId, label: params.label });
            });
            respond(result);
          } catch (err: any) { respondError(-32000, err.message); }
        })();
        break;
      }

      case 'agent.spawn_batch': {
        (async () => {
          try {
            const { agents: agentParams, strategy = 'distribute', workspaceId: wsId } = request.params;
            let workspaceId = wsId;
            if (!workspaceId) {
              const wins = BrowserWindow.getAllWindows();
              if (wins.length > 0) workspaceId = await wins[0].webContents.executeJavaScript('window.__wmux_getActiveWorkspaceId?.()');
            }
            if (!workspaceId) { respondError(-32000, 'No active workspace'); return; }

            const paneLoads = await BrowserWindow.getAllWindows()[0]?.webContents.executeJavaScript('window.__wmux_getPaneLoads?.()') || [];
            if (paneLoads.length === 0) { respondError(-32000, 'No panes available'); return; }

            let assignments: string[];
            if (strategy === 'distribute') {
              assignments = distributeAgents(agentParams.length, paneLoads);
            } else if (strategy === 'stack') {
              const sorted = [...paneLoads].sort((a: any, b: any) => a.tabCount - b.tabCount);
              assignments = agentParams.map(() => sorted[0].paneId);
            } else {
              console.warn('[wmux] split strategy not yet implemented, falling back to distribute');
              assignments = distributeAgents(agentParams.length, paneLoads);
            }

            const win = BrowserWindow.getAllWindows()[0];
            const results: any[] = [];
            for (let i = 0; i < agentParams.length; i++) {
              try {
                const result = agentManager.spawn({ ...agentParams[i], paneId: assignments[i] as any, workspaceId });
                if (win && !win.isDestroyed()) setupAgentPtyForwarding(result.surfaceId, win);
                BrowserWindow.getAllWindows().forEach(w => {
                  if (!w.isDestroyed()) w.webContents.send(IPC_CHANNELS.AGENT_UPDATE, { type: 'spawned', ...result, paneId: assignments[i], workspaceId, label: agentParams[i].label });
                });
                results.push(result);
              } catch (err: any) { results.push({ error: err.message }); }
            }
            respond({ agents: results });
          } catch (err: any) { respondError(-32000, err.message); }
        })();
        break;
      }

      case 'agent.status': {
        const info = agentManager.getStatus(request.params.agentId);
        if (!info) { respondError(-32000, 'Agent not found'); break; }
        respond(info);
        break;
      }
      case 'agent.list':
        respond({ agents: agentManager.list(request.params.workspaceId) });
        break;
      case 'agent.kill': {
        const killed = agentManager.kill(request.params.agentId);
        if (!killed) { respondError(-32000, 'Agent not found'); break; }
        respond({ ok: true });
        break;
      }

      case 'hook.event': {
        BrowserWindow.getAllWindows().forEach(w => {
          if (!w.isDestroyed()) w.webContents.send(IPC_CHANNELS.HOOK_EVENT, request.params);
        });
        // Always push diff update for Edit/Write hooks (even without file path).
        // Delay slightly so the renderer has time to mount the DiffPane
        // (HOOK_EVENT triggers diff tab creation; DIFF_UPDATE needs to arrive after mount).
        if (request.params.tool === 'Edit' || request.params.tool === 'Write') {
          // Stagger updates: 500ms for immediate feedback, 2s to catch slower writes
          for (const delay of [500, 2000]) {
            setTimeout(() => {
              BrowserWindow.getAllWindows().forEach(w => {
                if (!w.isDestroyed()) w.webContents.send(IPC_CHANNELS.DIFF_UPDATE, { file: request.params.file || '' });
              });
            }, delay);
          }
        }
        respond({ ok: true });
        break;
      }

      case 'diff.refresh': {
        // CLI can trigger a full diff refresh
        BrowserWindow.getAllWindows().forEach(w => {
          if (!w.isDestroyed()) w.webContents.send(IPC_CHANNELS.DIFF_UPDATE, { file: request.params?.file || '' });
        });
        respond({ ok: true });
        break;
      }

      default:
        respondError(-32601, `Method not found: ${request.method}`);
    }
  });
});

app.on('before-quit', () => {
  // Cancel pending auto-save timer
  if (autoSaveTimer !== null) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
  // Ask all renderers to push their current state synchronously before quit
  BrowserWindow.getAllWindows().forEach(win => {
    if (!win.isDestroyed()) {
      win.webContents.send('session:request');
    }
  });
});

app.on('will-quit', () => {
  pipeServer.stop();
  cdpProxy.stop();
  portScanner.stop();
  gitPoller.unwatchAll();
  prPoller.stopAll();
});

app.on('window-all-closed', () => {
  app.quit();
});
