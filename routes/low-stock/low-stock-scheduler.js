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

        console.log(`\n[${currentTime.format('HH:mm:ss')}] 🔋 Run Out Alert: เริ่มต้นรอบการทำงาน...`);

        // ดึงรายการตั้งค่าราย Sales Org / Order Type เพื่อตรวจสอบเวลา Cut-off
        const sql = `
            SELECT sales_org_code, order_type_code, order_cutoff_time 
            FROM tbl_sales_org_order_config
            WHERE cutoff_status = 1 AND sales_org_flag = 1 AND rm_dt IS NULL AND order_cutoff_time IS NOT NULL
        `;
        const result = await pgConn.get(dbName, sql, config.connectionString());

        // ============ ใช้การตั้งค่าเวลาจากตารางใหม่ (Organizational Config) ==============
        if (!result.code && result.data && result.data.length > 0) {
            for (const item of result.data) {
                if (item.order_cutoff_time) {
                    // แปลง order_cutoff_time เป็น "HH:mm" เพื่อตรวจสอบกับเวลาปัจจุบัน
                    const cutoffHHmm = moment(item.order_cutoff_time, 'HH:mm:ss').format('HH:mm');

                    if (currentHHmm === cutoffHHmm) {
                        console.log(`⏰ [Run Out Scheduler] ตรวจพบเวลา Cut-off ของ Org: ${item.sales_org_code} | Type: ${item.order_type_code} (${cutoffHHmm}) ตรงกับเวลาปัจจุบัน: เริ่มประมวลผล...`);
                        await lowStockAlertController.processLowStockAlerts(lic_code, item.sales_org_code, item.order_type_code);
                    }
                }
            }
        }

    } catch (error) {
        console.error('❌ [Run Out Service Error] (executeLoop):', error);
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
