import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './BookingSettingsPage.css';
import { API_BASE_URL } from '../apiConfig';

function BookingSettingsPage() {
  const [settings, setSettings] = useState({
    allowCancellation: false,
    cancellationHoursLimit: 24,
    cancellationPolicy: '',

    allowRefunds: false,
    refundHoursLimit: 72,
    refundPolicy: '',

    allowModification: false,
    modificationHoursLimit: 48,
    modificationPolicy: '',

    bookingTerms: '',
    baggagePolicy: '',
    autoEmailNotification: false,
    autoEmailMessage: '',

    customTerms: [],
  });

  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('');

  const token = useMemo(
    () => localStorage.getItem('staffToken') || localStorage.getItem('token'),
    []
  );

  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/settings/booking`, { headers });

        const normalized = {
          allowCancellation: !!data.allowCancellation,
          cancellationHoursLimit: Number(data.cancellationHoursLimit ?? 24),
          cancellationPolicy:
            data.cancellationPolicyText ??
            data.cancellationPolicy ??
            '',

          allowRefunds: !!data.allowRefunds,
          refundHoursLimit: Number(data.refundHoursLimit ?? 72),
          refundPolicy: data.refundPolicy ?? '',

          allowModification: !!data.allowModification,
          modificationHoursLimit: Number(data.modificationHoursLimit ?? 48),
          modificationPolicy: data.modificationPolicy ?? '',

          bookingTerms: data.bookingTerms ?? '',
          baggagePolicy: data.baggagePolicy ?? '',
          autoEmailNotification: !!data.autoEmailNotification,
          autoEmailMessage: data.autoEmailMessage ?? '',

          customTerms: Array.isArray(data.customTerms) ? data.customTerms : [],
        };

        setSettings((prev) => ({ ...prev, ...normalized }));
      } catch (error) {
        console.error('Failed to load settings:', error);
        setSaveStatus('❌ Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [headers]);

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const addCustomTerm = () => {
    setSettings((prev) => ({
      ...prev,
      customTerms: [...(prev.customTerms || []), { title: '', text: '' }],
    }));
  };

  const updateCustomTerm = (idx, key, value) => {
    setSettings((prev) => {
      const list = [...(prev.customTerms || [])];
      list[idx] = { ...list[idx], [key]: value };
      return { ...prev, customTerms: list };
    });
  };

  const removeCustomTerm = (idx) => {
    setSettings((prev) => {
      const list = [...(prev.customTerms || [])];
      list.splice(idx, 1);
      return { ...prev, customTerms: list };
    });
  };

  const moveCustomTerm = (idx, dir) => {
    setSettings((prev) => {
      const list = [...(prev.customTerms || [])];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= list.length) return prev;
      const tmp = list[idx];
      list[idx] = list[newIdx];
      list[newIdx] = tmp;
      return { ...prev, customTerms: list };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveStatus('');

    try {
      const payload = {
        allowCancellation: settings.allowCancellation,
        cancellationHoursLimit: Number(settings.cancellationHoursLimit || 0),
        cancellationPolicyText: settings.cancellationPolicy || '',

        allowRefunds: settings.allowRefunds,
        refundHoursLimit: Number(settings.refundHoursLimit || 0),

        refundPolicy: settings.refundPolicy || '',
        allowModification: settings.allowModification,
        modificationHoursLimit: Number(settings.modificationHoursLimit || 0),
        modificationPolicy: settings.modificationPolicy || '',
        bookingTerms: settings.bookingTerms || '',
        baggagePolicy: settings.baggagePolicy || '',
        autoEmailNotification: !!settings.autoEmailNotification,
        autoEmailMessage: settings.autoEmailMessage || '',

        customTerms: (settings.customTerms || []).map((t) => ({
          title: t.title || '',
          text: t.text || '',
        })),
      };

      const { data } = await axios.put(
        `${API_BASE_URL}/api/settings/booking`,
        payload,
        { headers }
      );

      const normalizedAfterSave = {
        allowCancellation: !!data.allowCancellation,
        cancellationHoursLimit: Number(
          data.cancellationHoursLimit ?? settings.cancellationHoursLimit
        ),
        cancellationPolicy:
          data.cancellationPolicyText ??
          data.cancellationPolicy ??
          settings.cancellationPolicy,

        allowRefunds: data.allowRefunds ?? settings.allowRefunds,
        refundHoursLimit: Number(data.refundHoursLimit ?? settings.refundHoursLimit),

        refundPolicy: data.refundPolicy ?? settings.refundPolicy,
        allowModification: !!(data.allowModification ?? settings.allowModification),
        modificationHoursLimit: Number(
          data.modificationHoursLimit ?? settings.modificationHoursLimit
        ),
        modificationPolicy: data.modificationPolicy ?? settings.modificationPolicy,
        bookingTerms: data.bookingTerms ?? settings.bookingTerms,
        baggagePolicy: data.baggagePolicy ?? settings.baggagePolicy,
        autoEmailNotification: !!(
          data.autoEmailNotification ?? settings.autoEmailNotification
        ),
        autoEmailMessage: data.autoEmailMessage ?? settings.autoEmailMessage,

        customTerms: Array.isArray(data.customTerms)
          ? data.customTerms
          : settings.customTerms,
      };

      setSettings((prev) => ({ ...prev, ...normalizedAfterSave }));
      setSaveStatus('✅ Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('❌ Failed to save settings');
    }
  };

  return (
    <div className="booking-settings-container">
      <h2>🛠 Booking Settings</h2>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="bs-section">
            <div className="bs-section-head">
              <h3>❌ Cancellation</h3>
            </div>

            <label className="bs-checkbox">
              <input
                type="checkbox"
                name="allowCancellation"
                checked={!!settings.allowCancellation}
                onChange={handleChange}
              />
              Allow users to cancel bookings
            </label>

            <label className="bs-label">
              Hours before flight allowed for cancellation:
              <input
                type="number"
                name="cancellationHoursLimit"
                value={Number(settings.cancellationHoursLimit || 0)}
                onChange={handleChange}
                min={0}
              />
            </label>

            <label className="bs-label">
              Cancellation Policy (text):
              <textarea
                name="cancellationPolicy"
                value={settings.cancellationPolicy || ''}
                onChange={handleChange}
              />
            </label>
          </div>

          <div className="bs-section">
            <div className="bs-section-head">
              <h3>💸 Refund</h3>
            </div>

            <p className="bs-hint">
              Configure refund behavior here using the legacy text fields currently available.
            </p>

            <label className="bs-checkbox">
              <input
                type="checkbox"
                name="allowRefunds"
                checked={!!settings.allowRefunds}
                onChange={handleChange}
              />
              Allow Refunds
            </label>

            <label className="bs-label">
              Hours limit for refund after cancellation:
              <input
                type="number"
                name="refundHoursLimit"
                value={Number(settings.refundHoursLimit || 0)}
                onChange={handleChange}
                min={0}
              />
            </label>

            <label className="bs-label">
              Refund Policy (text):
              <textarea
                name="refundPolicy"
                value={settings.refundPolicy || ''}
                onChange={handleChange}
              />
            </label>
          </div>

          <div className="bs-section">
            <div className="bs-section-head">
              <h3>🛠 Modification</h3>
            </div>

            <label className="bs-checkbox">
              <input
                type="checkbox"
                name="allowModification"
                checked={!!settings.allowModification}
                onChange={handleChange}
              />
              Allow Booking Modifications
            </label>

            <label className="bs-label">
              Hours before flight allowed for modifications:
              <input
                type="number"
                name="modificationHoursLimit"
                value={Number(settings.modificationHoursLimit || 0)}
                onChange={handleChange}
                min={0}
              />
            </label>

            <label className="bs-label">
              Modification Policy (text):
              <textarea
                name="modificationPolicy"
                value={settings.modificationPolicy || ''}
                onChange={handleChange}
              />
            </label>
          </div>

          <div className="bs-section">
            <div className="bs-section-head">
              <h3>📜 General</h3>
            </div>

            <label className="bs-label">
              Booking Terms & Conditions:
              <textarea
                name="bookingTerms"
                value={settings.bookingTerms || ''}
                onChange={handleChange}
              />
            </label>

            <label className="bs-label">
              💼 Baggage Policy:
              <textarea
                name="baggagePolicy"
                value={settings.baggagePolicy || ''}
                onChange={handleChange}
              />
            </label>

            <label className="bs-checkbox">
              <input
                type="checkbox"
                name="autoEmailNotification"
                checked={!!settings.autoEmailNotification}
                onChange={handleChange}
              />
              Enable automatic email notifications
            </label>

            <label className="bs-label">
              📧 Email Notification Message:
              <textarea
                name="autoEmailMessage"
                value={settings.autoEmailMessage || ''}
                onChange={handleChange}
              />
            </label>
          </div>

          <div className="bs-section">
            <div
              className="bs-section-head"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <h3>➕ Custom Terms</h3>
              <button type="button" className="bs-btn-primary" onClick={addCustomTerm}>
                Add
              </button>
            </div>

            {(!settings.customTerms || settings.customTerms.length === 0) && (
              <p className="bs-hint">No custom terms yet. Click “Add” to create one.</p>
            )}

            {settings.customTerms &&
              settings.customTerms.map((t, idx) => (
                <div
                  key={idx}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <button
                      type="button"
                      className="bs-btn-outline"
                      onClick={() => moveCustomTerm(idx, -1)}
                      disabled={idx === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="bs-btn-outline"
                      onClick={() => moveCustomTerm(idx, 1)}
                      disabled={idx === settings.customTerms.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="bs-btn-outline"
                      onClick={() => removeCustomTerm(idx)}
                    >
                      Delete
                    </button>
                  </div>

                  <label className="bs-label">
                    Title (optional):
                    <input
                      type="text"
                      value={t.title || ''}
                      onChange={(e) => updateCustomTerm(idx, 'title', e.target.value)}
                    />
                  </label>

                  <label className="bs-label">
                    Text:
                    <textarea
                      value={t.text || ''}
                      onChange={(e) => updateCustomTerm(idx, 'text', e.target.value)}
                    />
                  </label>
                </div>
              ))}
          </div>

          <button type="submit" className="bs-btn-primary">
            💾 Save
          </button>
          {saveStatus && <p className="save-status">{saveStatus}</p>}
        </form>
      )}
    </div>
  );
}

export default BookingSettingsPage;