const express = require('express');
const router = express.Router();
const department = require('./department')

//department
router.post('/information', department.getDepartmentInformation);
router.delete('/information', department.removeDepartment);
router.patch('/information', department.setDepartmentInformation);
router.put('/information', department.addDepartmentInformation);

module.exports = router;