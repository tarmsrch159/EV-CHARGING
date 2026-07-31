const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// Get Station Charger Connector
exports.getStationChargerConnector = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        let {
            escc_id = "ALL",
            ev_station_code = "ALL",
            charger_code = "ALL",
            connector_code = "ALL",
            search = "",
            page_index = 1,
            page_limit = 10,
            action
        } = req.body[0] || {};

        if (!lic_code || !action) {
            return sendResponse(res, 'error', '-1', 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง');
        }

        const offset = page_index > 0 ? page_index - 1 : 0;
        const conditions = ["scc.rm_dt is null", "scc.map_flag = 1", "s.station_flag = 1", "c.charger_flag = 1", "cn.connector_flag = 1"];

        if (String(escc_id).toUpperCase() !== "ALL") {
            conditions.push(`scc.escc_id = '${escc_id}'`);
        }
        if (String(ev_station_code).toUpperCase() !== "ALL") {
            conditions.push(`scc.ev_station_code = '${ev_station_code}'`);
        }
        if (String(charger_code).toUpperCase() !== "ALL") {
            conditions.push(`scc.charger_code = '${charger_code}'`);
        }
        if (String(connector_code).toUpperCase() !== "ALL") {
            conditions.push(`scc.connector_code = '${connector_code}'`);
        }

        if (search && search.trim() !== "") {
            const searchLower = search.trim().toLowerCase();
            conditions.push(`(
                lower(scc.escc_id) like '%${searchLower}%' or
                lower(s.station_name_th) like '%${searchLower}%' or
                lower(s.station_name_en) like '%${searchLower}%' or
                lower(c.charger_name) like '%${searchLower}%' or
                lower(cn.connector_name) like '%${searchLower}%' or
                lower(cn.connector_type) like '%${searchLower}%' or
                lower(cn.power_type) like '%${searchLower}%'
            )`);
        }

        const whereClause = "where " + conditions.join(" and ");

        const dataScript = `
            select 
                scc.escc_id,
                scc.ev_station_code,
                s.station_name_th,
                s.station_name_en,
                scc.charger_code,
                c.charger_name,
                c.max_total_power_kw,
                scc.connector_code,
                cn.connector_name,
                cn.connector_type,
                cn.power_type,
                cn.max_connector_power_kw,
                c.charger_status,
                cn.connector_status,
                scc.map_flag,
                scc.ist_dt,
                scc.mdf_dt
            from tbl_ev_station_charger_connector scc
            left join tbl_ev_station s on scc.ev_station_code = s.ev_station_code
            left join tbl_ev_charger c on scc.charger_code = c.charger_code
            left join tbl_ev_connector cn on scc.connector_code = cn.connector_code
            ${whereClause}
            order by scc.ist_dt desc
            offset (${offset} * ${page_limit}) limit ${page_limit};
        `;

        const result = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());
        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, "ดึงข้อมูลสถานที่จ่ายไฟ ตู้ชาร์จ และหัวจ่าย", JSON.stringify(req.body[0]), result.message, action[0].value);
            return sendResponse(res, 'error', '-3', "ไม่สามารถดึงข้อมูลได้, กรุณาติดต่อผู้ดูแลระบบ");
        }

        if (result.data.length === 0) {
            return sendResponse(res, 'success', '0', "ไม่พบข้อมูล", [], { page_total: 0, rows_total: 0 });
        }

        const data = JSON.parse(JSON.stringify(result.data).replace(/\:null/gi, '\:""'));

        const countScript = `
            select 
                count(*) as rows_total,
                ceil(count(*)::float / ${page_limit}) as page_total
            from tbl_ev_station_charger_connector scc
            left join tbl_ev_station s on scc.ev_station_code = s.ev_station_code
            left join tbl_ev_charger c on scc.charger_code = c.charger_code
            left join tbl_ev_connector cn on scc.connector_code = cn.connector_code
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

// Add Station Charger Connector
exports.addStationChargerConnector = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const {
            ev_station_code,
            charger_code,
            connector_code,
            action
        } = req.body[0] || {};

        if (!lic_code || !ev_station_code || !charger_code || !connector_code || !action) {
            return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');
        }

        const newEsccId = "escc-" + moment().format("YYYYMMDDHHmmss") + Math.floor(Math.random() * 100);
        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        // Validate ev_station_code, charger_code, connector_code
        const checkScript = `
            select 
                scc.ev_station_code, 
                tc.charger_code, 
                tco.connector_code,
                ts.station_name_th,
                tc.charger_name,
                tco.connector_name
            from tbl_ev_station_charger_connector scc
            left join tbl_ev_charger tc on scc.charger_code = tc.charger_code
            left join tbl_ev_station ts on scc.ev_station_code = ts.ev_station_code
            left join tbl_ev_connector tco on scc.connector_code = tco.connector_code
            where scc.ev_station_code = $1 and scc.charger_code = $2 and scc.connector_code = $3 and scc.rm_dt is null 
            limit 1;
        `;
        const checkConn = await pgConn.getWithParams(dbPrefix + lic_code, checkScript, [ev_station_code, charger_code, connector_code], config.connectionString());
        if (!checkConn.code && checkConn.data.length > 0) {
            return sendResponse(res, 'error', '-1', `สถานที่จ่ายไฟ '${checkConn.data[0].station_name_th}' มีหัวจ่ายชาร์จ '${checkConn.data[0].charger_name}' '${checkConn.data[0].connector_name}' นี้อยู่แล้วในระบบ`);
        }

        const script = `
            insert into tbl_ev_station_charger_connector(escc_id, ev_station_code, charger_code, connector_code, map_flag, ist_dt) 
            values ($1, $2, $3, $4, 1, $5);
        `;
        const params = [newEsccId, ev_station_code, charger_code, connector_code, nowStr];

        const result = await pgConn.execute2params(dbPrefix + lic_code, script, params, config.connectionString());
        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, "เพิ่มข้อมูลสถานที่จ่ายไฟ", JSON.stringify(req.body[0]), result.message, action[0].value);
            return sendResponse(res, 'error', '-3', "ไม่สามารถบันทึกข้อมูลสถานที่จ่ายไฟได้");
        }

        await xglobal.action_logs(lic_code, action[0].id, "เพิ่มข้อมูลสถานที่จ่ายไฟ", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "บันทึกข้อมูลสถานที่จ่ายไฟสำเร็จ", [{ escc_id: newEsccId }]);
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

// Set Station Charger Connector
exports.setStationChargerConnector = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { escc_id } = req.query;
        const {
            ev_station_code,
            charger_code,
            connector_code,
            action
        } = req.body[0] || {};

        if (!lic_code || !escc_id || !action) {
            return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');
        }

        let checkStationCharger = `select 1 from tbl_ev_station_charger_connector 
        where ev_station_code = '${ev_station_code}' 
        and charger_code = '${charger_code}' 
        and connector_code = '${connector_code}' 
        and rm_dt is null and map_flag = 1`;
        const checkStationChargerConn = await pgConn.get(dbPrefix + lic_code, checkStationCharger, config.connectionString());
        if (!checkStationChargerConn.code && checkStationChargerConn.data && checkStationChargerConn.data.length > 0) {
            return sendResponse(res, 'error', '-1', 'ข้อมูลสถานที่จ่ายไฟ ตู้ชาร์จ และหัวจ่าย ซ้ำกับข้อมูลที่มีอยู่');
        }

        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");
        let updateFields = [];
        let params = [];
        let paramIndex = 1;

        if (ev_station_code !== undefined) { updateFields.push(`ev_station_code = $${paramIndex++}`); params.push(ev_station_code); }
        if (charger_code !== undefined) { updateFields.push(`charger_code = $${paramIndex++}`); params.push(charger_code); }
        if (connector_code !== undefined) { updateFields.push(`connector_code = $${paramIndex++}`); params.push(connector_code); }

        if (updateFields.length === 0) {
            return sendResponse(res, 'error', '-1', "ไม่มีข้อมูลที่จะแก้ไข");
        }

        updateFields.push(`mdf_dt = $${paramIndex++}::timestamp`);
        params.push(nowStr);

        params.push(escc_id);
        const script = `
            update tbl_ev_station_charger_connector 
            set ${updateFields.join(", ")}
            where escc_id = $${paramIndex} and rm_dt is null;
        `;

        const result = await pgConn.execute2params(dbPrefix + lic_code, script, params, config.connectionString());
        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, "แก้ไขข้อมูลสถานที่จ่ายไฟ ตู้ชาร์จ และหัวจ่าย", JSON.stringify(req.body[0]), result.message, action[0].value);
            return sendResponse(res, 'error', '-3', "ไม่สามารถแก้ไขข้อมูลได้");
        }

        await xglobal.action_logs(lic_code, action[0].id, "แก้ไขข้อมูลสถานที่จ่ายไฟ ตู้ชาร์จ และหัวจ่าย", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "แก้ไขข้อมูลสำเร็จ");
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

// Remove Station Charger Connector (Soft Delete)
exports.removeStationChargerConnector = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { escc_id, action } = req.body[0] || {};

        if (!lic_code || !escc_id || !action) {
            return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');
        }

        const esccIds = Array.isArray(escc_id) ? escc_id : [escc_id];
        const placeholders = esccIds.map((_, idx) => `$${idx + 2}`).join(", ");
        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        const script = `
            update tbl_ev_station_charger_connector 
            set map_flag = 0, rm_dt = $1::timestamp
            where escc_id in (${placeholders});
        `;
        const params = [nowStr, ...esccIds];

        const result = await pgConn.execute2params(dbPrefix + lic_code, script, params, config.connectionString());
        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, "ลบข้อมูลสถานที่จ่ายไฟ ตู้ชาร์จ และหัวจ่าย", JSON.stringify(req.body[0]), result.message, action[0].value);
            return sendResponse(res, 'error', '-3', "ไม่สามารถลบข้อมูลได้");
        }

        await xglobal.action_logs(lic_code, action[0].id, "ลบข้อมูลสถานที่จ่ายไฟ ตู้ชาร์จ และหัวจ่าย", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "ลบข้อมูลสำเร็จ");
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};
