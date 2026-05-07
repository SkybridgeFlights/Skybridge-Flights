// Backend/utils/r2.js
// أدوات Cloudflare R2 (S3-compatible): رفع، فحص، رابط موقّت، وبث التنزيل

const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const path = require('path');

function cfg() {
  const ACCOUNT_ID = process.env.CF_R2_ACCOUNT_ID;
  const ACCESS_KEY = process.env.CF_R2_ACCESS_KEY_ID;
  const SECRET_KEY = process.env.CF_R2_SECRET_ACCESS_KEY;
  const DEFAULT_BUCKET = process.env.CF_R2_BUCKET;

  if (!ACCOUNT_ID || !ACCESS_KEY || !SECRET_KEY) {
    throw new Error('R2 config missing (CF_R2_* env vars).');
  }

  const endpoint = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

  const client = new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle: false, // R2 يدعم virtual-host
    credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  });

  const PUBLIC_BASE = (process.env.CF_R2_PUBLIC_BASE || '').replace(/\/+$/, '');

  return { client, DEFAULT_BUCKET, PUBLIC_BASE };
}

function randomKeyName(originalName = 'file') {
  const ext = path.extname(originalName || '').toLowerCase();
  const base = crypto.randomBytes(8).toString('hex');
  const y = new Date().getFullYear();
  const m = String(new Date().getMonth() + 1).padStart(2, '0');
  const d = String(new Date().getDate()).padStart(2, '0');
  return `${y}/${m}/${d}/${base}${ext || ''}`;
}

function makeKey({ prefix = '', originalName }) {
  const cleanPrefix = (prefix || '').replace(/^\/+|\/+$/g, '');
  const key = randomKeyName(originalName);
  return cleanPrefix ? `${cleanPrefix}/${key}` : key;
}

async function putObject({ buffer, key, contentType, cacheControl, bucket }) {
  const { client, DEFAULT_BUCKET } = cfg();
  const Bucket = bucket || DEFAULT_BUCKET;
  if (!Bucket) throw new Error('R2: Bucket is required');

  console.log('[R2] putObject Bucket =', Bucket, 'Key =', key);

  const cmd = new PutObjectCommand({
    Bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType || 'application/octet-stream',
    CacheControl: cacheControl,
  });
  await client.send(cmd);
  return { bucket: Bucket, key };
}

async function headObject({ key, bucket }) {
  const { client, DEFAULT_BUCKET } = cfg();
  const Bucket = bucket || DEFAULT_BUCKET;
  const cmd = new HeadObjectCommand({ Bucket, Key: key });
  return client.send(cmd);
}

async function presignGet({ key, bucket, expiresIn = 60 * 10 }) {
  const { client, DEFAULT_BUCKET } = cfg();
  const Bucket = bucket || DEFAULT_BUCKET;
  const cmd = new GetObjectCommand({ Bucket, Key: key });
  return getSignedUrl(client, cmd, { expiresIn });
}

// 🟢 هذه هي الدالة الناقصة التي كنت تستوردها في الكنترولرز
async function getObjectStream({ key, bucket }) {
  const { client, DEFAULT_BUCKET } = cfg();
  const Bucket = bucket || DEFAULT_BUCKET;
  if (!Bucket) throw new Error('R2: Bucket is required');

  console.log('[R2] getObjectStream Bucket =', Bucket, 'Key =', key);

  const cmd = new GetObjectCommand({ Bucket, Key: key });
  const res = await client.send(cmd);
  // res.Body: Readable stream
  return {
    stream: res.Body,
    contentType: res.ContentType,
    contentLength: res.ContentLength,
    lastModified: res.LastModified,
    etag: res.ETag,
  };
}

function publicUrl(key) {
  const { PUBLIC_BASE } = cfg();
  if (!PUBLIC_BASE) return '';
  const cleanKey = String(key || '').replace(/^\/+/, '');
  return `${PUBLIC_BASE}/${cleanKey}`;
}

module.exports = {
  makeKey,
  putObject,
  headObject,
  presignGet,
  getObjectStream, // ← أضفناها للتصدير
  publicUrl,
};