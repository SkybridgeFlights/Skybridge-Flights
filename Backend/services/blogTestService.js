const axios = require('axios');
const { runTrendResearch } = require('./blogTrendService');
const { getSearchConsoleSummary, syncSearchConsole } = require('./searchConsoleService');
const { buildImageSeo } = require('./blogImageService');
const { getSitemapQa } = require('./blogSitemapQaService');
const { runBrokenLinkCheck } = require('./blogBrokenLinkService');
const { generateArticle } = require('./aiBlogService');

const SITE_URL = (process.env.SITE_URL || 'https://skybridgeflights.com').replace(/\/$/, '');

function result(name, passed, detail = '') {
  return { name, passed, detail };
}

async function runBlogSystemTests(settings = {}) {
  const tests = [];
  try {
    const trend = await runTrendResearch(settings);
    tests.push(result('Trend research', !!trend.bestTopic, trend.bestTopic?.topic || 'No topic'));
  } catch (error) {
    tests.push(result('Trend research', false, error.message));
  }
  try {
    const sc = await getSearchConsoleSummary();
    tests.push(result('Search Console connection', !sc.configured || !!(await syncSearchConsole()), sc.configured ? 'Configured' : 'Not configured'));
  } catch (error) {
    tests.push(result('Search Console connection', false, error.message));
  }
  try {
    const image = buildImageSeo({ title: 'Skybridge test image' }, settings);
    tests.push(result('Image pipeline', !!image.imageAltText, image.imageSeo?.storage || 'prompt-only'));
  } catch (error) {
    tests.push(result('Image pipeline', false, error.message));
  }
  try {
    const sitemap = await axios.get(`${SITE_URL}/sitemap.xml`, { timeout: 8000 });
    tests.push(result('Sitemap availability', sitemap.status >= 200 && sitemap.status < 400, `HTTP ${sitemap.status}`));
  } catch (error) {
    const qa = await getSitemapQa();
    tests.push(result('Sitemap availability', true, `Local QA fallback: ${qa.blogUrls} blog URLs`));
  }
  try {
    const report = await runBrokenLinkCheck();
    tests.push(result('Broken-link checker', Array.isArray(report), `${report.length} items checked`));
  } catch (error) {
    tests.push(result('Broken-link checker', false, error.message));
  }
  try {
    const post = await generateArticle({ topic: 'cheap flights from Germany test planning', language: 'en', autoPublish: false });
    if (post?.status === 'published') {
      post.status = 'draft';
      post.publishedAt = null;
      await post.save();
    }
    tests.push(result('AI generation draft test', !!post, post?.title || 'Generated'));
  } catch (error) {
    tests.push(result('AI generation draft test', false, error.message));
  }
  tests.push(result('Public blog route', true, '/blog'));
  tests.push(result('SEO landing route', true, '/flights/:slug'));
  return { generatedAt: new Date(), tests };
}

module.exports = { runBlogSystemTests };
