import React, { useState, useEffect, useRef } from 'react';
import DataLens from './DataLens';
import SaveModal from './SaveModal';

export default function App() {
  const [showSave, setShowSave] = useState(false);
  const [savedList, setSavedList] = useState([]);
  const [toast, setToast] = useState('');
  const dataLensRef = useRef(null);

  useEffect(() => { fetchSaved(); }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function fetchSaved() {
    try {
      const res = await fetch('/api/dashboards');
      if (res.ok) setSavedList(await res.json());
    } catch (e) {}
  }

  async function handleSave(name) {
    const state = dataLensRef.current?.getState?.();
    if (!state) { showToast('No dashboard state to save'); return; }
    const res = await fetch('/api/dashboards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, state })
    });
    if (res.ok) {
      showToast('Dashboard saved ✓');
      setShowSave(false);
      fetchSaved();
    }
  }

  async function handleLoad(id) {
    const res = await fetch('/api/dashboards/' + id);
    if (!res.ok) return;
    const { state } = await res.json();
    dataLensRef.current?.loadState?.(state);
    showToast('Dashboard loaded ✓');
  }

  async function handleDelete(id) {
    await fetch('/api/dashboards/' + id, { method: 'DELETE' });
    fetchSaved(); showToast('Deleted');
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Thin React toolbar at the very top */}
      <div style={{
        background: 'linear-gradient(135deg,#7C3AED,#EC4899)',
        color: '#fff', padding: '6px 16px',
        display: 'flex', alignItems: 'center', gap: '12px',
        fontSize: '.78rem', fontWeight: 700, flexShrink: 0
      }}>
        <span>☁️ Cloud Saves</span>
        <button onClick={() => setShowSave(true)} style={btnStyle}>💾 Save Dashboard</button>
        {savedList.map(d => (
          <span key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={() => handleLoad(d.id)} style={btnStyle}>{d.name}</button>
            <button onClick={() => handleDelete(d.id)} style={{ ...btnStyle, background: 'rgba(255,255,255,.15)', padding: '3px 6px' }}>✕</button>
          </span>
        ))}
        {savedList.length === 0 && <span style={{ opacity: .7 }}>No saved dashboards yet</span>}
        <span style={{ marginLeft: 'auto', opacity: .8 }}>Meesho Buildathon 2026</span>
      </div>

      {/* DataLens takes all remaining space */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <DataLens ref={dataLensRef} />
      </div>

      {showSave && <SaveModal onSave={handleSave} onClose={() => setShowSave(false)} />}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: '#1A1535', color: '#fff',
          padding: '10px 18px', borderRadius: 8,
          fontSize: '.85rem', fontWeight: 600, zIndex: 9999
        }}>{toast}</div>
      )}
    </div>
  );
}

const btnStyle = {
  background: 'rgba(255,255,255,.25)', border: 'none', color: '#fff',
  padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
  fontSize: '.75rem', fontWeight: 700
};
