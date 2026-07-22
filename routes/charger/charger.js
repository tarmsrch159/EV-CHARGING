const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// API ดึงข้อมูลตู้ชาร์จ (Get Chargers Information)
exports.getChargerInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        let {
            charger_code = "ALL",
            search = "",
            page_index = 1,
            page_limit = 10,
            action
        } = req.body[0] || {};

        if (!lic_code || !action) {
            return sendResponse(res, 'error', '-1', 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง');
        }

        const offset = page_index > 0 ? page_index - 1 : 0;
        const conditions = ["c.rm_dt IS NULL", "c.charger_flag = 1"];

        if (String(charger_code).toUpperCase() !== "ALL") {
            conditions.push(`c.charger_code = '${charger_code}'`);
        }

        if (search && search.trim() !== "") {
            const searchLower = search.trim().toLowerCase();
            conditions.push(`(
                LOWER(c.charger_name) LIKE '%${searchLower}%' OR
                LOWER(s.station_name_th) LIKE '%${searchLower}%' OR
                LOWER(s.station_name_en) LIKE '%${searchLower}%'
            )`);
        }

        const whereClause = "WHERE " + conditions.join(" AND ");

        const dataScript = `
            SELECT 
                c.charger_code,
                c.ev_station_code,
                c.connector_code,
                c.charger_name,
                c.max_total_power_kw,
                c.charger_status,
                c.charger_flag,
                c.ist_dt,
                c.mdf_dt,
                s.station_name_th,
                s.station_name_en,
                cn.connector_name,
                cn.connector_type,
                cn.power_type,
                cn.max_connector_power_kw,
                cn.connector_status
            FROM tbl_ev_charger c
            LEFT JOIN tbl_ev_station s ON c.ev_station_code = s.ev_station_code
            LEFT JOIN tbl_ev_connector cn ON c.connector_code = cn.connector_code
            ${whereClause}
            ORDER BY c.ist_dt DESC
            OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};
        `;

        const result = await pgConn.get(
            dbPrefix + lic_code,
            dataScript,
            config.connectionString()
        );

        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, "ดึงข้อมูลตู้ชาร์จ", JSON.stringify(req.body[0]), result.message, action[0].value);
            return sendResponse(res, 'error', '-3', "ไม่สามารถดึงข้อมูลได้, กรุณาติดต่อผู้ดูแลระบบ");
        }

        if (result.data.length === 0) {
            return sendResponse(res, 'success', '0', "ไม่พบข้อมูล", [], { page_total: 0, rows_total: 0 });
        }

        const data = JSON.parse(JSON.stringify(result.data).replace(/\:null/gi, '\:""'));

        const countScript = `
            SELECT 
                COUNT(c.charger_code) as rows_total,
                CEIL(COUNT(c.charger_code)::float / ${page_limit}) as page_total
            FROM tbl_ev_charger c
            LEFT JOIN tbl_ev_station s ON c.ev_station_code = s.ev_station_code
            ${whereClause};
        `;
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

// API เพิ่มข้อมูลตู้ชาร์จ (Add Charger)
exports.addCharger = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const {
            ev_station_code,
            connector_code,
            charger_name,
            max_total_power_kw,
            action
        } = req.body[0] || {};

        if (!lic_code || !ev_station_code || !charger_name || max_total_power_kw === undefined || !action) {
            return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');
        }

        const newChargerCode = "chg-" + moment().format("YYYYMMDDHHmmss") + Math.floor(Math.random() * 100);
        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        const checkScript = `SELECT charger_code FROM tbl_ev_charger WHERE charger_name = $1 AND ev_station_code = $2 AND rm_dt IS NULL LIMIT 1;`;
        const checkCharger = await pgConn.getWithParams(dbPrefix + lic_code, checkScript, [charger_name, ev_station_code], config.connectionString());
        if (!checkCharger.code && checkCharger.data.length > 0) {
            return sendResponse(res, 'error', '-1', `ตู้ชาร์จ '${charger_name}' มีอยู่แล้วในสถานีนี้`);
        }

        const script = `
            INSERT INTO tbl_ev_charger (
                ev_station_code, charger_code, connector_code, charger_name,
                max_total_power_kw, charger_status, charger_flag, ist_dt
            ) VALUES ($1, $2, $3, $4, $5, $6, 1, $7);
        `;
        const params = [ev_station_code, newChargerCode, connector_code, charger_name, max_total_power_kw, 1, nowStr];

        const result = await pgConn.execute2params(dbPrefix + lic_code, script, params, config.connectionString());
        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, "เพิ่มข้อมูลตู้ชาร์จ", JSON.stringify(req.body[0]), result.message, action[0].value);
            return sendResponse(res, 'error', '-3', "ไม่สามารถบันทึกข้อมูลตู้ชาร์จได้");
        }

        await xglobal.action_logs(lic_code, action[0].id, "เพิ่มข้อมูลตู้ชาร์จ", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "บันทึกข้อมูลตู้ชาร์จสำเร็จ", [{ charger_code: newChargerCode }]);
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

// API แก้ไขข้อมูลตู้ชาร์จ (Update Charger)
exports.setCharger = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { charger_code } = req.query;
        const {
            ev_station_code,
            connector_code,
            charger_name,
            max_total_power_kw,
            charger_status,
            charger_flag,
            action
        } = req.body[0] || {};

        if (!lic_code || !charger_code || !action) {
            return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');
        }

        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");
        let updateFields = [];
        let params = [];
        let paramIndex = 1;

        if (ev_station_code !== undefined) { updateFields.push(`ev_station_code = $${paramIndex++}`); params.push(ev_station_code); }
        if (connector_code !== undefined) { updateFields.push(`connector_code = $${paramIndex++}`); params.push(connector_code); }
        if (charger_name !== undefined) { updateFields.push(`charger_name = $${paramIndex++}`); params.push(charger_name); }
        if (max_total_power_kw !== undefined) { updateFields.push(`max_total_power_kw = $${paramIndex++}`); params.push(max_total_power_kw); }
        if (charger_status !== undefined) { updateFields.push(`charger_status = $${paramIndex++}`); params.push(charger_status); }
        if (charger_flag !== undefined) { updateFields.push(`charger_flag = $${paramIndex++}`); params.push(charger_flag); }

        if (updateFields.length === 0) {
            return sendResponse(res, 'error', '-1', "ไม่มีข้อมูลที่จะแก้ไข");
        }

        updateFields.push(`mdf_dt = $${paramIndex++}::timestamp`);
        params.push(nowStr);

        params.push(charger_code); // PK param
        const script = `
            UPDATE tbl_ev_charger 
            SET ${updateFields.join(", ")}
            WHERE charger_code = $${paramIndex};
        `;

        const result = await pgConn.execute2params(dbPrefix + lic_code, script, params, config.connectionString());
        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, "แก้ไขข้อมูลตู้ชาร์จ", JSON.stringify(req.body[0]), result.message, action[0].value);
            return sendResponse(res, 'error', '-3', "ไม่สามารถแก้ไขข้อมูลตู้ชาร์จได้");
        }

        await xglobal.action_logs(lic_code, action[0].id, "แก้ไขข้อมูลตู้ชาร์จ", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "แก้ไขข้อมูลตู้ชาร์จสำเร็จ");
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

// API ลบข้อมูลตู้ชาร์จ (Remove Charger - Soft Delete)
exports.removeCharger = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { charger_code, action } = req.body[0] || {};

        if (!lic_code || !charger_code || !action) {
            return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');
        }

        const chargerCodes = Array.isArray(charger_code) ? charger_code : [charger_code];
        const placeholders = chargerCodes.map((_, idx) => `$${idx + 2}`).join(", ");
        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        const script = `
            UPDATE tbl_ev_charger 
            SET charger_flag = 0, rm_dt = $1::timestamp
            WHERE charger_code IN (${placeholders});
        `;
        const params = [nowStr, ...chargerCodes];

        const result = await pgConn.execute2params(dbPrefix + lic_code, script, params, config.connectionString());
        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, "ลบข้อมูลตู้ชาร์จ", JSON.stringify(req.body[0]), result.message, action[0].value);
            return sendResponse(res, 'error', '-3', "ไม่สามารถลบข้อมูลตู้ชาร์จได้");
        }

        await xglobal.action_logs(lic_code, action[0].id, "ลบข้อมูลตู้ชาร์จ", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "ลบข้อมูลตู้ชาร์จสำเร็จ");
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

// API ดึงข้อมูลหัวจ่ายชาร์จ (Get Connector Information)
exports.getConnectorInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        let {
            connector_code = "ALL",
            charger_code = "ALL",
            search = "",
            page_index = 1,
            page_limit = 10,
            action
        } = req.body[0] || {};

        if (!lic_code || !action) {
            return sendResponse(res, 'error', '-1', 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง');
        }

        const offset = page_index > 0 ? page_index - 1 : 0;
        const conditions = ["rm_dt IS NULL", "connector_flag = 1"];

        if (String(connector_code).toUpperCase() !== "ALL") {
            conditions.push(`connector_code = '${connector_code}'`);
        }
        if (String(charger_code).toUpperCase() !== "ALL") {
            conditions.push(`charger_code = '${charger_code}'`);
        }

        if (search && search.trim() !== "") {
            const searchLower = search.trim().toLowerCase();
            conditions.push(`(
                LOWER(connector_name) LIKE '%${searchLower}%' OR
                LOWER(connector_type) LIKE '%${searchLower}%' OR
                LOWER(power_type) LIKE '%${searchLower}%'
            )`);
        }

        const whereClause = "WHERE " + conditions.join(" AND ");

        const dataScript = `
            SELECT 
                connector_code,
                charger_code,
                connector_name,
                connector_type,
                power_type,
                max_connector_power_kw,
                connector_status,
                connector_flag,
                ist_dt,
                mdf_dt
            FROM tbl_ev_connector
            ${whereClause}
            ORDER BY ist_dt DESC
            OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};
        `;

        const result = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());
        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, "ดึงข้อมูลหัวจ่ายชาร์จ", JSON.stringify(req.body[0]), result.message, action[0].value);
            return sendResponse(res, 'error', '-3', "ไม่สามารถดึงข้อมูลได้, กรุณาติดต่อผู้ดูแลระบบ");
        }

        if (result.data.length === 0) {
            return sendResponse(res, 'success', '0', "ไม่พบข้อมูล", [], { page_total: 0, rows_total: 0 });
        }

        const data = JSON.parse(JSON.stringify(result.data).replace(/\:null/gi, '\:""'));

        const countScript = `
            SELECT 
                COUNT(connector_code) as rows_total,
                CEIL(COUNT(connector_code)::float / ${page_limit}) as page_total
            FROM tbl_ev_connector
            ${whereClause};
        `;
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

// API เพิ่มข้อมูลหัวจ่ายชาร์จ (Add Connector)
exports.addConnector = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const {
            charger_code,
            connector_name,
            connector_type,
            power_type,
            max_connector_power_kw,
            connector_status = 1,
            action
        } = req.body[0] || {};

        if (!lic_code || !charger_code || !connector_name || !connector_type || !power_type || max_connector_power_kw === undefined || !action) {
            return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');
        }

        const newConnectorCode = "con-" + moment().format("YYYYMMDDHHmmss") + Math.floor(Math.random() * 100);
        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        const checkScript = `SELECT connector_code FROM tbl_ev_connector WHERE connector_name = $1 AND charger_code = $2 AND rm_dt IS NULL LIMIT 1;`;
        const checkConn = await pgConn.getWithParams(dbPrefix + lic_code, checkScript, [connector_name, charger_code], config.connectionString());
        if (!checkConn.code && checkConn.data.length > 0) {
            return sendResponse(res, 'error', '-1', `หัวจ่ายชาร์จ '${connector_name}' มีอยู่แล้วในตู้ชาร์จนี้`);
        }

        const script = `
            INSERT INTO tbl_ev_connector (
                connector_code, charger_code, connector_name, connector_type,
                power_type, max_connector_power_kw, connector_status, connector_flag, ist_dt
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8);
        `;
        const params = [newConnectorCode, charger_code, connector_name, connector_type, power_type, max_connector_power_kw, connector_status, nowStr];

        const result = await pgConn.execute2params(dbPrefix + lic_code, script, params, config.connectionString());
        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, "เพิ่มข้อมูลหัวจ่ายชาร์จ", JSON.stringify(req.body[0]), result.message, action[0].value);
            return sendResponse(res, 'error', '-3', "ไม่สามารถบันทึกข้อมูลหัวจ่ายชาร์จได้");
        }

        await xglobal.action_logs(lic_code, action[0].id, "เพิ่มข้อมูลหัวจ่ายชาร์จ", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "บันทึกข้อมูลหัวจ่ายชาร์จสำเร็จ", [{ connector_code: newConnectorCode }]);
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

// API แก้ไขข้อมูลหัวจ่ายชาร์จ (Update Connector)
exports.setConnector = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { connector_code } = req.query;
        const {
            charger_code,
            connector_name,
            connector_type,
            power_type,
            max_connector_power_kw,
            connector_status,
            connector_flag,
            action
        } = req.body[0] || {};

        if (!lic_code || !connector_code || !action) {
            return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');
        }

        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");
        let updateFields = [];
        let params = [];
        let paramIndex = 1;

        if (charger_code !== undefined) { updateFields.push(`charger_code = $${paramIndex++}`); params.push(charger_code); }
        if (connector_name !== undefined) { updateFields.push(`connector_name = $${paramIndex++}`); params.push(connector_name); }
        if (connector_type !== undefined) { updateFields.push(`connector_type = $${paramIndex++}`); params.push(connector_type); }
        if (power_type !== undefined) { updateFields.push(`power_type = $${paramIndex++}`); params.push(power_type); }
        if (max_connector_power_kw !== undefined) { updateFields.push(`max_connector_power_kw = $${paramIndex++}`); params.push(max_connector_power_kw); }
        if (connector_status !== undefined) { updateFields.push(`connector_status = $${paramIndex++}`); params.push(connector_status); }
        if (connector_flag !== undefined) { updateFields.push(`connector_flag = $${paramIndex++}`); params.push(connector_flag); }

        if (updateFields.length === 0) {
            return sendResponse(res, 'error', '-1', "ไม่มีข้อมูลที่จะแก้ไข");
        }

        updateFields.push(`mdf_dt = $${paramIndex++}::timestamp`);
        params.push(nowStr);

        params.push(connector_code); // PK param
        const script = `
            UPDATE tbl_ev_connector 
            SET ${updateFields.join(", ")}
            WHERE connector_code = $${paramIndex};
        `;

        const result = await pgConn.execute2params(dbPrefix + lic_code, script, params, config.connectionString());
        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, "แก้ไขข้อมูลหัวจ่ายชาร์จ", JSON.stringify(req.body[0]), result.message, action[0].value);
            return sendResponse(res, 'error', '-3', "ไม่สามารถแก้ไขข้อมูลหัวจ่ายชาร์จได้");
        }

        await xglobal.action_logs(lic_code, action[0].id, "แก้ไขข้อมูลหัวจ่ายชาร์จ", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "แก้ไขข้อมูลหัวจ่ายชาร์จสำเร็จ");
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

// API ลบข้อมูลหัวจ่ายชาร์จ (Remove Connector - Soft Delete)
exports.removeConnector = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { connector_code, action } = req.body[0] || {};

        if (!lic_code || !connector_code || !action) {
            return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');
        }

        const connectorCodes = Array.isArray(connector_code) ? connector_code : [connector_code];
        const placeholders = connectorCodes.map((_, idx) => `$${idx + 2}`).join(", ");
        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        const script = `
            UPDATE tbl_ev_connector 
            SET connector_flag = 0, rm_dt = $1::timestamp
            WHERE connector_code IN (${placeholders});
        `;
        const params = [nowStr, ...connectorCodes];

        const result = await pgConn.execute2params(dbPrefix + lic_code, script, params, config.connectionString());
        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, "ลบข้อมูลหัวจ่ายชาร์จ", JSON.stringify(req.body[0]), result.message, action[0].value);
            return sendResponse(res, 'error', '-3', "ไม่สามารถลบข้อมูลหัวจ่ายชาร์จได้");
        }

        await xglobal.action_logs(lic_code, action[0].id, "ลบข้อมูลหัวจ่ายชาร์จ", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "ลบข้อมูลหัวจ่ายชาร์จสำเร็จ");
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};
