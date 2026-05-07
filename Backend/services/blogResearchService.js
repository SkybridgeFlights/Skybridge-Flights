const axios = require('axios');
const { isAllowedTopic, runTrendResearch } = require('./blogTrendService');

async function googleSuggestions(seed) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(seed)}`;
  const { data } = await axios.get(url, { timeout: 5000 });
  return Array.isArray(data?.[1]) ? data[1] : [];
}

function buildFallbackResearch(topic, settings = {}) {
  const seeds = settings.trendSeedKeywords || [];
  const base = topic || seeds[0] || 'cheap flights from Germany';
  const cluster = [
    base,
    `${base} booking tips`,
    `${base} baggage rules`,
    `${base} airport transfer`,
    `${base} family travel`,
  ];
  return {
    source: 'fallback-evergreen',
    queries: cluster,
    topicCluster: cluster,
    outline: [
      'Route and timing overview',
      'Airport and baggage planning',
      'Documents, visas, and travel readiness',
      'Hotels, car rental, and transfers',
      'Skybridge Flights booking next step',
    ],
    faq: [
      { question: `What should travelers check before booking ${base}?`, answer: 'Check route options, baggage rules, documents, transfer timing, and total trip cost before booking.' },
      { question: 'How can Skybridge Flights help?', answer: 'Skybridge Flights helps travelers compare options and move from research to flight, hotel, car rental, or support actions.' },
    ],
    relatedKeywords: ['flights', 'travel tips', 'airport guide', 'baggage rules', 'Skybridge Flights'],
    internalLinkTargets: [
      { label: 'Search flights', url: '/flights', reason: 'Primary booking action' },
      { label: 'Contact Skybridge Flights', url: '/contact', reason: 'Support action' },
      { label: 'Travel blog', url: '/blog', reason: 'Related guides' },
    ],
    failed: false,
  };
}

async function collectResearch(topic, settings = {}) {
  const signals = [];
  const errors = [];

  try {
    const trends = await runTrendResearch(settings);
    signals.push(...(trends.topics || []).slice(0, 8).map((item) => item.topic));
  } catch (error) {
    errors.push(`Trend research failed: ${error.message}`);
  }

  if (process.env.GOOGLE_TRENDS_API_KEY || settings.trendProvider === 'google-suggestions') {
    try {
      signals.push(...(await googleSuggestions(topic)));
    } catch (error) {
      errors.push(`Google suggestions failed: ${error.message}`);
    }
  }

  if (process.env.PAA_PROVIDER_URL && process.env.TREND_PROVIDER_KEY) {
    try {
      const { data } = await axios.get(process.env.PAA_PROVIDER_URL, {
        timeout: 7000,
        params: { q: topic },
        headers: { Authorization: `Bearer ${process.env.TREND_PROVIDER_KEY}` },
      });
      const items = Array.isArray(data?.questions) ? data.questions : [];
      signals.push(...items);
    } catch (error) {
      errors.push(`Related questions provider failed: ${error.message}`);
    }
  }

  const filtered = [...new Set(signals.filter((item) => isAllowedTopic(item, settings)))];

  if (!filtered.length) {
    if (settings.fallbackResearchEnabled === false) {
      return {
        ...buildFallbackResearch(topic, settings),
        failed: true,
        error: errors.join(' ' ) || 'Research returned no usable signals.',
      };
    }
    return buildFallbackResearch(topic, settings);
  }

  return {
    source: 'research-signals',
    queries: filtered,
    topicCluster: filtered.slice(0, 6),
    outline: [
      `Why ${topic} matters for travelers`,
      'Best route and airport planning points',
      'Baggage, visa, and family travel considerations',
      'Hotels, car rental, transfers, and total trip planning',
      'Booking checklist with Skybridge Flights',
    ],
    faq: filtered.slice(0, 4).map((query) => ({
      question: query.endsWith('?') ? query : `What should travelers know about ${query}?`,
      answer: 'Travelers should verify official requirements, compare practical routes, and consider baggage, transfer, hotel, and booking needs before departure.',
    })),
    relatedKeywords: filtered.slice(0, 10),
    internalLinkTargets: buildFallbackResearch(topic, settings).internalLinkTargets,
    failed: false,
  };
}

module.exports = {
  buildFallbackResearch,
  collectResearch,
};
