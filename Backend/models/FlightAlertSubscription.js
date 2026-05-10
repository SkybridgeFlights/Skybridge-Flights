const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    type: { type: String, trim: true, default: '' },
    message: { type: String, trim: true, default: '' },
    sentAt: { type: Date, default: null },
    delivered: { type: Boolean, default: false },
    error: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const flightAlertSubscriptionSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    flightNumber: { type: String, trim: true, uppercase: true, index: true, default: '' },
    callsign: { type: String, trim: true, uppercase: true, index: true, default: '' },
    departureAirport: { type: String, trim: true, uppercase: true, default: '' },
    arrivalAirport: { type: String, trim: true, uppercase: true, default: '' },
    alertTypes: { type: [String], default: [] },
    status: { type: String, enum: ['active', 'unsubscribed', 'paused'], default: 'active', index: true },
    lastKnownFlightStatus: { type: String, trim: true, default: '' },
    lastKnownEta: { type: String, trim: true, default: '' },
    lastKnownGate: { type: String, trim: true, default: '' },
    lastKnownTerminal: { type: String, trim: true, default: '' },
    lastNotificationSentAt: { type: Date, default: null },
    lastCheckedAt: { type: Date, default: null },
    unsubscribeToken: { type: String, required: true, unique: true, index: true },
    ipAddress: { type: String, trim: true, default: '', index: true },
    notificationHistory: { type: [notificationSchema], default: [] },
    failedNotificationCount: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

flightAlertSubscriptionSchema.index(
  { email: 1, flightNumber: 1, callsign: 1, status: 1 },
  { name: 'flight_alert_duplicate_guard' }
);

module.exports = mongoose.model('FlightAlertSubscription', flightAlertSubscriptionSchema);
