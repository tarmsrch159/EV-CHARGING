const express = require('express');
const router = express.Router();
const vehicle = require('./vehicle');

// Brand
router.post('/brand', vehicle.getBrand);
router.put('/brand', vehicle.addBrand);
router.patch('/brand', vehicle.setBrand);
router.delete('/brand', vehicle.removeBrand);

// Model
router.post('/model', vehicle.getModel);
router.put('/model', vehicle.addModel);
router.patch('/model', vehicle.setModel);
router.delete('/model', vehicle.removeModel);

// Type
router.post('/type', vehicle.getType);
router.put('/type', vehicle.addType);
router.patch('/type', vehicle.setType);
router.delete('/type', vehicle.removeType);

// Vehicle & Spec
router.post('/information', vehicle.getVehicleInformation);
router.put('/information', vehicle.addVehicle);
router.patch('/information', vehicle.setVehicle);
router.delete('/information', vehicle.removeVehicle);

module.exports = router;