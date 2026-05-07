const OpenAI = require('openai');
const BlogPost = require('../models/BlogPost');
const { wordCount } = require('./blogSeoService');

function tokenize(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
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
  const threshold = settings.semanticSimilarityThreshold || 0.82;
  const existing = await BlogPost.find({
    status: { $in: ['draft', 'scheduled', 'published'] },
    language: candidate.language || 'en',
  })
    .select('title excerpt content slug language')
    .limit(80)
    .lean();

  let method = 'keyword-title';
  let maxSimilarity = 0;
  let matchedPost = null;
  const candidateText = `${candidate.title || ''} ${candidate.excerpt || ''} ${String(candidate.content || '').slice(0, 3500)}`;
  const candidateEmbedding = await getEmbedding(candidateText);
  if (candidateEmbedding) method = 'embedding';

  for (const post of existing) {
    const postText = `${post.title || ''} ${post.excerpt || ''} ${String(post.content || '').slice(0, 3500)}`;
    let similarity = Math.max(jaccard(candidate.title, post.title), jaccard(candidateText, postText));

    if (candidateEmbedding) {
      const postEmbedding = await getEmbedding(postText);
      similarity = Math.max(similarity, cosine(candidateEmbedding, postEmbedding || []));
    }

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
    threshold,
    checkedAt: new Date(),
  };
}

module.exports = {
  checkDuplicate,
  jaccard,
};
