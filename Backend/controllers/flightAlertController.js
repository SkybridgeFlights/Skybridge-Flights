const {
  ALERT_TYPES,
  createSubscription,
  unsubscribe,
  getAdminSummary,
} = require('../services/flightAlertService');

function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.connection?.remoteAddress || '';
}

async function subscribe(req, res) {
  try {
    const result = await createSubscription({
      ...req.body,
      ipAddress: getClientIp(req),
    });

    return res.status(result.duplicate ? 200 : 201).json({
      ok: true,
      duplicate: result.duplicate,
      message: result.duplicate
        ? 'You are already subscribed to alerts for this flight.'
        : 'Flight alerts are enabled for this flight.',
      alertTypes: result.subscription.alertTypes,
    });
  } catch (error) {
    console.warn('[flight-alerts] subscribe failed:', error.message);
    return res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || 'Unable to subscribe to flight alerts.',
      alertTypes: ALERT_TYPES,
    });
  }
}

async function unsubscribeByToken(req, res) {
  try {
    const subscription = await unsubscribe(req.params.token);
    if (!subscription) {
      return res.status(404).type('html').send(`
        <html><body style="font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:32px">
          <h1>Alert subscription not found</h1>
          <p>This unsubscribe link is invalid or has already been removed.</p>
        </body></html>
      `);
    }

    return res.type('html').send(`
      <html><body style="font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:32px">
        <h1>Flight alerts unsubscribed</h1>
        <p>You will no longer receive email alerts for ${subscription.flightNumber || subscription.callsign || 'this flight'}.</p>
      </body></html>
    `);
  } catch (error) {
    console.warn('[flight-alerts] unsubscribe failed:', error.message);
    return res.status(500).type('html').send(`
      <html><body style="font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:32px">
        <h1>Unable to unsubscribe</h1>
        <p>Please try again later.</p>
      </body></html>
    `);
  }
}

async function adminList(_req, res) {
  try {
    const data = await getAdminSummary();
    return res.json({ ok: true, ...data });
  } catch (error) {
    console.warn('[flight-alerts] admin summary failed:', error.message);
    return res.status(500).json({ ok: false, message: 'Unable to load flight alert analytics.' });
  }
}

module.exports = {
  subscribe,
  unsubscribeByToken,
  adminList,
};
