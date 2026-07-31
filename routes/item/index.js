const express = require('express');
const router = express.Router();
const item = require('./item')
const item_type = require('./item-type')
const item_unit = require('./item-unit')

//item
router.post('/information', item.getItemInformation);
router.delete('/information', item.removeItem);
router.patch('/information', item.setItemInformation);
router.put('/information', item.addItemInformation);

//item type
router.post('/type/information', item_type.getItemTypeInformation);
router.delete('/type/information', item_type.removeItemType);
router.patch('/type/information', item_type.setItemTypeInformation);
router.put('/type/information', item_type.addItemTypeInformation);

//item unit
router.post('/unit/information', item_unit.getItemUnitInformation);
router.delete('/unit/information', item_unit.removeItemUnit);
router.patch('/unit/information', item_unit.setItemUnitInformation);
router.put('/unit/information', item_unit.addItemUnitInformation);

module.exports = router;