import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from './store';
import { PaneId } from '../shared/types';
import SplitContainer from './components/SplitPane/SplitContainer';
import { updateRatio, getAllPaneIds } from './store/split-utils';

export default function App() {
  const { workspaces, activeWorkspaceId, createWorkspace, updateSplitTree } = useStore();
  const [focusedPaneId, setFocusedPaneId] = useState<PaneId | null>(null);

  // Create initial workspace on mount
  useEffect(() => {
    if (workspaces.length === 0) {
      createWorkspace();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus first pane whenever the active workspace changes or gains its first pane
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  useEffect(() => {
    if (!activeWorkspace) return;
    const paneIds = getAllPaneIds(activeWorkspace.splitTree);
    if (paneIds.length > 0 && (focusedPaneId === null || !paneIds.includes(focusedPaneId))) {
      setFocusedPaneId(paneIds[0]);
    }
  }, [activeWorkspace?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRatioChange = useCallback(
    (leftPaneId: PaneId, rightPaneId: PaneId, ratio: number) => {
      if (!activeWorkspace) return;
      const newTree = updateRatio(activeWorkspace.splitTree, leftPaneId, rightPaneId, ratio);
      updateSplitTree(activeWorkspace.id, newTree);
    },
    [activeWorkspace, updateSplitTree],
  );

  const handlePaneFocus = useCallback((paneId: PaneId) => {
    setFocusedPaneId(paneId);
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <div
        style={{
          width: 200,
          background: '#1a1a1a',
          borderRight: '1px solid #333',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: 10,
            fontSize: 12.5,
            fontWeight: 600,
            color: '#fdfff1',
            height: 38,
            display: 'flex',
            alignItems: 'center',
            WebkitAppRegion: 'drag',
          } as React.CSSProperties & { WebkitAppRegion: string }}
        >
          wmux
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeWorkspace ? (
          <SplitContainer
            node={activeWorkspace.splitTree}
            focusedPaneId={focusedPaneId}
            onRatioChange={handleRatioChange}
            onPaneFocus={handlePaneFocus}
          />
        ) : null}
      </div>
    </div>
  );
}
