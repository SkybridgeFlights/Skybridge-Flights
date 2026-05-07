// routes/policyRoutes.js
const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { getRefundPolicy, upsertRefundPolicy } = require('../controllers/policyController');

router.get('/refund', protect, adminOnly, getRefundPolicy);
router.post('/refund', protect, adminOnly, upsertRefundPolicy);

module.exports = router;




