const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

/**
 * FR-15 Run-out Report Information
 * ดึงข้อมูลรายงานสถานีที่มีความเสี่ยง Run-out ตามเงื่อนไขและฟิลเตอร์
 */
exports.getRunoutReportInformation = async (req, res, next) => {
    const xresult = [];
    try {
        const lic_code = req.header('lic_code');
        const {
            ptrl_code,
            start_date,
            end_date,
            itm_code,
            page_index = 1,
            page_limit = 10,
            action
        } = req.body[0] || {};

        const pageLimitInt = parseInt(page_limit) || 10;
        const pageIndexInt = parseInt(page_index) || 1;
        const offset = (Math.max(1, pageIndexInt) - 1) * pageLimitInt;
        const dbName = dbPrefix + lic_code;

        // 1. สร้างเงื่อนไขการกรอง (WHERE Clause)
        const conditions = ["ri.rm_dt IS NULL"];
        const params = [];

        if (ptrl_code && ptrl_code.toString().toUpperCase() !== 'ALL') {
            params.push(ptrl_code);
            conditions.push(`(p.ptrl_code = $${params.length} OR p.ptrl_number = $${params.length})`);
        }

        if (start_date) {
            params.push(moment(start_date).startOf('day').format('YYYY-MM-DD HH:mm:ss'));
            conditions.push(`ri.ist_dt >= $${params.length}`);
        }

        if (end_date) {
            params.push(moment(end_date).endOf('day').format('YYYY-MM-DD HH:mm:ss'));
            conditions.push(`ri.ist_dt <= $${params.length}`);
        }

        if (itm_code && itm_code.toUpperCase() !== 'ALL') {
            params.push(itm_code);
            conditions.push(`ri.itm_code = $${params.length}`);
        }

        const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

        // 2. Query หลัก: ดึงข้อมูลพร้อมเช็คว่า "ยังไม่มีการยืนยันคำสั่งซื้อใน SAP"
        const script = `
            SELECT 
                ri.ist_dt as alert_date,
                p.ptrl_code,
                p.ptrl_number,
                p.ptrl_desc,
                ri.tank_numbers,
                ri.itm_code,
                ri.itm_desc,
                ri.stock,
                ri.day_sales,
                ri.unpump,
                ri.stock_minus_sales
            FROM tbl_runout_information ri
            JOIN tbl_petrol p ON ri.ptrl_code = p.ptrl_code
            ${whereClause}
            ORDER BY ri.ist_dt DESC, ri.tank_numbers ASC
            OFFSET ${offset} LIMIT ${pageLimitInt};
        `;

        const tbl_temporary = await pgConn.getWithParams(dbName, script, params, config.connectionString());

        if (tbl_temporary.code) throw new Error(tbl_temporary.message);

        // 3. ปรับแต่งข้อมูล (ดึงค่าที่คำนวณมาแล้วจาก Table)
        const formattedData = tbl_temporary.data.map(item => {
            return {
                ...item,
                alert_date: moment(item.alert_date).format('DD/MM/YYYY'),
                runout_status: 'Run-out', // ข้อมูลในตารางนี้คือรายการที่เข้าระบบ Run-out อยู่แล้ว
                stock_qty: Number(item.stock),
                day_sales: Number(item.day_sales),
                unpump_qty: Number(item.unpump)
            };
        });

        // 4. คำนวณจำนวนหน้าทั้งหมด
        const countScript = `
            SELECT COUNT(*) as total_rows
            FROM tbl_runout_information ri
            JOIN tbl_petrol p ON ri.ptrl_code = p.ptrl_code
            ${whereClause}
          
        `;
        const tbl_temporary0 = await pgConn.getWithParams(dbName, countScript, params, config.connectionString());
        const totalRows = parseInt(tbl_temporary0.data[0]?.total_rows || 0);
        const totalPages = Math.ceil(totalRows / pageLimitInt);

        xglobal.sendResponse(res, 'success', '0', '', formattedData, {
            rows_total: totalRows,
            page_total: totalPages || 1
        });

        if (action && action[0]) {
            await xglobal.action_logs(lic_code, action[0].id, 'เรียกดูรายงาน Run-out', JSON.stringify(req.body[0]), 'สำเร็จ', action[0].value);
        }

    } catch (err) {
        console.error('❌ [getRunoutReportInformation Error]:', err);
        xglobal.sendResponse(res, 'error', '-1', 'ไม่สามารถดึงข้อมูลได้: ' + err.message);
    }
};
