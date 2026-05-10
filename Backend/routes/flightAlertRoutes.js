const express = require('express');
const {
  subscribe,
  unsubscribeByToken,
} = require('../controllers/flightAlertController');

const router = express.Router();

router.post('/subscribe', subscribe);
router.get('/unsubscribe/:token', unsubscribeByToken);

module.exports = router;
