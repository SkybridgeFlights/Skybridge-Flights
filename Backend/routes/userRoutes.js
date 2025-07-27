// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');

// =======================
//   Mail transporter
// =======================
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT || 587),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: { rejectUnauthorized: false },
});

// =======================
//   Helper Functions
// =======================
function buildUserDTO(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
  };
}

function signToken(user) {
  return jwt.sign(
    { sub: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Middleware للتحقق من التوكن
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized - No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }
}

// =======================
//   Test Route
// =======================
router.get('/test', (req, res) => {
  res.json({ ok: true, message: 'User API is working!' });
});

// =======================
//   Register
// =======================
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'User already exists' });

    // كلمة المرور سيتم تشفيرها تلقائيًا في الـ pre('save') في model/User.js
    const user = new User({
      name,
      email,
      password,  // لا نقوم بعمل hash هنا
      isVerified: false,
    });
    await user.save();

    // إنشاء توكن التفعيل
    const verifyToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    const verificationUrl = `${process.env.BASE_URL}/verify/${verifyToken}`;

    await transporter.sendMail({
      from: `"Skybridge Flights" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Verify your email',
      html: `
        <p>Hello ${user.name},</p>
        <p>Click the link below to verify your email:</p>
        <a href="${verificationUrl}">${verificationUrl}</a>
      `,
    });

    return res.status(201).json({
      message: 'Registered successfully. Please verify your email.',
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

// =======================
//   Email Verify
// =======================
router.get('/verify/:token', async (req, res) => {
  try {
    const decoded = jwt.verify(req.params.token, process.env.JWT_SECRET);
    await User.findByIdAndUpdate(decoded.userId, { isVerified: true });
    return res.json({
      success: true,
      message: 'Email verified successfully. You can now log in.',
    });
  } catch (error) {
    console.error('Verify error:', error);
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired verification token.',
    });
  }
});

// =======================
//   Login
// =======================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    if (!user.isVerified) {
      return res.status(403).json({ error: 'Please verify your email before logging in.' });
    }

    const token = signToken(user);
    const userDTO = buildUserDTO(user);

    return res.json({
      message: 'Login successful',
      token,
      user: userDTO,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

// =======================
//   Protected Route: Profile
// =======================
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.sub).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(buildUserDTO(user));
  } catch (error) {
    console.error('Profile error:', error);
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// =======================
//   Forgot Password
// =======================
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 دقائق
    await user.save();

    const resetUrl = `${process.env.BASE_URL}/reset-password/${resetToken}`;

    await transporter.sendMail({
      from: `"Skybridge Flights" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <p>Hello ${user.name},</p>
        <p>Click the link below to reset your password (valid for 10 minutes):</p>
        <a href="${resetUrl}">${resetUrl}</a>
      `,
    });

    return res.json({ message: 'Password reset link sent to your email.' });
  } catch (error) {
    console.error('ForgotPassword error:', error);
    return res.status(500).json({ error: 'Failed to send reset link', details: error.message });
  }
});

// =======================
//   Reset Password
// =======================
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body || {};
    if (!newPassword) return res.status(400).json({ error: 'New password is required' });

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() },
    });
    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

    user.password = newPassword; // سيتم تشفيره في pre('save')
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    return res.json({ message: 'Password reset successful.' });
  } catch (error) {
    console.error('ResetPassword error:', error);
    return res.status(500).json({ error: 'Failed to reset password', details: error.message });
  }
});

module.exports = router;