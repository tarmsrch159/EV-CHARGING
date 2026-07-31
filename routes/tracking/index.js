const express = require('express');
const router = express.Router();
const tracking = require('./tracking')
//item
router.post('/history/information', tracking.getHistoryInformation);

module.exports = router;