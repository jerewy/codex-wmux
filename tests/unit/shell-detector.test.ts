import { describe, it, expect } from 'vitest';
import { detectShells, getDefaultShell } from '../../src/main/shell-detector';

describe('shell-detector', () => {
  it('returns at least one shell', async () => {
    const shells = await detectShells();
    expect(shells.length).toBeGreaterThanOrEqual(1);
  });

  it('all returned shells are marked as available', async () => {
    const shells = await detectShells();
    for (const shell of shells) {
      expect(shell.available).toBe(true);
    }
  });

  it('always includes cmd.exe', async () => {
    const shells = await detectShells();
    const cmd = shells.find((s) => s.name === 'Command Prompt');
    expect(cmd).toBeDefined();
    expect(cmd?.command).toBe('cmd.exe');
  });

  it('getDefaultShell returns a shell that is in the detected list', async () => {
    const shells = await detectShells();
    const defaultShell = await getDefaultShell();
    expect(defaultShell).toBeDefined();
    expect(defaultShell.available).toBe(true);
    const found = shells.find((s) => s.name === defaultShell.name);
    expect(found).toBeDefined();
  });

  it('getDefaultShell returns a shell with a non-empty command', async () => {
    const defaultShell = await getDefaultShell();
    expect(defaultShell.command.length).toBeGreaterThan(0);
  });
});
