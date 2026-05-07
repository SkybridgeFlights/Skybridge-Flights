const express = require('express');
const router = express.Router();

const {
  listPublishedPosts,
  getPublishedPostBySlug,
  trackArticleView,
  trackCtaClick,
  listAllPostsAdmin,
  createPost,
  updatePost,
  archivePost,
  publishPost,
  unpublishPost,
  deletePost,
  getSettings,
  updateSettings,
  generateAiArticle,
  enqueueAiArticle,
  regenerateSeo,
  regenerateMetaForPost,
  runTrendResearchAdmin,
  runAutoPublisherAdmin,
  getAnalyticsDashboard,
  getRecentBlogJobs,
  getUsage,
  getSeoQa,
  fixSeoQaItem,
  getBrokenLinks,
  runBrokenLinks,
  getSitemapQaAdmin,
  getAssets,
  createAssetAdmin,
  getVersions,
  rollbackVersionAdmin,
  getNotifications,
  markNotificationRead,
  runQaNow,
  getHealth,
  runProductionTests,
  getSearchConsole,
  syncSearchConsoleAdmin,
  getWeakSeoPages,
  getRefreshCandidates,
  createRefreshSuggestion,
  listSeoLandingPages,
  createSeoLandingPage,
  updateSeoLandingPage,
  generateSeoLandingPage,
  getPublishedSeoLandingPage,
  trackSeoLandingPageView,
  trackSeoLandingPageCta,
} = require('../controllers/blogController');

const { protect, adminOnly, requirePerm } = require('../middleware/authMiddleware');
const canManageBlog = [protect, requirePerm('manageBlog')];
const canPublishBlog = [protect, requirePerm('publishBlog')];

router.get('/', listPublishedPosts);
router.post('/:id/view', trackArticleView);
router.post('/:id/cta-click', trackCtaClick);
router.get('/seo-pages/public/:slug', getPublishedSeoLandingPage);
router.post('/seo-pages/public/:id/view', trackSeoLandingPageView);
router.post('/seo-pages/public/:id/cta-click', trackSeoLandingPageCta);

router.get('/admin/all', canManageBlog, listAllPostsAdmin);
router.get('/admin/settings', protect, adminOnly, getSettings);
router.put('/admin/settings', protect, adminOnly, updateSettings);
router.get('/admin/analytics', canManageBlog, getAnalyticsDashboard);
router.get('/admin/jobs', canManageBlog, getRecentBlogJobs);
router.get('/admin/usage', canManageBlog, getUsage);
router.get('/admin/seo-qa', canManageBlog, getSeoQa);
router.post('/admin/seo-qa/fix', canManageBlog, fixSeoQaItem);
router.get('/admin/broken-links', canManageBlog, getBrokenLinks);
router.post('/admin/broken-links/run', canManageBlog, runBrokenLinks);
router.get('/admin/sitemap-qa', canManageBlog, getSitemapQaAdmin);
router.get('/admin/assets', canManageBlog, getAssets);
router.post('/admin/assets', canManageBlog, createAssetAdmin);
router.get('/admin/versions/:targetType/:targetId', canManageBlog, getVersions);
router.post('/admin/versions/:versionId/rollback', protect, adminOnly, rollbackVersionAdmin);
router.get('/admin/notifications', canManageBlog, getNotifications);
router.post('/admin/notifications/:id/read', canManageBlog, markNotificationRead);
router.post('/admin/qa/run', protect, adminOnly, runQaNow);
router.get('/admin/health', canManageBlog, getHealth);
router.post('/admin/tests/run', protect, adminOnly, runProductionTests);
router.get('/admin/search-console', canManageBlog, getSearchConsole);
router.post('/admin/search-console/sync', protect, adminOnly, syncSearchConsoleAdmin);
router.get('/admin/weak-seo', canManageBlog, getWeakSeoPages);
router.get('/admin/refresh-candidates', canManageBlog, getRefreshCandidates);
router.get('/admin/seo-pages', canManageBlog, listSeoLandingPages);
router.post('/admin/seo-pages', canManageBlog, createSeoLandingPage);
router.post('/admin/seo-pages/generate', canManageBlog, generateSeoLandingPage);
router.put('/admin/seo-pages/:id', canManageBlog, updateSeoLandingPage);
router.post('/admin/generate', canManageBlog, generateAiArticle);
router.post('/admin/queue/generate', canManageBlog, enqueueAiArticle);
router.post('/admin/trends/run', canManageBlog, runTrendResearchAdmin);
router.post('/admin/auto-publisher/run', protect, adminOnly, runAutoPublisherAdmin);
router.post('/admin/:id/regenerate-seo', canManageBlog, regenerateSeo);
router.post('/admin/:id/regenerate-meta', canManageBlog, regenerateMetaForPost);
router.post('/admin/:id/refresh-suggestion', canManageBlog, createRefreshSuggestion);
router.post('/admin/:id/publish', canPublishBlog, publishPost);
router.post('/admin/:id/unpublish', canPublishBlog, unpublishPost);
router.post('/admin/:id/archive', canManageBlog, archivePost);
router.get('/:lang/:slug', getPublishedPostBySlug);
router.get('/:slug', getPublishedPostBySlug);

router.post('/', canManageBlog, createPost);
router.put('/:id', canManageBlog, updatePost);
router.delete('/:id', protect, adminOnly, deletePost);

module.exports = router;
