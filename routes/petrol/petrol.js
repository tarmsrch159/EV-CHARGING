const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
exports.getPetrolInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let payload = req.body?.[0] || {};

        let {
            ptrl_code, off_code, ptrl_group_code, search,
            page_index, page_limit, action, auto_order
        } = payload;

        // ======== กำหนดค่าเริ่มต้น ========
        page_index = page_index === undefined ? 1 : page_index;
        page_limit = page_limit === undefined ? 10 : page_limit;

        // ======== ตรวจสอบพารามิเตอร์ที่จำเป็น ========
        if (ptrl_code === undefined || off_code === undefined || ptrl_group_code === undefined ||
            lic_code === undefined || search === undefined || action === undefined) {

            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss'),
                page_total: 0,
                rows_total: 0
            }];

            res.status(200).send(response);
            return;
        }

        if (page_index > 0) {
            page_index -= 1;
        }

        // ======== สร้างเงื่อนไข WHERE (Dynamic Conditions) ========
        let conditions = ["tbl_petrol.ptrl_flag = '1'"];

        if (ptrl_code.toString().toUpperCase() !== 'ALL') {
            conditions.push(`tbl_petrol.ptrl_code = '${ptrl_code}'`);
        }

        if (auto_order !== undefined && auto_order !== '') {
            conditions.push(`tbl_petrol.auto_order = ${auto_order}`);
        }

        if (ptrl_group_code.toString().toUpperCase() !== 'ALL' && ptrl_group_code !== '') {
            conditions.push(`tbl_petrol.ptrl_group_code = '${ptrl_group_code}'`);
        }

        if (off_code.toString().toUpperCase() !== 'ALL' && off_code !== '') {
            conditions.push(`tbl_petrol.off_code = '${off_code}'`);
        }

        // ดัก undefined ให้ Action
        let act_val = action?.[0]?.value?.toString().toUpperCase() || 'ALL';
        let act_id = action?.[0]?.id || '';

        // จัดการเงื่อนไขตามสิทธิ์การเข้าถึง
        if (act_val !== 'ALL') {
            if (act_val === 'GROUP') {
                conditions.push(`tbl_petrol.ptrl_group_code IN (SELECT ptrl_group_code FROM tbl_employee_petrol_group WHERE emp_code = '${act_id}' AND emp_pgrp_flag = 1)`);
            } else {
                conditions.push(`tbl_petrol.ptrl_code IN (SELECT ptrl_code FROM tbl_employee WHERE emp_code = '${act_id}' AND emp_flag = '1')`);
            }
        }

        if (search !== '') {
            conditions.push(`(
                tbl_petrol.ptrl_number LIKE '%${search}%' 
                OR tbl_petrol.ptrl_sitecode LIKE '%${search}%' 
                OR tbl_petrol_group.ptrl_group_desc LIKE '%${search}%' 
                OR tbl_petrol.ptrl_desc LIKE '%${search}%' 
                OR tbl_petrol.ptrl_short_desc LIKE '%${search}%' 
                OR tbl_petrol.ptrl_address LIKE '%${search}%' 
                OR tbl_petrol.ptrl_zip_code LIKE '%${search}%'
            )`);
        }

        let whereClause = "WHERE " + conditions.join(" AND ");

        // ======== SQL สำหรับดึงข้อมูล ========
        let baseSelectQuery = `
            SELECT ptrl_code, ptrl_number, ptrl_sitecode, ptrl_desc, ptrl_short_desc, ptrl_address, ptrl_zip_code, ptrl_country_code,
            ptrl_unloading_minute, ptrl_expenses_per_km, ptrl_area, ptrl_option_pump, ptrl_option_mrge_orders, ptrl_lat, ptrl_lon,
            tbl_petrol.off_code, off_desc, tbl_petrol.ptrl_group_code, ptrl_group_desc,
            ptrl_flag, ptrl_remark, ptrl_sales_group, ptrl_sales_type, auto_order, 
            tbl_petrol.prov_code, tbl_petrol.amph_code, tbl_petrol.tamb_code, 
            tbl_province.prov_desc, tbl_amphure.amph_desc, tbl_tambon.tamb_desc
            FROM tbl_petrol 
            LEFT JOIN tbl_office ON tbl_petrol.off_code = tbl_office.off_code 
            LEFT JOIN tbl_petrol_group ON tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
            LEFT JOIN tbl_province ON tbl_petrol.prov_code = tbl_province.prov_code 
            LEFT JOIN tbl_amphure ON tbl_petrol.amph_code = tbl_amphure.amph_code 
            LEFT JOIN tbl_tambon ON tbl_petrol.tamb_code = tbl_tambon.tamb_code 
        `;

        let dataScript = `
            ${baseSelectQuery}
            ${whereClause}
            ORDER BY tbl_petrol.ist_dt DESC 
            LIMIT ${page_limit} OFFSET (${page_index} * ${page_limit});
        `;

        let tbl_temporary = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());
        if (!tbl_temporary.code) {
            if (tbl_temporary.data.length > 0) {

                tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));
                let rawData = tbl_temporary.data;
                let responseData = rawData;

                // =========== กรองข้อมูลปั๊มและกลุ่มปั๊ม ==========
                if (act_val === 'GROUP') {
                    let groupMap = new Map();

                    // ดึงรายชื่อกลุ่ม (แบบไม่ซ้ำ)
                    rawData.forEach(item => {
                        let groupCode = item.ptrl_group_code || 'UNASSIGNED';
                        if (!groupMap.has(groupCode)) {
                            groupMap.set(groupCode, {
                                ptrl_group_code: groupCode,
                                ptrl_group_desc: item.ptrl_group_desc || 'ไม่ระบุกลุ่ม'
                            });
                        }
                    });

                    responseData = {
                        ptrl_group_code: Array.from(groupMap.values()),
                        station: rawData // ปั๊มทั้งหมดรวมกันใน Array เดียว
                    };
                }

                let page_total = 0;
                let rows_total = 0;

                // ======== นับจำนวนแถวทั้งหมด ========
                let countScript = `
                    SELECT 
                        CEIL(COUNT(tbl_petrol.ptrl_code)::float / ${page_limit}) as page_total, 
                        COUNT(tbl_petrol.ptrl_code) as rows_total 
                    FROM tbl_petrol 
                    LEFT JOIN tbl_office ON tbl_petrol.off_code = tbl_office.off_code 
                    LEFT JOIN tbl_petrol_group ON tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                    ${whereClause};
                `;

                let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, countScript, config.connectionString());

                if (!tbl_temporary0.code && tbl_temporary0.data.length > 0) {
                    page_total = parseInt(tbl_temporary0.data[0].page_total);
                    rows_total = parseInt(tbl_temporary0.data[0].rows_total);
                }

                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: responseData,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss'),
                    page_total: (page_total <= 0 ? 1 : page_total),
                    rows_total: rows_total
                }];

                res.status(200).send(response);
                return;
            } else {
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss'),
                    page_total: 0,
                    rows_total: 0
                }];

                res.status(200).send(response);
                return;
            }
        } else {
            let act_id = action?.[0]?.id || '';
            let act_val = action?.[0]?.value || '';
            let response = [{
                status: 'error',
                invalid_code: '-3',
                message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss'),
                page_total: 0,
                rows_total: 0
            }];

            res.status(200).send(response);
            await xglobal.action_logs(lic_code, act_id, 'ดึงข้อมูลปั้ม', JSON.stringify(payload), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', act_val);
            return;
        }

    })().catch(async (err) => {
        console.error(err);
        let payload = req.body?.[0] || {};
        let act_id = payload.action?.[0]?.id || '';
        let act_val = payload.action?.[0]?.value || '';

        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: xresult,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss'),
            page_total: 0,
            rows_total: 0
        }];

        res.status(200).send(response);

        if (act_id) {
            await xglobal.action_logs(lic_code, act_id, 'ดึงข้อมูลปั้ม', JSON.stringify(payload), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', act_val);
        }
        return;
    });
}
exports.removePetrol = async (req, res, next) => {

    return (async () => {

        let lic_code = req.header('lic_code');
        let { ptrl_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_code == undefined || lic_code == undefined || action == undefined) {
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
            script = `update tbl_petrol set ptrl_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where ptrl_code = '${ptrl_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.setPetrolInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let { ptrl_code } = req.query;
        let {
            ptrl_number,
            ptrl_sitecode,
            ptrl_desc,
            ptrl_short_desc,
            ptrl_address,
            ptrl_zip_code,
            ptrl_country_code,
            ptrl_unloading_minute,
            ptrl_expenses_per_km,
            ptrl_area,
            ptrl_option_pump,
            ptrl_option_mrge_orders,
            ptrl_lat,
            ptrl_lon,
            off_code,
            ptrl_group_code,
            ptrl_remark,
            action,
            ptrl_sales_group,
            ptrl_sales_type,
            auto_order,
            prov_code,
            amph_code,
            tamb_code
        } = req.body[0];

        // console.log(req.body[0]);
        //เช็คเฉพาะส่วนที่สำคัญ   
        if (ptrl_code == undefined || ptrl_number == undefined || ptrl_sitecode == undefined || ptrl_desc == undefined
            || ptrl_short_desc == undefined || ptrl_address == undefined || ptrl_zip_code == undefined || ptrl_country_code == undefined || ptrl_unloading_minute == undefined
            || ptrl_expenses_per_km == undefined || ptrl_area == undefined || ptrl_option_pump == undefined || ptrl_option_mrge_orders == undefined
            || ptrl_lat == undefined || ptrl_lon == undefined || off_code == undefined || ptrl_group_code == undefined
            || ptrl_sales_group == undefined || ptrl_sales_type == undefined || action == undefined || auto_order == undefined || prov_code == undefined || amph_code == undefined || tamb_code == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            if (ptrl_remark == undefined) {
                ptrl_remark = '';
            }

            let script = ``;
            script = `update tbl_petrol set
                ptrl_number = '${ptrl_number}',
                ptrl_sitecode = '${ptrl_sitecode}',
                ptrl_desc = '${ptrl_desc}',
                ptrl_short_desc = '${ptrl_short_desc}',
                ptrl_address = '${ptrl_address}',
                ptrl_zip_code = '${ptrl_zip_code}',
                ptrl_country_code = '${ptrl_country_code}',
                ptrl_unloading_minute = ${ptrl_unloading_minute},
                ptrl_expenses_per_km = ${ptrl_expenses_per_km},
                ptrl_area = ${ptrl_area},
                ptrl_option_pump = '${ptrl_option_pump}',
                ptrl_option_mrge_orders = '${ptrl_option_mrge_orders}',
                ptrl_lat = '${ptrl_lat}',
                ptrl_lon = '${ptrl_lon}',
                off_code = '${off_code}',
                ptrl_group_code = '${ptrl_group_code}',
                mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
                ptrl_remark = '${ptrl_remark}',
                ptrl_sales_group = '${ptrl_sales_group}',
                ptrl_sales_type = '${ptrl_sales_type}',
                auto_order = '${auto_order}',
                prov_code = '${prov_code}',
                amph_code = '${amph_code}',
                tamb_code = '${tamb_code}'
            where ptrl_code = '${ptrl_code}';`

            script = script.replace(/'NULL'/gi, "NULL")
            // console.log(script);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลปั้ม', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.addPetrolInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            ptrl_number,
            ptrl_sitecode,
            ptrl_desc,
            ptrl_short_desc,
            ptrl_address,
            ptrl_zip_code,
            ptrl_country_code,
            ptrl_unloading_minute,
            ptrl_expenses_per_km,
            ptrl_area,
            ptrl_option_pump,
            ptrl_option_mrge_orders,
            ptrl_lat,
            ptrl_lon,
            off_code,
            ptrl_group_code,
            ptrl_remark,
            action,
            ptrl_sales_group,
            ptrl_sales_type,
            auto_order,
            prov_code,
            amph_code,
            tamb_code
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_number == undefined || ptrl_sitecode == undefined || ptrl_desc == undefined || ptrl_short_desc == undefined || ptrl_address == undefined || ptrl_zip_code == undefined || ptrl_country_code == undefined || ptrl_unloading_minute == undefined
            || ptrl_expenses_per_km == undefined || ptrl_area == undefined || ptrl_option_pump == undefined || ptrl_option_mrge_orders == undefined
            || ptrl_lat == undefined || ptrl_lon == undefined || off_code == undefined || ptrl_group_code == undefined
            || action == undefined || ptrl_sales_group == undefined || ptrl_sales_type == undefined || auto_order == undefined || prov_code == undefined || amph_code == undefined || tamb_code == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            if (ptrl_remark == undefined) {
                ptrl_remark = '';
            }

            let script = ``;
            script = `select ptrl_code from tbl_petrol where (ptrl_desc = '${ptrl_desc}' or ptrl_short_desc = '${ptrl_short_desc}' or ptrl_number = '${ptrl_number}' or ptrl_sitecode = '${ptrl_sitecode}') and ptrl_flag = '1';`
            let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary0.code) {
                if (tbl_temporary0.data.length > 0) {
                    let response = [{
                        status: 'error',
                        invalid_code: '-4',
                        message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลปั้มซ้ำ`,
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลปั้มซ้ำ', action[0].value);
                    return;
                }
            }

            let ptrl_code = 'petr-' + moment().format('x');
            script = `insert into tbl_petrol 
            (ptrl_code, ptrl_number, ptrl_sitecode, ptrl_desc, ptrl_short_desc, ptrl_address, ptrl_zip_code, ptrl_country_code, ptrl_unloading_minute,
            ptrl_expenses_per_km, ptrl_area, ptrl_option_pump, ptrl_option_mrge_orders,
            ptrl_lat, ptrl_lon, off_code, ptrl_group_code, ptrl_flag, ist_dt, ptrl_remark, ptrl_sales_group, ptrl_sales_type, auto_order, prov_code, amph_code, tamb_code) 
            values 
            ('${ptrl_code}', '${ptrl_number}', '${ptrl_sitecode}', '${ptrl_desc}', '${ptrl_short_desc}', '${ptrl_address}', '${ptrl_zip_code}', 
            '${ptrl_country_code}', ${ptrl_unloading_minute}, ${ptrl_expenses_per_km}, 
            ${ptrl_area}, '${ptrl_option_pump}', '${ptrl_option_mrge_orders}', ${ptrl_lat}, ${ptrl_lon}, '${off_code}', '${ptrl_group_code}',
            '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}', '${ptrl_remark}', '${ptrl_sales_group}', '${ptrl_sales_type}', '${auto_order}', '${prov_code}', '${amph_code}', '${tamb_code}');`

            script = script.replace(/'NULL'/gi, "NULL")
            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [{
                        ptrl_code: ptrl_code
                    }],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปั้ม', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}
