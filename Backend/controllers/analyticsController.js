const {
  recordEvent,
  getSummary,
  getTimeseries,
  getTopPages,
  getTrackerAnalytics,
  getConversions,
  getMonetizationAnalytics,
} = require('../services/analyticsService');

async function postEvent(req, res) {
  try {
    const result = await recordEvent(req, req.body || {});
    return res.status(result.stored ? 201 : 200).json({ ok: true, ...result });
  } catch (error) {
    console.warn('[analytics] event rejected:', error.message);
    return res.status(error.statusCode || 500).json({
      ok: false,
      message: error.statusCode ? error.message : 'Unable to record analytics event.',
    });
  }
}

async function summary(_req, res) {
  try {
    return res.json({ ok: true, ...(await getSummary()) });
  } catch (error) {
    console.warn('[analytics] summary failed:', error.message);
    return res.status(500).json({ ok: false, message: 'Unable to load analytics summary.' });
  }
}

async function timeseries(req, res) {
  try {
    return res.json({ ok: true, data: await getTimeseries({ days: req.query.days }) });
  } catch (error) {
    console.warn('[analytics] timeseries failed:', error.message);
    return res.status(500).json({ ok: false, message: 'Unable to load analytics timeseries.' });
  }
}

async function topPages(req, res) {
  try {
    return res.json({ ok: true, data: await getTopPages({ limit: req.query.limit }) });
  } catch (error) {
    console.warn('[analytics] top pages failed:', error.message);
    return res.status(500).json({ ok: false, message: 'Unable to load top pages.' });
  }
}

async function tracker(_req, res) {
  try {
    return res.json({ ok: true, ...(await getTrackerAnalytics()) });
  } catch (error) {
    console.warn('[analytics] tracker failed:', error.message);
    return res.status(500).json({ ok: false, message: 'Unable to load tracker analytics.' });
  }
}

async function conversions(_req, res) {
  try {
    return res.json({ ok: true, data: await getConversions() });
  } catch (error) {
    console.warn('[analytics] conversions failed:', error.message);
    return res.status(500).json({ ok: false, message: 'Unable to load conversion analytics.' });
  }
}

async function monetization(_req, res) {
  try {
    return res.json({ ok: true, ...(await getMonetizationAnalytics()) });
  } catch (error) {
    console.warn('[analytics] monetization failed:', error.message);
    return res.status(500).json({ ok: false, message: 'Unable to load monetization analytics.' });
  }
}

module.exports = {
  postEvent,
  summary,
  timeseries,
  topPages,
  tracker,
  conversions,
  monetization,
};
