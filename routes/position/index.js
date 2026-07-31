const express = require('express');
const router = express.Router();
const position = require('./position')

//position
router.post('/information', position.getPositionInformation);
router.delete('/information', position.removePosition);
router.patch('/information', position.setPositionInformation);
router.put('/information', position.addPositionInformation);

module.exports = router;