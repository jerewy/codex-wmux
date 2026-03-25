import { useEffect } from 'react';
import { useStore } from '../store';
import { ShortcutBinding, ShortcutAction } from '../store/settings-slice';
import { splitNode, removeLeaf, getAllPaneIds, findLeaf } from '../store/split-utils';
import { PaneId } from '../../shared/types';
import { v4 as uuid } from 'uuid';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function matchesBinding(e: KeyboardEvent, binding: ShortcutBinding): boolean {
  const keyMatch = e.key === binding.key;
  const ctrlMatch = !!binding.ctrl === e.ctrlKey;
  const shiftMatch = !!binding.shift === e.shiftKey;
  const altMatch = !!binding.alt === e.altKey;
  return keyMatch && ctrlMatch && shiftMatch && altMatch;
}

/**
 * Keys that are safe to intercept even when a terminal has focus.
 * All others with only Ctrl held (no Shift/Alt) are forwarded to the terminal.
 */
const SAFE_CTRL_KEYS = new Set(['b', 'd', 'n', 't', 'w', 'f', ',']);

function isSafeToIntercept(e: KeyboardEvent): boolean {
  if (!e.ctrlKey) return true; // Not a Ctrl combo — always safe

  // Ctrl+Shift+* and Ctrl+Alt+* are safe (terminal uses bare Ctrl combos)
  if (e.shiftKey || e.altKey) return true;

  // Ctrl+PageDown / Ctrl+PageUp are safe
  if (e.key === 'PageDown' || e.key === 'PageUp') return true;

  // Specifically whitelisted bare Ctrl keys
  if (SAFE_CTRL_KEYS.has(e.key.toLowerCase())) return true;

  return false;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useKeyboardShortcuts(
  focusedPaneId: PaneId | null,
  onOpenSettings?: (open: boolean) => void,
): void {
  const {
    shortcuts,
    workspaces,
    activeWorkspaceId,
    createWorkspace,
    closeWorkspace,
    selectWorkspace,
    updateSplitTree,
    toggleSidebar,
    addSurface,
    nextSurface,
    prevSurface,
    closeSurface,
  } = useStore();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (!isSafeToIntercept(e)) return;

      const shortcutEntries = Object.entries(shortcuts) as [ShortcutAction, ShortcutBinding][];

      for (const [action, binding] of shortcutEntries) {
        if (!matchesBinding(e, binding)) continue;

        // Found a matching action — prevent default and handle it
        e.preventDefault();
        dispatchAction(action);
        return;
      }
    }

    function dispatchAction(action: ShortcutAction): void {
      switch (action) {
        case 'newWorkspace': {
          createWorkspace();
          break;
        }

        case 'closeWorkspace': {
          if (activeWorkspaceId) closeWorkspace(activeWorkspaceId);
          break;
        }

        case 'toggleSidebar': {
          toggleSidebar();
          break;
        }

        case 'nextWorkspace': {
          if (workspaces.length === 0 || !activeWorkspaceId) break;
          const idx = workspaces.findIndex((w) => w.id === activeWorkspaceId);
          const nextIdx = (idx + 1) % workspaces.length;
          selectWorkspace(workspaces[nextIdx].id);
          break;
        }

        case 'prevWorkspace': {
          if (workspaces.length === 0 || !activeWorkspaceId) break;
          const idx = workspaces.findIndex((w) => w.id === activeWorkspaceId);
          const prevIdx = (idx - 1 + workspaces.length) % workspaces.length;
          selectWorkspace(workspaces[prevIdx].id);
          break;
        }

        case 'splitRight': {
          if (!activeWorkspaceId || !focusedPaneId) break;
          const ws = useStore.getState().workspaces.find((w) => w.id === activeWorkspaceId);
          if (!ws) break;
          const newPaneId: PaneId = `pane-${uuid()}` as PaneId;
          const newTree = splitNode(ws.splitTree, focusedPaneId, newPaneId, 'terminal', 'horizontal');
          updateSplitTree(activeWorkspaceId, newTree);
          break;
        }

        case 'splitDown': {
          if (!activeWorkspaceId || !focusedPaneId) break;
          const ws = useStore.getState().workspaces.find((w) => w.id === activeWorkspaceId);
          if (!ws) break;
          const newPaneId: PaneId = `pane-${uuid()}` as PaneId;
          const newTree = splitNode(ws.splitTree, focusedPaneId, newPaneId, 'terminal', 'vertical');
          updateSplitTree(activeWorkspaceId, newTree);
          break;
        }

        case 'closeSurfaceOrPane': {
          if (!activeWorkspaceId || !focusedPaneId) break;
          const ws = useStore.getState().workspaces.find((w) => w.id === activeWorkspaceId);
          if (!ws) break;
          const leaf = findLeaf(ws.splitTree, focusedPaneId);
          if (leaf && leaf.surfaces.length > 0) {
            // Close the active surface; if it's the last, closeSurface removes the pane
            const activeSurface = leaf.surfaces[leaf.activeSurfaceIndex];
            if (activeSurface) {
              closeSurface(activeWorkspaceId, focusedPaneId, activeSurface.id);
              break;
            }
          }
          // Fallback: no surfaces found, remove the pane directly (guard: keep last pane)
          const paneIds = getAllPaneIds(ws.splitTree);
          if (paneIds.length <= 1) break;
          const newTree = removeLeaf(ws.splitTree, focusedPaneId);
          if (newTree) updateSplitTree(activeWorkspaceId, newTree);
          break;
        }

        case 'newSurface': {
          if (!activeWorkspaceId || !focusedPaneId) break;
          addSurface(activeWorkspaceId, focusedPaneId, 'terminal');
          break;
        }

        case 'nextSurface': {
          if (!activeWorkspaceId || !focusedPaneId) break;
          nextSurface(activeWorkspaceId, focusedPaneId);
          break;
        }

        case 'prevSurface': {
          if (!activeWorkspaceId || !focusedPaneId) break;
          prevSurface(activeWorkspaceId, focusedPaneId);
          break;
        }

        // Ctrl+1 through Ctrl+9 — handled separately via event listener below,
        // but here we just have them as no-ops in case they appear in shortcuts.

        case 'openSettings': {
          onOpenSettings?.(true);
          break;
        }

        // Unimplemented actions — log for now
        default:
          console.log(`[wmux] Shortcut triggered: ${action}`);
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    shortcuts,
    workspaces,
    activeWorkspaceId,
    focusedPaneId,
    createWorkspace,
    closeWorkspace,
    selectWorkspace,
    updateSplitTree,
    toggleSidebar,
    addSurface,
    nextSurface,
    prevSurface,
    closeSurface,
    onOpenSettings,
  ]);

  // Ctrl+1 through Ctrl+9 — select workspace by index
  useEffect(() => {
    function handleWorkspaceIndexKey(e: KeyboardEvent): void {
      if (!e.ctrlKey || e.shiftKey || e.altKey) return;
      const digit = parseInt(e.key, 10);
      if (isNaN(digit) || digit < 1 || digit > 9) return;

      e.preventDefault();
      const target = workspaces[digit - 1];
      if (target) selectWorkspace(target.id);
    }

    document.addEventListener('keydown', handleWorkspaceIndexKey);
    return () => {
      document.removeEventListener('keydown', handleWorkspaceIndexKey);
    };
  }, [workspaces, selectWorkspace]);
}
