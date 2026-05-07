import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Select from 'react-select';
import './UserProfilePage.css';
import { API_BASE_URL } from '../apiConfig';
import airports from '../data/airports';

function safeParseUser() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem('user');
    return null;
  }
}

const UserProfilePage = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    preferredAirport: '',
    preferredCabinClass: 'Economy',
    newsletter: false,
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const u = safeParseUser();
    if (!u) {
      navigate('/login');
      return;
    }

    setUser(u);
    setProfileForm({
      name: u.name || '',
      email: u.email || '',
      preferredAirport: u.preferredAirport || '',
      preferredCabinClass: u.preferredCabinClass || 'Economy',
      newsletter: !!u.newsletter,
    });
  }, [navigate]);

  const joinedAt = useMemo(() => {
    if (!user?.createdAt) return '—';
    try {
      return new Date(user.createdAt).toLocaleString();
    } catch {
      return '—';
    }
  }, [user]);

  const token = localStorage.getItem('token');

  const airportOptions = useMemo(() => {
    if (!Array.isArray(airports)) return [];
    return airports.map((airport) => ({
      value: airport.code,
      label: `${airport.city} - ${airport.name} (${airport.code})`,
    }));
  }, []);

  const selectedAirportOption =
    airportOptions.find((option) => option.value === profileForm.preferredAirport) || null;

  const handleProfileChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProfileForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveProfile = async () => {
    setMessage('');
    setError('');

    if (!profileForm.name.trim()) {
      setError('Name is required.');
      return;
    }

    if (!profileForm.email.trim()) {
      setError('Email is required.');
      return;
    }

    try {
      setSavingProfile(true);

      const { data } = await axios.put(
        `${API_BASE_URL}/api/users/profile`,
        profileForm,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.dispatchEvent(new Event('userStateChange'));
      setMessage('Profile updated successfully.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    setMessage('');
    setError('');

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setError('Please fill in all password fields.');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    try {
      setSavingPassword(true);

      const { data } = await axios.put(
        `${API_BASE_URL}/api/users/change-password`,
        {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      setMessage(data?.message || 'Password updated successfully.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('staffToken');
    window.dispatchEvent(new Event('userStateChange'));
    navigate('/login');
  };

  if (!user) {
    return (
      <div className="profile-page">
        <div className="profile-shell">
          <div className="profile-card profile-loading-card">Loading account...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-shell">
        <div className="profile-hero">
          <div className="profile-hero-left">
            <div className="profile-avatar">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>

            <div className="profile-heading">
              <span className="profile-kicker">Account Center</span>
              <h1>My Profile</h1>
              <p>Manage your account details, travel preferences, and security settings.</p>
            </div>
          </div>

          <div className="profile-hero-right">
            <div className="profile-mini-card">
              <span className="mini-label">Member since</span>
              <strong>{joinedAt}</strong>
            </div>
          </div>
        </div>

        {(message || error) && (
          <div className={`profile-alert ${error ? 'error' : 'success'}`}>
            {error || message}
          </div>
        )}

        <div className="profile-grid">
          <section className="profile-panel">
            <div className="panel-header">
              <div>
                <span className="panel-eyebrow">Personal</span>
                <h2>Account Information</h2>
              </div>
            </div>

            <div className="info-grid">
              <div className="info-item">
                <label>Full name</label>
                <input
                  name="name"
                  value={profileForm.name}
                  onChange={handleProfileChange}
                  placeholder="Your full name"
                />
              </div>

              <div className="info-item">
                <label>Email address</label>
                <input
                  type="email"
                  name="email"
                  value={profileForm.email}
                  onChange={handleProfileChange}
                  placeholder="Your email address"
                />
              </div>

              <div className="info-item">
                <label>Verification status</label>
                <div className={`status-badge ${user.isVerified ? 'verified' : 'unverified'}`}>
                  <span className="status-dot" />
                  {user.isVerified ? 'Verified' : 'Not verified'}
                </div>
              </div>

              <div className="info-item">
                <label>Joined</label>
                <div className="info-value">{joinedAt}</div>
              </div>
            </div>

            <div className="panel-actions">
              <button
                className="panel-btn primary"
                onClick={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? 'Saving...' : 'Save Account Details'}
              </button>
            </div>
          </section>

          <section className="profile-panel">
            <div className="panel-header">
              <div>
                <span className="panel-eyebrow">Travel</span>
                <h2>Travel Preferences</h2>
              </div>
            </div>

            <div className="info-grid single-column">
              <div className="info-item">
                <label>Preferred airport</label>
                <Select
                  classNamePrefix="airport-select"
                  options={airportOptions}
                  value={selectedAirportOption}
                  onChange={(selected) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      preferredAirport: selected ? selected.value : '',
                    }))
                  }
                  placeholder="Search airport by city, name, or code"
                  isClearable
                  isSearchable
                  noOptionsMessage={() => 'No airports found'}
                />
              </div>

              <div className="info-item">
                <label>Preferred cabin class</label>
                <select
                  name="preferredCabinClass"
                  value={profileForm.preferredCabinClass}
                  onChange={handleProfileChange}
                >
                  <option value="Economy">Economy</option>
                  <option value="Premium Economy">Premium Economy</option>
                  <option value="Business">Business</option>
                  <option value="First">First</option>
                </select>
              </div>

              <div className="newsletter-card">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    name="newsletter"
                    checked={profileForm.newsletter}
                    onChange={handleProfileChange}
                  />
                  <span>Receive promotional emails and travel updates.</span>
                </label>
              </div>
            </div>

            <div className="panel-actions">
              <button
                className="panel-btn primary"
                onClick={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </section>

          <section className="profile-panel full-width">
            <div className="panel-header">
              <div>
                <span className="panel-eyebrow">Security</span>
                <h2>Change Password</h2>
              </div>
            </div>

            <div className="password-grid">
              <div className="info-item">
                <label>Current password</label>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                  placeholder="Enter current password"
                />
              </div>

              <div className="info-item">
                <label>New password</label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  placeholder="Enter new password"
                />
              </div>

              <div className="info-item">
                <label>Confirm new password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  placeholder="Confirm new password"
                />
              </div>
            </div>

            <div className="security-note">
              Use a strong password with at least 6 characters. Avoid reusing passwords from other websites.
            </div>

            <div className="panel-actions">
              <button
                className="panel-btn primary"
                onClick={handleChangePassword}
                disabled={savingPassword}
              >
                {savingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </section>
        </div>

        <div className="profile-footer">
          <button
            onClick={() => navigate('/delete-account')}
            style={{
              marginRight: '10px',
              background: '#dc3545',
              color: '#fff',
              border: 'none',
              padding: '12px 18px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Delete Account
          </button>

          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;