const express = require('express');
const router = express.Router();
const controller = require('./sap-alert-config');

// ============== SAP Alert Config ==============
router.post('/information', controller.getSAPAlertInformation);
router.put('/information', controller.addSAPAlertInformation);
router.patch('/information', controller.setSAPAlertInformation);

module.exports = router;