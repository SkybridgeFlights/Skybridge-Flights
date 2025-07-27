// middleware/authMiddleware.js
const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// التحقق من تسجيل الدخول
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Header: Authorization: Bearer xxx
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authorized, no token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // نغطي حالتي sub و id (حسب كيفية إنشاء الـ token)
    const userId = decoded.sub || decoded.id;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }

    // ✅ خزّن المستخدم في req.user
    req.user = user;

    // للتأكد في السجلات
    console.log('✅ Authenticated User:', user._id.toString(), user.email);

    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    return res.status(401).json({ error: 'Not authorized, token failed.' });
  }
};

// التحقق من صلاحيات الـ Admin
exports.adminOnly = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Admins only. Access denied.' });
  }
  next();
};