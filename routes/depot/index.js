const express = require('express');
const router = express.Router();
const depot = require('./depot');
const depot_group = require('./depot-group');
const depot_item = require('./depot-item')
const depot_worked = require('./depot-worked-date')
const depot_driver_card_type = require('./depot-driver-card-type')

//Depot
router.put('/information', depot.addDepotInformation);
router.patch('/information', depot.setDepotInformation);
router.delete('/information', depot.removeDepot);
router.post('/information', depot.getDepotInformation);

//Depot group
router.post('/group/information', depot_group.getDepotGroupInformation);
router.delete('/group/information', depot_group.removeDepotGroup);
router.patch('/group/information', depot_group.setDepotGroupInformation);
router.put('/group/information', depot_group.addDepotGroupInformation);

//Depot item
router.post('/item/information', depot_item.getDepotItemInformation);
router.delete('/item/information', depot_item.removeDepotItem);
router.patch('/item/information', depot_item.setDepotItemInformation);
router.put('/item/information', depot_item.addDepotItemInformation);
router.post('/item/duplicate', depot_item.getDuplicateItemInDepot);

//Depot worked
router.post('/worked/information', depot_worked.getDepotWorkedDateInformation);
router.delete('/worked/information', depot_worked.removeDepotWorkedDate);
router.patch('/worked/information', depot_worked.setDepotWorkedDateInformation);
router.put('/worked/information', depot_worked.addDepotWorkedDateInformation);

//Depot driver card type
router.post('/driver/card/type/information', depot_driver_card_type.getDepotDriverCardTypeInformation);
router.delete('/driver/card/type/information', depot_driver_card_type.removeDepotDriverCardType);
router.patch('/driver/card/type/information', depot_driver_card_type.setDepotDriverCardTypeInformation);
router.put('/driver/card/type/information', depot_driver_card_type.addDepotDriverCardTypeInformation);

module.exports = router;