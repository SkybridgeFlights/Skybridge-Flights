// frontend/src/admin/ManageUsers.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';
import '../styles/Modals.css';

export default function ManageUsers() {
  const navigate = useNavigate();
  const token = localStorage.getItem('staffToken') || localStorage.getItem('token') || '';
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      const { data } = await axios.get(`${API_BASE_URL}/api/admin/users?${params.toString()}`, { headers });
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [q, headers]);

  useEffect(() => {
    load();
  }, [load]);

  const delUser = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/admin/users/${id}`, { headers });
      await load();
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to delete');
    }
  };

  const openOverview = (id) => navigate(`/admin/user/${id}`);

  return (
    <div className="container mt-4 ms-page">
      <h2>Manage Users</h2>

      <div className="ms-card">
        <div className="ms-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <input
            className="ms-input"
            placeholder="Search name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
            style={{ maxWidth: 360 }}
          />
          <button className="ms-btn" onClick={load}>Reload</button>
        </div>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="ms-table-wrap">
            <table className="ms-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Verified</th>
                  <th>Role</th>
                  <th style={{ width: 260 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u._id}>
                    <td className="text-left">{u.name || '—'}</td>
                    <td className="text-left">{u.email}</td>
                    <td>{u.isVerified ? '✅' : '❌'}</td>
                    <td>{u.isAdmin ? 'Admin' : 'User'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="ms-btn ms-btn-primary" onClick={() => openOverview(u._id)}>Overview</button>
                        <button className="ms-btn danger" onClick={() => delUser(u._id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="muted">No users</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}