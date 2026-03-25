import * as pty from 'node-pty';
import { v4 as uuidv4 } from 'uuid';
import { SurfaceId } from '../shared/types';

interface PtyEntry {
  pty: pty.IPty;
  dataListeners: Set<(data: string) => void>;
  exitListeners: Set<(code: number) => void>;
}

export interface CreateOptions {
  shell: string;
  cwd: string;
  env: Record<string, string>;
  cols?: number;
  rows?: number;
}

export class PtyManager {
  private ptys = new Map<SurfaceId, PtyEntry>();

  create(options: CreateOptions): SurfaceId {
    const id: SurfaceId = `surf-${uuidv4()}`;

    const ptyProcess = pty.spawn(options.shell, [], {
      name: 'xterm-256color',
      cols: options.cols ?? 80,
      rows: options.rows ?? 24,
      cwd: options.cwd,
      env: options.env as { [key: string]: string },
      useConpty: true,
    });

    const entry: PtyEntry = {
      pty: ptyProcess,
      dataListeners: new Set(),
      exitListeners: new Set(),
    };

    ptyProcess.onData((data) => {
      for (const listener of entry.dataListeners) {
        listener(data);
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      for (const listener of entry.exitListeners) {
        listener(exitCode);
      }
      this.ptys.delete(id);
    });

    this.ptys.set(id, entry);
    return id;
  }

  write(id: SurfaceId, data: string): void {
    const entry = this.ptys.get(id);
    if (entry) {
      entry.pty.write(data);
    }
  }

  resize(id: SurfaceId, cols: number, rows: number): void {
    const entry = this.ptys.get(id);
    if (entry) {
      entry.pty.resize(cols, rows);
    }
  }

  kill(id: SurfaceId): void {
    const entry = this.ptys.get(id);
    if (entry) {
      try {
        entry.pty.kill();
      } catch {
        // Process may already be dead
      }
      this.ptys.delete(id);
    }
  }

  killAll(): void {
    for (const id of this.ptys.keys()) {
      this.kill(id);
    }
  }

  has(id: SurfaceId): boolean {
    return this.ptys.has(id);
  }

  onData(id: SurfaceId, callback: (data: string) => void): () => void {
    const entry = this.ptys.get(id);
    if (!entry) {
      return () => {};
    }
    entry.dataListeners.add(callback);
    return () => entry.dataListeners.delete(callback);
  }

  onExit(id: SurfaceId, callback: (code: number) => void): () => void {
    const entry = this.ptys.get(id);
    if (!entry) {
      return () => {};
    }
    entry.exitListeners.add(callback);
    return () => entry.exitListeners.delete(callback);
  }

  getPid(id: SurfaceId): number | undefined {
    const entry = this.ptys.get(id);
    return entry?.pty.pid;
  }
}
