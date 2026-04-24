const express = require('express');
const router = express.Router();
const controller = require('./auto-order-mails');

// ============== Auto Order Mails ==============
router.post('/information', controller.getAutoOrderMailData);

module.exports = router;