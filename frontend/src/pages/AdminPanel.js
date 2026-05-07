import './AdminPanel.css';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';

const AdminPanel = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    users: 0,
    verifiedUsers: 0,
    providers: 0,
    activeProviders: 0,
    blogPosts: 0,
    publishedBlogPosts: 0,
    draftBlogPosts: 0,
    reviews: 0,
    supportThreads: 0,
    openSupportThreads: 0,
    pendingSupportThreads: 0,
    outboundClicks: 0,
    clicksToday: 0,
  });

  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('staffToken');

        const { data } = await axios.get(`${API_BASE_URL}/api/admin/dashboard-stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setStats({
          users: data.users || 0,
          verifiedUsers: data.verifiedUsers || 0,
          providers: data.providers || 0,
          activeProviders: data.activeProviders || 0,
          blogPosts: data.blogPosts || 0,
          publishedBlogPosts: data.publishedBlogPosts || 0,
          draftBlogPosts: data.draftBlogPosts || 0,
          reviews: data.reviews || 0,
          supportThreads: data.supportThreads || 0,
          openSupportThreads: data.openSupportThreads || 0,
          pendingSupportThreads: data.pendingSupportThreads || 0,
          outboundClicks: data.outboundClicks || 0,
          clicksToday: data.clicksToday || 0,
        });

        setMessage('System connected successfully. Admin statistics are live.');
      } catch (err) {
        console.error('Dashboard load error:', err);
        setMessage('Dashboard loaded, but some statistics could not be fetched.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const statCards = useMemo(
    () => [
      {
        title: 'Users',
        value: stats.users,
        subtitle: 'Registered platform accounts',
      },
      {
        title: 'Active Providers',
        value: stats.activeProviders,
        subtitle: 'Enabled affiliate and search partners',
      },
      {
        title: 'Published Posts',
        value: stats.publishedBlogPosts,
        subtitle: 'Live blog content',
      },
      {
        title: 'Reviews',
        value: stats.reviews,
        subtitle: 'Traveler reviews on the website',
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
      title: 'Manage Reviews',
      text: 'Review and delete traveler feedback shown on the website.',
      to: '/admin/reviews',
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
              providers, users, reviews, and internal operations.
            </p>
          </div>

          <div className="admin-hero-badge">Main Control Panel</div>
        </div>

        {message && <div className="admin-info-banner">{message}</div>}

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
            <h2>Operational Overview</h2>
            <p>Current platform content, support, reviews, and partner activity.</p>
          </div>

          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <span className="admin-stat-title">Verified Users</span>
              <strong className="admin-stat-value">{stats.verifiedUsers}</strong>
              <span className="admin-stat-subtitle">Users with verified accounts</span>
            </div>

            <div className="admin-stat-card">
              <span className="admin-stat-title">All Providers</span>
              <strong className="admin-stat-value">{stats.providers}</strong>
              <span className="admin-stat-subtitle">Total providers in the system</span>
            </div>

            <div className="admin-stat-card">
              <span className="admin-stat-title">Draft Posts</span>
              <strong className="admin-stat-value">{stats.draftBlogPosts}</strong>
              <span className="admin-stat-subtitle">Blog posts not published yet</span>
            </div>

            <div className="admin-stat-card">
              <span className="admin-stat-title">Open Support Threads</span>
              <strong className="admin-stat-value">{stats.openSupportThreads}</strong>
              <span className="admin-stat-subtitle">Tickets currently open</span>
            </div>

            <div className="admin-stat-card">
              <span className="admin-stat-title">Pending Support</span>
              <strong className="admin-stat-value">{stats.pendingSupportThreads}</strong>
              <span className="admin-stat-subtitle">Support threads awaiting action</span>
            </div>

            <div className="admin-stat-card">
              <span className="admin-stat-title">All Support Threads</span>
              <strong className="admin-stat-value">{stats.supportThreads}</strong>
              <span className="admin-stat-subtitle">Total support conversations</span>
            </div>

            <div className="admin-stat-card">
              <span className="admin-stat-title">All Blog Posts</span>
              <strong className="admin-stat-value">{stats.blogPosts}</strong>
              <span className="admin-stat-subtitle">Published and draft posts</span>
            </div>

            <div className="admin-stat-card">
              <span className="admin-stat-title">Clicks Today</span>
              <strong className="admin-stat-value">{stats.clicksToday}</strong>
              <span className="admin-stat-subtitle">Outbound clicks recorded today</span>
            </div>
          </div>
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
            <p>The admin area is aligned with the affiliate metasearch model.</p>
          </div>

          <div className="admin-focus-box">
            <ul>
              <li>Provider management and outbound referral optimization</li>
              <li>User growth and verified account monitoring</li>
              <li>Blog publishing and SEO expansion</li>
              <li>Review moderation and content trust</li>
              <li>Support operations and issue follow-up</li>
              <li>Preparation for future analytics such as visitors and search events</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminPanel;