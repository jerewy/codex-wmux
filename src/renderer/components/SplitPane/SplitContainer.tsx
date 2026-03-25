import React, { useCallback } from 'react';
import { SplitNode, PaneId } from '../../../shared/types';
import PaneWrapper from './PaneWrapper';
import SplitDivider from './SplitDivider';
import { updateRatio } from '../../store/split-utils';
import '../../styles/splitpane.css';

interface SplitContainerProps {
  node: SplitNode;
  focusedPaneId: PaneId | null;
  onRatioChange: (leftPaneId: PaneId, rightPaneId: PaneId, ratio: number) => void;
  onPaneFocus: (paneId: PaneId) => void;
}

export default function SplitContainer({
  node,
  focusedPaneId,
  onRatioChange,
  onPaneFocus,
}: SplitContainerProps) {
  if (node.type === 'leaf') {
    return (
      <div
        className="split-child"
        style={{ width: '100%', height: '100%' }}
        onClick={() => onPaneFocus(node.paneId)}
      >
        <PaneWrapper
          paneId={node.paneId}
          leaf={node}
          isFocused={focusedPaneId === node.paneId}
        />
      </div>
    );
  }

  // Branch node
  const { direction, ratio, children } = node;
  const [leftChild, rightChild] = children;

  // Collect the "first" pane ID from each subtree for the divider's ratio change callback
  const getFirstPaneId = (n: SplitNode): PaneId => {
    if (n.type === 'leaf') return n.paneId;
    return getFirstPaneId(n.children[0]);
  };

  const leftPaneId = getFirstPaneId(leftChild);
  const rightPaneId = getFirstPaneId(rightChild);

  const handleDividerRatioChange = useCallback(
    (delta: number) => {
      const newRatio = Math.min(0.9, Math.max(0.1, ratio + delta));
      onRatioChange(leftPaneId, rightPaneId, newRatio);
    },
    [ratio, leftPaneId, rightPaneId, onRatioChange],
  );

  return (
    <div className={`split-container split-container--${direction}`}>
      <div className="split-child" style={{ flex: ratio }}>
        <SplitContainer
          node={leftChild}
          focusedPaneId={focusedPaneId}
          onRatioChange={onRatioChange}
          onPaneFocus={onPaneFocus}
        />
      </div>

      <SplitDivider
        direction={direction}
        onRatioChange={handleDividerRatioChange}
      />

      <div className="split-child" style={{ flex: 1 - ratio }}>
        <SplitContainer
          node={rightChild}
          focusedPaneId={focusedPaneId}
          onRatioChange={onRatioChange}
          onPaneFocus={onPaneFocus}
        />
      </div>
    </div>
  );
}
