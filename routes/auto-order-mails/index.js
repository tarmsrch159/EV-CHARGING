const express = require('express');
const router = express.Router();
const controller = require('./auto-order-mails');

// ============== Auto Order Mails ==============
router.post('/information', controller.getAutoOrderMailData);
router.post('/trigger/information', controller.runAutoOrderMailTask);
router.post('/decrypt-token', controller.decryptToken);

// ============== Auto Order Cleanup ==============
router.patch('/auto-order/cleanup/test', controller.updateAutoOrderFlag);

// ============== Auto Order Send To SAP ==============
router.post('/run/auto-order-to-sap', controller.runAutoOrderToSapTask);


// ============== Auto Order Send To SAP ==============
router.post('/run/auto-stock-logs', controller.runAutoStockLogs);


module.exports = router;