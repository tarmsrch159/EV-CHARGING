const express = require('express');
const router = express.Router();
const controller = require('./auto-order-mails');

// ============== Auto Order Mails ==============
router.post('/information', controller.getAutoOrderMailData);
router.post('/decrypt-token', controller.decryptToken);

// ============== Auto Order Cleanup ==============
router.patch('/auto-order/cleanup/test', controller.updateAutoOrderFlag);

module.exports = router;