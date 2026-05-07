// Backend/models/SupportTicket.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const fileSchema = new Schema({
  _id: { type: Schema.Types.ObjectId, required: true },
  key: { type: String, required: true },         // R2 object key
  originalName: { type: String, default: '' },
  mimetype: { type: String, default: 'application/octet-stream' },
  size: { type: Number, default: 0 }
}, { _id: false });

const messageSchema = new Schema({
  _id: { type: Schema.Types.ObjectId, required: true },
  byKind: { type: String, enum: ['user','staff'], required: true },
  byUser: { type: Schema.Types.ObjectId, ref: 'User' },
  byStaff: { type: Schema.Types.ObjectId, ref: 'Staff' },
  byName: { type: String, default: '' },
  text: { type: String, default: '' },
  files: { type: [fileSchema], default: [] },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const ticketSchema = new Schema({
  subject: { type: String, required: true },
  status: { type: String, enum: ['open','pending','closed'], default: 'open' },
  customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'Staff' },
  messages: { type: [messageSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('SupportTicket', ticketSchema);