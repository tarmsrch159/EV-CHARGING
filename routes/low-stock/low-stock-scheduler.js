const moment = require('moment');
const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const lowStockAlertController = require('./low-stock-alert');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));



const xglobal = require('../../middleware/global');
const logInfo = xglobal.logInfo;
const logError = xglobal.logError;

/**
 * ฟังก์ชันหลักในการรัน Loop
 */
const executeLoop = async () => {
    try {
        logInfo('Runout Alert', 'เริ่มต้นรอบการทำงาน...');

        const defaultLicCodes = process.env.IS_PROD === 'true' ? ['aos_qa'] : ['aos01'];
        const licCodes = (process.env.LIC_CODES ? process.env.LIC_CODES.split(',') : defaultLicCodes)
            .map(c => c.trim() === 'aos_01' ? 'aos01' : c.trim());
        for (const lic_code of licCodes) {
            logInfo('Runout Alert', `[${lic_code}] กำลังตรวจสอบ...`);
            await lowStockAlertController.processLowStockAlerts(lic_code);
        }

    } catch (error) {
        logError('Runout Alert', 'Run Out Service Error (executeLoop)', error);
    }
};

/**
 * เริ่มต้นระบบ Background Loop (รันทุกๆ 1 นาที)
 */
exports.startLowStockLoop = async () => {
    console.log(`\x1b[33m\x1b[1m`);
    console.log(`====================================================================`);
    console.log(`  [AOS SYSTEM] STARTING RUN OUT SCHEDULER SERVICE`);
    console.log(`====================================================================`);
    console.log(`  รอบการสแกน   : ทุก ๆ 1 นาที`);
    console.log(`  เวลาตัดรอบ    : อ้างอิงตาม Sales Org`);
    console.log(`  สถานะบริการ   : เปิดใช้งาน (กำลังตรวจสอบสต็อกน้ำมันใกล้หมด...)`);
    console.log(`====================================================================\x1b[0m`);

    // หน่วงเวลาเริ่มต้น 10 วินาที
    await sleep(10000);

    while (true) {
        await executeLoop();
        // await sleep(5000); // Test รันทุกๆ 5 วินาที
        await sleep(60000); // Production รันทุกๆ 1 นาที
    }
};
