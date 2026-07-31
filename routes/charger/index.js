const express = require('express');
const router = express.Router();
const charger = require('./charger');

router.post('/information', charger.getChargerInformation);
router.put('/information', charger.addCharger);
router.patch('/information', charger.setCharger);
router.delete('/information', charger.removeCharger);

router.post('/connector/information', charger.getConnectorInformation);
router.put('/connector/information', charger.addConnector);
router.patch('/connector/information', charger.setConnector);
router.delete('/connector/information', charger.removeConnector);

module.exports = router;
