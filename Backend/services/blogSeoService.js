const SITE_URL = (process.env.SITE_URL || 'https://skybridgeflights.com').replace(/\/$/, '');

function stripHtml(value = '') {
  return String(value).replace(/<[^>]*>/g, ' ');
}

function wordCount(value = '') {
  return stripHtml(value).trim().split(/\s+/).filter(Boolean).length;
}

function estimateReadingTime(content = '') {
  const words = wordCount(content);
  return Math.max(1, Math.ceil(words / 220));
}

function normalizeKeywordList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function buildCanonicalUrl(post) {
  if (post.canonicalUrl) return post.canonicalUrl;
  const lang = post.language && post.language !== 'en' ? `/${post.language}` : '';
  return `${SITE_URL}/blog${lang}/${post.slug}`;
}

function buildArticleSchema(post) {
  const canonicalUrl = buildCanonicalUrl(post);
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.metaTitle || post.seoTitle || post.title,
    description: post.metaDescription || post.seoDescription || post.excerpt,
    image: post.featuredImage || post.coverImage || undefined,
    author: {
      '@type': 'Person',
      name: post.authorProfile?.name || post.author || 'Skybridge AI Travel Editor',
      description: post.authorProfile?.bio || undefined,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Skybridge Flights',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo.png`,
      },
    },
    datePublished: post.publishedAt || post.createdAt,
    dateModified: post.lastUpdatedAt || post.updatedAt || post.createdAt,
    reviewedBy: {
      '@type': 'Organization',
      name: 'Skybridge Flights',
    },
    isAccessibleForFree: true,
    inLanguage: post.language || 'en',
    mainEntityOfPage: canonicalUrl,
  };
}

function buildFaqSchema(faq = []) {
  const mainEntity = faq
    .filter((item) => item.question && item.answer)
    .map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    }));

  if (!mainEntity.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity,
  };
}

function scoreSeo(post) {
  const reasons = [];
  let score = 0;
  const metaTitle = post.metaTitle || post.seoTitle || '';
  const metaDescription = post.metaDescription || post.seoDescription || '';
  const content = post.content || '';
  const keywords = normalizeKeywordList(post.keywords);
  const lowerContent = stripHtml(content).toLowerCase();

  if (metaTitle.length >= 35 && metaTitle.length <= 65) score += 15;
  else reasons.push('Meta title should be 35-65 characters.');

  if (metaDescription.length >= 120 && metaDescription.length <= 170) score += 15;
  else reasons.push('Meta description should be 120-170 characters.');

  if (keywords.length >= 3) score += 10;
  else reasons.push('At least three keywords are recommended.');

  const matchedKeywords = keywords.filter((keyword) =>
    lowerContent.includes(String(keyword).toLowerCase())
  );
  if (!keywords.length || matchedKeywords.length >= Math.min(2, keywords.length)) score += 10;
  else reasons.push('Primary keywords should appear naturally in the article.');

  if (/^#\s+|<h1/i.test(content) && (/^##\s+|<h2/i.test(content) || content.includes('\n##'))) score += 10;
  else reasons.push('Heading structure should include a clear H1 and H2 sections.');

  if ((post.internalLinks || []).length >= 2) score += 10;
  else reasons.push('Add internal links to Skybridge service pages.');

  if ((post.faq || []).filter((item) => item.question && item.answer).length >= 2) score += 10;
  else reasons.push('FAQ section is required.');

  if (post.imageAltText) score += 8;
  else reasons.push('Featured image alt text is required.');

  if (post.canonicalUrl || post.slug) score += 6;
  if (post.schemaMarkup && Object.keys(post.schemaMarkup || {}).length) score += 6;
  if (post.lastReviewedAt || post.lastUpdatedAt) score += 4;

  return { score: Math.min(100, score), reasons };
}

function scoreQuality(post) {
  const reasons = [];
  let score = 0;
  const words = wordCount(post.content || '');

  if (words >= 900) score += 25;
  else if (words >= 650) score += 18;
  else reasons.push('Article is too short.');

  if ((post.excerpt || '').length >= 80) score += 10;
  else reasons.push('Excerpt is missing or too short.');

  if ((post.faq || []).length >= 2) score += 10;
  else reasons.push('FAQ is missing.');

  if (post.cta?.label && post.cta?.url) score += 15;
  else reasons.push('CTA is missing.');

  if ((post.tags || []).length >= 3) score += 10;
  else reasons.push('Tags are missing.');

  if ((post.keywords || []).length >= 3) score += 10;
  else reasons.push('Keywords are missing.');

  if (!/(guaranteed|cure|legal advice|financial advice|medical advice)/i.test(post.content || '')) {
    score += 10;
  } else {
    reasons.push('Unsupported medical, legal, or financial claim detected.');
  }

  if (!/(today|this week|latest|currently|as of)/i.test(post.content || '')) {
    score += 10;
  } else {
    reasons.push('Avoid unverifiable current claims in auto-published content.');
  }

  return { score: Math.min(100, score), reasons };
}

function enrichSeo(post) {
  const seo = scoreSeo(post);
  const quality = scoreQuality(post);
  const schemaMarkup = {
    article: buildArticleSchema(post),
    faq: buildFaqSchema(post.faq || []),
  };

  return {
    readingTime: estimateReadingTime(post.content),
    canonicalUrl: buildCanonicalUrl(post),
    schemaMarkup,
    seoScore: seo.score,
    qualityScore: quality.score,
    guardrailReasons: [...seo.reasons, ...quality.reasons],
  };
}

module.exports = {
  buildCanonicalUrl,
  buildArticleSchema,
  buildFaqSchema,
  enrichSeo,
  estimateReadingTime,
  normalizeKeywordList,
  scoreQuality,
  scoreSeo,
  wordCount,
};
