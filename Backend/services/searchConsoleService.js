const BlogPost = require('../models/BlogPost');
const axios = require('axios');
const crypto = require('crypto');
const { blogLog } = require('./blogLoggerService');

const SITE_URL = (process.env.SITE_URL || 'https://skybridgeflights.com').replace(/\/$/, '');

function isConfigured() {
  return !!(
    process.env.SEARCH_CONSOLE_CLIENT_EMAIL &&
    process.env.SEARCH_CONSOLE_PRIVATE_KEY &&
    process.env.SEARCH_CONSOLE_SITE_URL
  );
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: process.env.SEARCH_CONSOLE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const key = String(process.env.SEARCH_CONSOLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(key);
  const assertion = `${unsigned}.${base64url(signature)}`;
  const params = new URLSearchParams();
  params.set('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  params.set('assertion', assertion);
  const { data } = await axios.post('https://oauth2.googleapis.com/token', params, { timeout: 15000 });
  return data.access_token;
}

async function querySearchConsole(accessToken, body) {
  const siteUrl = encodeURIComponent(process.env.SEARCH_CONSOLE_SITE_URL);
  const { data } = await axios.post(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`,
    body,
    { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 20000 }
  );
  return data.rows || [];
}

async function getSearchConsoleSummary() {
  if (!isConfigured()) {
    return {
      configured: false,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      averagePosition: 0,
      topQueries: [],
      topPages: [],
    };
  }

  const posts = await BlogPost.find({ status: 'published' })
    .select('title slug searchConsole')
    .sort({ 'searchConsole.impressions': -1 })
    .limit(20)
    .lean();

  const totals = posts.reduce(
    (acc, post) => {
      acc.impressions += post.searchConsole?.impressions || 0;
      acc.clicks += post.searchConsole?.clicks || 0;
      return acc;
    },
    { impressions: 0, clicks: 0 }
  );

  return {
    configured: true,
    impressions: totals.impressions,
    clicks: totals.clicks,
    ctr: totals.impressions ? totals.clicks / totals.impressions : 0,
    averagePosition: 0,
    topQueries: [...new Set(posts.flatMap((post) => post.searchConsole?.topQueries || []))].slice(0, 10),
    topPages: posts,
  };
}

async function syncSearchConsole() {
  if (!isConfigured()) {
    blogLog('search_console.sync_skipped', { configured: false });
    return { configured: false, synced: false, message: 'Search Console credentials are not configured.' };
  }

  try {
    const accessToken = await getAccessToken();
    const end = new Date();
    end.setDate(end.getDate() - 2);
    const start = new Date(end);
    start.setDate(start.getDate() - 28);
    const dateBody = {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      rowLimit: 100,
    };

    const pageRows = await querySearchConsole(accessToken, {
      ...dateBody,
      dimensions: ['page'],
      aggregationType: 'byPage',
    });
    const queryRows = await querySearchConsole(accessToken, {
      ...dateBody,
      dimensions: ['page', 'query'],
      rowLimit: 500,
    });

    const posts = await BlogPost.find({ status: 'published' }).select('slug language canonicalUrl searchConsole');
    let updated = 0;

    for (const post of posts) {
      const lang = post.language && post.language !== 'en' ? `/${post.language}` : '';
      const url = post.canonicalUrl || `${SITE_URL}/blog${lang}/${post.slug}`;
      const row = pageRows.find((item) => String(item.keys?.[0] || '').replace(/\/$/, '') === url.replace(/\/$/, ''));
      const queries = queryRows
        .filter((item) => String(item.keys?.[0] || '').replace(/\/$/, '') === url.replace(/\/$/, ''))
        .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
        .slice(0, 10)
        .map((item) => item.keys?.[1])
        .filter(Boolean);

      if (row || queries.length) {
        post.searchConsole = {
          impressions: row?.impressions || 0,
          clicks: row?.clicks || 0,
          ctr: row?.ctr || 0,
          averagePosition: row?.position || 0,
          topQueries: queries,
          lastSyncedAt: new Date(),
        };
        await post.save();
        updated += 1;
      }
    }

    const result = { configured: true, synced: true, updated, pageRows: pageRows.length, queryRows: queryRows.length };
    blogLog('search_console.sync_completed', result);
    return result;
  } catch (error) {
    blogLog('search_console.sync_failed', { message: error.message }, 'warn');
    return { configured: true, synced: false, error: error.message };
  }
}

async function findWeakSeoPages() {
  const posts = await BlogPost.find({ status: 'published' })
    .select('title slug language metaTitle metaDescription analytics searchConsole seoVersions')
    .lean();

  return posts
    .map((post) => {
      const impressions = post.searchConsole?.impressions || 0;
      const clicks = post.searchConsole?.clicks || 0;
      const ctr = impressions ? clicks / impressions : 0;
      const readTime = post.analytics?.averageReadTimeSeconds || 0;
      const reasons = [];
      if (impressions >= 100 && ctr < 0.02) reasons.push('High impressions with low CTR');
      if (readTime > 0 && readTime < 35) reasons.push('Low average read time');
      if ((post.analytics?.totalViews || 0) === 0 && impressions > 0) reasons.push('Search visibility without onsite engagement');
      return { ...post, ctr, weakReasons: reasons };
    })
    .filter((post) => post.weakReasons.length)
    .slice(0, 20);
}

function suggestSeo(post) {
  const baseTitle = String(post.title || '').replace(/\s+\|\s+Skybridge Flights.*$/i, '');
  return {
    metaTitle: `${baseTitle}: Travel Tips & Booking Guide`,
    metaDescription: `Plan ${baseTitle} with Skybridge Flights. Compare flights, baggage, airport, hotel, car rental, and travel support options before booking.`,
  };
}

async function regenerateMeta(postId, { apply = false, reason = 'CTR optimization' } = {}) {
  const post = await BlogPost.findById(postId);
  if (!post) throw new Error('Blog post not found');
  const suggestion = suggestSeo(post);

  post.seoVersions.push({
    reason,
    oldMetaTitle: post.metaTitle || post.seoTitle || '',
    oldMetaDescription: post.metaDescription || post.seoDescription || '',
    newMetaTitle: suggestion.metaTitle,
    newMetaDescription: suggestion.metaDescription,
    applied: apply,
  });

  if (apply) {
    post.metaTitle = suggestion.metaTitle;
    post.seoTitle = suggestion.metaTitle;
    post.metaDescription = suggestion.metaDescription;
    post.seoDescription = suggestion.metaDescription;
    post.lastUpdatedAt = new Date();
  }

  await post.save();
  return post;
}

module.exports = {
  findWeakSeoPages,
  getSearchConsoleSummary,
  regenerateMeta,
  syncSearchConsole,
};
