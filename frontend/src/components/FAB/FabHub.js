// frontend/src/components/FAB/FabHub.jsx
import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import './FAB.css';

export default function FabHub() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const hiddenPaths = ['/', '/flights'];

  if (hiddenPaths.includes(location.pathname)) {
    return null;
  }

  const openSupport = () => {
    if (typeof window !== 'undefined' && typeof window.__openSupport === 'function') {
      window.__openSupport();
    } else {
      console.warn('__openSupport is not ready yet');
    }
  };

  const openAI = () => {
    alert('AI Assistant coming soon');
  };

  const openLang = () => {
    alert('Language switcher coming soon');
  };

  return (
    <div className="fab-hub" aria-live="polite">
      <button
        className={`fab-main ${open ? 'active' : ''}`}
        aria-expanded={open}
        aria-label="Quick actions"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '✕' : '⋮'}
      </button>

      <div className={`fab-menu ${open ? 'show' : ''}`}>
        <button className="fab-item" title="Support" aria-label="Support" onClick={openSupport}>💬</button>
        <button className="fab-item" title="AI Assistant" aria-label="AI Assistant" onClick={openAI}>🤖</button>
        <button className="fab-item" title="Languages" aria-label="Languages" onClick={openLang}>🌐</button>
      </div>
    </div>
  );
}