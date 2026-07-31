const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

<<<<<<< HEAD
// Get Brand
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
        const dataScript = `SELECT brand_code, brand_name, brand_flag FROM tbl_vehicle_brand ${whereClause} ORDER BY ist_dt DESC OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};`;

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
// Add Brand
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
// Edit Brand
exports.setBrand = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { brand_code } = req.query;
        const { brand_name, action } = req.body[0] || {};
        if (!lic_code || !brand_code || !action) return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');

        //Validate Brand Name
        const checkScript = `SELECT brand_code FROM tbl_vehicle_brand WHERE brand_name = $1 AND rm_dt IS NULL AND brand_code != $2 LIMIT 1;`;
        const checkBrand = await pgConn.getWithParams(dbPrefix + lic_code, checkScript, [brand_name, brand_code], config.connectionString());
        if (!checkBrand.code && checkBrand.data.length > 0) return sendResponse(res, 'error', '-1', `ยี่ห้อรถยนต์ '${brand_name}' นี้มีอยู่ในระบบแล้ว`);

        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");
        let updateFields = [];
        let params = [];
        let index = 1;

        if (brand_name !== undefined && brand_name.trim() !== "") { updateFields.push(`brand_name = $${index++}`); params.push(brand_name); }

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
// Remove Brand
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

// Get Model
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
            SELECT  m.brand_code,b.brand_name, m.model_code, m.model_name,  m.model_flag
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
// Add Model
exports.addModel = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { brand_code, model_name, action } = req.body[0] || {};
        if (!lic_code || !brand_code || !model_name || !action) return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');

        const newCode = "mdl-" + moment().format("YYYYMMDDHHmmss") + Math.floor(Math.random() * 100);
        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        const checkScript = `SELECT model_code FROM tbl_vehicle_model WHERE model_name = $1 AND brand_code = $2 AND model_flag = 1 AND rm_dt IS NULL LIMIT 1;`;
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
// Set Model
exports.setModel = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { model_code } = req.query;
        const { brand_code, model_name, action } = req.body[0] || {};
        if (!lic_code || !model_code || !action) return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');

        const checkScript = `SELECT model_code FROM tbl_vehicle_model WHERE model_name = $1 AND brand_code = $2 AND model_code != $3 AND model_flag = 1 AND rm_dt IS NULL LIMIT 1;`;
        const checkModel = await pgConn.getWithParams(dbPrefix + lic_code, checkScript, [model_name, brand_code, model_code], config.connectionString());
        if (!checkModel.code && checkModel.data.length > 0) return sendResponse(res, 'error', '-1', `รุ่นรถยนต์ '${model_name}' ภายใต้ยี่ห้อที่ระบุมีอยู่ในระบบแล้ว`);

        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");
        let updateFields = [];
        let params = [];
        let index = 1;

        // Push Field And Params
        if (brand_code !== undefined) { updateFields.push(`brand_code = $${index++}`); params.push(brand_code); }
        if (model_name !== undefined) { updateFields.push(`model_name = $${index++}`); params.push(model_name); }

        if (updateFields.length === 0) return sendResponse(res, 'error', '-1', "ไม่มีข้อมูลที่จะแก้ไข");

        // Push End Params
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
// Remove Model
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
// Get Vehicle Type
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
// Add Vehicle Type
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
// Set Vehicle Type
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
// Remove Vehicle Type
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

// Get Vehicle & Spec
=======
//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
>>>>>>> parent of e952446 (first commit)
exports.getVehicleInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { veh_code, veh_group_code, off_code, action, page_index, page_limit } = req.body[0];
        page_index == undefined ? page_index = 1 : page_index;
        page_limit == undefined ? page_limit = 10 : page_limit;

        if (page_index > 0) {
            page_index -= 1;
        }
        //เช็คเฉพาะส่วนที่สำคัญ
        if (off_code == undefined || veh_code == undefined || lic_code == undefined || action == undefined || veh_group_code == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let script = ``;
            if (veh_code.toString().toUpperCase() != 'ALL') {
                script = `select veh_code, veh_number, veh_license_number, veh_license_province, tbl_vehicle.veh_type_code, tbl_vehicle_type.veh_type_code, veh_status, 
                tbl_vehicle.veh_group_code, tbl_vehicle_group.veh_group_desc,
                veh_blackbox_number, veh_brand, veh_model, veh_tank_material, veh_loading_system, veh_maximum_compartment, veh_capacity_in_compartment, 
                veh_tare_weight, veh_gross_weight, veh_tank_width, veh_tank_length, veh_tank_height, veh_tank_capacity, veh_maximum_capacity, 
                veh_discharge_sequence, veh_option_pump, veh_option_doeb, veh_option_m12, veh_option_ivms, veh_option_afdd, veh_registration_starting_date, 
                veh_registration_expire_date, veh_registration_remark, veh_support_product, veh_sticker, veh_braking_system,  veh_service_life, 
                veh_flag, veh_image, veh_support_climb_mountain, veh_maximum_distance, veh_minimum_distance, veh_maximum_jobs, veh_remark, 
                veh_sub_license_number, veh_sub_license_province, veh_sub_brand, veh_sub_model, veh_sub_registration_starting_date, 
                veh_sub_registration_expire_date, veh_sub_registration_remark, veh_sub_service_life, veh_sub_braking_system, veh_sub_image, 
                tbl_vehicle.off_code, tbl_vehicle.ist_dt, tbl_vehicle.mdf_dt, tbl_vehicle.rm_dt,
                case when tbl_vehicle.veh_start_dt is null then '08:00:00' else tbl_vehicle.veh_start_dt end as veh_start_dt, 
                case when tbl_vehicle.veh_end_dt is null then '18:00:00' else tbl_vehicle.veh_end_dt end as veh_end_dt 

<<<<<<< HEAD
        if (result.data.length === 0) return sendResponse(res, 'success', '0', "ไม่พบข้อมูล", [], { page_total: 0, rows_total: 0 });
        const data = JSON.parse(JSON.stringify(result.data).replace(/\:null/gi, '\:""'));

        // Parse supported connectors JSON if stringified
        data.forEach(item => {
            if (typeof item.supported_connectors === 'string') {
                try { item.supported_connectors = JSON.parse(item.supported_connectors); } catch (e) { }
=======
                from tbl_vehicle 
                left join tbl_vehicle_type on tbl_vehicle.veh_type_code = tbl_vehicle_type.veh_type_code
                left join tbl_vehicle_group on tbl_vehicle.veh_group_code = tbl_vehicle_group.veh_group_code 
                where tbl_vehicle.veh_code = '${veh_code}' and tbl_vehicle.veh_flag = '1'`;
>>>>>>> parent of e952446 (first commit)
            }
            else {
                script = `select veh_code, veh_number, veh_license_number, veh_license_province, tbl_vehicle.veh_type_code, tbl_vehicle_type.veh_type_code, veh_status, 
                tbl_vehicle.veh_group_code, tbl_vehicle_group.veh_group_desc,
                veh_blackbox_number, veh_brand, veh_model, veh_tank_material, veh_loading_system, veh_maximum_compartment, veh_capacity_in_compartment, 
                veh_tare_weight, veh_gross_weight, veh_tank_width, veh_tank_length, veh_tank_height, veh_tank_capacity, veh_maximum_capacity, 
                veh_discharge_sequence, veh_option_pump, veh_option_doeb, veh_option_m12, veh_option_ivms, veh_option_afdd, veh_registration_starting_date, 
                veh_registration_expire_date, veh_registration_remark, veh_support_product, veh_sticker, veh_braking_system,  veh_service_life, 
                veh_flag, veh_image, veh_support_climb_mountain, veh_maximum_distance, veh_minimum_distance, veh_maximum_jobs, veh_remark, 
                veh_sub_license_number, veh_sub_license_province, veh_sub_brand, veh_sub_model, veh_sub_registration_starting_date, 
                veh_sub_registration_expire_date, veh_sub_registration_remark, veh_sub_service_life, veh_sub_braking_system, veh_sub_image, 
                tbl_vehicle.off_code, tbl_vehicle.ist_dt, tbl_vehicle.mdf_dt, tbl_vehicle.rm_dt,
                case when tbl_vehicle.veh_start_dt is null then '08:00:00' else tbl_vehicle.veh_start_dt end as veh_start_dt, 
                case when tbl_vehicle.veh_end_dt is null then '18:00:00' else tbl_vehicle.veh_end_dt end as veh_end_dt

                from tbl_vehicle 
                left join tbl_vehicle_type on tbl_vehicle.veh_type_code = tbl_vehicle_type.veh_type_code
                left join tbl_vehicle_group on tbl_vehicle.veh_group_code = tbl_vehicle_group.veh_group_code 
                where tbl_vehicle.veh_flag = '1'`;
            }

<<<<<<< HEAD
// Add Vehicle & Spec
exports.addVehicle = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const {
            vehicle_name,
            vehicle_license,
            model_code = null,
            battery_capacity_kwh,
            max_ac_charge_rate_kw = null,
            max_dc_charge_rate_kw = null,
            supported_connectors = [], // Array of supported connectors, e.g. ["Type 2", "CCS2"]
            action
        } = req.body[0] || {};
=======
            if (veh_group_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_vehicle.veh_group_code = '${veh_group_code}'`
            }
>>>>>>> parent of e952446 (first commit)

            if (off_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_vehicle.off_code = '${off_code}'`
            }

            script += ` order by tbl_vehicle.ist_dt desc`
            script += ` offset (${page_index}*${page_limit}) limit ${page_limit};`
            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));
                    let page_total = 0;
                    let rows_total = 0;
                    if (veh_code.toString().toUpperCase() != 'ALL') {
                        script = `select 
                          ceil((ceil(count(veh_code)) / ${page_limit})) as page_total, 
                          (count(veh_code)) as rows_total 
                        from tbl_vehicle 
                        left join tbl_vehicle_type on tbl_vehicle.veh_type_code = tbl_vehicle_type.veh_type_code
                        left join tbl_vehicle_group on tbl_vehicle.veh_group_code = tbl_vehicle_group.veh_group_code 
                        where tbl_vehicle.veh_code = '${veh_code}' and tbl_vehicle.veh_flag = '1'`;
                    }
                    else {
                        script = `select 
                          ceil((ceil(count(veh_code)) / ${page_limit})) as page_total, 
                          (count(veh_code)) as rows_total 
                        from tbl_vehicle 
                        left join tbl_vehicle_type on tbl_vehicle.veh_type_code = tbl_vehicle_type.veh_type_code
                        left join tbl_vehicle_group on tbl_vehicle.veh_group_code = tbl_vehicle_group.veh_group_code 
                        where tbl_vehicle.veh_flag = '1'`;
                    }

                    if (veh_group_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_vehicle.veh_group_code = '${veh_group_code}'`
                    }

<<<<<<< HEAD
        const transactionResult = await pgConn.executeTransaction(
            dbPrefix + lic_code,
            async (client) => {
                // บันทึกตารางหลัก tbl_vehicle
                const vScript = `
                    INSERT INTO tbl_vehicle (
                        vehicle_code, vehicle_name, vehicle_license, vehicle_flag, model_code, ist_dt
                    ) VALUES ($1, $2, $3, 1, $4, $5);
                `;
                const resV = await pgConn.executeWithClient(client, vScript, [
                    newVehicleCode, vehicle_name, vehicle_license || null, model_code, nowStr
                ]);
                if (resV.code) throw new Error("ไม่สามารถบันทึกข้อมูลรถยนต์หลักได้: " + resV.message);
=======
                    if (off_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_vehicle.off_code = '${off_code}'`
                    }
>>>>>>> parent of e952446 (first commit)

                    let tbl_temporary2 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
                    if (!tbl_temporary2.code) {
                        if (tbl_temporary2.data.length > 0) {
                            page_total = parseInt(tbl_temporary2.data[0].page_total);
                            rows_total = parseInt(tbl_temporary2.data[0].rows_total);
                        }
                    }

                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: tbl_temporary.data,
                        page_total: page_total,
                        rows_total: rows_total,
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    return;
                } else {
                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: xresult,
                        page_total: 0,
                        rows_total: 0,
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

<<<<<<< HEAD
        await xglobal.action_logs(lic_code, action[0].id, "เพิ่มรถยนต์และสเปค", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "บันทึกรถยนต์และสเปคสำเร็จ", [transactionResult.data]);
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};
// Set Vehicle & Spec
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
=======
                    res.status(200).send(response);
                    return;
>>>>>>> parent of e952446 (first commit)
                }
            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                return;
            }
        }
    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: xresult,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }]
        res.status(200).send(response);
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

// Remove Vehicle & Spec
exports.removeVehicle = async (req, res, next) => {

    return (async () => {

        let lic_code = req.header('lic_code');
        let { veh_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_code == undefined || lic_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let script = ``;
            script = `update tbl_vehicle set veh_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' where veh_code = '${veh_code}';`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                return;
            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                return;
            }
        }

    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }]
        res.status(200).send(response);
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.setVehicleInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let { veh_code } = req.query;
        let {
            veh_number,
            veh_license_number,
            veh_license_province,
            veh_type_code,
            veh_status,
            veh_group_code,
            veh_blackbox_number,
            veh_brand,
            veh_model,
            veh_tank_material,
            veh_loading_system,
            veh_maximum_compartment,
            veh_capacity_in_compartment,
            veh_tare_weight,
            veh_gross_weight,
            veh_tank_width,
            veh_tank_length,
            veh_tank_height,
            veh_tank_capacity,
            veh_maximum_capacity,
            veh_discharge_sequence,
            veh_option_pump,
            veh_option_doeb,
            veh_option_m12,
            veh_option_ivms,
            veh_option_afdd,
            veh_registration_starting_date,
            veh_registration_expire_date,
            veh_registration_remark,
            veh_support_product,
            veh_sticker,
            veh_braking_system,
            veh_service_life,
            veh_image,
            veh_support_climb_mountain,
            veh_maximum_distance,
            veh_minimum_distance,
            veh_maximum_jobs,
            veh_remark,
            veh_sub_license_number,
            veh_sub_license_province,
            veh_sub_brand,
            veh_sub_model,
            veh_sub_registration_starting_date,
            veh_sub_registration_expire_date,
            veh_sub_registration_remark,
            veh_sub_service_life,
            veh_sub_braking_system,
            veh_sub_image,
            veh_start_dt,
            veh_end_dt,
            off_code,
            action
        } = req.body[0];

        if (veh_code == undefined || veh_number == undefined || veh_license_number == undefined || veh_license_province == undefined
            || veh_type_code == undefined || veh_status == undefined || veh_group_code == undefined || veh_blackbox_number == undefined
            || veh_brand == undefined || veh_model == undefined || veh_tank_material == undefined || veh_loading_system == undefined
            || veh_maximum_compartment == undefined || veh_capacity_in_compartment == undefined || veh_tare_weight == undefined
            || veh_gross_weight == undefined || veh_tank_width == undefined || veh_tank_length == undefined || veh_tank_height == undefined
            || veh_tank_capacity == undefined || veh_maximum_capacity == undefined || veh_discharge_sequence == undefined || veh_option_pump == undefined
            || veh_option_doeb == undefined || veh_option_m12 == undefined || veh_option_ivms == undefined || veh_option_afdd == undefined
            || veh_registration_starting_date == undefined || veh_registration_expire_date == undefined || veh_registration_remark == undefined || veh_support_product == undefined
            || veh_sticker == undefined || veh_braking_system == undefined || veh_service_life == undefined || veh_image == undefined
            || veh_sub_license_number == undefined || veh_sub_license_province == undefined || veh_sub_brand == undefined || veh_sub_model == undefined
            || veh_sub_registration_starting_date == undefined || veh_sub_registration_expire_date == undefined || veh_sub_registration_remark == undefined
            || veh_sub_service_life == undefined || veh_sub_braking_system == undefined || veh_support_climb_mountain == undefined || veh_maximum_distance == undefined
            || veh_minimum_distance == undefined || veh_maximum_jobs == undefined || veh_remark == undefined
            || veh_sub_image == undefined || off_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let script = ``;

            if (veh_start_dt == undefined) {
                veh_start_dt = '08:00:00'
            }

            if (veh_end_dt == undefined) {
                veh_end_dt = '18:00:00'
            }

            if (veh_registration_starting_date == '') {
                veh_registration_starting_date = 'NULL'
            }

            if (veh_registration_expire_date == '') {
                veh_registration_expire_date = 'NULL'
            }

            if (veh_sub_registration_starting_date == '') {
                veh_sub_registration_starting_date = 'NULL'
            }

            if (veh_sub_registration_expire_date == '') {
                veh_sub_registration_expire_date = 'NULL'
            }

            if (off_code.toString().toUpperCase() == 'ALL') {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง off_code ไม่รองรับ ALL',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง off_code ไม่รองรับ ALL', action[0].value);
                return;
            }

            script = `update tbl_vehicle set
            veh_number = '${veh_number}',
            veh_license_number = '${veh_license_number}',
            veh_license_province = '${veh_license_province}',
            veh_type_code = '${veh_type_code}',
            veh_status = '${veh_status}',
            veh_group_code = '${veh_group_code}',
            veh_blackbox_number = '${veh_blackbox_number}',
            veh_brand = '${veh_brand}',
            veh_model = '${veh_model}',
            veh_tank_material = '${veh_tank_material}',
            veh_loading_system = '${veh_loading_system}',
            veh_maximum_compartment = ${veh_maximum_compartment},
            veh_capacity_in_compartment = ${veh_capacity_in_compartment},
            veh_tare_weight = ${veh_tare_weight},
            veh_gross_weight = ${veh_gross_weight},
            veh_tank_width = ${veh_tank_width},
            veh_tank_length = ${veh_tank_length},
            veh_tank_height = ${veh_tank_height},
            veh_tank_capacity = ${veh_tank_capacity},
            veh_maximum_capacity = ${veh_maximum_capacity},
            veh_discharge_sequence = '${veh_discharge_sequence}',
            veh_option_pump = '${veh_option_pump}',
            veh_option_doeb = '${veh_option_doeb}',
            veh_option_m12 = '${veh_option_m12}',
            veh_option_ivms = '${veh_option_ivms}',
            veh_option_afdd = '${veh_option_afdd}',
            veh_registration_starting_date = '${veh_registration_starting_date}',
            veh_registration_expire_date = '${veh_registration_expire_date}',
            veh_registration_remark = '${veh_registration_remark}',
            veh_support_product = '${veh_support_product}',
            veh_sticker = '${veh_sticker}',
            veh_braking_system = '${veh_braking_system}',
            veh_service_life = ${veh_service_life},
            veh_image = '${veh_image}',
            veh_support_climb_mountain = '${veh_support_climb_mountain}',
            veh_maximum_distance = ${veh_maximum_distance},
            veh_minimum_distance = ${veh_minimum_distance},
            veh_maximum_jobs = ${veh_maximum_jobs},
            veh_remark = '${veh_remark}',
            veh_sub_license_number = '${veh_sub_license_number}',
            veh_sub_license_province = '${veh_sub_license_province}',
            veh_sub_brand = '${veh_sub_brand}',
            veh_sub_model = '${veh_sub_model}',
            veh_sub_registration_starting_date = '${veh_sub_registration_starting_date}',
            veh_sub_registration_expire_date = '${veh_sub_registration_expire_date}',
            veh_sub_registration_remark = '${veh_sub_registration_remark}',
            veh_sub_service_life = ${veh_sub_service_life},
            veh_sub_braking_system = '${veh_sub_braking_system}',
            veh_sub_image = '${veh_sub_image}',
            off_code = '${off_code}',
            veh_start_dt = '${veh_start_dt}',
            veh_end_dt = '${veh_end_dt}',
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where veh_code = '${veh_code}';`

            script = script.replace(/'NULL'/gi, "NULL")
            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'success', action[0].value);
                return;
            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                return;
            }
        }

    })().catch(async (err) => {

        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }]
        res.status(200).send(response);
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.addVehicleInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            veh_number,
            veh_license_number,
            veh_license_province,
            veh_type_code,
            veh_status,
            veh_group_code,
            veh_blackbox_number,
            veh_brand,
            veh_model,
            veh_tank_material,
            veh_loading_system,
            veh_maximum_compartment,
            veh_capacity_in_compartment,
            veh_tare_weight,
            veh_gross_weight,
            veh_tank_width,
            veh_tank_length,
            veh_tank_height,
            veh_tank_capacity,
            veh_maximum_capacity,
            veh_discharge_sequence,
            veh_option_pump,
            veh_option_doeb,
            veh_option_m12,
            veh_option_ivms,
            veh_option_afdd,
            veh_registration_starting_date,
            veh_registration_expire_date,
            veh_registration_remark,
            veh_support_product,
            veh_sticker,
            veh_braking_system,
            veh_service_life,
            veh_image,
            veh_support_climb_mountain,
            veh_maximum_distance,
            veh_minimum_distance,
            veh_maximum_jobs,
            veh_remark,
            veh_sub_license_number,
            veh_sub_license_province,
            veh_sub_brand,
            veh_sub_model,
            veh_sub_registration_starting_date,
            veh_sub_registration_expire_date,
            veh_sub_registration_remark,
            veh_sub_service_life,
            veh_sub_braking_system,
            veh_sub_image,
            off_code,
            veh_start_dt,
            veh_end_dt,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_number == undefined || veh_license_number == undefined || veh_license_province == undefined
            || veh_type_code == undefined || veh_status == undefined || veh_group_code == undefined || veh_blackbox_number == undefined
            || veh_brand == undefined || veh_model == undefined || veh_tank_material == undefined || veh_loading_system == undefined
            || veh_maximum_compartment == undefined || veh_capacity_in_compartment == undefined || veh_tare_weight == undefined
            || veh_gross_weight == undefined || veh_tank_width == undefined || veh_tank_length == undefined || veh_tank_height == undefined
            || veh_tank_capacity == undefined || veh_maximum_capacity == undefined || veh_discharge_sequence == undefined || veh_option_pump == undefined
            || veh_option_doeb == undefined || veh_option_m12 == undefined || veh_option_ivms == undefined || veh_option_afdd == undefined
            || veh_registration_starting_date == undefined || veh_registration_expire_date == undefined || veh_registration_remark == undefined || veh_support_product == undefined
            || veh_sticker == undefined || veh_braking_system == undefined || veh_service_life == undefined || veh_image == undefined
            || veh_sub_license_number == undefined || veh_sub_license_province == undefined || veh_sub_brand == undefined || veh_sub_model == undefined
            || veh_sub_registration_starting_date == undefined || veh_sub_registration_expire_date == undefined || veh_sub_registration_remark == undefined
            || veh_sub_service_life == undefined || veh_sub_braking_system == undefined
            || veh_support_climb_mountain == undefined || veh_maximum_distance == undefined || veh_minimum_distance == undefined || veh_maximum_jobs == undefined
            || veh_remark == undefined
            || veh_sub_image == undefined || off_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let script = ``;

            if (veh_start_dt == undefined) {
                veh_start_dt = '08:00:00'
            }

            if (veh_end_dt == undefined) {
                veh_end_dt = '18:00:00'
            }

            if (veh_registration_starting_date == '') {
                veh_registration_starting_date = 'NULL'
            }

            if (veh_registration_expire_date == '') {
                veh_registration_expire_date = 'NULL'
            }

            if (veh_sub_registration_starting_date == '') {
                veh_sub_registration_starting_date = 'NULL'
            }

            if (veh_sub_registration_expire_date == '') {
                veh_sub_registration_expire_date = 'NULL'
            }

            if (off_code.toString().toUpperCase() == 'ALL') {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง off_code ไม่รองรับ ALL',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง off_code ไม่รองรับ ALL', action[0].value);
                return;
            }

            script = `select veh_code from tbl_vehicle where (veh_number = '${veh_number}' or veh_number = '${veh_license_number}') and off_code = '${off_code}' and veh_flag = '1';`
            let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary0.code) {
                if (tbl_temporary0.data.length > 0) {
                    let response = [{
                        status: 'error',
                        invalid_code: '-4',
                        message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลเลขข้างรถหรือทะเบียนรถซ้ำ`,
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลเลขข้างรถหรือทะเบียนรถซ้ำ', action[0].value);
                    return;
                }
            }

            let veh_code = 'vehi-' + moment().format('x');
            script = `insert into tbl_vehicle 
            (veh_code,veh_number,veh_license_number,veh_license_province,veh_type_code,veh_status,veh_group_code,veh_blackbox_number,veh_brand,veh_model,veh_tank_material,veh_loading_system,veh_maximum_compartment,
            veh_capacity_in_compartment,veh_tare_weight,veh_gross_weight,veh_tank_width,veh_tank_length,veh_tank_height,veh_tank_capacity,veh_maximum_capacity,veh_discharge_sequence,veh_option_pump,
            veh_option_doeb,veh_option_m12,veh_option_ivms,veh_option_afdd,veh_registration_starting_date,veh_registration_expire_date,veh_registration_remark,veh_support_product,veh_sticker,
            veh_braking_system,veh_service_life,veh_image,veh_sub_license_number,veh_sub_license_province,veh_sub_brand,veh_sub_model,veh_sub_registration_starting_date,veh_sub_registration_expire_date,
            veh_sub_registration_remark,veh_sub_service_life,veh_sub_braking_system,veh_sub_image,off_code,veh_flag,ist_dt,veh_support_climb_mountain,veh_maximum_distance,veh_minimum_distance,veh_maximum_jobs,veh_remark, veh_start_dt, veh_end_dt) 
            values 
            ('${veh_code}','${veh_number}','${veh_license_number}','${veh_license_province}','${veh_type_code}','${veh_status}','${veh_group_code}','${veh_blackbox_number}','${veh_brand}','${veh_model}','${veh_tank_material}',
            '${veh_loading_system}',${veh_maximum_compartment},${veh_capacity_in_compartment},${veh_tare_weight},${veh_gross_weight},${veh_tank_width},${veh_tank_length},${veh_tank_height},${veh_tank_capacity},${veh_maximum_capacity},
            '${veh_discharge_sequence}','${veh_option_pump}','${veh_option_doeb}','${veh_option_m12}','${veh_option_ivms}','${veh_option_afdd}','${veh_registration_starting_date}','${veh_registration_expire_date}','${veh_registration_remark}',
            '${veh_support_product}','${veh_sticker}','${veh_braking_system}',${veh_service_life},'${veh_image}','${veh_sub_license_number}','${veh_sub_license_province}','${veh_sub_brand}','${veh_sub_model}','${veh_sub_registration_starting_date}',
            '${veh_sub_registration_expire_date}','${veh_sub_registration_remark}',${veh_sub_service_life},'${veh_sub_braking_system}','${veh_sub_image}','${off_code}','1','${moment().format('YYYY-MM-DD HH:mm:ss')}',
            '${veh_support_climb_mountain}',${veh_maximum_distance},${veh_minimum_distance},${veh_maximum_jobs},'${veh_remark}','${veh_start_dt}','${veh_end_dt}')`

            script = script.replace(/'NULL'/gi, "NULL")
            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [{
                        veh_code: veh_code
                    }],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'success', action[0].value);
                return;
            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                return;
            }
        }

    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }]
        res.status(200).send(response);
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}
