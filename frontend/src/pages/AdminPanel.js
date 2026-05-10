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
  const [flightAlerts, setFlightAlerts] = useState({
    totalSubscribers: 0,
    activeAlerts: 0,
    recentNotifications: [],
    failedNotifications: 0,
  });
  const [analytics, setAnalytics] = useState({
    summary: {
      visitorsToday: 0,
      visitorsThisMonth: 0,
      pageViews: 0,
      uniqueVisitors: 0,
      trackerSearches: 0,
      aircraftSelected: 0,
      flightAlertSubscribers: 0,
      bookingCtaClicks: 0,
    },
    timeseries: [],
    topPages: [],
    tracker: { topSearches: [], topAirports: [], aircraftSelections: 0 },
    conversions: [],
    monetization: {
      flags: { ads: false, affiliates: false, sponsoredContent: false },
      topAdSlots: [],
      impressions: 0,
      adClicks: 0,
      affiliateClicks: 0,
      ctaConversions: 0,
      ctr: 0,
      conversionRate: 0,
    },
  });

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

        try {
          const [
            alertResponse,
            analyticsSummary,
            analyticsTimeseries,
            analyticsTopPages,
            analyticsTracker,
            analyticsConversions,
            analyticsMonetization,
          ] = await Promise.all([
            axios.get(`${API_BASE_URL}/api/admin/flight-alerts`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get(`${API_BASE_URL}/api/admin/analytics/summary`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get(`${API_BASE_URL}/api/admin/analytics/timeseries?days=30`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get(`${API_BASE_URL}/api/admin/analytics/top-pages?limit=8`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get(`${API_BASE_URL}/api/admin/analytics/tracker`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get(`${API_BASE_URL}/api/admin/analytics/conversions`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get(`${API_BASE_URL}/api/admin/analytics/monetization`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);
          setFlightAlerts({
            totalSubscribers: alertResponse.data.totalSubscribers || 0,
            activeAlerts: alertResponse.data.activeAlerts || 0,
            recentNotifications: alertResponse.data.recentNotifications || [],
            failedNotifications: alertResponse.data.failedNotifications || 0,
          });
          setAnalytics({
            summary: {
              visitorsToday: analyticsSummary.data.visitorsToday || 0,
              visitorsThisMonth: analyticsSummary.data.visitorsThisMonth || 0,
              pageViews: analyticsSummary.data.pageViews || 0,
              uniqueVisitors: analyticsSummary.data.uniqueVisitors || 0,
              trackerSearches: analyticsSummary.data.trackerSearches || 0,
              aircraftSelected: analyticsSummary.data.aircraftSelected || 0,
              flightAlertSubscribers: analyticsSummary.data.flightAlertSubscribers || 0,
              bookingCtaClicks: analyticsSummary.data.bookingCtaClicks || 0,
            },
            timeseries: analyticsTimeseries.data.data || [],
            topPages: analyticsTopPages.data.data || [],
            tracker: {
              topSearches: analyticsTracker.data.topSearches || [],
              topAirports: analyticsTracker.data.topAirports || [],
              aircraftSelections: analyticsTracker.data.aircraftSelections || 0,
            },
            conversions: analyticsConversions.data.data || [],
            monetization: {
              flags: analyticsMonetization.data.flags || { ads: false, affiliates: false, sponsoredContent: false },
              topAdSlots: analyticsMonetization.data.topAdSlots || [],
              impressions: analyticsMonetization.data.impressions || 0,
              adClicks: analyticsMonetization.data.adClicks || 0,
              affiliateClicks: analyticsMonetization.data.affiliateClicks || 0,
              ctaConversions: analyticsMonetization.data.ctaConversions || 0,
              ctr: analyticsMonetization.data.ctr || 0,
              conversionRate: analyticsMonetization.data.conversionRate || 0,
            },
          });
        } catch (alertErr) {
          console.warn('Flight alert or visitor analytics unavailable:', alertErr);
        }

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

  const analyticsCards = useMemo(
    () => [
      { title: 'Visitors Today', value: analytics.summary.visitorsToday, subtitle: 'Unique visitors since midnight' },
      { title: 'Visitors This Month', value: analytics.summary.visitorsThisMonth, subtitle: 'Unique monthly audience' },
      { title: 'Page Views', value: analytics.summary.pageViews, subtitle: 'Tracked page, blog, tracker, and airport views' },
      { title: 'Unique Visitors', value: analytics.summary.uniqueVisitors, subtitle: 'All-time first-party visitors' },
      { title: 'Tracker Searches', value: analytics.summary.trackerSearches, subtitle: 'Flight tracker search events' },
      { title: 'Aircraft Selected', value: analytics.summary.aircraftSelected, subtitle: 'Map aircraft detail opens' },
      { title: 'Flight Alert Subscribers', value: analytics.summary.flightAlertSubscribers, subtitle: 'Alert subscription conversions' },
      { title: 'Booking CTA Clicks', value: analytics.summary.bookingCtaClicks, subtitle: 'Flight, hotel, and car conversion clicks' },
    ],
    [analytics.summary]
  );

  const maxVisits = Math.max(1, ...analytics.timeseries.map((item) => Number(item.visits || 0)));
  const maxPageViews = Math.max(1, ...analytics.topPages.map((item) => Number(item.views || 0)));
  const maxSearches = Math.max(1, ...analytics.tracker.topSearches.map((item) => Number(item.count || 0)));
  const maxAirports = Math.max(1, ...analytics.tracker.topAirports.map((item) => Number(item.count || 0)));
  const maxConversions = Math.max(1, ...analytics.conversions.map((item) => Number(item.count || 0)));
  const maxAdSlotClicks = Math.max(1, ...analytics.monetization.topAdSlots.map((item) => Number(item.clicks || 0)));

  const formatNumber = (value) => Number(value || 0).toLocaleString();
  const formatPercent = (value) => `${Number(value || 0).toFixed(2)}%`;

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
            <h2>Internal Analytics</h2>
            <p>First-party visitor, tracker, and conversion events collected with hashed IPs only.</p>
          </div>

          <div className="admin-stats-grid">
            {analyticsCards.map((card) => (
              <div className="admin-stat-card" key={card.title}>
                <span className="admin-stat-title">{card.title}</span>
                <strong className="admin-stat-value">{formatNumber(card.value)}</strong>
                <span className="admin-stat-subtitle">{card.subtitle}</span>
              </div>
            ))}
          </div>

          <div className="admin-analytics-grid">
            <div className="admin-analytics-panel admin-analytics-panel--wide">
              <h3>Visits Over Time</h3>
              <div className="admin-bar-chart admin-bar-chart--time">
                {analytics.timeseries.length === 0 ? (
                  <span className="admin-empty-chart">No visits tracked yet.</span>
                ) : analytics.timeseries.slice(-30).map((item) => (
                  <div className="admin-time-bar" key={item._id} title={`${item._id}: ${item.visits} visits`}>
                    <span style={{ height: `${Math.max(8, (Number(item.visits || 0) / maxVisits) * 100)}%` }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-analytics-panel">
              <h3>Top Pages</h3>
              <div className="admin-rank-list">
                {analytics.topPages.length === 0 ? <span className="admin-empty-chart">No page data yet.</span> : analytics.topPages.map((item) => (
                  <div className="admin-rank-row" key={item.path}>
                    <div>
                      <strong>{item.pageTitle || item.path}</strong>
                      <span>{item.path}</span>
                    </div>
                    <em>{formatNumber(item.views)}</em>
                    <i style={{ width: `${Math.max(6, (Number(item.views || 0) / maxPageViews) * 100)}%` }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-analytics-panel">
              <h3>Top Tracker Searches</h3>
              <div className="admin-rank-list">
                {analytics.tracker.topSearches.length === 0 ? <span className="admin-empty-chart">No tracker searches yet.</span> : analytics.tracker.topSearches.map((item) => (
                  <div className="admin-rank-row" key={item.query}>
                    <div><strong>{item.query}</strong><span>flight search</span></div>
                    <em>{formatNumber(item.count)}</em>
                    <i style={{ width: `${Math.max(6, (Number(item.count || 0) / maxSearches) * 100)}%` }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-analytics-panel">
              <h3>Top Airports</h3>
              <div className="admin-rank-list">
                {analytics.tracker.topAirports.length === 0 ? <span className="admin-empty-chart">No airport views yet.</span> : analytics.tracker.topAirports.map((item) => (
                  <div className="admin-rank-row" key={item.airportCode}>
                    <div><strong>{item.airportCode}</strong><span>airport page views</span></div>
                    <em>{formatNumber(item.count)}</em>
                    <i style={{ width: `${Math.max(6, (Number(item.count || 0) / maxAirports) * 100)}%` }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-analytics-panel">
              <h3>Conversions</h3>
              <div className="admin-rank-list">
                {analytics.conversions.length === 0 ? <span className="admin-empty-chart">No conversion events yet.</span> : analytics.conversions.map((item) => (
                  <div className="admin-rank-row" key={item.eventType}>
                    <div><strong>{String(item.eventType || '').replace(/_/g, ' ')}</strong><span>conversion event</span></div>
                    <em>{formatNumber(item.count)}</em>
                    <i style={{ width: `${Math.max(6, (Number(item.count || 0) / maxConversions) * 100)}%` }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-header">
            <h2>Flight Alerts</h2>
            <p>Email alert subscribers, active watches, recent notifications, and delivery failures.</p>
          </div>

          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <span className="admin-stat-title">Subscribers</span>
              <strong className="admin-stat-value">{flightAlerts.totalSubscribers}</strong>
              <span className="admin-stat-subtitle">Unique alert email addresses</span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-title">Active Alerts</span>
              <strong className="admin-stat-value">{flightAlerts.activeAlerts}</strong>
              <span className="admin-stat-subtitle">Flights currently being watched</span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-title">Recent Notifications</span>
              <strong className="admin-stat-value">{flightAlerts.recentNotifications.length}</strong>
              <span className="admin-stat-subtitle">Latest delivery records loaded</span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-title">Failed Notifications</span>
              <strong className="admin-stat-value">{flightAlerts.failedNotifications}</strong>
              <span className="admin-stat-subtitle">Email delivery or provider failures</span>
            </div>
          </div>

          {flightAlerts.recentNotifications.length > 0 && (
            <div className="admin-focus-box">
              <ul>
                {flightAlerts.recentNotifications.slice(0, 5).map((item, idx) => (
                  <li key={`${item.email}-${item.sentAt}-${idx}`}>
                    {(item.flightNumber || item.callsign || 'Flight')} - {item.type || 'notification'} - {item.delivered ? 'delivered' : 'failed'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="admin-section">
          <div className="admin-section-header">
            <h2>Monetization Readiness</h2>
            <p>Ad and affiliate telemetry for future campaigns, kept behind feature flags.</p>
          </div>

          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <span className="admin-stat-title">Ad Impressions</span>
              <strong className="admin-stat-value">{formatNumber(analytics.monetization.impressions)}</strong>
              <span className="admin-stat-subtitle">Tracked placeholder or ad slot views</span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-title">Ad CTR</span>
              <strong className="admin-stat-value">{formatPercent(analytics.monetization.ctr)}</strong>
              <span className="admin-stat-subtitle">Clicks divided by impressions</span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-title">Affiliate Clicks</span>
              <strong className="admin-stat-value">{formatNumber(analytics.monetization.affiliateClicks)}</strong>
              <span className="admin-stat-subtitle">Partner placeholder clicks</span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-title">Conversion Rate</span>
              <strong className="admin-stat-value">{formatPercent(analytics.monetization.conversionRate)}</strong>
              <span className="admin-stat-subtitle">CTA conversions per tracked page view</span>
            </div>
          </div>

          <div className="admin-analytics-grid">
            <div className="admin-analytics-panel">
              <h3>Feature Flags</h3>
              <div className="admin-rank-list">
                {[
                  ['ENABLE_ADS', analytics.monetization.flags.ads],
                  ['ENABLE_AFFILIATES', analytics.monetization.flags.affiliates],
                  ['ENABLE_SPONSORED_CONTENT', analytics.monetization.flags.sponsoredContent],
                ].map(([label, value]) => (
                  <div className="admin-rank-row" key={label}>
                    <div><strong>{label}</strong><span>backend monetization flag</span></div>
                    <em>{value ? 'on' : 'off'}</em>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-analytics-panel">
              <h3>Top Ad Slots</h3>
              <div className="admin-rank-list">
                {analytics.monetization.topAdSlots.length === 0 ? <span className="admin-empty-chart">No ad slot activity yet.</span> : analytics.monetization.topAdSlots.map((item) => (
                  <div className="admin-rank-row" key={item.slotId}>
                    <div>
                      <strong>{item.slotId}</strong>
                      <span>{formatNumber(item.impressions)} impressions, {formatPercent(item.ctr)} CTR</span>
                    </div>
                    <em>{formatNumber(item.clicks)}</em>
                    <i style={{ width: `${Math.max(6, (Number(item.clicks || 0) / maxAdSlotClicks) * 100)}%` }} />
                  </div>
                ))}
              </div>
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
