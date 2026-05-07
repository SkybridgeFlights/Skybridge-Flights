const BlogJob = require('../models/BlogJob');
const BlogSettings = require('../models/BlogSettings');
const { generateArticle, generateMultilingualArticle } = require('./aiBlogService');
const { runAutoPublisher } = require('./blogScheduler');
const { recordFailedJob } = require('./blogUsageService');
const { regenerateMeta } = require('./searchConsoleService');
const { createNotification } = require('./blogNotificationService');
const { blogLog } = require('./blogLoggerService');

let workerTimer = null;
let runningJobs = 0;

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

async function getSettings() {
  return BlogSettings.findOneAndUpdate(
    { singletonKey: 'ai-blog-settings' },
    { $setOnInsert: { singletonKey: 'ai-blog-settings' } },
    { new: true, upsert: true }
  );
}

function buildJobKey(type, payload = {}) {
  if (payload.jobKey) return payload.jobKey;
  if (type === 'auto_publish') return `auto_publish:${dateKey()}`;
  if (type === 'generate_article') {
    const topic = String(payload.topic || 'trend').toLowerCase().trim();
    const lang = payload.multilingual ? 'multi' : payload.language || 'en';
    return `generate_article:${dateKey()}:${lang}:${topic}`;
  }
  if (type === 'regenerate_seo') return `regenerate_seo:${payload.postId}:${Date.now()}`;
  return `${type}:${Date.now()}`;
}

async function enqueueBlogJob(type, payload = {}) {
  const settings = await getSettings();
  const jobKey = buildJobKey(type, payload);
  const existing = await BlogJob.findOne({ jobKey });
  if (existing) return existing;

  return BlogJob.create({
    jobKey,
    type,
    payload,
    maxRetries: settings.maxJobRetries || 2,
    logs: [{ level: 'info', message: 'Job queued' }],
  });
}

async function runJob(job) {
  job.status = 'running';
  job.startedAt = job.startedAt || new Date();
  job.lockedAt = new Date();
  job.attempts += 1;
  job.logs.push({ level: 'info', message: `Attempt ${job.attempts} started` });
  await job.save();
  blogLog('job.started', { jobKey: job.jobKey, type: job.type, attempts: job.attempts });

  if (job.type === 'generate_article') {
    const payload = job.payload || {};
    const result = payload.multilingual
      ? await generateMultilingualArticle(payload)
      : await generateArticle(payload);
    return { ids: Array.isArray(result) ? result.map((item) => item._id) : [result._id] };
  }

  if (job.type === 'auto_publish') {
    return runAutoPublisher({ fromQueue: true });
  }

  if (job.type === 'regenerate_seo') {
    const post = await regenerateMeta(job.payload?.postId, {
      apply: !!job.payload?.apply,
      reason: job.payload?.reason || 'Queued SEO optimization',
    });
    return { id: post._id };
  }

  return {};
}

async function processNextJob() {
  const settings = await getSettings();
  if (runningJobs >= (settings.maxConcurrentAiJobs || 1)) return;

  const job = await BlogJob.findOneAndUpdate(
    {
      status: 'queued',
      nextRunAt: { $lte: new Date() },
    },
    {
      $set: {
        status: 'running',
        lockedAt: new Date(),
      },
    },
    { sort: { createdAt: 1 }, new: true }
  );

  if (!job) return;
  runningJobs += 1;

  try {
    const result = await runJob(job);
    job.status = 'completed';
    job.result = result || {};
    job.finishedAt = new Date();
    job.logs.push({ level: 'info', message: 'Job completed' });
    await job.save();
    blogLog('job.completed', { jobKey: job.jobKey, type: job.type });
  } catch (error) {
    job.error = error.message;
    job.logs.push({ level: 'error', message: error.message });
    if (job.attempts <= job.maxRetries) {
      job.status = 'queued';
      job.nextRunAt = new Date(Date.now() + Math.min(30, job.attempts * 5) * 60 * 1000);
      job.logs.push({ level: 'warn', message: 'Job scheduled for retry' });
    } else {
      job.status = 'failed';
      job.finishedAt = new Date();
      await recordFailedJob();
      await createNotification({
        type: job.type === 'auto_publish' ? 'auto_publish_failed' : 'ai_generation_failed',
        severity: 'error',
        title: job.type === 'auto_publish' ? 'Auto publish failed' : 'AI blog job failed',
        message: error.message,
        metadata: { jobKey: job.jobKey, type: job.type },
      });
      blogLog('job.failed', { jobKey: job.jobKey, type: job.type, message: error.message }, 'error');
    }
    await job.save();
  } finally {
    runningJobs -= 1;
  }
}

function startBlogQueueWorker() {
  if (workerTimer) return;
  workerTimer = setInterval(() => {
    processNextJob().catch((error) => console.error('Blog queue worker error:', error));
  }, 15000);
  processNextJob().catch((error) => console.error('Blog queue worker error:', error));
  console.log('Skybridge AI Blog fallback queue worker started');
  blogLog('queue.worker_started', { intervalMs: 15000 });
}

async function getRecentJobs(limit = 30) {
  return BlogJob.find({}).sort({ createdAt: -1 }).limit(limit).lean();
}

module.exports = {
  enqueueBlogJob,
  getRecentJobs,
  processNextJob,
  startBlogQueueWorker,
};
