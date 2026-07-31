const express = require('express');
const router = express.Router();
const office = require('./office')

//office
router.post('/information', office.getOfficeInformation);
router.delete('/information', office.removeOffice);
router.patch('/information', office.setOfficeInformation);
router.put('/information', office.addOfficeInformation);

module.exports = router;