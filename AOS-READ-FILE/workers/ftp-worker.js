const cron = require('node-cron');
const pool = require('../db');

// Import processOneConfig จากแต่ละ worker
const { processOneConfig: processFTP } = require('./ftp-worker-basic');
const { processOneConfig: processSFTP } = require('./ftp-worker-ssh');

// ============================================================
// รับ argument จาก command line เพื่อ filter config_type
// ============================================================
const arg = process.argv[2] || 'all';

const TYPE_MAP = {
    'ftp': ['ftp'],
    'sftp': ['sftp'],
    'all': ['ftp', 'sftp']
};
// ===== Test Local =====
// const TYPE_MAP = {
//     'ftp': ['ftp'],
//     'sftp': ['sftp', 'sftp-local'],
//     'all': ['ftp', 'sftp', 'sftp-local']
// };

const selectedTypes = TYPE_MAP[arg.toLowerCase()];
if (!selectedTypes) {
    console.error(`❌ ไม่รู้จัก argument: "${arg}"`);
    console.log(`   ใช้ได้: npm start, npm start ftp, npm start sftp`);
    process.exit(1);
}

// ============================================================
// ฟังก์ชันหลัก: ดึง config ตาม type ที่เลือก แล้ว switch
// ============================================================
async function processAllFiles() {
    const modeLabel = arg === 'all' ? 'FTP/SFTP' : arg.toUpperCase();
    console.log(`\n[${new Date().toLocaleString()}] เริ่มต้นกระบวนการตรวจสอบ (${modeLabel})...`);

    let allConfigs = [];

    try {
        // สร้าง placeholders สำหรับ IN clause ($1, $2, ...)
        const placeholders = selectedTypes.map((_, i) => `$${i + 1}`).join(', ');
        const result = await pool.query(`
            SELECT * FROM tbl_connection_configs
            WHERE config_flag = '1' AND config_type IN (${placeholders})
        `, selectedTypes);

        allConfigs = result.rows;

    } catch (err) {
        console.error("❌ ไม่สามารถดึงข้อมูล Config จาก Database ได้:", err.message);
        return;
    }

    if (allConfigs.length === 0) {
        console.log(`>> ⚠️ ไม่พบ Host ที่เปิดใช้งาน (type: ${selectedTypes.join(', ')}) ข้ามการทำงานรอบนี้`);
        return;
    }

    // สรุปจำนวน config แต่ละประเภท
    const ftpCount = allConfigs.filter(c => c.config_type === 'ftp').length;
    const sftpCount = allConfigs.filter(c => c.config_type === 'sftp' || c.config_type === 'sftp-local').length;
    console.log(`>> พบทั้งหมด: ${allConfigs.length} แหล่ง (FTP: ${ftpCount}, SFTP: ${sftpCount})`);

    // วน config ทีละตัว → switch ไปเรียก worker ตามที่กำหนด
    for (const config of allConfigs) {
        switch (config.config_type) {
            case 'ftp':
                console.log(`\n[${config.config_name}] → ใช้ Basic FTP`);
                await processFTP(config);
                break;

            case 'sftp':
                console.log(`\n[${config.config_name}] → ใช้ SFTP`);
                await processSFTP(config);
                break;

            default:
                console.log(`\n⚠️ [${config.config_name}] → ไม่รู้จัก config_type: "${config.config_type}" (ข้าม)`);
                break;
        }
    }

    console.log(`\n[${new Date().toLocaleString()}] จบกระบวนการทั้งหมด`);
}

// ============================================================
// Cron Job
// ============================================================
console.log(`เริ่มต้น Service Background Process (mode: ${arg})...`);

// ทำงานทุกๆ 1 ชั่วโมง
cron.schedule('0 * * * *', () => {
    processAllFiles();
});

// รันทันที 1 ครั้งตอนเปิดโปรแกรม
processAllFiles();
