const express = require('express');
const router = express.Router();
const vehicle = require('./vehicle')
const vehicle_group = require('./vehicle-group')
const vehicle_group_depot = require('./vehicle-group-depot')
const vehicle_unavailable_type = require('./vehicle-unavailable-type')
const vehicle_unavailable = require('./vehicle-unavailable')
const vehicle_compartment = require('./vehicle-compartment')
const vehicle_compartment_level = require('./vehicle-compartment-level')
const vehicle_type = require('./vehicle-type')
const vehicle_calendar_type = require('./vehicle-calendar-type')

//vehicle
router.post('/information', vehicle.getVehicleInformation);
router.delete('/information', vehicle.removeVehicle);
router.patch('/information', vehicle.setVehicleInformation);
router.put('/information', vehicle.addVehicleInformation);

//group
router.post('/group/information', vehicle_group.getVehicleGroupInformation);
router.post('/group/table-information', vehicle_group.getVehicleGroupTableInformation);
router.delete('/group/information', vehicle_group.removeVehicleGroup);
router.patch('/group/information', vehicle_group.setVehicleGroupInformation);
router.put('/group/information', vehicle_group.addVehicleGroupInformation);

//group depot
router.post('/group/depot/information', vehicle_group_depot.getVehicleGroupDepotInformation);
router.delete('/group/depot/information', vehicle_group_depot.removeVehicleGroupDepot);
router.patch('/group/depot/information', vehicle_group_depot.setVehicleGroupDepotInformation);
router.put('/group/depot/information', vehicle_group_depot.addVehicleGroupDepotInformation);

//type
router.post('/type/information', vehicle_type.getVehicleTypeInformation);
router.post('/type/detail/information', vehicle_type.getVehicleTypeInformationWithDetail);
router.post('/type/compartment/detail/information', vehicle_type.getVehicleTypeCompartmentInformationWithDetail);
router.post('/type/compartment/information', vehicle_type.getCompartmentItem);
router.post('/type/compartment/level/information', vehicle_type.getCompartmentTypeLevelItem)
router.patch('/type/information', vehicle_type.setVehicleTypeInformation);
router.put('/type/information', vehicle_type.addVehicleTypeInformation);
router.put('/type-compartment/information', vehicle_type.addVehicleTypeCompartmentInformation);
router.put('/type-compartment-level/information', vehicle_type.addVehicleTypeCompartmentLevelInformation);
router.delete('/type/information', vehicle_type.removeVehicleType);
router.delete('/type-compartment/information', vehicle_type.removeCompartmentItemById);
router.delete('/type-compartment-level/information', vehicle_type.removeCompartmentLevelById);

//unavailable type
router.post('/unavailable/type/information', vehicle_unavailable_type.getVehicleUnavailableTypeInformation);
router.delete('/unavailable/type/information', vehicle_unavailable_type.removeVehicleUnavailableType);
router.patch('/unavailable/type/information', vehicle_unavailable_type.setVehicleUnavailableTypeInformation);
router.put('/unavailable/type/information', vehicle_unavailable_type.addVehicleUnavailableTypeInformation);

//unavailable 
router.post('/unavailable/information', vehicle_unavailable.getVehicleUnavailableInformation);
router.delete('/unavailable/information', vehicle_unavailable.removeVehicleUnavailable);
router.patch('/unavailable/information', vehicle_unavailable.setVehicleUnavailableInformation);
router.put('/unavailable/information', vehicle_unavailable.addVehicleUnavailableInformation);
router.put('/unavailable/multi-date/information', vehicle_unavailable.addVehicleUnavailableMutiDateInformation);

//compartment 
router.post('/compartment/information', vehicle_compartment.getVehicleCompartmentInformation);
router.delete('/compartment/information', vehicle_compartment.removeVehicleCompartment);
router.patch('/compartment/information', vehicle_compartment.setVehicleCompartmentInformation);
router.put('/compartment/information', vehicle_compartment.addVehicleCompartmentInformation);

//compartment level
router.post('/compartment/level/information', vehicle_compartment_level.getVehicleCompartmentLevelInformation);
router.delete('/compartment/level/information', vehicle_compartment_level.removeVehicleCompartmentLevel);
router.patch('/compartment/level/information', vehicle_compartment_level.setVehicleCompartmentLevelInformation);
router.put('/compartment/level/information', vehicle_compartment_level.addVehicleCompartmentLevelInformation);

//calendar type
router.post('/calendar/type/information', vehicle_calendar_type.getVehicleTypeCalendarInformation);
router.delete('/calendar/type/information', vehicle_calendar_type.removeVehicleTypeCalendarInformation);
router.patch('/calendar/type/information', vehicle_calendar_type.setVehicleTypeCalendarInformation);
router.put('/calendar/type/information', vehicle_calendar_type.addVehicleTypeCalendarInformation);

module.exports = router;