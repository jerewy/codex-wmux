import React, { useState, useRef } from 'react';
import { WorkspaceInfo } from '../../../shared/types';
import UnreadBadge from './UnreadBadge';
import PrStatusIcon from './PrStatusIcon';

interface WorkspaceRowProps {
  workspace: WorkspaceInfo;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  // Drag-and-drop
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragOver?: boolean;
}

export default function WorkspaceRow({
  workspace,
  isActive,
  onSelect,
  onClose,
  onContextMenu,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragOver = false,
}: WorkspaceRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  // Support custom color: override the active background if set
  const activeBackground = workspace.customColor ?? '#0091FF';
  const customColorTint = workspace.customColor
    ? `${workspace.customColor}0D` // ~5% opacity
    : undefined;

  const rowStyle: React.CSSProperties = isActive
    ? { backgroundColor: activeBackground }
    : customColorTint
    ? { backgroundColor: customColorTint }
    : {};

  const portsStr = workspace.ports && workspace.ports.length > 0
    ? workspace.ports.map((p) => `:${p}`).join(', ')
    : null;

  return (
    <div
      ref={rowRef}
      className={[
        'workspace-row',
        isActive ? 'workspace-row--active' : '',
        isDragOver ? 'workspace-row--drag-over' : '',
      ].filter(Boolean).join(' ')}
      style={rowStyle}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {/* Left rail indicator — always rendered; CSS controls opacity */}
      <span className="workspace-row__rail" />

      {/* Title row */}
      <div className="workspace-row__header">
        <span className="workspace-row__title">
          {workspace.title}
        </span>

        {workspace.unreadCount > 0 && (
          <UnreadBadge count={workspace.unreadCount} isSelected={isActive} />
        )}

        <button
          className="workspace-row__close"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          title="Close workspace"
        >
          ✕
        </button>
      </div>

      {/* Metadata section */}
      {(workspace.notificationText ||
        workspace.gitBranch ||
        workspace.cwd ||
        workspace.prNumber != null ||
        portsStr) && (
        <div className="workspace-row__metadata">
          {/* Notification text */}
          {workspace.notificationText && (
            <div className="workspace-row__notification">
              {workspace.notificationText}
            </div>
          )}

          {/* PR info */}
          {workspace.prNumber != null && (
            <div className="workspace-row__pr">
              {workspace.prStatus != null && (
                <PrStatusIcon status={workspace.prStatus} size={12} />
              )}
              <span className="workspace-row__pr-number">
                #{workspace.prNumber}
              </span>
              {workspace.prStatus != null && (
                <span className="workspace-row__pr-status">
                  {workspace.prStatus}
                </span>
              )}
            </div>
          )}

          {/* Git branch */}
          {workspace.gitBranch && (
            <div className="workspace-row__meta-line">
              {workspace.gitDirty ? '* ' : ''}{workspace.gitBranch}
            </div>
          )}

          {/* Working directory */}
          {workspace.cwd && (
            <div className="workspace-row__meta-line">
              {workspace.cwd}
            </div>
          )}

          {/* Ports */}
          {portsStr && (
            <div className="workspace-row__meta-line">
              {portsStr}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
