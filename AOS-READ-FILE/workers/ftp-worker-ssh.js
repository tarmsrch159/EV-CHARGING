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

        // สร้างวันที่ YYYY-MM-DD รอไว้เลย (เช่น 2026-03-06)
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const dateFolderName = `${year}-${month}-${day}`;

        // ===== 1. OMI =====
        {
            const subFolder = 'OMI/OMI';
            const subTarget = 'OMI';
            let sourceFolder = `${baseSourceFolder}/${subFolder}`;
            const targetArchiveFolder = `${baseArchiveFolder}/${dateFolderName}/${subTarget}`;

            console.log(`\n=================================================`);
            console.log(`📂 [OMI] กำลังเข้าตรวจสอบโฟลเดอร์: ${sourceFolder}`);
            const exists = await client.exists(targetArchiveFolder);
            if (!exists) {
                await client.mkdir(targetArchiveFolder, true);
            }

            const existsSub = await client.exists(sourceFolder);
            if (!existsSub) {
                sourceFolder = `${baseSourceFolder}/${subTarget}`;
            }

            //Function สำหรับย้ายไฟล์, อ่านไฟล์ และ insert ลง DB
            await processFilesInFolder(client, sourceFolder, targetArchiveFolder, parseAndInsertOMI);
        }

        // ===== 2. EODmeter =====
        {
            const subFolder = 'EODmeter';
            const sourceFolder = `${baseSourceFolder}/${subFolder}`;
            const targetArchiveFolder = `${baseArchiveFolder}/${dateFolderName}/${subFolder}`;

            console.log(`\n=================================================`);
            console.log(`📂 [EODMETER] กำลังเข้าตรวจสอบโฟลเดอร์: ${sourceFolder}`);
            const exists = await client.exists(targetArchiveFolder);
            if (!exists) {
                await client.mkdir(targetArchiveFolder, true);
            }
            await processFilesInFolder(client, sourceFolder, targetArchiveFolder, parseAndInsertEODMETER);
        }

        // ===== 3. EODTank (มี subfolder YYYYMM ข้างใน ต้องวนอ่าน recursive) =====
        {
            const subFolder = 'EODTank';
            const sourceFolder = `${baseSourceFolder}/${subFolder}`;

            console.log(`\n=================================================`);
            console.log(`📂 [EODTANK] กำลังเข้าตรวจสอบโฟลเดอร์: ${sourceFolder}`);

            const subFolderList = await client.list(sourceFolder);
            const subDirs = subFolderList.filter(f => f.type === 'd');

            console.log(`>> เจอ subfolder ทั้งหมด: ${subDirs.length} โฟลเดอร์`);
            if (subDirs.length > 0) {
                console.log(`>> รายชื่อ subfolder:`, subDirs.map(f => f.name));
            }

            // กรณีมี Subfolder อยู่ข้างใน ให้เข้าไปอ่านไฟล์ใน Subfolder
            for (const dir of subDirs) {
                const innerSourceFolder = `${sourceFolder}/${dir.name}`;
                const innerArchiveFolder = `${baseArchiveFolder}/${dateFolderName}/${subFolder}/${dir.name}`;

                console.log(`\n   📁 เข้า subfolder: ${innerSourceFolder}`);
                const exists = await client.exists(innerArchiveFolder);
                if (!exists) {
                    await client.mkdir(innerArchiveFolder, true);
                }
                await processFilesInFolder(client, innerSourceFolder, innerArchiveFolder, parseAndInsertEODTANK);
            }

            // กรณีมีไฟล์ตรงๆ ใน EODTank (ไม่อยู่ใน subfolder)
            const directFiles = subFolderList.filter(f => f.type === '-' && f.name.toLowerCase().endsWith('.csv'));
            if (directFiles.length > 0) {
                const targetArchiveFolder = `${baseArchiveFolder}/${dateFolderName}/${subFolder}`;
                console.log(`\n   📁 มีไฟล์ตรงใน ${sourceFolder} อีก ${directFiles.length} ไฟล์`);
                const exists = await client.exists(targetArchiveFolder);
                if (!exists) {
                    await client.mkdir(targetArchiveFolder, true);
                }
                await processFilesInFolder(client, sourceFolder, targetArchiveFolder, parseAndInsertEODTANK);
            }
        }

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
        let ftpConfigs = [];
        try {
            const result = await pool.query(`
                SELECT * FROM tbl_connection_configs
                WHERE config_flag = '1' AND config_type = 'sftp'
            `);
            ftpConfigs = result.rows;
        } catch (err) {
            console.error("❌ ไม่สามารถดึงข้อมูล Config จาก Database ได้:", err.message);
            return;
        }
        if (ftpConfigs.length === 0) {
            console.log(">> ⚠️ ไม่พบ SFTP Host ที่เปิดใช้งาน ข้ามการทำงานรอบนี้");
            return;
        }
        console.log(`>> พบ SFTP Hosts: ${ftpConfigs.length} แหล่ง`);
        for (const config of ftpConfigs) {
            await processOneConfig(config);
        }
    }

    console.log("เริ่มต้น Service Background Process (SFTP)...");
    cron.schedule('0 * * * *', () => { processFTPFiles(); });
    processFTPFiles();
}