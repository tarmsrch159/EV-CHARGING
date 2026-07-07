const express = require('express');
const router = express.Router();
const employee = require('./employee');
const employee_group = require('./employee-group');
const employee_role = require('./employee-role');
const menu_permission = require('./menu-permission');

//employee
router.post('/information', employee.getEmployeeInformation);
router.delete('/information', employee.removeEmployee);
router.patch('/information', employee.setEmployeeInformation);
router.patch('/password/information', employee.setEmployeePasswordInformation);
router.put('/information', employee.addEmployeeInformation);

//group
router.post('/group/information', employee_group.getEmployeeGroupInformation);
router.delete('/group/information', employee_group.removeEmployeeGroup);
router.patch('/group/information', employee_group.setEmployeeGroupInformation);
router.put('/group/information', employee_group.addEmployeeGroupInformation);

//role
router.post('/role/information', employee_role.getEmployeeRoleInformation);

//menu
router.post('/menu/information', menu_permission.getMenuInformation);
router.put('/menu/information', menu_permission.addMenuInformation);
router.patch('/menu/information', menu_permission.setMenuInformation);
router.delete('/menu/information', menu_permission.removeMenu);

//menu-permission
router.post('/menu/permission/information', menu_permission.getMenuPermissionInformation);
router.put('/menu/permission/information', menu_permission.addMenuPermissionInformation);
router.patch('/menu/permission/information', menu_permission.setMenuPermissionInformation);
router.delete('/menu/permission/information', menu_permission.removeMenuPermission);

//permission status
router.post('/menu/permission/check', menu_permission.getMenuPermissionCheck);

module.exports = router;