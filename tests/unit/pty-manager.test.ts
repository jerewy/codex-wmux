import { describe, it, expect, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { PtyManager, getShellLaunchArgs } from '../../src/main/pty-manager';

const spawned = vi.hoisted(() => [] as Array<{
  shell: string;
  args: string[];
  options: any;
  instance: MockPty;
}>);

class MockPty extends EventEmitter {
  pid = 1234;
  killed = false;
  resized: Array<[number, number]> = [];
  writes: string[] = [];

  write(data: string): void {
    this.writes.push(data);
    this.emit('data', data);
  }

  resize(cols: number, rows: number): void {
    this.resized.push([cols, rows]);
  }

  kill(): void {
    this.killed = true;
    this.emit('exit', { exitCode: 0 });
  }

  onData(callback: (data: string) => void): void {
    this.on('data', callback);
  }

  onExit(callback: (event: { exitCode: number }) => void): void {
    this.on('exit', callback);
  }
}

vi.mock('node-pty', () => ({
  spawn: vi.fn((shell: string, args: string[], options: any) => {
    const instance = new MockPty();
    spawned.push({ shell, args, options, instance });
    return instance;
  }),
}));

describe('PtyManager', () => {
  const managers: PtyManager[] = [];

  function makeManager(): PtyManager {
    const manager = new PtyManager();
    managers.push(manager);
    return manager;
  }

  afterEach(() => {
    for (const manager of managers) {
      manager.killAll();
    }
    managers.length = 0;
    spawned.length = 0;
    vi.clearAllMocks();
  });

  it('create returns a surf-prefixed id and resolved shell', () => {
    const manager = makeManager();
    const created = manager.create({
      shell: 'cmd.exe',
      cwd: process.env.USERPROFILE || 'C:\\',
      env: {},
    });

    expect(created.id).toMatch(/^surf-/);
    expect(created.shell).toBe('cmd.exe');
  });

  it('keeps PTY ids addressable until killed', () => {
    const manager = makeManager();
    const created = manager.create({
      shell: 'cmd.exe',
      cwd: process.env.USERPROFILE || 'C:\\',
      env: {},
    });

    expect(manager.has(created.id)).toBe(true);
    manager.kill(created.id);
    expect(manager.has(created.id)).toBe(false);
  });

  it('passes wmux metadata env vars into spawned shells', () => {
    const manager = makeManager();
    const created = manager.create({
      shell: 'cmd.exe',
      cwd: 'C:\\dev',
      env: { CUSTOM_FLAG: '1' },
    });

    expect(spawned[0].options.cwd).toBe('C:\\dev');
    expect(spawned[0].options.env.CUSTOM_FLAG).toBe('1');
    expect(spawned[0].options.env.WMUX).toBe('1');
    expect(spawned[0].options.env.WMUX_SURFACE_ID).toBe(created.id);
    expect(spawned[0].options.env.WMUX_PIPE).toBe('\\\\.\\pipe\\wmux');
    expect(spawned[0].options.env.WMUX_CLI).toContain('wmux.js');
    expect(spawned[0].options.env.WMUX_INTEGRATION).toBe('1');
  });

  it('starts PowerShell through the wmux integration script', () => {
    const args = getShellLaunchArgs('powershell.exe');

    expect(args).toContain('-NoExit');
    expect(args).toContain('-ExecutionPolicy');
    expect(args).toContain('Bypass');
    expect(args.at(-1)).toContain('wmux-powershell-integration.ps1');
  });

  it('starts cmd through the wmux integration script', () => {
    const args = getShellLaunchArgs('cmd.exe');

    expect(args[0]).toBe('/K');
    expect(args[1]).toContain('wmux-cmd-integration.cmd');
  });

  it('write, resize, and getPid target the created PTY', () => {
    const manager = makeManager();
    const created = manager.create({
      shell: 'cmd.exe',
      cwd: process.env.USERPROFILE || 'C:\\',
      env: {},
    });

    manager.write(created.id, 'echo hello\r');
    manager.resize(created.id, 120, 40);

    expect(spawned[0].instance.writes).toEqual(['echo hello\r']);
    expect(spawned[0].instance.resized).toEqual([[120, 40]]);
    expect(manager.getPid(created.id)).toBe(1234);
  });

  it('killAll removes all PTYs', () => {
    const manager = makeManager();
    const first = manager.create({
      shell: 'cmd.exe',
      cwd: process.env.USERPROFILE || 'C:\\',
      env: {},
    });
    const second = manager.create({
      shell: 'cmd.exe',
      cwd: process.env.USERPROFILE || 'C:\\',
      env: {},
    });

    manager.killAll();

    expect(manager.has(first.id)).toBe(false);
    expect(manager.has(second.id)).toBe(false);
    expect(spawned.every((entry) => entry.instance.killed)).toBe(true);
  });
});
