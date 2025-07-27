// frontend/src/pages/LoginPage.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE_URL } from '../apiConfig';
import './LoginPage.css';

function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // التحقق إذا كان المستخدم مسجل دخول مسبقاً
  useEffect(() => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const parsed = JSON.parse(userStr);
        if (parsed && parsed.email) {
          console.log("🔹 User already logged in:", parsed);
          navigate('/user-profile');
        }
      }
    } catch (error) {
      console.error("Error parsing user data from localStorage:", error);
    }
  }, [navigate]);

  const handleChange = (e) =>
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setSubmitting(true);

    console.log("🔹 Attempting login with:", formData);

    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/api/users/login`,
        formData
      );

      console.log("🔹 Response data:", data);

      if (!data || !data.user || !data.token) {
        throw new Error('Unexpected server response');
      }

      // حفظ بيانات المستخدم والتوكن داخل نفس الكائن
      const userWithToken = { ...data.user, token: data.token };
      localStorage.setItem('user', JSON.stringify(userWithToken));
      localStorage.setItem('token', data.token); // ✅ حفظ التوكن بشكل منفصل

      // ضبط التوكن بشكل عام لكل طلبات Axios
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;

      setMessage('✅ Login successful');

      // إرسال حدث لتحديث Sidebar فوراً
      window.dispatchEvent(new Event('userStateChange'));

      navigate('/user-profile');
    } catch (err) {
      console.error("Login error:", err);

      const status = err?.response?.status;
      if (status === 403) {
        setMessage('❌ Please verify your email first.');
      } else if (status === 401) {
        setMessage('❌ Invalid email or password.');
      } else {
        setMessage(`❌ Login failed: ${err?.message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2 className="login-title">Login</h2>
        <form onSubmit={handleSubmit} noValidate>
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
            className="login-input"
            autoComplete="email"
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
            className="login-input"
            autoComplete="current-password"
          />
          <button type="submit" className="login-button" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Login'}
          </button>
          <div className="forgot-password-link">
            <Link to="/forgot-password">Forgot your password?</Link>
          </div>
          {message && <p className="login-message">{message}</p>}
        </form>
      </div>
    </div>
  );
}

export default LoginPage;