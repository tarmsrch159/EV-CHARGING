const express = require('express');
const router = express.Router();
const lowStockAlertController = require('./low-stock-alert');
const lowStockReport = require('./low-stock-report');
/**
 * @route POST /api-tms-v2/low-stock-alert/trigger
 * สั่งรันการตรวจสอบ Low Stock แบบ Manual
 */
router.post('/trigger', lowStockAlertController.triggerLowStockAlert);


// =========== Runout Report ============
router.post('/runout-report', lowStockReport.getRunoutReportInformation);

module.exports = router;
