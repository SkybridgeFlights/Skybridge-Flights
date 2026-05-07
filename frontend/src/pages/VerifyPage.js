import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';
import './VerifyPage.css';

const VerifyPage = () => {
  const { token } = useParams();
  const [message, setMessage] = useState('Verifying your email... Please wait.');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/users/verify/${token}`);
        setSuccess(!!res.data.success);
        setMessage(res.data.message || 'Email verification completed.');
      } catch (error) {
        console.error('Verification error:', error);
        setSuccess(false);
        setMessage(error?.response?.data?.message || 'Verification failed. The link might be expired or invalid.');
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="verify-container">
      <div className="verify-card">
        <div className="verify-icon">{success ? '✅' : '❌'}</div>
        <h2 className="verify-title">Email Verification</h2>
        <p className="verify-text">{message}</p>
        {success && (
          <Link to="/login" className="verify-button">
            Go to Login
          </Link>
        )}
      </div>
    </div>
  );
};

export default VerifyPage;