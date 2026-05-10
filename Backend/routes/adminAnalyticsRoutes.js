const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  summary,
  timeseries,
  topPages,
  tracker,
  conversions,
  monetization,
} = require('../controllers/analyticsController');

const router = express.Router();

function canViewAnalytics(req, res, next) {
  if (req.user?.isAdmin || req.user?.permissions?.viewStats) return next();
  return res.status(403).json({ error: 'Forbidden' });
}

router.use(protect, canViewAnalytics);
router.get('/summary', summary);
router.get('/timeseries', timeseries);
router.get('/top-pages', topPages);
router.get('/tracker', tracker);
router.get('/conversions', conversions);
router.get('/monetization', monetization);

module.exports = router;
