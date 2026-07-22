const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// API ดึงข้อมูลความคืบหน้าระหว่างการชาร์จ (Get EV Charging Logs)
exports.getTransactionLogInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { reservation_code, action } = req.body[0] || {};

        if (!lic_code || !reservation_code || !action) {
            return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');
        }

        const script = `
            SELECT 
                transaction_log_code,
                reservation_code,
                TO_CHAR(log_time, 'YYYY-MM-DD HH24:MI:SS') as log_time,
                soc_percent,
                charging_power_kw,
                current_voltage,
                current_ampere,
                energy_delivered_kwh,
                accumulated_cost_thb
            FROM tbl_ev_charging_transaction_log
            WHERE reservation_code = $1
            ORDER BY log_time ASC;
        `;

        const result = await pgConn.getWithParams(
            dbPrefix + lic_code,
            script,
            [reservation_code],
            config.connectionString()
        );

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, "ดึงข้อมูลความคืบหน้าการชาร์จ", JSON.stringify(req.body[0]), result.message, action[0].value);
            return sendResponse(res, 'error', '-3', "ไม่สามารถดึงข้อมูลความคืบหน้าการชาร์จได้");
        }

        const data = JSON.parse(JSON.stringify(result.data).replace(/\:null/gi, '\:""'));
        return sendResponse(res, 'success', '0', "", data);
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

// API เพิ่มข้อมูลล็อกความคืบหน้าการชาร์จ (Add Charging Log)
exports.addTransactionLog = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const {
            reservation_code,
            soc_percent,
            charging_power_kw,
            current_voltage = null,
            current_ampere = null,
            energy_delivered_kwh,
            accumulated_cost_thb = 0.00,
            action
        } = req.body[0] || {};

        if (!lic_code || !reservation_code || soc_percent === undefined || charging_power_kw === undefined || energy_delivered_kwh === undefined || !action) {
            return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');
        }

        const newLogCode = "txg-" + moment().format("YYYYMMDDHHmmss") + Math.floor(Math.random() * 100);
        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        const script = `
            INSERT INTO tbl_ev_charging_transaction_log (
                transaction_log_code, reservation_code, log_time, soc_percent,
                charging_power_kw, current_voltage, current_ampere, energy_delivered_kwh, accumulated_cost_thb
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
        `;
        const params = [
            newLogCode, reservation_code, nowStr, soc_percent,
            charging_power_kw, current_voltage, current_ampere, energy_delivered_kwh, accumulated_cost_thb
        ];

        const result = await pgConn.execute2params(dbPrefix + lic_code, script, params, config.connectionString());
        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, "บันทึกสถานะการชาร์จ Real-time", JSON.stringify(req.body[0]), result.message, action[0].value);
            return sendResponse(res, 'error', '-3', "ไม่สามารถบันทึกข้อมูลล็อกความคืบหน้าการชาร์จได้");
        }

        return sendResponse(res, 'success', '0', "บันทึกล็อกสถานะชาร์จสำเร็จ", [{ transaction_log_code: newLogCode }]);
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};
