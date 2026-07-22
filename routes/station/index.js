const express = require('express');
const router = express.Router();
const station = require('./station');

router.post('/information', station.getStationInformation);
router.put('/information', station.addStation);
router.patch('/information', station.setStation);
router.delete('/information', station.removeStation);

module.exports = router;
