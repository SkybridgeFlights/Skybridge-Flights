const BlogPost = require('../models/BlogPost');
const BlogSeoLandingPage = require('../models/BlogSeoLandingPage');
const BlogVersion = require('../models/BlogVersion');

function cleanSnapshot(doc) {
  const data = doc?.toObject ? doc.toObject() : doc;
  if (!data) return {};
  delete data.__v;
  return data;
}

async function createVersion(targetType, doc, { changedBy = null, source = 'admin', action = 'update' } = {}) {
  if (!doc?._id) return null;
  return BlogVersion.create({
    targetType,
    targetId: doc._id,
    snapshot: cleanSnapshot(doc),
    changedBy,
    source,
    action,
  });
}

async function listVersions(targetType, targetId) {
  return BlogVersion.find({ targetType, targetId }).sort({ createdAt: -1 }).limit(30).lean();
}

async function rollbackVersion(versionId, changedBy = null) {
  const version = await BlogVersion.findById(versionId);
  if (!version) throw new Error('Version not found');
  const Model = version.targetType === 'seoPage' ? BlogSeoLandingPage : BlogPost;
  const current = await Model.findById(version.targetId);
  if (!current) throw new Error('Target not found');
  await createVersion(version.targetType, current, { changedBy, source: 'rollback', action: 'before rollback' });
  const snapshot = { ...(version.snapshot || {}) };
  delete snapshot._id;
  const restored = await Model.findByIdAndUpdate(version.targetId, snapshot, { new: true });
  return restored;
}

module.exports = {
  createVersion,
  listVersions,
  rollbackVersion,
};
