const express = require('express');
const router = express.Router();
const report = require('./report')
const reportDaily = require('./report-daily')

router.post('/als/information', report.getReportALSInformation);
router.post('/als-v2/information', report.getReportALSInformationV2);
router.post('/trip-for-upload-prv/information', report.getReportTripForUploadInformation);
router.post('/trip-for-upload-prv-v2/information', report.getReportTripForUploadInformationV2);
router.post('/trip/information', report.getReportTripInformation);
router.post('/taskplan/information', report.getReportTaskPlan);
router.post('/pre-send-post-send/information', report.getPresendPostsend);
router.post('/discharge/information', report.getDischarge);

router.post('/daily', reportDaily.getReportDaily);

module.exports = router;