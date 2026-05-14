const express = require('express');
const router = express.Router();
const cron = require('node-cron');
const axios = require('axios');
const moment = require('moment');
const manualStock = require('./manual-stock');

router.put('/information', manualStock.updateManualStock);
router.post('/manual-logs', manualStock.getManualStockLogs);

module.exports = router;