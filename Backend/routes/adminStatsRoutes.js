const express = require('express');
const router = express.Router();

const { getDashboardStats } = require('../controllers/adminStatsController');
const { protect } = require('../middleware/authMiddleware');

// الأدمن يدخل مباشرة
// والستاف يدخل إذا عنده viewStats
router.get('/dashboard-stats', protect, (req, res, next) => {
  if (req.user?.isAdmin || req.user?.permissions?.viewStats) {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden' });
}, getDashboardStats);

module.exports = router;