const express = require('express');
const router = express.Router();
const report = require('./report');
const reportPos = require('./report-pos');
const reportStock = require('./report-stock');
const cron = require('node-cron');
const axios = require('axios');
const moment = require('moment');

router.post('/als/information', report.getReportALSInformation);
router.post('/als-v2/information', report.getReportALSInformationV2);
router.post('/trip-for-upload-prv/information', report.getReportTripForUploadInformation);
router.post('/trip-for-upload-prv-v2/information', report.getReportTripForUploadInformationV2);
router.post('/trip/information', report.getReportTripInformation);
router.post('/taskplan/information', report.getReportTaskPlan);
router.post('/pre-send-post-send/information', report.getPresendPostsend);
router.post('/discharge/information', report.getDischarge);

//ยอดขาย POS
router.post('/pos/tanks', reportPos.getReportPosTanks); //ยอดขายรายแทงค์ รายวัน
router.post('/pos/meters', reportPos.getReportPosMeters); //ยอดขายรายหัวจ่าย รายวัน
router.post('/pos/omi', reportPos.getReportPosOmi); //ยอดขายรายชั่วโมง

//สต็อก
router.post('/stock', reportStock.getReportStock);

// ============= Update POS =============
router.post('/manual/pos-tank', reportPos.addPosTank); // อัปเดตยอดขายรายแทงค์
router.post('/manual/pos-meter', reportPos.addPosMeter); // อัปเดตยอดขายรายหัวจ่าย

// คำนวณยอดขาย
// const runSyncSalesTask = () => {
//     console.log('Running sync sales task:', moment().format('YYYY-MM-DD HH:mm:ss'));
//     let lic_code = 'aos02';
//     let ptrl_number = '';
//     let date_at = moment().format('YYYY-MM-DD');
//     // let date_at = '2026-04-01';
//     reportStock.syncSalesInfo(date_at, ptrl_number, lic_code);
// };

// // สั่งให้ทำงานทันที 1 ครั้งเมื่อ Start Service
// runSyncSalesTask();

// // ตั้งเวลาให้ทำงานรอบต่อไปตาม Cron (นาทีที่ 15 ของทุกชั่วโมง)
// cron.schedule('15 * * * *', () => {
//     runSyncSalesTask();
// });

module.exports = router;