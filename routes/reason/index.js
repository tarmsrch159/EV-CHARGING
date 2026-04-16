const express = require('express');
const router = express.Router();
const reason = require('./reason')

// ============== reason ==============
router.post('/information', reason.getReasonInformation);
router.put('/information', reason.addReasonInformation);
router.patch('/information', reason.setReasonInformation);
router.delete('/remove/information', reason.removeReasonInformation)

module.exports = router;