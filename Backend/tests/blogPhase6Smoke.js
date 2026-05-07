const assert = require('assert');
const blogRoutes = require('../routes/blogRoutes');
const { requirePerm, adminOnly } = require('../middleware/authMiddleware');
const { buildAlertTemplate } = require('../services/blogAlertTemplateService');
const { shouldDeliver } = require('../services/blogNotificationDeliveryService');

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

  console.log('Phase 6 blog smoke tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
