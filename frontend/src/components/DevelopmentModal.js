import React, { useEffect, useState } from 'react';
import './DevelopmentModal.css';

const DevelopmentModal = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // تحقق إن كان الزائر رأى النافذة سابقاً
    const hasAccepted = localStorage.getItem('dev_notice_ack');
    if (!hasAccepted) {
      setIsOpen(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('dev_notice_ack', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>⚠️ موقع تحت التطوير</h2>
        <p>
          هذا الموقع ما زال قيد التجربة والتطوير حالياً.
          <br />
          يمكنك تصفح الموقع، لكن بعض الميزات قد لا تكون جاهزة بعد.
        </p>
        <button className="modal-button" onClick={handleAccept}>
          أوافق / I Understand
        </button>
      </div>
    </div>
  );
};

export default DevelopmentModal;