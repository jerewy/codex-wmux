import { useStore } from '../../store';

export default function WorkspaceSettings() {
  const { workspacePrefs, setWorkspacePrefs } = useStore();

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">Workspace Behaviour</h3>

      <div className="settings-row">
        <label className="settings-label">New workspace placement</label>
        <select
          className="settings-select"
          value={workspacePrefs.newWorkspacePlacement}
          onChange={(e) =>
            setWorkspacePrefs({
              newWorkspacePlacement: e.target.value as 'afterCurrent' | 'top' | 'end',
            })
          }
        >
          <option value="afterCurrent">After Current</option>
          <option value="top">Top</option>
          <option value="end">End</option>
        </select>
      </div>

      <div className="settings-row">
        <label className="settings-label">Auto-reorder on notification</label>
        <input
          type="checkbox"
          className="settings-toggle"
          checked={workspacePrefs.autoReorderOnNotification}
          onChange={(e) => setWorkspacePrefs({ autoReorderOnNotification: e.target.checked })}
        />
      </div>

      <div className="settings-divider" />
      <h3 className="settings-section-title">Shell</h3>

      <div className="settings-row">
        <label className="settings-label">Default shell</label>
        <select
          className="settings-select"
          value={workspacePrefs.defaultShell}
          onChange={(e) => setWorkspacePrefs({ defaultShell: e.target.value })}
        >
          <option value="">System default</option>
          <option value="powershell.exe">PowerShell</option>
          <option value="pwsh.exe">PowerShell Core</option>
          <option value="cmd.exe">Command Prompt</option>
          <option value="bash.exe">Git Bash</option>
          <option value="wsl.exe">WSL</option>
        </select>
      </div>
    </div>
  );
}
