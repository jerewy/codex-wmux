import { useStore } from '../../store';

export default function BrowserSettings() {
  const { browserPrefs, setBrowserPrefs } = useStore();

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">Search</h3>

      <div className="settings-row">
        <label className="settings-label">Default search engine</label>
        <select
          className="settings-select"
          value={browserPrefs.searchEngine}
          onChange={(e) =>
            setBrowserPrefs({
              searchEngine: e.target.value as 'google' | 'duckduckgo' | 'bing' | 'brave',
            })
          }
        >
          <option value="google">Google</option>
          <option value="duckduckgo">DuckDuckGo</option>
          <option value="bing">Bing</option>
          <option value="brave">Brave Search</option>
        </select>
      </div>

      <div className="settings-divider" />
      <h3 className="settings-section-title">Developer Tools</h3>

      <div className="settings-row">
        <label className="settings-label">DevTools icon</label>
        <select
          className="settings-select"
          value={browserPrefs.devToolsIcon}
          onChange={(e) =>
            setBrowserPrefs({
              devToolsIcon: e.target.value as 'default' | 'compact' | 'hidden',
            })
          }
        >
          <option value="default">Default</option>
          <option value="compact">Compact</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>
    </div>
  );
}
