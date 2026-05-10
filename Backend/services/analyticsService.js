const crypto = require('crypto');

const VisitorEvent = require('../models/VisitorEvent');
const AdClickEvent = require('../models/AdClickEvent');

const ALLOWED_EVENTS = new Set([
  'page_view',
  'tracker_view',
  'flight_search',
  'aircraft_selected',
  'flight_alert_subscribe',
  'booking_search_click',
  'hotel_click',
  'car_rental_click',
  'blog_view',
  'airport_page_view',
  'ad_impression',
  'ad_click',
  'affiliate_click',
  'cta_conversion',
]);

const MAX_METADATA_KEYS = 20;
const RECENT_EVENT_WINDOW_MS = 8 * 1000;
const recentEvents = new Map();

function getClientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.ip ||
    req.connection?.remoteAddress ||
    '';
}

function hashIp(ip = '') {
  const salt = process.env.ANALYTICS_IP_HASH_SALT || process.env.JWT_SECRET || 'skybridge-analytics-dev';
  return crypto.createHash('sha256').update(`${salt}:${String(ip || '')}`).digest('hex');
}

function detectDevice(userAgent = '') {
  const ua = String(userAgent || '').toLowerCase();
  if (/ipad|tablet/.test(ua)) return 'tablet';
  if (/mobile|android|iphone|ipod/.test(ua)) return 'mobile';
  return 'desktop';
}

function detectBrowser(userAgent = '') {
  const ua = String(userAgent || '');
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
  if (/Firefox\//.test(ua)) return 'Firefox';
  return 'unknown';
}

function deriveSource(referrer = '') {
  const value = String(referrer || '').trim();
  if (!value) return 'direct';
  try {
    const host = new URL(value).hostname.replace(/^www\./, '').toLowerCase();
    if (host.includes('google.')) return 'google';
    if (host.includes('bing.')) return 'bing';
    if (host.includes('facebook.') || host.includes('instagram.')) return 'meta';
    if (host.includes('skybridgeflights.com')) return 'internal';
    return host;
  } catch (_) {
    return 'referral';
  }
}

function cleanString(value = '', max = 300) {
  return String(value || '').trim().slice(0, max);
}

function sanitizeMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  return Object.entries(metadata).slice(0, MAX_METADATA_KEYS).reduce((acc, [key, value]) => {
    const cleanKey = cleanString(key, 60).replace(/[^a-zA-Z0-9_.:-]/g, '');
    if (!cleanKey) return acc;
    if (value == null) return acc;
    if (typeof value === 'number' || typeof value === 'boolean') {
      acc[cleanKey] = value;
    } else {
      acc[cleanKey] = cleanString(value, 240);
    }
    return acc;
  }, {});
}

function getMonetizationFlags() {
  return {
    ads: process.env.ENABLE_ADS === 'true',
    affiliates: process.env.ENABLE_AFFILIATES === 'true',
    sponsoredContent: process.env.ENABLE_SPONSORED_CONTENT === 'true',
  };
}

function shouldDedupe(event) {
  const key = [
    event.eventType,
    event.path,
    event.visitorId,
    event.sessionId,
    JSON.stringify(event.metadata || {}),
  ].join('|');
  const now = Date.now();
  const last = recentEvents.get(key);
  recentEvents.set(key, now);
  if (recentEvents.size > 1000) {
    for (const [entryKey, ts] of recentEvents.entries()) {
      if (now - ts > RECENT_EVENT_WINDOW_MS) recentEvents.delete(entryKey);
    }
  }
  return last && now - last < RECENT_EVENT_WINDOW_MS;
}

async function recordEvent(req, payload = {}) {
  const eventType = cleanString(payload.eventType, 80);
  if (!ALLOWED_EVENTS.has(eventType)) {
    const err = new Error('Unsupported analytics event type.');
    err.statusCode = 400;
    throw err;
  }

  const userAgent = cleanString(req.headers['user-agent'] || payload.userAgent || '', 600);
  const referrer = cleanString(payload.referrer || req.headers.referer || req.headers.referrer || '', 500);
  const event = {
    eventType,
    path: cleanString(payload.path || '/', 260) || '/',
    pageTitle: cleanString(payload.pageTitle || '', 180),
    referrer,
    source: cleanString(payload.source || deriveSource(referrer), 120),
    userAgent,
    deviceType: cleanString(payload.deviceType || detectDevice(userAgent), 40),
    browser: cleanString(payload.browser || detectBrowser(userAgent), 60),
    countryApprox: cleanString(payload.countryApprox || req.headers['cf-ipcountry'] || '', 80),
    sessionId: cleanString(payload.sessionId || '', 120),
    visitorId: cleanString(payload.visitorId || '', 120),
    ipHash: hashIp(getClientIp(req)),
    metadata: sanitizeMetadata(payload.metadata),
  };

  if (shouldDedupe(event)) {
    return { stored: false, deduped: true };
  }

  await VisitorEvent.create(event);
  if (eventType === 'ad_click' || eventType === 'affiliate_click') {
    await AdClickEvent.create({
      slotId: event.metadata.slotId || 'unknown',
      campaign: event.metadata.campaign || '',
      destination: event.metadata.destination || '',
      sessionId: event.sessionId,
      visitorId: event.visitorId,
      page: event.path,
    });
  }
  return { stored: true, deduped: false };
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfMonth() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function getSummary() {
  const today = startOfToday();
  const month = startOfMonth();
  const [
    visitorsToday,
    visitorsThisMonth,
    pageViews,
    uniqueVisitors,
    trackerSearches,
    aircraftSelected,
    flightAlertSubscribers,
    bookingCtaClicks,
    affiliateClicks,
  ] = await Promise.all([
    VisitorEvent.distinct('visitorId', { createdAt: { $gte: today } }).then((items) => items.filter(Boolean).length),
    VisitorEvent.distinct('visitorId', { createdAt: { $gte: month } }).then((items) => items.filter(Boolean).length),
    VisitorEvent.countDocuments({ eventType: { $in: ['page_view', 'tracker_view', 'blog_view', 'airport_page_view'] } }),
    VisitorEvent.distinct('visitorId', {}).then((items) => items.filter(Boolean).length),
    VisitorEvent.countDocuments({ eventType: 'flight_search' }),
    VisitorEvent.countDocuments({ eventType: 'aircraft_selected' }),
    VisitorEvent.countDocuments({ eventType: 'flight_alert_subscribe' }),
    VisitorEvent.countDocuments({ eventType: { $in: ['booking_search_click', 'hotel_click', 'car_rental_click'] } }),
    VisitorEvent.countDocuments({ eventType: 'affiliate_click' }),
  ]);

  return {
    visitorsToday,
    visitorsThisMonth,
    pageViews,
    uniqueVisitors,
    trackerSearches,
    aircraftSelected,
    flightAlertSubscribers,
    bookingCtaClicks,
    affiliateClicks,
  };
}

async function getTimeseries({ days = 30 } = {}) {
  const since = daysAgo(Math.min(Math.max(Number(days) || 30, 1), 90) - 1);
  return VisitorEvent.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          eventType: '$eventType',
        },
        count: { $sum: 1 },
        visitors: { $addToSet: '$visitorId' },
      },
    },
    {
      $group: {
        _id: '$_id.date',
        events: { $push: { type: '$_id.eventType', count: '$count' } },
        visits: { $sum: '$count' },
        visitors: { $sum: { $size: '$visitors' } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

async function getTopPages({ limit = 10 } = {}) {
  return VisitorEvent.aggregate([
    { $match: { eventType: { $in: ['page_view', 'tracker_view', 'blog_view', 'airport_page_view'] } } },
    {
      $group: {
        _id: '$path',
        pageTitle: { $last: '$pageTitle' },
        views: { $sum: 1 },
        visitors: { $addToSet: '$visitorId' },
      },
    },
    { $project: { path: '$_id', pageTitle: 1, views: 1, uniqueVisitors: { $size: '$visitors' }, _id: 0 } },
    { $sort: { views: -1 } },
    { $limit: Math.min(Number(limit) || 10, 50) },
  ]);
}

async function getTrackerAnalytics() {
  const [topSearches, topAirports, aircraftSelections] = await Promise.all([
    VisitorEvent.aggregate([
      { $match: { eventType: 'flight_search', 'metadata.query': { $exists: true, $ne: '' } } },
      { $group: { _id: '$metadata.query', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { query: '$_id', count: 1, _id: 0 } },
    ]),
    VisitorEvent.aggregate([
      { $match: { eventType: 'airport_page_view', 'metadata.airportCode': { $exists: true, $ne: '' } } },
      { $group: { _id: '$metadata.airportCode', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { airportCode: '$_id', count: 1, _id: 0 } },
    ]),
    VisitorEvent.countDocuments({ eventType: 'aircraft_selected' }),
  ]);

  return { topSearches, topAirports, aircraftSelections };
}

async function getConversions() {
  return VisitorEvent.aggregate([
    {
      $match: {
        eventType: {
          $in: ['flight_alert_subscribe', 'booking_search_click', 'hotel_click', 'car_rental_click', 'affiliate_click', 'cta_conversion', 'ad_click'],
        },
      },
    },
    { $group: { _id: '$eventType', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $project: { eventType: '$_id', count: 1, _id: 0 } },
  ]);
}

async function getMonetizationAnalytics() {
  const [topAdSlots, totals, affiliateClicks, ctaConversions] = await Promise.all([
    VisitorEvent.aggregate([
      { $match: { eventType: { $in: ['ad_impression', 'ad_click', 'affiliate_click'] }, 'metadata.slotId': { $exists: true, $ne: '' } } },
      {
        $group: {
          _id: '$metadata.slotId',
          impressions: { $sum: { $cond: [{ $eq: ['$eventType', 'ad_impression'] }, 1, 0] } },
          clicks: { $sum: { $cond: [{ $in: ['$eventType', ['ad_click', 'affiliate_click']] }, 1, 0] } },
        },
      },
      {
        $project: {
          slotId: '$_id',
          impressions: 1,
          clicks: 1,
          ctr: {
            $cond: [
              { $gt: ['$impressions', 0] },
              { $multiply: [{ $divide: ['$clicks', '$impressions'] }, 100] },
              0,
            ],
          },
          _id: 0,
        },
      },
      { $sort: { clicks: -1, impressions: -1 } },
      { $limit: 12 },
    ]),
    VisitorEvent.aggregate([
      { $match: { eventType: { $in: ['ad_impression', 'ad_click', 'affiliate_click', 'cta_conversion'] } } },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
    ]),
    AdClickEvent.countDocuments({}),
    VisitorEvent.countDocuments({ eventType: 'cta_conversion' }),
  ]);

  const counts = totals.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});
  const impressions = counts.ad_impression || 0;
  const adClicks = (counts.ad_click || 0) + (counts.affiliate_click || 0);
  const pageViews = await VisitorEvent.countDocuments({
    eventType: { $in: ['page_view', 'tracker_view', 'blog_view', 'airport_page_view'] },
  });

  return {
    flags: getMonetizationFlags(),
    topAdSlots,
    impressions,
    adClicks,
    affiliateClicks,
    ctaConversions,
    ctr: impressions > 0 ? (adClicks / impressions) * 100 : 0,
    conversionRate: pageViews > 0 ? (ctaConversions / pageViews) * 100 : 0,
  };
}

module.exports = {
  ALLOWED_EVENTS,
  recordEvent,
  getSummary,
  getTimeseries,
  getTopPages,
  getTrackerAnalytics,
  getConversions,
  getMonetizationAnalytics,
  getMonetizationFlags,
  __test: {
    hashIp,
    sanitizeMetadata,
    detectDevice,
    detectBrowser,
  },
};
