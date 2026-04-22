
const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// =========================================================
//            ดึงข้อมูลถังน้ำมัน (Tank Information)
// =========================================================
exports.getRunoutInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { ptrl_code } = req.body[0] || {};

        const missing = [];
        if (!lic_code) missing.push('lic_code');
        if (!ptrl_code) missing.push('ptrl_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`, []);
        }


        const script = `
            SELECT 
                tbl_petrol_tank.ptrl_tank_code,
                tbl_petrol_tank.tnk_number,
                tbl_petrol_tank.itm_code,
                tbl_item.itm_desc,
                tbl_petrol_tank.unpump_level,
                tbl_petrol_tank.auto_alert  
            FROM tbl_petrol_tank
            LEFT JOIN tbl_item ON tbl_petrol_tank.itm_code = tbl_item.itm_code
            LEFT JOIN tbl_petrol_mail_alert ON tbl_petrol_tank.ptrl_code = tbl_petrol_mail_alert.ptrl_code
            WHERE tbl_petrol_tank.ptrl_code = $1 AND tbl_petrol_tank.rm_dt IS NULL
            GROUP BY tbl_petrol_tank.ptrl_tank_code, tbl_petrol_tank.tnk_number, tbl_petrol_tank.itm_code, tbl_item.itm_desc, tbl_petrol_tank.unpump_level, tbl_petrol_tank.auto_alert
            ORDER BY tbl_petrol_tank.tnk_number ASC
        `;

        const result = await pgConn.getWithParams(dbPrefix + lic_code, script, [ptrl_code], config.connectionString());

        const mailAlertScript = `
            SELECT 
                tbl_petrol_mail_alert.email_alert
            FROM tbl_petrol_mail_alert
            WHERE tbl_petrol_mail_alert.ptrl_code = $1 AND tbl_petrol_mail_alert.rm_dt IS NULL
        `;

        const mailAlertResult = await pgConn.getWithParams(dbPrefix + lic_code, mailAlertScript, [ptrl_code], config.connectionString());

        if (result.code || mailAlertResult.code) {
            return sendResponse(res, 'error', '-3', 'ไม่สามารถดึงข้อมูลได้, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', []);
        }

        const data = JSON.parse(JSON.stringify(result.data).replace(/\:null/gi, "\:\"\""));
        const mailAlertData = JSON.parse(JSON.stringify(mailAlertResult.data).replace(/\:null/gi, "\:\"\""));
        return sendResponse(res, 'success', '0', 'ดึงข้อมูลสำเร็จ', data, { mailAlertData });

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ', []);
    }
};

// =========================================================
//            อัพเดตข้อมูลถังน้ำมัน (Update Tank)
// =========================================================
exports.setRunoutInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { ptrl_tank_code } = req.query;
        const { unpump_level, auto_alert, action } = req.body[0] || {};

        const missing = [];
        if (!lic_code) missing.push('lic_code');
        if (!action) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`, []);
        }

        const script = `
            UPDATE public.tbl_petrol_tank
            SET 
                unpump_level = $1,
                auto_alert = $2
            WHERE ptrl_tank_code = $3 AND rm_dt IS NULL
        `;

        const params = [unpump_level, auto_alert, ptrl_tank_code];
        const result = await pgConn.execute2params(dbPrefix + lic_code, script, params, config.connectionString());

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'อัพเดตข้อมูลถังน้ำมัน', JSON.stringify(req.body[0]), 'ไม่สามารถอัพเดตข้อมูลได้', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถอัพเดตข้อมูลได้, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', []);
        }

        await xglobal.action_logs(lic_code, action[0].id, 'อัพเดตข้อมูลถังน้ำมัน', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'อัพเดตข้อมูลสำเร็จ', []);
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ', []);
    }
};

// =========================================================
//            เพิ่มข้อมูลอีเมลแจ้งเตือน (Add Email Alert)
// =========================================================
exports.addEmailAlert = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { ptrl_code, email_alert, re_alert_type, alert_status, action } = req.body[0] || {};

        const missing = [];
        if (!lic_code) missing.push('lic_code');
        if (!ptrl_code) missing.push('ptrl_code');
        if (!email_alert || !Array.isArray(email_alert)) missing.push('email_alert (Array)');
        if (!action) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`, []);
        }

        const now = moment().format('YYYY-MM-DD HH:mm:ss');

        // ======= ตรวจสอบข้อมูลซ้ำ =======
        // ใช้ = ANY($2) เพื่อตรวจสอบว่า email ใน Array มีอยู่ในฐานข้อมูลแล้วหรือไม่
        const scriptCheck = `SELECT email_alert FROM tbl_petrol_mail_alert WHERE ptrl_code = $1 AND email_alert = ANY($2) AND rm_dt IS NULL`;
        const resultCheck = await pgConn.getWithParams(dbPrefix + lic_code, scriptCheck, [ptrl_code, email_alert], config.connectionString());

        if (resultCheck.code) {
            return sendResponse(res, 'error', '-3', 'ไม่สามารถดึงข้อมูลได้, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', []);
        }

        // รายการอีเมลที่มีอยู่แล้วในระบบ
        const existingEmails = resultCheck.data.map(item => item.email_alert);

        // กรองเอาเฉพาะอีเมลที่ "ยังไม่มี" ในระบบ
        const newEmails = email_alert.filter(email => !existingEmails.includes(email));

        if (newEmails.length === 0) {
            return sendResponse(res, 'error', '-2', 'อีเมลทั้งหมดมีอยู่ในระบบแล้ว', []);
        }

        // ======= เพิ่ม Email Alert เฉพาะตัวที่ยังไม่มี =======
        for (const email of newEmails) {
            if (email) {
                const ptrl_mail_code = 'pmal-' + moment().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000);
                const insertScript = `
                    INSERT INTO tbl_petrol_mail_alert (ptrl_mail_code, ptrl_code, email_alert, mail_alert_flag, ist_dt, re_alert_type, alert_status)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `;
                const params = [ptrl_mail_code, ptrl_code, email, 1, now, re_alert_type, alert_status];
                await pgConn.execute2params(dbPrefix + lic_code, insertScript, params, config.connectionString());
            }
        }

        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มอีเมลแจ้งเตือน', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'บันทึกข้อมูลอีเมลแจ้งเตือนสำเร็จ', []);

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ', []);
    }
};

// =========================================================
//            ดึงข้อมูลอีเมลแจ้งเตือน (Get Email Alert Information)
// =========================================================
exports.getEmailAlertInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { ptrl_code } = req.body[0] || {};

        const missing = [];
        if (!lic_code) missing.push('lic_code');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`, []);
        }

        let script = `
            SELECT 
                pma.ptrl_mail_code,
                pma.ptrl_code,
                p.ptrl_desc,
                pma.email_alert,
                pma.re_alert_type,
                pma.alert_status,
                pma.mail_alert_flag,
                pma.ist_dt
            FROM tbl_petrol_mail_alert pma
            LEFT JOIN tbl_petrol p ON pma.ptrl_code = p.ptrl_code
            WHERE pma.rm_dt IS NULL
        `;

        const params = [];
        if (ptrl_code && ptrl_code !== 'ALL') {
            script += ` AND pma.ptrl_code = $1`;
            params.push(ptrl_code);
        }

        script += ` ORDER BY pma.ist_dt DESC`;

        const result = await pgConn.getWithParams(dbPrefix + lic_code, script, params, config.connectionString());

        if (result.code) {
            return sendResponse(res, 'error', '-3', 'ไม่สามารถดึงข้อมูลได้, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', []);
        }

        const data = JSON.parse(JSON.stringify(result.data).replace(/\:null/gi, "\:\"\""));
        return sendResponse(res, 'success', '0', 'ดึงข้อมูลอีเมลแจ้งเตือนสำเร็จ', data);

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ', []);
    }
};

// =========================================================
//            อัปเดตข้อมูลอีเมลแจ้งเตือน (Update Email Alert)
// =========================================================
exports.setEmailAlertInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { ptrl_code } = req.query;
        const { re_alert_type, alert_status, action } = req.body[0] || {};

        const missing = [];
        if (!lic_code) missing.push('lic_code');
        if (!action) missing.push('action');

        if (missing.length > 0) {
            return sendResponse(res, 'error', '-1', `ข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`, []);
        }

        const script = `
            UPDATE tbl_petrol_mail_alert
            SET 
                re_alert_type = $1,
                alert_status = $2,
                mdf_dt = $3
            WHERE ptrl_code = $4 AND rm_dt IS NULL
        `;

        const now = moment().format('YYYY-MM-DD HH:mm:ss');
        const params = [re_alert_type, alert_status, now, ptrl_code];
        const result = await pgConn.execute2params(dbPrefix + lic_code, script, params, config.connectionString());

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'อัปเดตข้อมูลอีเมลแจ้งเตือน', JSON.stringify(req.body[0]), 'ไม่สามารถอัพเดตข้อมูลได้', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถอัพเดตข้อมูลได้, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', []);
        }

        await xglobal.action_logs(lic_code, action[0].id, 'อัปเดตข้อมูลอีเมลแจ้งเตือน', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'อัพเดตข้อมูลสำเร็จ', []);

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ', []);
    }
};


// =========================================================
//            ลบข้อมูลอีเมลแจ้งเตือน (Remove Email Alert)
// =========================================================
exports.removeEmailAlert = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { ptrl_mail_code, action } = req.body[0] || {};

        if (!lic_code || !ptrl_mail_code || !action) {
            return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง', []);
        }

        const now = moment().format('YYYY-MM-DD HH:mm:ss');
        const script = `
            UPDATE tbl_petrol_mail_alert
            SET rm_dt = $1, mail_alert_flag = '0'
            WHERE ptrl_mail_code = $2 AND rm_dt IS NULL
        `;

        const params = [now, ptrl_mail_code];
        const result = await pgConn.execute2params(dbPrefix + lic_code, script, params, config.connectionString());

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, 'ลบอีเมลแจ้งเตือน', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูลได้', action[0].value);
            return sendResponse(res, 'error', '-3', 'ไม่สามารถลบข้อมูลได้, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', []);
        }

        await xglobal.action_logs(lic_code, action[0].id, 'ลบอีเมลแจ้งเตือน', JSON.stringify(req.body[0]), 'success', action[0].value);
        return sendResponse(res, 'success', '0', 'ลบข้อมูลสำเร็จ', []);

    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ', []);
    }
};
