import { useTerminal } from '../../hooks/useTerminal';
import '../../styles/terminal.css';

interface TerminalPaneProps {
  shell?: string;
  cwd?: string;
  focused?: boolean;
}

export default function TerminalPane({ shell, cwd, focused = true }: TerminalPaneProps) {
  const { terminalRef } = useTerminal({ shell, cwd });

  return (
    <div className={`terminal-pane ${focused ? 'terminal-pane--focused' : ''}`}>
      <div ref={terminalRef} className="terminal-pane__container" />
    </div>
  );
}
