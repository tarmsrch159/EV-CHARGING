const express = require('express');
const router = express.Router();
const controller = require('./auto-order-mails');

// ============== Auto Order Mails ==============
router.post('/information', controller.getAutoOrderMailData);
router.post('/decrypt-token', controller.decryptToken);

module.exports = router;