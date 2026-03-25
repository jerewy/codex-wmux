import { contextBridge } from 'electron';

// Stub API — expanded in later tasks
contextBridge.exposeInMainWorld('wmux', {
  system: {
    platform: 'win32' as const,
  },
});
