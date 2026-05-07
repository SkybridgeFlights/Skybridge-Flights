const mongoose = require('mongoose');

const PassengerSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    passportNumber: { type: String, trim: true, default: '' },
    dateOfBirth: { type: String, trim: true, default: '' },
    gender: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const AddressSchema = new mongoose.Schema(
  {
    country: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    street: { type: String, trim: true, default: '' },
    zip: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const ContactSchema = new mongoose.Schema(
  {
    email: { type: String, trim: true, default: '' },
    address: { type: AddressSchema, default: () => ({}) },
    phone: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const PetDetailsSchema = new mongoose.Schema(
  {
    type: { type: String, trim: true, default: '' },
    weight: { type: Number, default: 0 },
    crate: { type: String, trim: true, default: '' },
    price: { type: Number, default: 0 },
    notes: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const PolicySnapshotSchema = new mongoose.Schema(
  {
    cancellationPolicy: { type: String, default: '' },
    refundPolicy: { type: String, default: '' },
    modificationPolicy: { type: String, default: '' },
    baggagePolicy: { type: String, default: '' },
  },
  { _id: false }
);

const BookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    flight: { type: mongoose.Schema.Types.ObjectId, ref: 'Flight', required: true },
    passengers: { type: [PassengerSchema], required: true, default: [] },
    seatNumber: { type: String, trim: true, default: null },
    extraWeight: { type: Number, default: 0 },
    totalPrice: { type: Number, default: 0 },
    petDetails: { type: PetDetailsSchema, default: null },
    contact: { type: ContactSchema, default: () => ({}) },

    returnFlight: { type: mongoose.Schema.Types.ObjectId, ref: 'Flight', default: null },
    passengersReturn: { type: [PassengerSchema], default: [] },
    seatNumberReturn: { type: String, trim: true, default: null },
    extraWeightReturn: { type: Number, default: 0 },
    totalPriceReturn: { type: Number, default: 0 },
    petDetailsReturn: { type: PetDetailsSchema, default: null },
    contactReturn: { type: ContactSchema, default: () => ({}) },

    paymentMethod: {
      type: String,
      enum: [
        'stripe',
        'paypal',
        'visa',
        'mastercard',
        'wallet',
        'bank',
        'remittance',
        'applepay',
        'online',
      ],
      required: false,
      default: undefined,
    },

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled'],
      default: 'pending',
      index: true,
    },

    policySnapshot: { type: PolicySnapshotSchema, default: () => ({}) },

    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

BookingSchema.index({ user: 1, createdAt: -1 });
BookingSchema.index(
  { flight: 1, seatNumber: 1 },
  { partialFilterExpression: { seatNumber: { $type: 'string' } } }
);
BookingSchema.index(
  { returnFlight: 1, seatNumberReturn: 1 },
  { partialFilterExpression: { seatNumberReturn: { $type: 'string' } } }
);

module.exports = mongoose.model('Booking', BookingSchema);