import React, { useState } from 'react';

export default function SaveModal({ onSave, onClose }) {
  const [name, setName] = useState('');

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 28, width: 360,
        boxShadow: '0 20px 60px rgba(0,0,0,.3)', fontFamily: 'Plus Jakarta Sans, sans-serif'
      }}>
        <h3 style={{ fontWeight: 800, marginBottom: 16, color: '#1A1535' }}>💾 Save Dashboard</h3>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onSave(name.trim())}
          placeholder="Dashboard name…"
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 8,
            border: '2px solid #E4DFFF', fontFamily: 'inherit', fontSize: '.9rem',
            marginBottom: 16, outline: 'none'
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E4DFFF', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Cancel</button>
          <button
            onClick={() => name.trim() && onSave(name.trim())}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#7C3AED,#EC4899)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}
          >Save</button>
        </div>
      </div>
    </div>
  );
}
