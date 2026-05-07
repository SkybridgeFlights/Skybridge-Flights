const express = require('express');
const router = express.Router();

const {
  register,
  login,
  me,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} = require('../controllers/authController');

const {
  getProfile,
  updateProfile,
  changePassword,
} = require('../controllers/userController');

const { protect } = require('../middleware/authMiddleware');

router.get('/test', (req, res) => {
  res.json({ ok: true, message: 'User API is working!' });
});

router.post('/register', register);
router.post('/login', login);
router.get('/verify/:token', verifyEmail);

router.get('/me', protect, me);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);

router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password/:token', resetPassword);

module.exports = router;