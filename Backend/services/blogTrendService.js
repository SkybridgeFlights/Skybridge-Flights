const axios = require('axios');
const BlogPost = require('../models/BlogPost');
const BlogTopicPerformance = require('../models/BlogTopicPerformance');

const ALLOWED_RE = /(flight|travel|airport|baggage|airline|cheap ticket|cheap flight|family travel|pet travel|visa|hotel|car rental|destination|dubai|turkey|istanbul|germany|europe|middle east|lebanon|syria|beirut|berlin|frankfurt|munich)/i;
const BLOCKED_RE = /(crypto|casino|loan|adult|politics|weapon|medical diagnosis|stock trading)/i;

function topicKey(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, '-').replace(/^-|-$/g, '');
}

function inferCategory(topic = '') {
  const value = topic.toLowerCase();
  if (value.includes('baggage')) return 'baggage';
  if (value.includes('visa')) return 'visa-travel-tips';
  if (value.includes('hotel')) return 'hotels';
  if (value.includes('car rental')) return 'car-rental';
  if (value.includes('airport')) return 'airports';
  if (value.includes('family')) return 'family-travel';
  if (value.includes('pet')) return 'pet-travel';
  if (value.includes('cheap')) return 'cheap-flights';
  if (value.includes('airline')) return 'airline-rules';
  if (value.includes('dubai') || value.includes('turkey') || value.includes('lebanon') || value.includes('europe')) return 'destinations';
  return 'travel';
}

function isAllowedTopic(topic, settings = {}) {
  const text = String(topic || '');
  if (!text || BLOCKED_RE.test(text) || !ALLOWED_RE.test(text)) return false;
  const forbidden = settings.forbiddenTopics || [];
  return !forbidden.some((item) => item && text.toLowerCase().includes(String(item).toLowerCase()));
}

async function fetchGoogleSuggestions(seed) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(seed)}`;
  const { data } = await axios.get(url, { timeout: 5000 });
  return Array.isArray(data?.[1]) ? data[1] : [];
}

async function fetchProviderTopics(settings = {}) {
  const topics = [];
  const seeds = settings.trendSeedKeywords || [];

  if (process.env.TREND_PROVIDER_URL && process.env.TREND_PROVIDER_KEY) {
    try {
      const { data } = await axios.get(process.env.TREND_PROVIDER_URL, {
        timeout: 7000,
        headers: { Authorization: `Bearer ${process.env.TREND_PROVIDER_KEY}` },
      });
      const externalTopics = Array.isArray(data) ? data : data?.topics;
      if (Array.isArray(externalTopics)) {
        externalTopics.forEach((item) => topics.push(typeof item === 'string' ? item : item.topic || item.keyword));
      }
    } catch (error) {
      console.warn('Trend provider failed, using fallback seeds:', error.message);
    }
  }

  if (process.env.GOOGLE_TRENDS_API_KEY || settings.trendProvider === 'google-suggestions') {
    for (const seed of seeds.slice(0, 5)) {
      try {
        const suggestions = await fetchGoogleSuggestions(seed);
        topics.push(...suggestions);
      } catch (error) {
        console.warn('Google suggestions failed:', error.message);
      }
    }
  }

  topics.push(...seeds);
  return [...new Set(topics.filter(Boolean))];
}

async function scoreTopic(topic, settings = {}) {
  const key = topicKey(topic);
  const category = inferCategory(topic);
  const existing = await BlogPost.countDocuments({ topicKey: key });
  const perf = await BlogTopicPerformance.findOne({ topicKey: key }).lean();
  const lower = topic.toLowerCase();

  const trendStrength = Math.min(100, 45 + Math.min(topic.length, 45));
  const seoPotential = /(cheap|guide|rules|tips|best|airport|visa|baggage)/i.test(topic) ? 85 : 65;
  const businessRelevance = /(flight|cheap|booking|hotel|car rental|airport|visa)/i.test(topic) ? 90 : 70;
  const bookingIntent = /(cheap|flight|booking|hotel|car rental|airport transfer)/i.test(topic) ? 90 : 55;
  const seasonality = /(summer|winter|holiday|family|school|ramadan|christmas|new year)/i.test(lower) ? 85 : 60;
  const languageCountryRelevance = /(germany|europe|turkey|dubai|middle east|lebanon|syria|berlin|frankfurt|munich|istanbul)/i.test(topic) ? 95 : 65;
  const uniqueness = Math.max(10, 100 - existing * 35);
  const learningBoost = perf ? Math.min(15, perf.score / 10) : 0;

  const allowedCategory =
    !settings.allowedTopicCategories?.length || settings.allowedTopicCategories.includes(category);

  const score = allowedCategory
    ? Math.round(
        trendStrength * 0.15 +
          seoPotential * 0.18 +
          businessRelevance * 0.22 +
          bookingIntent * 0.18 +
          seasonality * 0.08 +
          languageCountryRelevance * 0.09 +
          uniqueness * 0.1 +
          learningBoost
      )
    : 0;

  return {
    topic,
    topicKey: key,
    category,
    score,
    trendStrength,
    seoPotential,
    businessRelevance,
    bookingIntent,
    seasonality,
    languageCountryRelevance,
    uniqueness,
    source: process.env.TREND_PROVIDER_URL ? 'external-provider' : 'manual-seeds',
  };
}

async function runTrendResearch(settings = {}) {
  const rawTopics = await fetchProviderTopics(settings);
  const filtered = rawTopics.filter((topic) => isAllowedTopic(topic, settings));
  const scored = await Promise.all(filtered.map((topic) => scoreTopic(topic, settings)));
  const topics = scored.sort((a, b) => b.score - a.score).slice(0, 20);
  return {
    generatedAt: new Date(),
    topics,
    bestTopic: topics[0] || null,
  };
}

module.exports = {
  inferCategory,
  isAllowedTopic,
  runTrendResearch,
  scoreTopic,
  topicKey,
};
