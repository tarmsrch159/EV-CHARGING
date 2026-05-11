const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

/**
 * 1. ดึงรายการตั้งค่า 
 */
exports.getSalesOrgConfig = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const dbName = dbPrefix + lic_code;
        const { sales_org_code, order_type_code, search, action } = req.body[0] || {};

        const conditions = ["rm_dt IS NULL", "sales_org_flag = 1"];
        const params = [];

        if (sales_org_code && sales_org_code !== 'ALL') {
            params.push(sales_org_code);
            conditions.push(`sales_org_code = $${params.length}`);
        }

        if (order_type_code && order_type_code !== 'ALL') {
            params.push(order_type_code);
            conditions.push(`order_type_code = $${params.length}`);
        }

        if (search) {
            params.push(`%${search}%`);
            conditions.push(`(sales_org_code LIKE $${params.length} OR order_type_code LIKE $${params.length})`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const script = `
            SELECT * FROM tbl_sales_org_order_config 
            ${whereClause} 
            ORDER BY sales_org_code ASC, order_type_code ASC
        `;

        const result = await pgConn.getWithParams(dbName, script, params, config.connectionString());

        if (result.code) throw new Error(result.message);

        xglobal.sendResponse(res, 'success', '0', 'ดึงข้อมูลสำเร็จ', result.data);

        if (action && action[0]) {
            await xglobal.action_logs(lic_code, action[0].id, 'เรียกดูรายการตั้งค่า Run-out/Auto Order', JSON.stringify(req.body[0]), 'สำเร็จ', action[0].value);
        }

    } catch (err) {
        console.error('❌ [getRunoutConfig Error]:', err);
        xglobal.sendResponse(res, 'error', '-1', err.message);
    }
};

/**
 * 2. เพิ่มการตั้งค่าใหม่ (Create)
 */
exports.addSalesOrgConfig = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const dbName = dbPrefix + lic_code;
        const {
            sales_org_code,
            order_type_code,
            order_cutoff_time,
            cutoff_status = 1,
            start_calculate_auto_order,
            end_calculate_auto_order,
            action
        } = req.body[0] || {};

        if (!sales_org_code || !order_type_code) {
            return xglobal.sendResponse(res, 'error', '-2', 'กรุณาระบุ Sales Org และ Order Type');
        }

        const sales_org_config_code = `soc-${moment().format('YYYYMMDDHHmmssSSS')}` + Math.floor(Math.random() * 1000);

        const script = `
            INSERT INTO tbl_sales_org_order_config (
                sales_org_config_code, sales_org_code, order_type_code, 
                order_cutoff_time, cutoff_status, 
                start_calculate_auto_order, end_calculate_auto_order,
                ist_dt, sales_org_flag
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
        `;

        const params = [
            sales_org_config_code, sales_org_code, order_type_code,
            order_cutoff_time, cutoff_status,
            start_calculate_auto_order, end_calculate_auto_order, 1
        ];

        const result = await pgConn.execute2params(dbName, script, params, config.connectionString());

        if (result.code) throw new Error(result.message);

        xglobal.sendResponse(res, 'success', '0', 'เพิ่มข้อมูลสำเร็จ');

        if (action && action[0]) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มตั้งค่า Run-out/Auto Order', JSON.stringify(req.body[0]), 'สำเร็จ', action[0].value);
        }

    } catch (err) {
        console.error('❌ [addSalesOrgConfig Error]:', err);
        xglobal.sendResponse(res, 'error', '-1', err.message);
    }
};

/**
 * 3. แก้ไขการตั้งค่า (Update)
 */
exports.updateSalesOrgConfig = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const dbName = dbPrefix + lic_code;
        const { sales_org_config_code } = req.query
        const {
            sales_org_code,
            order_type_code,
            order_cutoff_time,
            cutoff_status,
            start_calculate_auto_order,
            end_calculate_auto_order,
            action
        } = req.body[0] || {};


        const script = `
            UPDATE tbl_sales_org_order_config SET
                sales_org_code = $1,
                order_type_code = $2,
                order_cutoff_time = $3,
                cutoff_status = $4,
                start_calculate_auto_order = $5,
                end_calculate_auto_order = $6,
                mdf_dt = NOW()
            WHERE sales_org_config_code = $7 AND rm_dt IS NULL
        `;

        const params = [
            sales_org_code, order_type_code, order_cutoff_time,
            cutoff_status, start_calculate_auto_order, end_calculate_auto_order,
            sales_org_config_code
        ];

        const result = await pgConn.execute2params(dbName, script, params, config.connectionString());

        if (result.code) throw new Error(result.message);

        xglobal.sendResponse(res, 'success', '0', 'แก้ไขข้อมูลสำเร็จ');

        if (action && action[0]) {
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขตั้งค่า Run-out/Auto Order', JSON.stringify(req.body[0]), 'สำเร็จ', action[0].value);
        }

    } catch (err) {
        console.error('❌ [updateSalesOrgConfig Error]:', err);
        xglobal.sendResponse(res, 'error', '-1', err.message);
    }
};

/**
 * 4. ลบการตั้งค่า (Delete - Soft Delete)
 */
exports.deleteSalesOrgConfig = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const dbName = dbPrefix + lic_code;
        const { sales_org_config_code, action } = req.body[0] || {};

        if (!sales_org_config_code) {
            return xglobal.sendResponse(res, 'error', '-2', 'ไม่พบรหัสที่ต้องการลบ');
        }

        const script = `
            UPDATE tbl_sales_org_order_config 
            SET sales_org_flag = 0 , rm_dt = NOW() 
            WHERE sales_org_config_code = $1
        `;

        const result = await pgConn.execute2params(dbName, script, [sales_org_config_code], config.connectionString());

        if (result.code) throw new Error(result.message);

        xglobal.sendResponse(res, 'success', '0', 'ลบข้อมูลสำเร็จ');

        if (action && action[0]) {
            await xglobal.action_logs(lic_code, action[0].id, 'ลบตั้งค่า Run-out/Auto Order', JSON.stringify(req.body[0]), 'สำเร็จ', action[0].value);
        }

    } catch (err) {
        console.error('❌ [deleteSalesOrgConfig Error]:', err);
        xglobal.sendResponse(res, 'error', '-1', err.message);
    }
};
