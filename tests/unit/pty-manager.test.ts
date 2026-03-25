import { describe, it, expect, afterEach } from 'vitest';
import { PtyManager } from '../../src/main/pty-manager';

const TEST_SHELL = 'cmd.exe';
const TEST_ENV = Object.fromEntries(
  Object.entries(process.env).filter(([, v]) => v !== undefined)
) as Record<string, string>;

describe('PtyManager', () => {
  const managers: PtyManager[] = [];

  function makeManager(): PtyManager {
    const m = new PtyManager();
    managers.push(m);
    return m;
  }

  afterEach(() => {
    for (const m of managers) {
      m.killAll();
    }
    managers.length = 0;
  });

  it('create returns a surf- prefixed SurfaceId', () => {
    const manager = makeManager();
    const id = manager.create({
      shell: TEST_SHELL,
      cwd: process.env.USERPROFILE || 'C:\\',
      env: TEST_ENV,
    });
    expect(id).toMatch(/^surf-/);
  });

  it('has() returns true after create and false after kill', () => {
    const manager = makeManager();
    const id = manager.create({
      shell: TEST_SHELL,
      cwd: process.env.USERPROFILE || 'C:\\',
      env: TEST_ENV,
    });
    expect(manager.has(id)).toBe(true);
    manager.kill(id);
    expect(manager.has(id)).toBe(false);
  });

  it('write does not throw', () => {
    const manager = makeManager();
    const id = manager.create({
      shell: TEST_SHELL,
      cwd: process.env.USERPROFILE || 'C:\\',
      env: TEST_ENV,
    });
    expect(() => manager.write(id, 'echo hello\r')).not.toThrow();
  });

  it('resize does not throw', () => {
    const manager = makeManager();
    const id = manager.create({
      shell: TEST_SHELL,
      cwd: process.env.USERPROFILE || 'C:\\',
      env: TEST_ENV,
    });
    expect(() => manager.resize(id, 120, 40)).not.toThrow();
  });

  it('receives data from PTY after writing', async () => {
    const manager = makeManager();
    const id = manager.create({
      shell: TEST_SHELL,
      cwd: process.env.USERPROFILE || 'C:\\',
      env: TEST_ENV,
      cols: 80,
      rows: 24,
    });

    const received = await new Promise<string>((resolve) => {
      const unsub = manager.onData(id, (data) => {
        unsub();
        resolve(data);
      });
      // Write something to trigger output; initial prompt should arrive shortly
    });

    expect(typeof received).toBe('string');
    expect(received.length).toBeGreaterThan(0);
  });

  it('kill removes the PTY from the manager', () => {
    const manager = makeManager();
    const id = manager.create({
      shell: TEST_SHELL,
      cwd: process.env.USERPROFILE || 'C:\\',
      env: TEST_ENV,
    });
    expect(manager.has(id)).toBe(true);
    manager.kill(id);
    expect(manager.has(id)).toBe(false);
  });

  it('getPid returns a numeric PID', () => {
    const manager = makeManager();
    const id = manager.create({
      shell: TEST_SHELL,
      cwd: process.env.USERPROFILE || 'C:\\',
      env: TEST_ENV,
    });
    const pid = manager.getPid(id);
    expect(typeof pid).toBe('number');
    expect(pid).toBeGreaterThan(0);
  });

  it('killAll removes all PTYs', () => {
    const manager = makeManager();
    const id1 = manager.create({
      shell: TEST_SHELL,
      cwd: process.env.USERPROFILE || 'C:\\',
      env: TEST_ENV,
    });
    const id2 = manager.create({
      shell: TEST_SHELL,
      cwd: process.env.USERPROFILE || 'C:\\',
      env: TEST_ENV,
    });
    manager.killAll();
    expect(manager.has(id1)).toBe(false);
    expect(manager.has(id2)).toBe(false);
  });
});
