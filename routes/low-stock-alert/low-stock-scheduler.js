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
        const lic_code = "aos01";
        const dbName = config.dbPrefix() + lic_code;
        const currentTime = moment();
        const currentHHmm = currentTime.format('HH:mm');

        console.log(`\n[${currentTime.format('HH:mm:ss')}] 🔋 Low Stock Alert: เริ่มต้นรอบการทำงาน...`);

        // ดึงรายการ office เฉพาะที่มีการเชื่อมโยงกับปั๊มที่เปิดใช้งานอยู่ในระบบ เพื่อตรวจสอบเวลา Cut-off
        const sql = `
            SELECT DISTINCT o.off_code, o.order_cutoff_time 
            FROM tbl_office o
            INNER JOIN tbl_petrol p ON o.off_code = p.off_code
            WHERE o.off_flag = '1' AND o.rm_dt IS NULL AND o.order_cutoff_time IS NOT NULL
              AND p.ptrl_flag = '1' AND p.rm_dt IS NULL
        `;
        const result = await pgConn.get(dbName, sql, config.connectionString());

        // ============ ใช้การตั้งค่าเวลาจาก ฐานข้อมูล ==============
        if (!result.code && result.data && result.data.length > 0) {
            for (const office of result.data) {
                if (office.order_cutoff_time) {
                    // แปลง order_cutoff_time เป็น "HH:mm" เพื่อตรวจสอบกับเวลาปัจจุบัน
                    const cutoffHHmm = moment(office.order_cutoff_time, 'HH:mm:ss').format('HH:mm');

                    if (currentHHmm === cutoffHHmm) {
                        console.log(`⏰ [Low Stock Scheduler] ตรวจพบเวลา Cut-off ของ Office: ${office.off_code} (${cutoffHHmm}) ตรงกับเวลาปัจจุบัน: เริ่มประมวลผลการแจ้งเตือน...`);
                        await lowStockAlertController.processLowStockAlerts(lic_code, office.off_code);
                    }
                }
            }
        }

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
        // await sleep(5000); // Test รันทุกๆ 5 วินาที
        await sleep(60000); // Production รันทุกๆ 1 นาที
    }
};
