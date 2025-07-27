// controllers/reviewController.js
const Review = require('../models/Review');

// @desc    إنشاء مراجعة جديدة
// @route   POST /api/reviews
exports.createReview = async (req, res) => {
  try {
    const { flight, rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }

    const review = await Review.create({
      user: req.user._id,
      flight,
      rating,
      comment,
    });

    return res.status(201).json({ message: 'Review created successfully.', review });
  } catch (error) {
    console.error('CreateReview Error:', error);
    return res.status(500).json({ error: 'Failed to create review', details: error.message });
  }
};

// @desc    عرض جميع المراجعات
// @route   GET /api/reviews
exports.listReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('user', 'name email')
      .populate('flight', 'from to airline')
      .sort({ createdAt: -1 });

    return res.json(reviews);
  } catch (error) {
    console.error('ListReviews Error:', error);
    return res.status(500).json({ error: 'Failed to fetch reviews', details: error.message });
  }
};

// @desc    حذف مراجعة (Admin Only)
// @route   DELETE /api/reviews/:id
exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ error: 'Review not found.' });

    return res.json({ message: 'Review deleted successfully.' });
  } catch (error) {
    console.error('DeleteReview Error:', error);
    return res.status(500).json({ error: 'Failed to delete review', details: error.message });
  }
};