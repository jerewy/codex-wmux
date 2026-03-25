export default function App() {
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#272822', color: '#fdfff1' }}>
      <div style={{ width: 200, background: '#1a1a1a', borderRight: '1px solid #333' }}>
        {/* Sidebar placeholder */}
        <div style={{ padding: 10, fontSize: 12.5, fontWeight: 600 }}>wmux</div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ opacity: 0.5 }}>Terminal will render here</span>
      </div>
    </div>
  );
}
