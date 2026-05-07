// middleware/staffAuthMiddleware.js
const jwt = require('jsonwebtoken');
const Staff = require('../models/Staff');

// يستخرج التوكن من Authorization: Bearer xxx
function getBearer(req) {
  const h = req.headers.authorization || req.headers.Authorization;
  if (!h) return null;
  const [typ, tok] = String(h).split(' ');
  return typ?.toLowerCase() === 'bearer' ? tok : null;
}

// يحمي مسارات موظفين
exports.staffProtect = async (req, res, next) => {
  try {
    const token = getBearer(req);
    if (!token) return res.status(401).json({ error: 'Not authorized' });

    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    if (payload?.typ !== 'staff') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    const staff = await Staff.findById(payload.sid);
    if (!staff || !staff.enabled) {
      return res.status(401).json({ error: 'Staff not found or disabled' });
    }

    // نخزن في req.staff ونضع راحة متوافقة مع كودك السابق
    req.staff = staff;
    req.user = {           // لكي تعمل دوالك التي تعتمد على req.user.isAdmin
      _id: staff._id,
      isAdmin: staff.role === 'Admin',
      role: staff.role,
      permissions: staff.permissions,
      email: staff.email,
      name: staff.name,
      typ: 'staff',
    };

    next();
  } catch (e) {
    console.error('staffProtect error:', e);
    res.status(401).json({ error: 'Not authorized' });
  }
};

exports.staffAdminOnly = (req, res, next) => {
  if (!req.user?.isAdmin && req.user?.role !== 'Admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
};