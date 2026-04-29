const moment = require('moment');
const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const lowStockAlertController = require('./low-stock-alert');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));



/**
 * ฟังก์ชันหลักในการรัน Loop
 */
const executeLoop = async () => {
    try {
        const currentTime = moment();
        console.log(`\n[${currentTime.format('HH:mm:ss')}] 🔋 Low Stock Alert: เริ่มต้นรอบการทำงาน...`);

        await lowStockAlertController.processLowStockAlerts("aos01");

    } catch (error) {
        console.error('❌ [Low Stock Scheduler] executeLoop Error:', error);
    }
};

/**
 * เริ่มต้นระบบ Background Loop (รันทุกๆ 1 นาที)
 */
exports.startLowStockLoop = async () => {
    console.log('[Low Stock Scheduler] ระบบตรวจสอบสต็อกน้ำมันเริ่มทำงานแล้ว (Interval: 1 min)');

    // หน่วงเวลาเริ่มต้น 10 วินาที
    await sleep(10000);

    while (true) {
        await executeLoop();
        // await sleep(5000);
        await sleep(60000);
    }
};
