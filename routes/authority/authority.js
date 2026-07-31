const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// API ดึงข้อมูลสิทธิ์การใช้งาน (Get Authority Information)
exports.getAuthorityInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        let {
            authority_code = "ALL",
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
        const conditions = ["rm_dt IS NULL", "authority_flag = 1"];

        if (String(authority_code).toUpperCase() !== "ALL") {
            conditions.push(`authority_code = '${authority_code}'`);
        }

        if (search && search.trim() !== "") {
            const searchLower = search.trim().toLowerCase();
            conditions.push(`LOWER(authority_name) LIKE '%${searchLower}%'`);
        }

        const whereClause = "WHERE " + conditions.join(" AND ");

        const dataScript = `
            SELECT 
                authority_code,
                authority_name,
                permission_role,
                authority_flag,
                ist_dt
            FROM tbl_authority
            ${whereClause}
            ORDER BY permission_role ASC
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
                "ดึงข้อมูลสิทธิ์การใช้งาน",
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
                COUNT(authority_code) as rows_total,
                CEIL(COUNT(authority_code)::float / ${page_limit}) as page_total
            FROM tbl_authority
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

// API เพิ่มสิทธิ์การใช้งาน (Add Authority)
exports.addAuthority = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const {
            authority_name,
            permission_role,
            action
        } = req.body[0] || {};

        if (!lic_code || !authority_name || !action) {
            return sendResponse(
                res,
                'error',
                '-1',
                'ข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด authority_name หรือ action)'
            );
        }

        const newAuthCode = "auth-" + moment().format("YYYYMMDDHHmmss") + Math.floor(Math.random() * 100);
        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        const checkScript = `SELECT authority_code FROM tbl_authority WHERE authority_name = $1 AND rm_dt IS NULL LIMIT 1;`;
        const checkAuth = await pgConn.getWithParams(
            dbPrefix + lic_code,
            checkScript,
            [authority_name],
            config.connectionString()
        );

        if (!checkAuth.code && checkAuth.data.length > 0) {
            return sendResponse(res, 'error', '-1', `สิทธิ์ '${authority_name}' นี้มีอยู่ในระบบแล้ว`);
        }

        const script = `
            INSERT INTO tbl_authority (
                authority_code, authority_name, ist_dt, authority_flag, permission_role
            ) VALUES ($1, $2, $3, 1, $4);
        `;
        const params = [newAuthCode, authority_name, nowStr, permission_role];

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
                "เพิ่มข้อมูลสิทธิ์การใช้งาน",
                JSON.stringify(req.body[0]),
                result.message,
                action[0].value
            );
            return sendResponse(res, 'error', '-3', "ไม่สามารถบันทึกสิทธิ์การใช้งานได้");
        }

        await xglobal.action_logs(
            lic_code,
            action[0].id,
            "เพิ่มข้อมูลสิทธิ์การใช้งาน",
            JSON.stringify(req.body[0]),
            "success",
            action[0].value
        );

        return sendResponse(res, 'success', '0', "บันทึกข้อมูลสิทธิ์สำเร็จ", [{ authority_code: newAuthCode }]);
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

// API แก้ไขสิทธิ์การใช้งาน (Update Authority)
exports.setAuthority = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { authority_code } = req.query;
        const {
            authority_name,
            action
        } = req.body[0] || {};

        if (!lic_code || !authority_code || !authority_name || !action) {
            return sendResponse(
                res,
                'error',
                '-1',
                'ข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด authority_code, authority_name หรือ action)'
            );
        }

        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        const script = `
            UPDATE tbl_authority 
            SET authority_name = $1, mdf_dt = $2::timestamp
            WHERE authority_code = $3;
        `;
        const params = [authority_name, nowStr, authority_code];

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
                "แก้ไขข้อมูลสิทธิ์การใช้งาน",
                JSON.stringify(req.body[0]),
                result.message,
                action[0].value
            );
            return sendResponse(res, 'error', '-3', "ไม่สามารถแก้ไขสิทธิ์การใช้งานได้");
        }

        await xglobal.action_logs(
            lic_code,
            action[0].id,
            "แก้ไขข้อมูลสิทธิ์การใช้งาน",
            JSON.stringify(req.body[0]),
            "success",
            action[0].value
        );

        return sendResponse(res, 'success', '0', "แก้ไขข้อมูลสิทธิ์สำเร็จ");
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

// API ลบสิทธิ์การใช้งาน (Remove Authority - Soft Delete)
exports.removeAuthority = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { authority_code, action } = req.body[0] || {};

        if (!lic_code || !authority_code || !action) {
            return sendResponse(
                res,
                'error',
                '-1',
                'ข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด authority_code หรือ action)'
            );
        }

        const authCodes = Array.isArray(authority_code) ? authority_code : [authority_code];
        const placeholdersV2 = authCodes.map((code) => {
            return `'${code}'`;
        }).join(", ");
        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");
        const script = `
            UPDATE tbl_authority 
            SET authority_flag = 0, rm_dt = '${nowStr}'::timestamp
            WHERE authority_code IN (${placeholdersV2});
        `;

        const result = await pgConn.execute(
            dbPrefix + lic_code,
            script,
            config.connectionString()
        );

        if (result.code) {
            await xglobal.action_logs(
                lic_code,
                action[0].id,
                "ลบข้อมูลสิทธิ์การใช้งาน",
                JSON.stringify(req.body[0]),
                result.message,
                action[0].value
            );
            return sendResponse(res, 'error', '-3', "ไม่สามารถลบสิทธิ์การใช้งานได้");
        }

        await xglobal.action_logs(
            lic_code,
            action[0].id,
            "ลบข้อมูลสิทธิ์การใช้งาน",
            JSON.stringify(req.body[0]),
            "success",
            action[0].value
        );

        return sendResponse(res, 'success', '0', "ลบข้อมูลสิทธิ์สำเร็จ");
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};
