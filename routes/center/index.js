const express = require('express');
const router = express.Router();
const center = require('./center')

router.put('/register/fuel/information', center.addLicenseFuelInformation);

module.exports = router;