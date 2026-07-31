const express = require('express');
const router = express.Router();
const utility = require('./utility')

router.post('/action/logs/information', utility.getActionLogInformation);
router.post('/notificaion/information', utility.getNotificaionInformation);
router.patch('/notificaion/information', utility.setNotificaionInformation);

module.exports = router;