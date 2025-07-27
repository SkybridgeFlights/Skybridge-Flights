// src/pages/UserProfilePage.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './UserProfilePage.css';

function safeParseUser() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    // في حال كانت القيمة تالفة امسحها وارجع null
    localStorage.removeItem('user');
    return null;
  }
}

const UserProfilePage = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);

  useEffect(() => {
    const u = safeParseUser();
    if (!u) {
      // غير مسجل دخول -> إعادة إلى صفحة الدخول
      navigate('/login');
    } else {
      setUser(u);
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (!user) {
    // أثناء إعادة التوجيه أو القراءة
    return (
      <div className="user-profile-container">
        <div className="user-profile-box">
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  const createdAt =
    user.createdAt ? new Date(user.createdAt).toLocaleString() : '—';

  return (
    <div className="user-profile-container">
      <div className="user-profile-box">
        <h2>Welcome to Your Account</h2>

        <div className="user-field">
          <span className="label">Name:</span>
          <span className="value">{user.name || '—'}</span>
        </div>

        <div className="user-field">
          <span className="label">Email:</span>
          <span className="value">{user.email}</span>
        </div>

        <div className="user-field">
          <span className="label">Verified:</span>
          <span className="value">{user.isVerified ? 'Yes' : 'No'}</span>
        </div>

        <div className="user-field">
          <span className="label">Joined at:</span>
          <span className="value">{createdAt}</span>
        </div>

        {/* لاحقاً سنعرض الحجوزات/السجل هنا عبر استدعاءات API */}

        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </div>
  );
};

export default UserProfilePage;