const cron = require('node-cron');
const SftpClient = require('ssh2-sftp-client');
const pool = require('../db');
const appConfig = require('../config.json');

// Helpers
const { processFilesInFolder } = require('./helpers/file-processor');

// Parsers
const { parseAndInsertOMI } = require('./parsers/omi-parser');
const { parseAndInsertEODMETER } = require('./parsers/eodmeter-parser');
const { parseAndInsertEODTANK } = require('./parsers/eodtank-parser');

// ============================================================
// ประมวลผล 1 config (ถูกเรียกจาก ftp-worker.js หรือรันตรง)
// ============================================================
async function processOneConfig(ftpConfig) {
    console.log(`\n=================================================`);
    console.log(`🚀 [SFTP] กำลังเริ่มงานของ: ${ftpConfig.config_name} (${ftpConfig.host_address})`);

    const client = new SftpClient();

    try {
        await client.connect({
            host: ftpConfig.host_address,
            username: ftpConfig.username,
            password: ftpConfig.password,
            port: ftpConfig.port
        });

        console.log(`✅ เชื่อมต่อ ${ftpConfig.config_name} สำเร็จ! (SFTP)`);

        const env = appConfig.environment || 'test';
        const { baseSourceFolder, baseArchiveFolder } = appConfig[env];

        // ===== 1. ฟังก์ชันทำงาน OMI =====
        const processOMI = async () => {
            const subFolder = 'OMI/OMI';
            const subTarget = 'OMI';
            let sourceFolder = `${baseSourceFolder}/${subFolder}`;

            // ===== เป็นฟังก์ชันไว้สร้าง path ตามวันที่ของ Files =====
            const buildArchiveFolder = (dateStr) => `${baseArchiveFolder}/${dateStr}/${subTarget}`;

            const existsSub = await client.exists(sourceFolder);
            if (!existsSub) {
                sourceFolder = `${baseSourceFolder}/${subTarget}`;
            }

            // ======= Function สำหรับย้ายไฟล์, อ่านไฟล์ และ insert ลง DB =======
            await processFilesInFolder(client, sourceFolder, buildArchiveFolder, parseAndInsertOMI);
        };

        // ===== 2. ฟังก์ชันทำงาน EODmeter =====
        const processEODMeter = async () => {
            const subFolder = 'EODmeter';
            const sourceFolder = `${baseSourceFolder}/${subFolder}`;
            const buildArchiveFolder = (dateStr) => `${baseArchiveFolder}/${dateStr}/${subFolder}`;

            await processFilesInFolder(client, sourceFolder, buildArchiveFolder, parseAndInsertEODMETER);
        };

        // ===== 3. ฟังก์ชันทำงาน EODTank =====
        const processEODTank = async () => {
            const subFolder = 'EODTank';
            const sourceFolder = `${baseSourceFolder}/${subFolder}`;

            const subFolderList = await client.list(sourceFolder);
            const subDirs = subFolderList.filter(f => f.type === 'd');

            // ======= กรณีมี Subfolder อยู่ข้างใน ให้เข้าไปอ่านไฟล์ใน Subfolder =======
            for (const dir of subDirs) {
                const innerSourceFolder = `${sourceFolder}/${dir.name}`;
                const buildInnerArchive = (dateStr) => `${baseArchiveFolder}/${dateStr}/${subFolder}/${dir.name}`;

                await processFilesInFolder(client, innerSourceFolder, buildInnerArchive, parseAndInsertEODTANK);
            }

            // ======= กรณีมีไฟล์ตรงๆ ใน EODTank (ไม่อยู่ใน subfolder) =======
            const directFiles = subFolderList.filter(f => f.type === '-' && f.name.toLowerCase().endsWith('.csv'));
            if (directFiles.length > 0) {
                const buildArchiveFolder = (dateStr) => `${baseArchiveFolder}/${dateStr}/${subFolder}`;
                await processFilesInFolder(client, sourceFolder, buildArchiveFolder, parseAndInsertEODTANK);
            }
        };

        // ======= สั่งให้ทั้ง 3 ฟังก์ชันทำงานแบบขนาน (Parallel) พร้อมกัน! =======
        console.log(`\n⚡ [SFTP] กำลังเริ่มประมวลผล omi, eodmeter, eodtank อ่านไฟล์พร้อมกัน...`);
        await Promise.all([processOMI(), processEODMeter(), processEODTank()]);

    } catch (err) {
        console.error("เกิดข้อผิดพลาดในการประมวลผล SFTP:", err);
    } finally {
        await client.end();
        console.log(`[${new Date().toLocaleString()}] จบการทำงาน SFTP รอบนี้\n`);
    }
}

// Export สำหรับ ftp-worker.js (unified)
module.exports = { processOneConfig };

// ============================================================
// รันตรง (ถ้าสั่ง node ftp-worker-ssh.js โดยตรง)
// ============================================================
if (require.main === module) {
    async function processFTPFiles() {
        console.log(`\n[${new Date().toLocaleString()}] เริ่มต้นกระบวนการตรวจสอบ SFTP...`);
        let sftpConfigs = [];
        try {
            const result = await pool.query(`
                SELECT * FROM tbl_connection_configs
                WHERE config_flag = '1' AND config_type = 'sftp'
            `);

            // กรองเอาตัวที่มีอยู่แล้ว (ถ้ามี)
            sftpConfigs = result.rows;

            // Hardcode Fix: สำหรับ Test บน Mac
            // sftpConfigs.push({
            //     config_type: 'sftp-local',
            //     config_name: 'sftp-local',
            //     host_address: '127.0.0.1',
            //     port: 22,
            //     username: 'tanachai_ho',
            //     password: '123456'
            // });

        } catch (err) {
            console.error("❌ ไม่สามารถดึงข้อมูล Config จาก Database ได้:", err.message);
            return;
        }
        if (sftpConfigs.length === 0) {
            console.log(">> ⚠️ ไม่พบ SFTP Host ที่เปิดใช้งาน ข้ามการทำงานรอบนี้");
            return;
        }
        console.log(`>> พบ SFTP Hosts: ${sftpConfigs.length} แหล่ง`);
        for (const config of sftpConfigs) {
            await processOneConfig(config);
        }
    }

    console.log("เริ่มต้น Service Background Process (SFTP)...");
    cron.schedule('0 * * * *', () => { processFTPFiles(); });
    processFTPFiles();
}