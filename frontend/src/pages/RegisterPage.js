// src/pages/RegisterPage.js
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom'; // ✅ نضيف هذا
import { API_BASE_URL } from '../apiConfig';
import './RegisterPage.css';

const RegisterPage = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [message, setMessage] = useState('');
  const navigate = useNavigate(); // ✅ نستخدمه للتوجيه

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await axios.post(`${API_BASE_URL}/api/users/register`, form);
      setMessage(res.data.message || 'Please check your email to verify your account.');
      
      // ✅ ننتقل إلى صفحة التحقق بعد نجاح التسجيل
      setTimeout(() => {
        navigate('/verify-info');
      }, 1500); // ننتظر قليلاً لعرض الرسالة
    } catch (err) {
      setMessage(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <div className="register-container">
      <div className="register-box">
        <h2>Create a New Account</h2>
        {message && <p className="message">{message}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <input type="text" name="name" value={form.name} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" name="password" value={form.password} onChange={handleChange} required />
          </div>
          <button type="submit" className="btn-submit">Register</button>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;