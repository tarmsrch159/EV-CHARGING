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
        let { ptrl_code, off_code, ptrl_group_code, search, page_index, page_limit, action, auto_order, emp_code } = req.body[0];
        page_index == undefined ? page_index = 1 : page_index;
        page_limit == undefined ? page_limit = 10 : page_limit;
        emp_code = emp_code == undefined ? 'ALL' : emp_code;
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_code == undefined || off_code == undefined || ptrl_group_code == undefined || lic_code == undefined
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

            page_limit = page_limit || 100;

            if (ptrl_code.toString().toUpperCase() != 'ALL') {
                script = `select ptrl_code, ptrl_number, ptrl_sitecode, ptrl_desc, ptrl_short_desc, ptrl_address, ptrl_zip_code, ptrl_country_code,
                ptrl_unloading_minute, ptrl_expenses_per_km, ptrl_area, ptrl_option_pump, ptrl_option_mrge_orders, ptrl_lat, ptrl_lon,
                tbl_petrol.off_code, off_desc, tbl_petrol.ptrl_group_code, ptrl_group_desc,
                ptrl_flag, ptrl_remark, ptrl_sales_group, ptrl_sales_type, auto_order, tbl_petrol.prov_code, tbl_petrol.amph_code, tbl_petrol.tamb_code, tbl_province.prov_desc, tbl_amphure.amph_desc, tbl_tambon.tamb_desc
                from tbl_petrol 
                left join tbl_office on tbl_petrol.off_code = tbl_office.off_code 
                left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                left join tbl_province on tbl_petrol.prov_code = tbl_province.prov_code 
                left join tbl_amphure on tbl_petrol.amph_code = tbl_amphure.amph_code 
                left join tbl_tambon on tbl_petrol.tamb_code = tbl_tambon.tamb_code 
                where ptrl_flag = '1' and tbl_petrol.ptrl_code = '${ptrl_code}'`;
            }
            else {
                script = `select ptrl_code, ptrl_number, ptrl_sitecode, ptrl_desc, ptrl_short_desc, ptrl_address, ptrl_zip_code, ptrl_country_code,
                ptrl_unloading_minute, ptrl_expenses_per_km, ptrl_area, ptrl_option_pump, ptrl_option_mrge_orders, ptrl_lat, ptrl_lon,
                tbl_petrol.off_code, off_desc, tbl_petrol.ptrl_group_code, ptrl_group_desc,
                ptrl_flag, ptrl_remark, ptrl_sales_group, ptrl_sales_type, auto_order, tbl_petrol.prov_code, tbl_petrol.amph_code, tbl_petrol.tamb_code, tbl_province.prov_desc, tbl_amphure.amph_desc, tbl_tambon.tamb_desc  
                from tbl_petrol 
                left join tbl_office on tbl_petrol.off_code = tbl_office.off_code 
                left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                left join tbl_province on tbl_petrol.prov_code = tbl_province.prov_code 
                left join tbl_amphure on tbl_petrol.amph_code = tbl_amphure.amph_code 
                left join tbl_tambon on tbl_petrol.tamb_code = tbl_tambon.tamb_code 
                where ptrl_flag = '1'`;
            }

            if (auto_order != undefined && auto_order != '') {
                script += ` and tbl_petrol.auto_order = ${auto_order}`
            }

            if (ptrl_group_code.toString().toUpperCase() != 'ALL' && ptrl_group_code.toString().toUpperCase() != '') {
                script += ` and tbl_petrol.ptrl_group_code = '${ptrl_group_code}'`
            }

            if (off_code.toString().toUpperCase() != 'ALL' && off_code.toString().toUpperCase() != '') {
                script += ` and tbl_petrol.off_code = '${off_code}'`
            }

            if (action[0].value.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_petrol.ptrl_code IN (SELECT ptrl_code FROM tbl_employee WHERE emp_code = '${action[0].id}' AND emp_flag = '1') `
            }

            if (search != '') {
                script += ` and (ptrl_number like '%${search}%' 
                or ptrl_sitecode like '%${search}%' 
                or ptrl_group_desc like '%${search}%' 
                or ptrl_desc like '%${search}%' 
                or ptrl_short_desc like '%${search}%' 
                or ptrl_address like '%${search}%' 
                or ptrl_zip_code like '%${search}%')`
            }

            script += ` order by tbl_petrol.ist_dt desc `
            script += ` limit ${page_limit} offset (${page_index}*${page_limit});`

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                    let page_total = 0;
                    let rows_total = 0;
                    script = ``
                    if (ptrl_code.toString().toUpperCase() != 'ALL') {
                        script = `select ceil((ceil(count(ptrl_code)) / ${page_limit})) as page_total, (count(ptrl_code)) as rows_total 
                        from tbl_petrol 
                        left join tbl_office on tbl_petrol.off_code = tbl_office.off_code 
                        left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                        where ptrl_flag = '1' and tbl_petrol.ptrl_code = '${ptrl_code}'`;
                    }
                    else {
                        script = `select ceil((ceil(count(ptrl_code)) / ${page_limit})) as page_total, (count(ptrl_code)) as rows_total 
                        from tbl_petrol 
                        left join tbl_office on tbl_petrol.off_code = tbl_office.off_code 
                        left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                        where ptrl_flag = '1' `;
                    }

                    if (ptrl_group_code.toString().toUpperCase() != 'ALL' && ptrl_group_code.toString().toUpperCase() != '') {
                        script += ` and tbl_petrol.ptrl_group_code = '${ptrl_group_code}'`
                    }

                    if (off_code.toString().toUpperCase() != 'ALL' && off_code.toString().toUpperCase() != '') {
                        script += ` and tbl_petrol.off_code = '${off_code}'`
                    }

                    if (action[0].value.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_petrol.ptrl_code IN (SELECT ptrl_code FROM tbl_employee WHERE emp_code = '${action[0].id}' AND emp_flag = '1') `
                    }

                    if (search != '') {
                        script += ` and (ptrl_number like '%${search}%' 
                        or ptrl_sitecode like '%${search}%' 
                        or ptrl_group_desc like '%${search}%' 
                        or ptrl_desc like '%${search}%' 
                        or ptrl_short_desc like '%${search}%' 
                        or ptrl_address like '%${search}%' 
                        or ptrl_zip_code like '%${search}%')`
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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString(),
            page_total: 0,
            rows_total: 0
        }]
        res.status(200).send(response);
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
