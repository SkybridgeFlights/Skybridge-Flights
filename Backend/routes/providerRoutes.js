// Backend/routes/providerRoutes.js

const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/providerPublicController');

// البحث عن الرحلات من المزودين
router.get('/search', ctrl.search);

module.exports = router;





