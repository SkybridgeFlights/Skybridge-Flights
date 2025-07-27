// src/pages/AdminPanel.js
import './AdminPanel.css';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { API_BASE_URL } from '../apiConfig'; // ✅ استيراد العنوان الأساسي من ملف البيئة

ChartJS.register(ArcElement, Tooltip, Legend);

const AdminPanel = () => {
  const [settings, setSettings] = useState({ allowCancellation: true, cancellationHoursLimit: 24 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/settings/booking`);
        setSettings(res.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching settings:', err);
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : Number(value)
    }));
  };

  const handleSave = async () => {
    try {
      await axios.put(`${API_BASE_URL}/api/settings/booking`, settings);
      setMessage('Settings saved successfully ✅');
    } catch (err) {
      setMessage('Failed to save settings ❌');
    }
  };

  if (loading) return <div className="admin-panel">Loading admin settings...</div>;

  return (
    <div className="admin-panel-container">
      {/* Sidebar */}
      <div className="admin-sidebar">
        <h2>👑 Skybridge Admin Panel</h2>
        <button className="admin-btn"><Link to="/admin" className="admin-link">📊 Dashboard</Link></button>
        <button className="admin-btn"><Link to="/admin/booking-settings" className="admin-link">⚙️ Booking Settings</Link></button>
        <button className="admin-btn"><Link to="/admin/manage-staff" className="admin-link">👥 Manage Staff</Link></button>
        <button className="admin-btn"><Link to="/admin/view-visas" className="admin-link">📄 Visa Applications</Link></button>
        <button className="admin-btn"><Link to="/admin/view-bookings" className="admin-link">📑 All Bookings</Link></button>
        <button className="admin-btn"><Link to="/admin/audit-logs" className="admin-link">🕵️ Audit Logs</Link></button>
        <button className="admin-btn"><Link to="/admin/manage-flights" className="admin-link">✈️ Manage Flights</Link></button>
      </div>

      {/* Main Content */}
      <div className="admin-content">
        <div className="admin-welcome">
          <h3>📌 Welcome, Admin</h3>
          <p>Use the navigation on the left to manage system settings, staff, bookings, and visa applications.</p>
        </div>

        {/* Chart Section */}
        <hr />
        <h4>📊 Platform Statistics</h4>
        <div className="chart-container">
          <Pie
            data={{
              labels: ['Flights', 'Bookings', 'Visa Applications', 'Users'],
              datasets: [{
                data: [28, 115, 42, 89], // ← عدّل هذه الأرقام لاحقًا لتكون ديناميكية
                backgroundColor: ['#007bff', '#28a745', '#ffc107', '#dc3545'],
                borderColor: '#fff',
                borderWidth: 2,
              }],
            }}
            options={{
              responsive: true,
              plugins: {
                legend: {
                  position: 'bottom',
                },
              },
            }}
          />
        </div>

        {/* Booking Settings */}
        <hr />
        <div className="admin-settings">
          <h4>🔧 Booking Cancellation Settings</h4>
          <div className="form-check form-switch mb-3">
            <input
              className="form-check-input"
              type="checkbox"
              id="allowCancellation"
              name="allowCancellation"
              checked={settings.allowCancellation}
              onChange={handleChange}
            />
            <label className="form-check-label" htmlFor="allowCancellation">
              Allow Cancellation
            </label>
          </div>

          <div className="mb-3">
            <label htmlFor="cancellationHoursLimit" className="form-label">
              Hours before flight allowed for cancellation:
            </label>
            <input
              type="number"
              className="form-control"
              id="cancellationHoursLimit"
              name="cancellationHoursLimit"
              value={settings.cancellationHoursLimit}
              min="1"
              onChange={handleChange}
            />
          </div>

          <button className="btn btn-success" onClick={handleSave}>💾 Save Settings</button>
          {message && <p className="mt-3">{message}</p>}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;