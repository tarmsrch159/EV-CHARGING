const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js

//Success
exports.getOfficeInformation = async (req, res, next) => {

    var xresult = [];


    return (async () => {

        let lic_code = req.header('lic_code');
        let { off_code, action, page_index, page_limit } = req.body[0];
        page_limit = page_limit == undefined ? 10 : page_limit;
        page_index = page_index == undefined ? 1 : page_index;

        if (page_index > 0) {
            page_index -= 1;
        }
        //เช็คเฉพาะส่วนที่สำคัญ
        if (off_code == undefined || lic_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return;
        } else {

            let script = ``;
            if (off_code.toString().toUpperCase() != 'ALL') {
                script = `select off_code, off_desc, off_desc_en, off_number, off_address, 
                off_tamb_code,tamb_desc as off_tamb_desc,tamb_desc_en as off_tamb_desc_en,
                off_amph_code,amph_desc as off_amph_desc,amph_desc_en as off_amph_desc_en,
                off_prov_code,prov_desc as off_prov_desc,prov_desc_en as off_prov_desc_en,
                tbl_tambon.post_code as off_post_code,off_latitude, off_longitude, off_area, 
                off_flag, tbl_office.ist_dt, tbl_office.mdf_dt, tbl_office.rm_dt, tbl_office.order_cutoff_time, tbl_office.cutoff_status, tbl_office.start_calculate_auto_order, tbl_office.end_calculate_auto_order
                from tbl_office 
                left join tbl_province on tbl_office.off_prov_code = tbl_province.prov_code
                left join tbl_amphure on tbl_office.off_prov_code = tbl_amphure.prov_code
                and tbl_office.off_amph_code = tbl_amphure.amph_code
                left join tbl_tambon on tbl_office.off_amph_code = tbl_tambon.amph_code
                and tbl_office.off_tamb_code = tbl_tambon.tamb_code 
                where off_flag = '1' and off_code = '${off_code}'`;
            }
            else {
                script = `select off_code, off_desc, off_desc_en, off_number, off_address, 
                off_tamb_code,tamb_desc as off_tamb_desc,tamb_desc_en as off_tamb_desc_en,
                off_amph_code,amph_desc as off_amph_desc,amph_desc_en as off_amph_desc_en,
                off_prov_code,prov_desc as off_prov_desc,prov_desc_en as off_prov_desc_en,
                tbl_tambon.post_code as off_post_code,off_latitude, off_longitude, off_area, 
                off_flag, tbl_office.ist_dt, tbl_office.mdf_dt, tbl_office.rm_dt, tbl_office.order_cutoff_time, tbl_office.cutoff_status, tbl_office.start_calculate_auto_order, tbl_office.end_calculate_auto_order
                from tbl_office 
                left join tbl_province on tbl_office.off_prov_code = tbl_province.prov_code
                left join tbl_amphure on tbl_office.off_prov_code = tbl_amphure.prov_code
                and tbl_office.off_amph_code = tbl_amphure.amph_code
                left join tbl_tambon on tbl_office.off_amph_code = tbl_tambon.amph_code
                and tbl_office.off_tamb_code = tbl_tambon.tamb_code 
                where off_flag = '1' `;
            }

            script += ` order by tbl_office.ist_dt desc `
            script += ` limit ${page_limit} offset ${page_index * page_limit}`;

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));
                    let page_total = 0;
                    let rows_total = 0;
                    if (off_code.toString().toUpperCase() != 'ALL') {
                        script = `select 
                        count(*) as rows_total,
                        ceil(count(tbl_office.off_code)::numeric / ${page_limit}) as page_total
                        from tbl_office 
                        where off_flag = '1' and off_code = '${off_code}'`;
                    }
                    else {
                        script = `select 
                        count(*) as rows_total,
                        ceil(count(tbl_office.off_code)::numeric / ${page_limit}) as page_total
                        from tbl_office 
                        where off_flag = '1'`;
                    }
                    let tbl_temporary_count = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
                    if (!tbl_temporary_count.code) {
                        if (tbl_temporary_count.data.length > 0) {
                            tbl_temporary_count.data = JSON.parse(JSON.stringify(tbl_temporary_count.data).replace(/\:null/gi, "\:\"\""));
                            page_total = parseInt(tbl_temporary_count.data[0].page_total);
                            rows_total = parseInt(tbl_temporary_count.data[0].rows_total);
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

                    res.status(200).send(response);
                    return;
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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลสาขา', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลสาขา', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.removeOffice = async (req, res, next) => {

    return (async () => {

        let lic_code = req.header('lic_code');
        let { off_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (off_code == undefined || lic_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return;
        } else {

            let script = ``;
            script = `update tbl_office set off_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' where off_code = '${off_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลสาขา', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลสาขา', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                return;
            }
        }

    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }]
        res.status(200).send(response);
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลสาขา', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return
    });

}

exports.setOfficeInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let { off_code } = req.query;
        let {
            off_desc,
            off_desc_en,
            off_number,
            off_address,
            off_tamb_code,
            off_amph_code,
            off_prov_code,
            off_latitude,
            off_longitude,
            off_area,
            order_cutoff_time,
            cutoff_status,
            start_calculate_auto_order,
            end_calculate_auto_order,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (off_code == undefined || off_tamb_code == undefined || off_amph_code == undefined || off_prov_code == undefined || off_desc == undefined || off_desc_en == undefined || off_number == undefined
            || off_address == undefined || off_latitude == undefined || off_longitude == undefined || off_area == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return;
        } else {

            let script = ``;
            script = `update tbl_office set
            off_desc = '${off_desc}',
            off_desc_en = '${off_desc_en}',
            off_number = '${off_number}',
            off_address = '${off_address}',
            off_tamb_code = '${off_tamb_code}',
            off_amph_code = '${off_amph_code}',
            off_prov_code = '${off_prov_code}',
            off_latitude = ${off_latitude},
            off_longitude = ${off_longitude},
            off_area = ${off_area},
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
            order_cutoff_time = '${order_cutoff_time}',
            cutoff_status = '${cutoff_status}',
            start_calculate_auto_order = '${start_calculate_auto_order}',
            end_calculate_auto_order = '${end_calculate_auto_order}'
            where off_code = '${off_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลสาขา', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลสาขา', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลสาขา', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.addOfficeInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            off_desc,
            off_desc_en,
            off_number,
            off_address,
            off_tamb_code,
            off_amph_code,
            off_prov_code,
            off_latitude,
            off_longitude,
            off_area,
            order_cutoff_time,
            cutoff_status,
            start_calculate_auto_order,
            end_calculate_auto_order,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (off_desc == undefined || off_desc_en == undefined || off_number == undefined
            || off_address == undefined || off_latitude == undefined || off_longitude == undefined || off_area == undefined
            || off_tamb_code == undefined || off_amph_code == undefined || off_prov_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return;
        } else {

            let script = ``;
            script = `select off_code from tbl_office where (off_desc = '${off_desc}' or off_desc_en = '${off_desc_en}') and off_flag = '1';`
            let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary0.code) {
                if (tbl_temporary0.data.length > 0) {
                    let response = [{
                        status: 'error',
                        invalid_code: '-4',
                        message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ`,
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลสาขา', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ', action[0].value);
                    return;
                }
            }

            let off_code = 'off-' + moment().format('x');
            script = `insert into tbl_office (off_code, off_desc, off_desc_en, off_number, off_address, 
            off_tamb_code, off_amph_code, off_prov_code, off_latitude, off_longitude, off_area, off_flag, ist_dt, order_cutoff_time, cutoff_status, start_calculate_auto_order, end_calculate_auto_order)
            values ('${off_code}', '${off_desc}', '${off_desc_en}', '${off_number}', '${off_address}', '${off_tamb_code}', 
            '${off_amph_code}', '${off_prov_code}', ${off_latitude}, ${off_longitude}, ${off_area}, 
            '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}', '${order_cutoff_time}', '${cutoff_status}', '${start_calculate_auto_order}', '${end_calculate_auto_order}');`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [{
                        off_code: off_code
                    }],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลสาขา', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลสาขา', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลสาขา', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}
