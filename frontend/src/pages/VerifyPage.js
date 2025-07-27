// src/pages/VerifyPage.js
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';
import './VerifyPage.css';

const VerifyPage = () => {
  const { token } = useParams();
  const [message, setMessage] = useState('Verifying your email... Please wait.');

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/users/verify/${token}`);
        if (res.data.success) {
          setMessage('✅ Your email has been verified successfully. You can now log in.');
        } else {
          setMessage('❌ Verification failed. The link might be expired or invalid.');
        }
      } catch (error) {
        console.error('Verification error:', error);
        setMessage('❌ Verification failed. The link might be expired or invalid.');
      }
    };
    verifyEmail();
  }, [token]);

  return (
    <div className="verify-container">
      <div className="verify-box">
        <h2>Email Verification</h2>
        <p className="verify-message">{message}</p>
      </div>
    </div>
  );
};

export default VerifyPage;