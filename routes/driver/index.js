const express = require('express');
const router = express.Router();
const driver = require('./driver')
const driver_group = require('./driver-group')
const driver_role = require('./driver-role')
const driver_card_license_type = require('./driver-card-license-type')
const driver_card_license = require('./driver-card-license')
const driver_card = require('./driver-card')
const driver_card_type = require('./driver-card-type')
const driver_leave_type = require('./driver-leave-type')
const driver_leave = require('./driver-leave')

//driver
router.post('/information', driver.getDriverInformation);
router.delete('/information', driver.removeDriver);
router.patch('/information', driver.setDriverInformation);
router.put('/information', driver.addDriverInformation);

//group
router.post('/group/information', driver_group.getDriverGroupInformation);
router.delete('/group/information', driver_group.removeDriverGroup);
router.patch('/group/information', driver_group.setDriverGroupInformation);
router.put('/group/information', driver_group.addDriverGroupInformation);

//role
router.post('/role/information', driver_role.getDriverRoleInformation);
router.delete('/role/information', driver_role.removeDriverRole);
router.patch('/role/information', driver_role.setDriverRoleInformation);
router.put('/role/information', driver_role.addDriverRoleInformation);

//card license type
router.post('/license/type/information', driver_card_license_type.getDriverLicenseTypeInformation);
router.delete('/license/type/information', driver_card_license_type.removeDriverLicenseType);
router.patch('/license/type/information', driver_card_license_type.setDriverLicenseTypeInformation);
router.put('/license/type/information', driver_card_license_type.addDriverLicenseTypeInformation);

//driver card license
router.post('/license/information', driver_card_license.getDriverCardLicenseInformation);
router.delete('/license/information', driver_card_license.removeDriverCardLicense);
router.patch('/license/information', driver_card_license.setDriverCardLicenseInformation);
router.put('/license/information', driver_card_license.addDriverCardLicenseInformation);

//card type
router.post('/card/type/information', driver_card_type.getDriverCardTypeInformation);
router.delete('/card/type/information', driver_card_type.removeDriverCardType);
router.patch('/card/type/information', driver_card_type.setDriverCardTypeInformation);
router.put('/card/type/information', driver_card_type.addDriverCardTypeInformation);

//driver card
router.post('/card/information', driver_card.getDriverCardInformation);
router.delete('/card/information', driver_card.removeDriverCard);
router.patch('/card/information', driver_card.setDriverCardInformation);
router.put('/card/information', driver_card.addDriverCardInformation);

//leave type
router.post('/leave/type/information', driver_leave_type.getDriverLeaveTypeInformation);
router.delete('/leave/type/information', driver_leave_type.removeDriverLeaveType);
router.patch('/leave/type/information', driver_leave_type.setDriverLeaveTypeInformation);
router.put('/leave/type/information', driver_leave_type.addDriverLeaveTypeInformation);

//leave
router.post('/leave/information', driver_leave.getDriverLeaveInformation);
router.delete('/leave/information', driver_leave.removeDriverLeave);
router.patch('/leave/information', driver_leave.setDriverLeaveInformation);
router.put('/leave/information', driver_leave.addDriverLeaveInformation);

module.exports = router;