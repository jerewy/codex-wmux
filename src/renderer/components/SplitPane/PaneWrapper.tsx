import React from 'react';
import { PaneId, SplitNode } from '../../../shared/types';
import TerminalPane from '../Terminal/TerminalPane';
import '../../styles/splitpane.css';

interface PaneWrapperProps {
  paneId: PaneId;
  leaf: SplitNode & { type: 'leaf' };
  isFocused: boolean;
}

export default function PaneWrapper({ leaf, isFocused }: PaneWrapperProps) {
  const activeSurface = leaf.surfaces[leaf.activeSurfaceIndex];

  const renderSurface = () => {
    if (!activeSurface) return null;
    switch (activeSurface.type) {
      case 'terminal':
        return <TerminalPane focused={isFocused} />;
      // browser and markdown surfaces are handled in later tasks
      default:
        return null;
    }
  };

  return (
    <div className="pane-wrapper">
      {renderSurface()}
      <div
        className="pane-wrapper__unfocused-overlay"
        style={{ opacity: isFocused ? 0 : 1 }}
      />
    </div>
  );
}
