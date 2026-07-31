const express = require('express');
const router = express.Router();
const plan = require('./plan')

//plan
router.put('/information', plan.addOfficeInformation);

module.exports = router;