const pool = require('../../db');

// ============================================================
// Parser + Insert: tbl_order_omi
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

module.exports = { parseAndInsertOMI };
