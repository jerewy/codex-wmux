import { describe, it, expect } from 'vitest';
import { parseToml } from '../../src/main/toml-parser';

describe('parseToml', () => {
  it('parses a flat table with strings/numbers/bools', () => {
    const out = parseToml(`
      [terminal]
      font-family = "Cascadia Mono"
      font-size = 14
      cursor-blink = true
    `);
    expect(out).toEqual({
      terminal: { 'font-family': 'Cascadia Mono', 'font-size': 14, 'cursor-blink': true },
    });
  });

  it('parses dotted table headers into nested objects', () => {
    const out = parseToml(`
      [terminal.colors]
      default = "Dracula"

      [terminal.colors.schemes.prod]
      background = "#2b0b0b"
      foreground = "#ffdddd"
      cursor     = "#ff5555"
    `);
    expect(out).toEqual({
      terminal: {
        colors: {
          default: 'Dracula',
          schemes: {
            prod: {
              background: '#2b0b0b',
              foreground: '#ffdddd',
              cursor: '#ff5555',
            },
          },
        },
      },
    });
  });

  it('ignores inline and full-line comments', () => {
    const out = parseToml(`
      # comment at top
      [terminal]
      font-size = 14 # inline comment
      # another full-line comment
      font-family = "Hack"
    `);
    expect(out).toEqual({
      terminal: { 'font-size': 14, 'font-family': 'Hack' },
    });
  });

  it('does not eat a # inside quoted strings (color hex)', () => {
    const out = parseToml(`
      [c]
      bg = "#ff5555"
    `);
    expect(out).toEqual({ c: { bg: '#ff5555' } });
  });

  it('parses inline single-line string arrays', () => {
    const out = parseToml(`
      [s.prod]
      palette = ["#000000", "#ff5555", "#55ff55"]
    `);
    expect(out).toEqual({
      s: { prod: { palette: ['#000000', '#ff5555', '#55ff55'] } },
    });
  });

  it('parses multi-line arrays', () => {
    const out = parseToml(`
      [s.mono]
      palette = [
        "#000000", "#ff0000",
        "#00ff00", "#ffff00",
      ]
    `);
    expect(out).toEqual({
      s: { mono: { palette: ['#000000', '#ff0000', '#00ff00', '#ffff00'] } },
    });
  });

  it('handles booleans, negative numbers, and floats', () => {
    const out = parseToml(`
      [x]
      a = true
      b = false
      c = -3
      d = 1.5
      e = -0.25
    `);
    expect(out).toEqual({ x: { a: true, b: false, c: -3, d: 1.5, e: -0.25 } });
  });

  it('literal strings (single quotes) do not process escapes', () => {
    const out = parseToml(`
      [p]
      path = 'C:\\Users\\a'
    `);
    expect(out).toEqual({ p: { path: 'C:\\Users\\a' } });
  });
});
