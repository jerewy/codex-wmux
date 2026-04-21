import React, { useState, useRef, useMemo, useEffect } from 'react';
import { WorkspaceInfo, SplitNode } from '../../../shared/types';
import UnreadBadge from './UnreadBadge';
import PrStatusIcon from './PrStatusIcon';
import { deriveWorkspaceRowStatus, WorkspaceCompletion } from './workspace-status';

function getAllSurfaceIds(tree: SplitNode): string[] {
  if (tree.type === 'leaf') return tree.surfaces.map(s => s.id);
  return [...getAllSurfaceIds(tree.children[0]), ...getAllSurfaceIds(tree.children[1])];
}

/** Human-readable label for a tool name */
function getToolLabel(tool: string): string {
  switch (tool) {
    case 'Bash': return 'Running command...';
    case 'Read': return 'Reading file...';
    case 'Edit': return 'Editing...';
    case 'Write': return 'Writing file...';
    case 'Grep': return 'Searching code...';
    case 'Glob': return 'Finding files...';
    case 'Agent': return 'Running agent...';
    case 'WebSearch': return 'Searching web...';
    case 'WebFetch': return 'Fetching page...';
    case 'Skill': return 'Loading skill...';
    default: return tool.includes(':') ? `MCP: ${tool}` : `${tool}...`;
  }
}

interface WorkspaceRowProps {
  workspace: WorkspaceInfo;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onRename?: (newTitle: string) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragOver?: boolean;
  agentCount?: number;
  hookActivity?: { lastTool: string; toolCount: number; lastSeen: number };
  claudeActivity?: Record<string, any>;
  recentCompletion?: WorkspaceCompletion;
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
  agentCount: _agentCount = 0,
  hookActivity,
  claudeActivity,
  recentCompletion,
}: WorkspaceRowProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(workspace.title);
  const rowRef = useRef<HTMLDivElement>(null);

  // Listen for rename shortcut event (only the active workspace responds)
  useEffect(() => {
    if (!isActive) return;
    const handler = () => {
      setIsRenaming(true);
      setRenameValue(workspace.title);
    };
    document.addEventListener('wmux:rename-workspace', handler);
    return () => document.removeEventListener('wmux:rename-workspace', handler);
  }, [isActive, workspace.title]);

  const activeBackground = workspace.customColor ?? '#0091FF';
  const customColorTint = workspace.customColor
    ? `${workspace.customColor}0D`
    : undefined;

  // Tick counter — forces re-evaluation of time-based memos every 2 seconds.
  // Without this, useMemo caches stale Date.now() results because the deps
  // (hookActivity/wsActivity) don't change even though time has passed.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(timer);
  }, []);

  // Find Claude activity for this workspace's surfaces (from PTY observer)
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

  // How long a tool label persists after the last hook/observer event (ms)
  const ACTIVITY_TTL = 5000;
  const COMPLETION_TTL = 120000;

  // ── Determine if Claude is actively working (recent hook or observer data) ──
  const isClaudeActive = useMemo(() => {
    const now = Date.now();
    if (hookActivity && now - hookActivity.lastSeen < ACTIVITY_TTL) return true;
    if (wsActivity && now - wsActivity.lastUpdate < ACTIVITY_TTL) return true;
    return false;
  }, [hookActivity, wsActivity, tick]);

  // ── Current tool label (from observer or hooks) ──
  const currentToolLabel = useMemo(() => {
    const now = Date.now();
    // Prefer observer data (more specific — comes from PTY output parsing)
    if (wsActivity?.lastTool && now - wsActivity.lastUpdate < ACTIVITY_TTL) {
      return getToolLabel(wsActivity.lastTool);
    }
    // Fall back to hook data
    if (hookActivity?.lastTool && now - hookActivity.lastSeen < ACTIVITY_TTL) {
      return getToolLabel(hookActivity.lastTool);
    }
    return null;
  }, [wsActivity, hookActivity, tick]);

  // ── Detect "Claude was active but stopped" (shell still says running) ──
  const claudeIsIdle = useMemo(() => {
    if (workspace.shellState !== 'running') return false;
    if (!hookActivity) return false;
    const now = Date.now();
    return now - hookActivity.lastSeen >= ACTIVITY_TTL;
  }, [workspace.shellState, hookActivity, tick]);

  const hasRecentTerminalActivity = useMemo(() => {
    if (!workspace.terminalLastActivity) return false;
    return Date.now() - workspace.terminalLastActivity < ACTIVITY_TTL;
  }, [workspace.terminalLastActivity, tick]);

  // ── Context line: "branch* · ~/path/to/dir" ──
  const contextLine = useMemo(() => {
    const parts: string[] = [];
    if (workspace.gitBranch) {
      parts.push(`${workspace.gitBranch}${workspace.gitDirty ? '*' : ''}`);
    }
    if (workspace.cwd) {
      const shortCwd = workspace.cwd
        .replace(/\\/g, '/')
        .replace(/^[A-Z]:\//i, '~/')
        .replace(/\/Users\/[^/]+/i, '~');
      parts.push(shortCwd);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }, [workspace.gitBranch, workspace.gitDirty, workspace.cwd]);

  const rowStatus = deriveWorkspaceRowStatus({
    now: Date.now(),
    activityTtlMs: ACTIVITY_TTL,
    completionTtlMs: COMPLETION_TTL,
    currentToolLabel,
    claudeIsIdle,
    hasRecentTerminalActivity,
    shellState: workspace.shellState,
    notificationText: workspace.notificationText,
    recentCompletion,
  });

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
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <span className="workspace-row__rail" />

      {/* Line 1: Title */}
      <div className="workspace-row__header">
        <span className={`workspace-row__state-dot ${isClaudeActive ? 'workspace-row__state-dot--running' : rowStatus.stateDotClass}`} />
        {isRenaming ? (
          <input
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
          &#x2715;
        </button>
      </div>

      {/* Line 2: Status — always visible */}
      <div className={`workspace-row__status ${rowStatus.statusClass}`}>
        {rowStatus.text}
      </div>

      {/* PR info */}
      {workspace.prNumber != null && (
        <div className="workspace-row__pr">
          {workspace.prStatus != null && (
            <PrStatusIcon status={workspace.prStatus} size={12} />
          )}
          <span className="workspace-row__pr-number">#{workspace.prNumber}</span>
          {workspace.prStatus != null && (
            <span className="workspace-row__pr-status">{workspace.prStatus}</span>
          )}
        </div>
      )}

      {/* Line 3: Context — branch · path */}
      {contextLine && (
        <div className="workspace-row__context">
          {contextLine}
        </div>
      )}

      {/* Claude agent activity — sub-agents with status */}
      {wsActivity?.agents?.length > 0 && (
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

      {/* Active skill */}
      {wsActivity?.activeSkill && (
        <div className="workspace-row__meta-line workspace-row__skill">
          {wsActivity.activeSkill}
        </div>
      )}
    </div>
  );
}
