import React from 'react';
import TerminalPane from './components/Terminal/TerminalPane';

export default function App() {
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{
        width: 200,
        background: '#1a1a1a',
        borderRight: '1px solid #333',
        flexShrink: 0,
      }}>
        <div style={{
          padding: 10,
          fontSize: 12.5,
          fontWeight: 600,
          color: '#fdfff1',
          height: 38,
          display: 'flex',
          alignItems: 'center',
          WebkitAppRegion: 'drag',
        } as React.CSSProperties & { WebkitAppRegion: string }}>
          wmux
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <TerminalPane />
      </div>
    </div>
  );
}
