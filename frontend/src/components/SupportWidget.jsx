// frontend/src/components/SupportWidget.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SupportWidget.css';

export default function SupportWidget(){
  const [open,setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="support-widget">
      <button className="fab" onClick={()=>setOpen(!open)}>💬</button>
      {open && (
        <div className="fab-menu">
          <button onClick={()=>navigate('/support')}>Open Support</button>
        </div>
      )}
    </div>
  );
}