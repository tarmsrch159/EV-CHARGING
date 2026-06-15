const pool = require('../../db');
const { convertDateDMY } = require('../helpers/date-helper');

// ============================================================
// Parser + Insert: tbl_order_eodmeter
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

module.exports = { parseAndInsertEODMETER };
