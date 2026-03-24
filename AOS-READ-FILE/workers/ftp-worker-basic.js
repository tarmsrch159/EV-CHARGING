const cron = require('node-cron');
const ftp = require('basic-ftp');
const fs = require('fs');
const pool = require('../db');
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
// Parser + Insert: tbl_order_omi
// CSV columns (7): ShiptoNo, TankNo, ProductNo, PDName, Price, MeterLiteStart, MeterLiteEnd
// buy_at ถอดจากชื่อไฟล์: YYYYMMDD#HHmm → YYYY-MM-DD HH:mm:00
// ============================================================
async function parseAndInsertOMI(fileContent, fileName) {
    // ถอด buy_at จากชื่อไฟล์ เช่น 20260220#0125OMI5.CSV
    const rawDate = fileName.substring(0, 8);
    const rawTime = fileName.substring(9, 13);
    const fYear = rawDate.substring(0, 4);
    const fMonth = rawDate.substring(4, 6);
    const fDay = rawDate.substring(6, 8);
    const fHour = rawTime.substring(0, 2);
    const fMinute = rawTime.substring(2, 4);
    const buyAt = `${fYear}-${fMonth}-${fDay} ${fHour}:${fMinute}:00`;

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

        const [shiptoNo, tankNo, productNo, pdName, price, meterStart, meterEnd] = cols;

        const query = `
            INSERT INTO tbl_order_omi (shipto_no, buy_at, tank_no, product_no, product_name, product_price, meter_start, meter_end)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;
        const values = [
            shiptoNo.trim(),
            buyAt,
            tankNo.trim(),
            productNo.trim(),
            pdName.trim(),
            parseFloat(price),
            parseFloat(meterStart),
            parseFloat(meterEnd)
        ];

        await pool.query(query, values);
        insertedCount++;
    }

    console.log(`   ✅ OMI: Insert สำเร็จ ${insertedCount} แถว (buy_at: ${buyAt})`);
}

// // ============================================================
// // Parser + Insert: tbl_order_eodmeter
// // CSV columns (15): ใช้แค่ 11 คอลัมน์แรก
// //   ShiptoNo, BuyDate(DD/MM/YYYY), WorkNo, WorkPay, MeterNo, TankNo,
// //   ProductNo, PDName, Price, MeterStart, MeterEnd, [skip 4 cols]
// // ============================================================
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
        const workNo = cols[2].trim();
        const workPay = cols[3].trim();
        const meterNo = cols[4].trim();
        const tankNo = cols[5].trim();
        const productNo = cols[6].trim();
        const productName = cols[7].trim();
        const productPrice = parseFloat(cols[8]);
        const meterStart = parseFloat(cols[9]);
        const meterEnd = parseFloat(cols[10]);

        const query = `
            INSERT INTO tbl_order_eodmeter (shipto_no, buy_date, work_no, work_pay, meter_no, tank_no, product_no, product_name, product_price, meter_start, meter_end)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `;
        const values = [
            shiptoNo, buyDate, workNo, workPay, meterNo,
            tankNo, productNo, productName, productPrice, meterStart, meterEnd
        ];

        await pool.query(query, values);
        insertedCount++;
    }

    console.log(`   ✅ EODMETER: Insert สำเร็จ ${insertedCount} แถว (ไฟล์: ${fileName})`);
}

// ============================================================
// Parser + Insert: tbl_order_eodtank
// CSV columns(9):
// ShipToNo, DateTime(DD / MM / YYYY), TankNo, ProductNo, PDName,
//     TankStart, TankEnd, ReciveVal, CloseDate(DD / MM / YYYY)
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

        const shiptoNo = cols[0].trim();
        const dateAt = convertDateDMY(cols[1].trim());       // DD/MM/YYYY → YYYY-MM-DD
        const tankNo = cols[2].trim();
        const productNo = cols[3].trim();
        const productName = cols[4].trim();
        const tankStart = parseFloat(cols[5]);
        const tankEnd = parseFloat(cols[6]);
        const reciveVal = cols[7].trim();                    // varchar(50)
        const closeAt = convertDateDMY(cols[8].trim());      // DD/MM/YYYY → YYYY-MM-DD

        const query = `
            INSERT INTO tbl_order_eodtank (shipto_no, date_at, tank_no, product_no, product_name, tank_start, tank_end, recive_val, close_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;
        const values = [
            shiptoNo, dateAt, tankNo, productNo, productName,
            tankStart, tankEnd, reciveVal, closeAt
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
    // เพิ่มการเช็คนามสกุลไฟล์ .csv (แปลงเป็นพิมพ์เล็กก่อนเช็คเพื่อความชัวร์)
    const files = fileList.filter(f =>
        (f.type === 1 || f.isDirectory === false) &&
        f.name.toLowerCase().endsWith('.csv')
    );

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
        const sourceFilePath = `${sourceFolder}/${file.name}`; // ย้ายไฟล์ไปที่โฟลเดอร์ Backup
        const targetFilePath = `${targetArchiveFolder}/${file.name}`;// ย้ายไฟล์ไปที่โฟลเดอร์ Backup

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
        // console.log(`-> กำลัง Copy (Upload) ไฟล์ไปที่ Backup Folder...`);
        // try {
        //     // **จุดที่ต้องแก้**: ขึ้นอยู่กับ Library FTP ที่คุณใช้
        //     // 1. ถ้าใช้ไลบรารี 'basic-ftp' จะใช้คำสั่ง:
        //     await client.uploadFrom(localFilePath, targetFilePath);

        //     // 2. ถ้าใช้ไลบรารี 'ssh2-sftp-client' (SFTP) จะใช้คำสั่ง:
        //     // await client.put(localFilePath, targetFilePath);

        //     console.log(`-> Copy ไฟล์สำเร็จ: ${targetFilePath}`);
        // } catch (copyErr) {
        //     console.error(`-> Copy ไฟล์ไม่สำเร็จ: ${copyErr.message}`);
        // }


        // สังเกตว่าเราตัดคำสั่ง client.rename และ client.remove ทิ้งไปเลย
        // ทำให้ไฟล์ต้นฉบับจะยังคงอยู่ใน sourceFolder เหมือนเดิมครับ

        console.log(`--------------------------------------------`);

        // C. ลบไฟล์ชั่วคราวในเครื่อง Node ทิ้ง
        fs.unlinkSync(localFilePath);
        console.log(`-> ลบไฟล์ temp ในเครื่องทิ้งเรียบร้อย`);



        console.log(`-> กำลังย้ายไฟล์บน FTP ไปที่ Backup Folder...`);
        try {
            await client.rename(sourceFilePath, targetFilePath);
            console.log(`-> ย้ายไฟล์สำเร็จ: ${targetFilePath}`);


        } catch (renameErr) {
            console.error(`-> ย้ายไฟล์ไม่สำเร็จ: ${renameErr.message}`);
        }
        console.log(`--------------------------------------------`);
    }
}

// ============================================================
// ประมวลผล 1 config (ถูกเรียกจาก ftp-worker.js หรือรันตรง)
// ============================================================
async function processOneConfig(ftpConfig) {
    console.log(`\n=================================================`);
    console.log(` [FTP] กำลังเริ่มงานของ: ${ftpConfig.config_name} (${ftpConfig.host_address})`);

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

        console.log(`✅ เชื่อมต่อ ${ftpConfig.config_name} สำเร็จ! (FTP)`);

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
            const sourceFolder = `${baseSourceFolder}/${subFolder}`;
            const targetArchiveFolder = `${baseArchiveFolder}/${dateFolderName}/${subTarget}`;

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
        console.log(`[${new Date().toLocaleString()}] จบการทำงาน FTP รอบนี้\n`);
    }
}

// Export สำหรับ ftp-worker.js (unified)
module.exports = { processOneConfig };

// ============================================================
// รันตรง (ถ้าสั่ง node ftp-worker-basic.js โดยตรง)
// ============================================================
if (require.main === module) {
    async function processFTPFiles() {
        console.log(`\n[${new Date().toLocaleString()}] เริ่มต้นกระบวนการตรวจสอบ FTP...`);
        let ftpConfigs = [];
        try {
            const result = await pool.query(`
                SELECT * FROM tbl_connection_configs
                WHERE config_flag = '1' AND config_type = 'ftp'
            `);
            ftpConfigs = result.rows;
        } catch (err) {
            console.error("❌ ไม่สามารถดึงข้อมูล Config จาก Database ได้:", err.message);
            return;
        }
        if (ftpConfigs.length === 0) {
            console.log(">> ⚠️ ไม่พบ FTP Host ที่เปิดใช้งาน ข้ามการทำงานรอบนี้");
            return;
        }
        console.log(`>> พบ FTP Hosts: ${ftpConfigs.length} แหล่ง`);
        for (const config of ftpConfigs) {
            await processOneConfig(config);
        }
    }

    console.log("เริ่มต้น Service Background Process (FTP)...");
    cron.schedule('* * * * *', () => { processFTPFiles(); });
    processFTPFiles();
}