const express = require('express');
const router = express.Router();
const salesOrgConfigController = require('./sales-org-config');

/**
 * @route POST /api-tms-v2/sales-org-config/list
 * ดึงรายการตั้งค่า Run-out และ Auto Order ราย Sales Org
 */
router.post('/information', salesOrgConfigController.getSalesOrgConfig);

/**
 * @route POST /api-tms-v2/sales-org-config/add
 * เพิ่มการตั้งค่าใหม่
 */
router.put('/information', salesOrgConfigController.addSalesOrgConfig);

/**
 * @route POST /api-tms-v2/sales-org-config/update
 * แก้ไขการตั้งค่าเดิม
 */
router.patch('/information', salesOrgConfigController.updateSalesOrgConfig);

/**
 * @route POST /api-tms-v2/sales-org-config/delete
 * ลบการตั้งค่า (Soft Delete)
 */
router.delete('/information', salesOrgConfigController.deleteSalesOrgConfig);

module.exports = router;
