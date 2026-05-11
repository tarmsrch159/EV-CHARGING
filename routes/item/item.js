const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
exports.getItemInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { itm_code, itm_material_number, search, page_index, page_limit, action, itm_sales_org, itm_order_type } = req.body[0];
        page_index == undefined ? page_index = 1 : page_index;
        page_limit == undefined ? page_limit = 10 : page_limit;


        //เช็คเฉพาะส่วนที่สำคัญ
        if (itm_code == undefined || itm_material_number == undefined || lic_code == undefined
            || search == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss'),
                page_total: 0,
                rows_total: 0
            }]

            res.status(200).send(response);
        } else {
            let script = ``;
            if (page_index > 0) {
                page_index -= 1;
            }


            if (itm_code.toString().toUpperCase() != 'ALL') {
                script = `select tbl_item.itm_code,
                tbl_item.itm_desc,
                tbl_item.itm_short_desc,
                tbl_item.itm_type_code,
                tbl_item_type.itm_type_desc,
                tbl_item.itm_unit_code,
                tbl_item_unit.itm_unit_desc,
                tbl_item.itm_icon,
                tbl_item.itm_image,
                tbl_item.itm_material_number,
                tbl_item.itm_flag,
                tbl_item.itm_weight_litr_per_kg,
                tbl_item.itm_sales_org,
                tbl_order_type.ord_type_desc,
                tbl_order_type.sales_order_type as itm_order_type,
                tbl_item.ist_dt,
                tbl_item.mdf_dt,
                tbl_item.rm_dt 
                from tbl_item
                left join tbl_item_unit on tbl_item.itm_unit_code = tbl_item_unit.itm_unit_code
                left join tbl_item_type on tbl_item.itm_type_code = tbl_item_type.itm_type_code 
                left join tbl_order_type on tbl_item.itm_order_type = tbl_order_type.ord_type_code
                where tbl_item.itm_flag = '1' and tbl_item.itm_code = '${itm_code}'`;
            }
            else {
                script = `select tbl_item.itm_code,
                tbl_item.itm_desc,
                tbl_item.itm_short_desc,
                tbl_item.itm_type_code,
                tbl_item_type.itm_type_desc,
                tbl_item.itm_unit_code,
                tbl_item_unit.itm_unit_desc,
                tbl_item.itm_icon,
                tbl_item.itm_image,
                tbl_item.itm_material_number,
                tbl_item.itm_flag,
                tbl_item.itm_weight_litr_per_kg,
                tbl_item.itm_sales_org,
                tbl_order_type.ord_type_desc,
                tbl_order_type.sales_order_type as itm_order_type,
                tbl_item.ist_dt,
                tbl_item.mdf_dt,
                tbl_item.rm_dt 
                from tbl_item
                left join tbl_item_unit on tbl_item.itm_unit_code = tbl_item_unit.itm_unit_code
                left join tbl_item_type on tbl_item.itm_type_code = tbl_item_type.itm_type_code 
                left join tbl_order_type on tbl_item.itm_order_type = tbl_order_type.ord_type_code
                where tbl_item.itm_flag = '1'`;
            }

            if (itm_material_number.toString().toUpperCase() != 'ALL' && itm_material_number.toString().toUpperCase() != '') {
                script += ` and tbl_item.itm_material_number = '${itm_material_number}'`
            }

            if (search != '') {
                script += ` and (tbl_item.itm_material_number like '%${search}%' 
                or tbl_item.itm_desc ILIKE '%${search}%' 
                or tbl_item.itm_short_desc ILIKE '%${search}%' 
                or tbl_item_type.itm_type_desc ILIKE '%${search}%' 
                or tbl_item_unit.itm_unit_desc ILIKE '%${search}%')`
            }

            // กรองเพิ่มเติมตาม array itm_sales_org
            if (itm_sales_org && Array.isArray(itm_sales_org) && itm_sales_org.length > 0) {
                const orgs = itm_sales_org.map(val => `'${String(val).replace(/'/g, "''")}'`).join(", ");
                script += ` AND tbl_item.itm_sales_org IN (${orgs}) `;
            }

            // กรองเพิ่มเติมตาม array itm_order_type (รองรับทั้ง ord_type_code และ sales_order_type)
            if (itm_order_type && Array.isArray(itm_order_type) && itm_order_type.length > 0) {
                const otypes = itm_order_type.map(val => `'${String(val).replace(/'/g, "''")}'`).join(", ");
                script += ` AND (
                    tbl_item.itm_order_type IN (${otypes})
                    OR tbl_item.itm_order_type IN (SELECT ord_type_code FROM tbl_order_type WHERE sales_order_type IN (${otypes}))
                ) `;
            }

            // ดัก undefined ให้ Action
            let act_val = action?.[0]?.value?.toString().toUpperCase() || "ALL";
            let act_id = action?.[0]?.id || "";

            // จัดการเงื่อนไขตามสิทธิ์การเข้าถึง
            if (act_val !== "ALL") {
                if (act_val === "GROUP") {

                    // กรองตาม Order Type (ZOR1, ZOR2)
                    script += ` AND (
          NOT EXISTS (SELECT 1 FROM tbl_employee_order_type WHERE emp_code = '${act_id}' AND emp_otyp_flag = 1)
          OR tbl_item.itm_order_type IN (
            SELECT t2.ord_type_code 
            FROM tbl_employee_order_type t1 
            JOIN tbl_order_type t2 ON t1.ord_type_code = t2.ord_type_code 
            WHERE t1.emp_code = '${act_id}' AND t1.emp_otyp_flag = 1
          )
        )`;

                    // กรองตาม Sales Org (เช่น 1000, 1900)
                    script += ` AND (
          NOT EXISTS (SELECT 1 FROM tbl_employee_sales_org WHERE emp_code = '${act_id}' AND emp_sorg_flag = 1)
          OR tbl_item.itm_sales_org IN (SELECT sales_org_code FROM tbl_employee_sales_org WHERE emp_code = '${act_id}' AND emp_sorg_flag = 1)
        )`;
                }
            }

            script += ` order by tbl_item.ist_dt desc, tbl_item.itm_desc asc `
            script += ` offset (${page_index}*${page_limit}) limit ${page_limit};`


            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                    let page_total = 0;
                    let rows_total = 0;
                    script = ``
                    if (itm_code.toString().toUpperCase() != 'ALL') {
                        script = `select ceil((ceil(count(itm_code)) / ${page_limit})) as page_total, (count(itm_code)) as rows_total 
                        from tbl_item
                        left join tbl_item_unit on tbl_item.itm_unit_code = tbl_item_unit.itm_unit_code
                        left join tbl_item_type on tbl_item.itm_type_code = tbl_item_type.itm_type_code 
                        where tbl_item.itm_flag = '1' and tbl_item.itm_code = '${itm_code}'`;
                    }
                    else {
                        script = `select ceil((ceil(count(itm_code)) / ${page_limit})) as page_total, (count(itm_code)) as rows_total 
                        from tbl_item
                        left join tbl_item_unit on tbl_item.itm_unit_code = tbl_item_unit.itm_unit_code
                        left join tbl_item_type on tbl_item.itm_type_code = tbl_item_type.itm_type_code 
                        where tbl_item.itm_flag = '1'`;
                    }

                    if (itm_material_number.toString().toUpperCase() != 'ALL' && itm_material_number.toString().toUpperCase() != '') {
                        script += ` and tbl_item.itm_material_number = '${itm_material_number}'`
                    }

                    if (search != '') {
                        script += ` and (tbl_item.itm_material_number like '%${search}%' 
                        or tbl_item.itm_desc ILIKE '%${search}%' 
                        or tbl_item.itm_short_desc ILIKE '%${search}%' 
                        or tbl_item_type.itm_type_desc ILIKE '%${search}%' 
                        or tbl_item_unit.itm_unit_desc ILIKE '%${search}%')`
                    }

                    // กรองเพิ่มเติมตาม array itm_sales_org
                    if (itm_sales_org && Array.isArray(itm_sales_org) && itm_sales_org.length > 0) {
                        const orgs = itm_sales_org.map(val => `'${String(val).replace(/'/g, "''")}'`).join(", ");
                        script += ` AND tbl_item.itm_sales_org IN (${orgs}) `;
                    }

                    // กรองเพิ่มเติมตาม array itm_order_type (รองรับทั้ง ord_type_code และ sales_order_type)
                    if (itm_order_type && Array.isArray(itm_order_type) && itm_order_type.length > 0) {
                        const otypes = itm_order_type.map(val => `'${String(val).replace(/'/g, "''")}'`).join(", ");
                        script += ` AND (
                            tbl_item.itm_order_type IN (${otypes})
                            OR tbl_item.itm_order_type IN (SELECT ord_type_code FROM tbl_order_type WHERE sales_order_type IN (${otypes}))
                        ) `;
                    }

                    // จัดการเงื่อนไขตามสิทธิ์การเข้าถึงสำหรับชุดนับจำนวน
                    if (act_val !== "ALL") {
                        if (act_val === "GROUP") {
                            // กรองตาม Order Type (ZOR1, ZOR2)
                            script += ` AND (
                              NOT EXISTS (SELECT 1 FROM tbl_employee_order_type WHERE emp_code = '${act_id}' AND emp_otyp_flag = 1)
                              OR tbl_item.itm_order_type IN (
                                SELECT t2.ord_type_code 
                                FROM tbl_employee_order_type t1 
                                JOIN tbl_order_type t2 ON t1.ord_type_code = t2.ord_type_code 
                                WHERE t1.emp_code = '${act_id}' AND t1.emp_otyp_flag = 1
                              )
                            )`;

                            // กรองตาม Sales Org (เช่น 1000, 1900)
                            script += ` AND (
                              NOT EXISTS (SELECT 1 FROM tbl_employee_sales_org WHERE emp_code = '${act_id}' AND emp_sorg_flag = 1)
                              OR tbl_item.itm_sales_org IN (SELECT sales_org_code FROM tbl_employee_sales_org WHERE emp_code = '${act_id}' AND emp_sorg_flag = 1)
                            )`;
                        }
                    }

                    let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

                    if (!tbl_temporary0.code) {
                        if (tbl_temporary0.data.length > 0) {
                            page_total = parseInt(tbl_temporary0.data[0].page_total);
                            rows_total = parseInt(tbl_temporary0.data[0].rows_total);
                        }
                    }

                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: tbl_temporary.data,
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss'),
                        page_total: (page_total <= 0 ? 1 : page_total),
                        rows_total: rows_total
                    }]

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
                    }]

                    res.status(200).send(response);
                    return;
                }
            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss'),
                    page_total: 0,
                    rows_total: 0
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลสินค้า', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
            response_time: moment().format('YYYY-MM-DD HH:mm:ss'),
            page_total: 0,
            rows_total: 0
        }]
        res.status(200).send(response);
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลสินค้า', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

exports.removeItem = async (req, res, next) => {

    return (async () => {

        let lic_code = req.header('lic_code');
        let { itm_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (itm_code == undefined || lic_code == undefined || action == undefined) {
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
            script = `update tbl_item set itm_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where itm_code = '${itm_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลสินค้า', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลสินค้า', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.setItemInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let { itm_code } = req.query;
        let {
            itm_desc,
            itm_short_desc,
            itm_type_code,
            itm_unit_code,
            itm_icon,
            itm_image,
            itm_material_number,
            itm_weight_litr_per_kg,
            itm_sales_org,
            itm_order_type,
            action
        } = req.body[0];

        //เช็คพารามิเตอร์ที่จำเป็น
        let missing = [];
        if (itm_code == undefined) missing.push('itm_code');
        if (itm_desc == undefined) missing.push('itm_desc');
        if (itm_short_desc == undefined) missing.push('itm_short_desc');
        if (itm_type_code == undefined) missing.push('itm_type_code');
        if (itm_unit_code == undefined) missing.push('itm_unit_code');
        if (itm_icon == undefined) missing.push('itm_icon');
        if (itm_image == undefined) missing.push('itm_image');
        if (itm_material_number == undefined) missing.push('itm_material_number');
        if (itm_weight_litr_per_kg == undefined) missing.push('itm_weight_litr_per_kg');
        if (action == undefined) missing.push('action');

        if (missing.length > 0) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]
            return res.status(200).send(response);
        } else {

            // Lookup internal code for order_type (SAP code -> Internal code)
            let checkOrderType = await pgConn.get(dbPrefix + lic_code, `SELECT ord_type_code FROM tbl_order_type WHERE sales_order_type = '${itm_order_type}' OR ord_type_code = '${itm_order_type}' LIMIT 1`, config.connectionString());
            if (!checkOrderType.code && checkOrderType.data.length > 0) {
                itm_order_type = checkOrderType.data[0].ord_type_code;
            }

            let script = ``;
            script = `update tbl_item set
            itm_desc = '${itm_desc}',
            itm_short_desc = '${itm_short_desc}',
            itm_type_code = '${itm_type_code}',
            itm_unit_code = '${itm_unit_code}',
            itm_icon = '${itm_icon}',
            itm_image = '${itm_image}',
            itm_material_number = '${itm_material_number}',
            itm_weight_litr_per_kg = ${itm_weight_litr_per_kg},
            itm_sales_org = '${itm_sales_org}',
            itm_order_type = '${itm_order_type}',
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where itm_code = '${itm_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลสินค้า', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลสินค้า', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลสินค้า', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.addItemInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            itm_desc,
            itm_short_desc,
            itm_type_code,
            itm_unit_code,
            itm_icon,
            itm_image,
            itm_material_number,
            itm_weight_litr_per_kg,
            itm_sales_org,
            itm_order_type,
            action
        } = req.body[0];

        //เช็คพารามิเตอร์ที่จำเป็น
        let missing = [];
        if (itm_desc == undefined) missing.push('itm_desc');
        if (itm_short_desc == undefined) missing.push('itm_short_desc');
        if (itm_type_code == undefined) missing.push('itm_type_code');
        if (itm_unit_code == undefined) missing.push('itm_unit_code');
        if (itm_icon == undefined) missing.push('itm_icon');
        if (itm_image == undefined) missing.push('itm_image');
        if (itm_material_number == undefined) missing.push('itm_material_number');
        if (itm_weight_litr_per_kg == undefined) missing.push('itm_weight_litr_per_kg');
        if (action == undefined) missing.push('action');

        if (missing.length > 0) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]
            return res.status(200).send(response);
        } else {


            let script = ``;
            script = `select itm_code from tbl_item where 
            (itm_desc = '${itm_desc}' or itm_short_desc = '${itm_short_desc}' 
            or itm_material_number = '${itm_material_number}') and itm_flag = '1' and itm_sales_org = '${itm_sales_org}' 
            and itm_order_type = '${itm_order_type}';`

            let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary0.code) {
                if (tbl_temporary0.data.length > 0) {
                    let response = [{
                        status: 'error',
                        invalid_code: '-4',
                        message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลสินค้าซ้ำ`,
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลสินค้า', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลสินค้าซ้ำ', action[0].value);
                    return;
                }
            }

            // Lookup internal code for order_type (SAP code -> Internal code)
            let checkOrderType = await pgConn.get(dbPrefix + lic_code, `SELECT ord_type_code FROM tbl_order_type WHERE sales_order_type = '${itm_order_type}' OR ord_type_code = '${itm_order_type}' LIMIT 1`, config.connectionString());
            if (!checkOrderType.code && checkOrderType.data.length > 0) {
                itm_order_type = checkOrderType.data[0].ord_type_code;
            }

            let itm_code = 'itm-' + moment().format('x');
            script = `insert into tbl_item 
            (itm_code, itm_desc, itm_short_desc, itm_type_code, itm_unit_code, itm_icon, itm_image, 
            itm_material_number, itm_weight_litr_per_kg, itm_flag, ist_dt, itm_sales_org, itm_order_type) 
            values 
            ('${itm_code}', '${itm_desc}', '${itm_short_desc}', '${itm_type_code}', '${itm_unit_code}', '${itm_icon}', 
            '${itm_image}', '${itm_material_number}', ${itm_weight_litr_per_kg}, '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}', '${itm_sales_org}', '${itm_order_type}');`

            script = script.replace(/'NULL'/gi, "NULL")
            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [{
                        itm_code: itm_code
                    }],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลสินค้า', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลสินค้า', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลสินค้า', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}
