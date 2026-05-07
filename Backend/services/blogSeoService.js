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

function headingCounts(content = '') {
  return {
    h1: (String(content).match(/(^|\n)#\s+/g) || []).length + (String(content).match(/<h1/i) || []).length,
    h2: (String(content).match(/(^|\n)##\s+/g) || []).length + (String(content).match(/<h2/i) || []).length,
    h3: (String(content).match(/(^|\n)###\s+/g) || []).length + (String(content).match(/<h3/i) || []).length,
  };
}

function markdownSectionWordCounts(content = '') {
  return String(content)
    .split(/(?:^|\n)##\s+/)
    .slice(1)
    .map((section) => wordCount(section));
}

function repeatedPhraseCount(content = '') {
  const ignoreWords = new Set([
    'the',
    'and',
    'with',
    'that',
    'this',
    'from',
    'when',
    'before',
    'after',
    'travel',
    'traveler',
    'travelers',
    'flight',
    'flights',
    'skybridge',
    'booking',
  ]);
  const words = stripHtml(content)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2);
  const phrases = new Map();
  for (let index = 0; index <= words.length - 4; index += 1) {
    const phraseWords = words.slice(index, index + 4);
    if (phraseWords.filter((word) => !ignoreWords.has(word)).length < 3) continue;
    const phrase = phraseWords.join(' ');
    phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
  }
  return [...phrases.values()].filter((count) => count >= 5).length;
}

function genericFillerCount(content = '') {
  const normalized = stripHtml(content).toLowerCase();
  const fillers = [
    'it is important to note',
    'in today',
    'when it comes to',
    'there are many things',
    'this article will explore',
    'in conclusion',
    'travelers should do their research',
  ];
  return fillers.filter((phrase) => normalized.includes(phrase)).length;
}

function detectUnsupportedClaims(content = '') {
  const normalized = stripHtml(content).toLowerCase();
  const allowedContext = [
    'not legal advice',
    'not medical advice',
    'not financial advice',
    'medical, legal, or financial advice',
    'legal, medical, or financial advice',
    'general travel planning',
    'confirm official requirements',
    'check with the airline',
    'check with official sources',
  ];
  const sanitized = allowedContext.reduce((text, phrase) => text.replaceAll(phrase, ''), normalized);
  const blockedPatterns = [
    { pattern: /\b(cure|diagnose|treat|prescribe|medical diagnosis)\b/i, label: 'medical diagnosis or treatment claim' },
    { pattern: /\b(guaranteed|guarantee)\s+(visa|entry|approval|refund|profit|saving|savings|price|fare)\b/i, label: 'legal or financial guarantee' },
    { pattern: /\b(legal advice|financial advice|medical advice)\b/i, label: 'unsupported professional advice' },
    { pattern: /\b(will always|never changes|officially required for all|100% guaranteed)\b/i, label: 'unverifiable absolute claim' },
  ];
  return blockedPatterns.find((item) => item.pattern.test(sanitized)) || null;
}

function currentClaimTrigger(content = '') {
  const normalized = stripHtml(content).toLowerCase();
  const pattern = /\b(today|this week|latest|currently|as of)\b(?!\s+(your|the)\s+(trip|booking|search|plan))/i;
  const match = normalized.match(pattern);
  return match ? match[0] : null;
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
  const headings = headingCounts(content);

  if (metaTitle.length >= 35 && metaTitle.length <= 65) score += 15;
  else reasons.push('Meta title should be 35-65 characters.');

  if (metaDescription.length >= 120 && metaDescription.length <= 170) score += 15;
  else reasons.push('Meta description should be 120-170 characters.');

  if (keywords.length >= 6) score += 10;
  else if (keywords.length >= 3) score += 6;
  else reasons.push('At least six primary, secondary, and semantic keywords are recommended.');

  const matchedKeywords = keywords.filter((keyword) =>
    lowerContent.includes(String(keyword).toLowerCase())
  );
  if (!keywords.length || matchedKeywords.length >= Math.min(2, keywords.length)) score += 10;
  else reasons.push('Primary keywords should appear naturally in the article.');

  if (headings.h1 === 1 && headings.h2 >= 5) score += 10;
  else reasons.push('Heading structure should include one H1 and at least five H2 sections.');

  if ((post.internalLinks || []).length >= 3 || (post.insertedLinksReport || []).length >= 3) score += 10;
  else if ((post.internalLinks || []).length >= 1 || (post.insertedLinksReport || []).length >= 1) score += 5;
  else reasons.push('Add internal links to Skybridge service pages.');

  if ((post.faq || []).filter((item) => item.question && item.answer).length >= 4) score += 10;
  else if ((post.faq || []).filter((item) => item.question && item.answer).length >= 2) score += 6;
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
  const content = post.content || '';
  const words = wordCount(content);
  const headings = headingCounts(content);
  const sectionCounts = markdownSectionWordCounts(content);
  const shortSections = sectionCounts.filter((count) => count > 0 && count < 70).length;
  const repeatedPhrases = repeatedPhraseCount(content);
  const weakSectionIndexes = sectionCounts
    .map((count, index) => ({ count, index: index + 1 }))
    .filter((item) => item.count > 0 && item.count < 70)
    .map((item) => `section ${item.index} (${item.count} words)`);

  if (words >= 1400) score += 30;
  else if (words >= 1200) score += 24;
  else if (words >= 900) score += 18;
  else if (words >= 650) score += 10;
  else reasons.push('Article is too short.');

  if (headings.h1 === 1 && headings.h2 >= 7 && headings.h3 >= 1) score += 12;
  else if (headings.h1 === 1 && headings.h2 >= 6) score += 9;
  else if (headings.h1 >= 1 && headings.h2 >= 3) score += 7;
  else reasons.push('No headings found or heading structure is weak.');

  if (sectionCounts.length >= 7 && shortSections <= 1) score += 8;
  else if (sectionCounts.length >= 5 && shortSections <= 2) score += 5;
  else if (sectionCounts.length >= 3) score += 3;
  else reasons.push(`Sections are too short or too few.${weakSectionIndexes.length ? ` Weak: ${weakSectionIndexes.join(', ')}.` : ''}`);

  if ((post.excerpt || '').length >= 80) score += 10;
  else reasons.push('Excerpt is missing or too short.');

  if ((post.faq || []).length >= 4) score += 10;
  else if ((post.faq || []).length >= 2) score += 6;
  else reasons.push('FAQ is missing.');

  if (post.cta?.label && post.cta?.url && /skybridge flights|search flights|compare travel options/i.test(content)) score += 10;
  else if (post.cta?.label && post.cta?.url) score += 6;
  else reasons.push('CTA is missing.');

  if ((post.internalLinks || []).length >= 2 || (post.insertedLinksReport || []).length >= 2) score += 8;
  else reasons.push('Internal links are weak.');

  if ((post.tags || []).length >= 3) score += 6;
  else reasons.push('Tags are missing.');

  if ((post.keywords || []).length >= 6) score += 8;
  else if ((post.keywords || []).length >= 3) score += 4;
  else reasons.push('Keywords are missing.');

  const unsupportedClaim = detectUnsupportedClaims(content);
  if (!unsupportedClaim) {
    score += 4;
  } else {
    reasons.push(`Unsupported medical, legal, or financial claim detected: ${unsupportedClaim.label}.`);
  }

  const currentTrigger = currentClaimTrigger(content);
  if (!currentTrigger) {
    score += 4;
  } else {
    reasons.push(`Avoid unverifiable current claims in auto-published content: "${currentTrigger}".`);
  }

  const practicalSignals = [
    /airport example|nearby airport|terminal|airport transfer|departure airport/i,
    /airline example|operating airline|fare rules|seat selection|checked baggage/i,
    /route example|direct flight|connecting route|connection time|layover/i,
    /pack|packing|cabin bag|checked bag|luggage/i,
    /family traveler|families|children|business traveler|solo traveler|budget traveler/i,
    /booking strategy|flexible dates|compare live fares|before payment|total trip value/i,
  ].filter((pattern) => pattern.test(content)).length;
  if (practicalSignals >= 4) {
    score += 4;
  } else if (practicalSignals >= 2) {
    score += 2;
  } else {
    reasons.push(`Traveler-specific advice is weak. Practical travel signals found: ${practicalSignals}.`);
  }

  if (genericFillerCount(content) === 0) score += 4;
  else reasons.push('Content contains generic filler phrasing.');

  if (repeatedPhrases <= 2) score += 2;
  else reasons.push('Content has repetitive phrasing.');

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
  detectUnsupportedClaims,
  wordCount,
};
