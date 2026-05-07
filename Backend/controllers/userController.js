const User = require('../models/User');

// GET /api/users/profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json(user);
  } catch (error) {
    console.error('getProfile error:', error);
    return res.status(500).json({ message: 'Failed to load profile' });
  }
};

// PUT /api/users/profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      name,
      email,
      preferredAirport,
      preferredCabinClass,
      newsletter,
    } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: userId },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Email is already in use' });
    }

    user.name = name.trim();
    user.email = normalizedEmail;
    user.preferredAirport = preferredAirport || '';
    user.preferredCabinClass = preferredCabinClass || 'Economy';
    user.newsletter = !!newsletter;

    const updatedUser = await user.save();

    return res.json({
      message: 'Profile updated successfully',
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        isAdmin: updatedUser.isAdmin,
        isVerified: updatedUser.isVerified,
        createdAt: updatedUser.createdAt,
        preferredAirport: updatedUser.preferredAirport || '',
        preferredCabinClass: updatedUser.preferredCabinClass || 'Economy',
        newsletter: !!updatedUser.newsletter,
        permissions: updatedUser.permissions || {},
      },
    });
  } catch (error) {
    console.error('updateProfile error:', error);
    return res.status(500).json({ message: 'Failed to update profile' });
  }
};

// PUT /api/users/change-password
const changePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const currentPassword = req.body.currentPassword || req.body.oldPassword;
    const newPassword = req.body.newPassword || req.body.password;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: 'Current password and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: 'New password must be at least 6 characters',
      });
    }

    const user = await User.findById(userId).select('+password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // لا تقم بتشفيرها هنا يدويًا
    // الـ pre-save hook في User model سيتولى ذلك
    user.password = newPassword;

    await user.save();

    return res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('changePassword error:', error);
    return res.status(500).json({ message: 'Failed to update password' });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
};