import { describe, expect, it } from 'vitest';
import { extractTerminalTranscript } from '../../src/renderer/utils/terminal-transcript';

function mockTerminal(lines: string[]) {
  return {
    buffer: {
      active: {
        length: lines.length,
        getLine: (index: number) => ({
          translateToString: () => lines[index] ?? '',
        }),
      },
    },
  };
}

describe('terminal transcript export', () => {
  it('exports terminal scrollback as plain text', () => {
    const transcript = extractTerminalTranscript(mockTerminal([
      '',
      'PS C:\\dev> codex --no-alt-screen',
      'user: explain this file',
      '',
      'codex: here is the answer',
      '',
    ]));

    expect(transcript).toBe([
      'PS C:\\dev> codex --no-alt-screen',
      'user: explain this file',
      '',
      'codex: here is the answer',
    ].join('\n'));
  });

  it('returns an empty string when the buffer has no content', () => {
    expect(extractTerminalTranscript(mockTerminal(['', '   ']))).toBe('');
  });
});
