const BlogSettings = require('../models/BlogSettings');
const BlogPost = require('../models/BlogPost');
const { generateMultilingualArticle } = require('./aiBlogService');
const { runTrendResearch } = require('./blogTrendService');
const { withSchedulerLock } = require('./blogSchedulerLockService');
const { blogLog } = require('./blogLoggerService');

let timer = null;
let lastRunKey = '';
let lastQaRunKey = '';

function getTimeParts(time = '09:00') {
  const [hour, minute] = String(time).split(':').map((item) => Number(item));
  return {
    hour: Number.isFinite(hour) ? hour : 9,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

function nowInTimezone(timezone = 'Europe/Berlin') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const get = (type) => parts.find((part) => part.type === type)?.value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  };
}

async function publishScheduledPosts() {
  const due = await BlogPost.find({
    status: 'scheduled',
    scheduledAt: { $lte: new Date() },
    guardrailStatus: 'passed',
  });

  for (const post of due) {
    post.status = 'published';
    post.publishedAt = post.publishedAt || new Date();
    await post.save();
  }
}

async function runAutoPublisher() {
  const settings = await BlogSettings.findOneAndUpdate(
    { singletonKey: 'ai-blog-settings' },
    { $setOnInsert: { singletonKey: 'ai-blog-settings' } },
    { new: true, upsert: true }
  );

  if (!settings.autoPublishEnabled) return { skipped: true, reason: 'Auto publishing disabled' };

  const today = nowInTimezone(settings.timezone).date;
  const start = new Date(`${today}T00:00:00.000Z`);
  const generatedToday = await BlogPost.countDocuments({
    source: 'AI',
    createdAt: { $gte: start },
  });

  const max = Math.min(settings.articlesPerDay || 1, settings.maxArticlesPerDay || 1);
  if (generatedToday >= max) return { skipped: true, reason: 'Daily article limit reached' };

  const research = await runTrendResearch(settings);
  if (!research.bestTopic) throw new Error('No valid trend topic found');

  const posts = await generateMultilingualArticle({
    topic: research.bestTopic.topic,
    languages: settings.enabledLanguages,
    autoPublish: settings.autoPublish,
  });

  settings.lastRunAt = new Date();
  settings.lastRunStatus = 'success';
  settings.lastRunMessage = `Generated ${posts.length} article version(s) for ${research.bestTopic.topic}`;
  await settings.save();

  return { posts, trend: research.bestTopic };
}

async function tick() {
  try {
    await withSchedulerLock('scheduled-post-publish', publishScheduledPosts, { ttlMs: 5 * 60 * 1000 });

    const settings = await BlogSettings.findOne({ singletonKey: 'ai-blog-settings' });
    if (!settings) return;

    const now = nowInTimezone(settings.timezone);
    if (settings?.autoPublishEnabled) {
      const target = getTimeParts(settings.publishingTime);
      const runKey = `${now.date}-${settings.publishingTime}`;

      if (now.hour === target.hour && now.minute === target.minute && lastRunKey !== runKey) {
        lastRunKey = runKey;
        const { enqueueBlogJob } = require('./blogQueueService');
        await withSchedulerLock(
          `daily-ai-generation:${now.date}`,
          () => enqueueBlogJob('auto_publish', { jobKey: `auto_publish:${now.date}` }),
          { ttlMs: 30 * 60 * 1000, metadata: { runKey } }
        );
      }
    }

    if (settings?.scheduledQaEnabled) {
      const target = getTimeParts(settings.qaScheduleTime || '08:00');
      const weekPart = settings.qaFrequency === 'weekly' ? Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) : now.date;
      const runKey = `qa-${weekPart}-${settings.qaScheduleTime}`;
      if (now.hour === target.hour && now.minute === target.minute && lastQaRunKey !== runKey) {
        lastQaRunKey = runKey;
        const { runScheduledQa } = require('./blogQaRunnerService');
        await withSchedulerLock(
          `scheduled-qa:${runKey}`,
          () => runScheduledQa({ source: 'scheduled' }),
          { ttlMs: 45 * 60 * 1000, metadata: { runKey, frequency: settings.qaFrequency } }
        );
      }
    }
  } catch (error) {
    blogLog('scheduler.tick_failed', { message: error.message }, 'error');
    try {
      await BlogSettings.findOneAndUpdate(
        { singletonKey: 'ai-blog-settings' },
        {
          lastRunAt: new Date(),
          lastRunStatus: 'error',
          lastRunMessage: error.message,
        },
        { upsert: true }
      );
    } catch (_) {}
  }
}

function startBlogScheduler() {
  if (timer) return;
  timer = setInterval(tick, 60 * 1000);
  tick();
  blogLog('scheduler.started', { intervalMs: 60000 });
}

module.exports = {
  publishScheduledPosts,
  runAutoPublisher,
  startBlogScheduler,
};
