const express = require('express');
const router = express.Router();
const petrol_group = require('./petrol-group')
const petrol_item = require('./petrol-item')
const petrol_expenses = require('./petrol-expenses')
const petrol_vehicle = require('./petrol-vehicle')
const petrol_vehicle_type = require('./petrol-vehicle-type')
const petrol_driver_card_type = require('./petrol-driver-card-type')
const petrol_worked = require('./petrol-worked-date')
const petrol_tank = require('./petrol-tank')
const petrol_depot = require('./petrol-depot')
const petrol_merge_job = require('./petrol-merge-job')
const petrol_type = require('./petrol-type')
const petrol = require('./petrol')
const reportStock = require('../report/report-stock');
const petrol_merge_job_group = require('./petrol-merge-job-group')

//Petrol
router.put('/information', petrol.addPetrolInformation);
router.post('/information/filter', petrol.getPetrolInformationFilter);
router.patch('/information', petrol.setPetrolInformation);
router.delete('/information', petrol.removePetrol);
router.post('/information', petrol.getPetrolInformation);

//Petrol group
router.post('/group/information', petrol_group.getPetrolGroupInformation);
router.post('/group/information/filter', petrol_group.getPetrolGroupInformationFilter);
router.delete('/group/information', petrol_group.removePetrolGroup);
router.patch('/group/information', petrol_group.setPetrolGroupInformation);
router.put('/group/information', petrol_group.addPetrolGroupInformation);

//Petrol item
router.post('/item/information', petrol_item.getPetrolItemInformation);
router.delete('/item/information', petrol_item.removePetrolItem);
router.patch('/item/information', petrol_item.setPetrolItemInformation);
router.put('/item/information', petrol_item.addPetrolItemInformation);

//Merge petrol item
router.post('/item/merge', petrol_item.getMergePetrolItem);
router.put('/item/merge', petrol_item.mergePetrolItem);
router.delete('/item/merge', petrol_item.mergePetrolItem);

//Petrol expenses
router.post('/expenses/information', petrol_expenses.getPetrolExpensesInformation);
router.delete('/expenses/information', petrol_expenses.removePetrolExpenses);
router.patch('/expenses/information', petrol_expenses.setPetrolExpensesInformation);
router.put('/expenses/information', petrol_expenses.addPetrolExpensesInformation);

//Petrol vehicle
router.post('/vehicle/information', petrol_vehicle.getPetrolVehicleInformation);
router.delete('/vehicle/information', petrol_vehicle.removePetrolVehicle);
router.patch('/vehicle/information', petrol_vehicle.setPetrolVehicleInformation);
router.put('/vehicle/information', petrol_vehicle.addPetrolVehicleInformation);

//Petrol vehicle type
router.post('/vehicle/type/information', petrol_vehicle_type.getPetrolVehicleTypeInformation);
router.delete('/vehicle/type/information', petrol_vehicle_type.removePetrolVehicleType);
router.patch('/vehicle/type/information', petrol_vehicle_type.setPetrolVehicleTypeInformation);
router.put('/vehicle/type/information', petrol_vehicle_type.addPetrolVehicleTypeInformation);

//Petrol driver card type
router.post('/driver/card/type/information', petrol_driver_card_type.getPetrolDriverCardTypeInformation);
router.delete('/driver/card/type/information', petrol_driver_card_type.removePetrolDriverCardType);
router.patch('/driver/card/type/information', petrol_driver_card_type.setPetrolDriverCardTypeInformation);
router.put('/driver/card/type/information', petrol_driver_card_type.addPetrolDriverCardTypeInformation);

//Petrol worked
router.post('/worked/information', petrol_worked.getPetrolWorkedDateInformation);
router.delete('/worked/information', petrol_worked.removePetrolWorkedDate);
router.patch('/worked/information', petrol_worked.setPetrolWorkedDateInformation);
router.put('/worked/information', petrol_worked.addPetrolWorkedDateInformation);

//Petrol tank
router.post('/tank/information', petrol_tank.getPetrolTankInformation);
router.delete('/tank/information', petrol_tank.removePetrolTank);
router.patch('/tank/information', petrol_tank.setPetrolTankInformation);
router.put('/tank/information', petrol_tank.addPetrolTankInformation);

//Petrol depot
router.post('/depot/information', petrol_depot.getPetrolDepotInformation);
router.delete('/depot/information', petrol_depot.removePetrolDepot);
router.patch('/depot/information', petrol_depot.setPetrolDepotInformation);
router.put('/depot/information', petrol_depot.addPetrolDepotInformation);
router.post('/depot/by-petrols', petrol_depot.getPetrolDepotByPetrols);

//Petrol merge job
router.post('/petrol-merge-job/information', petrol_merge_job.getPetrolMergeJobInformation);
router.post('/petrol-merge-job/details', petrol_merge_job.getPetrolMergeJobDetails);
router.post('/petrol-merge-job/details/v2', petrol_merge_job.getPetrolMergeJobDetailsV2);
router.delete('/petrol-merge-job/information', petrol_merge_job.removePetrolMergeJob);
router.delete('/petrol-merge-job/details', petrol_merge_job.removePetrolMergeJobDetails);
router.delete('/petrol-merge-job/details/id', petrol_merge_job.removePetrolMergeJobDetailsById);
router.delete('/petrol-merge-job/details/dpo', petrol_merge_job.removePetrolMergeJobDetailsByDpo);
router.patch('/petrol-merge-job/information', petrol_merge_job.setPetrolMergeJobInformation);
router.put('/petrol-merge-job/information', petrol_merge_job.addPetrolMergeJobInformation);

// ============= Petrol type =============
router.post('/type/information', petrol_type.getPetrolTypeInformation);
router.put('/type/information', petrol_type.addPetrolType);
router.patch('/type/information', petrol_type.setPetrolType);
router.delete('/type/remove', petrol_type.removePetrolType);

// ============= Stock =============
router.post('/stock', reportStock.getReportStock);

// ============= Petrol merge job group =============
router.post('/petrol-merge-job/group/information', petrol_merge_job_group.getPetrolMergeJoGroup);
router.put('/petrol-merge-job/group', petrol_merge_job_group.addPetrolMergeJobGroupInformation);
router.patch('/petrol-merge-job/group', petrol_merge_job_group.setPetrolMergeJobInformation);
router.delete('/petrol-merge-job/group', petrol_merge_job_group.removePetrolMergeJob);
router.post('/petrol-merge-job/group/details', petrol_merge_job_group.getPetrolMergeJobDetails);

// Petrol merge job with petrol
// router.post('/petrol-merge-job/with/petrol/information', petrol_merge_job_group.getPetrolMergeJobWithPetrolInformation);
// router.delete('/petrol-merge-job/with/petrol', petrol_merge_job_group.removePetrolMergeJob);
// router.patch('/petrol-merge-job/with/petrol', petrol_merge_job_group.setPetrolMergeJobWithPetrolInformation);
// router.put('/petrol-merge-job/with/petrol', petrol_merge_job_group.addPetrolMergeJobGroupWithPetrol);

module.exports = router;