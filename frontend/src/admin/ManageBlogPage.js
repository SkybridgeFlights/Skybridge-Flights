import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';
import './ManageBlogPage.css';

const emptyForm = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  coverImage: '',
  featuredImage: '',
  imageAltText: '',
  language: 'en',
  translationGroup: '',
  category: 'travel',
  tags: '',
  keywords: '',
  metaTitle: '',
  metaDescription: '',
  status: 'draft',
  scheduledAt: '',
  faqText: '',
};

const languageOptions = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'Arabic' },
  { code: 'de', label: 'German' },
];

function listToText(value) {
  return Array.isArray(value) ? value.join(', ') : '';
}

function faqToText(value) {
  return Array.isArray(value)
    ? value.map((item) => `${item.question || ''} | ${item.answer || ''}`).join('\n')
    : '';
}

function textToFaq(value) {
  return String(value || '')
    .split('\n')
    .map((line) => {
      const [question, ...answer] = line.split('|');
      return { question: question?.trim(), answer: answer.join('|').trim() };
    })
    .filter((item) => item.question && item.answer);
}

function getApiErrorMessage(err, fallback) {
  const data = err?.response?.data;
  if (data?.message && data?.recommendedAction) {
    return `${data.message} Recommended action: ${data.recommendedAction}.`;
  }
  if (data?.error && Array.isArray(data?.reasons) && data.reasons.length) {
    return `${data.error} ${data.reasons.join(' ')}`;
  }
  if (data?.error && data?.details && data.details !== data.error) {
    return `${data.error}: ${data.details}`;
  }
  if (data?.error) return data.error;
  if (data?.message) return data.message;
  if (err?.message) return `${fallback} (${err.message})`;
  return fallback;
}

const AUTO_FIXABLE_QA = new Set([
  'missing_canonical',
  'missing_faq',
  'missing_schema',
  'missing_image_alt',
  'missing_meta_title',
  'missing_meta_description',
  'weak_internal_linking',
]);

const REGENERATE_QA = new Set([
  'low_quality_score',
  'article_too_short',
  'no_headings',
  'low_seo_score',
]);

function qaActionFor(issue) {
  if (AUTO_FIXABLE_QA.has(issue?.code)) return 'fix';
  if (REGENERATE_QA.has(issue?.code) && issue?.targetType === 'post') return 'regenerate';
  return 'manual';
}

function ManageBlogPage() {
  const [posts, setPosts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [usage, setUsage] = useState(null);
  const [searchConsole, setSearchConsole] = useState(null);
  const [seoQa, setSeoQa] = useState(null);
  const [brokenLinks, setBrokenLinks] = useState([]);
  const [sitemapQa, setSitemapQa] = useState(null);
  const [assets, setAssets] = useState([]);
  const [versions, setVersions] = useState([]);
  const [notifications, setNotifications] = useState({ items: [], unreadCount: 0 });
  const [notificationSeverity, setNotificationSeverity] = useState('all');
  const [health, setHealth] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [diffVersion, setDiffVersion] = useState(null);
  const [weakSeoPages, setWeakSeoPages] = useState([]);
  const [refreshCandidates, setRefreshCandidates] = useState([]);
  const [seoPages, setSeoPages] = useState([]);
  const [trends, setTrends] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [issueFilter, setIssueFilter] = useState('all');
  const [aiTopic, setAiTopic] = useState('');
  const [aiLanguage, setAiLanguage] = useState('en');
  const [aiMultilingual, setAiMultilingual] = useState(true);
  const [seoPageForm, setSeoPageForm] = useState({ origin: '', destination: '', service: 'flights', language: 'en' });
  const [assetForm, setAssetForm] = useState({ title: '', url: '', altText: '', provider: 'external' });
  const [previewPost, setPreviewPost] = useState(null);
  const [previewSeoPage, setPreviewSeoPage] = useState(null);

  const token = useMemo(() => localStorage.getItem('staffToken') || localStorage.getItem('token') || '', []);
  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null') || {};
    } catch (_) {
      return {};
    }
  }, []);
  const isAdmin = String(currentUser?.role || '').toLowerCase() === 'admin' || currentUser?.isAdmin === true;
  const permissions = currentUser?.permissions || {};
  const canManageBlog = isAdmin || !!permissions.manageBlog;
  const canPublishBlog = isAdmin || !!permissions.publishBlog;
  const defaultSettings = useMemo(() => ({
    enabledLanguages: ['en', 'ar', 'de'],
    minimumSeoScore: 70,
    minimumQualityScore: 70,
    maxInternalLinksPerArticle: 5,
    autoPublishMode: 'draft-only',
    flightTrackerEnabled: true,
    flightTrackerCacheDurationMs: 60000,
    flightTrackerMaxAircraftReturned: 75,
    flightTrackerDefaultRegion: 'global',
    flightTrackerEnabledRegions: ['global', 'germany', 'europe', 'turkey', 'middle-east'],
    flightTrackerShowCta: true,
    flightTrackerPollingIntervalMs: 60000,
    flightTrackerCommercialProvider: 'none',
  }), []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError('');
      const optionalGet = (url, fallback) =>
        axios.get(url, { headers: authHeaders }).catch((err) => {
          if (err.response?.status === 403 || err.response?.status === 401) return { data: fallback };
          throw err;
        });
      const [postsRes, settingsRes, analyticsRes, jobsRes, usageRes, qaRes, brokenRes, sitemapRes, assetsRes, notificationsRes, healthRes, consoleRes, weakSeoRes, refreshRes, seoPagesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/blog/admin/all`, { headers: authHeaders }),
        isAdmin ? axios.get(`${API_BASE_URL}/api/blog/admin/settings`, { headers: authHeaders }) : Promise.resolve({ data: defaultSettings }),
        axios.get(`${API_BASE_URL}/api/blog/admin/analytics`, { headers: authHeaders }),
        axios.get(`${API_BASE_URL}/api/blog/admin/jobs`, { headers: authHeaders }),
        axios.get(`${API_BASE_URL}/api/blog/admin/usage`, { headers: authHeaders }),
        axios.get(`${API_BASE_URL}/api/blog/admin/seo-qa?issue=${encodeURIComponent(issueFilter)}`, { headers: authHeaders }),
        axios.get(`${API_BASE_URL}/api/blog/admin/broken-links`, { headers: authHeaders }),
        axios.get(`${API_BASE_URL}/api/blog/admin/sitemap-qa`, { headers: authHeaders }),
        axios.get(`${API_BASE_URL}/api/blog/admin/assets`, { headers: authHeaders }),
        axios.get(`${API_BASE_URL}/api/blog/admin/notifications?severity=${encodeURIComponent(notificationSeverity)}`, { headers: authHeaders }),
        axios.get(`${API_BASE_URL}/api/blog/admin/health`, { headers: authHeaders }),
        axios.get(`${API_BASE_URL}/api/blog/admin/search-console`, { headers: authHeaders }),
        axios.get(`${API_BASE_URL}/api/blog/admin/weak-seo`, { headers: authHeaders }),
        axios.get(`${API_BASE_URL}/api/blog/admin/refresh-candidates`, { headers: authHeaders }),
        optionalGet(`${API_BASE_URL}/api/blog/admin/seo-pages`, []),
      ]);
      setPosts(Array.isArray(postsRes.data) ? postsRes.data : []);
      setSettings(settingsRes.data || null);
      setAnalytics(analyticsRes.data || null);
      setJobs(Array.isArray(jobsRes.data) ? jobsRes.data : []);
      setUsage(usageRes.data || null);
      setSeoQa(qaRes.data || null);
      setBrokenLinks(Array.isArray(brokenRes.data) ? brokenRes.data : []);
      setSitemapQa(sitemapRes.data || null);
      setAssets(Array.isArray(assetsRes.data) ? assetsRes.data : []);
      setNotifications(notificationsRes.data || { items: [], unreadCount: 0 });
      setHealth(healthRes.data || null);
      setSearchConsole(consoleRes.data || null);
      setWeakSeoPages(Array.isArray(weakSeoRes.data) ? weakSeoRes.data : []);
      setRefreshCandidates(Array.isArray(refreshRes.data) ? refreshRes.data : []);
      setSeoPages(Array.isArray(seoPagesRes.data) ? seoPagesRes.data : []);
    } catch (err) {
      console.error('Failed to fetch blog manager data:', err);
      setError(getApiErrorMessage(err, 'Failed to load blog manager.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueFilter, notificationSeverity]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleEdit = (post) => {
    setEditingId(post._id);
    setForm({
      title: post.title || '',
      slug: post.slug || '',
      excerpt: post.excerpt || '',
      content: post.content || '',
      coverImage: post.coverImage || '',
      featuredImage: post.featuredImage || '',
      imageAltText: post.imageAltText || '',
      language: post.language || 'en',
      translationGroup: post.translationGroup || '',
      category: post.category || 'travel',
      tags: listToText(post.tags),
      keywords: listToText(post.keywords),
      metaTitle: post.metaTitle || post.seoTitle || '',
      metaDescription: post.metaDescription || post.seoDescription || '',
      status: post.status || 'draft',
      scheduledAt: post.scheduledAt ? new Date(post.scheduledAt).toISOString().slice(0, 16) : '',
      faqText: faqToText(post.faq),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const payloadFromForm = () => ({
    ...form,
    tags: String(form.tags || '').split(',').map((item) => item.trim()).filter(Boolean),
    keywords: String(form.keywords || '').split(',').map((item) => item.trim()).filter(Boolean),
    faq: textToFaq(form.faqText),
    scheduledAt: form.scheduledAt || null,
    cta: { label: 'Compare travel options with Skybridge Flights', url: '/flights', type: 'search' },
    internalLinks: [
      { label: 'Search flights', url: '/flights' },
      { label: 'Contact us', url: '/contact' },
      { label: 'Travel blog', url: '/blog' },
    ],
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const payload = payloadFromForm();
      if (editingId) {
        await axios.put(`${API_BASE_URL}/api/blog/${editingId}`, payload, { headers: authHeaders });
        setSuccess('Article updated successfully.');
      } else {
        await axios.post(`${API_BASE_URL}/api/blog`, payload, { headers: authHeaders });
        setSuccess('Article created successfully.');
      }
      resetForm();
      fetchAll();
    } catch (err) {
      console.error('Failed to save blog post:', err);
      setError(getApiErrorMessage(err, 'Failed to save article.'));
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (label, fn) => {
    try {
      setActionLoading(label);
      setError('');
      setSuccess('');
      await fn();
      setSuccess(`${label} completed.`);
      fetchAll();
    } catch (err) {
      console.error(`${label} failed:`, getApiErrorMessage(err, `${label} failed.`));
      setError(getApiErrorMessage(err, `${label} failed.`));
    } finally {
      setActionLoading('');
    }
  };

  const saveSettings = () =>
    runAction('Settings update', async () => {
      await axios.put(`${API_BASE_URL}/api/blog/admin/settings`, settings, { headers: authHeaders });
    });

  const loadVersions = (targetType, targetId) =>
    runAction('Load versions', async () => {
      const { data } = await axios.get(`${API_BASE_URL}/api/blog/admin/versions/${targetType}/${targetId}`, { headers: authHeaders });
      setVersions(Array.isArray(data) ? data : []);
    });

  const createAsset = () =>
    runAction('Create asset', async () => {
      await axios.post(`${API_BASE_URL}/api/blog/admin/assets`, assetForm, { headers: authHeaders });
      setAssetForm({ title: '', url: '', altText: '', provider: 'external' });
    });

  const runProductionTests = () =>
    runAction('Production tests', async () => {
      const { data } = await axios.post(`${API_BASE_URL}/api/blog/admin/tests/run`, {}, { headers: authHeaders });
      setTestResults(data);
    });

  const markNotificationRead = (id) =>
    runAction('Mark notification read', async () => {
      await axios.post(`${API_BASE_URL}/api/blog/admin/notifications/${id}/read`, {}, { headers: authHeaders });
    });

  const runTrends = () =>
    runAction('Trend research', async () => {
      const { data } = await axios.post(`${API_BASE_URL}/api/blog/admin/trends/run`, {}, { headers: authHeaders });
      setTrends(data?.topics || []);
    });

  const generateAi = () =>
    runAction('AI article generation', async () => {
      await axios.post(
        `${API_BASE_URL}/api/blog/admin/generate`,
        {
          topic: aiTopic || undefined,
          language: aiLanguage,
          multilingual: aiMultilingual,
          languages: settings?.enabledLanguages || ['en', 'ar', 'de'],
        },
        { headers: authHeaders }
      );
    });

  const queueAi = () =>
    runAction('Queue article generation', async () => {
      await axios.post(
        `${API_BASE_URL}/api/blog/admin/queue/generate`,
        {
          topic: aiTopic || undefined,
          language: aiLanguage,
          multilingual: aiMultilingual,
          languages: settings?.enabledLanguages || ['en', 'ar', 'de'],
        },
        { headers: authHeaders }
      );
    });

  const createSeoPage = () =>
    runAction('Programmatic SEO page', async () => {
      await axios.post(`${API_BASE_URL}/api/blog/admin/seo-pages`, seoPageForm, { headers: authHeaders });
      setSeoPageForm({ origin: '', destination: '', service: 'flights', language: 'en' });
    });

  const updateSeoPage = (page, update, label = 'SEO page update') =>
    runAction(label, async () => {
      await axios.put(`${API_BASE_URL}/api/blog/admin/seo-pages/${page._id}`, update, { headers: authHeaders });
    });

  const savePreviewSeoPage = () => {
    if (!previewSeoPage) return;
    updateSeoPage(previewSeoPage, previewSeoPage, 'Save SEO page');
    setPreviewSeoPage(null);
  };

  const handleQaIssueAction = (issue) => {
    const action = qaActionFor(issue);
    if (action === 'fix') {
      return runAction('Fix QA item', () => axios.post(`${API_BASE_URL}/api/blog/admin/seo-qa/fix`, issue, { headers: authHeaders }));
    }
    if (action === 'regenerate') {
      return runAction('Regenerate draft suggestion', () =>
        axios.post(
          `${API_BASE_URL}/api/blog/admin/${issue.targetId}/refresh-suggestion`,
          { reason: `SEO QA: ${issue.message || issue.code}` },
          { headers: authHeaders }
        )
      );
    }
    setError(`Manual review required: ${issue.message || issue.code}`);
    return null;
  };

  const formatDate = (value) => {
    if (!value) return '-';
    try {
      return new Date(value).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return value;
    }
  };

  const filteredPosts = posts.filter((post) => {
    if (statusFilter !== 'all' && post.status !== statusFilter) return false;
    if (languageFilter !== 'all' && post.language !== languageFilter) return false;
    return true;
  });

  const totals = analytics?.totals || {};
  const dailyUsage = usage?.daily || {};
  const monthlyUsage = usage?.monthly || {};
  const viewsOverTime = Object.entries(analytics?.viewsOverTime || {}).sort(([a], [b]) => a.localeCompare(b)).slice(-10);
  const topLanguages = Object.entries(analytics?.languageViews || {}).sort((a, b) => b[1] - a[1]);
  const topReferrers = Object.entries(analytics?.referrers || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const conversionRate = totals.views ? ((totals.conversions || 0) / totals.views) * 100 : 0;
  const validationWarnings = (post) => [
    !post?.metaTitle && 'Missing meta title',
    !post?.metaDescription && 'Missing meta description',
    !post?.imageAltText && 'Missing image alt text',
    !(post?.faq || []).length && 'Missing FAQ',
    !(post?.internalLinks || []).length && 'Missing internal links',
    (post?.linkCheck?.brokenCount || 0) > 0 && 'Broken internal links',
    (post?.seoScore || 0) < (settings?.minimumSeoScore || 70) && 'Low SEO score',
  ].filter(Boolean);
  const diffFields = (version) => {
    if (!version?.snapshot) return [];
    const current = posts.find((p) => p._id === version.targetId) || seoPages.find((p) => p._id === version.targetId) || {};
    return ['title', 'slug', 'metaTitle', 'metaDescription', 'excerpt', 'content', 'status']
      .map((field) => ({ field, oldValue: version.snapshot[field] || '', newValue: current[field] || '' }))
      .filter((item) => String(item.oldValue) !== String(item.newValue));
  };
  const wordDiff = (oldValue, newValue) => {
    const oldWords = String(oldValue || '').split(/(\s+)/);
    const newWords = String(newValue || '').split(/(\s+)/);
    const oldSet = new Set(oldWords.map((word) => word.trim()).filter(Boolean));
    const newSet = new Set(newWords.map((word) => word.trim()).filter(Boolean));
    return {
      oldParts: oldWords.map((word, index) => ({ text: word, changed: word.trim() && !newSet.has(word.trim()), index })),
      newParts: newWords.map((word, index) => ({ text: word, changed: word.trim() && !oldSet.has(word.trim()), index })),
    };
  };

  return (
    <div className="manage-blog-page">
      <div className="manage-blog-header">
        <h2>Skybridge AI Blog Auto Publisher</h2>
        <p>Generate, review, publish, and optimize multilingual travel articles.</p>
      </div>

      {error ? <div className="blog-alert error">{error}</div> : null}
      {success ? <div className="blog-alert success">{success}</div> : null}

      <section className="blog-ai-grid">
        <div className="blog-list-card">
          <div className="blog-list-top">
            <h3>Blog System Health</h3>
            {isAdmin ? <button type="button" className="secondary-btn small" onClick={runProductionTests}>Run Production Tests</button> : null}
          </div>
            <div className="blog-metric-grid">
              <div><span>Scheduler</span><strong>{health?.scheduler?.scheduledQaEnabled ? 'QA On' : 'QA Off'}</strong></div>
              <div><span>Queue failed</span><strong>{health?.queue?.failed || 0}</strong></div>
              <div><span>Published</span><strong>{health?.totals?.publishedPosts || 0}</strong></div>
              <div><span>Drafts</span><strong>{health?.totals?.draftPosts || 0}</strong></div>
              <div><span>SEO pages</span><strong>{health?.totals?.seoLandingPages || 0}</strong></div>
              <div><span>Monthly AI</span><strong>${Number(health?.totals?.monthlyAiCost || 0).toFixed(2)}</strong></div>
              <div><span>Search Console</span><strong>{health?.searchConsole?.configured ? 'Ready' : 'Off'}</strong></div>
              <div><span>Cloudinary</span><strong>{health?.cloudinary?.configured ? 'Ready' : 'Off'}</strong></div>
              <div><span>Tracker</span><strong>{health?.flightTracker?.enabled ? 'On' : 'Off'}</strong></div>
              <div><span>Tracker auth</span><strong>{health?.flightTracker?.authMode || 'anonymous'}</strong></div>
              <div><span>Tracker cache</span><strong>{health?.flightTracker?.cacheAgeMs != null ? `${Math.round(health.flightTracker.cacheAgeMs / 1000)}s` : 'N/A'}</strong></div>
              <div><span>Tracker fetch</span><strong>{health?.flightTracker?.lastSuccessfulFetchAt ? new Date(health.flightTracker.lastSuccessfulFetchAt).toLocaleString() : 'N/A'}</strong></div>
              <div><span>Tracker error</span><strong>{health?.flightTracker?.lastError ? 'Issue' : 'OK'}</strong></div>
            </div>
          {testResults ? (
            <div className="mini-table">
              {testResults.tests?.map((test) => (
                <div key={test.name} className={`job-row ${test.passed ? 'completed' : 'failed'}`}>
                  <strong>{test.name}</strong>
                  <span>{test.passed ? 'Pass' : 'Fail'}</span>
                  <small>{test.detail}</small>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="blog-list-card">
          <div className="blog-list-top">
            <h3>Notifications ({notifications.unreadCount || 0})</h3>
            <select value={notificationSeverity} onChange={(e) => setNotificationSeverity(e.target.value)}>
              <option value="all">All severities</option>
              <option value="error">Errors</option>
              <option value="warning">Warnings</option>
              <option value="info">Info</option>
            </select>
          </div>
          <div className="mini-table">
            {(notifications.items || []).slice(0, 8).map((item) => (
              <div key={item._id} className={`job-row ${item.severity === 'error' ? 'failed' : item.severity === 'warning' ? 'running' : ''}`}>
                <strong>{item.title}</strong>
                <span>{item.read ? 'Read' : 'Unread'}</span>
                <button type="button" className="secondary-btn small" onClick={() => markNotificationRead(item._id)}>Mark Read</button>
                <small>{item.message}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="blog-ai-grid">
        <div className="blog-list-card">
          <div className="blog-list-top">
            <h3>AI Dashboard</h3>
            {isAdmin ? <button type="button" className="secondary-btn small" onClick={() => runAction('Auto publisher', () => axios.post(`${API_BASE_URL}/api/blog/admin/auto-publisher/run`, { topic: aiTopic || undefined }, { headers: authHeaders }))}>
              Run Auto Publisher
            </button> : null}
          </div>
          <div className="blog-metric-grid">
            <div><span>Total views</span><strong>{totals.views || 0}</strong></div>
            <div><span>Unique visitors</span><strong>{totals.uniqueVisitors || 0}</strong></div>
            <div><span>CTA clicks</span><strong>{totals.ctaClicks || 0}</strong></div>
            <div><span>Conversion rate</span><strong>{conversionRate.toFixed(1)}%</strong></div>
          </div>
          <div className="analytics-bars">
            {viewsOverTime.map(([date, value]) => (
              <div key={date}>
                <span>{date.slice(5)}</span>
                <i style={{ width: `${Math.min(100, value * 8)}%` }} />
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="blog-ai-controls">
            <input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="Optional topic, or leave empty for best trend" />
            <select value={aiLanguage} onChange={(e) => setAiLanguage(e.target.value)}>
              {languageOptions.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
            </select>
            <label className="blog-check"><input type="checkbox" checked={aiMultilingual} onChange={(e) => setAiMultilingual(e.target.checked)} /> Multilingual</label>
            <button type="button" className="primary-btn" onClick={generateAi} disabled={!!actionLoading}>Generate AI Article</button>
            <button type="button" className="secondary-btn" onClick={queueAi} disabled={!!actionLoading}>Queue Generation</button>
            <button type="button" className="secondary-btn" onClick={runTrends} disabled={!!actionLoading}>Run Trend Research</button>
          </div>
          {trends.length > 0 ? (
            <div className="trend-list">
              {trends.slice(0, 6).map((item) => (
                <button type="button" key={item.topicKey} onClick={() => setAiTopic(item.topic)}>
                  <strong>{item.score}</strong> {item.topic}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {isAdmin ? <div className="blog-list-card">
          <div className="blog-list-top">
            <h3>AI Settings</h3>
            <button type="button" className="primary-btn small" onClick={saveSettings} disabled={!settings || !!actionLoading}>Save Settings</button>
          </div>
          {settings ? (
            <div className="settings-grid">
              <label><span>Auto publishing</span><input type="checkbox" checked={!!settings.autoPublishEnabled} onChange={(e) => setSettings({ ...settings, autoPublishEnabled: e.target.checked })} /></label>
              <label><span>Auto-publish mode</span><select value={settings.autoPublishMode || 'draft-only'} onChange={(e) => setSettings({ ...settings, autoPublishMode: e.target.value })}><option value="off">Off</option><option value="draft-only">Draft only</option><option value="publish-if-safe">Publish if safe</option></select></label>
              <label><span>Publishing time</span><input value={settings.publishingTime || ''} onChange={(e) => setSettings({ ...settings, publishingTime: e.target.value })} /></label>
              <label><span>Timezone</span><input value={settings.timezone || ''} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} /></label>
              <label><span>Articles per day</span><input type="number" value={settings.articlesPerDay || 1} onChange={(e) => setSettings({ ...settings, articlesPerDay: Number(e.target.value) })} /></label>
              <label><span>Max per day</span><input type="number" value={settings.maxArticlesPerDay || 1} onChange={(e) => setSettings({ ...settings, maxArticlesPerDay: Number(e.target.value) })} /></label>
              <label><span>Min SEO score</span><input type="number" value={settings.minimumSeoScore || 70} onChange={(e) => setSettings({ ...settings, minimumSeoScore: Number(e.target.value) })} /></label>
              <label><span>Min quality score</span><input type="number" value={settings.minimumQualityScore || 70} onChange={(e) => setSettings({ ...settings, minimumQualityScore: Number(e.target.value) })} /></label>
              <label><span>Max concurrent AI jobs</span><input type="number" value={settings.maxConcurrentAiJobs || 1} onChange={(e) => setSettings({ ...settings, maxConcurrentAiJobs: Number(e.target.value) })} /></label>
              <label><span>Max job retries</span><input type="number" value={settings.maxJobRetries || 2} onChange={(e) => setSettings({ ...settings, maxJobRetries: Number(e.target.value) })} /></label>
              <label><span>Daily generation limit</span><input type="number" value={settings.dailyGenerationLimit || 0} onChange={(e) => setSettings({ ...settings, dailyGenerationLimit: Number(e.target.value) })} /></label>
              <label><span>Monthly generation limit</span><input type="number" value={settings.monthlyGenerationLimit || 0} onChange={(e) => setSettings({ ...settings, monthlyGenerationLimit: Number(e.target.value) })} /></label>
              <label><span>Daily cost limit</span><input type="number" value={settings.dailyCostLimit || 0} onChange={(e) => setSettings({ ...settings, dailyCostLimit: Number(e.target.value) })} /></label>
              <label><span>Monthly cost limit</span><input type="number" value={settings.monthlyCostLimit || 0} onChange={(e) => setSettings({ ...settings, monthlyCostLimit: Number(e.target.value) })} /></label>
              <label><span>Duplicate threshold</span><input type="number" step="0.01" value={settings.semanticSimilarityThreshold || 0.9} onChange={(e) => setSettings({ ...settings, semanticSimilarityThreshold: Number(e.target.value) })} /></label>
              <label><span>Publish duplicate threshold</span><input type="number" step="0.01" value={settings.publishSimilarityThreshold || 0.94} onChange={(e) => setSettings({ ...settings, publishSimilarityThreshold: Number(e.target.value) })} /></label>
              <label><span>Topic retry attempts</span><input type="number" min="1" max="10" value={settings.topicRetryAttempts || 5} onChange={(e) => setSettings({ ...settings, topicRetryAttempts: Number(e.target.value) })} /></label>
              <label><span>Max internal links</span><input type="number" value={settings.maxInternalLinksPerArticle || 5} onChange={(e) => setSettings({ ...settings, maxInternalLinksPerArticle: Number(e.target.value) })} /></label>
              <label><span>Fallback research</span><input type="checkbox" checked={settings.fallbackResearchEnabled !== false} onChange={(e) => setSettings({ ...settings, fallbackResearchEnabled: e.target.checked })} /></label>
              <label><span>Require internal links</span><input type="checkbox" checked={!!settings.requireInternalLinks} onChange={(e) => setSettings({ ...settings, requireInternalLinks: e.target.checked })} /></label>
              <label><span>Require valid schema</span><input type="checkbox" checked={!!settings.requireValidSchema} onChange={(e) => setSettings({ ...settings, requireValidSchema: e.target.checked })} /></label>
              <label><span>Require image alt</span><input type="checkbox" checked={!!settings.requireImageAlt} onChange={(e) => setSettings({ ...settings, requireImageAlt: e.target.checked })} /></label>
              <label><span>Require FAQ</span><input type="checkbox" checked={!!settings.requireFaq} onChange={(e) => setSettings({ ...settings, requireFaq: e.target.checked })} /></label>
              <label><span>Require CTA</span><input type="checkbox" checked={!!settings.requireCta} onChange={(e) => setSettings({ ...settings, requireCta: e.target.checked })} /></label>
              <label><span>No broken links</span><input type="checkbox" checked={!!settings.requireNoBrokenInternalLinks} onChange={(e) => setSettings({ ...settings, requireNoBrokenInternalLinks: e.target.checked })} /></label>
              <label><span>No duplicate warning</span><input type="checkbox" checked={!!settings.requireNoDuplicateSimilarityWarning} onChange={(e) => setSettings({ ...settings, requireNoDuplicateSimilarityWarning: e.target.checked })} /></label>
              <label><span>Allow duplicate drafts</span><input type="checkbox" checked={!!settings.allowDuplicateDrafts} onChange={(e) => setSettings({ ...settings, allowDuplicateDrafts: e.target.checked })} /></label>
              <label><span>Auto-apply CTR SEO</span><input type="checkbox" checked={!!settings.autoApplyCtrOptimizations} onChange={(e) => setSettings({ ...settings, autoApplyCtrOptimizations: e.target.checked })} /></label>
              <label><span>Image provider</span><input value={settings.imageProvider || ''} onChange={(e) => setSettings({ ...settings, imageProvider: e.target.value })} /></label>
              <label><span>Refresh after days</span><input type="number" value={settings.contentRefreshAfterDays || 180} onChange={(e) => setSettings({ ...settings, contentRefreshAfterDays: Number(e.target.value) })} /></label>
              <label><span>Live tracker enabled</span><input type="checkbox" checked={settings.flightTrackerEnabled !== false} onChange={(e) => setSettings({ ...settings, flightTrackerEnabled: e.target.checked })} /></label>
              <label><span>Tracker cache ms</span><input type="number" value={settings.flightTrackerCacheDurationMs || 60000} onChange={(e) => setSettings({ ...settings, flightTrackerCacheDurationMs: Number(e.target.value) })} /></label>
              <label><span>Max aircraft</span><input type="number" value={settings.flightTrackerMaxAircraftReturned || 75} onChange={(e) => setSettings({ ...settings, flightTrackerMaxAircraftReturned: Number(e.target.value) })} /></label>
              <label><span>Default region</span><select value={settings.flightTrackerDefaultRegion || 'global'} onChange={(e) => setSettings({ ...settings, flightTrackerDefaultRegion: e.target.value })}><option value="global">Worldwide</option><option value="germany">Germany</option><option value="europe">Europe</option><option value="turkey">Turkey</option><option value="middle-east">Middle East</option></select></label>
              <label><span>Enabled regions</span><input value={(settings.flightTrackerEnabledRegions || []).join(', ')} onChange={(e) => setSettings({ ...settings, flightTrackerEnabledRegions: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></label>
              <label><span>Commercial provider</span><select value={settings.flightTrackerCommercialProvider || 'none'} onChange={(e) => setSettings({ ...settings, flightTrackerCommercialProvider: e.target.value })}><option value="none">None</option><option value="aviationstack">Aviationstack</option><option value="flightaware">FlightAware</option></select></label>
              <label><span>Show CTA</span><input type="checkbox" checked={settings.flightTrackerShowCta !== false} onChange={(e) => setSettings({ ...settings, flightTrackerShowCta: e.target.checked })} /></label>
              <label><span>Polling interval ms</span><input type="number" value={settings.flightTrackerPollingIntervalMs || 60000} onChange={(e) => setSettings({ ...settings, flightTrackerPollingIntervalMs: Number(e.target.value) })} /></label>
              <label><span>Scheduled QA</span><input type="checkbox" checked={!!settings.scheduledQaEnabled} onChange={(e) => setSettings({ ...settings, scheduledQaEnabled: e.target.checked })} /></label>
              <label><span>QA time</span><input value={settings.qaScheduleTime || '08:00'} onChange={(e) => setSettings({ ...settings, qaScheduleTime: e.target.value })} /></label>
              <label><span>QA frequency</span><select value={settings.qaFrequency || 'daily'} onChange={(e) => setSettings({ ...settings, qaFrequency: e.target.value })}><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label>
              <label><span>Notify on issues</span><input type="checkbox" checked={!!settings.notifyAdminOnIssues} onChange={(e) => setSettings({ ...settings, notifyAdminOnIssues: e.target.checked })} /></label>
              <label><span>Email alerts</span><input type="checkbox" checked={!!settings.emailNotificationsEnabled} onChange={(e) => setSettings({ ...settings, emailNotificationsEnabled: e.target.checked })} /></label>
              <label><span>WhatsApp alerts</span><input type="checkbox" checked={!!settings.whatsappNotificationsEnabled} onChange={(e) => setSettings({ ...settings, whatsappNotificationsEnabled: e.target.checked })} /></label>
              <label><span>Alert severity</span><select value={settings.notificationSeverityThreshold || 'error'} onChange={(e) => setSettings({ ...settings, notificationSeverityThreshold: e.target.value })}><option value="info">Info</option><option value="warning">Warning</option><option value="error">Error</option></select></label>
              <label><span>Quiet hours</span><input type="checkbox" checked={!!settings.notificationQuietHours?.enabled} onChange={(e) => setSettings({ ...settings, notificationQuietHours: { ...(settings.notificationQuietHours || {}), enabled: e.target.checked } })} /></label>
              <label><span>Quiet start</span><input value={settings.notificationQuietHours?.start || '22:00'} onChange={(e) => setSettings({ ...settings, notificationQuietHours: { ...(settings.notificationQuietHours || {}), start: e.target.value } })} /></label>
              <label><span>Quiet end</span><input value={settings.notificationQuietHours?.end || '07:00'} onChange={(e) => setSettings({ ...settings, notificationQuietHours: { ...(settings.notificationQuietHours || {}), end: e.target.value } })} /></label>
              <label className="full"><span>Enabled languages</span><input value={(settings.enabledLanguages || []).join(', ')} onChange={(e) => setSettings({ ...settings, enabledLanguages: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></label>
              <label className="full"><span>Email recipients</span><input value={(settings.notificationRecipients || []).join(', ')} onChange={(e) => setSettings({ ...settings, notificationRecipients: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></label>
              <label className="full"><span>WhatsApp recipients</span><input value={(settings.whatsappNotificationRecipients || []).join(', ')} onChange={(e) => setSettings({ ...settings, whatsappNotificationRecipients: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></label>
              <label className="full"><span>Forbidden topics</span><input value={(settings.forbiddenTopics || []).join(', ')} onChange={(e) => setSettings({ ...settings, forbiddenTopics: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></label>
              <label className="full"><span>Trend seed keywords</span><textarea rows={3} value={(settings.trendSeedKeywords || []).join('\n')} onChange={(e) => setSettings({ ...settings, trendSeedKeywords: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} /></label>
            </div>
          ) : <p className="blog-list-state">Loading settings...</p>}
        </div> : null}
      </section>

      <section className="blog-ai-grid">
        <div className="blog-list-card">
          <div className="blog-list-top">
            <h3>SEO QA Dashboard</h3>
            <select value={issueFilter} onChange={(e) => setIssueFilter(e.target.value)}>
              <option value="all">All issues</option>
              <option value="missing_meta_title">Missing meta title</option>
              <option value="missing_meta_description">Missing meta description</option>
              <option value="missing_canonical">Missing canonical</option>
              <option value="missing_faq">Missing FAQ</option>
              <option value="missing_schema">Missing schema</option>
              <option value="missing_image_alt">Missing image alt</option>
              <option value="low_seo_score">Low SEO score</option>
              <option value="broken_internal_links">Broken links</option>
            </select>
          </div>
          <div className="blog-metric-grid">
            <div><span>Issues</span><strong>{seoQa?.totals?.issues || 0}</strong></div>
            <div><span>Errors</span><strong>{seoQa?.totals?.errors || 0}</strong></div>
            <div><span>Warnings</span><strong>{seoQa?.totals?.warnings || 0}</strong></div>
            <div><span>Blog sitemap URLs</span><strong>{sitemapQa?.blogUrls || 0}</strong></div>
          </div>
          <div className="mini-table">
            {(seoQa?.issues || []).slice(0, 10).map((issue, index) => (
              <div key={`${issue.targetId}-${issue.code}-${index}`} className={`job-row ${issue.severity === 'error' ? 'failed' : ''}`}>
                <strong>{issue.title}</strong>
                <span>{issue.message}</span>
                {qaActionFor(issue) === 'manual' ? (
                  <span className="muted">Manual Review</span>
                ) : (
                  <button type="button" className="secondary-btn small" onClick={() => handleQaIssueAction(issue)}>
                    {qaActionFor(issue) === 'regenerate' ? 'Regenerate' : 'Fix'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="blog-list-card">
          <div className="blog-list-top">
            <h3>Broken Links & Sitemap QA</h3>
            <button type="button" className="secondary-btn small" onClick={() => runAction('Broken link check', () => axios.post(`${API_BASE_URL}/api/blog/admin/broken-links/run`, {}, { headers: authHeaders }))}>Run Broken Link Check</button>
            {isAdmin ? <button type="button" className="secondary-btn small" onClick={() => runAction('Run QA now', () => axios.post(`${API_BASE_URL}/api/blog/admin/qa/run`, {}, { headers: authHeaders }))}>Run QA Now</button> : null}
          </div>
          <div className="blog-metric-grid">
            <div><span>SEO URLs</span><strong>{sitemapQa?.seoLandingUrls || 0}</strong></div>
            <div><span>Missing blog URLs</span><strong>{sitemapQa?.missingPublishedBlogUrls?.length || 0}</strong></div>
            <div><span>Missing SEO URLs</span><strong>{sitemapQa?.missingPublishedSeoUrls?.length || 0}</strong></div>
            <div><span>Checked items</span><strong>{brokenLinks.length}</strong></div>
          </div>
          <div className="mini-table">
            {brokenLinks.filter((item) => (item.linkCheck?.brokenCount || 0) > 0 || (item.linkCheck?.suspectCount || 0) > 0).slice(0, 8).map((item) => (
              <div key={`${item.type}-${item.id}`} className="job-row">
                <strong>{item.title}</strong>
                <span>{item.linkCheck?.brokenCount || 0} broken / {item.linkCheck?.suspectCount || 0} suspect</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="blog-list-card">
        <div className="blog-list-top"><h3>Asset Library</h3></div>
        <div className="blog-ai-controls seo-page-controls">
          <input value={assetForm.title} onChange={(e) => setAssetForm({ ...assetForm, title: e.target.value })} placeholder="Asset title" />
          <input value={assetForm.url} onChange={(e) => setAssetForm({ ...assetForm, url: e.target.value })} placeholder="Image URL" />
          <input value={assetForm.altText} onChange={(e) => setAssetForm({ ...assetForm, altText: e.target.value })} placeholder="Alt text" />
          <input value={assetForm.provider} onChange={(e) => setAssetForm({ ...assetForm, provider: e.target.value })} placeholder="Provider" />
          <button type="button" className="primary-btn" onClick={createAsset}>Add Asset</button>
        </div>
        <div className="asset-grid">
          {assets.slice(0, 8).map((asset) => (
            <button type="button" key={asset._id} onClick={() => setForm((prev) => ({ ...prev, featuredImage: asset.url, imageAltText: asset.altText || prev.imageAltText }))}>
              <img src={asset.url} alt={asset.altText || asset.title} />
              <span>{asset.title || asset.provider}</span>
              <small>{asset.provider} {asset.publicId ? `- ${asset.publicId}` : ''}</small>
            </button>
          ))}
        </div>
      </div>

      <section className="blog-ai-grid">
        <div className="blog-list-card">
          <div className="blog-list-top"><h3>Queue & Cost Protection</h3></div>
          <div className="blog-metric-grid">
            <div><span>Daily articles</span><strong>{dailyUsage.articlesGenerated || 0}</strong></div>
            <div><span>Daily cost</span><strong>${Number(dailyUsage.estimatedCost || 0).toFixed(2)}</strong></div>
            <div><span>Monthly articles</span><strong>{monthlyUsage.articlesGenerated || 0}</strong></div>
            <div><span>Monthly cost</span><strong>${Number(monthlyUsage.estimatedCost || 0).toFixed(2)}</strong></div>
          </div>
          <div className="mini-table">
            {jobs.slice(0, 8).map((job) => (
              <div key={job._id} className={`job-row ${job.status}`}>
                <strong>{job.type}</strong>
                <span>{job.status}</span>
                <span>attempts {job.attempts || 0}</span>
                <small>{job.error || job.logs?.[job.logs.length - 1]?.message || 'Queued'}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="blog-list-card">
          <div className="blog-list-top">
            <h3>Search Console & CTR</h3>
            {isAdmin ? <button type="button" className="secondary-btn small" onClick={() => runAction('Search Console sync', () => axios.post(`${API_BASE_URL}/api/blog/admin/search-console/sync`, {}, { headers: authHeaders }))}>
              Sync Search Console
            </button> : null}
          </div>
          <div className="blog-metric-grid">
            <div><span>Configured</span><strong>{searchConsole?.configured ? 'Yes' : 'No'}</strong></div>
            <div><span>Impressions</span><strong>{searchConsole?.impressions || 0}</strong></div>
            <div><span>Clicks</span><strong>{searchConsole?.clicks || 0}</strong></div>
            <div><span>CTR</span><strong>{((searchConsole?.ctr || 0) * 100).toFixed(1)}%</strong></div>
          </div>
          <div className="mini-table">
            {weakSeoPages.slice(0, 6).map((post) => (
              <div key={post._id} className="job-row">
                <strong>{post.title}</strong>
                <span>{post.weakReasons?.join(', ')}</span>
                <button type="button" className="secondary-btn small" onClick={() => runAction('Regenerate meta', () => axios.post(`${API_BASE_URL}/api/blog/admin/${post._id}/regenerate-meta`, { apply: false }, { headers: authHeaders }))}>
                  Suggest Meta
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="blog-ai-grid">
        <div className="blog-list-card">
          <div className="blog-list-top"><h3>Top Languages & Referrers</h3></div>
          <div className="mini-table">
            {topLanguages.map(([lang, value]) => (
              <div key={lang} className="job-row"><strong>{String(lang).toUpperCase()}</strong><span>{value} views</span></div>
            ))}
            {topReferrers.map(([source, value]) => (
              <div key={source} className="job-row"><strong>{source}</strong><span>{value} visits</span></div>
            ))}
          </div>
        </div>
        <div className="blog-list-card">
          <div className="blog-list-top"><h3>Content Refresh Candidates</h3></div>
          <div className="mini-table">
            {refreshCandidates.slice(0, 8).map((post) => (
              <div key={post._id} className="job-row">
                <strong>{post.title}</strong>
                <span>{post.refreshReasons?.join(', ') || post.weakReasons?.join(', ')}</span>
                <button type="button" className="secondary-btn small" onClick={() => runAction('Refresh suggestion', () => axios.post(`${API_BASE_URL}/api/blog/admin/${post._id}/refresh-suggestion`, {}, { headers: authHeaders }))}>Suggest</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="blog-list-card">
        <div className="blog-list-top"><h3>Programmatic SEO Foundation</h3></div>
        <div className="blog-ai-controls seo-page-controls">
          <input value={seoPageForm.origin} onChange={(e) => setSeoPageForm({ ...seoPageForm, origin: e.target.value })} placeholder="Origin, e.g. Berlin" />
          <input value={seoPageForm.destination} onChange={(e) => setSeoPageForm({ ...seoPageForm, destination: e.target.value })} placeholder="Destination, e.g. Beirut" />
          <select value={seoPageForm.service} onChange={(e) => setSeoPageForm({ ...seoPageForm, service: e.target.value })}>
            <option value="flights">Flights</option>
            <option value="travel-guide">Travel guide</option>
            <option value="visa">Visa</option>
          </select>
          <select value={seoPageForm.language} onChange={(e) => setSeoPageForm({ ...seoPageForm, language: e.target.value })}>
            {languageOptions.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
          </select>
          <button type="button" className="primary-btn" onClick={createSeoPage}>Create SEO Page</button>
        </div>
        <div className="trend-list seo-pages-list">
          {seoPages.slice(0, 8).map((page) => (
            <div className="seo-page-row" key={page._id}>
              <button type="button" onClick={() => setPreviewSeoPage(page)}>
                <strong>{page.status}</strong> {page.path} - {page.metaTitle} (SEO {page.seoScore || 0})
              </button>
              <div>
                <button type="button" className="secondary-btn small" onClick={() => setPreviewSeoPage(page)}>Preview</button>
                {canPublishBlog && page.status === 'published' ? (
                  <button type="button" className="secondary-btn small" onClick={() => updateSeoPage(page, { ...page, status: 'draft' }, 'Unpublish SEO page')}>Unpublish</button>
                ) : canPublishBlog ? (
                  <button type="button" className="primary-btn small" onClick={() => updateSeoPage(page, { ...page, status: 'published', publishedAt: new Date() }, 'Publish SEO page')}>Publish</button>
                ) : null}
                {canManageBlog ? <button type="button" className="danger-btn small" onClick={() => updateSeoPage(page, { ...page, status: 'archived' }, 'Archive SEO page')}>Archive</button> : null}
              </div>
              <small>Sitemap URL: {window.location.origin}{page.path}</small>
            </div>
          ))}
        </div>
      </div>

      {canManageBlog ? <form className="blog-form-card" onSubmit={handleSubmit}>
        <div className="blog-form-top">
          <h3>{editingId ? 'Edit Article' : 'New Manual Article'}</h3>
          {editingId ? <button type="button" className="secondary-btn" onClick={resetForm}>Cancel Edit</button> : null}
        </div>

        <div className="blog-form-grid">
          <div className="blog-form-group full"><label>Title</label><input name="title" value={form.title} onChange={handleChange} required /></div>
          <div className="blog-form-group"><label>Slug</label><input name="slug" value={form.slug} onChange={handleChange} /></div>
          <div className="blog-form-group"><label>Language</label><select name="language" value={form.language} onChange={handleChange}>{languageOptions.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></div>
          <div className="blog-form-group"><label>Status</label><select name="status" value={form.status} onChange={handleChange}><option value="draft">Draft</option><option value="scheduled">Scheduled</option>{canPublishBlog ? <option value="published">Published</option> : null}<option value="archived">Archived</option></select></div>
          <div className="blog-form-group"><label>Scheduled At</label><input type="datetime-local" name="scheduledAt" value={form.scheduledAt} onChange={handleChange} /></div>
          <div className="blog-form-group"><label>Category</label><input name="category" value={form.category} onChange={handleChange} /></div>
          <div className="blog-form-group"><label>Translation Group</label><input name="translationGroup" value={form.translationGroup} onChange={handleChange} /></div>
          <div className="blog-form-group full"><label>Featured Image URL</label><input name="featuredImage" value={form.featuredImage} onChange={handleChange} /></div>
          <div className="blog-form-group full"><label>Image Alt Text</label><input name="imageAltText" value={form.imageAltText} onChange={handleChange} /></div>
          <div className="blog-form-group full"><label>Excerpt</label><textarea name="excerpt" value={form.excerpt} onChange={handleChange} rows={3} /></div>
          <div className="blog-form-group full"><label>Content</label><textarea name="content" value={form.content} onChange={handleChange} rows={12} /></div>
          <div className="blog-form-group full"><label>FAQ, one per line: question | answer</label><textarea name="faqText" value={form.faqText} onChange={handleChange} rows={4} /></div>
          <div className="blog-form-group full"><label>Tags</label><input name="tags" value={form.tags} onChange={handleChange} /></div>
          <div className="blog-form-group full"><label>Keywords</label><input name="keywords" value={form.keywords} onChange={handleChange} /></div>
          <div className="blog-form-group full"><label>Meta Title</label><input name="metaTitle" value={form.metaTitle} onChange={handleChange} /></div>
          <div className="blog-form-group full"><label>Meta Description</label><textarea name="metaDescription" value={form.metaDescription} onChange={handleChange} rows={3} /></div>
        </div>

        <div className="blog-form-actions"><button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Update Article' : 'Create Article'}</button></div>
      </form> : null}

      <div className="blog-list-card">
        <div className="blog-list-top">
          <h3>All Articles</h3>
          <div className="blog-filters">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All Statuses</option><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option><option value="archived">Archived</option></select>
            <select value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)}><option value="all">All Languages</option>{languageOptions.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select>
          </div>
        </div>

        {loading ? <p className="blog-list-state">Loading articles...</p> : (
          <div className="blog-table-wrap">
            <table className="blog-table">
              <thead><tr><th>Title</th><th>Lang</th><th>Status</th><th>Scores</th><th>Views</th><th>Published</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredPosts.map((post) => (
                  <tr key={post._id}>
                    <td><div className="blog-post-row-title"><strong>{post.title}</strong><span>/{post.slug}</span></div></td>
                    <td>{String(post.language || '').toUpperCase()}</td>
                    <td><span className={`status-badge ${post.status}`}>{post.status}</span></td>
                    <td>SEO {post.seoScore || 0} / Q {post.qualityScore || 0}</td>
                    <td>{post.analytics?.totalViews || 0}</td>
                    <td>{formatDate(post.publishedAt)}</td>
                    <td>
                      <div className="blog-row-actions">
                        <button type="button" className="secondary-btn small" onClick={() => setPreviewPost(post)}>Preview</button>
                        {canManageBlog ? <button type="button" className="secondary-btn small" onClick={() => handleEdit(post)}>Edit</button> : null}
                        <button type="button" className="secondary-btn small" onClick={() => loadVersions('post', post._id)}>Versions</button>
                        <button type="button" className="secondary-btn small" onClick={() => runAction('Regenerate SEO', () => axios.post(`${API_BASE_URL}/api/blog/admin/${post._id}/regenerate-seo`, {}, { headers: authHeaders }))}>SEO</button>
                        <button type="button" className="secondary-btn small" onClick={() => runAction('Suggest Meta', () => axios.post(`${API_BASE_URL}/api/blog/admin/${post._id}/regenerate-meta`, { apply: false }, { headers: authHeaders }))}>Meta</button>
                        {canPublishBlog && post.status === 'published'
                          ? <button type="button" className="secondary-btn small" onClick={() => runAction('Unpublish', () => axios.post(`${API_BASE_URL}/api/blog/admin/${post._id}/unpublish`, {}, { headers: authHeaders }))}>Unpublish</button>
                          : canPublishBlog ? <button type="button" className="primary-btn small" onClick={() => runAction('Publish', () => axios.post(`${API_BASE_URL}/api/blog/admin/${post._id}/publish`, {}, { headers: authHeaders }))}>Publish</button> : null}
                        {canManageBlog ? <button type="button" className="danger-btn small" onClick={() => runAction('Archive', () => axios.post(`${API_BASE_URL}/api/blog/admin/${post._id}/archive`, {}, { headers: authHeaders }))}>Archive</button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {previewPost ? (
        <div className="blog-preview-backdrop" onClick={() => setPreviewPost(null)}>
          <div className="blog-preview-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="blog-preview-close" onClick={() => setPreviewPost(null)}>Close</button>
            <h2>{previewPost.title}</h2>
            {previewPost.featuredImage || previewPost.coverImage ? <img className="blog-preview-image" src={previewPost.featuredImage || previewPost.coverImage} alt={previewPost.imageAltText || previewPost.title} /> : null}
            <p>{previewPost.excerpt}</p>
            {validationWarnings(previewPost).length ? <div className="blog-alert error">{validationWarnings(previewPost).join(' | ')}</div> : null}
            <p><strong>Inserted links:</strong> {(previewPost.insertedLinksReport || []).filter((item) => !item.skipped).length}</p>
            <pre>{String(previewPost.content || '').slice(0, 4000)}</pre>
          </div>
        </div>
      ) : null}

      {previewSeoPage ? (
        <div className="blog-preview-backdrop" onClick={() => setPreviewSeoPage(null)}>
          <div className="blog-preview-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="blog-preview-close" onClick={() => setPreviewSeoPage(null)}>Close</button>
            <h2>SEO Landing Page Editor</h2>
            <div className="blog-form-grid">
              <div className="blog-form-group full"><label>Title</label><input value={previewSeoPage.title || ''} onChange={(e) => setPreviewSeoPage({ ...previewSeoPage, title: e.target.value })} /></div>
              <div className="blog-form-group"><label>Slug</label><input value={previewSeoPage.slug || ''} onChange={(e) => setPreviewSeoPage({ ...previewSeoPage, slug: e.target.value })} /></div>
              <div className="blog-form-group"><label>Status</label><select value={previewSeoPage.status || 'draft'} onChange={(e) => setPreviewSeoPage({ ...previewSeoPage, status: e.target.value })}><option value="draft">Draft</option>{canPublishBlog ? <option value="published">Published</option> : null}<option value="archived">Archived</option></select></div>
              <div className="blog-form-group"><label>Language</label><select value={previewSeoPage.language || 'en'} onChange={(e) => setPreviewSeoPage({ ...previewSeoPage, language: e.target.value })}>{languageOptions.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></div>
              <div className="blog-form-group full"><label>Canonical URL</label><input value={previewSeoPage.canonicalUrl || ''} onChange={(e) => setPreviewSeoPage({ ...previewSeoPage, canonicalUrl: e.target.value })} /></div>
              <div className="blog-form-group full"><label>Meta Title</label><input value={previewSeoPage.metaTitle || ''} onChange={(e) => setPreviewSeoPage({ ...previewSeoPage, metaTitle: e.target.value })} /></div>
              <div className="blog-form-group full"><label>Meta Description</label><textarea rows={2} value={previewSeoPage.metaDescription || ''} onChange={(e) => setPreviewSeoPage({ ...previewSeoPage, metaDescription: e.target.value })} /></div>
              <div className="blog-form-group full"><label>CTA Label</label><input value={previewSeoPage.cta?.label || ''} onChange={(e) => setPreviewSeoPage({ ...previewSeoPage, cta: { ...(previewSeoPage.cta || {}), label: e.target.value } })} /></div>
              <div className="blog-form-group full"><label>CTA URL</label><input value={previewSeoPage.cta?.url || ''} onChange={(e) => setPreviewSeoPage({ ...previewSeoPage, cta: { ...(previewSeoPage.cta || {}), url: e.target.value } })} /></div>
              <div className="blog-form-group full"><label>Source Notes</label><textarea rows={2} value={previewSeoPage.sourceNotes || ''} onChange={(e) => setPreviewSeoPage({ ...previewSeoPage, sourceNotes: e.target.value })} /></div>
            </div>
            {(previewSeoPage.sections || []).map((section, index) => (
              <div className="blog-form-group full" key={index}>
                <label>Section {index + 1}</label>
                <input value={section.heading || ''} onChange={(e) => setPreviewSeoPage({ ...previewSeoPage, sections: (previewSeoPage.sections || []).map((s, i) => i === index ? { ...s, heading: e.target.value } : s) })} />
                <textarea rows={3} value={section.body || ''} onChange={(e) => setPreviewSeoPage({ ...previewSeoPage, sections: (previewSeoPage.sections || []).map((s, i) => i === index ? { ...s, body: e.target.value } : s) })} />
              </div>
            ))}
            {canManageBlog ? <div className="blog-form-actions"><button type="button" className="primary-btn" onClick={savePreviewSeoPage}>Save SEO Page</button></div> : null}
          </div>
        </div>
      ) : null}

      {versions.length ? (
        <div className="blog-preview-backdrop" onClick={() => setVersions([])}>
          <div className="blog-preview-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="blog-preview-close" onClick={() => setVersions([])}>Close</button>
            <h2>Version History</h2>
            <div className="mini-table">
              {versions.map((version) => (
                <div key={version._id} className="job-row">
                  <strong>{version.action || 'change'}</strong>
                  <span>{formatDate(version.createdAt)}</span>
                  <button type="button" className="secondary-btn small" onClick={() => setDiffVersion(version)}>Diff</button>
                  {isAdmin ? <button type="button" className="danger-btn small" onClick={() => runAction('Rollback version', () => axios.post(`${API_BASE_URL}/api/blog/admin/versions/${version._id}/rollback`, {}, { headers: authHeaders }))}>Rollback</button> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {diffVersion ? (
        <div className="blog-preview-backdrop" onClick={() => setDiffVersion(null)}>
          <div className="blog-preview-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="blog-preview-close" onClick={() => setDiffVersion(null)}>Close</button>
            <h2>Version Diff</h2>
            <div className="mini-table">
              {diffFields(diffVersion).map((item) => (
                <div key={item.field} className="diff-row">
                  <strong>{item.field}</strong>
                  <pre>{wordDiff(item.oldValue, item.newValue).oldParts.map((part) => (
                    <mark key={part.index} className={part.changed ? 'removed' : ''}>{part.text}</mark>
                  ))}</pre>
                  <pre>{wordDiff(item.oldValue, item.newValue).newParts.map((part) => (
                    <mark key={part.index} className={part.changed ? 'added' : ''}>{part.text}</mark>
                  ))}</pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ManageBlogPage;
