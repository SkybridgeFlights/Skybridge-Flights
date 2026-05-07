const Review = require('../models/Review');

exports.createReview = async (req, res) => {
  try {
    const { flight, rating, comment, name } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    if (!comment || !String(comment).trim()) {
      return res.status(400).json({ error: 'Comment is required.' });
    }

    const review = await Review.create({
      user: req.user?._id || null,
      name: String(name).trim(),
      flight: flight || null,
      rating,
      comment: String(comment).trim(),
    });

    const populated = await Review.findById(review._id)
      .populate('user', 'name email')
      .populate('flight', 'from to airline');

    return res.status(201).json({
      message: 'Review created successfully.',
      review: populated,
    });
  } catch (error) {
    console.error('CreateReview Error:', error);
    return res.status(500).json({
      error: 'Failed to create review',
      details: error.message,
    });
  }
};

exports.listReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('user', 'name email')
      .populate('flight', 'from to airline')
      .sort({ createdAt: -1 });

    return res.json(reviews);
  } catch (error) {
    console.error('ListReviews Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch reviews',
      details: error.message,
    });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);

    if (!review) {
      return res.status(404).json({ error: 'Review not found.' });
    }

    return res.json({ message: 'Review deleted successfully.' });
  } catch (error) {
    console.error('DeleteReview Error:', error);
    return res.status(500).json({
      error: 'Failed to delete review',
      details: error.message,
    });
  }
};

exports.getReviewStats = async (_req, res) => {
  try {
    const totalReviews = await Review.countDocuments();

    const ratings = await Review.aggregate([
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
    ]);

    const ratingMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratings.forEach((item) => {
      ratingMap[item._id] = item.count;
    });

    res.json({
      totalReviews,
      ratings: ratingMap,
    });
  } catch (error) {
    console.error('getReviewStats Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch review stats',
      details: error.message,
    });
  }
};