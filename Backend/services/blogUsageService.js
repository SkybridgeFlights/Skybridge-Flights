const BlogUsage = require('../models/BlogUsage');

const ESTIMATED_COST_PER_1K_TOKENS = 0.01;

function getDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

async function getUsageSummary() {
  const [daily, monthly] = await Promise.all([
    BlogUsage.findOne({ periodKey: getDayKey(), periodType: 'day' }).lean(),
    BlogUsage.findOne({ periodKey: getMonthKey(), periodType: 'month' }).lean(),
  ]);
  return {
    daily: daily || { articlesGenerated: 0, estimatedTokens: 0, estimatedCost: 0, failedJobs: 0 },
    monthly: monthly || { articlesGenerated: 0, estimatedTokens: 0, estimatedCost: 0, failedJobs: 0 },
  };
}

async function assertBudgetAvailable(settings, estimatedTokens = 4500) {
  const usage = await getUsageSummary();
  const estimatedCost = (estimatedTokens / 1000) * ESTIMATED_COST_PER_1K_TOKENS;
  const reasons = [];

  if ((usage.daily.articlesGenerated || 0) >= (settings.dailyGenerationLimit || 0)) {
    reasons.push('Daily article generation limit reached.');
  }
  if ((usage.monthly.articlesGenerated || 0) >= (settings.monthlyGenerationLimit || 0)) {
    reasons.push('Monthly article generation limit reached.');
  }
  if ((usage.daily.estimatedTokens || 0) + estimatedTokens > (settings.dailyTokenLimit || 0)) {
    reasons.push('Daily token estimate limit reached.');
  }
  if ((usage.daily.estimatedCost || 0) + estimatedCost > (settings.dailyCostLimit || 0)) {
    reasons.push('Daily AI budget limit reached.');
  }
  if ((usage.monthly.estimatedCost || 0) + estimatedCost > (settings.monthlyCostLimit || 0)) {
    reasons.push('Monthly AI budget limit reached.');
  }

  if (reasons.length) {
    try {
      const { createNotification } = require('./blogNotificationService');
      await createNotification({
        type: 'budget_limit',
        severity: 'error',
        title: 'AI blog budget limit reached',
        message: reasons.join(' '),
      });
    } catch (_) {}
    const error = new Error(reasons.join(' '));
    error.code = 'AI_BUDGET_EXCEEDED';
    throw error;
  }
}

async function recordGenerationUsage({ estimatedTokens = 4500, articleCount = 1 } = {}) {
  const estimatedCost = (estimatedTokens / 1000) * ESTIMATED_COST_PER_1K_TOKENS;
  await Promise.all([
    BlogUsage.findOneAndUpdate(
      { periodKey: getDayKey(), periodType: 'day' },
      { $inc: { articlesGenerated: articleCount, estimatedTokens, estimatedCost } },
      { upsert: true, new: true }
    ),
    BlogUsage.findOneAndUpdate(
      { periodKey: getMonthKey(), periodType: 'month' },
      { $inc: { articlesGenerated: articleCount, estimatedTokens, estimatedCost } },
      { upsert: true, new: true }
    ),
  ]);
}

async function recordFailedJob() {
  await Promise.all([
    BlogUsage.findOneAndUpdate(
      { periodKey: getDayKey(), periodType: 'day' },
      { $inc: { failedJobs: 1 } },
      { upsert: true, new: true }
    ),
    BlogUsage.findOneAndUpdate(
      { periodKey: getMonthKey(), periodType: 'month' },
      { $inc: { failedJobs: 1 } },
      { upsert: true, new: true }
    ),
  ]);
}

module.exports = {
  assertBudgetAvailable,
  getUsageSummary,
  recordFailedJob,
  recordGenerationUsage,
};
