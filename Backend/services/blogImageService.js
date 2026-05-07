const axios = require('axios');
const crypto = require('crypto');
const OpenAI = require('openai');
const { blogLog } = require('./blogLoggerService');

function cloudinaryConfigured() {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

async function uploadToCloudinary(file, publicId) {
  if (!cloudinaryConfigured() || !file) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  const transformation = 'f_webp,q_auto,w_1200,h_630,c_fill';
  const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}&transformation=${transformation}${process.env.CLOUDINARY_API_SECRET}`;
  const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', process.env.CLOUDINARY_API_KEY);
  form.append('timestamp', String(timestamp));
  form.append('public_id', publicId);
  form.append('transformation', transformation);
  form.append('signature', signature);

  const { data } = await axios.post(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    form,
    { timeout: 30000 }
  );
  return {
    url: data.secure_url,
    publicId: data.public_id,
    width: data.width,
    height: data.height,
    format: data.format,
  };
}

async function generateAiImage(prompt) {
  if (!process.env.OPENAI_API_KEY || process.env.AI_IMAGE_PROVIDER !== 'openai') return null;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.images.generate({
    model: process.env.AI_IMAGE_MODEL || 'gpt-image-1',
    prompt,
    size: '1536x1024',
  });
  const image = response.data?.[0];
  if (image?.b64_json) return `data:image/png;base64,${image.b64_json}`;
  return image?.url || null;
}

async function processFeaturedImage(article, settings = {}) {
  const seo = buildImageSeo(article, settings);
  const prompt = seo.imageSeo.prompt;
  let generated = null;
  let uploaded = null;

  try {
    generated = await generateAiImage(prompt);
    if (generated && cloudinaryConfigured()) {
      uploaded = await uploadToCloudinary(generated, `skybridge-blog/${article.slug || Date.now()}`);
    } else if ((article.featuredImage || article.coverImage) && cloudinaryConfigured()) {
      uploaded = await uploadToCloudinary(article.featuredImage || article.coverImage, `skybridge-blog/${article.slug || Date.now()}`);
    }
  } catch (error) {
    blogLog('image.pipeline_failed', { message: error.message, slug: article.slug }, 'warn');
  }

  if (!uploaded) {
    blogLog('image.pipeline_fallback', { slug: article.slug, provider: seo.imageSeo.provider });
    return seo;
  }
  blogLog('image.pipeline_completed', { slug: article.slug, storage: 'cloudinary', publicId: uploaded.publicId });
  return {
    featuredImage: uploaded.url,
    coverImage: uploaded.url,
    imageAltText: seo.imageAltText,
    imageSeo: {
      ...seo.imageSeo,
      provider: process.env.AI_IMAGE_PROVIDER || seo.imageSeo.provider,
      publicId: uploaded.publicId,
      width: uploaded.width || seo.imageSeo.width,
      height: uploaded.height || seo.imageSeo.height,
      format: uploaded.format || 'webp',
      storage: 'cloudinary',
      fallbackUsed: false,
    },
  };
}

function buildImageSeo(article, settings = {}) {
  const provider = settings.imageProvider || process.env.AI_IMAGE_PROVIDER || 'prompt-only';
  const prompt =
    article.imagePrompt ||
    `Professional travel editorial image for ${article.title}, airport and destination planning, realistic, bright, trustworthy`;

  return {
    featuredImage: article.featuredImage || article.coverImage || settings.fallbackFeaturedImage || '/plane.jpg',
    imageAltText: article.imageAltText || `${article.title} travel planning image`,
    imageSeo: {
      provider,
      prompt,
      altText: article.imageAltText || `${article.title} travel planning image`,
      format: 'webp-ready',
      width: 1200,
      height: 630,
      storage: process.env.CLOUDINARY_CLOUD_NAME ? 'cloudinary-configured' : 'local-fallback',
      fallbackUsed: !process.env.CLOUDINARY_CLOUD_NAME || provider === 'prompt-only',
      publicId: '',
    },
  };
}

module.exports = {
  buildImageSeo,
  processFeaturedImage,
};
