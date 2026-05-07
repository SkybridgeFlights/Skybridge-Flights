import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../apiConfig';
import './ManageProvidersPage.css';

const emptyForm = {
  key: '',
  name: '',
  redirectBaseUrl: '',
  affiliateCode: '',
  logoUrl: '',
  displayOrder: 0,
  enabled: true,
  isDefault: false,
};

function ManageProvidersPage() {
  const [providers, setProviders] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const sortedProviders = useMemo(() => {
    return [...providers].sort((a, b) => {
      const orderDiff = Number(a.displayOrder || 0) - Number(b.displayOrder || 0);
      if (orderDiff !== 0) return orderDiff;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }, [providers]);

  const loadProviders = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`${API_BASE_URL}/api/redirect/providers`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load providers');
      }

      setProviders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('loadProviders error:', err);
      setError(err.message || 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProviders();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId('');
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? checked
          : name === 'displayOrder'
          ? Number(value || 0)
          : value,
    }));
  };

  const handleEdit = (provider) => {
    setEditingId(provider._id);
    setForm({
      key: provider.key || '',
      name: provider.name || '',
      redirectBaseUrl: provider.redirectBaseUrl || '',
      affiliateCode: provider.affiliateCode || '',
      logoUrl: provider.logoUrl || '',
      displayOrder: Number(provider.displayOrder || 0),
      enabled: !!provider.enabled,
      isDefault: !!provider.isDefault,
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (providerId, providerName) => {
    const ok = window.confirm(`Delete provider "${providerName}"?`);
    if (!ok) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/redirect/providers/${providerId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to delete provider');
      }

      if (editingId === providerId) {
        resetForm();
      }

      await loadProviders();
    } catch (err) {
      console.error('delete provider error:', err);
      alert(err.message || 'Failed to delete provider');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.key.trim() || !form.name.trim() || !form.redirectBaseUrl.trim()) {
      alert('key, name and redirectBaseUrl are required');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        key: form.key.trim().toLowerCase(),
        name: form.name.trim(),
        redirectBaseUrl: form.redirectBaseUrl.trim(),
        affiliateCode: form.affiliateCode.trim(),
        logoUrl: form.logoUrl.trim(),
        displayOrder: Number(form.displayOrder || 0),
        enabled: !!form.enabled,
        isDefault: !!form.isDefault,
      };

      const url = editingId
        ? `${API_BASE_URL}/api/redirect/providers/${editingId}`
        : `${API_BASE_URL}/api/redirect/providers`;

      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to save provider');
      }

      resetForm();
      await loadProviders();
    } catch (err) {
      console.error('save provider error:', err);
      alert(err.message || 'Failed to save provider');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="manage-providers-page">
      <div className="providers-header">
        <h2>Manage Providers</h2>
        <p>Add, edit, enable, and reorder affiliate providers.</p>
      </div>

      <div className="providers-card">
        <h3>{editingId ? 'Edit Provider' : 'Add New Provider'}</h3>

        <form className="providers-form" onSubmit={handleSubmit}>
          <div className="providers-grid">
            <div className="field">
              <label>Key</label>
              <input
                name="key"
                value={form.key}
                onChange={handleChange}
                placeholder="aviasales"
                disabled={!!editingId}
              />
            </div>

            <div className="field">
              <label>Name</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Aviasales"
              />
            </div>

            <div className="field full">
              <label>Redirect Base URL</label>
              <input
                name="redirectBaseUrl"
                value={form.redirectBaseUrl}
                onChange={handleChange}
                placeholder="https://aviasales.tp.st/odC0JPEc"
              />
            </div>

            <div className="field">
              <label>Affiliate Code</label>
              <input
                name="affiliateCode"
                value={form.affiliateCode}
                onChange={handleChange}
                placeholder="709705"
              />
            </div>

            <div className="field">
              <label>Logo URL</label>
              <input
                name="logoUrl"
                value={form.logoUrl}
                onChange={handleChange}
                placeholder="https://..."
              />
            </div>

            <div className="field">
              <label>Display Order</label>
              <input
                type="number"
                name="displayOrder"
                value={form.displayOrder}
                onChange={handleChange}
              />
            </div>

            <div className="field checkbox-row">
              <label>
                <input
                  type="checkbox"
                  name="enabled"
                  checked={form.enabled}
                  onChange={handleChange}
                />
                Enabled
              </label>

              <label>
                <input
                  type="checkbox"
                  name="isDefault"
                  checked={form.isDefault}
                  onChange={handleChange}
                />
                Default
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="save-btn" disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Update Provider' : 'Add Provider'}
            </button>

            {editingId && (
              <button type="button" className="cancel-btn" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="providers-card">
        <h3>Providers List</h3>

        {loading ? (
          <p>Loading providers...</p>
        ) : error ? (
          <p className="error-text">{error}</p>
        ) : sortedProviders.length === 0 ? (
          <p>No providers found.</p>
        ) : (
          <div className="providers-table-wrap">
            <table className="providers-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Key</th>
                  <th>Order</th>
                  <th>Enabled</th>
                  <th>Default</th>
                  <th>Affiliate Code</th>
                  <th>URL</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedProviders.map((provider) => (
                  <tr key={provider._id}>
                    <td>{provider.name}</td>
                    <td>{provider.key}</td>
                    <td>{provider.displayOrder}</td>
                    <td>{provider.enabled ? 'Yes' : 'No'}</td>
                    <td>{provider.isDefault ? 'Yes' : 'No'}</td>
                    <td>{provider.affiliateCode || '—'}</td>
                    <td className="url-cell">{provider.redirectBaseUrl}</td>
                    <td>
                      <div className="row-actions">
                        <button onClick={() => handleEdit(provider)}>Edit</button>
                        <button
                          className="danger-btn"
                          onClick={() => handleDelete(provider._id, provider.name)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ManageProvidersPage;