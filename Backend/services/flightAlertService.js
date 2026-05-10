const crypto = require('crypto');

const FlightAlertSubscription = require('../models/FlightAlertSubscription');
const { lookupCommercialFlight } = require('./flightTrackerCommercialService');
const {
  sendFlightAlert,
  sendSubscriptionConfirmation,
} = require('./flightAlertMailService');

const ALERT_TYPES = Object.freeze([
  'status_changed',
  'delay_detected',
  'eta_changed',
  'departure_detected',
  'arrival_detected',
  'gate_terminal_changed',
  'departure_reminder',
]);

const ALERT_LABELS = Object.freeze({
  status_changed: 'Flight status changed',
  delay_detected: 'Delay detected',
  eta_changed: 'ETA changed',
  departure_detected: 'Departure detected',
  arrival_detected: 'Arrival detected',
  gate_terminal_changed: 'Gate or terminal changed',
  departure_reminder: 'Departure reminder',
});

const MAX_ACTIVE_PER_EMAIL = Number(process.env.FLIGHT_ALERT_MAX_PER_EMAIL || 12);
const MAX_SUBSCRIBE_PER_IP_WINDOW = Number(process.env.FLIGHT_ALERT_MAX_PER_IP_WINDOW || 25);
const SUBSCRIBE_WINDOW_MS = Number(process.env.FLIGHT_ALERT_SUBSCRIBE_WINDOW_MS || 60 * 60 * 1000);
const CHECK_COOLDOWN_MS = Number(process.env.FLIGHT_ALERT_CHECK_COOLDOWN_MS || 5 * 60 * 1000);
const NOTIFICATION_COOLDOWN_MS = Number(process.env.FLIGHT_ALERT_NOTIFY_COOLDOWN_MS || 20 * 60 * 1000);

const ipSubscribeWindow = new Map();
const commercialCheckCache = new Map();
const inFlightChecks = new Map();

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizeIdentifier(value = '') {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function normalizeAirport(value = '') {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
}

function normalizeAlertTypes(values = []) {
  const requested = Array.isArray(values) ? values : [];
  const valid = requested.filter((type) => ALERT_TYPES.includes(type));
  return valid.length ? [...new Set(valid)] : ['status_changed', 'delay_detected', 'eta_changed', 'arrival_detected'];
}

function assertSubscribeBudget(email, ip) {
  const now = Date.now();
  const key = ip || 'unknown';
  const window = ipSubscribeWindow.get(key) || [];
  const recent = window.filter((ts) => now - ts < SUBSCRIBE_WINDOW_MS);
  if (recent.length >= MAX_SUBSCRIBE_PER_IP_WINDOW) {
    const err = new Error('Too many alert subscriptions from this network. Please try again later.');
    err.statusCode = 429;
    throw err;
  }
  recent.push(now);
  ipSubscribeWindow.set(key, recent);
  if (!email.includes('@')) {
    const err = new Error('A valid email address is required.');
    err.statusCode = 400;
    throw err;
  }
}

function getFlightKey(subscription) {
  return normalizeIdentifier(subscription.flightNumber || subscription.callsign || '');
}

function getCommercialFields(commercial = {}) {
  const status = normalizeIdentifier(commercial.status || '');
  const eta = commercial.estimatedArrival || commercial.actualArrival || '';
  const etaDate = eta ? new Date(eta) : null;
  const gate = commercial.gate || commercial.departureAirport?.gate || commercial.arrivalAirport?.gate || '';
  const terminal = commercial.terminal || commercial.departureAirport?.terminal || commercial.arrivalAirport?.terminal || '';
  return {
    status,
    eta: etaDate && !Number.isNaN(etaDate.getTime()) ? etaDate.toISOString() : '',
    gate: String(gate || '').trim(),
    terminal: String(terminal || '').trim(),
    delayMinutes: Number.isFinite(Number(commercial.delayMinutes)) ? Number(commercial.delayMinutes) : 0,
    scheduledDeparture: commercial.scheduledDeparture || '',
    actualDeparture: commercial.actualDeparture || '',
    actualArrival: commercial.actualArrival || '',
  };
}

function minutesUntil(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.round((date.getTime() - Date.now()) / 60000);
}

function hasRecentHistory(subscription, type, withinMs) {
  const cutoff = Date.now() - withinMs;
  return (subscription.notificationHistory || []).some((entry) => (
    String(entry.type || '').split(',').includes(type) &&
    entry.sentAt &&
    new Date(entry.sentAt).getTime() >= cutoff
  ));
}

function buildChanges(subscription, commercial = {}) {
  const next = getCommercialFields(commercial);
  const changes = [];

  if (subscription.lastKnownFlightStatus && next.status && subscription.lastKnownFlightStatus !== next.status) {
    changes.push({
      type: 'status_changed',
      label: ALERT_LABELS.status_changed,
      message: `Status is now ${next.status}.`,
    });
  }

  if (next.delayMinutes > 0 && !hasRecentHistory(subscription, 'delay_detected', 6 * 60 * 60 * 1000)) {
    changes.push({
      type: 'delay_detected',
      label: ALERT_LABELS.delay_detected,
      message: `Current delay is ${Math.round(next.delayMinutes)} minutes.`,
    });
  }

  if (subscription.lastKnownEta && next.eta && subscription.lastKnownEta !== next.eta) {
    changes.push({
      type: 'eta_changed',
      label: ALERT_LABELS.eta_changed,
      message: `Estimated arrival changed to ${new Date(next.eta).toLocaleString('en-US')}.`,
    });
  }

  if (
    (next.actualDeparture || ['ACTIVE', 'ENROUTE', 'DEPARTED'].includes(next.status)) &&
    !hasRecentHistory(subscription, 'departure_detected', 12 * 60 * 60 * 1000)
  ) {
    changes.push({
      type: 'departure_detected',
      label: ALERT_LABELS.departure_detected,
      message: 'The flight appears to have departed.',
    });
  }

  if (
    (next.actualArrival || ['LANDED', 'ARRIVED'].includes(next.status)) &&
    !hasRecentHistory(subscription, 'arrival_detected', 12 * 60 * 60 * 1000)
  ) {
    changes.push({
      type: 'arrival_detected',
      label: ALERT_LABELS.arrival_detected,
      message: 'The flight appears to have arrived.',
    });
  }

  if (
    ((subscription.lastKnownGate && next.gate && subscription.lastKnownGate !== next.gate) ||
      (subscription.lastKnownTerminal && next.terminal && subscription.lastKnownTerminal !== next.terminal))
  ) {
    changes.push({
      type: 'gate_terminal_changed',
      label: ALERT_LABELS.gate_terminal_changed,
      message: `Gate ${next.gate || 'unknown'}, terminal ${next.terminal || 'unknown'}.`,
    });
  }

  const departureIn = minutesUntil(next.scheduledDeparture);
  if (
    departureIn !== null &&
    departureIn >= 30 &&
    departureIn <= 90 &&
    !hasRecentHistory(subscription, 'departure_reminder', 24 * 60 * 60 * 1000)
  ) {
    changes.push({
      type: 'departure_reminder',
      label: ALERT_LABELS.departure_reminder,
      message: `Scheduled departure is in about ${departureIn} minutes.`,
    });
  }

  return { next, changes };
}

async function lookupCommercialWithBudget(subscription) {
  const key = getFlightKey(subscription);
  if (!key) return null;

  const cacheEntry = commercialCheckCache.get(key);
  if (cacheEntry && Date.now() - cacheEntry.fetchedAt < CHECK_COOLDOWN_MS) {
    console.log(`[flight-alerts] commercial cache hit ${key}`);
    return cacheEntry.data;
  }

  if (inFlightChecks.has(key)) {
    console.log(`[flight-alerts] commercial in-flight dedupe ${key}`);
    return inFlightChecks.get(key);
  }

  const promise = lookupCommercialFlight(key, {
    airportCode: subscription.departureAirport || subscription.arrivalAirport || '',
    liveAircraft: { callsign: subscription.callsign, flightNumber: subscription.flightNumber },
  })
    .then((data) => {
      commercialCheckCache.set(key, { data, fetchedAt: Date.now() });
      return data;
    })
    .catch((error) => {
      if (cacheEntry) {
        console.warn(`[flight-alerts] commercial lookup failed for ${key}; using stale cache: ${error.message}`);
        return cacheEntry.data;
      }
      throw error;
    })
    .finally(() => inFlightChecks.delete(key));

  inFlightChecks.set(key, promise);
  return promise;
}

async function createSubscription(payload = {}) {
  const email = normalizeEmail(payload.email);
  const flightNumber = normalizeIdentifier(payload.flightNumber);
  const callsign = normalizeIdentifier(payload.callsign);
  const ipAddress = String(payload.ipAddress || '').trim();

  assertSubscribeBudget(email, ipAddress);

  if (!flightNumber && !callsign) {
    const err = new Error('A flight number or callsign is required.');
    err.statusCode = 400;
    throw err;
  }

  const activeCount = await FlightAlertSubscription.countDocuments({ email, status: 'active' });
  if (activeCount >= MAX_ACTIVE_PER_EMAIL) {
    const err = new Error('This email has reached the active flight alert limit.');
    err.statusCode = 429;
    throw err;
  }

  const duplicate = await FlightAlertSubscription.findOne({
    email,
    status: 'active',
    $or: [
      ...(flightNumber ? [{ flightNumber }] : []),
      ...(callsign ? [{ callsign }] : []),
    ],
  });

  if (duplicate) {
    return { subscription: duplicate, duplicate: true };
  }

  const subscription = await FlightAlertSubscription.create({
    email,
    flightNumber,
    callsign,
    departureAirport: normalizeAirport(payload.departureAirport),
    arrivalAirport: normalizeAirport(payload.arrivalAirport),
    alertTypes: normalizeAlertTypes(payload.alertTypes),
    lastKnownFlightStatus: normalizeIdentifier(payload.lastKnownFlightStatus),
    lastKnownEta: payload.lastKnownEta || '',
    unsubscribeToken: crypto.randomBytes(24).toString('hex'),
    ipAddress,
  });

  const mailResult = await sendSubscriptionConfirmation(subscription);
  if (mailResult.attempted) {
    subscription.notificationHistory.unshift({
      type: 'subscription_confirmation',
      message: mailResult.delivered ? 'Confirmation email sent.' : mailResult.error,
      sentAt: new Date(),
      delivered: mailResult.delivered,
      error: mailResult.error || '',
    });
    if (!mailResult.delivered) subscription.failedNotificationCount += 1;
    await subscription.save();
  }

  return { subscription, duplicate: false };
}

async function unsubscribe(token) {
  const subscription = await FlightAlertSubscription.findOne({ unsubscribeToken: token });
  if (!subscription) return null;
  subscription.status = 'unsubscribed';
  await subscription.save();
  return subscription;
}

async function checkSubscription(subscription) {
  const commercial = await lookupCommercialWithBudget(subscription);
  const { next, changes } = buildChanges(subscription, commercial || {});
  const enabled = new Set(subscription.alertTypes || []);
  const notifyChanges = changes.filter((change) => enabled.has(change.type));
  const canNotify =
    notifyChanges.length > 0 &&
    (!subscription.lastNotificationSentAt ||
      Date.now() - new Date(subscription.lastNotificationSentAt).getTime() >= NOTIFICATION_COOLDOWN_MS);

  subscription.lastCheckedAt = new Date();
  if (next.status) subscription.lastKnownFlightStatus = next.status;
  if (next.eta) subscription.lastKnownEta = next.eta;
  if (next.gate) subscription.lastKnownGate = next.gate;
  if (next.terminal) subscription.lastKnownTerminal = next.terminal;

  if (canNotify) {
    const mailResult = await sendFlightAlert(subscription, notifyChanges);
    subscription.lastNotificationSentAt = new Date();
    subscription.notificationHistory.unshift({
      type: notifyChanges.map((change) => change.type).join(','),
      message: notifyChanges.map((change) => change.message).join(' '),
      sentAt: new Date(),
      delivered: mailResult.delivered,
      error: mailResult.error || '',
    });
    if (!mailResult.delivered) subscription.failedNotificationCount += 1;
    subscription.notificationHistory = subscription.notificationHistory.slice(0, 20);
  }

  await subscription.save();
  return { checked: true, notified: canNotify, changes: notifyChanges.length };
}

async function checkActiveSubscriptions({ limit = 50 } = {}) {
  const cutoff = new Date(Date.now() - CHECK_COOLDOWN_MS);
  const subscriptions = await FlightAlertSubscription.find({
    status: 'active',
    $or: [{ lastCheckedAt: null }, { lastCheckedAt: { $lte: cutoff } }],
  })
    .sort({ lastCheckedAt: 1, createdAt: 1 })
    .limit(limit);

  const summary = { checked: 0, notified: 0, failed: 0 };
  for (const subscription of subscriptions) {
    try {
      const result = await checkSubscription(subscription);
      summary.checked += result.checked ? 1 : 0;
      summary.notified += result.notified ? 1 : 0;
    } catch (error) {
      summary.failed += 1;
      console.warn(`[flight-alerts] subscription check failed ${subscription._id}: ${error.message}`);
      await FlightAlertSubscription.updateOne(
        { _id: subscription._id },
        { $set: { lastCheckedAt: new Date() }, $inc: { failedNotificationCount: 1 } }
      );
    }
  }
  return summary;
}

async function getAdminSummary() {
  const [totalSubscribers, activeAlerts, failedAgg, recentSubscriptions] = await Promise.all([
    FlightAlertSubscription.distinct('email', {}).then((emails) => emails.length),
    FlightAlertSubscription.countDocuments({ status: 'active' }),
    FlightAlertSubscription.aggregate([
      { $group: { _id: null, failed: { $sum: '$failedNotificationCount' } } },
    ]),
    FlightAlertSubscription.find({})
      .sort({ updatedAt: -1 })
      .limit(20)
      .select('email flightNumber callsign status lastNotificationSentAt notificationHistory createdAt updatedAt')
      .lean(),
  ]);

  const recentNotifications = recentSubscriptions
    .flatMap((subscription) => (subscription.notificationHistory || []).map((entry) => ({
      email: subscription.email,
      flightNumber: subscription.flightNumber,
      callsign: subscription.callsign,
      type: entry.type,
      message: entry.message,
      delivered: entry.delivered,
      sentAt: entry.sentAt,
      error: entry.error,
    })))
    .sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0))
    .slice(0, 10);

  return {
    totalSubscribers,
    activeAlerts,
    failedNotifications: failedAgg[0]?.failed || 0,
    recentNotifications,
    recentSubscriptions: recentSubscriptions.map((subscription) => ({
      email: subscription.email,
      flightNumber: subscription.flightNumber,
      callsign: subscription.callsign,
      status: subscription.status,
      lastNotificationSentAt: subscription.lastNotificationSentAt,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    })),
  };
}

module.exports = {
  ALERT_TYPES,
  ALERT_LABELS,
  createSubscription,
  unsubscribe,
  checkActiveSubscriptions,
  getAdminSummary,
  __test: {
    normalizeAlertTypes,
    buildChanges,
  },
};
