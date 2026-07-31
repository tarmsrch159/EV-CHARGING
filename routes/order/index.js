const express = require("express");
const router = express.Router();
const order = require("./order");
const order_type = require("./order-type");
const order_sap_logs = require("./order-sap-logs");
const auto_order = require("./auto-order");
const auto_order_calculate = require("./auto-order-calculate");
const orderScheduler = require("./order-sap-scheduler");

// ============= Order =============
router.post("/information", order.getOrderInformation);
router.post("/order-id/information", order.getOrderInformationByID);
router.post("/report/information", order.getOrderReportInformation);
router.post(
  "/report/station-over-day-sales",
  order.getReportStationOverDaySales,
);
router.post("/runout/information", order.getOrderRunout);
router.post("/auto-email/information", order.getOrderReport);
router.post("/order-logs/information", order.getLoggingOrderInformation);
router.post("/re-order/information", order.reCreateOrderInformation);
router.put("/information", order.addOrderInformationV2);
// router.put('/information', order.addOrderInformation);
router.put("/information-with-sap", order.addOrderInformationWithSAPV2);
// router.put("/information-with-sap", order.addOrderInformationWithSAP);
router.put("/linked-order/information", order.addLinkedOrderInformation);
router.patch("/set-linked-order/information", order.setLinkedOrderInformation);
router.delete("/unlinked-order/information", order.unlinkOrderInformation);
router.post("/linked-order/list", order.getLinkedOrderList);
router.patch("/information", order.setOrderInformation);
router.patch("/status-deli/information", order.setStatusDeli);
router.patch("/edit-item/information", order.editOrderItemV2);
// router.patch("/edit-item/information", order.editOrderItem);
router.delete("/information/remove", order.removeOrderInformationById);

// ============= Order - SAP =============
router.post("/confirm/information", order.getConfirmOrder);
router.post("/confirm/payload", order.getConfirmOrderPayload);
router.post("/order-hana/information", order.getOrderInformationHana);
router.post(
  "/order-sap-logs/information",
  order_sap_logs.getSapOrderErrorLogsInformation,
);
router.post("/cancel-hana/information", order.cancelOrderInformationHana);

// ============= Order type ==============
router.post("/type/information", order_type.getOrderTypeInformation);
router.put("/type/information", order_type.addOrderType);
router.patch("/type/information", order_type.setOrderType);
router.delete("/type/remove", order_type.removeOrderType);

// ========= Auto Order ==========
router.post(
  "/auto-order/stock/information",
  auto_order.getStockAutoOrderInformation,
);
router.post(
  "/auto-order/sales/information",
  auto_order.getSalesAutoOrderInformation,
);
router.post(
  "/auto-order/calculate/information",
  auto_order_calculate.getAutoCalculateOrderInformationV2,
);

// ========= Child Order ==========
router.post("/child-order/information", order.getChildOrderInformation);

// Sap schedule trigger
router.post("/sap-schedule/test", async (req, res) => {
  try {
    const defaultLicCodes = process.env.IS_PROD === 'true' ? ['aos_qa'] : ['aos01'];
    const licCodes = (process.env.LIC_CODES ? process.env.LIC_CODES.split(',') : defaultLicCodes).map(c => c.trim() === 'aos_01' ? 'aos01' : c.trim());
    for (const lic_code of licCodes) {
      await orderScheduler.runSapSyncForLicense(lic_code);
    }
    res.status(200).send({ status: "success", message: "Triggered SAP Sync test successfully", licCodes });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
});
module.exports = router;
