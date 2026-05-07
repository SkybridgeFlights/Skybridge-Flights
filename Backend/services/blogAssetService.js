const BlogAsset = require('../models/BlogAsset');

async function upsertAssetFromImage(image = {}, createdBy = null) {
  const url = image.url || image.featuredImage || image.coverImage;
  if (!url) return null;
  return BlogAsset.findOneAndUpdate(
    { url },
    {
      $set: {
        title: image.title || image.altText || image.imageAltText || '',
        altText: image.altText || image.imageAltText || '',
        provider: image.provider || image.imageSeo?.provider || 'external',
        publicId: image.publicId || image.imageSeo?.publicId || '',
        width: image.width || image.imageSeo?.width || 0,
        height: image.height || image.imageSeo?.height || 0,
        format: image.format || image.imageSeo?.format || '',
        source: image.source || 'external',
        prompt: image.prompt || image.imageSeo?.prompt || '',
        createdBy,
      },
    },
    { upsert: true, new: true }
  );
}

async function listAssets() {
  return BlogAsset.find({}).sort({ updatedAt: -1 }).limit(100).lean();
}

async function createAsset(payload = {}, createdBy = null) {
  return BlogAsset.create({
    title: payload.title || '',
    url: payload.url,
    altText: payload.altText || '',
    provider: payload.provider || 'external',
    publicId: payload.publicId || '',
    width: Number(payload.width || 0),
    height: Number(payload.height || 0),
    format: payload.format || '',
    source: payload.source || 'external',
    prompt: payload.prompt || '',
    createdBy,
  });
}

module.exports = {
  createAsset,
  listAssets,
  upsertAssetFromImage,
};
