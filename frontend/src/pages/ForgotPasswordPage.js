import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';
import './ForgotPasswordPage.css';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/users/forgot-password`, { email });
      setMessage(data.message || 'Check your email for reset link.');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to send reset link.');
    }
  };

  return (
    <div className="forgot-container">
      <div className="forgot-box">
        <h2>Forgot Password?</h2>
        <p>Enter your email to receive a password reset link.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="forgot-input"
          />
          <button type="submit" className="forgot-button">Send Reset Link</button>
        </form>
        {message && <p className="forgot-message">{message}</p>}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;