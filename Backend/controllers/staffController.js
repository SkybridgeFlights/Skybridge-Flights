const bcrypt = require('bcryptjs');
const Staff = require('../models/Staff');

function assertAdmin(req) {
  if (!req.user || (!req.user.isAdmin && req.user.role !== 'Admin')) {
    const err = new Error('Admin only');
    err.status = 403;
    throw err;
  }
}

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

/** GET /api/staff */
exports.listStaff = async (req, res) => {
  try {
    assertAdmin(req);

    const rows = await Staff.find().sort({ createdAt: -1 });
    const out = rows.map((s) => {
      const o = s.toPublic();
      o.permissions = normalizePerms(o.permissions);
      return o;
    });

    res.json(out);
  } catch (e) {
    console.error('listStaff error:', e);
    res.status(e.status || 500).json({ error: e.message || 'Failed to load staff' });
  }
};

/** POST /api/staff */
exports.createStaff = async (req, res) => {
  try {
    assertAdmin(req);

    const { name, email, password, role, permissions, enabled } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }

    const exists = await Staff.findOne({ email: email.toLowerCase().trim() });
    if (exists) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const staff = await Staff.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: role || 'Support',
      permissions: normalizePerms(permissions),
      enabled: typeof enabled === 'boolean' ? enabled : true,
    });

    const out = staff.toPublic();
    out.permissions = normalizePerms(out.permissions);

    res.status(201).json(out);
  } catch (e) {
    console.error('createStaff error:', e);
    res.status(500).json({ error: 'Failed to create staff member' });
  }
};

/** PATCH /api/staff/:id */
exports.updateStaff = async (req, res) => {
  try {
    assertAdmin(req);

    const { id } = req.params;
    const { role, permissions, enabled, password, name } = req.body;

    const staff = await Staff.findById(id);
    if (!staff) {
      return res.status(404).json({ error: 'Staff not found' });
    }

    if (name) staff.name = name;
    if (role) staff.role = role;
    if (typeof enabled === 'boolean') staff.enabled = enabled;

    if (permissions && typeof permissions === 'object') {
      staff.permissions = normalizePerms({
        ...staff.permissions,
        ...permissions,
      });
    }

    if (password) {
      staff.passwordHash = await bcrypt.hash(String(password), 10);
    }

    await staff.save();

    const out = staff.toPublic();
    out.permissions = normalizePerms(out.permissions);

    res.json(out);
  } catch (e) {
    console.error('updateStaff error:', e);
    res.status(500).json({ error: 'Failed to update staff' });
  }
};

/** DELETE /api/staff/:id */
exports.deleteStaff = async (req, res) => {
  try {
    assertAdmin(req);

    const { id } = req.params;
    const deleted = await Staff.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Staff not found' });
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('deleteStaff error:', e);
    res.status(500).json({ error: 'Failed to delete staff' });
  }
};