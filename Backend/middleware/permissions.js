// backend/middleware/permissions.js
/**
 * Enterprise-ready permissions middleware
 *
 * - requirePerm('manageBookings.view')
 * - requireAny(['manageRefunds.view', 'manageRefunds.edit'])
 * - isAdmin bypasses all
 *
 * يضبطه staffAuthMiddleware بحيث يضع req.user = { isAdmin, role, permissions:{...}, ... }
 */

function hasPerm(user, perm) {
  if (!user) return false;
  if (user.isAdmin) return true;
  const p = user.permissions || {};
  // perm قد تكون بشكل "domain.action" مثل manageRefunds.edit
  if (!perm || typeof perm !== 'string') return false;

  // دعم مستويات: domain.view / domain.edit
  const [domain, action] = perm.split('.');
  if (!domain || !action) return false;

  // خرائط للدعم للخلفية: بعض المشاريع تخزنها كبولينات بسيطة
  // هنا نعتمد أن permissions = { manageRefunds: { view:true, edit:false }, ... }
  const domainObj = p[domain] || p[`${domain}`] || {};
  const val = domainObj[action];

  return !!val;
}

exports.requirePerm = (perm) => {
  return (req, res, next) => {
    try {
      const user = req.user || req.staff;
      if (!user) return res.status(401).json({ error: 'Not authorized' });
      if (user.isAdmin) return next();
      if (hasPerm(user, perm)) return next();
      return res.status(403).json({ error: 'Forbidden: missing permission ' + perm });
    } catch (e) {
      console.error('requirePerm error:', e);
      return res.status(500).json({ error: 'Permission middleware failed' });
    }
  };
};

exports.requireAny = (perms = []) => {
  return (req, res, next) => {
    try {
      const user = req.user || req.staff;
      if (!user) return res.status(401).json({ error: 'Not authorized' });
      if (user.isAdmin) return next();
      for (const perm of perms) {
        if (hasPerm(user, perm)) return next();
      }
      return res.status(403).json({ error: 'Forbidden: missing one of ' + perms.join(', ') });
    } catch (e) {
      console.error('requireAny error:', e);
      return res.status(500).json({ error: 'Permission middleware failed' });
    }
  };
};

// أداة فائدة للفرونت/الاختبارات إن احتجت
exports._hasPerm = hasPerm;