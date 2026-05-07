const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Staff = require('../models/Staff');

function signStaffToken(staff) {
  const payload = {
    typ: 'staff',
    sid: staff._id.toString(),
    role: staff.role,
    isAdmin: staff.role === 'Admin',
    perms: staff.permissions,
  };

  return jwt.sign(payload, process.env.JWT_SECRET || 'dev_secret', {
    expiresIn: '7d',
  });
}

const staffLogin = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const staff = await Staff.findOne({
      email: String(email).toLowerCase().trim(),
    });

    if (!staff) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!staff.enabled) {
      return res.status(403).json({ error: 'Staff account is disabled' });
    }

    const ok = await bcrypt.compare(String(password), staff.passwordHash || '');
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signStaffToken(staff);

    return res.json({
      token,
      staff: {
        id: staff._id.toString(),
        name: staff.name,
        email: staff.email,
        role: staff.role,
        isAdmin: staff.role === 'Admin',
        permissions: staff.permissions || {},
        enabled: staff.enabled,
      },
    });
  } catch (e) {
    console.error('staffLogin error:', e);
    return res.status(500).json({ error: 'Failed to login' });
  }
};

module.exports = { staffLogin };