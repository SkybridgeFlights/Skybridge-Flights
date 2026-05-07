const BlogPost = require('../models/BlogPost');
const BlogSeoLandingPage = require('../models/BlogSeoLandingPage');
const BlogSettings = require('../models/BlogSettings');
const { getSitemapQa } = require('./blogSitemapQaService');
const { wordCount } = require('./blogSeoService');

function addIssue(issues, item, code, message, severity = 'warning') {
  issues.push({ ...item, code, message, severity });
}

function hasSchema(value) {
  return !!value && Object.keys(value || {}).length > 0;
}

async function getSeoQaReport(issueType = 'all') {
  const [posts, pages, settings, sitemap] = await Promise.all([
    BlogPost.find({}).lean(),
    BlogSeoLandingPage.find({}).lean(),
    BlogSettings.findOne({ singletonKey: 'ai-blog-settings' }).lean(),
    getSitemapQa(),
  ]);
  const issues = [];
  const slugs = new Map();
  posts.forEach((post) => {
    const key = `${post.language}:${post.slug}`;
    slugs.set(key, (slugs.get(key) || 0) + 1);
  });

  posts.forEach((post) => {
    const item = { targetType: 'post', targetId: post._id, title: post.title, status: post.status, url: `/blog/${post.slug}` };
    if (!post.metaTitle && !post.seoTitle) addIssue(issues, item, 'missing_meta_title', 'Missing meta title');
    if (!post.metaDescription && !post.seoDescription) addIssue(issues, item, 'missing_meta_description', 'Missing meta description');
    if (slugs.get(`${post.language}:${post.slug}`) > 1) addIssue(issues, item, 'duplicate_slug', 'Duplicate slug for language', 'error');
    if (!post.canonicalUrl) addIssue(issues, item, 'missing_canonical', 'Missing canonical URL');
    if ((post.hreflang || []).some((h) => !h.language || !h.url)) addIssue(issues, item, 'invalid_hreflang', 'Invalid hreflang data');
    if (!(post.faq || []).length) addIssue(issues, item, 'missing_faq', 'Missing FAQ');
    if (!hasSchema(post.schemaMarkup)) addIssue(issues, item, 'missing_schema', 'Missing schema markup');
    if (!post.imageAltText) addIssue(issues, item, 'missing_image_alt', 'Missing image alt text');
    if ((post.seoScore || 0) < (settings?.minimumSeoScore || 70)) addIssue(issues, item, 'low_seo_score', 'Low SEO score');
    if ((post.qualityScore || 0) < (settings?.minimumQualityScore || 70)) addIssue(issues, item, 'low_quality_score', 'Low quality score');
    if (post.status === 'published' && !post.cta?.url) addIssue(issues, item, 'missing_cta', 'Published article has no CTA');
    if ((post.internalLinks || []).length < 2) addIssue(issues, item, 'weak_internal_linking', 'Weak internal linking');
    if (post.status === 'published' && post.linkCheck?.brokenCount > 0) addIssue(issues, item, 'broken_internal_links', 'Broken internal links', 'error');
    if (!post.imageSeo?.width || !post.imageSeo?.height) addIssue(issues, item, 'image_dimensions_missing', 'Image width/height missing');
    if (post.featuredImage && !/\.webp($|\?)/i.test(post.featuredImage) && post.imageSeo?.format !== 'webp') addIssue(issues, item, 'non_webp_image', 'Featured image is not WebP');
    if ((post.metaTitle || post.seoTitle || '').length > 70) addIssue(issues, item, 'meta_title_long', 'Meta title is too long');
    const descLen = (post.metaDescription || post.seoDescription || '').length;
    if (descLen && (descLen < 110 || descLen > 180)) addIssue(issues, item, 'meta_description_length', 'Meta description length is outside recommended range');
    if (wordCount(post.content || '') < 650) addIssue(issues, item, 'article_too_short', 'Article is too short');
    if ((post.internalLinks || []).length > (settings?.maxInternalLinksPerArticle || 5)) addIssue(issues, item, 'too_many_internal_links', 'Too many internal links');
    if (!/^#|<h[1-3]/im.test(post.content || '')) addIssue(issues, item, 'no_headings', 'No headings found');
  });

  pages.forEach((page) => {
    const item = { targetType: 'seoPage', targetId: page._id, title: page.title, status: page.status, url: page.path };
    if (!page.metaTitle) addIssue(issues, item, 'missing_meta_title', 'Missing meta title');
    if (!page.metaDescription) addIssue(issues, item, 'missing_meta_description', 'Missing meta description');
    if (!page.canonicalUrl) addIssue(issues, item, 'missing_canonical', 'Missing canonical URL');
    if ((page.hreflang || []).some((h) => !h.language || !h.url)) addIssue(issues, item, 'invalid_hreflang', 'Invalid hreflang data');
    if (!(page.faq || []).length) addIssue(issues, item, 'missing_faq', 'Missing FAQ');
    if (!hasSchema(page.schemaMarkup)) addIssue(issues, item, 'missing_schema', 'Missing schema markup');
    if (page.status === 'published' && !page.cta?.url) addIssue(issues, item, 'missing_cta', 'Published page has no CTA');
    if ((page.seoScore || 0) < 70) addIssue(issues, item, 'low_seo_score', 'Low SEO score');
    if (page.status === 'published' && page.linkCheck?.brokenCount > 0) addIssue(issues, item, 'broken_internal_links', 'Broken internal links', 'error');
  });

  const filtered = issueType === 'all' ? issues : issues.filter((issue) => issue.code === issueType);
  return {
    generatedAt: new Date(),
    totals: {
      issues: filtered.length,
      errors: filtered.filter((issue) => issue.severity === 'error').length,
      warnings: filtered.filter((issue) => issue.severity !== 'error').length,
    },
    issues: filtered,
    sitemap,
  };
}

module.exports = {
  getSeoQaReport,
};
