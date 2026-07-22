const express = require('express');
const router = express.Router();
const transactionLog = require('./transaction-log');

router.post('/information', transactionLog.getTransactionLogInformation);
router.put('/information', transactionLog.addTransactionLog);

module.exports = router;
