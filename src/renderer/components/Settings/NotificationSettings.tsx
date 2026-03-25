import { useStore } from '../../store';

export default function NotificationSettings() {
  const { notificationPrefs, setNotificationPrefs } = useStore();

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">Alerts</h3>

      <div className="settings-row">
        <label className="settings-label">Show toast notifications</label>
        <input
          type="checkbox"
          className="settings-toggle"
          checked={notificationPrefs.toast}
          onChange={(e) => setNotificationPrefs({ toast: e.target.checked })}
        />
      </div>

      <div className="settings-row">
        <label className="settings-label">Taskbar flash</label>
        <input
          type="checkbox"
          className="settings-toggle"
          checked={notificationPrefs.taskbarFlash}
          onChange={(e) => setNotificationPrefs({ taskbarFlash: e.target.checked })}
        />
      </div>

      <div className="settings-row">
        <label className="settings-label">Pane ring</label>
        <input
          type="checkbox"
          className="settings-toggle"
          checked={notificationPrefs.paneRing}
          onChange={(e) => setNotificationPrefs({ paneRing: e.target.checked })}
        />
      </div>

      <div className="settings-row">
        <label className="settings-label">Pane flash animation</label>
        <input
          type="checkbox"
          className="settings-toggle"
          checked={notificationPrefs.paneFlashAnimation}
          onChange={(e) => setNotificationPrefs({ paneFlashAnimation: e.target.checked })}
        />
      </div>

      <div className="settings-divider" />
      <h3 className="settings-section-title">Sound</h3>

      <div className="settings-row">
        <label className="settings-label">Notification sound</label>
        <select
          className="settings-select"
          value={notificationPrefs.sound}
          onChange={(e) =>
            setNotificationPrefs({ sound: e.target.value as 'default' | 'none' })
          }
        >
          <option value="default">Default</option>
          <option value="none">None</option>
        </select>
      </div>
    </div>
  );
}
