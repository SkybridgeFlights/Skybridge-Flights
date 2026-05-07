const mongoose = require('mongoose');

const customTermSchema = new mongoose.Schema(
  {
    title: { type: String, default: '' },
    text: { type: String, default: '' },
  },
  { _id: false }
);

const bookingSettingsSchema = new mongoose.Schema(
  {
    allowCancellation: { type: Boolean, default: true },
    cancellationHoursLimit: { type: Number, default: 24 },
    cancellationPolicy: { type: String, default: '' },

    allowRefunds: { type: Boolean, default: false },
    refundHoursLimit: { type: Number, default: 72 },
    refundPolicy: { type: String, default: '' },

    allowModification: { type: Boolean, default: false },
    modificationHoursLimit: { type: Number, default: 48 },
    modificationPolicy: { type: String, default: '' },

    bookingTerms: { type: String, default: '' },
    baggagePolicy: { type: String, default: '' },

    autoEmailNotification: { type: Boolean, default: false },
    autoEmailMessage: { type: String, default: '' },

    customTerms: { type: [customTermSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  'BookingSettings',
  bookingSettingsSchema,
  'bookingsettings'
);