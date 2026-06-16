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
            sales_org,
            order_type,
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

        if (sales_org && sales_org.toString().toUpperCase() !== 'ALL') {
            params.push(sales_org);
            conditions.push(`p.ptrl_sales_group = $${params.length}`);
        }

        if (order_type && order_type.toString().toUpperCase() !== 'ALL') {
            params.push(order_type);
            conditions.push(`p.ptrl_sales_type = $${params.length}`);
        }

        // =========================================================================
        // กรองข้อมูลตามสิทธิ์การเข้าถึง (Role Authorization)
        // =========================================================================
        let act_val = action[0].value.toString().toUpperCase();
        let act_id = action[0].id;

        if (act_val === "GROUP") {
            // ======================= สิทธิ์ GROUP (เช่น Planner/CS): มองเห็นเฉพาะ Order ของปั๊มที่อยู่ในความดูแลของตัวเอง =======================
            conditions.push(
                `
        (
        NOT EXISTS (SELECT 1 FROM tbl_employee_petrol_group WHERE emp_code = '${act_id}' AND emp_pgrp_flag = 1)
        OR p.ptrl_group_code IN (SELECT ptrl_group_code FROM tbl_employee_petrol_group WHERE emp_code = '${act_id}' AND emp_pgrp_flag = 1)
        )`,
            );
            conditions.push(`p.ptrl_flag = '1'`);

        } else if (act_val !== "ALL") {
            // ======================= สิทธิ์พนักงานทั่วไป: มองเห็นเฉพาะรายงานของปั๊มตัวเอง =======================
            conditions.push(`ri.ptrl_code IN (SELECT ptrl_code FROM tbl_petrol WHERE ptrl_code IN (SELECT ptrl_code FROM tbl_employee WHERE emp_code = '${act_id}' AND emp_flag = '1'))`);
        }

        const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

        // 2. Query หลัก: ดึงข้อมูลพร้อมเช็คว่า "ยังไม่มีการยืนยันคำสั่งซื้อใน SAP"
        const script = `
            SELECT DISTINCT ON (p.ptrl_number, ri.tank_numbers, ri.itm_code, DATE(ri.ist_dt))
                ri.ist_dt as alert_date,
                p.ptrl_code,
                p.ptrl_number,
                p.ptrl_desc,
                ri.tank_numbers,
                ri.itm_code,
                ri.itm_desc,
                ri.day_sales,
                ri.unpump,
                ri.stock_minus_sales as stock,
                p.ptrl_sales_group,
                ot.sales_order_type
            FROM tbl_runout_information ri
            JOIN tbl_petrol p ON ri.ptrl_code = p.ptrl_code
            LEFT JOIN tbl_order_type ot ON p.ptrl_sales_type = ot.ord_type_code
            ${whereClause}
            ORDER BY p.ptrl_number ASC, ri.tank_numbers ASC, ri.itm_code, DATE(ri.ist_dt), ri.ist_dt DESC
            OFFSET ${offset} LIMIT ${pageLimitInt};
        `;
        const tbl_temporary = await pgConn.getWithParams(dbName, script, params, config.connectionString());

        console.log(script);
        console.log(params);
        console.log(tbl_temporary);
        if (tbl_temporary.code) throw new Error(tbl_temporary.message);

        // 3. ปรับแต่งข้อมูล (ดึงค่าที่คำนวณมาแล้วจาก Table)
        const formattedData = tbl_temporary.data.map(item => {
            return {
                ...item,
                alert_date: moment(item.alert_date).format('DD/MM/YYYY'),
                runout_status: 'Run-out', // ข้อมูลในตารางนี้คือรายการที่เข้าระบบ Run-out อยู่แล้ว
                stock_qty: Number(item.stock),
                day_sales: parseFloat(item.day_sales || 0).toFixed(2),
                unpump_qty: Number(item.unpump)
            };
        });

        // 4. คำนวณจำนวนหน้าทั้งหมด
        const countScript = `
            SELECT COUNT(*) as total_rows FROM (
                SELECT DISTINCT ON (p.ptrl_number, ri.tank_numbers, ri.itm_code, DATE(ri.ist_dt)) 1
                FROM tbl_runout_information ri
                JOIN tbl_petrol p ON ri.ptrl_code = p.ptrl_code
                LEFT JOIN tbl_order_type ot ON p.ptrl_sales_type = ot.ord_type_code
                ${whereClause}
            ) tmp
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
        console.error('[getRunoutReportInformation Error]:', err);
        xglobal.sendResponse(res, 'error', '-1', 'ไม่สามารถดึงข้อมูลได้: ' + err.message);
    }
};
