const BlogPost = require('../models/BlogPost');
const BlogSeoLandingPage = require('../models/BlogSeoLandingPage');

const SITE_URL = (process.env.SITE_URL || 'https://skybridgeflights.com').replace(/\/$/, '');

function postUrl(post) {
  const lang = post.language && post.language !== 'en' ? `/${post.language}` : '';
  return post.canonicalUrl || `${SITE_URL}/blog${lang}/${post.slug}`;
}

async function getSitemapQa() {
  const [posts, pages] = await Promise.all([
    BlogPost.find({}).select('slug language status canonicalUrl').lean(),
    BlogSeoLandingPage.find({}).select('path status canonicalUrl').lean(),
  ]);
  const publishedPostUrls = posts.filter((p) => p.status === 'published').map(postUrl);
  const publishedSeoUrls = pages.filter((p) => p.status === 'published').map((p) => p.canonicalUrl || `${SITE_URL}${p.path}`);
  const archivedTargets = [
    ...posts.filter((p) => p.status !== 'published').map(postUrl),
    ...pages.filter((p) => p.status !== 'published').map((p) => p.canonicalUrl || `${SITE_URL}${p.path}`),
  ];
  return {
    blogUrls: publishedPostUrls.length,
    seoLandingUrls: publishedSeoUrls.length,
    missingPublishedBlogUrls: posts.filter((p) => p.status === 'published' && !p.slug).map((p) => p._id),
    missingPublishedSeoUrls: pages.filter((p) => p.status === 'published' && !p.path).map((p) => p._id),
    archivedOrDraftUrlsThatShouldNotAppear: archivedTargets,
  };
}

module.exports = {
  getSitemapQa,
};
