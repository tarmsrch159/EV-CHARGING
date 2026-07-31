const cron = require('node-cron');
const ftp = require('basic-ftp');
const fs = require('fs');
const pool = require('./db');
const appConfig = require('../config.json');


// ============================================================
// Helper: แปลงวันที่จาก DD/MM/YYYY → YYYY-MM-DD
// ============================================================
function convertDateDMY(dateStr) {
    const parts = dateStr.split('/');
    if (parts.length !== 3) return dateStr;
    const [dd, mm, yyyy] = parts;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

// ============================================================
// Parser + Insert: OMI
// CSV columns (7): ShiptoNo, TankNo, ProductNo, PDName, Price, MeterLiteStart, MeterLiteEnd
// BuyDateTime ถอดจากชื่อไฟล์: YYYYMMDD#HHmm → YYYY-MM-DD HH:mm:00
// ============================================================
async function parseAndInsertOMI(fileContent, fileName) {
    // ถอด BuyDateTime จากชื่อไฟล์ เช่น 20260220#0125OMI5.CSV
    const rawDate = fileName.substring(0, 8);
    const rawTime = fileName.substring(9, 13);
    const fYear = rawDate.substring(0, 4);
    const fMonth = rawDate.substring(4, 6);
    const fDay = rawDate.substring(6, 8);
    const fHour = rawTime.substring(0, 2);
    const fMinute = rawTime.substring(2, 4);
    const buyDateTime = `${fYear}-${fMonth}-${fDay} ${fHour}:${fMinute}:00`;

    const lines = fileContent.split('\n');
    let insertedCount = 0;

    for (const line of lines) {
        const trimmed = line.trim().replace(/\r$/, '');
        if (trimmed === '') continue;

        const cols = trimmed.split(',');
        if (cols.length < 7) {
            console.log(`   ⚠️ OMI: ข้ามบรรทัดที่คอลัมน์ไม่ครบ (${cols.length} cols): ${trimmed}`);
            continue;
        }

        const [shiptoNo, tankNo, productNo, pdName, price, meterLiteStart, meterLiteEnd] = cols;

        const query = `
            INSERT INTO tbl_order_omi (ShiptoNo, BuyDateTime, TankNo, ProductNo, PDName, Price, MeterLiteStart, MeterLiteEnd)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;
        const values = [
            shiptoNo.trim(),
            buyDateTime,
            parseInt(tankNo),
            parseInt(productNo),
            pdName.trim(),
            parseFloat(price),
            parseFloat(meterLiteStart),
            parseFloat(meterLiteEnd)
        ];

        await pool.query(query, values);
        insertedCount++;
    }

    console.log(`   ✅ OMI: Insert สำเร็จ ${insertedCount} แถว (BuyDateTime: ${buyDateTime})`);
}

// ============================================================
// Parser + Insert: EODMETER
// CSV columns (15): ใช้แค่ 11 คอลัมน์แรก
//   ShiptoNo, BuyDate(DD/MM/YYYY), WorkNo, WorkPay, MeterNo, TankNo,
//   ProductNo, PDName, Price, MeterLiteStart, MeterLiteEnd, [skip 4 cols]
// ============================================================
async function parseAndInsertEODMETER(fileContent, fileName) {
    const lines = fileContent.split('\n');
    let insertedCount = 0;

    for (const line of lines) {
        const trimmed = line.trim().replace(/\r$/, '');
        if (trimmed === '') continue;

        const cols = trimmed.split(',');
        if (cols.length < 11) {
            console.log(`   ⚠️ EODMETER: ข้ามบรรทัดที่คอลัมน์ไม่ครบ (${cols.length} cols): ${trimmed}`);
            continue;
        }

        // ใช้แค่ 11 คอลัมน์แรก (col 12-15 ไม่ insert)
        const shiptoNo = cols[0].trim();
        const buyDate = convertDateDMY(cols[1].trim());    // DD/MM/YYYY → YYYY-MM-DD
        const workNo = parseInt(cols[2]);
        const workPay = parseInt(cols[3]);
        const meterNo = parseInt(cols[4]);
        const tankNo = parseInt(cols[5]);
        const productNo = parseInt(cols[6]);
        const pdName = cols[7].trim();
        const price = parseFloat(cols[8]);
        const meterLiteStart = parseFloat(cols[9]);
        const meterLiteEnd = parseFloat(cols[10]);

        const query = `
            INSERT INTO EODMETER (ShiptoNo, BuyDate, WorkNo, WorkPay, MeterNo, TankNo, ProductNo, PDName, Price, MeterLiteStart, MeterLiteEnd)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `;
        const values = [
            shiptoNo, buyDate, workNo, workPay, meterNo,
            tankNo, productNo, pdName, price, meterLiteStart, meterLiteEnd
        ];

        await pool.query(query, values);
        insertedCount++;
    }

    console.log(`   ✅ EODMETER: Insert สำเร็จ ${insertedCount} แถว (ไฟล์: ${fileName})`);
}

// ============================================================
// Parser + Insert: EODTANK
// CSV columns (9):
//   ShipToNo, DateTime(DD/MM/YYYY), TankNo, ProductNo, PDName,
//   CheckTankStart, CheckTankEnd, ReciveVal, CloseDate(DD/MM/YYYY)
// ============================================================
async function parseAndInsertEODTANK(fileContent, fileName) {
    const lines = fileContent.split('\n');
    let insertedCount = 0;

    for (const line of lines) {
        const trimmed = line.trim().replace(/\r$/, '');
        if (trimmed === '') continue;

        const cols = trimmed.split(',');
        if (cols.length < 9) {
            console.log(`   ⚠️ EODTANK: ข้ามบรรทัดที่คอลัมน์ไม่ครบ (${cols.length} cols): ${trimmed}`);
            continue;
        }

        const shipToNo = cols[0].trim();
        const dateTime = convertDateDMY(cols[1].trim());     // DD/MM/YYYY → YYYY-MM-DD
        const tankNo = parseInt(cols[2]);
        const productNo = parseInt(cols[3]);
        const pdName = cols[4].trim();
        const checkTankStart = parseFloat(cols[5]);
        const checkTankEnd = parseFloat(cols[6]);
        const reciveVal = parseFloat(cols[7]);
        const closeDate = convertDateDMY(cols[8].trim());    // DD/MM/YYYY → YYYY-MM-DD

        const query = `
            INSERT INTO EODTANK (ShipToNo, DateTime, TankNo, ProductNo, PDName, CheckTankStart, CheckTankEnd, ReciveVal, CloseDate)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;
        const values = [
            shipToNo, dateTime, tankNo, productNo, pdName,
            checkTankStart, checkTankEnd, reciveVal, closeDate
        ];

        await pool.query(query, values);
        insertedCount++;
    }

    console.log(`   ✅ EODTANK: Insert สำเร็จ ${insertedCount} แถว (ไฟล์: ${fileName})`);
}

// ============================================================
// ฟังก์ชันประมวลผลไฟล์ในโฟลเดอร์ (ใช้แยกเพื่อรองรับ recursive subfolder)
// ============================================================
async function processFilesInFolder(client, sourceFolder, targetArchiveFolder, parserFn) {
    const fileList = await client.list(sourceFolder);
    const files = fileList.filter(f => f.type === 1 || f.isDirectory === false);

    files.sort((a, b) => {
        const timeA = a.modifiedAt ? new Date(a.modifiedAt).getTime() : 0;
        const timeB = b.modifiedAt ? new Date(b.modifiedAt).getTime() : 0;
        return timeA - timeB; // น้อยไปมาก (Oldest to Newest)
    });

    console.log(`>> เจอไฟล์ทั้งหมด: ${files.length} ไฟล์`);
    if (files.length === 0) {
        console.log(`>> ไม่มีไฟล์ใหม่ในโฟลเดอร์นี้`);
        return;
    }

    console.log(`>> รายชื่อไฟล์:`, files.map(f => f.name));

    for (const file of files) {
        console.log(`กำลังประมวลผลไฟล์: ${file.name} (ขนาด: ${file.size} bytes)`);

        const localFilePath = `./temp_${file.name}`;
        const sourceFilePath = `${sourceFolder}/${file.name}`;
        const targetFilePath = `${targetArchiveFolder}/${file.name}`;

        // A. ดาวน์โหลดไฟล์มาไว้ที่เครื่อง Node ก่อน
        console.log(`-> กำลังดาวน์โหลดไฟล์มาที่ ${localFilePath}...`);
        await client.downloadTo(localFilePath, sourceFilePath);
        console.log(`-> ดาวน์โหลดเสร็จสิ้น`);

        // B. อ่านไฟล์และ Insert ลง DB
        const fileContent = fs.readFileSync(localFilePath, 'utf8');
        console.log(`-> อ่านข้อมูลสำเร็จ (ยาว ${fileContent.length} ตัวอักษร)`);

        try {
            await parserFn(fileContent, file.name);
        } catch (dbErr) {
            console.error(`   ❌ Insert DB ล้มเหลว (${file.name}): ${dbErr.message}`);
        }

        // C. ทำการ "Duplicate" โดยการอัปโหลดไฟล์จากเครื่องเรา ไปที่ Backup Folder
        console.log(`-> กำลัง Copy (Upload) ไฟล์ไปที่ Backup Folder...`);
        try {
            // **จุดที่ต้องแก้**: ขึ้นอยู่กับ Library FTP ที่คุณใช้
            // 1. ถ้าใช้ไลบรารี 'basic-ftp' จะใช้คำสั่ง:
            await client.uploadFrom(localFilePath, targetFilePath);

            // 2. ถ้าใช้ไลบรารี 'ssh2-sftp-client' (SFTP) จะใช้คำสั่ง:
            // await client.put(localFilePath, targetFilePath);

            console.log(`-> Copy ไฟล์สำเร็จ: ${targetFilePath}`);
        } catch (copyErr) {
            console.error(`-> Copy ไฟล์ไม่สำเร็จ: ${copyErr.message}`);
        }

        // D. ลบไฟล์ชั่วคราวในเครื่อง Node ทิ้ง (ย้ายลงมาทำขั้นตอนสุดท้าย)
        fs.unlinkSync(localFilePath);
        console.log(`-> ลบไฟล์ temp ในเครื่องทิ้งเรียบร้อย`);

        // สังเกตว่าเราตัดคำสั่ง client.rename และ client.remove ทิ้งไปเลย 
        // ทำให้ไฟล์ต้นฉบับจะยังคงอยู่ใน sourceFolder เหมือนเดิมครับ

        console.log(`--------------------------------------------`);

        // // C. ลบไฟล์ชั่วคราวในเครื่อง Node ทิ้ง
        // fs.unlinkSync(localFilePath);
        // console.log(`-> ลบไฟล์ temp ในเครื่องทิ้งเรียบร้อย`);

        // // D. ย้ายไฟล์ไปที่โฟลเดอร์ Backup
        // const sourceFilePath = `${sourceFolder}/${file.name}`;
        // const targetFilePath = `${targetArchiveFolder}/${file.name}`;

        // console.log(`-> กำลังย้ายไฟล์บน FTP ไปที่ Backup Folder...`);
        // try {
        //     await client.rename(sourceFilePath, targetFilePath);
        //     console.log(`-> ย้ายไฟล์สำเร็จ: ${targetFilePath}`);

        //     try {
        //         await client.remove(sourceFilePath);
        //     } catch (removeErr) {
        //         if (removeErr.code !== 550) {
        //             console.log(`(แจ้งเตือน): ${removeErr.message}`);
        //         }
        //     }
        // } catch (renameErr) {
        //     console.error(`-> ย้ายไฟล์ไม่สำเร็จ: ${renameErr.message}`);
        // }
        // console.log(`--------------------------------------------`);
    }
}

// ============================================================
// ฟังก์ชันหลัก: เชื่อมต่อ FTP และประมวลผลทุกโฟลเดอร์
// ============================================================
async function processFTPFiles() {
    console.log(`\n[${new Date().toLocaleString()}] เริ่มต้นกระบวนการตรวจสอบ FTP...`);

    let ftpConfigs = [];

    try {
        // 1. คิวรีเอาเฉพาะที่เปิดใช้งาน และเป็นประเภท 'filezilla' เท่านั้น
        const result = await pool.query(`
            SELECT * FROM tbl_connection_configs 
            WHERE config_flag = '1' AND config_type = 'filezilla'
        `);
        ftpConfigs = result.rows;

    } catch (err) {
        console.error("❌ ไม่สามารถดึงข้อมูล Config จาก Database ได้:", err.message);
        return;
    }

    if (ftpConfigs.length === 0) {
        console.log(">> ⚠️ ไม่พบ FTP Host ที่เปิดใช้งานในระบบ ข้ามการทำงานรอบนี้");
        return;
    }

    console.log(`>> พบ FTP Hosts ที่ต้องประมวลผลทั้งหมด: ${ftpConfigs.length} แหล่ง`);

    console.log(`[${new Date().toLocaleString()}] เริ่มต้นการตรวจสอบไฟล์บน FTP...`);

    for (const ftpConfig of ftpConfigs) {
        console.log(`\n=================================================`);
        console.log(`🚀 กำลังเริ่มงานของ: ${ftpConfig.config_name} (${ftpConfig.host_address})`);

        const client = new ftp.Client();
        client.ftp.verbose = false;

        try {
            await client.access({
                host: ftpConfig.host_address,
                user: ftpConfig.username,
                password: ftpConfig.password,
                port: ftpConfig.port,
                secure: false
            });

            console.log(`✅ เชื่อมต่อ ${ftpConfig.config_name} สำเร็จ!`);

            const env = appConfig.environment || 'test';
            const { baseSourceFolder, baseArchiveFolder } = appConfig[env];

            // สร้างวันที่ YYYY-MM-DD รอไว้เลย (เช่น 2026-03-06)
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const dateFolderName = `${year}-${month}-${day}`;

            // ===== 1. OMI/OMI =====
            {
                const subFolder = 'OMI/OMI';
                const sourceFolder = `${baseSourceFolder}/${subFolder}`;
                const targetArchiveFolder = `${baseArchiveFolder}/${dateFolderName}/${subFolder}`;

                console.log(`\n=================================================`);
                console.log(`📂 [OMI] กำลังเข้าตรวจสอบโฟลเดอร์: ${sourceFolder}`);
                await client.ensureDir(targetArchiveFolder);
                await processFilesInFolder(client, sourceFolder, targetArchiveFolder, parseAndInsertOMI);
            }

            // ===== 2. EODmeter =====
            {
                const subFolder = 'EODmeter';
                const sourceFolder = `${baseSourceFolder}/${subFolder}`;
                const targetArchiveFolder = `${baseArchiveFolder}/${dateFolderName}/${subFolder}`;

                console.log(`\n=================================================`);
                console.log(`📂 [EODMETER] กำลังเข้าตรวจสอบโฟลเดอร์: ${sourceFolder}`);
                await client.ensureDir(targetArchiveFolder);
                await processFilesInFolder(client, sourceFolder, targetArchiveFolder, parseAndInsertEODMETER);
            }

            // ===== 3. EODTank (มี subfolder YYYYMM ข้างใน ต้องวนอ่าน recursive) =====
            {
                const subFolder = 'EODTank';
                const sourceFolder = `${baseSourceFolder}/${subFolder}`;

                console.log(`\n=================================================`);
                console.log(`📂 [EODTANK] กำลังเข้าตรวจสอบโฟลเดอร์: ${sourceFolder}`);

                // List สิ่งที่อยู่ใน EODTank → จะเจอ subfolder เช่น 202603/
                const subFolderList = await client.list(sourceFolder);
                const subDirs = subFolderList.filter(f => f.type === 2 || f.isDirectory === true);

                console.log(`>> เจอ subfolder ทั้งหมด: ${subDirs.length} โฟลเดอร์`);
                if (subDirs.length > 0) {
                    console.log(`>> รายชื่อ subfolder:`, subDirs.map(f => f.name));
                }

                for (const dir of subDirs) {
                    const innerSourceFolder = `${sourceFolder}/${dir.name}`;
                    const innerArchiveFolder = `${baseArchiveFolder}/${dateFolderName}/${subFolder}/${dir.name}`;

                    console.log(`\n   📁 เข้า subfolder: ${innerSourceFolder}`);
                    await client.ensureDir(innerArchiveFolder);
                    await processFilesInFolder(client, innerSourceFolder, innerArchiveFolder, parseAndInsertEODTANK);
                }

                // กรณีมีไฟล์ตรงๆ ใน EODTank (ไม่อยู่ใน subfolder)
                const directFiles = subFolderList.filter(f => f.type === 1 || f.isDirectory === false);
                if (directFiles.length > 0) {
                    const targetArchiveFolder = `${baseArchiveFolder}/${dateFolderName}/${subFolder}`;
                    console.log(`\n   📁 มีไฟล์ตรงใน ${sourceFolder} อีก ${directFiles.length} ไฟล์`);
                    await client.ensureDir(targetArchiveFolder);
                    await processFilesInFolder(client, sourceFolder, targetArchiveFolder, parseAndInsertEODTANK);
                }
            }

        } catch (err) {
            console.error("เกิดข้อผิดพลาดในการประมวลผล FTP:", err);
        } finally {
            client.close();
            console.log(`[${new Date().toLocaleString()}] จบการทำงานรอบนี้\n`);
        }
    }

}

// 3. ตั้งเวลาการทำงาน (Cron Job)
// ตัวอย่าง: ทำงานทุกๆ 5 นาที ('*/5 * * * *')
// ถ้าอยากให้ทำทุกๆ 1 นาที ใช้ ('* * * * *')
console.log("เริ่มต้น Service Background Process...");

// cron.schedule('* * * * *', () => {
//     processFTPFiles();
// });

cron.schedule('*/5 * * * *', () => {
    processFTPFiles();
});
// ลองรันทันที 1 ครั้งตอนเปิดโปรแกรม
processFTPFiles();