// Backend/routes/supportRoutes.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { protect } = require('../middleware/authMiddleware');
const SupportTicket = require('../models/SupportTicket');

const {
  CF_R2_ACCOUNT_ID,
  CF_R2_ACCESS_KEY_ID,
  CF_R2_SECRET_ACCESS_KEY,
  CF_R2_BUCKET,
} = process.env;

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${CF_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: CF_R2_ACCESS_KEY_ID,
    secretAccessKey: CF_R2_SECRET_ACCESS_KEY,
  },
});

const upload = multer({ storage: multer.memoryStorage() });

function computeIsStaff(user) {
  if (!user) return false;
  if (user.isStaff) return true;
  const r = String(user.role || '').toLowerCase();
  if (r === 'admin' || r === 'staff' || r === 'support') return true;
  if (Array.isArray(user.permissions) && user.permissions.includes('manageTickets')) return true;
  return false;
}

async function putToR2(file, prefix) {
  const ext = (file.originalname || '').split('.').pop();
  const key = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext || 'bin'}`;

  await r2.send(new PutObjectCommand({
    Bucket: CF_R2_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype || 'application/octet-stream',
  }));

  const signed = await getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: CF_R2_BUCKET, Key: key }),
    { expiresIn: 3600 }
  );

  return {
    _id: new mongoose.Types.ObjectId(),
    key,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    publicUrl: signed,
  };
}

function findFileInTicket(ticket, fileId) {
  for (const m of ticket.messages || []) {
    for (const f of m.files || []) {
      if (String(f._id) === String(fileId)) return { message: m, file: f };
    }
  }
  return null;
}

/* ================== واجهات العميل ================== */
router.get('/my', protect, async (req, res, next) => {
  try {
    const latest = req.query.latest === '1' || req.query.latest === 'true';
    let q = SupportTicket.find({ customer: req.user._id })
      .sort({ updatedAt: -1 })
      .populate('customer', 'name email phone')
      .populate('assignedTo', 'name email');
    const docs = latest ? await q.limit(1) : await q;
    res.json(latest ? (docs[0] || null) : docs);
  } catch (e) { next(e); }
});

router.post('/', protect, upload.array('files', 10), async (req, res, next) => {
  try {
    const subject = (req.body.subject || 'Support Request').trim();
    const text = (req.body.text || '').trim();

    const files = [];
    for (const f of (req.files || [])) {
      files.push(await putToR2(f, `support/${req.user._id}`));
    }

    const isStaff = computeIsStaff(req.user);
    const byKind = isStaff ? 'staff' : 'user';

    const ticket = await SupportTicket.create({
      subject,
      status: 'open',
      customer: req.user._id,
      messages: [{
        _id: new mongoose.Types.ObjectId(),
        by: req.user._id,
        byName: req.user.name || req.user.email,
        byKind,
        text,
        files,
      }],
    });

    await ticket.populate([
      { path: 'customer', select: 'name email phone' },
      { path: 'assignedTo', select: 'name email' },
    ]);

    try {
      const { io } = require('../realtime/io');
      io?.emit?.('support:updated', { id: String(ticket._id) });
      io?.to?.(`support:${ticket._id}`)?.emit?.('support:message:new', { id: String(ticket._id) });
    } catch (_) {}

    res.status(201).json(ticket);
  } catch (e) { next(e); }
});

router.get('/:id', protect, async (req, res, next) => {
  try {
    const t = await SupportTicket.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('assignedTo', 'name email');
    if (!t) return res.status(404).json({ error: 'Not found' });

    const isOwner = String(t.customer?._id || t.customer) === String(req.user._id);
    const isStaff = computeIsStaff(req.user);
    if (!isOwner && !isStaff) return res.status(403).json({ error: 'Forbidden' });

    res.json(t);
  } catch (e) { next(e); }
});

router.post('/:id/messages', protect, upload.array('files', 10), async (req, res, next) => {
  try {
    const t = await SupportTicket.findById(req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found' });

    const isOwner = String(t.customer) === String(req.user._id);
    const isStaff = computeIsStaff(req.user);
    if (!isOwner && !isStaff) return res.status(403).json({ error: 'Forbidden' });
    if (t.status === 'closed' && !isStaff) return res.status(403).json({ error: 'Ticket is closed' });

    const files = [];
    for (const f of (req.files || [])) {
      files.push(await putToR2(f, `support/${t._id}`));
    }

    const byKind = isStaff ? 'staff' : 'user';

    t.messages.push({
      _id: new mongoose.Types.ObjectId(),
      by: req.user._id,
      byName: req.user.name || req.user.email,
      byKind,
      text: (req.body.text || '').trim(),
      files,
    });
    t.updatedAt = new Date();
    await t.save();

    const populated = await SupportTicket.findById(t._id)
      .populate('customer', 'name email phone')
      .populate('assignedTo', 'name email');

    try {
      const { io } = require('../realtime/io');
      io?.to?.(`support:${t._id}`)?.emit?.('support:message:new', { id: String(t._id) });
      io?.emit?.('support:updated', { id: String(t._id) });
    } catch (_) {}

    res.json(populated);
  } catch (e) { next(e); }
});

router.patch('/:id', protect, async (req, res, next) => {
  try {
    const t = await SupportTicket.findById(req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found' });

    const isOwner = String(t.customer) === String(req.user._id);
    const isStaff = computeIsStaff(req.user);
    const nextStatus = String(req.body.status || '').toLowerCase();

    if (isOwner && !isStaff) {
      if (nextStatus !== 'closed') return res.status(403).json({ error: 'Only closing is allowed for customers' });
      t.status = 'closed';
    } else if (isStaff) {
      if (!['open', 'pending', 'closed'].includes(nextStatus)) return res.status(400).json({ error: 'Invalid status' });
      t.status = nextStatus;
      if (req.body.assignedTo) t.assignedTo = req.body.assignedTo;
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    t.updatedAt = new Date();
    await t.save();

    const populated = await SupportTicket.findById(t._id)
      .populate('customer', 'name email phone')
      .populate('assignedTo', 'name email');

    try {
      const { io } = require('../realtime/io');
      io?.emit?.('support:updated', { id: String(t._id) });
    } catch (_) {}

    res.json(populated);
  } catch (e) { next(e); }
});

/* ================== واجهة الموظفين (Inbox) ================== */
// ✅ يدعم ?status, ?q, وأيضًا ?user=ID لفلترة حسب العميل
router.get('/', protect, async (req, res, next) => {
  try {
    if (!computeIsStaff(req.user)) return res.status(403).json({ error: 'Forbidden' });

    const { q = '', status = 'all', user } = req.query;
    const cond = {};
    if (status && status !== 'all') cond.status = status;
    if (q) cond.subject = { $regex: q, $options: 'i' };
    if (user) cond.customer = new mongoose.Types.ObjectId(String(user));

    const rows = await SupportTicket.find(cond)
      .sort({ updatedAt: -1 })
      .limit(500)
      .populate('customer', 'name email phone')
      .populate('assignedTo', 'name email');

    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id/download', protect, async (req, res, next) => {
  try {
    const t = await SupportTicket.findById(req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found' });

    const isOwner = String(t.customer) === String(req.user._id);
    const isStaff = computeIsStaff(req.user);
    if (!isOwner && !isStaff) return res.status(403).json({ error: 'Forbidden' });

    const hit = findFileInTicket(t, req.query.fileId);
    if (!hit) return res.status(404).json({ error: 'File not found' });
    const { file } = hit;

    const signed = await getSignedUrl(
      r2,
      new GetObjectCommand({ Bucket: CF_R2_BUCKET, Key: file.key }),
      { expiresIn: 60 * 5 }
    );

    if (req.query.inline) return res.redirect(signed);

    res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName || 'file')}"`);
    return res.redirect(signed);
  } catch (e) { next(e); }
});

module.exports = router;