const express = require('express');
const router = express.Router();
const division = require('./division')

//division
router.post('/information', division.getDivisionInformation);
router.delete('/information', division.removeDivision);
router.patch('/information', division.setDivisionInformation);
router.put('/information', division.addDivisionInformation);

module.exports = router;