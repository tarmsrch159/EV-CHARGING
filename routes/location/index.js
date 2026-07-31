const express = require('express');
const router = express.Router();
const location = require('./location')

//office
router.post('/province/information', location.getProvinceInformation);
router.post('/amphure/information', location.getAmphureInformation);
router.post('/tambon/information', location.getTambonInformation);

module.exports = router;