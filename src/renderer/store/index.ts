import { create } from 'zustand';
import { WorkspaceSlice, createWorkspaceSlice } from './workspace-slice';
import { SettingsSlice, createSettingsSlice } from './settings-slice';
import { NotificationSlice, createNotificationSlice } from './notification-slice';
import { SurfaceSlice, createSurfaceSlice } from './surface-slice';

export type WmuxStore = WorkspaceSlice & SettingsSlice & NotificationSlice & SurfaceSlice;

export const useStore = create<WmuxStore>()((...args) => ({
  ...createWorkspaceSlice(...args),
  ...createSettingsSlice(...args),
  ...createNotificationSlice(...args),
  ...createSurfaceSlice(...args),
}));
