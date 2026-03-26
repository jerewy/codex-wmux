import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const START_MARKER = '<!-- wmux:start';
const END_MARKER = '<!-- wmux:end -->';

function getInstructionsPath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron') as typeof import('electron');
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'claude-instructions', 'claude-instructions.md');
    }
  } catch {
    // Not in Electron
  }
  return path.join(__dirname, '../../resources/claude-instructions.md');
}

function getClaudeMdPath(): string {
  return path.join(os.homedir(), '.claude', 'CLAUDE.md');
}

/**
 * Ensures the user's global ~/.claude/CLAUDE.md contains the wmux section.
 * - Creates ~/.claude/ and CLAUDE.md if they don't exist
 * - Inserts the wmux block if not present
 * - Updates the wmux block if it's outdated
 * - Never touches content outside the <!-- wmux:start --> / <!-- wmux:end --> markers
 */
export function ensureClaudeContext(): void {
  try {
    const instructionsPath = getInstructionsPath();
    if (!fs.existsSync(instructionsPath)) {
      console.warn('[wmux] claude-instructions.md not found at', instructionsPath);
      return;
    }

    const wmuxBlock = fs.readFileSync(instructionsPath, 'utf-8');
    const claudeMdPath = getClaudeMdPath();
    const claudeDir = path.dirname(claudeMdPath);

    // Ensure ~/.claude/ exists
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }

    if (!fs.existsSync(claudeMdPath)) {
      // No CLAUDE.md yet — create with just the wmux block
      fs.writeFileSync(claudeMdPath, wmuxBlock, 'utf-8');
      console.log('[wmux] Created ~/.claude/CLAUDE.md with wmux context');
      return;
    }

    // CLAUDE.md exists — check for existing wmux block
    const existing = fs.readFileSync(claudeMdPath, 'utf-8');
    const startIdx = existing.indexOf(START_MARKER);
    const endIdx = existing.indexOf(END_MARKER);

    if (startIdx === -1) {
      // No wmux block — append it
      const separator = existing.endsWith('\n') ? '\n' : '\n\n';
      fs.writeFileSync(claudeMdPath, existing + separator + wmuxBlock, 'utf-8');
      console.log('[wmux] Appended wmux context to ~/.claude/CLAUDE.md');
      return;
    }

    if (endIdx === -1) {
      // Broken markers — replace from start marker to end of file
      const before = existing.substring(0, startIdx);
      fs.writeFileSync(claudeMdPath, before + wmuxBlock, 'utf-8');
      console.log('[wmux] Fixed and updated wmux context in ~/.claude/CLAUDE.md');
      return;
    }

    // Both markers found — replace the block
    const currentBlock = existing.substring(startIdx, endIdx + END_MARKER.length);
    if (currentBlock.trim() === wmuxBlock.trim()) {
      // Already up to date
      return;
    }

    const before = existing.substring(0, startIdx);
    const after = existing.substring(endIdx + END_MARKER.length);
    fs.writeFileSync(claudeMdPath, before + wmuxBlock + after, 'utf-8');
    console.log('[wmux] Updated wmux context in ~/.claude/CLAUDE.md');
  } catch (err) {
    console.warn('[wmux] Failed to update Claude context:', err);
  }
}
