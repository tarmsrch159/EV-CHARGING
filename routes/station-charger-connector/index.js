const express = require('express');
const router = express.Router();
const station_charger_connector = require('./station-charger-connector');


router.post('/station-charger', station_charger_connector.getStationChargerConnector);
router.put('/station-charger', station_charger_connector.addStationChargerConnector);
router.patch('/station-charger', station_charger_connector.setStationChargerConnector);
router.delete('/station-charger', station_charger_connector.removeStationChargerConnector);

module.exports = router;
