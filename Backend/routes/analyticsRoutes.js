const express = require('express');
const { postEvent } = require('../controllers/analyticsController');

const router = express.Router();

router.post('/event', postEvent);

module.exports = router;
