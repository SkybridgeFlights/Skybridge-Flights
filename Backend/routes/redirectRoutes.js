const express = require('express');
const router = express.Router();

const {
  redirectToProvider,
  listProviders,
  createProvider,
  updateProvider,
  deleteProvider,
} = require('../controllers/redirectController');

router.get('/providers', listProviders);
router.post('/providers', createProvider);
router.put('/providers/:id', updateProvider);
router.delete('/providers/:id', deleteProvider);

router.get('/:provider', redirectToProvider);

module.exports = router;


