const SITE_URL = (process.env.SITE_URL || 'https://skybridgeflights.com').replace(/\/$/, '');

const labels = {
  ai_generation_failed: 'AI generation failed',
  auto_publish_failed: 'Auto publish failed',
  broken_links: 'Broken links report',
  sitemap_issues: 'Sitemap issue',
  budget_limit: 'AI budget exceeded',
  search_console_failed: 'Search Console failure',
  duplicate_similarity: 'Duplicate similarity warning',
  publish_blocked: 'Publish blocked by guardrails',
  qa_summary: 'Scheduled QA summary',
};

function actionFor(type) {
  if (type === 'broken_links') return 'Open the Broken Links report and repair or remove affected internal links.';
  if (type === 'sitemap_issues') return 'Open Sitemap QA, confirm published URLs, then regenerate or inspect sitemap output.';
  if (type === 'budget_limit') return 'Review AI usage limits before queueing more generation jobs.';
  if (type === 'search_console_failed') return 'Verify Search Console service account credentials and property access.';
  if (type === 'publish_blocked') return 'Review guardrail warnings, fix the draft, then retry publishing.';
  if (type === 'duplicate_similarity') return 'Review duplicate results and choose a more distinct topic or rewrite.';
  if (type === 'qa_summary') return 'Open the AI Blog dashboard and resolve the highest severity QA items first.';
  return 'Open the AI Blog admin dashboard and review the failed job or draft.';
}

function adminUrl(notification = {}) {
  const target = notification.targetType && notification.targetId
    ? `?target=${encodeURIComponent(notification.targetType)}:${notification.targetId}`
    : '';
  return `${SITE_URL}/admin/blog${target}`;
}

function buildAlertTemplate(notification = {}) {
  const type = notification.type || 'qa_summary';
  const label = labels[type] || notification.title || 'Blog alert';
  const severity = notification.severity || 'info';
  const affected = notification.targetType
    ? `${notification.targetType}${notification.targetId ? ` ${notification.targetId}` : ''}`
    : 'Blog system';
  const url = adminUrl(notification);
  const recommendedAction = actionFor(type);
  const subject = `[Skybridge Blog] ${severity.toUpperCase()}: ${label}`;
  const text = [
    `${label}`,
    `Severity: ${severity}`,
    `Issue type: ${type}`,
    `Affected: ${affected}`,
    `Message: ${notification.message || notification.title || ''}`,
    `Admin URL: ${url}`,
    `Recommended action: ${recommendedAction}`,
  ].join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#102033">
      <h2>${label}</h2>
      <p><strong>Severity:</strong> ${severity}</p>
      <p><strong>Issue type:</strong> ${type}</p>
      <p><strong>Affected:</strong> ${affected}</p>
      <p>${notification.message || notification.title || ''}</p>
      <p><strong>Recommended action:</strong> ${recommendedAction}</p>
      <p><a href="${url}">Open AI Blog Admin</a></p>
    </div>
  `;
  return { subject, text, html, url, recommendedAction };
}

module.exports = { buildAlertTemplate };
