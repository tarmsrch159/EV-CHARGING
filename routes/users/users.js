const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// API ดึงข้อมูลผู้ใช้งาน (Get Users Information)
exports.getUsersInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        let {
            user_code = "ALL",
            search = "",
            page_index = 1,
            page_limit = 10,
            action
        } = req.body[0] || {};

        if (!lic_code || !action) {
            return sendResponse(
                res,
                'error',
                '-1',
                'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง'
            );
        }

        const offset = page_index > 0 ? page_index - 1 : 0;
        const conditions = ["u.rm_dt IS NULL"];

        if (String(user_code).toUpperCase() !== "ALL") {
            conditions.push(`u.user_code = '${user_code}'`);
        }

        if (search && search.trim() !== "") {
            const searchLower = search.trim().toLowerCase();
            conditions.push(`(
                LOWER(u.user_name) LIKE '%${searchLower}%' OR 
                LOWER(u.name) LIKE '%${searchLower}%' OR 
                LOWER(u.lastname) LIKE '%${searchLower}%' OR 
                LOWER(u.email) LIKE '%${searchLower}%' OR 
                LOWER(u.mobile) LIKE '%${searchLower}%'
            )`);
        }

        const whereClause = "WHERE " + conditions.join(" AND ");

        const dataScript = `
            SELECT 
                u.user_code,
                u.user_name,
                u.user_authority,
                u.emp_code,
                u.name,
                u.lastname,
                u.photo,
                u.email,
                u.mobile,
                u.gender,
                u.id_card,
                u.default_lang,
                u.user_flag,
                u.ist_dt,
                u.mdf_dt,
                a.authority_code,
                a.authority_name,
                q.monthly_quota_kwh,
                q.used_quota_kwh,
                q.excess_rate_thb_kwh,
                q.idle_fee_rate_thb_min,
                TO_CHAR(q.quota_reset_date, 'YYYY-MM-DD') as quota_reset_date
            FROM tbl_users u
            LEFT JOIN tbl_authority a ON u.user_authority = a.authority_no AND a.rm_dt IS NULL
            LEFT JOIN tbl_user_charging_quota q ON u.user_code = q.user_code
            ${whereClause}
            ORDER BY u.ist_dt DESC
            OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};
        `;

        const result = await pgConn.get(
            dbPrefix + lic_code,
            dataScript,
            config.connectionString()
        );

        if (result.code) {
            await xglobal.action_logs(
                lic_code,
                action[0].id,
                "ดึงข้อมูลผู้ใช้งาน",
                JSON.stringify(req.body[0]),
                result.message,
                action[0].value
            );
            return sendResponse(
                res,
                'error',
                '-3',
                "ไม่สามารถดึงข้อมูลได้, กรุณาติดต่อผู้ดูแลระบบ"
            );
        }

        if (result.data.length === 0) {
            return sendResponse(res, 'success', '0', "ไม่พบข้อมูล", [], {
                page_total: 0,
                rows_total: 0
            });
        }

        const data = JSON.parse(
            JSON.stringify(result.data).replace(/\:null/gi, '\:""')
        );

        const countScript = `
            SELECT 
                COUNT(u.user_code) as rows_total,
                CEIL(COUNT(u.user_code)::float / ${page_limit}) as page_total
            FROM tbl_users u
            ${whereClause};
        `;
        const countResult = await pgConn.get(
            dbPrefix + lic_code,
            countScript,
            config.connectionString()
        );

        let page_total = 1, rows_total = 0;
        if (!countResult.code && countResult.data.length > 0) {
            rows_total = parseInt(countResult.data[0].rows_total);
            page_total = Math.max(1, parseInt(countResult.data[0].page_total));
        }

        return sendResponse(res, 'success', '0', "", data, {
            page_total,
            rows_total
        });
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

// API เพิ่มข้อมูลผู้ใช้งาน (Add User + Quota Init)
exports.addUser = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const {
            user_name,
            user_password,
            user_authority,
            emp_code,
            name,
            lastname,
            photo = "",
            email = "",
            mobile = "",
            gender = "M",
            id_card = "",
            default_lang = "th",
            monthly_quota_kwh = 50.00,
            excess_rate_thb_kwh = 6.50,
            idle_fee_rate_thb_min = 1.00,
            quota_reset_date,
            action
        } = req.body[0] || {};

        const missing = [];
        if (!user_name) missing.push("user_name");
        if (!user_password) missing.push("user_password");
        if (!name) missing.push("name");
        if (!action) missing.push("action");

        if (missing.length > 0) {
            return sendResponse(
                res,
                'error',
                '-1',
                `ข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(", ")})`
            );
        }

        const newUserCode = "usr-" + moment().format("YYYYMMDDHHmmss") + Math.floor(Math.random() * 100);
        const encodedPassword = xglobal.Base64.encode(user_password);
        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");
        
        // กำหนดวันรีเซ็ตอัตโนมัติหากไม่ได้ส่งมา (เป็นวันแรกของเดือนถัดไป)
        const defaultResetDate = quota_reset_date || moment().add(1, 'month').startOf('month').format("YYYY-MM-DD");

        const transactionResult = await pgConn.executeTransaction(
            dbPrefix + lic_code,
            async (client) => {
                // เช็ค user_name ซ้ำ
                const checkScript = `SELECT user_code FROM tbl_users WHERE user_name = $1 AND rm_dt IS NULL LIMIT 1;`;
                const checkUser = await pgConn.executeWithClient(client, checkScript, [user_name]);
                if (!checkUser.code && checkUser.data.length > 0) {
                    throw new Error(`ชื่อผู้ใช้งาน '${user_name}' นี้มีอยู่ในระบบแล้ว`);
                }

                // บันทึกตารางผู้ใช้งาน
                const userScript = `
                    INSERT INTO tbl_users (
                        user_code, user_name, user_password, user_authority, emp_code,
                        name, lastname, photo, email, mobile, gender, id_card, 
                        default_lang, user_flag, ist_dt
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 1, $14);
                `;
                const userParams = [
                    newUserCode, user_name, encodedPassword, user_authority || null, emp_code || null,
                    name, lastname || null, photo, email, mobile, gender, id_card, 
                    default_lang, nowStr
                ];
                const resUser = await pgConn.executeWithClient(client, userScript, userParams);
                if (resUser.code) throw new Error("ไม่สามารถบันทึกข้อมูลผู้ใช้งานได้: " + resUser.message);

                // บันทึกตารางโควตาผู้ใช้งาน
                const quotaScript = `
                    INSERT INTO tbl_user_charging_quota (
                        user_code, monthly_quota_kwh, used_quota_kwh, excess_rate_thb_kwh,
                        idle_fee_rate_thb_min, quota_reset_date, ist_dt
                    ) VALUES ($1, $2, 0.00, $3, $4, $5, $6);
                `;
                const quotaParams = [
                    newUserCode, monthly_quota_kwh, excess_rate_thb_kwh, 
                    idle_fee_rate_thb_min, defaultResetDate, nowStr
                ];
                const resQuota = await pgConn.executeWithClient(client, quotaScript, quotaParams);
                if (resQuota.code) throw new Error("ไม่สามารถบันทึกข้อมูลโควตาผู้ใช้งานได้: " + resQuota.message);

                return { user_code: newUserCode };
            },
            config.connectionString()
        );

        if (transactionResult.code) {
            await xglobal.action_logs(
                lic_code,
                action[0].id,
                "เพิ่มข้อมูลผู้ใช้งาน",
                JSON.stringify(req.body[0]),
                transactionResult.message,
                action[0].value
            );
            return sendResponse(
                res,
                'error',
                '-3',
                `ไม่สามารถบันทึกข้อมูลได้, เนื่องจาก: ${transactionResult.message}`
            );
        }

        await xglobal.action_logs(
            lic_code,
            action[0].id,
            "เพิ่มข้อมูลผู้ใช้งาน",
            JSON.stringify(req.body[0]),
            "success",
            action[0].value
        );

        return sendResponse(res, 'success', '0', "บันทึกข้อมูลผู้ใช้งานสำเร็จ", [transactionResult.data]);
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

// API แก้ไขข้อมูลผู้ใช้งาน (Update User + Quota)
exports.setUser = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { user_code } = req.query;
        const {
            user_password = "",
            user_authority,
            emp_code,
            name,
            lastname,
            photo,
            email,
            mobile,
            gender,
            id_card,
            default_lang,
            user_flag,
            monthly_quota_kwh,
            excess_rate_thb_kwh,
            idle_fee_rate_thb_min,
            quota_reset_date,
            action
        } = req.body[0] || {};

        if (!lic_code || !user_code || !action) {
            return sendResponse(
                res,
                'error',
                '-1',
                'ข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด user_code หรือ action)'
            );
        }

        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        const transactionResult = await pgConn.executeTransaction(
            dbPrefix + lic_code,
            async (client) => {
                // อัปเดตข้อมูลผู้ใช้งานหลัก
                let userUpdateFields = [];
                let userParams = [];
                let paramIndex = 1;

                if (name !== undefined) { userUpdateFields.push(`name = $${paramIndex++}`); userParams.push(name); }
                if (lastname !== undefined) { userUpdateFields.push(`lastname = $${paramIndex++}`); userParams.push(lastname); }
                if (photo !== undefined) { userUpdateFields.push(`photo = $${paramIndex++}`); userParams.push(photo); }
                if (email !== undefined) { userUpdateFields.push(`email = $${paramIndex++}`); userParams.push(email); }
                if (mobile !== undefined) { userUpdateFields.push(`mobile = $${paramIndex++}`); userParams.push(mobile); }
                if (gender !== undefined) { userUpdateFields.push(`gender = $${paramIndex++}`); userParams.push(gender); }
                if (id_card !== undefined) { userUpdateFields.push(`id_card = $${paramIndex++}`); userParams.push(id_card); }
                if (default_lang !== undefined) { userUpdateFields.push(`default_lang = $${paramIndex++}`); userParams.push(default_lang); }
                if (user_authority !== undefined) { userUpdateFields.push(`user_authority = $${paramIndex++}`); userParams.push(user_authority); }
                if (emp_code !== undefined) { userUpdateFields.push(`emp_code = $${paramIndex++}`); userParams.push(emp_code); }
                if (user_flag !== undefined) { userUpdateFields.push(`user_flag = $${paramIndex++}`); userParams.push(user_flag); }
                
                if (user_password && user_password.trim() !== "") {
                    const encodedPassword = xglobal.Base64.encode(user_password);
                    userUpdateFields.push(`user_password = $${paramIndex++}`); 
                    userParams.push(encodedPassword);
                }

                if (userUpdateFields.length > 0) {
                    userUpdateFields.push(`mdf_dt = $${paramIndex++}::timestamp`);
                    userParams.push(nowStr);

                    userParams.push(user_code); // PK param
                    const userScript = `
                        UPDATE tbl_users 
                        SET ${userUpdateFields.join(", ")}
                        WHERE user_code = $${paramIndex};
                    `;
                    const resUser = await pgConn.executeWithClient(client, userScript, userParams);
                    if (resUser.code) throw new Error("ไม่สามารถอัปเดตข้อมูลผู้ใช้งานได้: " + resUser.message);
                }

                // อัปเดตข้อมูลโควตา
                let quotaUpdateFields = [];
                let quotaParams = [];
                let qParamIndex = 1;

                if (monthly_quota_kwh !== undefined) { quotaUpdateFields.push(`monthly_quota_kwh = $${qParamIndex++}`); quotaParams.push(monthly_quota_kwh); }
                if (excess_rate_thb_kwh !== undefined) { quotaUpdateFields.push(`excess_rate_thb_kwh = $${qParamIndex++}`); quotaParams.push(excess_rate_thb_kwh); }
                if (idle_fee_rate_thb_min !== undefined) { quotaUpdateFields.push(`idle_fee_rate_thb_min = $${qParamIndex++}`); quotaParams.push(idle_fee_rate_thb_min); }
                if (quota_reset_date !== undefined) { quotaUpdateFields.push(`quota_reset_date = $${qParamIndex++}`); quotaParams.push(quota_reset_date); }

                if (quotaUpdateFields.length > 0) {
                    quotaUpdateFields.push(`mdf_dt = $${qParamIndex++}::timestamp`);
                    quotaParams.push(nowStr);

                    quotaParams.push(user_code); // PK param
                    const quotaScript = `
                        UPDATE tbl_user_charging_quota
                        SET ${quotaUpdateFields.join(", ")}
                        WHERE user_code = $${qParamIndex};
                    `;
                    const resQuota = await pgConn.executeWithClient(client, quotaScript, quotaParams);
                    if (resQuota.code) throw new Error("ไม่สามารถอัปเดตข้อมูลโควตาได้: " + resQuota.message);
                }

                return { user_code };
            },
            config.connectionString()
        );

        if (transactionResult.code) {
            await xglobal.action_logs(
                lic_code,
                action[0].id,
                "แก้ไขข้อมูลผู้ใช้งาน",
                JSON.stringify(req.body[0]),
                transactionResult.message,
                action[0].value
            );
            return sendResponse(
                res,
                'error',
                '-3',
                `ไม่สามารถแก้ไขข้อมูลได้, เนื่องจาก: ${transactionResult.message}`
            );
        }

        await xglobal.action_logs(
            lic_code,
            action[0].id,
            "แก้ไขข้อมูลผู้ใช้งาน",
            JSON.stringify(req.body[0]),
            "success",
            action[0].value
        );

        return sendResponse(res, 'success', '0', "แก้ไขข้อมูลผู้ใช้งานสำเร็จ");
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

// API ลบข้อมูลผู้ใช้งาน (Remove User - Soft Delete)
exports.removeUser = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { user_code, action } = req.body[0] || {};

        if (!lic_code || !user_code || !action) {
            return sendResponse(
                res,
                'error',
                '-1',
                'ข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด user_code หรือ action)'
            );
        }

        const userCodes = Array.isArray(user_code) ? user_code : [user_code];
        const placeholders = userCodes.map((_, idx) => `$${idx + 2}`).join(", ");
        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        const script = `
            UPDATE tbl_users 
            SET user_flag = 0, rm_dt = $1::timestamp
            WHERE user_code IN (${placeholders});
        `;
        const params = [nowStr, ...userCodes];

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
                "ลบข้อมูลผู้ใช้งาน",
                JSON.stringify(req.body[0]),
                result.message,
                action[0].value
            );
            return sendResponse(
                res,
                'error',
                '-3',
                "ไม่สามารถลบข้อมูลผู้ใช้งานได้"
            );
        }

        await xglobal.action_logs(
            lic_code,
            action[0].id,
            "ลบข้อมูลผู้ใช้งาน",
            JSON.stringify(req.body[0]),
            "success",
            action[0].value
        );

        return sendResponse(res, 'success', '0', "ลบข้อมูลผู้ใช้งานสำเร็จ");
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};
