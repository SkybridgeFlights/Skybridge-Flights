import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';
import './ManageStaff.css';

const PERMISSIONS = [
  { key: 'viewStats', label: 'Dashboard / Stats' },
  { key: 'manageProviders', label: 'Manage Providers' },
  { key: 'viewUsers', label: 'Manage Users (view)' },
  { key: 'manageBlog', label: 'Manage Blog' },
  { key: 'publishBlog', label: 'Publish Blog' },
  { key: 'manageReviews', label: 'Manage Reviews' },
  { key: 'manageSupport', label: 'Support Inbox' },
];

const DEFAULT_PERMS = PERMISSIONS.reduce((acc, p) => ({ ...acc, [p.key]: false }), {});

const ROLE_PRESETS = {
  Support: {
    ...DEFAULT_PERMS,
    manageSupport: true,
    manageReviews: true,
  },
  Content: {
    ...DEFAULT_PERMS,
    manageBlog: true,
    publishBlog: true,
    manageReviews: true,
  },
  Ops: {
    ...DEFAULT_PERMS,
    viewStats: true,
    manageProviders: true,
    viewUsers: true,
    manageSupport: true,
  },
  Admin: PERMISSIONS.reduce((a, p) => ({ ...a, [p.key]: true }), {}),
};

function EditStaffModal({ open, staff, onClose, onSave }) {
  const [role, setRole] = useState('Support');
  const [enabled, setEnabled] = useState(true);
  const [perms, setPerms] = useState({ ...DEFAULT_PERMS });

  useEffect(() => {
    if (!open || !staff) return;
    setRole(staff.role || 'Support');
    setEnabled(!!staff.enabled);
    setPerms({ ...DEFAULT_PERMS, ...(staff.permissions || {}) });
  }, [open, staff]);

  if (!open || !staff) return null;

  const togglePerm = (key) => setPerms((prev) => ({ ...prev, [key]: !prev[key] }));
  const selectAll = () =>
    setPerms(PERMISSIONS.reduce((a, p) => ({ ...a, [p.key]: true }), {}));
  const clearAll = () => setPerms({ ...DEFAULT_PERMS });

  const applyRole = (newRole) => {
    setRole(newRole);
    setPerms({ ...ROLE_PRESETS[newRole] });
  };

  return (
    <div className="ms-overlay" role="dialog" aria-modal="true">
      <div className="ms-modal">
        <button className="ms-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <h3 className="ms-title">Edit staff</h3>
        <div className="ms-sub">
          {staff.name} • {staff.email}
        </div>

        <div className="ms-row-3">
          <div>
            <div className="ms-label">Role</div>
            <select className="ms-input" value={role} onChange={(e) => applyRole(e.target.value)}>
              <option>Support</option>
              <option>Content</option>
              <option>Ops</option>
              <option>Admin</option>
            </select>
          </div>

          <div>
            <div className="ms-label">Status</div>
            <label className="ms-check">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Enabled
            </label>
          </div>

          <div className="ms-quick">
            <button type="button" className="ms-btn ms-btn-light" onClick={selectAll}>
              Select all
            </button>
            <button type="button" className="ms-btn ms-btn-light" onClick={clearAll}>
              Clear
            </button>
          </div>
        </div>

        <div className="ms-grid" style={{ marginTop: 10 }}>
          {PERMISSIONS.map((p) => (
            <label key={p.key} className="ms-check">
              <input
                type="checkbox"
                checked={!!perms[p.key]}
                onChange={() => togglePerm(p.key)}
              />
              {p.label}
            </label>
          ))}
        </div>

        <div className="ms-footer">
          <button className="ms-btn ms-btn-light" onClick={onClose}>
            Cancel
          </button>
          <button
            className="ms-btn ms-btn-primary"
            onClick={() => onSave({ role, enabled, permissions: perms })}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ManageStaff() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState({ type: '', text: '' });

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Support',
    permissions: { ...ROLE_PRESETS.Support },
    enabled: true,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [target, setTarget] = useState(null);

  const token = localStorage.getItem('staffToken') || localStorage.getItem('token');

  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const roleOrder = (r) =>
    r === 'Admin' ? 0 : r === 'Ops' ? 1 : r === 'Content' ? 2 : 3;

  const load = async () => {
    setLoading(true);
    setNotice({ type: '', text: '' });

    try {
      const res = await axios.get(`${API_BASE_URL}/api/staff`, { headers });
      const data = (res.data || []).sort((a, b) => {
        const order = roleOrder(a.role) - roleOrder(b.role);
        return order !== 0 ? order : (a.name || '').localeCompare(b.name || '');
      });
      setRows(data);
    } catch (e) {
      console.error('load staff error:', e);
      setNotice({
        type: 'error',
        text: e.response?.data?.error || 'Failed to load staff',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  const validateForm = () => {
    if (!form.name.trim()) return 'Name is required';
    if (!form.email.trim()) return 'Email is required';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return 'Invalid email';
    if (!form.password || form.password.length < 6) {
      return 'Password must be at least 6 characters';
    }
    return null;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const err = validateForm();
    if (err) {
      setNotice({ type: 'error', text: err });
      return;
    }

    try {
      setBusy(true);

      await axios.post(`${API_BASE_URL}/api/staff`, form, { headers });

      setForm({
        name: '',
        email: '',
        password: '',
        role: 'Support',
        permissions: { ...ROLE_PRESETS.Support },
        enabled: true,
      });

      setNotice({ type: 'success', text: 'Staff member created successfully.' });
      await load();
    } catch (e) {
      console.error('create staff error:', e);
      setNotice({
        type: 'error',
        text: e.response?.data?.error || 'Failed to create staff',
      });
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (row) => {
    setTarget(row);
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setTarget(null);
  };

  const saveEdit = async (payload) => {
    if (!target) return;

    try {
      await axios.patch(`${API_BASE_URL}/api/staff/${target._id}`, payload, { headers });
      setNotice({ type: 'success', text: 'Staff member updated successfully.' });
      closeEdit();
      await load();
    } catch (e) {
      console.error('update staff error:', e);
      setNotice({
        type: 'error',
        text: e.response?.data?.error || 'Failed to update staff',
      });
    }
  };

  const resetPassword = async (id) => {
    const password = prompt('Enter a new password (min 6 chars):');
    if (!password) return;

    if (password.length < 6) {
      setNotice({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }

    try {
      await axios.patch(`${API_BASE_URL}/api/staff/${id}`, { password }, { headers });
      setNotice({ type: 'success', text: 'Password updated successfully.' });
    } catch (e) {
      console.error('reset password error:', e);
      setNotice({
        type: 'error',
        text: e.response?.data?.error || 'Failed to reset password',
      });
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this staff member?')) return;

    try {
      await axios.delete(`${API_BASE_URL}/api/staff/${id}`, { headers });
      setRows((prev) => prev.filter((r) => r._id !== id));
      setNotice({ type: 'success', text: 'Staff member deleted successfully.' });
    } catch (e) {
      console.error('delete staff error:', e);
      setNotice({
        type: 'error',
        text: e.response?.data?.error || 'Failed to delete staff',
      });
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.role?.toLowerCase().includes(q)
    );
  }, [rows, query]);

  return (
    <div className="container mt-4 ms-page">
      <div className="ms-topbar">
        <div>
          <h2>Manage Staff</h2>
          <p className="muted">Create, edit, enable, and organize staff access.</p>
        </div>

        <div className="ms-top-stats">
          <div className="ms-mini-stat">
            <span>Total Staff</span>
            <strong>{rows.length}</strong>
          </div>
          <div className="ms-mini-stat">
            <span>Active</span>
            <strong>{rows.filter((r) => r.enabled).length}</strong>
          </div>
          <div className="ms-mini-stat">
            <span>Admins</span>
            <strong>{rows.filter((r) => r.role === 'Admin').length}</strong>
          </div>
        </div>
      </div>

      {notice.text && (
        <div
          className={`ms-notice ${
            notice.type === 'error' ? 'ms-notice-error' : 'ms-notice-success'
          }`}
        >
          {notice.text}
        </div>
      )}

      <section className="ms-card">
        <div className="ms-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div className="ms-label">Add new staff member</div>
          <div className="muted">Choose a role preset, then fine-tune permissions.</div>
        </div>

        <form onSubmit={handleCreate}>
          <div className="ms-row-3">
            <div>
              <div className="ms-label">Name</div>
              <input
                className="ms-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div>
              <div className="ms-label">Email</div>
              <input
                className="ms-input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div>
              <div className="ms-label">Password</div>
              <input
                className="ms-input"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="ms-row" style={{ gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
            <div className="ms-role">
              <div className="ms-label">Role</div>
              <select
                className="ms-input"
                value={form.role}
                onChange={(e) => {
                  const role = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    role,
                    permissions: { ...ROLE_PRESETS[role] },
                  }));
                }}
              >
                <option>Support</option>
                <option>Content</option>
                <option>Ops</option>
                <option>Admin</option>
              </select>
            </div>

            <label className="ms-check" title="Enable/disable staff account">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              Enabled
            </label>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="ms-btn ms-btn-light"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    permissions: PERMISSIONS.reduce((a, p) => ({ ...a, [p.key]: true }), {}),
                  }))
                }
              >
                Select all
              </button>

              <button
                type="button"
                className="ms-btn ms-btn-light"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    permissions: { ...DEFAULT_PERMS },
                  }))
                }
              >
                Clear
              </button>
            </div>
          </div>

          <div className="ms-grid" style={{ marginTop: 10 }}>
            {PERMISSIONS.map((p) => (
              <label key={p.key} className="ms-check">
                <input
                  type="checkbox"
                  checked={!!form.permissions[p.key]}
                  onChange={() =>
                    setForm((prev) => ({
                      ...prev,
                      permissions: {
                        ...prev.permissions,
                        [p.key]: !prev.permissions[p.key],
                      },
                    }))
                  }
                />
                {p.label}
              </label>
            ))}
          </div>

          <div className="ms-actions" style={{ marginTop: 12 }}>
            <button className="ms-btn ms-btn-primary" disabled={busy}>
              {busy ? 'Adding…' : 'Add Staff'}
            </button>
          </div>
        </form>
      </section>

      <div className="ms-row" style={{ justifyContent: 'space-between', margin: '10px 0' }}>
        <div className="ms-label">Staff List</div>
        <div className="muted">
          Showing {filtered.length} of {rows.length}
        </div>
      </div>

      <section className="ms-card">
        <div className="ms-row" style={{ marginBottom: 10 }}>
          <input
            className="ms-input"
            placeholder="Search by name, email, or role…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="ms-table-wrap">
            <table className="ms-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 180 }}>Name</th>
                  <th style={{ minWidth: 220 }}>Email</th>
                  <th>Role</th>
                  <th>Enabled</th>
                  <th style={{ minWidth: 420 }}>Permissions</th>
                  <th style={{ minWidth: 240 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s._id}>
                    <td className="text-left">{s.name}</td>
                    <td className="muted text-left">{s.email}</td>
                    <td>
                      <span className={`role role-${(s.role || '').toLowerCase()}`}>{s.role}</span>
                    </td>
                    <td>
                      <span className={`chip ${s.enabled ? 'chip-on' : 'chip-off'}`}>
                        {s.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="text-left">
                      <div className="perm-summary">
                        {PERMISSIONS.map(
                          (p) =>
                            !!(s.permissions && s.permissions[p.key]) && (
                              <span key={p.key} className="pill">
                                {p.label}
                              </span>
                            )
                        )}
                        {(!s.permissions || !PERMISSIONS.some((p) => s.permissions[p.key])) && (
                          <span className="muted">No permissions</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className="ms-btn ms-btn-light" onClick={() => openEdit(s)}>
                          Edit
                        </button>
                        <button className="ms-btn ms-btn-light" onClick={() => resetPassword(s._id)}>
                          Reset password
                        </button>
                        <button className="ms-btn ms-btn-danger" onClick={() => remove(s._id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">
                      No staff matched your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <EditStaffModal open={editOpen} staff={target} onClose={closeEdit} onSave={saveEdit} />
    </div>
  );
}