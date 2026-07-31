const express = require('express');
const router = express.Router();
const auth = require('./auth')

<<<<<<< HEAD
router.post('/information', auth.authUserInformation);
router.patch('/reset/information', auth.resetUserPassword);
=======
router.post('/information', auth.authEmployeeInformation);
router.post('/reset/information', auth.resetEmployeeInformation);
>>>>>>> parent of e952446 (first commit)

module.exports = router;