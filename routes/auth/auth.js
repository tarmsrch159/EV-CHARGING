const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// API เข้าสู่ระบบผู้ใช้งาน (User Authentication)
exports.authUserInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { 
            user_name, 
            user_password,
            emp_username, 
            emp_userpassword,
            action 
        } = req.body[0] || {};

        const username = user_name || emp_username;
        const password = user_password || emp_userpassword;

        if (!lic_code || !username || !password) {
            return sendResponse(
                res, 
                'error', 
                '-1', 
                'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง'
            );
        }

        const encodedPassword = xglobal.Base64.encode(password);

        const script = `
            SELECT 
                u.user_code,
                u.user_name,
                u.emp_code,
                u.name,
                u.lastname,
                u.photo,
                u.email,
                u.mobile,
                u.gender,
                u.id_card,
                u.default_lang,
                u.user_authority,
                a.authority_code,
                a.authority_name
            FROM tbl_users u
            LEFT JOIN tbl_authority a ON u.user_authority = a.authority_no AND a.rm_dt IS NULL AND a.authority_flag = 1
            WHERE u.user_name = $1 
              AND u.user_password = $2 
              AND u.user_flag = 1 
              AND u.rm_dt IS NULL
            LIMIT 1;
        `;

        const result = await pgConn.getWithParams(
            dbPrefix + lic_code,
            script,
            [username, encodedPassword],
            config.connectionString()
        );

        if (result.code) {
            if (action && action[0]) {
                await xglobal.action_logs(
                    lic_code,
                    username,
                    'เข้าสู่ระบบ',
                    JSON.stringify(req.body[0]),
                    result.message,
                    action[0].value || 'SYSTEM'
                );
            }
            return sendResponse(
                res,
                'error',
                '-3',
                'ไม่สามารถเข้าสู่ระบบได้, กรุณาติดต่อผู้ดูแลระบบ'
            );
        }

        if (result.data.length === 0) {
            return sendResponse(
                res,
                'error',
                '-2',
                'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง'
            );
        }

        const userData = JSON.parse(
            JSON.stringify(result.data).replace(/\:null/gi, '\:""')
        );

        const employeeId = userData[0].user_code;
        const officeCode = (action && action[0] && action[0].value) || 'SYSTEM';

        await xglobal.action_logs(
            lic_code,
            employeeId,
            'เข้าสู่ระบบ',
            JSON.stringify(req.body[0]),
            'success',
            officeCode
        );

        return sendResponse(res, 'success', '0', 'เข้าสู่ระบบสำเร็จ', userData);
    } catch (err) {
        console.error('Auth Error:', err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};

// API รีเซ็ตรหัสผ่าน (Reset Password Placeholder)
exports.resetUserPassword = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { user_code, new_password, action } = req.body[0] || {};

        if (!lic_code || !user_code || !new_password || !action) {
            return sendResponse(
                res,
                'error',
                '-1',
                'พารามิเตอร์ไม่ครบถ้วน'
            );
        }

        const encodedPassword = xglobal.Base64.encode(new_password);
        const script = `
            UPDATE tbl_users 
            SET user_password = $1, mdf_dt = $2::timestamp
            WHERE user_code = $3 AND rm_dt IS NULL;
        `;
        const params = [encodedPassword, moment().format('YYYY-MM-DD HH:mm:ss'), user_code];

        const result = await pgConn.execute2params(
            dbPrefix + lic_code,
            script,
            params,
            config.connectionString()
        );

        if (result.code) {
            await xglobal.action_logs(
                lic_code,
                action[0].id,
                'รีเซ็ตรหัสผ่าน',
                JSON.stringify(req.body[0]),
                result.message,
                action[0].value
            );
            return sendResponse(res, 'error', '-3', 'ไม่สามารถรีเซ็ตรหัสผ่านได้');
        }

        await xglobal.action_logs(
            lic_code,
            action[0].id,
            'รีเซ็ตรหัสผ่าน',
            JSON.stringify(req.body[0]),
            'success',
            action[0].value
        );

        return sendResponse(res, 'success', '0', 'รีเซ็ตรหัสผ่านสำเร็จ');
    } catch (err) {
        console.error('Reset Password Error:', err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ');
    }
};
