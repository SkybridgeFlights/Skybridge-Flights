const express = require('express');
const router = express.Router();

const {
  createReview,
  listReviews,
  deleteReview,
  getReviewStats,
} = require('../controllers/reviewController');

const { protect } = require('../middleware/authMiddleware');

router.get('/', listReviews);
router.get('/stats', protect, getReviewStats);
router.post('/', createReview);

router.delete(
  '/:id',
  protect,
  (req, res, next) => {
    if (req.user?.isAdmin || req.user?.permissions?.manageReviews) return next();
    return res.status(403).json({ error: 'Not authorized to delete reviews.' });
  },
  deleteReview
);

module.exports = router;