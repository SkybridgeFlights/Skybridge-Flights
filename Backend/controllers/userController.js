const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');

// تحديث الملف الشخصي
exports.updateProfile = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.name = name || user.name;
  await user.save();

  res.json({
    message: 'Profile updated',
    user: { id: user._id, name: user.name, email: user.email },
  });
});

// قائمة المستخدمين (Admin)
exports.listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select('-password');
  res.json(users);
});