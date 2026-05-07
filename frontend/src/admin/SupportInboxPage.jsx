// frontend/src/admin/SupportInboxPage.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';
import { getSocket } from '../realtime/socket';
import { useLocation } from 'react-router-dom';
import '../styles/Modals.css';
import '../pages/ManageStaff.css';

const withToken = (url, token) =>
  token ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : url;

const fileUrl = (token, ticketId, f) =>
  withToken(`${API_BASE_URL}/api/support/${ticketId}/download?fileId=${f._id}&inline=1`, token);

function TicketDetail({ id, onClose }) {
  const token = localStorage.getItem('staffToken') || localStorage.getItem('token');
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const [t, setT] = useState(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/support/${id}`, { headers });
      setT(data);
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  }, [id, headers]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  useEffect(() => {
    if (!id) return;
    const s = getSocket();
    const onNew = (p) => {
      if (String(p?.id) === String(id)) load();
    };

    s.emit('join:support', { id });
    s.on('support:message:new', onNew);
    s.on('support:updated', onNew);

    return () => {
      s.off('support:message:new', onNew);
      s.off('support:updated', onNew);
      s.emit('leave:support', { id });
    };
  }, [id, load]);

  const headersMultipart = { ...headers, 'Content-Type': 'multipart/form-data' };

  const reply = async () => {
    const txt = (text || '').trim();
    const hasFiles = files && files.length;
    if (!txt && !hasFiles) return;

    try {
      if (hasFiles) {
        const fd = new FormData();
        if (txt) fd.append('text', txt);
        files.forEach((f) => fd.append('files', f));
        const { data } = await axios.post(`${API_BASE_URL}/api/support/${id}/messages`, fd, {
          headers: headersMultipart,
        });
        setT(data);
      } else {
        const { data } = await axios.post(
          `${API_BASE_URL}/api/support/${id}/messages`,
          { text: txt },
          { headers }
        );
        setT(data);
      }
      setText('');
      setFiles([]);
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to send');
    }
  };

  const setStatus = async (status) => {
    try {
      await axios.patch(`${API_BASE_URL}/api/support/${id}`, { status }, { headers });
      await load();
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to update status');
    }
  };

  if (!id) return null;

  const customerName =
    (t?.customer && (t.customer.name || t.customer.email || String(t.customer))) || '—';
  const assignedName =
    (t?.assignedTo && (t.assignedTo.name || t.assignedTo.email || String(t.assignedTo))) || '—';

  return (
    <div className="sb-overlay" onClick={onClose}>
      <div className="sb-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 820 }}>
        <div className="sb-modal-header">
          <h5 className="sb-modal-title">Ticket #{String(id).slice(-6)}</h5>
          <button className="sb-close" onClick={onClose}>✕</button>
        </div>

        <div className="sb-modal-body">
          {loading ? (
            <p>Loading…</p>
          ) : !t ? (
            <p>Not found</p>
          ) : (
            <>
              <div
                className="ms-grid"
                style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}
              >
                <div className="ms-card">
                  <div className="ms-label">Subject</div>
                  <div className="bold">{t.subject}</div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    Status: <span className={`pill status-${t.status}`}>{t.status}</span>
                  </div>
                </div>
                <div className="ms-card">
                  <div className="ms-label">Customer</div>
                  <div className="muted">
                    {customerName}
                    <br />
                    Assigned: {assignedName}
                  </div>
                </div>
              </div>

              <div className="ms-card">
                <div className="ms-label">Conversation</div>
                <div className="sb-thread" style={{ maxHeight: 360, overflow: 'auto' }}>
                  {(t.messages || []).map((m) => (
                    <div key={m._id} className="sb-msg">
                      <span className="who">{m.byName || m.byKind}</span>
                      <span className="meta">({new Date(m.createdAt).toLocaleString()})</span>
                      {m.text && <div className="body">{m.text}</div>}
                      {!!(m.files || []).length && (
                        <div
                          className="attachments"
                          style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}
                        >
                          {m.files.map((f) => (
                            <a
                              key={f._id}
                              href={fileUrl(token, t._id, f)}
                              target="_blank"
                              rel="noreferrer"
                              className="sb-btn"
                              title={f.originalName}
                            >
                              ⬇ {f.originalName}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="ms-card">
                <div className="ms-label">Reply</div>
                <div className="ms-row" style={{ gap: 8, alignItems: 'center' }}>
                  <input
                    className="ms-input"
                    style={{ flex: 1 }}
                    placeholder="Write a reply…"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                  <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
                  <button className="sb-btn primary" onClick={reply}>Send</button>
                  <select
                    className="ms-input"
                    value={t.status}
                    onChange={(e) => setStatus(e.target.value)}
                    style={{ width: 140 }}
                  >
                    <option value="open">open</option>
                    <option value="pending">pending</option>
                    <option value="closed">closed</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="sb-modal-footer">
          <button className="sb-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function SupportInboxPage() {
  const token = localStorage.getItem('staffToken') || localStorage.getItem('token');
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const location = useLocation();
  const sp = new URLSearchParams(location.search);
  const userFilter = sp.get('user') || '';

  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('open');
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (status) params.set('status', status);
      if (userFilter) params.set('user', userFilter);

      const { data } = await axios.get(`${API_BASE_URL}/api/support?${params.toString()}`, { headers });
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [q, status, userFilter, headers]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const s = getSocket();
    const onAny = () => load();
    s.on('support:updated', onAny);
    s.on('support:message:new', onAny);
    return () => {
      s.off('support:updated', onAny);
      s.off('support:message:new', onAny);
    };
  }, [load]);

  const filtered = rows;
  const renderCustomer = (c) => (c ? (c.name || c.email || String(c)) : '—');

  return (
    <div className="container mt-4 ms-page">
      <h2>Support Inbox</h2>

      <div className="ms-card">
        <div className="ms-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <input
            className="ms-input"
            placeholder="Search subject…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={load}
          />
          <select
            className="ms-input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ width: 180 }}
            title="Filter by status"
          >
            <option value="open">Open (default)</option>
            <option value="pending">Pending</option>
            <option value="closed">Closed</option>
            <option value="all">All statuses</option>
          </select>
          <div className="muted">Showing {filtered.length} of {rows.length}</div>
        </div>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="ms-table-wrap">
            <table className="ms-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t._id}>
                    <td className="text-left">{t.subject}</td>
                    <td className="text-left">
                      {renderCustomer(t.customer)}
                      {t.customer?.email && <div className="muted">{t.customer.email}</div>}
                    </td>
                    <td><span className={`pill status-${t.status}`}>{t.status}</span></td>
                    <td>{new Date(t.updatedAt).toLocaleString()}</td>
                    <td>
                      <button className="ms-btn ms-btn-primary" onClick={() => setActiveId(t._id)}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="muted">No tickets</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {activeId && <TicketDetail id={activeId} onClose={() => setActiveId(null)} />}
    </div>
  );
}