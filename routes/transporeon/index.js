const express = require('express');
const router = express.Router();
const transporeon = require('./transporeon')

//transporeon
router.post('/information', transporeon.getTransporeonInformation);

module.exports = router;