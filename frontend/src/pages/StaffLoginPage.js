import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig'; // ✅ استيراد الرابط الأساسي

const StaffLoginPage = ({ onStaffLogin }) => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await axios.post(`${API_BASE_URL}/api/staff/login`, form); // ✅ تعديل الرابط
      localStorage.setItem('staffToken', res.data.token);
      localStorage.setItem('staffRole', res.data.role);
      localStorage.setItem('staffName', res.data.name);
      if (onStaffLogin) onStaffLogin(); // optional callback
      window.location.href = '/admin'; // Redirect to admin panel
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="container mt-4" style={{ maxWidth: '500px' }}>
      <h2>👨‍💼 Staff Login</h2>
      {error && <p className="text-danger">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label>Email:</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            className="form-control"
            required
          />
        </div>
        <div className="mb-3">
          <label>Password:</label>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            className="form-control"
            required
          />
        </div>
        <button className="btn btn-primary w-100" type="submit">Login</button>
      </form>
    </div>
  );
};

export default StaffLoginPage;