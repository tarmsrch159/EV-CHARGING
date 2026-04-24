const express = require('express');
const router = express.Router();
const order = require('./order')
const order_type = require('./order-type');

// ============= Order =============
router.post('/information', order.getOrderInformation);
router.post('/order-id/information', order.getOrderInformationByID);
router.post('/report/information', order.getOrderReportInformation);
router.post('/runout/information', order.getOrderRunout);
router.post('/auto-email/information', order.getOrderReport);
router.post('/order-logs/information', order.getLoggingOrderInformation);
router.post('/re-order/information', order.reCreateOrderInformation);
router.put('/information', order.addOrderInformation);
router.patch('/information', order.setOrderInformation);
router.patch('/status-deli/information', order.setStatusDeli);
router.patch('/edit-item/information', order.editOrderItem);
router.delete('/information/remove', order.removeOrderInformationById);

// ============= Order - SAP =============
router.post('/confirm/information', order.getConfirmOrder);
router.post('/order-hana/information', order.getOrderInformationHana);
router.post('/cancel-hana/information', order.cancelOrderInformationHana);

// ============= Order type ==============
router.post('/type/information', order_type.getOrderTypeInformation);
router.put('/type/information', order_type.addOrderType);
router.patch('/type/information', order_type.setOrderType);
router.delete('/type/remove', order_type.removeOrderType);

module.exports = router;