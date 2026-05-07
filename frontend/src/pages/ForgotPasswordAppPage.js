import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';
import './ForgotPasswordAppPage.css';

const ForgotPasswordAppPage = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setMessage('');

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/users/forgot-password`,
        { email },
        { timeout: 10000 }
      );

      setMessage(res.data?.message || 'Check your email for reset link.');
    } catch (err) {
      console.error('Forgot password error:', err);

      if (err.code === 'ECONNABORTED') {
        setMessage('Request timed out. Please try again.');
      } else {
        setMessage(err.response?.data?.error || 'Failed to send reset link.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="forgot-app-container">
      <div className="forgot-app-box">
        <h2>Forgot Password?</h2>
        <p>Enter your email to receive a password reset link.</p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="forgot-app-input"
          />

          <button
            type="submit"
            className="forgot-app-button"
            disabled={submitting}
          >
            {submitting ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        {message ? <p className="forgot-app-message">{message}</p> : null}
      </div>
    </div>
  );
};

export default ForgotPasswordAppPage;