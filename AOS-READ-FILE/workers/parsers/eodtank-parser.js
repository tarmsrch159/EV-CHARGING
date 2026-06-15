const pool = require('../../db');
const { convertDateDMY } = require('../helpers/date-helper');

// ============================================================
// Parser + Insert: tbl_order_eodtank
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
        const reciveVal = parseFloat(cols[7]);
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

module.exports = { parseAndInsertEODTANK };
