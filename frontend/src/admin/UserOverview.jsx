// frontend/src/admin/UserOverview.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';
import '../styles/Modals.css';

export default function UserOverview() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const token = localStorage.getItem('staffToken') || localStorage.getItem('token') || '';
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const [loading, setLoading] = useState(true);
  const [u, setU] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/admin/users/${userId}`, { headers });
      setU(data || null);
    } catch (e) {
      setErr(e?.response?.data?.error || 'Failed to load user');
    } finally {
      setLoading(false);
    }
  }, [userId, headers]);

  useEffect(() => {
    load();
  }, [load]);

  const goBookings = () => navigate(`/admin/view-bookings?user=${encodeURIComponent(userId)}`);
  const goVisa = () => navigate(`/admin/view-visas?user=${encodeURIComponent(userId)}`);
  const goPassport = () => navigate(`/admin/view-passport?user=${encodeURIComponent(userId)}`);
  const goSupport = () => navigate(`/admin/support?user=${encodeURIComponent(userId)}`);
  const goWallet = () => navigate(`/admin/user/${encodeURIComponent(userId)}/wallet`);

  return (
    <div className="container mt-4 ms-page">
      <h2>User Overview</h2>

      <div className="ms-card">
        <div className="ms-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          {loading ? (
            <div className="muted">Loading…</div>
          ) : (
            <div className="muted">
              <div><b>Name:</b> {u?.name || '—'}</div>
              <div><b>Email:</b> {u?.email || '—'}</div>
              <div><b>Verified:</b> {u?.isVerified ? '✅' : '❌'}</div>
            </div>
          )}
          <div>
            <button className="ms-btn" onClick={load}>Reload</button>
          </div>
        </div>
        {err && <div className="error" style={{ marginTop: 8 }}>{err}</div>}
      </div>

      <div className="ms-card">
        <div className="ms-label">Quick Actions</div>
        <div className="ms-row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <button className="ms-btn ms-btn-primary" onClick={goWallet}>Wallet</button>
          <button className="ms-btn" onClick={goBookings}>Bookings</button>
          <button className="ms-btn" onClick={goVisa}>Visa</button>
          <button className="ms-btn" onClick={goPassport}>Passport</button>
          <button className="ms-btn" onClick={goSupport}>Support</button>
        </div>
      </div>

      <div className="muted" style={{ marginTop: 8 }}>
        All sections will open filtered to this user via <code>?user={userId}</code>.
      </div>
    </div>
  );
}