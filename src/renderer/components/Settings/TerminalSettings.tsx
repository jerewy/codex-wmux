import { useStore } from '../../store';

export default function TerminalSettings() {
  const { terminalPrefs, setTerminalPrefs } = useStore();

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">Font</h3>

      <div className="settings-row">
        <label className="settings-label">Font family</label>
        <input
          type="text"
          className="settings-input"
          value={terminalPrefs.fontFamily}
          onChange={(e) => setTerminalPrefs({ fontFamily: e.target.value })}
          placeholder="e.g. Consolas, Menlo, monospace"
        />
      </div>

      <div className="settings-row">
        <label className="settings-label">Font size</label>
        <input
          type="number"
          className="settings-input settings-input--narrow"
          value={terminalPrefs.fontSize}
          min={8}
          max={72}
          onChange={(e) => setTerminalPrefs({ fontSize: Number(e.target.value) })}
        />
      </div>

      <div className="settings-divider" />
      <h3 className="settings-section-title">Theme</h3>

      <div className="settings-row">
        <label className="settings-label">Color theme</label>
        <div className="settings-theme-row">
          <select
            className="settings-select"
            value={terminalPrefs.theme}
            onChange={(e) => setTerminalPrefs({ theme: e.target.value })}
          >
            <option value="Monokai">Monokai</option>
          </select>
          <button className="settings-btn settings-btn--secondary">Import .json</button>
          <button className="settings-btn settings-btn--secondary">Import .itermcolors</button>
        </div>
      </div>

      <div className="settings-divider" />
      <h3 className="settings-section-title">Cursor</h3>

      <div className="settings-row">
        <label className="settings-label">Cursor style</label>
        <select
          className="settings-select"
          value={terminalPrefs.cursorStyle}
          onChange={(e) =>
            setTerminalPrefs({ cursorStyle: e.target.value as 'block' | 'underline' | 'bar' })
          }
        >
          <option value="block">Block</option>
          <option value="underline">Underline</option>
          <option value="bar">Bar</option>
        </select>
      </div>

      <div className="settings-row">
        <label className="settings-label">Cursor blink</label>
        <input
          type="checkbox"
          className="settings-toggle"
          checked={terminalPrefs.cursorBlink}
          onChange={(e) => setTerminalPrefs({ cursorBlink: e.target.checked })}
        />
      </div>

      <div className="settings-divider" />
      <h3 className="settings-section-title">Scrollback</h3>

      <div className="settings-row">
        <label className="settings-label">Scrollback lines</label>
        <input
          type="number"
          className="settings-input settings-input--narrow"
          value={terminalPrefs.scrollbackLines}
          min={100}
          max={100000}
          step={100}
          onChange={(e) => setTerminalPrefs({ scrollbackLines: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}
