import React, { useState, useRef, useMemo } from 'react';
import { WorkspaceInfo, SplitNode } from '../../../shared/types';
import UnreadBadge from './UnreadBadge';
import PrStatusIcon from './PrStatusIcon';

function getAllSurfaceIds(tree: SplitNode): string[] {
  if (tree.type === 'leaf') return tree.surfaces.map(s => s.id);
  return [...getAllSurfaceIds(tree.children[0]), ...getAllSurfaceIds(tree.children[1])];
}

interface WorkspaceRowProps {
  workspace: WorkspaceInfo;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onRename?: (newTitle: string) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  // Drag-and-drop
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragOver?: boolean;
  agentCount?: number;
  hookActivity?: { agents: number; tools: number; lastSeen: number };
  claudeActivity?: Record<string, any>;
}

export default function WorkspaceRow({
  workspace,
  isActive,
  onSelect,
  onClose,
  onRename,
  onContextMenu,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragOver = false,
  agentCount = 0,
  hookActivity,
  claudeActivity,
}: WorkspaceRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(workspace.title);
  const rowRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Support custom color: override the active background if set
  const activeBackground = workspace.customColor ?? '#0091FF';
  const customColorTint = workspace.customColor
    ? `${workspace.customColor}0D` // ~5% opacity
    : undefined;

  // Find Claude activity for this workspace's surfaces
  const wsActivity = useMemo(() => {
    if (!claudeActivity) return null;
    const surfaceIds = getAllSurfaceIds(workspace.splitTree);
    for (const sid of surfaceIds) {
      if (claudeActivity[sid]) return claudeActivity[sid];
    }
    return null;
  }, [claudeActivity, workspace.splitTree]);

  const rowStyle: React.CSSProperties = isActive
    ? { backgroundColor: activeBackground }
    : customColorTint
    ? { backgroundColor: customColorTint }
    : {};

  // ── Status text: "Running" / "Done: notification..." / "Interrupted" ──
  const statusText = useMemo(() => {
    const state = workspace.shellState;
    if (state === 'running') return 'Running';
    if (state === 'interrupted') return 'Interrupted';
    if (state === 'idle') {
      return workspace.notificationText
        ? `Done: ${workspace.notificationText}`
        : 'Done';
    }
    // No shell state yet — show notification if available
    if (workspace.notificationText) return workspace.notificationText;
    return null;
  }, [workspace.shellState, workspace.notificationText]);

  // ── Status color class ──
  const statusClass = useMemo(() => {
    const state = workspace.shellState;
    if (state === 'running') return 'workspace-row__status--running';
    if (state === 'interrupted') return 'workspace-row__status--interrupted';
    if (state === 'idle') return 'workspace-row__status--done';
    return '';
  }, [workspace.shellState]);

  // ── Context line: "branch* · ~/path/to/dir" ──
  const contextLine = useMemo(() => {
    const parts: string[] = [];
    if (workspace.gitBranch) {
      parts.push(`${workspace.gitBranch}${workspace.gitDirty ? '*' : ''}`);
    }
    if (workspace.cwd) {
      // Shorten Windows paths for display
      const shortCwd = workspace.cwd
        .replace(/\\/g, '/')
        .replace(/^[A-Z]:\//i, '~/')
        .replace(/\/Users\/[^/]+/i, '~');
      parts.push(shortCwd);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }, [workspace.gitBranch, workspace.gitDirty, workspace.cwd]);

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
        <span
          className={`workspace-row__state-dot${
            workspace.shellState === 'running' ? ' workspace-row__state-dot--running' :
            workspace.shellState === 'interrupted' ? ' workspace-row__state-dot--interrupted' :
            workspace.shellState === 'idle' ? ' workspace-row__state-dot--idle' : ''
          }`}
        />
        {isRenaming ? (
          <input
            ref={renameInputRef}
            className="workspace-row__rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => {
              if (renameValue.trim() && renameValue !== workspace.title) {
                onRename?.(renameValue.trim());
              }
              setIsRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (renameValue.trim() && renameValue !== workspace.title) {
                  onRename?.(renameValue.trim());
                }
                setIsRenaming(false);
              }
              if (e.key === 'Escape') {
                setRenameValue(workspace.title);
                setIsRenaming(false);
              }
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        ) : (
          <span
            className="workspace-row__title"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setRenameValue(workspace.title);
              setIsRenaming(true);
            }}
          >
            {workspace.title}
          </span>
        )}

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

      {/* Status line: "Running" / "Done: notification..." / "Interrupted" */}
      {statusText && (
        <div className={`workspace-row__status ${statusClass}`}>
          {statusText}
        </div>
      )}

      {/* PR info — shown inline if present */}
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

      {/* Context line: "branch* · ~/path/to/dir" */}
      {contextLine && (
        <div className="workspace-row__context">
          {contextLine}
        </div>
      )}

      {/* Claude agent activity — compact lines below context */}
      {wsActivity && wsActivity.agents && wsActivity.agents.length > 0 && (
        <div className="workspace-row__claude-activity">
          {wsActivity.agents.map((agent: any, i: number) => (
            <div key={i} className="workspace-row__agent-line">
              <span className={`workspace-row__agent-dot ${agent.done ? 'workspace-row__agent-dot--done' : 'workspace-row__agent-dot--working'}`} />
              <span className="workspace-row__agent-name">{agent.name}</span>
              <span className="workspace-row__agent-tokens">{agent.tokens}tok</span>
            </div>
          ))}
        </div>
      )}
      {wsActivity?.activeSkill && (
        <div className="workspace-row__meta-line workspace-row__skill">
          {wsActivity.activeSkill}
        </div>
      )}
    </div>
  );
}
