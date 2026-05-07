import './AdminPanel.css';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';

const AdminPanel = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    providers: 0,
    users: 0,
    blogPosts: 0,
    supportThreads: 0,
  });

  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('staffToken');

        const requests = await Promise.allSettled([
          axios.get(`${API_BASE_URL}/api/users/test`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_BASE_URL}/api/settings/booking`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        setStats({
          providers: 0,
          users: 0,
          blogPosts: 0,
          supportThreads: 0,
        });

        if (requests[0].status === 'fulfilled') {
          setMessage('System is connected and admin services are running.');
        } else {
          setMessage('Dashboard loaded. Some statistics are not connected yet.');
        }
      } catch (err) {
        console.error('Dashboard load error:', err);
        setMessage('Dashboard loaded with limited data.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const statCards = useMemo(
    () => [
      {
        title: 'Providers',
        value: stats.providers,
        subtitle: 'Affiliate and search partners',
      },
      {
        title: 'Users',
        value: stats.users,
        subtitle: 'Registered platform accounts',
      },
      {
        title: 'Blog Posts',
        value: stats.blogPosts,
        subtitle: 'Published articles and content',
      },
      {
        title: 'Support',
        value: stats.supportThreads,
        subtitle: 'Open support activity',
      },
    ],
    [stats]
  );

  const quickLinks = [
    {
      title: 'Manage Providers',
      text: 'Add, enable, disable, and organize your travel providers.',
      to: '/admin/providers',
    },
    {
      title: 'Manage Blog',
      text: 'Create and publish articles to grow traffic and improve visibility.',
      to: '/admin/blog',
    },
    {
      title: 'Manage Users',
      text: 'Review user accounts and platform access.',
      to: '/admin/users',
    },
    {
      title: 'Manage Staff',
      text: 'Control staff access and internal dashboard permissions.',
      to: '/admin/manage-staff',
    },
    {
      title: 'Manage Flights',
      text: 'Review current flight management tools and integrations.',
      to: '/admin/manage-flights',
    },
    {
      title: 'Support Inbox',
      text: 'Handle support conversations and follow up on user issues.',
      to: '/admin/support',
    },
  ];

  if (loading) {
    return (
      <div className="admin-dashboard-page">
        <div className="admin-dashboard-shell">
          <div className="admin-loading-card">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-page">
      <div className="admin-dashboard-shell">
        <div className="admin-hero">
          <div>
            <h1>Admin Dashboard</h1>
            <p>
              Manage Skybridge Flights, monitor the platform, and control content,
              providers, users, and internal operations.
            </p>
          </div>

          <div className="admin-hero-badge">
            Main Control Panel
          </div>
        </div>

        {message && (
          <div className="admin-info-banner">
            {message}
          </div>
        )}

        <section className="admin-stats-grid">
          {statCards.map((card) => (
            <div className="admin-stat-card" key={card.title}>
              <span className="admin-stat-title">{card.title}</span>
              <strong className="admin-stat-value">{card.value}</strong>
              <span className="admin-stat-subtitle">{card.subtitle}</span>
            </div>
          ))}
        </section>

        <section className="admin-section">
          <div className="admin-section-header">
            <h2>Quick Actions</h2>
            <p>Go directly to the most important management areas.</p>
          </div>

          <div className="admin-quick-grid">
            {quickLinks.map((item) => (
              <div className="admin-quick-card" key={item.to}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <Link to={item.to} className="admin-card-link">
                  Open
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-header">
            <h2>Platform Focus</h2>
            <p>The admin area has been simplified to match the current product direction.</p>
          </div>

          <div className="admin-focus-box">
            <ul>
              <li>Flight comparison and provider management</li>
              <li>Blog publishing and SEO growth</li>
              <li>User account oversight</li>
              <li>Support management</li>
              <li>Preparation for future analytics and partner expansion</li>
            </ul>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-header">
            <h2>Removed Legacy Areas</h2>
            <p>These older areas are no longer central to the current platform model.</p>
          </div>

          <div className="admin-legacy-note">
            Legacy booking, visa, wallet, refund, and old internal flow sections have been
            deprioritized so the dashboard can focus on metasearch, provider growth,
            content, and platform administration.
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminPanel;