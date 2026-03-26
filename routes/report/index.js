const express = require('express');
const router = express.Router();
const report = require('./report')
const reportPos = require('./report-pos')

router.post('/als/information', report.getReportALSInformation);
router.post('/als-v2/information', report.getReportALSInformationV2);
router.post('/trip-for-upload-prv/information', report.getReportTripForUploadInformation);
router.post('/trip-for-upload-prv-v2/information', report.getReportTripForUploadInformationV2);
router.post('/trip/information', report.getReportTripInformation);
router.post('/taskplan/information', report.getReportTaskPlan);
router.post('/pre-send-post-send/information', report.getPresendPostsend);
router.post('/discharge/information', report.getDischarge);

router.post('/pos/tanks', reportPos.getReportPosTanks); //ยอดขายรายแทงค์ รายวัน
router.post('/pos/meters', reportPos.getReportPosMeters); //ยอดขายรายหัวจ่าย รายวัน
router.post('/pos/omi', reportPos.getReportPosOmi); //ยอดขายรายชั่วโมง

module.exports = router;