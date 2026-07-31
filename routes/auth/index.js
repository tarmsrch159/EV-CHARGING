const express = require('express');
const router = express.Router();
const auth = require('./auth');

router.post('/information', auth.authUserInformation);
router.patch('/reset/information', auth.resetUserPassword);

module.exports = router;