import { describe, expect, it, beforeEach } from 'vitest';
import { useStore } from '../../src/renderer/store';

describe('workspace restore', () => {
  beforeEach(() => {
    useStore.setState({ workspaces: [], activeWorkspaceId: null });
  });

  it('restores the previously active workspace when replacing saved workspaces', () => {
    useStore.getState().replaceAllWorkspaces([
      {
        id: 'ws-saved-1' as any,
        title: 'First',
        shell: 'pwsh.exe',
        splitTree: {
          type: 'leaf',
          paneId: 'pane-1',
          surfaces: [{ id: 'surf-1', type: 'terminal' }],
          activeSurfaceIndex: 0,
        },
      },
      {
        id: 'ws-saved-2' as any,
        title: 'Second',
        shell: 'pwsh.exe',
        splitTree: {
          type: 'leaf',
          paneId: 'pane-2',
          surfaces: [{ id: 'surf-2', type: 'terminal' }],
          activeSurfaceIndex: 0,
        },
      },
    ], 'ws-saved-2');

    const state = useStore.getState();
    expect(state.workspaces).toHaveLength(2);
    expect(state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId)?.title).toBe('Second');
  });

  it('falls back to the first workspace when the saved active workspace is missing', () => {
    useStore.getState().replaceAllWorkspaces([
      {
        id: 'ws-saved-1' as any,
        title: 'First',
        shell: 'pwsh.exe',
        splitTree: {
          type: 'leaf',
          paneId: 'pane-1',
          surfaces: [{ id: 'surf-1', type: 'terminal' }],
          activeSurfaceIndex: 0,
        },
      },
    ], 'ws-missing');

    const state = useStore.getState();
    expect(state.activeWorkspaceId).toBe(state.workspaces[0].id);
  });
});
