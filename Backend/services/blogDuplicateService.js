const OpenAI = require('openai');
const BlogPost = require('../models/BlogPost');
const { wordCount } = require('./blogSeoService');

const GENERIC_TRAVEL_TERMS = new Set([
  'travel',
  'traveler',
  'travelers',
  'flight',
  'flights',
  'booking',
  'book',
  'airport',
  'airports',
  'baggage',
  'hotel',
  'hotels',
  'rental',
  'route',
  'routes',
  'options',
  'compare',
  'skybridge',
  'guide',
  'tips',
  'planning',
  'practical',
  'journey',
  'itinerary',
  'terminal',
  'terminals',
  'check-in',
  'checkin',
  'boarding',
  'departure',
  'arrival',
  'connection',
  'connections',
  'layover',
  'fare',
  'fares',
  'airline',
  'airlines',
  'luggage',
  'passport',
  'visa',
  'documents',
]);

const AIRLINE_AND_AIRPORT_TERMS_RE =
  /\b(lufthansa|emirates|turkish airlines|pegasus|qatar airways|eurowings|ryanair|easyjet|wizz air|frankfurt airport|berlin airport|munich airport|istanbul airport|dubai airport|beirut airport|terminal|gate|boarding pass|check-in desk|security check|baggage drop)\b/gi;

function normalizeComparisonText(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/(^|\n)#{1,6}\s+.*$/g, ' ')
    .replace(/##\s*(faq|frequently asked questions)[\s\S]*?(?=\n##\s+|$)/gi, ' ')
    .replace(/##\s*(final tips.*|.*cta.*|.*skybridge.*|continue.*|book.*next.*)[\s\S]*?(?=\n##\s+|$)/gi, ' ')
    .replace(/frequently asked questions|final tips|budget tips|common mistakes|call to action|cta/gi, ' ')
    .replace(/skybridge flights/gi, ' ')
    .replace(AIRLINE_AND_AIRPORT_TERMS_RE, ' ')
    .replace(/compare (flight|travel) options|check baggage rules|review fare rules|confirm documents|book before departure/gi, ' ')
    .replace(/\b(families|business travelers|budget travelers|solo travelers) should\b/gi, ' ')
    .replace(/\s+/g, ' ');
}

function tokenize(value = '') {
  return normalizeComparisonText(value)
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !GENERIC_TRAVEL_TERMS.has(token));
}

function jaccard(a, b) {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((item) => right.has(item)).length;
  const union = new Set([...left, ...right]).size;
  return intersection / union;
}

function cosine(left = [], right = []) {
  if (!left.length || !right.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftMag = 0;
  let rightMag = 0;
  for (let i = 0; i < left.length; i += 1) {
    dot += left[i] * right[i];
    leftMag += left[i] * left[i];
    rightMag += right[i] * right[i];
  }
  return dot / (Math.sqrt(leftMag) * Math.sqrt(rightMag));
}

async function getEmbedding(text) {
  if (!process.env.OPENAI_API_KEY || (process.env.AI_PROVIDER && process.env.AI_PROVIDER !== 'openai')) {
    return null;
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.embeddings.create({
    model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    input: String(text || '').slice(0, 7000),
  });
  return response.data?.[0]?.embedding || null;
}

async function checkDuplicate(candidate, settings = {}) {
  const threshold = settings.semanticSimilarityThreshold || 0.9;
  const publishThreshold = Math.max(threshold, settings.publishSimilarityThreshold || 0.94);
  const existing = await BlogPost.find({
    status: { $in: ['draft', 'scheduled', 'published'] },
    language: candidate.language || 'en',
  })
    .select('title excerpt content slug language topicKey')
    .limit(80)
    .lean();

  let method = 'keyword-title';
  let maxSimilarity = 0;
  let matchedPost = null;
  const candidateText = normalizeComparisonText(`${candidate.excerpt || ''} ${String(candidate.content || '').slice(0, 7000)}`);
  const candidateEmbedding = await getEmbedding(candidateText);
  if (candidateEmbedding) method = 'embedding';

  for (const post of existing) {
    const postText = normalizeComparisonText(`${post.excerpt || ''} ${String(post.content || '').slice(0, 7000)}`);
    const titleSimilarity = jaccard(candidate.title, post.title);
    const bodySimilarity = jaccard(candidateText, postText);
    const sameTopicAdjustment =
      candidate.topicKey && post.topicKey && candidate.topicKey === post.topicKey ? -0.08 : 0;
    let similarity = Math.max(bodySimilarity, bodySimilarity * 0.8 + titleSimilarity * 0.2) + sameTopicAdjustment;

    if (candidateEmbedding) {
      const postEmbedding = await getEmbedding(postText);
      const embeddingSimilarity = cosine(candidateEmbedding, postEmbedding || []);
      similarity = Math.max(similarity, embeddingSimilarity * 0.9 + titleSimilarity * 0.1 + sameTopicAdjustment);
    }
    similarity = Math.max(0, Math.min(1, similarity));

    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      matchedPost = post._id;
    }
  }

  const tooShortPenalty = wordCount(candidate.content || '') < 500 ? 0.05 : 0;
  maxSimilarity = Math.min(1, maxSimilarity + tooShortPenalty);

  return {
    maxSimilarity,
    matchedPost,
    method,
    passed: maxSimilarity < threshold,
    publishPassed: maxSimilarity < publishThreshold,
    threshold,
    publishThreshold,
    checkedAt: new Date(),
  };
}

function getPublishDuplicateThreshold(settings = {}) {
  const draftThreshold = settings.semanticSimilarityThreshold || 0.9;
  return Math.max(draftThreshold, settings.publishSimilarityThreshold || 0.94);
}

function evaluateDuplicateForValidation(duplicateCheck = {}, settings = {}, validationPath = 'draft-validation') {
  const draftThreshold = settings.semanticSimilarityThreshold || duplicateCheck.threshold || 0.9;
  const publishThreshold = getPublishDuplicateThreshold(settings);
  const thresholdUsed = validationPath === 'publish-validation' ? publishThreshold : draftThreshold;
  const duplicateScore = Number(duplicateCheck.maxSimilarity || 0);
  const publishAllowed = duplicateScore < thresholdUsed;
  return {
    duplicateScore,
    thresholdUsed,
    validationPath,
    publishAllowed,
    draftThreshold,
    publishThreshold,
  };
}

module.exports = {
  checkDuplicate,
  evaluateDuplicateForValidation,
  getPublishDuplicateThreshold,
  jaccard,
  normalizeComparisonText,
};
