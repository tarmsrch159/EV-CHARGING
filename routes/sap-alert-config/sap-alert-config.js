
const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// =========================================================
//            ดึงข้อมูล SAP Alert Config
// =========================================================
exports.getSAPAlertInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        let { config_code } = req.body[0] || {};
        config_code = config_code === undefined || config_code === "" ? "ALL" : config_code;

        let conditions = ["rm_dt IS NULL",];

        if (config_code !== "ALL") conditions.push(`config_code = '${config_code}'`);

        let whereClause = "WHERE " + conditions.join(" AND ");

        const script = `
            SELECT 
                config_code,
                order_cutoff_time,
                re_alert_type,
                cutoff_status
            FROM tbl_sap_alert_config
            ${whereClause}
        `;

        const result = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

        if (result.code) {
            return sendResponse(res, 'error', '-3', 'ไม่สามารถดึงข้อมูลได้, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', []);
        }

        const data = JSON.parse(JSON.stringify(result.data).replace(/\:null/gi, "\:\"\""));
        return sendResponse(res, 'success', '0', 'ดึงข้อมูลสำเร็จ', data);

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ', []);
    }
};

// =========================================================
//            แก้ไขข้อมูล SAP Alert Config
// =========================================================
exports.setSAPAlertInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { config_code } = req.query;
        const { order_cutoff_time, re_alert_type, cutoff_status, action } = req.body[0] || {};

        if (!lic_code || !config_code || !action) {
            return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง', []);
        }

        const now = moment().format('YYYY-MM-DD HH:mm:ss');

        const script = `
            UPDATE public.tbl_sap_alert_config 
            SET 
                order_cutoff_time = $1, 
                re_alert_type = $2, 
                cutoff_status = $3, 
                mdf_dt = $4
            WHERE config_code = $5 AND rm_dt IS NULL
        `;

        const params = [order_cutoff_time, re_alert_type, cutoff_status, now, config_code];
        const result = await pgConn.execute2params(dbPrefix + lic_code, script, params, config.connectionString());

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูล SAP Alert', JSON.stringify(req.body[0]), 'ไม่สามารถแก้ไขข้อมูลได้', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถแก้ไขข้อมูลได้, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', []);
        }

        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูล SAP Alert', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'แก้ไขข้อมูลสำเร็จ', []);

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ', []);
    }
};

// =========================================================
//            เพิ่มข้อมูล SAP Alert Config
// =========================================================
exports.addSAPAlertInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { order_cutoff_time, re_alert_type, cutoff_status, action } = req.body[0] || {};

        if (!lic_code || !action) {
            return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง', []);
        }

        const config_code = 'saca-' + moment().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000);
        const now = moment().format('YYYY-MM-DD HH:mm:ss');

        const script = `
            INSERT INTO public.tbl_sap_alert_config 
            (config_code, order_cutoff_time, re_alert_type, cutoff_status, ist_dt, mdf_dt)
            VALUES ($1, $2, $3, $4, $5, $5)
        `;

        const params = [config_code, order_cutoff_time, re_alert_type, cutoff_status, now];
        const result = await pgConn.execute2params(dbPrefix + lic_code, script, params, config.connectionString());

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล SAP Alert', JSON.stringify(req.body[0]), 'ไม่สามารถเพิ่มข้อมูลได้', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถเพิ่มข้อมูลได้, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', []);
        }

        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล SAP Alert', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'บันทึกข้อมูลสำเร็จ', [{ config_code }]);

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ', []);
    }
};
