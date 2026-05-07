const express = require('express');
const router = express.Router();

const {
  listStaff,
  createStaff,
  updateStaff,
  deleteStaff,
} = require('../controllers/staffController');

const { staffLogin } = require('../controllers/staffAuthController');
const { protect } = require('../middleware/authMiddleware');

router.post('/login', staffLogin);

router.get(
  '/',
  protect,
  (req, res, next) => {
    if (req.user?.isAdmin) return next();
    return res.status(403).json({ error: 'Admin only' });
  },
  listStaff
);

router.post(
  '/',
  protect,
  (req, res, next) => {
    if (req.user?.isAdmin) return next();
    return res.status(403).json({ error: 'Admin only' });
  },
  createStaff
);

router.patch(
  '/:id',
  protect,
  (req, res, next) => {
    if (req.user?.isAdmin) return next();
    return res.status(403).json({ error: 'Admin only' });
  },
  updateStaff
);

router.delete(
  '/:id',
  protect,
  (req, res, next) => {
    if (req.user?.isAdmin) return next();
    return res.status(403).json({ error: 'Admin only' });
  },
  deleteStaff
);

module.exports = router;