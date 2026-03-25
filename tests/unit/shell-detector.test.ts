import { describe, it, expect } from 'vitest';
import { detectShells, getDefaultShell } from '../../src/main/shell-detector';

describe('shell-detector', () => {
  it('returns at least one shell', () => {
    const shells = detectShells();
    expect(shells.length).toBeGreaterThanOrEqual(1);
  });

  it('all returned shells are marked as available', () => {
    const shells = detectShells();
    for (const shell of shells) {
      expect(shell.available).toBe(true);
    }
  });

  it('always includes cmd.exe', () => {
    const shells = detectShells();
    const cmd = shells.find((s) => s.name === 'Command Prompt');
    expect(cmd).toBeDefined();
    expect(cmd?.command).toBe('cmd.exe');
  });

  it('getDefaultShell returns a shell that is in the detected list', () => {
    const shells = detectShells();
    const defaultShell = getDefaultShell();
    expect(defaultShell).toBeDefined();
    expect(defaultShell.available).toBe(true);
    const found = shells.find((s) => s.name === defaultShell.name);
    expect(found).toBeDefined();
  });

  it('getDefaultShell returns a shell with a non-empty command', () => {
    const defaultShell = getDefaultShell();
    expect(defaultShell.command.length).toBeGreaterThan(0);
  });
});
