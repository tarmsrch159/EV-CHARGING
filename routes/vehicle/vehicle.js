const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// 1. BRAND CRUD (tbl_vehicle_brand)
exports.getBrand = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        let { brand_code = "ALL", search = "", page_index = 1, page_limit = 10, action } = req.body[0] || {};
        if (!lic_code || !action) return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');

        const offset = page_index > 0 ? page_index - 1 : 0;
        const conditions = ["rm_dt IS NULL", "brand_flag = 1"];
        if (String(brand_code).toUpperCase() !== "ALL") conditions.push(`brand_code = '${brand_code}'`);
        if (search && search.trim() !== "") conditions.push(`LOWER(brand_name) LIKE '%${search.trim().toLowerCase()}%'`);

        const whereClause = "WHERE " + conditions.join(" AND ");
        const dataScript = `SELECT brand_code, brand_name, brand_flag, ist_dt, mdf_dt FROM tbl_vehicle_brand ${whereClause} ORDER BY ist_dt DESC OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};`;

        const result = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());
        if (result.code) return sendResponse(res, 'error', '-3', "ไม่สามารถดึงข้อมูลได้");

        if (result.data.length === 0) return sendResponse(res, 'success', '0', "ไม่พบข้อมูล", [], { page_total: 0, rows_total: 0 });
        const data = JSON.parse(JSON.stringify(result.data).replace(/\:null/gi, '\:""'));

        const countScript = `SELECT COUNT(brand_code) as rows_total, CEIL(COUNT(brand_code)::float / ${page_limit}) as page_total FROM tbl_vehicle_brand ${whereClause};`;
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

exports.addBrand = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { brand_name, action } = req.body[0] || {};
        if (!lic_code || !brand_name || !action) return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');

        const newCode = "brd-" + moment().format("YYYYMMDDHHmmss") + Math.floor(Math.random() * 100);
        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        const checkScript = `SELECT brand_code FROM tbl_vehicle_brand WHERE brand_name = $1 AND rm_dt IS NULL LIMIT 1;`;
        const checkBrand = await pgConn.getWithParams(dbPrefix + lic_code, checkScript, [brand_name], config.connectionString());
        if (!checkBrand.code && checkBrand.data.length > 0) return sendResponse(res, 'error', '-1', `ยี่ห้อรถยนต์ '${brand_name}' นี้มีอยู่ในระบบแล้ว`);

        const script = `INSERT INTO tbl_vehicle_brand (brand_code, brand_name, brand_flag, ist_dt) VALUES ($1, $2, 1, $3);`;
        const result = await pgConn.execute2params(dbPrefix + lic_code, script, [newCode, brand_name, nowStr], config.connectionString());
        if (result.code) return sendResponse(res, 'error', '-3', "ไม่สามารถบันทึกข้อมูลยี่ห้อรถยนต์ได้");

        await xglobal.action_logs(lic_code, action[0].id, "เพิ่มยี่ห้อรถยนต์", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "บันทึกข้อมูลสำเร็จ", [{ brand_code: newCode }]);
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

exports.setBrand = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { brand_code } = req.query;
        const { brand_name, brand_flag, action } = req.body[0] || {};
        if (!lic_code || !brand_code || !action) return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');

        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");
        let updateFields = [];
        let params = [];
        let index = 1;

        if (brand_name !== undefined) { updateFields.push(`brand_name = $${index++}`); params.push(brand_name); }
        if (brand_flag !== undefined) { updateFields.push(`brand_flag = $${index++}`); params.push(brand_flag); }

        if (updateFields.length === 0) return sendResponse(res, 'error', '-1', "ไม่มีข้อมูลที่จะแก้ไข");
        updateFields.push(`mdf_dt = $${index++}::timestamp`); params.push(nowStr);
        params.push(brand_code); // PK

        const script = `UPDATE tbl_vehicle_brand SET ${updateFields.join(", ")} WHERE brand_code = $${index};`;
        const result = await pgConn.execute2params(dbPrefix + lic_code, script, params, config.connectionString());
        if (result.code) return sendResponse(res, 'error', '-3', "ไม่สามารถแก้ไขยี่ห้อรถยนต์ได้");

        await xglobal.action_logs(lic_code, action[0].id, "แก้ไขยี่ห้อรถยนต์", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "แก้ไขสำเร็จ");
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

exports.removeBrand = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { brand_code, action } = req.body[0] || {};
        if (!lic_code || !brand_code || !action) return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');

        const codes = Array.isArray(brand_code) ? brand_code : [brand_code];
        const placeholders = codes.map((_, i) => `$${i + 2}`).join(", ");
        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        const script = `UPDATE tbl_vehicle_brand SET brand_flag = 0, rm_dt = $1::timestamp WHERE brand_code IN (${placeholders});`;
        const result = await pgConn.execute2params(dbPrefix + lic_code, script, [nowStr, ...codes], config.connectionString());
        if (result.code) return sendResponse(res, 'error', '-3', "ไม่สามารถลบยี่ห้อรถยนต์ได้");

        await xglobal.action_logs(lic_code, action[0].id, "ลบยี่ห้อรถยนต์", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "ลบสำเร็จ");
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

// 2. MODEL CRUD (tbl_vehicle_model)
exports.getModel = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        let { model_code = "ALL", search = "", page_index = 1, page_limit = 10, action } = req.body[0] || {};
        if (!lic_code || !action) return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');

        const offset = page_index > 0 ? page_index - 1 : 0;
        const conditions = ["m.rm_dt IS NULL", "m.model_flag = 1"];
        if (String(model_code).toUpperCase() !== "ALL") conditions.push(`m.model_code = '${model_code}'`);
        if (search && search.trim() !== "") conditions.push(`(LOWER(m.model_name) LIKE '%${search.trim().toLowerCase()}%' OR LOWER(b.brand_name) LIKE '%${search.trim().toLowerCase()}%')`);

        const whereClause = "WHERE " + conditions.join(" AND ");
        const dataScript = `
            SELECT m.model_code, m.model_name, m.brand_code, m.model_flag, m.ist_dt, m.mdf_dt, b.brand_name 
            FROM tbl_vehicle_model m 
            LEFT JOIN tbl_vehicle_brand b ON m.brand_code = b.brand_code 
            ${whereClause} 
            ORDER BY m.ist_dt DESC 
            OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};
        `;

        const result = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());
        if (result.code) return sendResponse(res, 'error', '-3', "ไม่สามารถดึงข้อมูลได้");

        if (result.data.length === 0) return sendResponse(res, 'success', '0', "ไม่พบข้อมูล", [], { page_total: 0, rows_total: 0 });
        const data = JSON.parse(JSON.stringify(result.data).replace(/\:null/gi, '\:""'));

        const countScript = `SELECT COUNT(m.model_code) as rows_total, CEIL(COUNT(m.model_code)::float / ${page_limit}) as page_total FROM tbl_vehicle_model m LEFT JOIN tbl_vehicle_brand b ON m.brand_code = b.brand_code ${whereClause};`;
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

exports.addModel = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { brand_code, model_name, action } = req.body[0] || {};
        if (!lic_code || !brand_code || !model_name || !action) return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');

        const newCode = "mdl-" + moment().format("YYYYMMDDHHmmss") + Math.floor(Math.random() * 100);
        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        const checkScript = `SELECT model_code FROM tbl_vehicle_model WHERE model_name = $1 AND brand_code = $2 AND rm_dt IS NULL LIMIT 1;`;
        const checkModel = await pgConn.getWithParams(dbPrefix + lic_code, checkScript, [model_name, brand_code], config.connectionString());
        if (!checkModel.code && checkModel.data.length > 0) return sendResponse(res, 'error', '-1', `รุ่นรถยนต์ '${model_name}' ภายใต้ยี่ห้อที่ระบุมีอยู่ในระบบแล้ว`);

        const script = `INSERT INTO tbl_vehicle_model (brand_code, model_code, model_name, model_flag, ist_dt) VALUES ($1, $2, $3, 1, $4);`;
        const result = await pgConn.execute2params(dbPrefix + lic_code, script, [brand_code, newCode, model_name, nowStr], config.connectionString());
        if (result.code) return sendResponse(res, 'error', '-3', "ไม่สามารถบันทึกข้อมูลรุ่นรถยนต์ได้");

        await xglobal.action_logs(lic_code, action[0].id, "เพิ่มรุ่นรถยนต์", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "บันทึกข้อมูลสำเร็จ", [{ model_code: newCode }]);
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

exports.setModel = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { model_code } = req.query;
        const { brand_code, model_name, model_flag, action } = req.body[0] || {};
        if (!lic_code || !model_code || !action) return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');

        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");
        let updateFields = [];
        let params = [];
        let index = 1;

        if (brand_code !== undefined) { updateFields.push(`brand_code = $${index++}`); params.push(brand_code); }
        if (model_name !== undefined) { updateFields.push(`model_name = $${index++}`); params.push(model_name); }
        if (model_flag !== undefined) { updateFields.push(`model_flag = $${index++}`); params.push(model_flag); }

        if (updateFields.length === 0) return sendResponse(res, 'error', '-1', "ไม่มีข้อมูลที่จะแก้ไข");
        updateFields.push(`mdf_dt = $${index++}::timestamp`); params.push(nowStr);
        params.push(model_code);

        const script = `UPDATE tbl_vehicle_model SET ${updateFields.join(", ")} WHERE model_code = $${index};`;
        const result = await pgConn.execute2params(dbPrefix + lic_code, script, params, config.connectionString());
        if (result.code) return sendResponse(res, 'error', '-3', "ไม่สามารถแก้ไขรุ่นรถยนต์ได้");

        await xglobal.action_logs(lic_code, action[0].id, "แก้ไขรุ่นรถยนต์", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "แก้ไขสำเร็จ");
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

exports.removeModel = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { model_code, action } = req.body[0] || {};
        if (!lic_code || !model_code || !action) return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');

        const codes = Array.isArray(model_code) ? model_code : [model_code];
        const placeholders = codes.map((_, i) => `$${i + 2}`).join(", ");
        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        const script = `UPDATE tbl_vehicle_model SET model_flag = 0, rm_dt = $1::timestamp WHERE model_code IN (${placeholders});`;
        const result = await pgConn.execute2params(dbPrefix + lic_code, script, [nowStr, ...codes], config.connectionString());
        if (result.code) return sendResponse(res, 'error', '-3', "ไม่สามารถลบรุ่นรถยนต์ได้");

        await xglobal.action_logs(lic_code, action[0].id, "ลบรุ่นรถยนต์", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "ลบสำเร็จ");
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

// 3. VEHICLE TYPE CRUD (tbl_vehicle_type)
exports.getType = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        let { veh_type_code = "ALL", search = "", page_index = 1, page_limit = 10, action } = req.body[0] || {};
        if (!lic_code || !action) return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');

        const offset = page_index > 0 ? page_index - 1 : 0;
        const conditions = ["rm_dt IS NULL", "veh_type_flag = 1"];
        if (String(veh_type_code).toUpperCase() !== "ALL") conditions.push(`veh_type_code = '${veh_type_code}'`);
        if (search && search.trim() !== "") conditions.push(`LOWER(veh_type_name) LIKE '%${search.trim().toLowerCase()}%'`);

        const whereClause = "WHERE " + conditions.join(" AND ");
        const dataScript = `
            SELECT veh_type_code, veh_type_name, width, height, length, min_dimention, max_dimention, 
                   min_percent_dimention, min_weight, max_weight, over_weight, speed_limit, box_limit, passenger_limit, 
                   ist_dt, mdf_dt, trash, veh_type_flag 
            FROM tbl_vehicle_type 
            ${whereClause} 
            ORDER BY ist_dt DESC 
            OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};
        `;

        const result = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());
        if (result.code) return sendResponse(res, 'error', '-3', "ไม่สามารถดึงข้อมูลประเภทรถยนต์ได้");

        if (result.data.length === 0) return sendResponse(res, 'success', '0', "ไม่พบข้อมูล", [], { page_total: 0, rows_total: 0 });
        const data = JSON.parse(JSON.stringify(result.data).replace(/\:null/gi, '\:""'));

        const countScript = `SELECT COUNT(veh_type_code) as rows_total, CEIL(COUNT(veh_type_code)::float / ${page_limit}) as page_total FROM tbl_vehicle_type ${whereClause};`;
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

exports.addType = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const {
            veh_type_name, width = null, height = null, length = null, speed_limit = null, passenger_limit = null, action
        } = req.body[0] || {};
        if (!lic_code || !veh_type_name || !action) return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');

        const newCode = "typ-" + moment().format("YYYYMMDDHHmmss") + Math.floor(Math.random() * 100);
        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        const script = `
            INSERT INTO tbl_vehicle_type (
                veh_type_code, veh_type_name, width, height, length, speed_limit, passenger_limit, ist_dt, trash, veh_type_flag
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, 1);
        `;
        const params = [newCode, veh_type_name, width, height, length, speed_limit, passenger_limit, nowStr];

        const result = await pgConn.execute2params(dbPrefix + lic_code, script, params, config.connectionString());
        if (result.code) return sendResponse(res, 'error', '-3', "ไม่สามารถบันทึกข้อมูลประเภทรถยนต์ได้");

        await xglobal.action_logs(lic_code, action[0].id, "เพิ่มประเภทรถยนต์", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "บันทึกข้อมูลสำเร็จ", [{ veh_type_code: newCode }]);
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

exports.setType = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { veh_type_code } = req.query;
        const {
            veh_type_name, width, height, length, speed_limit, passenger_limit, veh_type_flag, action
        } = req.body[0] || {};
        if (!lic_code || !veh_type_code || !action) return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');

        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");
        let updateFields = [];
        let params = [];
        let index = 1;

        if (veh_type_name !== undefined) { updateFields.push(`veh_type_name = $${index++}`); params.push(veh_type_name); }
        if (width !== undefined) { updateFields.push(`width = $${index++}`); params.push(width); }
        if (height !== undefined) { updateFields.push(`height = $${index++}`); params.push(height); }
        if (length !== undefined) { updateFields.push(`length = $${index++}`); params.push(length); }
        if (speed_limit !== undefined) { updateFields.push(`speed_limit = $${index++}`); params.push(speed_limit); }
        if (passenger_limit !== undefined) { updateFields.push(`passenger_limit = $${index++}`); params.push(passenger_limit); }
        if (veh_type_flag !== undefined) { updateFields.push(`veh_type_flag = $${index++}`); params.push(veh_type_flag); }

        if (updateFields.length === 0) return sendResponse(res, 'error', '-1', "ไม่มีข้อมูลที่จะแก้ไข");
        updateFields.push(`mdf_dt = $${index++}::timestamp`); params.push(nowStr);
        params.push(veh_type_code);

        const script = `UPDATE tbl_vehicle_type SET ${updateFields.join(", ")} WHERE veh_type_code = $${index};`;
        const result = await pgConn.execute2params(dbPrefix + lic_code, script, params, config.connectionString());
        if (result.code) return sendResponse(res, 'error', '-3', "ไม่สามารถแก้ไขประเภทรถยนต์ได้");

        await xglobal.action_logs(lic_code, action[0].id, "แก้ไขประเภทรถยนต์", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "แก้ไขสำเร็จ");
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

exports.removeType = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { veh_type_code, action } = req.body[0] || {};
        if (!lic_code || !veh_type_code || !action) return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');

        const codes = Array.isArray(veh_type_code) ? veh_type_code : [veh_type_code];
        const placeholders = codes.map((_, i) => `$${i + 2}`).join(", ");
        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        const script = `UPDATE tbl_vehicle_type SET veh_type_flag = 0, rm_dt = $1::timestamp WHERE veh_type_code IN (${placeholders});`;
        const result = await pgConn.execute2params(dbPrefix + lic_code, script, [nowStr, ...codes], config.connectionString());
        if (result.code) return sendResponse(res, 'error', '-3', "ไม่สามารถลบประเภทรถยนต์ได้");

        await xglobal.action_logs(lic_code, action[0].id, "ลบประเภทรถยนต์", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "ลบสำเร็จ");
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

// 4. VEHICLE & SPEC CRUD (tbl_vehicle & tbl_vehicle_ev_spec)
exports.getVehicleInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        let { vehicle_code = "ALL", search = "", page_index = 1, page_limit = 10, action } = req.body[0] || {};
        if (!lic_code || !action) return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');

        const offset = page_index > 0 ? page_index - 1 : 0;
        const conditions = ["v.rm_dt IS NULL", "v.vehicle_flag = 1"];
        if (String(vehicle_code).toUpperCase() !== "ALL") conditions.push(`v.vehicle_code = '${vehicle_code}'`);
        if (search && search.trim() !== "") {
            const sLower = search.trim().toLowerCase();
            conditions.push(`(LOWER(v.vehicle_name) LIKE '%${sLower}%' OR LOWER(v.vehicle_license) LIKE '%${sLower}%' OR LOWER(m.model_name) LIKE '%${sLower}%')`);
        }

        const whereClause = "WHERE " + conditions.join(" AND ");
        const dataScript = `
            SELECT 
                v.vehicle_code,
                v.vehicle_name,
                v.vehicle_license,
                v.vehicle_flag,
                v.vehicle_status,
                v.model_code,
                v.ist_dt,
                v.mdf_dt,
                m.model_name,
                m.brand_code,
                b.brand_name,
                s.battery_capacity_kwh,
                s.max_ac_charge_rate_kw,
                s.max_dc_charge_rate_kw,
                s.supported_connectors
            FROM tbl_vehicle v
            LEFT JOIN tbl_vehicle_model m ON v.model_code = m.model_code
            LEFT JOIN tbl_vehicle_brand b ON m.brand_code = b.brand_code
            LEFT JOIN tbl_vehicle_ev_spec s ON v.vehicle_code = s.vehicle_code
            ${whereClause}
            ORDER BY v.ist_dt DESC
            OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};
        `;

        const result = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());
        if (result.code) return sendResponse(res, 'error', '-3', "ไม่สามารถดึงข้อมูลรถยนต์ได้");

        if (result.data.length === 0) return sendResponse(res, 'success', '0', "ไม่พบข้อมูล", [], { page_total: 0, rows_total: 0 });
        const data = JSON.parse(JSON.stringify(result.data).replace(/\:null/gi, '\:""'));

        // Parse supported connectors JSON if stringified
        data.forEach(item => {
            if (typeof item.supported_connectors === 'string') {
                try { item.supported_connectors = JSON.parse(item.supported_connectors); } catch(e) {}
            }
        });

        const countScript = `SELECT COUNT(v.vehicle_code) as rows_total, CEIL(COUNT(v.vehicle_code)::float / ${page_limit}) as page_total FROM tbl_vehicle v ${whereClause};`;
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

exports.addVehicle = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const {
            vehicle_name,
            vehicle_license,
            model_code = null,
            vehicle_status = 1,
            battery_capacity_kwh,
            max_ac_charge_rate_kw = null,
            max_dc_charge_rate_kw = null,
            supported_connectors = [], // Array of supported connectors, e.g. ["Type 2", "CCS2"]
            action
        } = req.body[0] || {};

        if (!lic_code || !vehicle_name || battery_capacity_kwh === undefined || !action) {
            return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด vehicle_name, battery_capacity_kwh หรือ action)');
        }

        const newVehicleCode = "veh-" + moment().format("YYYYMMDDHHmmss") + Math.floor(Math.random() * 100);
        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        const connectorsJson = JSON.stringify(supported_connectors);

        const transactionResult = await pgConn.executeTransaction(
            dbPrefix + lic_code,
            async (client) => {
                // บันทึกตารางหลัก tbl_vehicle
                const vScript = `
                    INSERT INTO tbl_vehicle (
                        vehicle_code, vehicle_name, vehicle_license, vehicle_flag, vehicle_status, model_code, ist_dt
                    ) VALUES ($1, $2, $3, 1, $4, $5, $6);
                `;
                const resV = await pgConn.executeWithClient(client, vScript, [
                    newVehicleCode, vehicle_name, vehicle_license || null, vehicle_status, model_code, nowStr
                ]);
                if (resV.code) throw new Error("ไม่สามารถบันทึกข้อมูลรถยนต์หลักได้: " + resV.message);

                // บันทึกตารางสเปค tbl_vehicle_ev_spec
                const sScript = `
                    INSERT INTO tbl_vehicle_ev_spec (
                        vehicle_code, battery_capacity_kwh, max_ac_charge_rate_kw, max_dc_charge_rate_kw, supported_connectors, ist_dt
                    ) VALUES ($1, $2, $3, $4, $5::jsonb, $6);
                `;
                const resS = await pgConn.executeWithClient(client, sScript, [
                    newVehicleCode, battery_capacity_kwh, max_ac_charge_rate_kw, max_dc_charge_rate_kw, connectorsJson, nowStr
                ]);
                if (resS.code) throw new Error("ไม่สามารถบันทึกข้อมูลสเปครถยนต์ EV ได้: " + resS.message);

                return { vehicle_code: newVehicleCode };
            },
            config.connectionString()
        );

        if (transactionResult.code) {
            await xglobal.action_logs(lic_code, action[0].id, "เพิ่มรถยนต์และสเปค", JSON.stringify(req.body[0]), transactionResult.message, action[0].value);
            return sendResponse(res, 'error', '-3', `ไม่สามารถบันทึกข้อมูลได้, เนื่องจาก: ${transactionResult.message}`);
        }

        await xglobal.action_logs(lic_code, action[0].id, "เพิ่มรถยนต์และสเปค", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "บันทึกรถยนต์และสเปคสำเร็จ", [transactionResult.data]);
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

exports.setVehicle = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { vehicle_code } = req.query;
        const {
            vehicle_name,
            vehicle_license,
            model_code,
            vehicle_status,
            vehicle_flag,
            battery_capacity_kwh,
            max_ac_charge_rate_kw,
            max_dc_charge_rate_kw,
            supported_connectors,
            action
        } = req.body[0] || {};

        if (!lic_code || !vehicle_code || !action) return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');
        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        const transactionResult = await pgConn.executeTransaction(
            dbPrefix + lic_code,
            async (client) => {
                // อัปเดตตารางหลัก
                let vFields = [];
                let vParams = [];
                let vIdx = 1;

                if (vehicle_name !== undefined) { vFields.push(`vehicle_name = $${vIdx++}`); vParams.push(vehicle_name); }
                if (vehicle_license !== undefined) { vFields.push(`vehicle_license = $${vIdx++}`); vParams.push(vehicle_license); }
                if (model_code !== undefined) { vFields.push(`model_code = $${vIdx++}`); vParams.push(model_code); }
                if (vehicle_status !== undefined) { vFields.push(`vehicle_status = $${vIdx++}`); vParams.push(vehicle_status); }
                if (vehicle_flag !== undefined) { vFields.push(`vehicle_flag = $${vIdx++}`); vParams.push(vehicle_flag); }

                if (vFields.length > 0) {
                    vFields.push(`mdf_dt = $${vIdx++}::timestamp`); vParams.push(nowStr);
                    vParams.push(vehicle_code);
                    const vScript = `UPDATE tbl_vehicle SET ${vFields.join(", ")} WHERE vehicle_code = $${vIdx};`;
                    const resV = await pgConn.executeWithClient(client, vScript, vParams);
                    if (resV.code) throw new Error("ไม่สามารถอัปเดตข้อมูลรถยนต์ได้: " + resV.message);
                }

                // อัปเดตตารางสเปค
                let sFields = [];
                let sParams = [];
                let sIdx = 1;

                if (battery_capacity_kwh !== undefined) { sFields.push(`battery_capacity_kwh = $${sIdx++}`); sParams.push(battery_capacity_kwh); }
                if (max_ac_charge_rate_kw !== undefined) { sFields.push(`max_ac_charge_rate_kw = $${sIdx++}`); sParams.push(max_ac_charge_rate_kw); }
                if (max_dc_charge_rate_kw !== undefined) { sFields.push(`max_dc_charge_rate_kw = $${sIdx++}`); sParams.push(max_dc_charge_rate_kw); }
                if (supported_connectors !== undefined) { sFields.push(`supported_connectors = $${sIdx++}::jsonb`); sParams.push(JSON.stringify(supported_connectors)); }

                if (sFields.length > 0) {
                    sFields.push(`mdf_dt = $${sIdx++}::timestamp`); sParams.push(nowStr);
                    sParams.push(vehicle_code);
                    const sScript = `UPDATE tbl_vehicle_ev_spec SET ${sFields.join(", ")} WHERE vehicle_code = $${sIdx};`;
                    const resS = await pgConn.executeWithClient(client, sScript, sParams);
                    if (resS.code) throw new Error("ไม่สามารถอัปเดตข้อมูลสเปครถยนต์ EV ได้: " + resS.message);
                }

                return { vehicle_code };
            },
            config.connectionString()
        );

        if (transactionResult.code) {
            await xglobal.action_logs(lic_code, action[0].id, "แก้ไขรถยนต์และสเปค", JSON.stringify(req.body[0]), transactionResult.message, action[0].value);
            return sendResponse(res, 'error', '-3', `ไม่สามารถแก้ไขข้อมูลได้, เนื่องจาก: ${transactionResult.message}`);
        }

        await xglobal.action_logs(lic_code, action[0].id, "แก้ไขรถยนต์และสเปค", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "แก้ไขรถยนต์และสเปคสำเร็จ");
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

exports.removeVehicle = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { vehicle_code, action } = req.body[0] || {};
        if (!lic_code || !vehicle_code || !action) return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');

        const codes = Array.isArray(vehicle_code) ? vehicle_code : [vehicle_code];
        const placeholders = codes.map((_, i) => `$${i + 2}`).join(", ");
        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        const script = `UPDATE tbl_vehicle SET vehicle_flag = 0, rm_dt = $1::timestamp WHERE vehicle_code IN (${placeholders});`;
        const result = await pgConn.execute2params(dbPrefix + lic_code, script, [nowStr, ...codes], config.connectionString());
        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, "ลบรถยนต์", JSON.stringify(req.body[0]), result.message, action[0].value);
            return sendResponse(res, 'error', '-3', "ไม่สามารถลบรถยนต์ได้");
        }

        await xglobal.action_logs(lic_code, action[0].id, "ลบรถยนต์", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "ลบสำเร็จ");
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};
