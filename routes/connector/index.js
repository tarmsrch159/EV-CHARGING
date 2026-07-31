const express = require('express');
const router = express.Router();
const connector = require('./connector');


router.post('/get-connector', connector.getConnectorInformation);
router.put('/add-connector', connector.addConnector);
router.patch('/set-connector', connector.setConnector);
router.delete('/remove-connector', connector.removeConnector);

module.exports = router;
