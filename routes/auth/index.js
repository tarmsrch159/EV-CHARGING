const express = require('express');
const router = express.Router();
const auth = require('./auth')

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
router.post('/information', auth.authUserInformation);
<<<<<<< HEAD
router.patch('/reset/information', auth.resetUserPassword);
=======
router.post('/information', auth.authEmployeeInformation);
router.post('/reset/information', auth.resetEmployeeInformation);
>>>>>>> parent of e952446 (first commit)
=======
router.post('/information', auth.authEmployeeInformation);
router.post('/reset/information', auth.resetEmployeeInformation);
>>>>>>> parent of 7fbf438 (Update Backend)
=======
router.post('/information', auth.authEmployeeInformation);
router.post('/reset/information', auth.resetEmployeeInformation);
>>>>>>> parent of 7fbf438 (Update Backend)
=======
router.post('/reset/information', auth.resetUserPassword);
>>>>>>> parent of 2056d7e (Update Backend)

module.exports = router;