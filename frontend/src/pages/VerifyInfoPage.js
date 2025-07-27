// src/pages/VerifyInfoPage.js
import React from 'react';
import './VerifyInfoPage.css'; // سنضيف CSS لاحقًا

const VerifyInfoPage = () => {
  return (
    <div className="verify-container">
      <div className="verify-box">
        <h2>Check Your Email</h2>
        <p>We’ve sent you a confirmation link. Please check your inbox and click the link to verify your account.</p>
        <p>If you don’t see the email, check your spam or junk folder.</p>
      </div>
    </div>
  );
};

export default VerifyInfoPage;