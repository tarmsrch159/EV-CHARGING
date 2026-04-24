const moment = require('moment');
const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const lowStockAlertController = require('./low-stock-alert');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * ดึงลิสต์ของ License (บริษัท) ที่เปิดใช้งาน
 */
const getActiveLicenses = async () => {
    try {
        const scriptSql = `SELECT lic_code FROM tbl_company_licence WHERE lic_status = 'active'`;
        const result = await pgConn.getWithParams('ptms_licence', scriptSql, [], config.connectionString());
        return result.data || [];
    } catch (err) {
        console.error('❌ [Low Stock Scheduler] getActiveLicenses Error:', err.message);
        return [];
    }
};

/**
 * ฟังก์ชันหลักในการรัน Loop
 */
const executeLoop = async () => {
    try {
        const currentTime = moment();
        console.log(`\n[${currentTime.format('HH:mm:ss')}] 🔋 Low Stock Alert: เริ่มต้นรอบการทำงาน...`);
        
        const licenses = await getActiveLicenses();

        if (licenses.length > 0) {
            for (const lic of licenses) {
                // เรียกใช้ Controller เพื่อตรวจสอบเงื่อนไขและส่งเมล
                await lowStockAlertController.processLowStockAlerts(lic.lic_code);
            }
        } else {
            console.log('   ⚪ ไม่พบ License ที่ Active ในระบบ');
        }

    } catch (error) {
        console.error('❌ [Low Stock Scheduler] executeLoop Error:', error);
    }
};

/**
 * เริ่มต้นระบบ Background Loop (รันทุกๆ 1 นาที)
 */
exports.startLowStockLoop = async () => {
    console.log('🚀 [Low Stock Scheduler] ระบบตรวจสอบสต็อกน้ำมันเริ่มทำงานแล้ว (Interval: 1 min)');

    // หน่วงเวลาเริ่มต้น 10 วินาที
    await sleep(10000);

    while (true) {
        await executeLoop();
        await sleep(60000);
    }
};
