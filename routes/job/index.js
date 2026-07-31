const express = require('express');
const router = express.Router();
const job = require('./job')
const job_calculate = require('./job-calculate');
const job_vehicle = require('./job-vehicle');
const job_driver = require('./job-driver');
const job_expenses = require('./job-expenses');
const job_route = require('./job-route');
const job_close = require('./job-close');
const job_manage = require('./job-manage');
const job_manage_compartment = require('./job-assign-compartment');

//job
router.post('/information', job.getJobInformation);
router.post('/item/information', job.getJobItemWithoutDepotPetrolInformation);
router.post('/depot/information', job.getJobDepotInformation);
//update depot
router.patch('/depot/information', job.setJobDepotInformation);
router.post('/petrol/information', job.getJobPetrolInformation);
router.post('/order/information', job.getOrderInJobInformation);
router.patch('/configuration/cancel/information', job.setJobInformation);
router.put('/information', job.addJobInformation);
router.put('/tmp/information', job.addJobInformationWithPreEvent2Tmp);
router.put('/tmp-close/information', job.closeJobInformationWithPreEvent2Tmp);
router.patch('/gsap/information', job.setGSapInformation);

//job for accept
router.post('/tmp-status/information', job.getJobTMPStatusInformation);
router.post('/tmp-status/accept/information', job.setAceptJobTMPStatusInformation);
router.post('/tmp-status/decline/information', job.setDeclineJobTMPStatusInformation);

router.post('/verify/vehicle/information', job_calculate.verifyFuelFromJobToVehicle);
router.post('/verify/compartment/information', job_calculate.verifyFuelFromJobToCompartment);

//plan job
router.post('/vehicle/information', job_vehicle.getVehicleOfJobInformation);
router.post('/driver/information', job_driver.getDriverOfJobInformation);
router.post('/expenses/information', job_expenses.getExpensesOfJobInformation);
router.post('/route/information', job_route.getRouteOfJobInformation);
router.patch('/route/information', job_route.setRouteOfOJobInformation);
//assign, cancel     
router.post('/assign-jobs/information', job.setAssignJobsJobInformation);
router.post('/cancel-jobs/information', job.setCancelJobsJobInformation);

//close
router.post('/close/compartment/information', job_close.getCompartmentJobForCloseInformation);
router.post('/close/vehicle/information', job_close.getVehicleJobForCloseInformation);
router.post('/close/driver/information', job_close.getDriverJobForCloseInformation);

//assign, cancel
router.post('/commit-close/compartment/information', job_close.setCommitCompartmentJobForCloseInformation2UpateJob);
router.post('/cancel-close/compartment/information', job_close.setCompartmentJobForCancleCloseInformation);

router.post('/before-assign-close/compartment/information', job_close.getXmlBeforeCompartmentJobForCloseInformation);
router.post('/after-assign-close/compartment/information', job_close.getXmlAfterCompartmentJobForCloseInformation);
router.post('/clear-assign-close/compartment/information', job_close.removeXmlBeforeCompartmentJobForCloseInformation);

// job manage
router.delete('/manage/item/plan', job_manage.removeManageItem);
router.post('/manage/vehicle/plan', job_manage.getVehicleForManageOrder);
router.post('/manage/multi-group/vehicle/plan', job_manage.getVehicleOfGroupForManageOrder);
router.patch('/manage/vehicle/plan', job_manage.addPlanforVehicleOrderManage);
router.post('/manage/vehicle/Jobplan', job_manage.getJobInformationforVehicle);
router.post('/manage/vehicle/JobplanEdit', job_manage.getOrderInJobInformationEdit);
router.post('/manage/vehicle/getCompartmentJobForEdit', job_manage.getCompartmentJobForEditWithOrderinTruck);
//resend to tmp
router.patch('/manage/vehicle/updateVehicleForManageOrder', job_manage.updateVehicleForManageOrder);
router.patch('/manage/route', job_manage.setRouteOfPlanInformation);
router.post('/manage/jobdetail', job_manage.getDataWorkSheetJobCode);
router.post('/manage/jobForOrder', job_manage.getJobFromOrder);

router.post('/manage/settimedataPlanInformation', job_manage.settimedataPlanInformation);
//fillFuelFromJobToVehicle
router.post('/manage/track-stability', job_manage_compartment.fillFuelFromJobToVehicle);

module.exports = router;