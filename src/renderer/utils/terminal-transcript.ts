interface TerminalBufferLine {
  translateToString(trimRight?: boolean): string;
}

interface TerminalLike {
  buffer: {
    active: {
      length: number;
      getLine(index: number): TerminalBufferLine | undefined;
    };
  };
}

export function extractTerminalTranscript(terminal: TerminalLike): string {
  const lines: string[] = [];
  const buffer = terminal.buffer.active;

  for (let index = 0; index < buffer.length; index++) {
    lines.push(buffer.getLine(index)?.translateToString(true) ?? '');
  }

  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift();
  }

  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  return lines.join('\n');
}
