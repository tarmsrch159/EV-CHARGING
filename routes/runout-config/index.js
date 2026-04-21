const express = require('express');
const router = express.Router();
const runoutConfig = require('./runout-config');


// ============== runout config ==============
router.post('/information', runoutConfig.getRunoutInformation);
router.patch('/information', runoutConfig.setRunoutInformation);
router.put('/email-alert', runoutConfig.addEmailAlert);
router.patch('/email-alert', runoutConfig.setEmailAlertInformation);
router.post('/email-alert/information', runoutConfig.getEmailAlertInformation);


module.exports = router;