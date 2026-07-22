const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// API ดึงข้อมูลล็อกการปฏิบัติงาน (Get Action Logs with Pagination)
exports.getActionLogInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        let {
            action_code = "ALL", // รหัสพนักงาน/ผู้ทำรายการ
            search = "",
            page_index = 1,
            page_limit = 10,
            action
        } = req.body[0] || {};

        if (!lic_code || !action) {
            return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');
        }

        const offset = page_index > 0 ? page_index - 1 : 0;
        const conditions = ["rm_dt IS NULL"];

        if (String(action_code).toUpperCase() !== "ALL") {
            conditions.push(`action_code = '${action_code}'`);
        }

        if (search && search.trim() !== "") {
            const sLower = search.trim().toLowerCase();
            conditions.push(`(
                LOWER(action_log_code) LIKE '%${sLower}%' OR
                LOWER(action_code) LIKE '%${sLower}%' OR
                LOWER(action_desc) LIKE '%${sLower}%' OR
                LOWER(action_result) LIKE '%${sLower}%'
            )`);
        }

        const whereClause = "WHERE " + conditions.join(" AND ");

        const dataScript = `
            SELECT 
                action_log_code,
                action_code,
                action_desc,
                action_body,
                action_result,
                off_code,
                TO_CHAR(ist_dt, 'YYYY-MM-DD HH24:MI:SS') as ist_dt,
                TO_CHAR(mdf_dt, 'YYYY-MM-DD HH24:MI:SS') as mdf_dt
            FROM tbl_action_logs
            ${whereClause}
            ORDER BY ist_dt DESC
            OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};
        `;

        const result = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());
        if (result.code) return sendResponse(res, 'error', '-3', "ไม่สามารถดึงข้อมูลประวัติกิจกรรมได้");

        if (result.data.length === 0) {
            return sendResponse(res, 'success', '0', "ไม่พบข้อมูล", [], { page_total: 0, rows_total: 0 });
        }

        const data = JSON.parse(JSON.stringify(result.data).replace(/\:null/gi, '\:""'));

        const countScript = `SELECT COUNT(action_log_code) as rows_total, CEIL(COUNT(action_log_code)::float / ${page_limit}) as page_total FROM tbl_action_logs ${whereClause};`;
        const countResult = await pgConn.get(dbPrefix + lic_code, countScript, config.connectionString());
        let page_total = 1, rows_total = 0;
        if (!countResult.code && countResult.data.length > 0) {
            rows_total = parseInt(countResult.data[0].rows_total);
            page_total = Math.max(1, parseInt(countResult.data[0].page_total));
        }

        return sendResponse(res, 'success', '0', "", data, { page_total, rows_total });
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};