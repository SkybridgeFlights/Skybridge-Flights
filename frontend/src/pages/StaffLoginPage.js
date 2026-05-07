import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../apiConfig';
import './StaffLoginPage.css';

export default function StaffLoginPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: '',
    password: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!form.email.trim() || !form.password.trim()) {
      setMessage('Please enter email and password.');
      return;
    }

    try {
      setSubmitting(true);

      const { data } = await axios.post(`${API_BASE_URL}/api/staff/login`, {
        email: form.email.trim(),
        password: form.password,
      });

      if (!data?.token || !data?.staff) {
        throw new Error('Invalid staff login response');
      }

      localStorage.setItem('staffToken', data.token);
      localStorage.setItem(
        'user',
        JSON.stringify({
          ...data.staff,
          token: data.token,
        })
      );

      window.dispatchEvent(new Event('userStateChange'));
      navigate('/admin');
    } catch (err) {
      console.error('Staff login error:', err);
      setMessage(err?.response?.data?.error || 'Invalid credentials');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="staff-login-page">
      <div className="staff-login-shell">
        <div className="staff-login-card">
          <div className="staff-login-badge">Staff Access</div>

          <h1 className="staff-login-title">Staff Login</h1>
          <p className="staff-login-subtitle">
            Sign in to access the Skybridge Flights control area.
          </p>

          {message && <div className="staff-login-alert">{message}</div>}

          <form className="staff-login-form" onSubmit={handleSubmit}>
            <div className="staff-field">
              <label htmlFor="staff-email">Email address</label>
              <input
                id="staff-email"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="info@skybridgeflights.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="staff-field">
              <label htmlFor="staff-password">Password</label>
              <div className="staff-password-wrap">
                <input
                  id="staff-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="staff-password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button className="staff-login-btn" type="submit" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Login'}
            </button>
          </form>

          <div className="staff-login-footer">
            Authorized staff only.
          </div>
        </div>
      </div>
    </div>
  );
}