const BlogPost = require('../models/BlogPost');
const BlogSeoLandingPage = require('../models/BlogSeoLandingPage');

function extractMarkdownLinks(text = '') {
  const links = [];
  const markdown = /\[[^\]]+\]\(([^)]+)\)/g;
  let match;
  while ((match = markdown.exec(String(text)))) links.push(match[1]);
  return links;
}

function extractPlainInternalUrls(text = '') {
  const matches = String(text).match(/(?:^|\s)(\/(?:blog|flights|travel-guides|seo|contact|about)[^\s),"]*)/g) || [];
  return matches.map((item) => item.trim());
}

async function internalRouteExists(url) {
  if (!url || /^https?:\/\//i.test(url)) return { status: 'suspect', reason: 'External URL not checked' };
  const clean = url.split('?')[0].replace(/\/$/, '');
  if (['/', '/flights', '/blog', '/contact', '/about'].includes(clean)) return { status: 'ok', reason: 'Known route' };
  if (clean.startsWith('/blog/')) {
    const parts = clean.split('/').filter(Boolean);
    const slug = parts.length === 3 ? parts[2] : parts[1];
    const exists = await BlogPost.exists({ slug, status: 'published' });
    return exists ? { status: 'ok', reason: 'Published blog post exists' } : { status: 'broken', reason: 'Blog target not published' };
  }
  if (clean.startsWith('/flights/') || clean.startsWith('/travel-guides/') || clean.startsWith('/seo/')) {
    const exists = await BlogSeoLandingPage.exists({ path: clean, status: 'published' });
    return exists ? { status: 'ok', reason: 'Published SEO page exists' } : { status: 'broken', reason: 'SEO landing target not published' };
  }
  return { status: 'suspect', reason: 'Route cannot be verified' };
}

async function checkLinksForDocument(text, explicitLinks = []) {
  const urls = [...new Set([...extractMarkdownLinks(text), ...extractPlainInternalUrls(text), ...explicitLinks.map((l) => l.url).filter(Boolean)])];
  const links = [];
  for (const url of urls) {
    const result = await internalRouteExists(url);
    links.push({ url, ...result });
  }
  return {
    links,
    brokenCount: links.filter((l) => l.status === 'broken').length,
    suspectCount: links.filter((l) => l.status === 'suspect').length,
  };
}

async function runBrokenLinkCheck() {
  const [posts, pages] = await Promise.all([
    BlogPost.find({ status: 'published' }),
    BlogSeoLandingPage.find({ status: 'published' }),
  ]);
  const report = [];
  for (const post of posts) {
    const result = await checkLinksForDocument(post.content, post.internalLinks || []);
    post.linkCheck = { ...result, lastCheckedAt: new Date() };
    await post.save();
    report.push({ type: 'post', id: post._id, title: post.title, ...result });
  }
  for (const page of pages) {
    const text = (page.sections || []).map((s) => `${s.heading}\n${s.body}`).join('\n');
    const result = await checkLinksForDocument(text, [{ url: page.cta?.url || '' }]);
    page.linkCheck = { ...result, lastCheckedAt: new Date() };
    await page.save();
    report.push({ type: 'seoPage', id: page._id, title: page.title, ...result });
  }
  return report;
}

async function getBrokenLinkReport() {
  const [posts, pages] = await Promise.all([
    BlogPost.find({ status: 'published' }).select('title slug linkCheck').lean(),
    BlogSeoLandingPage.find({ status: 'published' }).select('title path linkCheck').lean(),
  ]);
  return [
    ...posts.map((p) => ({ type: 'post', id: p._id, title: p.title, slug: p.slug, linkCheck: p.linkCheck })),
    ...pages.map((p) => ({ type: 'seoPage', id: p._id, title: p.title, path: p.path, linkCheck: p.linkCheck })),
  ];
}

module.exports = {
  getBrokenLinkReport,
  runBrokenLinkCheck,
};
