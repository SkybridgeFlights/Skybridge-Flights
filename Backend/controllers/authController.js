const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const sendEmail = require('../utils/sendEmail');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

const safeSendEmail = async ({ to, subject, html }) => {
  try {
    await Promise.race([
      sendEmail({ to, subject, html }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Email sending timeout')), 8000)
      ),
    ]);
    return { ok: true };
  } catch (error) {
    console.error('Email sending failed:', error.message);
    return { ok: false, error };
  }
};

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const exists = await User.findOne({ email: normalizedEmail });
  if (exists) {
    return res.status(400).json({ error: 'Email already used' });
  }

  const verificationToken = crypto.randomBytes(32).toString('hex');

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password,
    isVerified: false,
    verificationToken,
    verificationTokenExpires: Date.now() + 24 * 60 * 60 * 1000,
  });

  const verifyLink = `${process.env.BASE_URL}/verify/${verificationToken}`;

  const emailResult = await safeSendEmail({
    to: user.email,
    subject: 'Verify your Skybridge Flights account',
    html: `
      <p>Hello ${user.name},</p>
      <p>Please verify your email by clicking the link below:</p>
      <p><a href="${verifyLink}">${verifyLink}</a></p>
      <p>This link expires in 24 hours.</p>
    `,
  });

  if (!emailResult.ok) {
    console.log('VERIFY LINK (fallback):', verifyLink);
    return res.status(201).json({
      message:
        'Registration successful, but email sending failed. Please contact support or check server logs for the verification link.',
      verifyLink,
    });
  }

  res.status(201).json({
    message: 'Registration successful. Please check your email to verify your account.',
  });
});

exports.verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const user = await User.findOne({
    verificationToken: token,
    verificationTokenExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired verification link',
    });
  }

  user.isVerified = true;
  user.verificationToken = '';
  user.verificationTokenExpires = null;
  await user.save();

  res.json({
    success: true,
    message: 'Email verified successfully',
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await User.findOne({
    email: email.toLowerCase().trim(),
  }).select('+password');

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const match = await user.comparePassword(password);
  if (!match) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (!user.isVerified) {
    return res.status(403).json({ error: 'Please verify your email first' });
  }

  const token = signToken(user._id);

  res.json({
    token,
    user: {
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      isVerified: user.isVerified,
      role: user.role || 'user',
      permissions: user.permissions || {},
      createdAt: user.createdAt,
      preferredAirport: user.preferredAirport || '',
      preferredCabinClass: user.preferredCabinClass || 'Economy',
      newsletter: !!user.newsletter,
    },
  });
});

exports.me = asyncHandler(async (req, res) => {
  res.json(req.user);
});

exports.requestPasswordReset = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = resetToken;
  user.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
  await user.save();

  const link = `${process.env.BASE_URL}/reset-password/${resetToken}`;

  const emailResult = await safeSendEmail({
    to: user.email,
    subject: 'Password Reset',
    html: `
      <p>Hello ${user.name},</p>
      <p>Click the link below to reset your password:</p>
      <p><a href="${link}">${link}</a></p>
      <p>This link expires in 1 hour.</p>
    `,
  });

  if (!emailResult.ok) {
    console.log('RESET LINK (fallback):', link);
    return res.json({
      message:
        'Reset link generated, but email sending failed. Please contact support or check server logs for the reset link.',
      resetLink: link,
    });
  }

  res.json({ message: 'Password reset link sent to your email' });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const password = req.body.password || req.body.newPassword;

  if (!password) {
    return res.status(400).json({ error: 'New password is required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() },
  }).select('+password');

  if (!user) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }

  user.password = password;
  user.resetPasswordToken = '';
  user.resetPasswordExpires = null;
  await user.save();

  res.json({ message: 'Password reset successfully' });
});