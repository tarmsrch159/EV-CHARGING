const express = require('express');
const router = express.Router();
const lowStockAlertController = require('./low-stock-alert');

/**
 * @route POST /api-tms-v2/low-stock-alert/trigger
 * สั่งรันการตรวจสอบ Low Stock แบบ Manual
 */
router.post('/trigger', lowStockAlertController.triggerLowStockAlert);

module.exports = router;
