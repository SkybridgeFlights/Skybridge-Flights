const express = require('express');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { adminList } = require('../controllers/flightAlertController');

const router = express.Router();

router.get('/', protect, adminOnly, adminList);

module.exports = router;
