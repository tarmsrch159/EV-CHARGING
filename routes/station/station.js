const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// API ดึงข้อมูลสถานีชาร์จ (Get EV Station Information)
exports.getStationInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        let {
            ev_station_code = "ALL",
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
        const conditions = ["rm_dt IS NULL", "station_flag = 1"];

        if (String(ev_station_code).toUpperCase() !== "ALL") {
            conditions.push(`ev_station_code = '${ev_station_code}'`);
        }

        if (search && search.trim() !== "") {
            const searchLower = search.trim().toLowerCase();
            conditions.push(`(
                LOWER(station_name_th) LIKE '%${searchLower}%' OR 
                LOWER(station_name_en) LIKE '%${searchLower}%' OR
                LOWER(location_description) LIKE '%${searchLower}%'
            )`);
        }

        const whereClause = "WHERE " + conditions.join(" AND ");

        const dataScript = `
            SELECT 
                ev_station_code,
                station_name_th,
                station_name_en,
                location_description,
                latitude,
                longitude,
                opening_time,
                closing_time,
                ist_dt,
                mdf_dt,
                station_flag
            FROM tbl_ev_station
            ${whereClause}
            ORDER BY ist_dt DESC
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
                "ดึงข้อมูลสถานีชาร์จ",
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
                COUNT(ev_station_code) as rows_total,
                CEIL(COUNT(ev_station_code)::float / ${page_limit}) as page_total
            FROM tbl_ev_station
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

// API เพิ่มข้อมูลสถานีชาร์จ (Add Station)
exports.addStation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const {
            station_name_th,
            station_name_en = "",
            location_description = "",
            latitude = null,
            longitude = null,
            opening_time = null,
            closing_time = null,
            action
        } = req.body[0] || {};

        if (!lic_code || !station_name_th || !action) {
            return sendResponse(
                res,
                'error',
                '-1',
                'ข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด station_name_th หรือ action)'
            );
        }

        const newStationCode = "sta-" + moment().format("YYYYMMDDHHmmss") + Math.floor(Math.random() * 100);
        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        const checkScript = `SELECT ev_station_code FROM tbl_ev_station WHERE station_name_th = $1 AND rm_dt IS NULL LIMIT 1;`;
        const checkStation = await pgConn.getWithParams(
            dbPrefix + lic_code,
            checkScript,
            [station_name_th],
            config.connectionString()
        );

        if (!checkStation.code && checkStation.data.length > 0) {
            return sendResponse(res, 'error', '-1', `สถานี '${station_name_th}' นี้มีอยู่ในระบบแล้ว`);
        }

        const script = `
            INSERT INTO tbl_ev_station (
                ev_station_code, station_name_th, station_name_en, location_description,
                latitude, longitude, opening_time, closing_time, ist_dt, station_flag
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1);
        `;
        const params = [
            newStationCode, station_name_th, station_name_en, location_description,
            latitude, longitude, opening_time, closing_time, nowStr
        ];

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
                "เพิ่มข้อมูลสถานีชาร์จ",
                JSON.stringify(req.body[0]),
                result.message,
                action[0].value
            );
            return sendResponse(res, 'error', '-3', "ไม่สามารถบันทึกข้อมูลสถานีชาร์จได้");
        }

        await xglobal.action_logs(
            lic_code,
            action[0].id,
            "เพิ่มข้อมูลสถานีชาร์จ",
            JSON.stringify(req.body[0]),
            "success",
            action[0].value
        );

        return sendResponse(res, 'success', '0', "บันทึกข้อมูลสถานีชาร์จสำเร็จ", [{ ev_station_code: newStationCode }]);
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

// API แก้ไขข้อมูลสถานีชาร์จ (Update Station)
exports.setStation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { ev_station_code } = req.query;
        const {
            station_name_th,
            station_name_en,
            location_description,
            latitude,
            longitude,
            opening_time,
            closing_time,
            station_flag,
            action
        } = req.body[0] || {};

        if (!lic_code || !ev_station_code || !action) {
            return sendResponse(
                res,
                'error',
                '-1',
                'ข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด ev_station_code หรือ action)'
            );
        }

        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        let updateFields = [];
        let params = [];
        let paramIndex = 1;

        if (station_name_th !== undefined) { updateFields.push(`station_name_th = $${paramIndex++}`); params.push(station_name_th); }
        if (station_name_en !== undefined) { updateFields.push(`station_name_en = $${paramIndex++}`); params.push(station_name_en); }
        if (location_description !== undefined) { updateFields.push(`location_description = $${paramIndex++}`); params.push(location_description); }
        if (latitude !== undefined) { updateFields.push(`latitude = $${paramIndex++}`); params.push(latitude); }
        if (longitude !== undefined) { updateFields.push(`longitude = $${paramIndex++}`); params.push(longitude); }
        if (opening_time !== undefined) { updateFields.push(`opening_time = $${paramIndex++}`); params.push(opening_time); }
        if (closing_time !== undefined) { updateFields.push(`closing_time = $${paramIndex++}`); params.push(closing_time); }
        if (station_flag !== undefined) { updateFields.push(`station_flag = $${paramIndex++}`); params.push(station_flag); }

        if (updateFields.length === 0) {
            return sendResponse(res, 'error', '-1', "ไม่มีข้อมูลที่จะแก้ไข");
        }

        updateFields.push(`mdf_dt = $${paramIndex++}::timestamp`);
        params.push(nowStr);

        params.push(ev_station_code); // PK param
        const script = `
            UPDATE tbl_ev_station 
            SET ${updateFields.join(", ")}
            WHERE ev_station_code = $${paramIndex};
        `;

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
                "แก้ไขข้อมูลสถานีชาร์จ",
                JSON.stringify(req.body[0]),
                result.message,
                action[0].value
            );
            return sendResponse(res, 'error', '-3', "ไม่สามารถแก้ไขข้อมูลสถานีชาร์จได้");
        }

        await xglobal.action_logs(
            lic_code,
            action[0].id,
            "แก้ไขข้อมูลสถานีชาร์จ",
            JSON.stringify(req.body[0]),
            "success",
            action[0].value
        );

        return sendResponse(res, 'success', '0', "แก้ไขข้อมูลสถานีชาร์จสำเร็จ");
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

// API ลบข้อมูลสถานีชาร์จ (Remove Station - Soft Delete)
exports.removeStation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { ev_station_code, action } = req.body[0] || {};

        if (!lic_code || !ev_station_code || !action) {
            return sendResponse(
                res,
                'error',
                '-1',
                'ข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด ev_station_code หรือ action)'
            );
        }


        const stationCodes = Array.isArray(ev_station_code) ? ev_station_code : [ev_station_code];
        const placeholders = stationCodes.map((_, idx) => `$${idx + 2}`).join(", ");
        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");
        const script = `
            UPDATE tbl_ev_station 
            SET station_flag = 0, rm_dt = $1::timestamp
            WHERE ev_station_code IN (${placeholders});
        `;
        const params = [nowStr, ...stationCodes];

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
                "ลบข้อมูลสถานีชาร์จ",
                JSON.stringify(req.body[0]),
                result.message,
                action[0].value
            );
            return sendResponse(res, 'error', '-3', "ไม่สามารถลบข้อมูลสถานีชาร์จได้");
        }

        await xglobal.action_logs(
            lic_code,
            action[0].id,
            "ลบข้อมูลสถานีชาร์จ",
            JSON.stringify(req.body[0]),
            "success",
            action[0].value
        );

        return sendResponse(res, 'success', '0', "ลบข้อมูลสถานีชาร์จสำเร็จ");
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};
