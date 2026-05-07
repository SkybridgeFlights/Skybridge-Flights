const crypto = require('crypto');
const BlogSchedulerLock = require('../models/BlogSchedulerLock');
const { blogLog } = require('./blogLoggerService');

let redisClient = null;
let redisChecked = false;

function ownerId() {
  return `${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
}

async function getRedisClient() {
  if (!process.env.REDIS_URL || redisChecked) return redisClient;
  redisChecked = true;
  try {
    const redis = require('redis');
    redisClient = redis.createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', (error) => blogLog('scheduler.redis_error', { message: error.message }, 'warn'));
    await redisClient.connect();
    blogLog('scheduler.redis_connected');
  } catch (error) {
    redisClient = null;
    blogLog('scheduler.redis_unavailable', { message: error.message }, 'warn');
  }
  return redisClient;
}

async function acquireMongoLock(key, ttlMs, metadata = {}) {
  const owner = ownerId();
  const now = new Date();
  const expiresAt = new Date(Date.now() + ttlMs);
  const lock = await BlogSchedulerLock.findOneAndUpdate(
    {
      key,
      $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }],
    },
    { $set: { owner, expiresAt, metadata } },
    { upsert: true, new: true }
  ).catch(async (error) => {
    if (error?.code === 11000) return null;
    throw error;
  });
  if (!lock || lock.owner !== owner) return null;
  return {
    key,
    owner,
    provider: 'mongo',
    release: async () => {
      await BlogSchedulerLock.deleteOne({ key, owner }).catch(() => {});
      blogLog('scheduler.lock_released', { key, provider: 'mongo' });
    },
  };
}

async function acquireRedisLock(key, ttlMs) {
  const client = await getRedisClient();
  if (!client) return null;
  const owner = ownerId();
  const redisKey = `skybridge:blog-lock:${key}`;
  const result = await client.set(redisKey, owner, { NX: true, PX: ttlMs });
  if (result !== 'OK') return null;
  return {
    key,
    owner,
    provider: 'redis',
    release: async () => {
      const current = await client.get(redisKey).catch(() => null);
      if (current === owner) await client.del(redisKey).catch(() => {});
      blogLog('scheduler.lock_released', { key, provider: 'redis' });
    },
  };
}

async function withSchedulerLock(key, fn, { ttlMs = 10 * 60 * 1000, metadata = {} } = {}) {
  let lock = null;
  try {
    lock = (await acquireRedisLock(key, ttlMs)) || (await acquireMongoLock(key, ttlMs, metadata));
    if (!lock) {
      blogLog('scheduler.lock_skipped', { key }, 'warn');
      return { skipped: true, reason: 'Lock already held', key };
    }
    blogLog('scheduler.lock_acquired', { key, provider: lock.provider });
    return await fn();
  } catch (error) {
    blogLog('scheduler.lock_error', { key, message: error.message }, 'error');
    throw error;
  } finally {
    if (lock) await lock.release();
  }
}

module.exports = { withSchedulerLock };
