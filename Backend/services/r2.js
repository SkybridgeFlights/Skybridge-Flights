// Backend/services/r2.js
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const {
  CF_R2_ACCOUNT_ID,
  CF_R2_ACCESS_KEY_ID,
  CF_R2_SECRET_ACCESS_KEY,
  CF_R2_BUCKET,
} = process.env;

if (!CF_R2_ACCOUNT_ID || !CF_R2_ACCESS_KEY_ID || !CF_R2_SECRET_ACCESS_KEY || !CF_R2_BUCKET) {
  console.warn('[R2] Missing env config — ensure CF_R2_* variables are set.');
}

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${CF_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: CF_R2_ACCESS_KEY_ID,
    secretAccessKey: CF_R2_SECRET_ACCESS_KEY,
  },
});

async function putBufferToR2(buffer, { key, contentType = 'application/octet-stream' }) {
  await r2.send(new PutObjectCommand({
    Bucket: CF_R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return key;
}

async function signedGetUrl(key, expiresInSeconds = 60 * 5) {
  return getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: CF_R2_BUCKET, Key: key }),
    { expiresIn: expiresInSeconds }
  );
}

module.exports = { r2, putBufferToR2, signedGetUrl };