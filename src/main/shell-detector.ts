import { execSync } from 'child_process';
import { ShellInfo } from '../shared/types';

function commandExists(cmd: string): boolean {
  try {
    execSync(`where ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function resolveCommand(cmd: string): string {
  try {
    const result = execSync(`where ${cmd}`, { encoding: 'utf8' });
    return result.split(/\r?\n/)[0].trim();
  } catch {
    return cmd;
  }
}

export function detectShells(): ShellInfo[] {
  const shells: ShellInfo[] = [];

  // PowerShell 7+ (pwsh)
  if (commandExists('pwsh.exe')) {
    shells.push({
      name: 'PowerShell 7',
      command: resolveCommand('pwsh.exe'),
      args: ['-NoLogo'],
      available: true,
    });
  }

  // Windows PowerShell 5
  if (commandExists('powershell.exe')) {
    shells.push({
      name: 'Windows PowerShell',
      command: resolveCommand('powershell.exe'),
      args: ['-NoLogo'],
      available: true,
    });
  }

  // CMD — always available
  shells.push({
    name: 'Command Prompt',
    command: 'cmd.exe',
    args: [],
    available: true,
  });

  // WSL
  if (commandExists('wsl.exe')) {
    shells.push({
      name: 'WSL',
      command: resolveCommand('wsl.exe'),
      args: [],
      available: true,
    });
  }

  return shells;
}

export function getDefaultShell(): ShellInfo {
  const shells = detectShells();

  // Preference order: pwsh > powershell > cmd
  const preferred = ['PowerShell 7', 'Windows PowerShell', 'Command Prompt'];

  for (const name of preferred) {
    const match = shells.find((s) => s.name === name && s.available);
    if (match) return match;
  }

  // Fallback: first available shell (should always be cmd)
  return shells[0];
}
