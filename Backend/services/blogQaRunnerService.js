const BlogSettings = require('../models/BlogSettings');
const { getSeoQaReport } = require('./blogSeoQaService');
const { runBrokenLinkCheck } = require('./blogBrokenLinkService');
const { getSitemapQa } = require('./blogSitemapQaService');
const { findWeakSeoPages, syncSearchConsole } = require('./searchConsoleService');
const { createNotification } = require('./blogNotificationService');

async function runScheduledQa({ source = 'manual' } = {}) {
  const settings = await BlogSettings.findOneAndUpdate(
    { singletonKey: 'ai-blog-settings' },
    { $setOnInsert: { singletonKey: 'ai-blog-settings' } },
    { new: true, upsert: true }
  );
  const [seoQa, brokenLinks, sitemapQa, weakPages, searchConsole] = await Promise.all([
    getSeoQaReport('all'),
    runBrokenLinkCheck(),
    getSitemapQa(),
    findWeakSeoPages(),
    syncSearchConsole(),
  ]);

  const brokenCount = brokenLinks.reduce((sum, item) => sum + (item.brokenCount || 0), 0);
  const sitemapIssues = (sitemapQa.missingPublishedBlogUrls?.length || 0) + (sitemapQa.missingPublishedSeoUrls?.length || 0);
  const hasIssues = seoQa.totals.errors || brokenCount || sitemapIssues || weakPages.length || searchConsole.synced === false;

  if (settings.notifyAdminOnIssues && hasIssues) {
    await createNotification({
      type: 'qa_summary',
      severity: seoQa.totals.errors || brokenCount ? 'error' : 'warning',
      title: 'Blog QA found issues',
      message: `${seoQa.totals.issues} SEO issues, ${brokenCount} broken links, ${sitemapIssues} sitemap issues, ${weakPages.length} refresh candidates.`,
      metadata: { source, seoQa: seoQa.totals, brokenCount, sitemapIssues, weakPages: weakPages.length, searchConsole },
    });

    const seoLowScoreIssues = seoQa.issues.filter((issue) => issue.code === 'low_seo_score').length;
    const notifications = [];
    if (seoLowScoreIssues) {
      notifications.push({
        type: 'low_seo_score',
        severity: 'warning',
        title: 'Low SEO score pages found',
        message: `${seoLowScoreIssues} published or draft pages need SEO score improvement.`,
        metadata: { source, count: seoLowScoreIssues },
      });
    }
    if (brokenCount) {
      notifications.push({
        type: 'broken_links',
        severity: 'error',
        title: 'Broken internal links found',
        message: `${brokenCount} broken or suspect internal links were found in blog content.`,
        metadata: { source, count: brokenCount },
      });
    }
    if (sitemapIssues) {
      notifications.push({
        type: 'sitemap_issues',
        severity: 'warning',
        title: 'Sitemap QA found issues',
        message: `${sitemapIssues} published URLs are missing from the sitemap report.`,
        metadata: { source, count: sitemapIssues },
      });
    }
    if (weakPages.length) {
      notifications.push({
        type: 'refresh_needed',
        severity: 'info',
        title: 'Old or weak pages need refresh',
        message: `${weakPages.length} pages are candidates for SEO refresh.`,
        metadata: { source, count: weakPages.length },
      });
    }
    if (searchConsole.synced === false && searchConsole.configured) {
      notifications.push({
        type: 'search_console_failed',
        severity: 'warning',
        title: 'Search Console sync failed',
        message: searchConsole.error || 'Search Console returned no sync data.',
        metadata: { source, searchConsole },
      });
    }
    await Promise.all(notifications.map((notification) => createNotification(notification)));
  }

  settings.lastQaRunAt = new Date();
  settings.lastQaStatus = hasIssues ? 'issues_found' : 'clean';
  await settings.save();

  return { seoQa, brokenLinks, sitemapQa, weakPages, searchConsole };
}

module.exports = { runScheduledQa };
