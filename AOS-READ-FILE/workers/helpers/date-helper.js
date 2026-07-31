// ============================================================
// Helper: แปลงวันที่จาก DD/MM/YYYY → YYYY-MM-DD
// ============================================================
function convertDateDMY(dateStr) {
    const parts = dateStr.split('/');
    if (parts.length !== 3) return dateStr;
    const [dd, mm, yyyy] = parts;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

module.exports = { convertDateDMY };
