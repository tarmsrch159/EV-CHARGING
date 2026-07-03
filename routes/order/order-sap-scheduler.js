const cron = require('node-cron');
const moment = require('moment');
const orderController = require('./order');

// เรียกประมวลผลดึงข้อมูล Order จาก SAP สำหรับ lic_code ที่กำหนด
exports.runSapSyncForLicense = async (lic_code) => {
    console.log(`[AOS SAP Schedular] [${lic_code}] เริ่มการทำงานดึงข้อมูล Order จาก SAP`);

    const req = {
        header: (name) => {
            if (name === "lic_code") return lic_code;
            return "";
        },
        body: [
            {
                SOInputParameter: {
                    SalesOrderList: [],
                    action: [{ id: "system_cron", value: "SYSTEM" }]
                }
            }
        ]
    };

    const res = {
        status: function (statusCode) {
            this.statusCode = statusCode;
            return this;
        },
        send: function (data) {
            // console.log(`[AOS SAP Schedular] [${lic_code}] ผลลัพธ์การดึงข้อมูล Order จาก SAP:`, JSON.stringify(data));
            // console.log(`[AOS SAP Schedular] [${lic_code}] ผลลัพธ์การดึงข้อมูล Order จาก SAP:`, JSON.stringify(data));
        }
    };

    try {
        await orderController.getOrderSapSchedule(req, res, () => { });
    } catch (err) {
        console.error(`[AOS SAP Schedular] [${lic_code}] เกิดข้อผิดพลาดในการดึงข้อมูล Order จาก SAP:`, err);
    }
};

// รันทุกวันตามเวลาที่กำหนด [Default 18:00]
exports.startOrderSapScheduler = () => {
    // .env time
    const time = process.env.AOS_SAP_SCHEDULAR || "18:00";
    const [hour, minute] = time.toString().split(':');
    const cronExpression = `${parseInt(minute)} ${parseInt(hour)} * * *`;
    console.log(`[AOS SAP Schedular] : ระบบจะดึงข้อมูลออเดอร์ SAP ทุกวันเวลา ${time} น.`);
    cron.schedule(cronExpression, async () => {
        console.log(`[AOS SAP Schedular] เริ่มทำงานดึงข้อมูล SAP ประจำวัน (${time})`);
        try {
            // .env license code
            const defaultLicCodes = process.env.IS_PROD === 'true' ? ['aos_qa'] : ['aos01'];
            // clean license code
            const licCodes = (process.env.LIC_CODES ? process.env.LIC_CODES.split(',') : defaultLicCodes).map(c => c.trim() === 'aos_01' ? 'aos01' : c.trim());
            console.log(`[AOS SAP Schedular] licCodes:`, licCodes);
            for (const lic_code of licCodes) {
                // เรียก function การดึงข้อมูล SAP
                await exports.runSapSyncForLicense(lic_code);
            }
        } catch (error) {
            console.error(`[AOS SAP Schedular] เกิดข้อผิดพลาดในระบบตั้งเวลา SAP:`, error);
        }
        console.log(`[AOS SAP Schedular] จบการทำงานดึงข้อมูล SAP ประจำวัน (${time})`);
    }, {
        scheduled: true,
        timezone: "Asia/Bangkok"
    });
};
