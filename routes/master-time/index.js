const express = require('express');
const router = express.Router();
const masterTime = require('./master-time')

// ============== master-time ==============
router.post('/information', masterTime.getMasterTimeInformation);
router.put('/information', masterTime.addMasterTimeInformation);
router.patch('/information', masterTime.setMasterTimeInformation);
router.delete('/remove/information', masterTime.removeMasterTimeInformationById)

module.exports = router;