import { execFile } from 'child_process';
import { promisify } from 'util';
import { ShellInfo } from '../shared/types';

const execFileAsync = promisify(execFile);

async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execFileAsync('where', [cmd], { windowsHide: true, timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

async function resolveCommand(cmd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('where', [cmd], { encoding: 'utf8', windowsHide: true, timeout: 3000 });
    return stdout.split(/\r?\n/)[0].trim();
  } catch {
    return cmd;
  }
}

export async function detectShells(): Promise<ShellInfo[]> {
  const shells: ShellInfo[] = [];

  // Run all checks in parallel instead of sequentially
  const [hasPwsh, hasPowershell, hasWsl] = await Promise.all([
    commandExists('pwsh.exe'),
    commandExists('powershell.exe'),
    commandExists('wsl.exe'),
  ]);

  // Resolve paths in parallel for shells that exist
  const resolvePromises: Promise<void>[] = [];

  if (hasPwsh) {
    resolvePromises.push(
      resolveCommand('pwsh.exe').then(path => {
        shells.push({ name: 'PowerShell 7', command: path, args: ['-NoLogo'], available: true });
      })
    );
  }

  if (hasPowershell) {
    resolvePromises.push(
      resolveCommand('powershell.exe').then(path => {
        shells.push({ name: 'Windows PowerShell', command: path, args: ['-NoLogo'], available: true });
      })
    );
  }

  await Promise.all(resolvePromises);

  // CMD — always available, no resolve needed
  shells.push({ name: 'Command Prompt', command: 'cmd.exe', args: [], available: true });

  if (hasWsl) {
    const wslPath = await resolveCommand('wsl.exe');
    shells.push({ name: 'WSL', command: wslPath, args: [], available: true });
  }

  return shells;
}

export async function getDefaultShell(): Promise<ShellInfo> {
  const shells = await detectShells();

  // Preference order: pwsh > powershell > cmd
  const preferred = ['PowerShell 7', 'Windows PowerShell', 'Command Prompt'];

  for (const name of preferred) {
    const match = shells.find((s) => s.name === name && s.available);
    if (match) return match;
  }

  // Fallback: first available shell (should always be cmd)
  return shells[0];
}
