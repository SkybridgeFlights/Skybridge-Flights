// backend/models/ReviewModel.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  name: { type: String, required: true },
  comment: { type: String, required: true },
  rating: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);