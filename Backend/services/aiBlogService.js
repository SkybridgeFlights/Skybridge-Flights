const crypto = require('crypto');
const OpenAI = require('openai');
const BlogPost = require('../models/BlogPost');
const BlogSettings = require('../models/BlogSettings');
const { enrichSeo } = require('./blogSeoService');
const { inferCategory, isAllowedTopic, runTrendResearch, topicKey } = require('./blogTrendService');
const { assertBudgetAvailable, recordGenerationUsage } = require('./blogUsageService');
const { checkDuplicate } = require('./blogDuplicateService');
const { collectResearch } = require('./blogResearchService');
const { buildInternalLinks, insertInternalLinks } = require('./blogInternalLinkService');
const { processFeaturedImage } = require('./blogImageService');

const LANGUAGE_NAMES = {
  en: 'English',
  ar: 'Arabic',
  de: 'German',
};

function makeSlug(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\u0600-\u06FF\s]+/g, '-')
    .replace(/[^a-z0-9\u0600-\u06FF-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function getSettings() {
  return BlogSettings.findOneAndUpdate(
    { singletonKey: 'ai-blog-settings' },
    { $setOnInsert: { singletonKey: 'ai-blog-settings' } },
    { new: true, upsert: true }
  );
}

function fallbackArticle(topic, language = 'en') {
  const titleMap = {
    en: `Skybridge Travel Guide: ${topic}`,
    de: `Skybridge Reisefuehrer: ${topic}`,
    ar: `دليل سكاي بريدج للسفر: ${topic}`,
  };
  const introMap = {
    en: 'This evergreen travel guide helps travelers compare routes, prepare documents, understand baggage needs, and move from planning to booking with more confidence.',
    de: 'Dieser zeitlose Reiseleitfaden hilft Reisenden, Routen zu vergleichen, Unterlagen vorzubereiten, Gepaeckfragen zu klaeren und sicherer zu buchen.',
    ar: 'يساعد هذا الدليل المسافرين على مقارنة الرحلات وتجهيز المستندات وفهم متطلبات الأمتعة والانتقال إلى الحجز بثقة أكبر.',
  };
  const sections = [
    {
      heading: 'Smart route planning',
      body: 'Start with the purpose of the trip, the travelers in the group, and the airports that can realistically work for departure and arrival. A nearby airport can sometimes create better timing, easier baggage handling, or a better connection, especially for travelers moving between Germany, Europe, Turkey, Dubai, the Middle East, Lebanon, or Syria. Compare departure windows instead of one exact flight time, and keep hotel check-in, car rental pickup, airport transfer time, and family needs in the same planning view.',
    },
    {
      heading: 'Baggage and airline rules',
      body: 'Baggage rules can change by airline, fare type, aircraft, and route, so the safest approach is to check the operating airline before payment and again before departure. Pay attention to cabin size, checked baggage weight, sports equipment, stroller rules, mobility equipment, and pet carrier requirements. Travelers who understand baggage limits early can avoid airport stress and can compare the real cost of each fare instead of only looking at the headline ticket price.',
    },
    {
      heading: 'Documents and travel readiness',
      body: 'Keep passport validity, visa requirements, transit rules, hotel address, travel insurance details, and emergency contacts organized before booking the final itinerary. This article is not legal advice, and travelers should confirm official requirements with the airline, embassy, destination authority, or airport before departure. Evergreen planning is still useful because it helps you identify the documents to verify and the questions to ask before you commit to a route.',
    },
    {
      heading: 'Finding better value',
      body: 'Flexible dates, nearby airports, mixed cabin needs, and realistic connection times can all influence the total value of a trip. Midweek flights, early planning, and clear comparison between direct and connecting routes may help travelers spot better options. Value is not only the ticket price. It also includes baggage, arrival time, transfer cost, hotel timing, car rental availability, and how easy the itinerary will be for children, older travelers, or pets.',
    },
    {
      heading: 'Family, pet, and group travel',
      body: 'Families and groups should build extra airport time into the plan and keep all travelers aligned on baggage, seats, documents, and transfer details. Pet travel needs even more preparation because airline policies can differ by route and aircraft. Confirm carrier size, check-in process, destination rules, and transit restrictions before booking. A slightly more convenient itinerary can be worth more than a cheaper option if it reduces missed connections or airport confusion.',
    },
    {
      heading: 'Booking next step with Skybridge Flights',
      body: 'Use Skybridge Flights to move from research to action. Compare flight options, continue to travel services, and use contact or support paths when a trip needs extra attention. The best article topic should create a useful next step for the traveler, whether that is searching flights, checking hotels, arranging car rental, contacting support, or reading another destination guide before choosing the final itinerary.',
    },
  ];
  const content = `# ${titleMap[language] || titleMap.en}\n\n${introMap[language] || introMap.en}\n\n${sections
    .map((section) => `## ${section.heading}\n${section.body}`)
    .join('\n\n')}\n\n## Practical checklist\n- Compare at least two airport options when possible.\n- Review baggage and fare rules before payment.\n- Keep visa, passport, hotel, and transfer information together.\n- Choose realistic connection times for families, pets, and checked baggage.\n- Continue to Skybridge Flights when you are ready to compare travel options.`;

  return {
    title: titleMap[language] || titleMap.en,
    excerpt: introMap[language] || introMap.en,
    content,
    metaTitle: `${topic} | Skybridge Flights Guide`,
    metaDescription: `Practical Skybridge Flights guide for ${topic}: routes, baggage, documents, booking tips, and travel planning support.`,
    keywords: ['flights', 'travel tips', 'Skybridge Flights', topic],
    tags: ['flights', 'travel', 'booking'],
    faq: [
      {
        question: `How should I start planning ${topic}?`,
        answer: 'Start with travel dates, nearby airports, baggage needs, documents, and flexible route comparisons.',
      },
      {
        question: 'Can Skybridge Flights help with the booking step?',
        answer: 'Yes. Skybridge Flights helps travelers compare options and continue to flight, hotel, car rental, contact, or support actions.',
      },
    ],
    imagePrompt: `Realistic travel editorial image for ${topic}, airports and travelers, bright professional style`,
    imageAltText: `Travel planning scene for ${topic}`,
  };
}

function parseJsonResponse(text) {
  const cleaned = String(text || '').replace(/^```json|```$/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('AI response did not contain JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function generateWithOpenAI(topic, language, research = {}) {
  if (!process.env.OPENAI_API_KEY || (process.env.AI_PROVIDER && process.env.AI_PROVIDER !== 'openai')) {
    return fallbackArticle(topic, language);
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content:
          'You write evergreen travel SEO articles for Skybridge Flights. Return only valid JSON. Avoid current factual claims unless sourced. Do not give medical, legal, or financial advice.',
      },
      {
        role: 'user',
        content: `Create a high-quality ${LANGUAGE_NAMES[language] || 'English'} article about "${topic}". It must be only about flights, travel, airports, baggage, airline rules, cheap flights, family travel, pet travel, visa/travel tips, hotels, car rental, or relevant destinations in Germany, Europe, Turkey, Dubai, Middle East, Lebanon, or Syria. Use these research signals: ${JSON.stringify({
          outline: research.outline || [],
          relatedKeywords: research.relatedKeywords || [],
          questions: research.faq || [],
        })}. Return JSON with title, excerpt, content markdown with H1/H2 sections and at least 900 words, metaTitle, metaDescription, keywords array, tags array, faq array of {question,answer}, imagePrompt, imageAltText.`,
      },
    ],
  });

  return parseJsonResponse(response.choices?.[0]?.message?.content);
}

async function buildPostPayload({ topic, language = 'en', settings, trend }) {
  if (!isAllowedTopic(topic, settings)) {
    throw new Error('Topic is unrelated or forbidden.');
  }
  await assertBudgetAvailable(settings, 4500);

  const duplicate = await BlogPost.findOne({
    $or: [
      { topicKey: topicKey(topic), language },
      { title: new RegExp(`^${String(topic).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), language },
    ],
  }).lean();

  if (duplicate) {
    throw new Error('Duplicate topic or title detected.');
  }

  const research = await collectResearch(topic, settings);
  if (research.failed && settings.fallbackResearchEnabled === false) {
    throw new Error(`Research failed and fallback is disabled. ${research.error || ''}`);
  }

  const article = await generateWithOpenAI(topic, language, research);
  const baseSlug = makeSlug(article.slug || article.title || topic);
  const suffix = crypto.randomBytes(3).toString('hex');
  const slug = (await BlogPost.exists({ slug: baseSlug, language })) ? `${baseSlug}-${suffix}` : baseSlug;

  const payload = {
    title: article.title,
    slug,
    excerpt: article.excerpt,
    content: article.content,
    metaTitle: article.metaTitle,
    metaDescription: article.metaDescription,
    seoTitle: article.metaTitle,
    seoDescription: article.metaDescription,
    keywords: Array.isArray(article.keywords) ? article.keywords : [],
    tags: Array.isArray(article.tags) ? article.tags : [],
    category: trend?.category || inferCategory(topic),
    language,
    source: 'AI',
    author: 'AI',
    imagePrompt: article.imagePrompt || research.imagePrompt || '',
    imageAltText: article.imageAltText || '',
    research,
    authorProfile: {
      name: 'Skybridge AI Travel Editor',
      role: 'AI-assisted travel content editor',
      bio: 'Skybridge Flights uses AI-assisted drafting with editorial guardrails for evergreen travel planning content.',
    },
    editorialPolicy:
      'Skybridge Flights creates evergreen travel planning content with AI assistance, automated SEO checks, duplicate screening, and human admin review controls.',
    sourceNotes: `Research signals: ${(research.queries || []).slice(0, 8).join(', ')}`,
    lastReviewedAt: new Date(),
    lastUpdatedAt: new Date(),
    cta: {
      label: 'Compare travel options with Skybridge Flights',
      url: '/flights',
      type: 'search',
    },
    faq: Array.isArray(article.faq) && article.faq.length ? article.faq : research.faq || [],
    topicKey: topicKey(topic),
    topicScore: trend?.score || 0,
    trendData: trend
      ? {
          source: trend.source,
          keyword: topic,
          trendStrength: trend.trendStrength,
          businessRelevance: trend.businessRelevance,
          bookingIntent: trend.bookingIntent,
          seasonality: trend.seasonality,
          uniqueness: trend.uniqueness,
        }
      : {},
  };

  const imageSeo = await processFeaturedImage(payload, settings);
  Object.assign(payload, imageSeo);
  payload.internalLinks = await buildInternalLinks(payload, settings);
  const inserted = insertInternalLinks(payload.content, payload.internalLinks, settings);
  payload.content = inserted.content;
  payload.insertedLinksReport = inserted.report;

  const seo = enrichSeo(payload);
  const duplicateCheck = await checkDuplicate(payload, settings);
  const reasons = [...seo.guardrailReasons];
  if (!duplicateCheck.passed) reasons.push(`Duplicate similarity too high (${duplicateCheck.maxSimilarity.toFixed(2)}).`);
  if (settings.requireInternalLinks && !payload.internalLinks.length) reasons.push('Internal links are required.');
  if (research.failed) reasons.push('Research failed.');

  const passes =
    seo.seoScore >= (settings.minimumSeoScore || 70) &&
    seo.qualityScore >= (settings.minimumQualityScore || 70) &&
    duplicateCheck.passed &&
    (!settings.requireInternalLinks || payload.internalLinks.length > 0) &&
    !research.failed &&
    payload.faq.length > 0 &&
    payload.cta.label &&
    payload.content &&
    payload.content.length > 2500;
  const canPublish = passes && settings.autoPublishMode === 'publish-if-safe';

  return {
    ...payload,
    ...seo,
    duplicateCheck,
    guardrailStatus: passes ? 'passed' : 'failed',
    guardrailReasons: passes ? [] : reasons,
    status: canPublish ? 'published' : 'draft',
    publishedAt: canPublish ? new Date() : null,
  };
}

async function generateArticle({ topic, language = 'en', autoPublish = null } = {}) {
  const settings = await getSettings();
  const finalSettings = autoPublish === null ? settings : { ...settings.toObject(), autoPublish };
  let selectedTopic = topic;
  let trend = null;

  if (!selectedTopic) {
    const research = await runTrendResearch(settings);
    trend = research.bestTopic;
    selectedTopic = trend?.topic;
  }

  if (!selectedTopic) {
    throw new Error('No valid travel topic was found.');
  }

  const payload = await buildPostPayload({
    topic: selectedTopic,
    language,
    settings: finalSettings,
    trend,
  });

  const post = await BlogPost.create(payload);
  await recordGenerationUsage({ estimatedTokens: 4500, articleCount: 1 });
  return post;
}

async function generateMultilingualArticle({ topic, languages, autoPublish = null } = {}) {
  const settings = await getSettings();
  const enabled = languages?.length ? languages : settings.enabledLanguages;
  const group = crypto.randomBytes(8).toString('hex');
  const posts = [];

  for (const language of enabled.filter((item) => ['en', 'ar', 'de'].includes(item))) {
    const post = await generateArticle({ topic, language, autoPublish });
    post.translationGroup = group;
    await post.save();
    posts.push(post);
  }

  return posts;
}

module.exports = {
  generateArticle,
  generateMultilingualArticle,
  getSettings,
  makeSlug,
};
