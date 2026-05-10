const crypto = require('crypto');
const mongoose = require('mongoose');
const BlogPost = require('../models/BlogPost');
const BlogSettings = require('../models/BlogSettings');
const BlogVisitor = require('../models/BlogVisitor');
const BlogTopicPerformance = require('../models/BlogTopicPerformance');
const BlogSeoLandingPage = require('../models/BlogSeoLandingPage');
const { generateArticle, generateMultilingualArticle, makeSlug } = require('../services/aiBlogService');
const { enrichSeo } = require('../services/blogSeoService');
const { runTrendResearch } = require('../services/blogTrendService');
const { runAutoPublisher } = require('../services/blogScheduler');
const { enqueueBlogJob, getRecentJobs } = require('../services/blogQueueService');
const { getUsageSummary } = require('../services/blogUsageService');
const { checkDuplicate, evaluateDuplicateForValidation } = require('../services/blogDuplicateService');
const { buildInternalLinks, insertInternalLinks } = require('../services/blogInternalLinkService');
const { findWeakSeoPages, getSearchConsoleSummary, regenerateMeta, syncSearchConsole } = require('../services/searchConsoleService');
const { createLandingPage, buildLandingPayload, scoreLandingPage } = require('../services/programmaticSeoService');
const { createVersion, listVersions, rollbackVersion } = require('../services/blogVersionService');
const { createAsset, listAssets } = require('../services/blogAssetService');
const { getSeoQaReport } = require('../services/blogSeoQaService');
const { getBrokenLinkReport, runBrokenLinkCheck } = require('../services/blogBrokenLinkService');
const { getSitemapQa } = require('../services/blogSitemapQaService');
const { getAirportCodes } = require('../services/flightTrackerData');
const { createNotification } = require('../services/blogNotificationService');
const { blogLog } = require('../services/blogLoggerService');
const { withSchedulerLock } = require('../services/blogSchedulerLockService');

const SITE_URL = (process.env.SITE_URL || 'https://skybridgeflights.com').replace(/\/$/, '');

function sanitizeErrorMessage(error) {
  return String(error?.message || 'Unexpected error')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/mongodb(\+srv)?:\/\/[^\s'"]+/gi, 'mongodb://[redacted]');
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function normalizeFaq(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      question: String(item.question || '').trim(),
      answer: String(item.answer || '').trim(),
    }))
    .filter((item) => item.question && item.answer);
}

function normalizeLinks(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      label: String(item.label || '').trim(),
      url: String(item.url || '').trim(),
    }))
    .filter((item) => item.label && item.url);
}

function pickFields(body = {}) {
  const payload = {};
  const fields = [
    'title',
    'slug',
    'excerpt',
    'content',
    'coverImage',
    'featuredImage',
    'imageAltText',
    'imagePrompt',
    'language',
    'translationGroup',
    'category',
    'metaTitle',
    'metaDescription',
    'seoTitle',
    'seoDescription',
    'canonicalUrl',
    'status',
    'source',
    'author',
    'scheduledAt',
  ];

  fields.forEach((field) => {
    if (body[field] !== undefined) payload[field] = body[field];
  });

  if (body.tags !== undefined) payload.tags = normalizeList(body.tags);
  if (body.keywords !== undefined) payload.keywords = normalizeList(body.keywords);
  if (body.faq !== undefined) payload.faq = normalizeFaq(body.faq);
  if (body.internalLinks !== undefined) payload.internalLinks = normalizeLinks(body.internalLinks);
  if (body.cta !== undefined) payload.cta = body.cta;

  if (payload.metaTitle && !payload.seoTitle) payload.seoTitle = payload.metaTitle;
  if (payload.metaDescription && !payload.seoDescription) payload.seoDescription = payload.metaDescription;
  if (payload.seoTitle && !payload.metaTitle) payload.metaTitle = payload.seoTitle;
  if (payload.seoDescription && !payload.metaDescription) payload.metaDescription = payload.seoDescription;
  if (payload.featuredImage && !payload.coverImage) payload.coverImage = payload.featuredImage;
  if (payload.coverImage && !payload.featuredImage) payload.featuredImage = payload.coverImage;

  return payload;
}

async function applySeoAndGuardrails(doc, { validationPath = 'draft-validation' } = {}) {
  const settings = await BlogSettings.findOne({ singletonKey: 'ai-blog-settings' }).lean();
  if (!doc.internalLinks?.length) {
    doc.internalLinks = await buildInternalLinks(doc.toObject ? doc.toObject() : doc, settings || {});
  }
  if (doc.content && doc.internalLinks?.length) {
    const inserted = insertInternalLinks(doc.content, doc.internalLinks, settings || {});
    doc.content = inserted.content;
    doc.insertedLinksReport = inserted.report;
  }

  const seo = enrichSeo(doc.toObject ? doc.toObject() : doc);
  const duplicateCheck = await checkDuplicate(doc.toObject ? doc.toObject() : doc, settings || {});
  const duplicateValidation = evaluateDuplicateForValidation(duplicateCheck, settings || {}, validationPath);
  doc.readingTime = seo.readingTime;
  doc.canonicalUrl = seo.canonicalUrl;
  doc.schemaMarkup = seo.schemaMarkup;
  doc.seoScore = seo.seoScore;
  doc.qualityScore = seo.qualityScore;
  doc.duplicateCheck = duplicateCheck;
  doc.publishConfidence = {
    ...(doc.publishConfidence || {}),
    duplicateScore: duplicateValidation.duplicateScore,
    duplicateThreshold: duplicateValidation.thresholdUsed,
    duplicateValidationPath: validationPath,
    duplicateAllowed: duplicateValidation.publishAllowed,
    seoScore: seo.seoScore,
    qualityScore: seo.qualityScore,
    passed:
      seo.seoScore >= 85 &&
      seo.qualityScore >= 80 &&
      duplicateValidation.publishAllowed,
  };
  const reasons = [...seo.guardrailReasons];
  if (!duplicateValidation.publishAllowed) {
    reasons.push(
      `Duplicate similarity too high (${duplicateValidation.duplicateScore.toFixed(2)}; threshold ${duplicateValidation.thresholdUsed.toFixed(2)} for ${validationPath}).`
    );
  }
  if (settings?.requireInternalLinks && !doc.internalLinks?.length) reasons.push('Internal links are required.');
  if (settings?.requireImageAlt && !doc.imageAltText) reasons.push('Image alt text is required.');
  if (settings?.requireFaq && !(doc.faq || []).length) reasons.push('FAQ is required.');
  if (settings?.requireCta && !doc.cta?.url) reasons.push('CTA is required.');
  if (settings?.requireNoBrokenInternalLinks && (doc.linkCheck?.brokenCount || 0) > 0) reasons.push('Broken internal links must be fixed.');
  if (settings?.requireNoDuplicateSimilarityWarning && !duplicateValidation.publishAllowed) {
    reasons.push(`Duplicate similarity warning must be resolved below ${duplicateValidation.thresholdUsed.toFixed(2)}.`);
  }
  (doc.internalLinks || []).forEach((link) => {
    if (!/^\/|^https?:\/\//i.test(link.url || '')) reasons.push(`Broken internal link format: ${link.url}`);
  });
  if (!/^https?:\/\//i.test(doc.canonicalUrl || seo.canonicalUrl || '')) reasons.push('Canonical URL must be absolute.');
  if (!['en', 'ar', 'de'].includes(doc.language)) reasons.push('Unsupported language metadata.');
  try {
    JSON.stringify(seo.schemaMarkup || {});
  } catch (_) {
    reasons.push('Schema markup is invalid JSON.');
  }
  if (settings?.requireValidSchema && !seo.schemaMarkup) reasons.push('Valid schema is required.');
  doc.guardrailReasons = reasons;
  doc.guardrailStatus =
    seo.seoScore >= (settings?.minimumSeoScore || 70) &&
    seo.qualityScore >= (settings?.minimumQualityScore || 70) &&
    duplicateValidation.publishAllowed &&
    (!settings?.requireInternalLinks || doc.internalLinks?.length) &&
    (!settings?.requireImageAlt || doc.imageAltText) &&
    (!settings?.requireFaq || (doc.faq || []).length) &&
    (!settings?.requireCta || doc.cta?.url) &&
    (!settings?.requireNoBrokenInternalLinks || !(doc.linkCheck?.brokenCount || 0))
      ? 'passed'
      : 'failed';

  blogLog('publish.validation', {
    postId: doc._id,
    slug: doc.slug,
    duplicateScore: duplicateValidation.duplicateScore,
    thresholdUsed: duplicateValidation.thresholdUsed,
    validationPath,
    publishAllowed: duplicateValidation.publishAllowed,
    guardrailStatus: doc.guardrailStatus,
    seoScore: seo.seoScore,
    qualityScore: seo.qualityScore,
  }, duplicateValidation.publishAllowed ? 'info' : 'warn');

  if (doc.status === 'published' && doc.guardrailStatus !== 'passed') {
    doc.status = 'draft';
    doc.publishedAt = null;
  }
}

function urlForPost(post) {
  const lang = post.language && post.language !== 'en' ? `/${post.language}` : '';
  return `${SITE_URL}/blog${lang}/${post.slug}`;
}

async function buildHreflang(post) {
  if (!post.translationGroup) return [];
  const translations = await BlogPost.find({
    translationGroup: post.translationGroup,
    status: 'published',
  }).select('slug language');
  return translations.map((item) => ({
    language: item.language,
    slug: item.slug,
    url: urlForPost(item),
  }));
}

exports.listPublishedPosts = async (req, res) => {
  try {
    const language = String(req.query.language || req.query.lang || '').trim();
    const filter = { status: 'published' };
    if (language) filter.language = language;

    const posts = await BlogPost.find(filter)
      .populate('authorStaff', 'name email')
      .sort({ publishedAt: -1, createdAt: -1 });

    return res.json(posts);
  } catch (error) {
    console.error('listPublishedPosts error:', error);
    return res.status(500).json({ error: 'Failed to fetch blog posts' });
  }
};

exports.getPublishedPostBySlug = async (req, res) => {
  try {
    const language = String(req.params.lang || req.query.language || req.query.lang || '').trim();
    const slug = String(req.params.slug || '').trim();
    const filter = { slug, status: 'published' };
    if (language) filter.language = language;

    let post = await BlogPost.findOne(filter).populate('authorStaff', 'name email');
    if (!post) post = await BlogPost.findOne({ slug, status: 'published' }).populate('authorStaff', 'name email');
    if (!post) return res.status(404).json({ error: 'Blog post not found' });

    const translations = post.translationGroup
      ? await BlogPost.find({ translationGroup: post.translationGroup, status: 'published' })
          .select('title slug language canonicalUrl')
          .sort({ language: 1 })
      : [];

    return res.json({
      post,
      translations,
      hreflang: translations.map((item) => ({
        language: item.language,
        slug: item.slug,
        url: item.canonicalUrl || urlForPost(item),
      })),
    });
  } catch (error) {
    console.error('getPublishedPostBySlug error:', error);
    return res.status(500).json({ error: 'Failed to fetch blog post' });
  }
};

exports.trackArticleView = async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Blog post not found' });

    const rawVisitor =
      req.body?.visitorId || req.headers['x-forwarded-for'] || req.ip || crypto.randomBytes(8).toString('hex');
    const visitorHash = crypto.createHash('sha256').update(String(rawVisitor)).digest('hex');
    const language = post.language || 'en';
    const today = new Date().toISOString().slice(0, 10);
    const referrer = String(req.body?.referrer || req.get('referer') || 'direct').slice(0, 180);
    const country = String(req.headers['cf-ipcountry'] || req.body?.country || '').slice(0, 80);
    const readTime = Math.max(0, Number(req.body?.readTimeSeconds || 0));

    const visitorResult = await BlogVisitor.findOneAndUpdate(
      { post: post._id, visitorHash },
      { $set: { lastSeenAt: new Date(), language }, $setOnInsert: { firstSeenAt: new Date() } },
      { upsert: true, new: true, includeResultMetadata: true }
    );
    const isNew = !!visitorResult.lastErrorObject?.upserted;

    post.analytics.totalViews += 1;
    if (isNew) post.analytics.uniqueVisitors += 1;
    post.analytics.totalReadTimeSeconds += readTime;
    post.analytics.averageReadTimeSeconds = post.analytics.totalViews
      ? Math.round(post.analytics.totalReadTimeSeconds / post.analytics.totalViews)
      : 0;
    post.analytics.languageViews.set(language, (post.analytics.languageViews.get(language) || 0) + 1);

    const daily = post.analytics.dailyViews.find((item) => item.date === today);
    if (daily) {
      daily.views += 1;
      if (isNew) daily.uniqueVisitors += 1;
    } else {
      post.analytics.dailyViews.push({ date: today, views: 1, uniqueVisitors: isNew ? 1 : 0 });
    }

    const ref = post.analytics.referrers.find((item) => item.source === referrer);
    if (ref) ref.count += 1;
    else post.analytics.referrers.push({ source: referrer, count: 1 });

    if (country) {
      const entry = post.analytics.countries.find((item) => item.country === country);
      if (entry) entry.count += 1;
      else post.analytics.countries.push({ country, count: 1 });
    }

    await post.save();
    return res.json({ ok: true });
  } catch (error) {
    console.error('trackArticleView error:', error);
    return res.status(500).json({ error: 'Failed to track article view' });
  }
};

exports.trackCtaClick = async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Blog post not found' });

    const type = String(req.body?.type || 'custom');
    post.analytics.ctaClicks += 1;
    if (type === 'booking' || type === 'search') post.analytics.bookingClicks += 1;
    if (type === 'contact') post.analytics.contactClicks += 1;
    if (type === 'whatsapp') post.analytics.whatsappClicks += 1;
    post.conversionTracking.clicks += 1;
    post.conversionTracking.lastClickedAt = new Date();
    await post.save();

    await BlogTopicPerformance.findOneAndUpdate(
      { topicKey: post.topicKey || post.slug, language: post.language },
      {
        $inc: { ctaClicks: 1, conversionClicks: 1, views: 0 },
        $set: { category: post.category, lastArticleAt: post.publishedAt || post.createdAt },
      },
      { upsert: true }
    );

    return res.json({ ok: true });
  } catch (error) {
    console.error('trackCtaClick error:', error);
    return res.status(500).json({ error: 'Failed to track CTA click' });
  }
};

exports.listAllPostsAdmin = async (_req, res) => {
  try {
    const posts = await BlogPost.find({}).populate('authorStaff', 'name email').sort({ updatedAt: -1, createdAt: -1 });
    return res.json(posts);
  } catch (error) {
    console.error('listAllPostsAdmin error:', error);
    return res.status(500).json({ error: 'Failed to fetch admin blog posts' });
  }
};

exports.createPost = async (req, res) => {
  try {
    const payload = pickFields(req.body || {});
    if (!payload.title) return res.status(400).json({ error: 'title is required' });

    payload.slug = makeSlug(payload.slug || payload.title);
    if (!payload.slug) return res.status(400).json({ error: 'A valid slug could not be generated' });
    payload.language = ['en', 'ar', 'de'].includes(payload.language) ? payload.language : 'en';
    payload.translationGroup = payload.translationGroup || crypto.randomBytes(8).toString('hex');
    payload.source = payload.source === 'AI' ? 'AI' : 'manual';
    payload.authorStaff = req.user?._id || null;

    const exists = await BlogPost.findOne({ slug: payload.slug, language: payload.language });
    if (exists) return res.status(409).json({ error: 'slug already exists for this language' });

    const post = new BlogPost(payload);
    await applySeoAndGuardrails(post, {
      validationPath: post.status === 'published' ? 'publish-validation' : 'draft-validation',
    });
    if (post.status === 'published' && !post.publishedAt) post.publishedAt = new Date();
    await post.save();
    post.hreflang = await buildHreflang(post);
    return res.status(201).json(post);
  } catch (error) {
    console.error('createPost error:', error);
    return res.status(500).json({ error: 'Failed to create blog post' });
  }
};

exports.updatePost = async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Blog post not found' });

    const payload = pickFields(req.body || {});
    if (payload.slug !== undefined) payload.slug = makeSlug(payload.slug || post.title);
    if (payload.language !== undefined && !['en', 'ar', 'de'].includes(payload.language)) delete payload.language;

    if (payload.slug || payload.language) {
      const exists = await BlogPost.findOne({
        _id: { $ne: post._id },
        slug: payload.slug || post.slug,
        language: payload.language || post.language,
      });
      if (exists) return res.status(409).json({ error: 'slug already exists for this language' });
    }

    await createVersion('post', post, { changedBy: req.user?._id || null, action: 'update article' });
    Object.assign(post, payload);
    await applySeoAndGuardrails(post, {
      validationPath: post.status === 'published' ? 'publish-validation' : 'draft-validation',
    });

    if (payload.status !== undefined) {
      if (post.status === 'published' && !post.publishedAt) post.publishedAt = new Date();
      if (post.status === 'draft' || post.status === 'archived') post.publishedAt = null;
    }

    await post.save();
    return res.json(post);
  } catch (error) {
    console.error('updatePost error:', error);
    return res.status(500).json({ error: 'Failed to update blog post' });
  }
};

exports.archivePost = async (req, res) => {
  try {
    const post = await BlogPost.findByIdAndUpdate(req.params.id, { status: 'archived', publishedAt: null }, { new: true });
    if (!post) return res.status(404).json({ error: 'Blog post not found' });
    return res.json(post);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to archive blog post' });
  }
};

exports.publishPost = async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Blog post not found' });
    await applySeoAndGuardrails(post, { validationPath: 'publish-validation' });
    if (post.guardrailStatus !== 'passed') {
      await post.save();
      await createNotification({
        type: 'publish_blocked',
        severity: 'warning',
        title: 'Blog publish blocked by guardrails',
        message: post.guardrailReasons.join('; '),
        targetType: 'post',
        targetId: post._id,
        metadata: { reasons: post.guardrailReasons, slug: post.slug, language: post.language },
      });
      blogLog('publish.guardrail_blocked', {
        postId: post._id,
        slug: post.slug,
        language: post.language,
        reasons: post.guardrailReasons,
      }, 'warn');
      return res.status(400).json({ error: 'Guardrails failed; article saved as draft.', reasons: post.guardrailReasons });
    }
    await createVersion('post', post, { changedBy: req.user?._id || null, action: 'publish article' });
    post.status = 'published';
    post.publishedAt = post.publishedAt || new Date();
    await post.save();
    return res.json(post);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to publish blog post' });
  }
};

exports.unpublishPost = async (req, res) => {
  try {
    const post = await BlogPost.findByIdAndUpdate(req.params.id, { status: 'draft', publishedAt: null }, { new: true });
    if (!post) return res.status(404).json({ error: 'Blog post not found' });
    return res.json(post);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to unpublish blog post' });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const post = await BlogPost.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ error: 'Blog post not found' });
    return res.json({ message: 'Blog post deleted successfully' });
  } catch (error) {
    console.error('deletePost error:', error);
    return res.status(500).json({ error: 'Failed to delete blog post' });
  }
};

exports.getSettings = async (_req, res) => {
  const settings = await BlogSettings.findOneAndUpdate(
    { singletonKey: 'ai-blog-settings' },
    { $setOnInsert: { singletonKey: 'ai-blog-settings' } },
    { new: true, upsert: true }
  );
  return res.json(settings);
};

exports.updateSettings = async (req, res) => {
  try {
    const allowed = [
      'autoPublishEnabled',
      'publishingTime',
      'timezone',
      'articlesPerDay',
      'maxArticlesPerDay',
      'enabledLanguages',
      'autoPublish',
      'autoPublishMode',
      'minimumSeoScore',
      'minimumQualityScore',
      'requireValidSchema',
      'requireImageAlt',
      'requireFaq',
      'requireCta',
      'requireNoBrokenInternalLinks',
      'requireNoDuplicateSimilarityWarning',
      'allowDuplicateDrafts',
      'forbiddenTopics',
      'allowedTopicCategories',
      'trendProvider',
      'trendSeedKeywords',
      'maxConcurrentAiJobs',
      'maxJobRetries',
      'dailyGenerationLimit',
      'monthlyGenerationLimit',
      'dailyTokenLimit',
      'dailyCostLimit',
      'monthlyCostLimit',
      'fallbackResearchEnabled',
      'semanticSimilarityThreshold',
      'publishSimilarityThreshold',
      'topicRetryAttempts',
      'maxInternalLinksPerArticle',
      'requireInternalLinks',
      'autoApplyCtrOptimizations',
      'imageProvider',
      'fallbackFeaturedImage',
      'contentRefreshAfterDays',
      'flightTrackerEnabled',
      'flightTrackerCacheDurationMs',
      'flightTrackerMaxAircraftReturned',
      'flightTrackerDefaultRegion',
      'flightTrackerEnabledRegions',
      'flightTrackerShowCta',
      'flightTrackerPollingIntervalMs',
      'flightTrackerCommercialProvider',
      'scheduledQaEnabled',
      'qaScheduleTime',
      'qaFrequency',
      'notifyAdminOnIssues',
      'emailNotificationsEnabled',
      'whatsappNotificationsEnabled',
      'notificationRecipients',
      'whatsappNotificationRecipients',
      'notificationSeverityThreshold',
      'notificationQuietHours',
    ];
    const update = {};
    allowed.forEach((field) => {
      if (req.body?.[field] !== undefined) update[field] = req.body[field];
    });

    const settings = await BlogSettings.findOneAndUpdate(
      { singletonKey: 'ai-blog-settings' },
      { $set: update, $setOnInsert: { singletonKey: 'ai-blog-settings' } },
      { new: true, upsert: true }
    );
    return res.json(settings);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update blog settings' });
  }
};

exports.enqueueAiArticle = async (req, res) => {
  try {
    const job = await enqueueBlogJob('generate_article', req.body || {});
    return res.status(202).json(job);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to queue AI article job' });
  }
};

exports.getRecentBlogJobs = async (_req, res) => {
  try {
    const jobs = await getRecentJobs(40);
    return res.json(jobs);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load blog jobs' });
  }
};

exports.getUsage = async (_req, res) => {
  try {
    return res.json(await getUsageSummary());
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load AI usage' });
  }
};

exports.getSeoQa = async (req, res) => {
  try {
    return res.json(await getSeoQaReport(String(req.query.issue || 'all')));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load SEO QA report' });
  }
};

exports.fixSeoQaItem = async (req, res) => {
  try {
    const { targetType, targetId, code } = req.body || {};
    const normalizedType = targetType === 'seoPage' ? 'seoPage' : targetType === 'post' ? 'post' : '';
    const normalizedCode = String(code || '').trim();

    if (!normalizedType) {
      return res.status(400).json({
        success: false,
        message: 'targetType must be either post or seoPage.',
        issueType: normalizedCode || '',
        recommendedAction: 'manual',
      });
    }
    if (!targetId || !mongoose.Types.ObjectId.isValid(String(targetId))) {
      return res.status(400).json({
        success: false,
        message: 'A valid targetId is required to fix a QA item.',
        issueType: normalizedCode || '',
        recommendedAction: 'manual',
      });
    }
    if (!normalizedCode) {
      return res.status(400).json({
        success: false,
        message: 'QA issue code is required.',
        issueType: '',
        recommendedAction: 'manual',
      });
    }

    const unsupported = {
      duplicate_slug: 'Duplicate slugs must be fixed manually by editing one of the slugs.',
      invalid_hreflang: 'Invalid hreflang data must be reviewed manually to avoid incorrect language URLs.',
      broken_internal_links: 'Broken links must be fixed with the broken-link report so valid targets can be chosen.',
      non_webp_image: 'Image conversion cannot be safely applied automatically from QA.',
      image_dimensions_missing: 'Image dimensions require checking the real image asset.',
      meta_title_long: 'Long meta titles require editorial review.',
      meta_description_length: 'Meta description length requires editorial review.',
      too_many_internal_links: 'Too many internal links requires editorial review.',
      low_quality_score: 'Low quality score requires content regeneration as a draft or manual editing.',
      article_too_short: 'Short articles require content regeneration as a draft or manual editing.',
    };
    if (unsupported[normalizedCode]) {
      const recommendedAction = ['low_quality_score', 'article_too_short'].includes(normalizedCode) ? 'regenerate' : 'manual';
      return res.status(400).json({
        success: false,
        message: unsupported[normalizedCode],
        issueType: normalizedCode,
        recommendedAction,
      });
    }

    const supported = new Set([
      'missing_meta_title',
      'missing_meta_description',
      'missing_canonical',
      'missing_faq',
      'missing_schema',
      'missing_image_alt',
      'missing_cta',
      'weak_internal_linking',
      'low_seo_score',
      'no_headings',
    ]);
    if (!supported.has(normalizedCode)) {
      return res.status(400).json({
        success: false,
        message: `QA issue "${normalizedCode}" cannot be auto-fixed safely.`,
        issueType: normalizedCode,
        recommendedAction: 'manual',
      });
    }

    const Model = targetType === 'seoPage' ? BlogSeoLandingPage : BlogPost;
    const doc = await Model.findById(targetId);
    if (!doc) return res.status(404).json({ error: 'Target not found' });
    await createVersion(normalizedType, doc, {
      changedBy: req.user?._id || null,
      action: `fix ${normalizedCode}`,
    });
    if (normalizedCode === 'missing_meta_title') doc.metaTitle = doc.metaTitle || doc.seoTitle || `${doc.title} | Skybridge Flights`;
    if (normalizedCode === 'missing_meta_description') doc.metaDescription = doc.metaDescription || doc.seoDescription || `Plan ${doc.title} with Skybridge Flights.`;
    if (normalizedCode === 'missing_canonical') doc.canonicalUrl = normalizedType === 'seoPage' ? `${SITE_URL}${doc.path || `/seo/${doc.slug}`}` : urlForPost(doc);
    if (normalizedCode === 'missing_image_alt') {
      if (normalizedType === 'seoPage') doc.image = { ...(doc.image || {}), alt: doc.image?.alt || `${doc.title} travel image` };
      else doc.imageAltText = doc.imageAltText || `${doc.title} travel image`;
    }
    if (normalizedCode === 'missing_faq') {
      doc.faq = doc.faq?.length ? doc.faq : [{ question: `How do I plan ${doc.title}?`, answer: 'Compare routes, verify travel details, and use Skybridge Flights when ready to book.' }];
    }
    if (normalizedCode === 'missing_cta') doc.cta = { label: 'Search flights with Skybridge Flights', url: '/flights', type: 'search' };
    if (normalizedCode === 'weak_internal_linking' && normalizedType === 'post') {
      doc.internalLinks = await buildInternalLinks(doc.toObject ? doc.toObject() : doc, {});
      if (doc.content && doc.internalLinks?.length) {
        const inserted = insertInternalLinks(doc.content, doc.internalLinks, {});
        doc.content = inserted.content;
        doc.insertedLinksReport = inserted.report;
      }
    }
    if (normalizedCode === 'no_headings' && normalizedType === 'post') {
      if (!/^#|<h[1-3]/im.test(doc.content || '')) doc.content = `# ${doc.title}\n\n${doc.content || ''}`;
    }
    if (normalizedCode === 'missing_schema' && normalizedType === 'seoPage') {
      doc.schemaMarkup = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: doc.title,
        description: doc.metaDescription || `Plan ${doc.title} with Skybridge Flights.`,
        url: doc.canonicalUrl || `${SITE_URL}${doc.path || `/seo/${doc.slug}`}`,
      };
    }
    if (normalizedType === 'post') await applySeoAndGuardrails(doc);
    if (normalizedType === 'seoPage') {
      if (normalizedCode === 'low_seo_score') {
        doc.metaTitle = doc.metaTitle || `${doc.title} | Skybridge Flights`;
        doc.metaDescription = doc.metaDescription || `Plan ${doc.title} with Skybridge Flights. Compare routes, services, and travel options before booking.`;
        doc.canonicalUrl = doc.canonicalUrl || `${SITE_URL}${doc.path || `/seo/${doc.slug}`}`;
        doc.faq = doc.faq?.length ? doc.faq : [{ question: `How do I plan ${doc.title}?`, answer: 'Compare route options, confirm travel requirements, and continue with Skybridge Flights services when ready.' }];
        doc.cta = doc.cta?.url ? doc.cta : { label: 'Search flights with Skybridge Flights', url: '/flights', type: 'search' };
      }
      doc.seoScore = scoreLandingPage(doc);
    }
    await doc.save();
    return res.json({
      success: true,
      message: 'QA issue fixed safely.',
      issueType: normalizedCode,
      recommendedAction: 'fix',
      item: doc,
    });
  } catch (error) {
    console.error('fixSeoQaItem error:', sanitizeErrorMessage(error));
    return res.status(500).json({
      success: false,
      message: 'Failed to fix QA item.',
      error: 'Failed to fix QA item',
      details: sanitizeErrorMessage(error),
      issueType: req.body?.code || '',
      recommendedAction: 'manual',
    });
  }
};

exports.getBrokenLinks = async (_req, res) => {
  try {
    return res.json(await getBrokenLinkReport());
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load broken link report' });
  }
};

exports.runBrokenLinks = async (_req, res) => {
  try {
    return res.json(await runBrokenLinkCheck());
  } catch (error) {
    return res.status(500).json({ error: 'Failed to run broken link check' });
  }
};

exports.getSitemapQaAdmin = async (_req, res) => {
  try {
    return res.json(await getSitemapQa());
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load sitemap QA' });
  }
};

exports.getAssets = async (_req, res) => {
  try {
    return res.json(await listAssets());
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load assets' });
  }
};

exports.createAssetAdmin = async (req, res) => {
  try {
    const asset = await createAsset(req.body || {}, req.user?._id || null);
    return res.status(201).json(asset);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to create asset' });
  }
};

exports.getVersions = async (req, res) => {
  try {
    return res.json(await listVersions(req.params.targetType, req.params.targetId));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load versions' });
  }
};

exports.rollbackVersionAdmin = async (req, res) => {
  try {
    return res.json(await rollbackVersion(req.params.versionId, req.user?._id || null));
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to rollback version' });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const { listNotifications } = require('../services/blogNotificationService');
    return res.json(await listNotifications({
      severity: String(req.query.severity || 'all'),
      unreadOnly: req.query.unread === 'true',
    }));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load notifications' });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const { markNotificationRead } = require('../services/blogNotificationService');
    return res.json(await markNotificationRead(req.params.id));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to mark notification read' });
  }
};

exports.runQaNow = async (_req, res) => {
  try {
    const { runScheduledQa } = require('../services/blogQaRunnerService');
    return res.json(await withSchedulerLock(
      'manual-qa',
      () => runScheduledQa({ source: 'manual' }),
      { ttlMs: 45 * 60 * 1000, metadata: { source: 'manual' } }
    ));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to run QA' });
  }
};

exports.getHealth = async (_req, res) => {
  try {
    const { getBlogHealth } = require('../services/blogHealthService');
    return res.json(await getBlogHealth());
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load health dashboard' });
  }
};

exports.runProductionTests = async (_req, res) => {
  try {
    const settings = await BlogSettings.findOne({ singletonKey: 'ai-blog-settings' }).lean();
    const { runBlogSystemTests } = require('../services/blogTestService');
    return res.json(await runBlogSystemTests(settings || {}));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to run blog system tests' });
  }
};

exports.getSearchConsole = async (_req, res) => {
  try {
    return res.json(await getSearchConsoleSummary());
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load Search Console summary' });
  }
};

exports.getWeakSeoPages = async (_req, res) => {
  try {
    return res.json(await findWeakSeoPages());
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load weak SEO pages' });
  }
};

exports.syncSearchConsoleAdmin = async (_req, res) => {
  try {
    return res.json(await withSchedulerLock(
      'search-console-sync',
      () => syncSearchConsole(),
      { ttlMs: 20 * 60 * 1000, metadata: { source: 'manual' } }
    ));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to sync Search Console' });
  }
};

exports.getRefreshCandidates = async (_req, res) => {
  try {
    const settings = await BlogSettings.findOne({ singletonKey: 'ai-blog-settings' }).lean();
    const days = settings?.contentRefreshAfterDays || 180;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const weak = await findWeakSeoPages();
    const oldPosts = await BlogPost.find({
      status: 'published',
      $or: [{ lastReviewedAt: { $lte: cutoff } }, { lastReviewedAt: null, publishedAt: { $lte: cutoff } }],
    })
      .select('title slug language publishedAt lastReviewedAt searchConsole analytics')
      .limit(20)
      .lean();
    const merged = new Map();
    oldPosts.forEach((post) => merged.set(String(post._id), { ...post, refreshReasons: ['Old or not recently reviewed'] }));
    weak.forEach((post) => merged.set(String(post._id), { ...post, refreshReasons: post.weakReasons || ['Weak SEO performance'] }));
    return res.json([...merged.values()]);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load refresh candidates' });
  }
};

exports.createRefreshSuggestion = async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Blog post not found' });
    await createVersion('post', post, {
      changedBy: req.user?._id || null,
      action: 'create refresh suggestion',
    });
    const suggestion = {
      reason: req.body?.reason || 'Manual refresh suggestion',
      suggestedMetaTitle: `${post.title}: Updated Travel Planning Guide`,
      suggestedMetaDescription: `Review updated travel planning tips for ${post.title} with Skybridge Flights, including route, baggage, airport, hotel, and booking guidance.`,
      suggestedSections: [
        {
          heading: 'Updated planning checklist',
          body: 'Review official airline, airport, visa, baggage, hotel, and transfer details before booking or departure.',
        },
      ],
      applied: false,
    };
    post.refreshSuggestions.push(suggestion);
    post.seoVersions.push({
      reason: suggestion.reason,
      oldMetaTitle: post.metaTitle || post.seoTitle || '',
      oldMetaDescription: post.metaDescription || post.seoDescription || '',
      newMetaTitle: suggestion.suggestedMetaTitle,
      newMetaDescription: suggestion.suggestedMetaDescription,
      applied: false,
    });
    post.status = 'draft';
    post.publishedAt = null;
    post.lastReviewedAt = new Date();
    await post.save();
    return res.json({
      success: true,
      message: 'Refresh suggestion created. The article remains saved as draft for review.',
      recommendedAction: 'regenerate',
      item: post,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create refresh suggestion.',
      error: 'Failed to create refresh suggestion',
      details: sanitizeErrorMessage(error),
      recommendedAction: 'manual',
    });
  }
};

exports.regenerateMetaForPost = async (req, res) => {
  try {
    const settings = await BlogSettings.findOne({ singletonKey: 'ai-blog-settings' }).lean();
    const post = await regenerateMeta(req.params.id, {
      apply: req.body?.apply ?? !!settings?.autoApplyCtrOptimizations,
      reason: req.body?.reason || 'Admin CTR optimization',
    });
    return res.json(post);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to regenerate meta fields' });
  }
};

exports.listSeoLandingPages = async (_req, res) => {
  try {
    const pages = await BlogSeoLandingPage.find({}).sort({ updatedAt: -1 });
    return res.json(pages);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load SEO landing pages' });
  }
};

exports.getPublishedSeoLandingPage = async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    const path = String(req.query.path || '').trim();
    const language = String(req.query.language || req.query.lang || '').trim();
    const filter = { status: 'published' };
    if (path) filter.path = path;
    else filter.slug = slug;
    if (language) filter.language = language;

    let page = await BlogSeoLandingPage.findOne(filter);
    if (!page && language) {
      delete filter.language;
      page = await BlogSeoLandingPage.findOne(filter);
    }
    if (!page) return res.status(404).json({ error: 'SEO landing page not found' });

    const translations = page.translationGroup
      ? await BlogSeoLandingPage.find({ translationGroup: page.translationGroup, status: 'published' }).select('title slug path language canonicalUrl')
      : [];

    return res.json({
      page,
      translations,
      hreflang: translations.map((item) => ({
        language: item.language,
        slug: item.slug,
        url: item.canonicalUrl || `${SITE_URL}${item.path}`,
      })),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load SEO landing page' });
  }
};

exports.trackSeoLandingPageView = async (req, res) => {
  try {
    const page = await BlogSeoLandingPage.findById(req.params.id);
    if (!page) return res.status(404).json({ error: 'SEO landing page not found' });
    const today = new Date().toISOString().slice(0, 10);
    page.analytics.totalViews += 1;
    const daily = page.analytics.dailyViews.find((item) => item.date === today);
    if (daily) daily.views += 1;
    else page.analytics.dailyViews.push({ date: today, views: 1 });
    await page.save();
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to track page view' });
  }
};

exports.trackSeoLandingPageCta = async (req, res) => {
  try {
    const page = await BlogSeoLandingPage.findByIdAndUpdate(req.params.id, { $inc: { 'analytics.ctaClicks': 1 } }, { new: true });
    if (!page) return res.status(404).json({ error: 'SEO landing page not found' });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to track CTA click' });
  }
};

exports.createSeoLandingPage = async (req, res) => {
  try {
    if (req.body?.status === 'published' && !req.user?.isAdmin && !req.user?.permissions?.publishBlog) {
      return res.status(403).json({ error: 'Publishing SEO landing pages requires publishBlog permission.' });
    }
    const page = await createLandingPage(req.body || {});
    return res.status(201).json(page);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to create SEO landing page' });
  }
};

exports.updateSeoLandingPage = async (req, res) => {
  try {
    const current = await BlogSeoLandingPage.findById(req.params.id);
    if (!current) return res.status(404).json({ error: 'SEO landing page not found' });
    if (req.body?.status === 'published' && current.status !== 'published' && !req.user?.isAdmin && !req.user?.permissions?.publishBlog) {
      return res.status(403).json({ error: 'Publishing SEO landing pages requires publishBlog permission.' });
    }
    await createVersion('seoPage', current, { changedBy: req.user?._id || null, action: 'update SEO landing page' });
    const update = { ...(req.body || {}) };
    if (update.status === 'published' && !update.publishedAt) update.publishedAt = new Date();
    if (update.status === 'archived') update.publishedAt = null;
    if (update.path && !update.canonicalUrl) update.canonicalUrl = `${SITE_URL}${update.path}`;
    update.seoScore = scoreLandingPage({ ...update });
    const page = await BlogSeoLandingPage.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!page) return res.status(404).json({ error: 'SEO landing page not found' });
    return res.json(page);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update SEO landing page' });
  }
};

exports.generateSeoLandingPage = async (req, res) => {
  try {
    if (req.body?.status === 'published' && !req.user?.isAdmin && !req.user?.permissions?.publishBlog) {
      return res.status(403).json({ error: 'Publishing SEO landing pages requires publishBlog permission.' });
    }
    const payload = buildLandingPayload(req.body || {});
    payload.status = req.body?.status || 'draft';
    payload.seoScore = scoreLandingPage(payload);
    const page = await BlogSeoLandingPage.create(payload);
    return res.status(201).json(page);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to generate SEO landing page' });
  }
};

exports.generateAiArticle = async (req, res) => {
  try {
    const { topic, language = 'en', languages, multilingual = false, autoPublish = null } = req.body || {};
    const result = multilingual
      ? await generateMultilingualArticle({ topic, languages, autoPublish })
      : await generateArticle({ topic, language, autoPublish });
    return res.status(201).json(result);
  } catch (error) {
    console.error('generateAiArticle error:', error);
    return res.status(400).json({ error: error.message || 'Failed to generate AI article' });
  }
};

exports.regenerateSeo = async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Blog post not found' });
    await applySeoAndGuardrails(post);
    await post.save();
    return res.json(post);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to regenerate SEO' });
  }
};

exports.runTrendResearchAdmin = async (req, res) => {
  try {
    const settings = await BlogSettings.findOne({ singletonKey: 'ai-blog-settings' });
    const result = await runTrendResearch(settings || {});
    return res.json(result);
  } catch (error) {
    console.error('runTrendResearchAdmin error:', error);
    return res.status(500).json({ error: 'Failed to run trend research' });
  }
};

exports.runAutoPublisherAdmin = async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const topic = String(req.body?.topic || '').trim();
    const result = await withSchedulerLock(
      `daily-ai-generation:${today}`,
      () => runAutoPublisher({ manual: true, topic: topic || null }),
      { ttlMs: 30 * 60 * 1000, metadata: { source: 'manual', hasTopicOverride: !!topic } }
    );
    return res.json(result);
  } catch (error) {
    const message = sanitizeErrorMessage(error);
    const status = error.code === 'AI_BUDGET_EXCEEDED' ? 402 : 400;
    return res.status(status).json({
      error: message || 'Failed to run auto publisher',
      code: error.code || 'AUTO_PUBLISHER_FAILED',
      details: message,
    });
  }
};

exports.getAnalyticsDashboard = async (_req, res) => {
  try {
    const posts = await BlogPost.find({}).select('title slug language status category analytics conversionTracking seoScore qualityScore publishedAt searchConsole').lean();
    const totals = posts.reduce(
      (acc, post) => {
        acc.views += post.analytics?.totalViews || 0;
        acc.uniqueVisitors += post.analytics?.uniqueVisitors || 0;
        acc.ctaClicks += post.analytics?.ctaClicks || 0;
        acc.conversions += post.conversionTracking?.clicks || 0;
        return acc;
      },
      { views: 0, uniqueVisitors: 0, ctaClicks: 0, conversions: 0 }
    );

    const mostRead = [...posts].sort((a, b) => (b.analytics?.totalViews || 0) - (a.analytics?.totalViews || 0)).slice(0, 10);
    const languageViews = posts.reduce((acc, post) => {
      acc[post.language] = (acc[post.language] || 0) + (post.analytics?.totalViews || 0);
      return acc;
    }, {});
    const viewsOverTime = posts.reduce((acc, post) => {
      (post.analytics?.dailyViews || []).forEach((item) => {
        acc[item.date] = (acc[item.date] || 0) + (item.views || 0);
      });
      return acc;
    }, {});
    const referrers = posts.reduce((acc, post) => {
      (post.analytics?.referrers || []).forEach((item) => {
        acc[item.source] = (acc[item.source] || 0) + (item.count || 0);
      });
      return acc;
    }, {});
    const searchConsole = posts.reduce(
      (acc, post) => {
        acc.clicks += post.searchConsole?.clicks || 0;
        acc.impressions += post.searchConsole?.impressions || 0;
        return acc;
      },
      { clicks: 0, impressions: 0 }
    );
    searchConsole.ctr = searchConsole.impressions ? searchConsole.clicks / searchConsole.impressions : 0;

    return res.json({ totals, mostRead, languageViews, viewsOverTime, referrers, searchConsole, posts });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load blog analytics' });
  }
};

exports.getSitemap = async (_req, res) => {
  try {
    const [posts, landingPages] = await Promise.all([
      BlogPost.find({ status: 'published' }).select('slug language updatedAt publishedAt canonicalUrl translationGroup'),
      BlogSeoLandingPage.find({ status: 'published' }).select('path updatedAt'),
    ]);
    const staticUrls = ['/', '/flights', '/flight-tracker', '/blog', '/about', '/contact'];
    const airportUrls = getAirportCodes().map((code) => `/airports/${code}`);
    const liveFlightUrls = String(process.env.FLIGHT_TRACKER_SITEMAP_FLIGHTS || 'TK1722,EK46,ME216')
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter((item) => /^[A-Z0-9]{3,8}$/.test(item))
      .slice(0, 12)
      .map((flightNumber) => `/live-flights/${flightNumber}`);
    const urls = staticUrls
      .concat(airportUrls)
      .concat(liveFlightUrls)
      .map(
        (path) => `
    <url>
      <loc>${SITE_URL}${path}</loc>
      <changefreq>${path === '/blog' || path === '/flight-tracker' || path.startsWith('/live-flights/') ? 'daily' : 'weekly'}</changefreq>
      <priority>${path === '/' ? '1.0' : path.startsWith('/live-flights/') ? '0.74' : path.startsWith('/airports/') ? '0.72' : '0.8'}</priority>
    </url>`
      )
      .join('');

    const postUrls = posts
      .map((post) => {
        const loc = post.canonicalUrl || urlForPost(post);
        const lastmod = (post.updatedAt || post.publishedAt || new Date()).toISOString();
        return `
  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
      })
      .join('');
    const landingUrls = landingPages
      .map((page) => `
  <url>
    <loc>${SITE_URL}${page.path}</loc>
    <lastmod>${(page.updatedAt || new Date()).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.75</priority>
  </url>`)
      .join('');

    res.set('Content-Type', 'application/xml');
    return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
${postUrls}
${landingUrls}
</urlset>`);
  } catch (error) {
    return res.status(500).send('Failed to generate sitemap');
  }
};

exports.getRobots = (_req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Allow: /flight-tracker
Allow: /airports/
Allow: /live-flights/
Sitemap: ${SITE_URL}/sitemap.xml
`);
};
