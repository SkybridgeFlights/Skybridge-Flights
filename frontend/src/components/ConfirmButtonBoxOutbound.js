// frontend/src/components/ConfirmButtonBoxOutbound.js
import React from 'react';

const ConfirmButtonBoxOutbound = ({ onSubmit }) => {
  return (
    <div className="confirm-button-container">
      <button className="confirm-button" onClick={onSubmit}>
        ✅ Continue to Payment
      </button>
    </div>
  );
};

export default ConfirmButtonBoxOutbound;