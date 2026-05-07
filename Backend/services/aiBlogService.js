const crypto = require('crypto');
const OpenAI = require('openai');
const BlogPost = require('../models/BlogPost');
const BlogSettings = require('../models/BlogSettings');
const { enrichSeo, wordCount } = require('./blogSeoService');
const {
  getExistingTopicInventory,
  inferCategory,
  isAllowedTopic,
  runTrendResearch,
  topicKey,
} = require('./blogTrendService');
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

const TRAVEL_SECTION_BANK = [
  {
    heading: 'Best booking times',
    body:
      'Start by comparing several date windows instead of locking the trip to one departure day. Travelers often get a clearer view of value when they compare weekday and weekend departures, early morning and evening flights, and nearby airports in the same search session. For trips from Germany or Europe toward Turkey, Dubai, Lebanon, Syria, or the wider Middle East, the best option is usually the itinerary that balances total travel time, baggage rules, airport transfers, and arrival convenience. Keep hotel check-in times, car rental pickup hours, and family needs in the same decision so the cheapest ticket does not become the most expensive overall journey.',
  },
  {
    heading: 'Cheapest months and flexible dates',
    body:
      'Flexible travel months can make route planning easier because demand changes around school holidays, major events, religious holidays, and summer travel peaks. Instead of making unverifiable promises about exact prices, compare low, shoulder, and high travel periods for the destination and then check live fares before payment. Budget travelers should also compare one-way combinations, nearby departure airports, and realistic connection times. The strongest plan keeps a flexible date range ready, then uses Skybridge Flights to compare current options when the traveler is ready to book.',
  },
  {
    heading: 'Airline and fare tips',
    body:
      'A low fare can include different rules depending on the airline, cabin, route, and booking channel. Review the operating airline, checked baggage allowance, hand luggage size, seat selection, change rules, refund conditions, and payment fees before confirming the itinerary. Connecting flights deserve extra attention because a protected connection is different from separate tickets. If the trip includes children, older travelers, pets, or checked baggage, the best airline choice may be the one with clearer rules and a more realistic transfer window rather than the lowest headline price.',
  },
  {
    heading: 'Hidden fees to check before payment',
    body:
      'Hidden fees usually appear when travelers compare only the base ticket price. Before payment, check baggage upgrades, airport check-in fees, seat selection, payment fees, priority boarding, name correction rules, pet fees, stroller handling, sports equipment, and changes after booking. Hotel arrival time, airport transfer cost, and car rental office hours can also change the real trip cost. A practical booking process calculates the total travel day, not only the ticket. This makes it easier to choose an itinerary that supports the full journey from home to airport to destination.',
  },
  {
    heading: 'Airport advice for smoother travel',
    body:
      'Airport planning is especially important on routes with international connections, checked baggage, visa checks, or separate ground transport. Arrive early enough for document checks and baggage drop, keep confirmation numbers accessible offline, and confirm the terminal before departure. Families should plan extra time for security, snacks, strollers, and boarding. Business travelers should confirm lounge access, Wi-Fi needs, and arrival transfer time. Pet travelers should confirm carrier rules and check-in steps before the airport day so the journey does not depend on last-minute decisions.',
  },
  {
    heading: 'Budget traveler tips',
    body:
      'Budget travelers get better results when they compare the full itinerary. A cheaper airport can be useful if transport is simple, but it can lose value if the transfer is long, late, or expensive. Pack within the included baggage rules, avoid unnecessary paid extras, and keep a backup arrival plan. Compare flight, hotel, and car rental needs together because the best flight time may reduce one hotel night or avoid a costly late transfer. Use internal planning links and booking pages only where they help the traveler make a natural next decision.',
  },
  {
    heading: 'Family travel advice',
    body:
      'Family travel works best when the itinerary reduces friction. Choose connection times that leave space for bathroom breaks, snacks, stroller handling, and unexpected queues. Keep passports, visas, hotel details, medicine, and emergency contacts organized in one place. If children need specific seats, meals, or baggage items, check the airline rules before payment. Families often benefit from a slightly simpler route, even if another ticket looks cheaper at first glance, because fewer rushed steps can reduce missed connections and airport stress.',
  },
  {
    heading: 'Business traveler advice',
    body:
      'Business travelers should focus on reliability, arrival timing, and recovery time after landing. Consider whether the route allows enough margin before a meeting, whether the airport has practical transfer options, and whether baggage or schedule changes could affect the workday. A direct flight can be valuable when the meeting schedule is tight, while a connecting option may work if the fare rules are clear and the connection is realistic. Store confirmations and support contacts offline so urgent changes can be handled without searching through email at the airport.',
  },
  {
    heading: 'Safety and travel readiness',
    body:
      'Travel rules can change, so avoid relying on memory or unsourced social media posts. Check passport validity, visa or transit requirements, airline notices, destination entry rules, baggage restrictions, and local airport guidance with official sources before departure. This guide is for general travel planning and does not replace official airline, embassy, airport, or destination authority information. The safest booking approach is evergreen: know what to verify, confirm the details before payment, and check again before traveling.',
  },
];

const TITLE_PATTERNS = [
  'Practical Travel Guide to {topic}',
  '{topic}: Flights, Airports, Baggage, and Booking Tips',
  'How to Plan {topic} Without Costly Travel Mistakes',
  'Skybridge Guide to {topic} for Smarter Booking',
  '{topic} Travel Planning: Routes, Fees, and Airport Advice',
];

const CTA_VARIANTS = [
  {
    heading: 'Book the next step with Skybridge Flights',
    label: 'Compare travel options with Skybridge Flights',
    body:
      'When the route, baggage needs, and timing are clear, continue with Skybridge Flights to compare flight options and connect the trip with hotels, car rental, visa support, contact help, or WhatsApp support where available. Use this guide as the planning layer, then make the booking decision from current availability instead of assumptions.',
  },
  {
    heading: 'Turn the plan into a booking',
    label: 'Search flights with Skybridge Flights',
    body:
      'Use Skybridge Flights when you are ready to move from research to action. Compare flight choices, check related travel services, and choose the support path that matches the trip. This is especially useful when the journey includes baggage questions, family needs, hotel timing, car rental pickup, or destination planning.',
  },
  {
    heading: 'Continue with Skybridge Flights',
    label: 'Plan your trip with Skybridge Flights',
    body:
      'A strong travel plan should end with a clear next step. Skybridge Flights helps travelers compare routes and continue toward booking services without losing the details that matter: baggage, airport timing, destination needs, hotel plans, car rental, and support for complex itineraries.',
  },
];

const TRAVELER_PERSONAS = ['budget traveler', 'family traveler', 'business traveler', 'solo traveler'];
const TOPIC_ANGLES = [
  'route value and flexible airport planning',
  'baggage, fare rules, and hidden cost prevention',
  'family comfort, timing, and smoother airport movement',
  'business timing, reliability, and arrival planning',
  'budget control with hotels, car rental, and transfers included',
];

const EXTRA_SECTION_BANK = [
  {
    heading: 'Practical route example',
    body:
      'A practical example is a traveler comparing a morning departure from a larger airport with an evening departure from a nearby regional airport. The cheaper fare may look attractive, but the final decision should include transfer time, baggage price, hotel arrival, airport check-in pressure, and whether the traveler can still reach the destination without rushing. This example keeps the planning realistic: the best route is the one that fits the full travel day, not only the fare shown first.',
  },
  {
    heading: 'Travel documents and support checks',
    body:
      'Before booking, keep passport validity, visa or transit checks, hotel address, booking references, travel insurance details, and emergency contact information in one place. This guide is general travel planning information, so travelers should confirm official requirements with airlines, embassies, airport authorities, or destination authorities. The value of planning is knowing what must be verified before payment and what should be checked again before departure.',
  },
];

function logBlogGeneration(event, details = {}) {
  const safeDetails = Object.fromEntries(
    Object.entries(details).filter(([key]) => !/key|secret|token|password/i.test(key))
  );
  console.info('[ai-blog-generation]', event, safeDetails);
}

function makeSlug(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\u0600-\u06FF\s]+/g, '-')
    .replace(/[^a-z0-9\u0600-\u06FF-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function stableIndex(value = '', length = 1) {
  if (!length) return 0;
  const total = String(value)
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return total % length;
}

function uniqueList(items = [], limit = 12) {
  const seen = new Set();
  return items
    .map((item) => String(item || '').trim())
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function generateArticleKeywords(topic, research = {}) {
  const related = [
    ...(research.relatedKeywords || []),
    ...(research.queries || []),
    ...(research.questions || []),
    ...(research.faq || []).map((item) => item.question),
  ];
  const primaryKeyword = String(topic || 'travel planning').trim();
  const secondaryKeywords = uniqueList(
    [
      `${primaryKeyword} flights`,
      `${primaryKeyword} travel tips`,
      `${primaryKeyword} baggage rules`,
      `${primaryKeyword} airport advice`,
      `${primaryKeyword} booking guide`,
      ...related,
    ],
    7
  );
  const semanticKeywords = uniqueList(
    [
      'cheap flights',
      'flight booking',
      'travel planning',
      'airport transfers',
      'hotel planning',
      'car rental',
      'visa travel tips',
      'family travel',
      'business travel',
      'airline baggage',
    ],
    10
  );

  return {
    primaryKeyword,
    secondaryKeywords,
    semanticKeywords,
    allKeywords: uniqueList([primaryKeyword, ...secondaryKeywords, ...semanticKeywords], 14),
  };
}

function buildTitle(topic, language = 'en', variantSeed = '') {
  const pattern = TITLE_PATTERNS[stableIndex(`${topic}-${language}-${variantSeed}`, TITLE_PATTERNS.length)];
  return pattern.replace('{topic}', topic);
}

function buildExcerpt(topic, keywordData) {
  return `Plan ${topic} with practical advice on flights, airports, baggage rules, flexible dates, family needs, hidden fees, hotels, car rental, and the safest next booking steps with Skybridge Flights.`;
}

function buildMetaTitle(topic) {
  const shortTopic = String(topic || 'Travel Planning').replace(/\s+/g, ' ').trim();
  const full = `${shortTopic} Travel Guide | Skybridge`;
  if (full.length <= 65) return full;
  return `${shortTopic.slice(0, 44).replace(/\s+\S*$/, '')} Guide | Skybridge`;
}

function buildMetaDescription(topic) {
  const cleanTopic = String(topic || 'travel planning').replace(/\s+/g, ' ').trim();
  const templates = [
    `Plan ${cleanTopic} with route advice, baggage tips, airport timing, hotels, car rental, and Skybridge booking support.`,
    `${cleanTopic} guide with practical flight, baggage, airport, hotel, car rental, family, business, and booking tips.`,
    `Compare ${cleanTopic} with practical airport, baggage, route, hotel, car rental, and Skybridge Flights booking advice.`,
  ];
  const fit = templates.find((item) => item.length >= 120 && item.length <= 160);
  if (fit) return fit;
  const compactTopic = cleanTopic.length > 42 ? cleanTopic.slice(0, 42).replace(/\s+\S*$/, '') : cleanTopic;
  return `Plan ${compactTopic} with flight route advice, baggage tips, airport timing, hotels, car rental, and booking support.`;
}

function buildFaq(topic, keywordData, persona = 'traveler') {
  const primary = keywordData.primaryKeyword;
  const variants = [
    {
      question: `What is the best way to start planning ${primary}?`,
      answer:
        'Start with flexible travel dates, nearby airports, baggage needs, document checks, hotel timing, and the travelers in the group before comparing live flight options.',
    },
    {
      question: `How can travelers find better value for ${primary}?`,
      answer:
        'Compare total trip value, including baggage, airport transfers, arrival time, hotel check-in, car rental pickup, and connection comfort instead of only the base ticket price.',
    },
    {
      question: `What should a ${persona} check first for ${primary}?`,
      answer:
        'Check dates, route options, baggage rules, airport transfer time, hotel timing, and support needs first, then compare the live booking options that match those requirements.',
    },
    {
      question: `Which hidden fees should travelers check before booking ${primary}?`,
      answer:
        'Check checked baggage, cabin baggage, seat selection, payment fees, airport check-in charges, change rules, pet fees, and transfer costs before payment.',
    },
    {
      question: `Is ${primary} suitable for families or business travelers?`,
      answer:
        'It can be suitable when the itinerary includes realistic airport time, clear baggage rules, reliable transfer options, and enough margin for children, work schedules, or special needs.',
    },
    {
      question: 'Can Skybridge Flights help after research is complete?',
      answer:
        'Yes. Skybridge Flights helps travelers continue from planning into flight comparison, hotels, car rental, visa-related travel support, contact options, and WhatsApp support where available.',
    },
  ];
  const start = stableIndex(`${primary}-${persona}-faq`, variants.length);
  return [...variants.slice(start), ...variants.slice(0, start)].slice(0, 5);
}

function faqMarkdown(faq = []) {
  return faq
    .filter((item) => item.question && item.answer)
    .map((item) => `### ${item.question}\n${item.answer}`)
    .join('\n\n');
}

function selectSections(topic, language = 'en', angle = '') {
  const start = stableIndex(`${topic}-${language}`, TRAVEL_SECTION_BANK.length);
  const rotated = [...TRAVEL_SECTION_BANK.slice(start), ...TRAVEL_SECTION_BANK.slice(0, start)];
  const angleShift = stableIndex(angle, Math.max(1, rotated.length));
  const angled = [...rotated.slice(angleShift), ...rotated.slice(0, angleShift)];
  return angled.slice(0, 5);
}

function buildStructuredContent({ title, topic, language, keywordData, faq, ctaVariant }) {
  const persona = TRAVELER_PERSONAS[stableIndex(`${topic}-${language}-persona-${Date.now()}`, TRAVELER_PERSONAS.length)];
  const angle = TOPIC_ANGLES[stableIndex(`${topic}-${language}-angle-${crypto.randomBytes(2).toString('hex')}`, TOPIC_ANGLES.length)];
  const sections = selectSections(topic, language, angle);
  const introOptions = [
    `${topic} is easier to plan when a ${persona} compares the full journey instead of only the ticket price. This guide uses the angle of ${angle}, so the advice covers flights, airports, baggage, seasonal demand, documents, hotels, car rental, and realistic booking steps before committing to an itinerary.`,
    `A strong plan for ${topic} starts with the route, the people traveling, and the costs that appear after the fare is selected. For a ${persona}, the useful decision is shaped by ${angle}, not by a single fare screenshot.`,
    `Travelers researching ${topic} need more than a list of flight options. This guide focuses on ${angle} for a ${persona}, with practical examples that connect dates, baggage, airport transfers, support needs, and the final booking step.`,
  ];
  const intro = introOptions[stableIndex(`${topic}-${language}-intro-${crypto.randomBytes(2).toString('hex')}`, introOptions.length)];
  const keywordLine = `The primary planning keyword is ${keywordData.primaryKeyword}, supported naturally by ${keywordData.secondaryKeywords
    .slice(0, 3)
    .join(', ')}.`;
  const mistakeBodies = [
    'The most common mistake is choosing the cheapest fare before checking baggage, transfer time, connection protection, hotel arrival, and destination rules. Another mistake is assuming every nearby airport saves money after transport is included. Travelers should also avoid separate tickets unless they understand the risk of missed connections. A final mistake is leaving document checks until the airport day, because visa, transit, passport, and airline requirements should be verified before payment.',
    'Many travelers lose value by comparing only departure time and ticket price. The better comparison includes checked baggage, cabin bag size, family seating, pet rules, car rental pickup, hotel check-in, and the cost of arriving late. A careful traveler also avoids vague advice from unofficial sources and confirms route-specific rules with the airline or destination authority before departure.',
  ];
  const budgetBodies = [
    'Budget planning works best when the traveler sets a total trip target before searching. Include the fare, bags, seats, airport transport, hotel timing, car rental, meals during long connections, and the cost of changing plans. Flexible dates and nearby airports can help, but only when the transfer remains simple. The practical goal is not the lowest visible price; it is the route that protects the budget through the whole journey.',
    'For budget travelers, the strongest move is to compare a small group of realistic itineraries side by side. Write down included baggage, arrival time, transfer cost, hotel impact, and whether the route is comfortable for the people traveling. A slightly higher fare can be better value if it avoids a paid bag, a late taxi, or an extra hotel night.',
  ];

  return `# ${title}

${intro} ${keywordLine}

${sections
  .map((section, index) => {
    const h3 =
      index % 3 === 1
        ? `\n\n### Quick action tip\n${section.body
            .split('. ')
            .slice(0, 2)
            .join('. ')}. Keep this point visible when comparing current booking options.`
        : '';
    return `## ${section.heading}\n${section.body}${h3}`;
  })
  .join('\n\n')}

## Budget Tips
${budgetBodies[stableIndex(`${topic}-${persona}-budget`, budgetBodies.length)]}

## Common Mistakes
${mistakeBodies[stableIndex(`${topic}-${angle}-mistakes`, mistakeBodies.length)]}

${EXTRA_SECTION_BANK.map((section) => `## ${section.heading}\n${section.body}`).join('\n\n')}

## FAQ
${faqMarkdown(faq)}

## Final Tips / CTA
${ctaVariant.body}`;
}

function countMarkdownHeadings(content = '', level = 2) {
  const marker = '#'.repeat(level);
  const pattern = new RegExp(`(^|\\n)${marker}\\s+`, 'g');
  return (String(content).match(pattern) || []).length;
}

function hasFaqSection(content = '') {
  return /frequently asked questions|^##\s+faq|^##\s+questions/i.test(String(content));
}

function hasCtaSection(content = '') {
  return /(^|\n)##\s+.*(skybridge|book|continue|next step|booking)|compare travel options with Skybridge|search flights with Skybridge/i.test(
    String(content)
  );
}

function normalizeGeneratedArticle(article, topic, language = 'en', research = {}) {
  const keywordData = generateArticleKeywords(topic, research);
  const variantSeed = `${article?.title || topic}-${Date.now()}`;
  const title = article?.title && String(article.title).length > 20 ? article.title : buildTitle(topic, language, variantSeed);
  const persona = TRAVELER_PERSONAS[stableIndex(`${topic}-${language}-faq-persona-${Date.now()}`, TRAVELER_PERSONAS.length)];
  const faq = Array.isArray(article?.faq) && article.faq.length >= 5 ? article.faq : buildFaq(topic, keywordData, persona);
  const ctaVariant = CTA_VARIANTS[stableIndex(`${topic}-${language}-cta`, CTA_VARIANTS.length)];
  const existingContent = String(article?.content || '').trim();
  const needsStructure =
    !existingContent ||
    wordCount(existingContent) < 1400 ||
    countMarkdownHeadings(existingContent, 1) < 1 ||
    countMarkdownHeadings(existingContent, 2) < 5 ||
    !hasFaqSection(existingContent) ||
    !hasCtaSection(existingContent);
  let content = needsStructure
    ? buildStructuredContent({ title, topic, language, keywordData, faq, ctaVariant })
    : existingContent;

  if (!/^#\s+/m.test(content)) content = `# ${title}\n\n${content}`;
  if (!hasFaqSection(content)) content += `\n\n## Frequently asked questions\n${faqMarkdown(faq)}`;
  if (!hasCtaSection(content)) content += `\n\n## ${ctaVariant.heading}\n${ctaVariant.body}`;
  if (wordCount(content) < 1400) {
    const extraSections = [
      ...selectSections(`${topic}-extended-${crypto.randomBytes(2).toString('hex')}`, language, 'extended planning'),
      ...EXTRA_SECTION_BANK,
    ].slice(0, 4);
    content += `\n\n${extraSections.map((section) => `## ${section.heading}\n${section.body}`).join('\n\n')}`;
  }
  if (wordCount(content) < 1400) {
    content += `\n\n## Final route planning checklist\nUse this final checklist before booking ${topic}: compare at least two date windows, confirm the operating airline, review baggage and seat costs, check airport transfer time, keep documents ready, compare hotel and car rental timing, and choose the route that leaves enough margin for the traveler persona. This last review helps the article become actionable instead of generic, and it gives the traveler a direct reason to continue into Skybridge Flights booking tools with clearer expectations.`;
  }

  return {
    ...article,
    title,
    excerpt: article?.excerpt && String(article.excerpt).length >= 80 ? article.excerpt : buildExcerpt(topic, keywordData),
    content,
    metaTitle:
      article?.metaTitle && String(article.metaTitle).length >= 35 && String(article.metaTitle).length <= 65
        ? article.metaTitle
        : buildMetaTitle(topic),
    metaDescription:
      article?.metaDescription &&
      String(article.metaDescription).length >= 120 &&
      String(article.metaDescription).length <= 170
        ? article.metaDescription
        : buildMetaDescription(topic),
    primaryKeyword: article?.primaryKeyword || keywordData.primaryKeyword,
    secondaryKeywords: uniqueList([...(article?.secondaryKeywords || []), ...keywordData.secondaryKeywords], 8),
    semanticKeywords: uniqueList([...(article?.semanticKeywords || []), ...keywordData.semanticKeywords], 10),
    keywords: uniqueList([...(article?.keywords || []), ...keywordData.allKeywords], 14),
    tags: uniqueList([...(article?.tags || []), 'flights', 'travel', 'booking', inferCategory(topic)], 8),
    faq,
    imagePrompt:
      article?.imagePrompt ||
      `Realistic editorial travel image for ${topic}, airport planning, travelers, bright professional style`,
    imageAltText: article?.imageAltText || `Travel planning image for ${topic}`,
    internalLinkSuggestions: uniqueList([
      ...(article?.internalLinkSuggestions || []),
      '/flights',
      '/hotels',
      '/cars',
      '/visa',
      '/contact',
    ]),
    ctaLabel: ctaVariant.label,
  };
}

function diversifyForDuplicate(payload, topic, language = 'en') {
  const title = buildTitle(topic, language, `duplicate-${crypto.randomBytes(2).toString('hex')}`);
  const intro =
    `# ${title}\n\nThis version takes a more specific planning angle for ${topic}: comparing airports, fare rules, travel months, baggage choices, and booking support before the traveler pays for the itinerary. The goal is to make the article useful without repeating earlier Skybridge Flights guides.`;
  const content = String(payload.content || '').replace(/^#\s+.*?(\n\n|$)[\s\S]*?((^##\s+)|$)/m, `${intro}\n\n$3`);
  return {
    title,
    slug: `${makeSlug(title)}-${crypto.randomBytes(2).toString('hex')}`,
    metaTitle: buildMetaTitle(`${topic} Smarter Booking`),
    seoTitle: buildMetaTitle(`${topic} Smarter Booking`),
    content: content || payload.content,
  };
}

async function getSettings() {
  return BlogSettings.findOneAndUpdate(
    { singletonKey: 'ai-blog-settings' },
    { $setOnInsert: { singletonKey: 'ai-blog-settings' } },
    { new: true, upsert: true }
  );
}

function fallbackArticle(topic, language = 'en') {
  return normalizeGeneratedArticle({}, topic, language, {});
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
          'You write long-form evergreen travel SEO articles for Skybridge Flights. Return only valid JSON. Avoid current factual claims unless sourced. Do not give medical, legal, or financial advice. Use unique wording, practical travel advice, and natural booking CTAs.',
      },
      {
        role: 'user',
        content: `Create a high-quality ${LANGUAGE_NAMES[language] || 'English'} article about "${topic}". It must be only about flights, travel, airports, baggage, airline rules, cheap flights, family travel, pet travel, visa/travel tips, hotels, car rental, or relevant destinations in Germany, Europe, Turkey, Dubai, Middle East, Lebanon, or Syria.

Generation requirements:
- 1400-1900 words of useful long-form content.
- Markdown content with exactly one H1 title, at least 8 H2 sections, and at least one useful H3 subsection.
- Required article flow: H1 title, non-generic intro, five detailed H2 sections, ## Budget Tips, ## Common Mistakes, ## FAQ, and ## Final Tips / CTA.
- Include sections or equivalent coverage for best booking times, cheapest months, airline tips, hidden fees, airport advice, budget traveler tips, family travel advice, business traveler advice, and safety/travel readiness.
- Include practical travel advice, actionable tips, and no generic filler.
- Add topic-angle variation and write for one traveler persona: budget traveler, family traveler, business traveler, or solo traveler.
- Use unique wording and avoid repetitive intros, repeated CTA wording, repeated FAQ wording, and copied section order.
- Include a FAQ section in the content and also return faq as structured JSON with at least 5 items.
- Include a CTA section related to Skybridge Flights booking/search/hotel/car rental/visa/contact/WhatsApp services.
- Generate and naturally use one primary keyword, 5-8 secondary keywords, and 6-10 semantic related keywords.
- Suggest natural internal links to Skybridge service or related content pages without spammy overlinking.
- Avoid unsupported current claims and avoid exact facts that require real-time verification.

Use these research signals: ${JSON.stringify({
          outline: research.outline || [],
          relatedKeywords: research.relatedKeywords || [],
          questions: research.faq || [],
          forbiddenTopics: (research.forbiddenTopics || []).slice(0, 40),
          forbiddenTitles: (research.forbiddenTitles || []).slice(0, 40),
        })}.

Return JSON with:
title, excerpt, content, metaTitle, metaDescription, primaryKeyword, secondaryKeywords array, semanticKeywords array, keywords array, tags array, faq array of {question,answer}, internalLinkSuggestions array, imagePrompt, imageAltText.`,
      },
    ],
  });

  return normalizeGeneratedArticle(parseJsonResponse(response.choices?.[0]?.message?.content), topic, language, research);
}

function duplicateTopicError(topic) {
  const error = new Error('Duplicate topic or title detected.');
  error.code = 'DUPLICATE_TOPIC_TITLE';
  error.topic = topic;
  return error;
}

async function buildPostPayload({ topic, language = 'en', settings, trend, manualTopic = false, runExcludedTopics = [] }) {
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

  if (duplicate && !settings.allowDuplicateDrafts && !manualTopic) {
    throw duplicateTopicError(topic);
  }

  const research = await collectResearch(topic, settings);
  if (research.failed && settings.fallbackResearchEnabled === false) {
    throw new Error(`Research failed and fallback is disabled. ${research.error || ''}`);
  }
  const inventory = await getExistingTopicInventory({ language });
  research.forbiddenTopics = [...new Set([...(inventory.topicKeys || []), ...runExcludedTopics])];
  research.forbiddenTitles = inventory.titles || [];

  const article = normalizeGeneratedArticle(await generateWithOpenAI(topic, language, research), topic, language, research);
  if (manualTopic || settings.allowDuplicateDrafts) {
    const titleExists = await BlogPost.exists({
      title: new RegExp(`^${String(article.title || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      language,
    });
    if (titleExists) {
      const angle = TOPIC_ANGLES[stableIndex(`${topic}-${crypto.randomBytes(2).toString('hex')}`, TOPIC_ANGLES.length)];
      Object.assign(
        article,
        normalizeGeneratedArticle(
          { ...article, title: `${buildTitle(topic, language, 'manual-unique')} for ${angle}` },
          topic,
          language,
          research
        )
      );
    }
  }
  const articleKeywords = uniqueList(
    [
      article.primaryKeyword,
      ...(article.secondaryKeywords || []),
      ...(article.semanticKeywords || []),
      ...(article.keywords || []),
    ],
    14
  );
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
    keywords: articleKeywords,
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
      label: article.ctaLabel || 'Compare travel options with Skybridge Flights',
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

  let seo = enrichSeo(payload);
  let duplicateCheck = await checkDuplicate(payload, settings);
  let publishConfidence = {
    passed: false,
    seoScore: seo.seoScore,
    qualityScore: seo.qualityScore,
    duplicateScore: duplicateCheck.maxSimilarity,
    duplicateThreshold: duplicateCheck.publishThreshold || duplicateCheck.threshold,
    reason: 'Initial guardrails not evaluated',
  };
  logBlogGeneration('qa_scored', {
    topic,
    language,
    seoScore: seo.seoScore,
    qualityScore: seo.qualityScore,
    reasons: seo.guardrailReasons,
    duplicateScore: duplicateCheck.maxSimilarity,
    duplicateThreshold: duplicateCheck.threshold,
    publishDuplicateThreshold: duplicateCheck.publishThreshold,
    duplicateMethod: duplicateCheck.method,
  });
  if (!duplicateCheck.passed) {
    logBlogGeneration('duplicate_regeneration_attempt', {
      topic,
      language,
      duplicateScore: duplicateCheck.maxSimilarity,
      duplicateThreshold: duplicateCheck.threshold,
      publishDuplicateThreshold: duplicateCheck.publishThreshold,
    });
    Object.assign(payload, diversifyForDuplicate(payload, topic, language));
    seo = enrichSeo(payload);
    duplicateCheck = await checkDuplicate(payload, settings);
    logBlogGeneration('duplicate_regeneration_result', {
      topic,
      language,
      seoScore: seo.seoScore,
      qualityScore: seo.qualityScore,
      reasons: seo.guardrailReasons,
      duplicateScore: duplicateCheck.maxSimilarity,
      duplicateThreshold: duplicateCheck.threshold,
    });
  }
  const reasons = [...seo.guardrailReasons];
  publishConfidence = {
    passed:
      seo.seoScore >= 85 &&
      seo.qualityScore >= 80 &&
      duplicateCheck.publishPassed &&
      (!settings.requireInternalLinks || payload.internalLinks.length > 0) &&
      payload.faq.length > 0 &&
      payload.cta.label,
    seoScore: seo.seoScore,
    qualityScore: seo.qualityScore,
    duplicateScore: duplicateCheck.maxSimilarity,
    duplicateThreshold: duplicateCheck.publishThreshold || duplicateCheck.threshold,
    reason: 'High-confidence SEO and quality review flow',
  };
  if (!duplicateCheck.passed && !publishConfidence.passed) {
    reasons.push(
      `Duplicate similarity too high (${duplicateCheck.maxSimilarity.toFixed(2)}; draft threshold ${duplicateCheck.threshold.toFixed(
        2
      )}; publish threshold ${(duplicateCheck.publishThreshold || duplicateCheck.threshold).toFixed(2)}).`
    );
  }
  if (settings.requireInternalLinks && !payload.internalLinks.length) reasons.push('Internal links are required.');
  if (research.failed) reasons.push('Research failed.');

  const passes =
    seo.seoScore >= (settings.minimumSeoScore || 70) &&
    seo.qualityScore >= (settings.minimumQualityScore || 70) &&
    (duplicateCheck.passed || publishConfidence.passed) &&
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
    publishConfidence,
    guardrailStatus: passes ? 'passed' : 'failed',
    guardrailReasons: passes ? [] : reasons,
    status: canPublish ? 'published' : 'draft',
    publishedAt: canPublish ? new Date() : null,
  };
}

async function generateArticle({ topic, language = 'en', autoPublish = null, manualTopicOverride = null } = {}) {
  const settings = await getSettings();
  const finalSettings = autoPublish === null ? settings : { ...settings.toObject(), autoPublish };
  const manualTopic =
    manualTopicOverride === null ? !!String(topic || '').trim() : !!manualTopicOverride;
  const attemptedTopicKeys = [];
  const attempts = manualTopic ? 1 : Math.min(finalSettings.topicRetryAttempts || 5, 5);
  let lastError = null;
  let candidateTopics = [];

  if (manualTopic) {
    candidateTopics = [{ topic, score: 0, source: 'manual-override', category: inferCategory(topic) }];
  } else if (String(topic || '').trim()) {
    const inventory = finalSettings.allowDuplicateDrafts
      ? { titles: [], slugs: [], topicKeys: [], fingerprints: [] }
      : await getExistingTopicInventory({ language });
    const research = await runTrendResearch(finalSettings, {
      inventory,
      language,
      limit: 10,
      excludeTopicKeys: [topicKey(topic), ...attemptedTopicKeys],
    });
    candidateTopics = [
      { topic, score: 0, source: 'auto-selected', category: inferCategory(topic) },
      ...(research.topics || []),
    ];
  } else {
    const inventory = finalSettings.allowDuplicateDrafts
      ? { titles: [], slugs: [], topicKeys: [], fingerprints: [] }
      : await getExistingTopicInventory({ language });
    const research = await runTrendResearch(finalSettings, {
      inventory,
      language,
      limit: 10,
      excludeTopicKeys: attemptedTopicKeys,
    });
    candidateTopics = research.topics || [];
  }

  if (!candidateTopics.length) {
    const error = new Error(`No unique topic found after ${attempts} attempts. Try a more specific topic or clear old drafts.`);
    error.code = 'NO_UNIQUE_TOPIC';
    throw error;
  }

  for (let index = 0; index < Math.min(attempts, candidateTopics.length); index += 1) {
    const trend = candidateTopics[index];
    const selectedTopic = trend?.topic || topic;
    if (!selectedTopic) continue;
    attemptedTopicKeys.push(topicKey(selectedTopic));

    try {
      logBlogGeneration('topic_attempt', {
        topic: selectedTopic,
        language,
        attempt: index + 1,
        maxAttempts: attempts,
        manualTopic,
      });
      const payload = await buildPostPayload({
        topic: selectedTopic,
        language,
        settings: finalSettings,
        trend,
        manualTopic,
        runExcludedTopics: attemptedTopicKeys,
      });

      const post = await BlogPost.create(payload);
      await recordGenerationUsage({ estimatedTokens: 4500, articleCount: 1 });
      return post;
    } catch (error) {
      lastError = error;
      logBlogGeneration('topic_attempt_failed', {
        topic: selectedTopic,
        language,
        attempt: index + 1,
        code: error.code || 'GENERATION_FAILED',
        message: error.message,
      });
      if (manualTopic || error.code !== 'DUPLICATE_TOPIC_TITLE') throw error;
    }
  }

  const error = new Error(
    `No unique topic found after ${attempts} attempts. Try a more specific topic or clear old drafts.`
  );
  error.code = 'NO_UNIQUE_TOPIC';
  error.cause = lastError;
  throw error;
}

async function generateMultilingualArticle({ topic, languages, autoPublish = null, manualTopicOverride = null } = {}) {
  const settings = await getSettings();
  const enabled = languages?.length ? languages : settings.enabledLanguages;
  const group = crypto.randomBytes(8).toString('hex');
  const posts = [];

  for (const language of enabled.filter((item) => ['en', 'ar', 'de'].includes(item))) {
    const post = await generateArticle({ topic, language, autoPublish, manualTopicOverride });
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
  __test: {
    fallbackArticle,
    generateArticleKeywords,
    normalizeGeneratedArticle,
  },
};
