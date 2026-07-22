const express = require('express');
const router = express.Router();
const utility = require('./utility');

router.post('/action/logs/information', utility.getActionLogInformation);

module.exports = router;