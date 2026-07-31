const express = require('express');
const router = express.Router();
const charger = require('./charger');

router.post('/information', charger.getChargerInformation);
router.put('/information', charger.addCharger);
router.patch('/information', charger.setCharger);
router.delete('/information', charger.removeCharger);

module.exports = router;
