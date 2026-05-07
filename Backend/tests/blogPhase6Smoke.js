const assert = require('assert');
const blogRoutes = require('../routes/blogRoutes');
const blogController = require('../controllers/blogController');
const { runAutoPublisher } = require('../services/blogScheduler');
const { requirePerm, adminOnly } = require('../middleware/authMiddleware');
const { buildAlertTemplate } = require('../services/blogAlertTemplateService');
const { shouldDeliver } = require('../services/blogNotificationDeliveryService');
const { __test: aiBlogTestHelpers } = require('../services/aiBlogService');
const { enrichSeo, scoreQuality, wordCount } = require('../services/blogSeoService');
const { evaluateDuplicateForValidation, jaccard, normalizeComparisonText } = require('../services/blogDuplicateService');
const { expandTopicCandidates, isDuplicateTopicCandidate, topicKey } = require('../services/blogTrendService');

function routeExists(path, method) {
  return blogRoutes.stack.some((layer) => {
    const route = layer.route;
    return route && route.path === path && route.methods[String(method).toLowerCase()];
  });
}

async function runMiddleware(middleware, req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ statusCode: this.statusCode, payload });
      },
    };
    middleware(req, res, () => resolve({ statusCode: 200, next: true }));
  });
}

async function main() {
  assert(routeExists('/admin/tests/run', 'post'), 'production tests endpoint should be registered');
  assert(routeExists('/admin/seo-qa/fix', 'post'), 'SEO QA fix endpoint should be registered');
  assert(routeExists('/admin/auto-publisher/run', 'post'), 'manual auto publisher endpoint should be registered');
  assert(routeExists('/admin/settings', 'put'), 'settings endpoint should be registered');
  assert(routeExists('/admin/:id/publish', 'post'), 'publish endpoint should be registered');
  assert(routeExists('/:lang/:slug', 'get'), 'public multilingual blog detail should be registered');
  assert(routeExists('/seo-pages/public/:slug', 'get'), 'public SEO landing page should be registered');

  const deniedPublish = await runMiddleware(requirePerm('publishBlog'), {
    user: { isAdmin: false, permissions: { manageBlog: true } },
  });
  assert.strictEqual(deniedPublish.statusCode, 403, 'manageBlog alone must not publish');

  const allowedPublish = await runMiddleware(requirePerm('publishBlog'), {
    user: { isAdmin: false, permissions: { publishBlog: true } },
  });
  assert.strictEqual(allowedPublish.statusCode, 200, 'publishBlog permission should publish');

  const deniedSettings = await runMiddleware(adminOnly, {
    user: { isAdmin: false, permissions: { manageBlog: true } },
  });
  assert.strictEqual(deniedSettings.statusCode, 403, 'settings require admin');

  const template = buildAlertTemplate({
    type: 'publish_blocked',
    severity: 'warning',
    title: 'Publish blocked',
    message: 'FAQ is required',
    targetType: 'post',
    targetId: '507f1f77bcf86cd799439011',
  });
  assert(template.subject.includes('Skybridge Blog'), 'alert subject should include product label');
  assert(template.text.includes('Recommended action'), 'alert text should include action');

  assert.strictEqual(
    shouldDeliver({ type: 'publish_blocked', severity: 'warning' }, { notificationSeverityThreshold: 'error' }),
    false,
    'warning should not deliver when threshold is error'
  );
  assert.strictEqual(
    shouldDeliver({ type: 'budget_limit', severity: 'error' }, { notificationSeverityThreshold: 'warning' }),
    true,
    'critical budget alert should deliver'
  );
  assert.strictEqual(typeof blogController.fixSeoQaItem, 'function', 'SEO QA fix controller should be exported');
  assert.strictEqual(typeof blogController.runAutoPublisherAdmin, 'function', 'auto publisher controller should be exported');
  assert.strictEqual(typeof runAutoPublisher, 'function', 'auto publisher service should be exported');

  const fallbackArticle = aiBlogTestHelpers.fallbackArticle('cheap flights from Germany to Turkey', 'en');
  const fallbackPost = {
    ...fallbackArticle,
    slug: 'cheap-flights-from-germany-to-turkey',
    language: 'en',
    internalLinks: [
      { anchor: 'flight options', url: '/flights' },
      { anchor: 'hotel planning', url: '/hotels' },
      { anchor: 'car rental', url: '/cars' },
    ],
    cta: { label: 'Compare travel options with Skybridge Flights', url: '/flights' },
    lastReviewedAt: new Date(),
  };
  const quality = scoreQuality(fallbackPost);
  const seo = enrichSeo(fallbackPost);
  assert(wordCount(fallbackPost.content) >= 1400, 'fallback article should be long-form');
  assert((fallbackPost.faq || []).length >= 4, 'fallback article should include full FAQ');
  assert((fallbackPost.keywords || []).length >= 6, 'fallback article should include primary, secondary, and semantic keywords');
  assert(quality.score >= 80, `fallback article quality should pass guardrails: ${quality.reasons.join(', ')}`);
  assert(seo.seoScore >= 75, `fallback article SEO should pass guardrails: ${seo.guardrailReasons.join(', ')}`);
  assert.strictEqual(
    jaccard('# FAQ\nSkybridge Flights travel guide tips', '## Final Tips / CTA\nSkybridge Flights booking guide'),
    0,
    'generic travel headings and CTA filler should not create duplicate similarity'
  );
  assert(!normalizeComparisonText('## FAQ\nCan Skybridge Flights help?\nYes.\n## Final Tips / CTA\nCompare travel options with Skybridge Flights').trim(), 'FAQ and CTA boilerplate should be stripped from duplicate comparison');
  const travelAdvice = scoreQuality({
    ...fallbackPost,
    content: `${fallbackPost.content}\n\nAirline tips and airport tips can include baggage, route timing, budget advice, seasonal travel suggestions, and booking strategy advice without becoming medical, legal, or financial advice.`,
  });
  assert(
    !travelAdvice.reasons.some((reason) => reason.includes('Unsupported medical')),
    'normal travel advice should not trigger unsupported claim detection'
  );
  const publishPass = evaluateDuplicateForValidation(
    { maxSimilarity: 0.92, threshold: 0.9 },
    { semanticSimilarityThreshold: 0.9, publishSimilarityThreshold: 0.94 },
    'publish-validation'
  );
  assert.strictEqual(publishPass.publishAllowed, true, '0.92 should pass publish threshold 0.94');
  assert.strictEqual(publishPass.thresholdUsed, 0.94, 'publish validation should use publishSimilarityThreshold');
  const publishFail = evaluateDuplicateForValidation(
    { maxSimilarity: 0.95, threshold: 0.9 },
    { semanticSimilarityThreshold: 0.9, publishSimilarityThreshold: 0.94 },
    'publish-validation'
  );
  assert.strictEqual(publishFail.publishAllowed, false, '0.95 should fail publish threshold 0.94');
  const draftFail = evaluateDuplicateForValidation(
    { maxSimilarity: 0.92, threshold: 0.9 },
    { semanticSimilarityThreshold: 0.9, publishSimilarityThreshold: 0.94 },
    'draft-validation'
  );
  assert.strictEqual(draftFail.publishAllowed, false, 'draft validation should still use stricter semantic threshold');
  const candidates = expandTopicCandidates(['cheap flights from Germany'], {});
  assert(candidates.length >= 10, 'trend engine should create at least 10 topic candidates');
  assert(
    isDuplicateTopicCandidate('cheap flights from Germany', {
      titles: ['Cheap Flights From Germany'],
      slugs: [],
      topicKeys: [topicKey('cheap flights from Germany')],
      fingerprints: [],
    }),
    'duplicate topic candidates should be filtered before generation'
  );

  console.log('Phase 6 blog smoke tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
