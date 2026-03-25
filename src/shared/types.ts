// ID types
export type WorkspaceId = `ws-${string}`;
export type PaneId = `pane-${string}`;
export type SurfaceId = `surf-${string}`;
export type WindowId = `win-${string}`;

// Split tree
export type SplitNode =
  | { type: 'leaf'; paneId: PaneId; surfaces: SurfaceRef[]; activeSurfaceIndex: number }
  | { type: 'branch'; direction: 'horizontal' | 'vertical'; ratio: number; children: [SplitNode, SplitNode] };

export interface SurfaceRef {
  id: SurfaceId;
  type: 'terminal' | 'browser' | 'markdown';
}

// Workspace
export interface WorkspaceInfo {
  id: WorkspaceId;
  title: string;
  customColor?: string;
  pinned: boolean;
  shell: string;
  splitTree: SplitNode;
  unreadCount: number;
  gitBranch?: string;
  gitDirty?: boolean;
  cwd?: string;
  prNumber?: number;
  prStatus?: 'open' | 'merged' | 'closed';
  prLabel?: string;
  ports?: number[];
  notificationText?: string;
  shellState?: 'idle' | 'running';
}

// Surface
export interface SurfaceInfo {
  id: SurfaceId;
  type: 'terminal' | 'browser' | 'markdown';
  title?: string;
}

// Pane
export interface PaneInfo {
  id: PaneId;
  surfaces: SurfaceInfo[];
  activeSurfaceId: SurfaceId;
}

// Window
export interface WindowInfo {
  id: WindowId;
  bounds: { x: number; y: number; width: number; height: number };
  workspaceIds: WorkspaceId[];
  activeWorkspaceId: WorkspaceId;
}

// Theme
export interface ThemeConfig {
  name: string;
  background: string;
  foreground: string;
  cursor: string;
  cursorText: string;
  selectionBackground: string;
  selectionForeground: string;
  palette: string[]; // 16 ANSI colors
  fontFamily: string;
  fontSize: number;
  backgroundOpacity: number;
}

// Notification
export interface NotificationInfo {
  id: string;
  surfaceId: SurfaceId;
  workspaceId: WorkspaceId;
  text: string;
  title?: string;
  timestamp: number;
  read: boolean;
}

// Shell
export interface ShellInfo {
  name: string;
  command: string;
  args: string[];
  available: boolean;
}

// Sidebar metadata
export interface SidebarMetadata {
  gitBranch?: string;
  gitDirty?: boolean;
  cwd?: string;
  prNumber?: number;
  prStatus?: string;
  prLabel?: string;
  ports?: number[];
  notificationText?: string;
  shellState?: 'idle' | 'running';
  statusEntries?: Record<string, string>;
  progress?: { value: number; label?: string };
  logs?: Array<{ level: string; message: string; timestamp: number }>;
}

// IPC channel names
export const IPC_CHANNELS = {
  // PTY
  PTY_CREATE: 'pty:create',
  PTY_WRITE: 'pty:write',
  PTY_RESIZE: 'pty:resize',
  PTY_KILL: 'pty:kill',
  PTY_DATA: 'pty:data',
  PTY_EXIT: 'pty:exit',
  // Workspace
  WORKSPACE_CREATE: 'workspace:create',
  WORKSPACE_CLOSE: 'workspace:close',
  WORKSPACE_SELECT: 'workspace:select',
  WORKSPACE_RENAME: 'workspace:rename',
  WORKSPACE_LIST: 'workspace:list',
  WORKSPACE_REORDER: 'workspace:reorder',
  WORKSPACE_MOVE_TO_WINDOW: 'workspace:moveToWindow',
  // Surface
  SURFACE_CREATE: 'surface:create',
  SURFACE_CLOSE: 'surface:close',
  SURFACE_FOCUS: 'surface:focus',
  SURFACE_LIST: 'surface:list',
  SURFACE_READ_TEXT: 'surface:readText',
  SURFACE_SEND_TEXT: 'surface:sendText',
  SURFACE_SEND_KEY: 'surface:sendKey',
  SURFACE_TRIGGER_FLASH: 'surface:triggerFlash',
  // Pane
  PANE_SPLIT: 'pane:split',
  PANE_CLOSE: 'pane:close',
  PANE_FOCUS: 'pane:focus',
  PANE_ZOOM: 'pane:zoom',
  PANE_LIST: 'pane:list',
  // Notification
  NOTIFICATION_FIRE: 'notification:fire',
  NOTIFICATION_LIST: 'notification:list',
  NOTIFICATION_CLEAR: 'notification:clear',
  NOTIFICATION_JUMP: 'notification:jump',
  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_CHANGED: 'settings:changed',
  // Window
  WINDOW_CREATE: 'window:create',
  WINDOW_CLOSE: 'window:close',
  WINDOW_FOCUS: 'window:focus',
  WINDOW_LIST: 'window:list',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_IS_MAXIMIZED: 'window:isMaximized',
  // Config
  CONFIG_GET_THEME: 'config:getTheme',
  CONFIG_GET_THEME_LIST: 'config:getThemeList',
  CONFIG_IMPORT_WT: 'config:importWindowsTerminal',
  CONFIG_IMPORT_GHOSTTY: 'config:importGhostty',
  // System
  SYSTEM_GET_SHELLS: 'system:getShells',
  SYSTEM_OPEN_EXTERNAL: 'system:openExternal',
  // Metadata events (main → renderer)
  METADATA_UPDATE: 'metadata:update',
} as const;
