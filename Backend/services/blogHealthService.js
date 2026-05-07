const BlogPost = require('../models/BlogPost');
const BlogSeoLandingPage = require('../models/BlogSeoLandingPage');
const BlogJob = require('../models/BlogJob');
const BlogSettings = require('../models/BlogSettings');
const { getUsageSummary } = require('./blogUsageService');
const { getSitemapQa } = require('./blogSitemapQaService');
const { getSearchConsoleSummary } = require('./searchConsoleService');

async function getBlogHealth() {
  const [settings, queue, lastAi, lastPublish, publishedPosts, draftPosts, seoPages, usage, sitemap, searchConsole] =
    await Promise.all([
      BlogSettings.findOne({ singletonKey: 'ai-blog-settings' }).lean(),
      BlogJob.find({}).sort({ createdAt: -1 }).limit(10).lean(),
      BlogPost.findOne({ source: 'AI' }).sort({ createdAt: -1 }).select('title createdAt status').lean(),
      BlogPost.findOne({ status: 'published' }).sort({ publishedAt: -1 }).select('title publishedAt').lean(),
      BlogPost.countDocuments({ status: 'published' }),
      BlogPost.countDocuments({ status: 'draft' }),
      BlogSeoLandingPage.countDocuments({}),
      getUsageSummary(),
      getSitemapQa(),
      getSearchConsoleSummary(),
    ]);

  return {
    scheduler: {
      autoPublishEnabled: !!settings?.autoPublishEnabled,
      scheduledQaEnabled: !!settings?.scheduledQaEnabled,
      lastQaRunAt: settings?.lastQaRunAt || null,
      lastQaStatus: settings?.lastQaStatus || '',
    },
    queue: {
      recent: queue,
      queued: queue.filter((job) => job.status === 'queued').length,
      failed: queue.filter((job) => job.status === 'failed').length,
    },
    lastAiGeneration: lastAi,
    lastSuccessfulPublish: lastPublish,
    searchConsole,
    cloudinary: {
      configured: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
    },
    sitemap,
    totals: {
      publishedPosts,
      draftPosts,
      seoLandingPages: seoPages,
      monthlyAiCost: usage.monthly?.estimatedCost || 0,
      monthlyAiArticles: usage.monthly?.articlesGenerated || 0,
    },
  };
}

module.exports = { getBlogHealth };
