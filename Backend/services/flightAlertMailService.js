const sendEmail = require('../utils/sendEmail');

function apiUrl() {
  return String(
    process.env.PUBLIC_API_URL ||
    process.env.API_BASE_URL ||
    process.env.SITE_URL ||
    process.env.BASE_URL ||
    'https://skybridgeflights.com'
  ).replace(/\/$/, '');
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildAlertEmail(subscription, changes = []) {
  const ident = subscription.flightNumber || subscription.callsign || 'your flight';
  const unsubscribeUrl = `${apiUrl()}/api/flight-alerts/unsubscribe/${encodeURIComponent(subscription.unsubscribeToken)}`;
  const rows = changes.map((change) => `<li><strong>${escapeHtml(change.label)}:</strong> ${escapeHtml(change.message)}</li>`).join('');
  return {
    subject: `Flight update for ${ident} | Skybridge Flights`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
        <h2>Flight update for ${escapeHtml(ident)}</h2>
        <p>Skybridge Flight Tracker detected an update for this flight.</p>
        <ul>${rows}</ul>
        <p style="color:#475569;font-size:13px">Live aircraft and commercial schedule data can be delayed by provider refresh intervals, ADS-B coverage, and airline updates.</p>
        <p><a href="${unsubscribeUrl}">Unsubscribe from this flight alert</a></p>
      </div>
    `,
  };
}

async function sendFlightAlert(subscription, changes = []) {
  const template = buildAlertEmail(subscription, changes);
  if (!sendEmail.isEmailConfigured?.()) {
    console.warn('[flight-alerts] Email provider not configured; notification skipped');
    return { attempted: false, delivered: false, error: 'Email provider is not configured' };
  }
  const result = await sendEmail({ to: subscription.email, subject: template.subject, html: template.html });
  return {
    attempted: true,
    delivered: !!result,
    error: result ? '' : 'Email provider returned no delivery result',
  };
}

async function sendSubscriptionConfirmation(subscription) {
  const ident = subscription.flightNumber || subscription.callsign || 'your flight';
  const unsubscribeUrl = `${apiUrl()}/api/flight-alerts/unsubscribe/${encodeURIComponent(subscription.unsubscribeToken)}`;
  if (!sendEmail.isEmailConfigured?.()) return { attempted: false, delivered: false, error: 'Email provider is not configured' };
  const result = await sendEmail({
    to: subscription.email,
    subject: `Flight alerts enabled for ${ident} | Skybridge Flights`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
        <h2>Flight alerts enabled</h2>
        <p>You will receive selected updates for <strong>${escapeHtml(ident)}</strong>.</p>
        <p><a href="${unsubscribeUrl}">Unsubscribe from this flight alert</a></p>
      </div>
    `,
  });
  return { attempted: true, delivered: !!result, error: result ? '' : 'Email provider returned no delivery result' };
}

module.exports = {
  sendFlightAlert,
  sendSubscriptionConfirmation,
};
