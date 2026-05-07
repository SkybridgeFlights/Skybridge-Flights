const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Staff = require('../models/Staff');

function normalizePerms(p = {}) {
  return {
    viewStats: !!p.viewStats,
    manageProviders: !!p.manageProviders,
    viewUsers: !!p.viewUsers,
    manageStaff: !!p.manageStaff,
    manageBlog: !!p.manageBlog,
    publishBlog: !!p.publishBlog,
    manageReviews: !!p.manageReviews,
    manageSupport: !!p.manageSupport,
  };
}

/** مصدر التوكن:
 *  - Authorization: Bearer <token>
 *  - x-access-token
 *  - query ?token=
 */
function extractToken(req) {
  const h = req.headers.authorization || req.headers.Authorization;
  if (h && typeof h === 'string') {
    const [typ, tok] = h.split(' ');
    if (typ && typ.toLowerCase() === 'bearer' && tok) return tok.trim();
  }

  if (req.headers['x-access-token']) {
    return String(req.headers['x-access-token']).trim();
  }

  if (req.query && req.query.token && req.method === 'GET') {
    const p = req.path || '';
    if (p.includes('/download') || p.includes('/receipt')) {
      return String(req.query.token).trim();
    }
  }

  return null;
}

exports.protect = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Not authorized, no token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');

    // Staff
    if (decoded?.typ === 'staff') {
      const staffId = decoded.sid || decoded.id || decoded.sub;
      const staff = await Staff.findById(staffId);

      if (!staff || !staff.enabled) {
        return res.status(401).json({ error: 'Staff not found or disabled.' });
      }

      req.user = {
        _id: staff._id,
        kind: 'staff',
        isAdmin: String(staff.role || '').toLowerCase() === 'admin',
        role: staff.role,
        permissions: normalizePerms(staff.permissions),
        email: staff.email,
        name: staff.name,
      };

      return next();
    }

    // User
    const userId = decoded.sub || decoded.id || decoded.userId;
    const user = await User.findById(userId).select('-password');

    if (!user) {
      const staff = await Staff.findById(userId);
      if (!staff) {
        return res.status(401).json({ error: 'User not found.' });
      }

      req.user = {
        _id: staff._id,
        kind: 'staff',
        isAdmin: String(staff.role || '').toLowerCase() === 'admin',
        role: staff.role,
        permissions: normalizePerms(staff.permissions),
        email: staff.email,
        name: staff.name,
      };

      return next();
    }

    const isAdminComputed =
      !!user.isAdmin || String(user.role || '').toLowerCase() === 'admin';

    req.user = {
      _id: user._id,
      kind: 'user',
      isAdmin: isAdminComputed,
      role: isAdminComputed ? 'Admin' : 'User',
      permissions: {},
      email: user.email,
      name: user.name,
    };

    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    return res.status(401).json({ error: 'Not authorized, token failed.' });
  }
};

exports.adminOnly = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Admins only. Access denied.' });
  }
  next();
};

exports.requirePerm = (perm) => (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authorized' });
    }

    if (req.user.isAdmin) {
      return next();
    }

    const p = req.user.permissions || {};
    if (p[perm]) {
      return next();
    }

    return res.status(403).json({ error: 'Forbidden' });
  } catch (e) {
    console.error('requirePerm error:', e);
    return res.status(403).json({ error: 'Forbidden' });
  }
};