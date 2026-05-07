const BlogSeoLandingPage = require('../models/BlogSeoLandingPage');
const { makeSlug } = require('./aiBlogService');
const SITE_URL = (process.env.SITE_URL || 'https://skybridgeflights.com').replace(/\/$/, '');

function scoreLandingPage(page) {
  let score = 0;
  if ((page.metaTitle || '').length >= 35 && (page.metaTitle || '').length <= 65) score += 20;
  if ((page.metaDescription || '').length >= 110 && (page.metaDescription || '').length <= 170) score += 20;
  if ((page.sections || []).length >= 2) score += 20;
  if ((page.faq || []).length >= 1) score += 15;
  if ((page.keywords || []).length >= 3) score += 10;
  if (page.canonicalUrl || page.path) score += 10;
  if (page.schemaMarkup && Object.keys(page.schemaMarkup || {}).length) score += 5;
  return Math.min(100, score);
}

function buildLandingPayload(input = {}) {
  const origin = String(input.origin || '').trim();
  const destination = String(input.destination || '').trim();
  const service = String(input.service || 'flights').trim();
  const title =
    input.title ||
    (origin && destination
      ? `${service === 'flights' ? 'Flights' : 'Travel'} from ${origin} to ${destination}`
      : `${input.destination || input.service || 'Travel'} Guide`);
  const slug = makeSlug(input.slug || title);
  const path =
    input.path ||
    (origin && destination
      ? `/flights/from-${makeSlug(origin)}-to-${makeSlug(destination)}`
      : `/travel-guides/${slug}`);

  return {
    pageType: input.pageType || (origin && destination ? 'route' : 'travel-guide'),
    title,
    slug,
    path,
    canonicalUrl: input.canonicalUrl || `${SITE_URL}${path}`,
    origin,
    destination,
    service,
    language: input.language || 'en',
    metaTitle: input.metaTitle || `${title} | Skybridge Flights`,
    metaDescription:
      input.metaDescription ||
      `Plan ${title.toLowerCase()} with Skybridge Flights. Compare route options, airport tips, baggage, hotels, car rental, and travel support.`,
    keywords: input.keywords || [service, origin, destination, 'Skybridge Flights'].filter(Boolean),
    sections: input.sections || [
      { heading: 'Route overview', body: `Use this page as a planning foundation for ${title.toLowerCase()}.` },
      { heading: 'Booking checklist', body: 'Compare airports, dates, baggage needs, hotel timing, car rental, and support options before booking.' },
    ],
    faq: input.faq || [
      { question: `How do I plan ${title.toLowerCase()}?`, answer: 'Compare route options, verify travel documents, review baggage rules, and continue to booking when ready.' },
    ],
    schemaMarkup: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description: input.metaDescription || `Skybridge Flights guide for ${title.toLowerCase()}.`,
      url: `${SITE_URL}${path}`,
      inLanguage: input.language || 'en',
      publisher: {
        '@type': 'Organization',
        name: 'Skybridge Flights',
      },
    },
    lastReviewedAt: new Date(),
  };
}

async function createLandingPage(input = {}) {
  const payload = buildLandingPayload(input);
  payload.seoScore = scoreLandingPage(payload);
  const exists = await BlogSeoLandingPage.findOne({ path: payload.path });
  if (exists) throw new Error('Programmatic SEO page already exists for this path');
  return BlogSeoLandingPage.create(payload);
}

module.exports = {
  buildLandingPayload,
  createLandingPage,
  scoreLandingPage,
};
