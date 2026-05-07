const BlogPost = require('../models/BlogPost');
const BlogSeoLandingPage = require('../models/BlogSeoLandingPage');

function dedupeLinks(links, max) {
  const seen = new Set();
  return links
    .filter((link) => link?.label && link?.url)
    .filter((link) => {
      const key = link.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max);
}

async function buildInternalLinks(candidate, settings = {}) {
  const max = settings.maxInternalLinksPerArticle || 5;
  if (max <= 0) return [];

  const links = [
    { label: 'Search flights with Skybridge Flights', url: '/flights' },
    { label: 'Contact Skybridge Flights', url: '/contact' },
  ];

  if (/(hotel|destination|family|dubai|turkey|europe|lebanon|syria)/i.test(`${candidate.title} ${candidate.content}`)) {
    links.push({ label: 'Read more travel guides', url: '/blog' });
  }
  if (/(car rental|drive|road trip)/i.test(`${candidate.title} ${candidate.content}`)) {
    links.push({ label: 'Compare car rental options', url: '/flights?service=car-rental' });
  }
  if (/(visa|passport|documents)/i.test(`${candidate.title} ${candidate.content}`)) {
    links.push({ label: 'Ask about travel support', url: '/contact' });
  }

  const relatedPosts = await BlogPost.find({
    status: 'published',
    language: candidate.language || 'en',
    _id: candidate._id ? { $ne: candidate._id } : { $exists: true },
  })
    .select('title slug language category')
    .sort({ publishedAt: -1 })
    .limit(5)
    .lean();

  relatedPosts.forEach((post) => {
    const lang = post.language && post.language !== 'en' ? `/${post.language}` : '';
    links.push({ label: post.title, url: `/blog${lang}/${post.slug}` });
  });

  const landingPages = await BlogSeoLandingPage.find({ status: 'published' })
    .select('title path service')
    .sort({ updatedAt: -1 })
    .limit(5)
    .lean();
  landingPages.forEach((page) => links.push({ label: page.title, url: page.path }));

  return dedupeLinks([...(candidate.research?.internalLinkTargets || []), ...links], max);
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function insertInternalLinks(content = '', links = [], settings = {}) {
  const max = settings.maxInternalLinksPerArticle || 5;
  const usedUrls = new Set();
  const usedAnchors = new Set();
  const report = [];
  let inserted = 0;
  let output = String(content || '');

  for (const link of links.slice(0, max * 2)) {
    if (inserted >= max) break;
    const anchor = String(link.label || '').trim();
    const url = String(link.url || '').trim();
    if (!anchor || !url || usedUrls.has(url.toLowerCase()) || usedAnchors.has(anchor.toLowerCase())) {
      report.push({ anchor, url, skipped: true, reason: 'Duplicate anchor or URL' });
      continue;
    }
    if (output.includes(`](${url})`) || output.includes(`href="${url}"`)) {
      report.push({ anchor, url, skipped: true, reason: 'URL already linked' });
      continue;
    }

    const words = anchor.split(/\s+/).filter(Boolean);
    const target = words.length > 3 ? words.slice(0, 3).join(' ') : anchor;
    const re = new RegExp(`(^|[^\\]])\\b(${escapeRegExp(target)})\\b(?![^[]*\\]\\()`, 'i');
    if (!re.test(output)) {
      report.push({ anchor, url, skipped: true, reason: 'Natural anchor phrase not found' });
      continue;
    }

    output = output.replace(re, (match, prefix, phrase) => `${prefix}[${phrase}](${url})`);
    usedUrls.add(url.toLowerCase());
    usedAnchors.add(anchor.toLowerCase());
    inserted += 1;
    report.push({ anchor, url, skipped: false, reason: 'Inserted into article body' });
  }

  return { content: output, report };
}

module.exports = {
  buildInternalLinks,
  insertInternalLinks,
};
