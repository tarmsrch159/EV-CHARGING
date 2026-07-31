const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
//Success
exports.getVehicleCompartmentInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        let { veh_code, veh_compartment_code, action, page_index, page_limit } = req.body[0];
        page_index = page_index == undefined ? 1 : page_index;
        page_limit = page_limit == undefined ? 10 : page_limit;

        if (page_index > 0) {
            page_index -= 1
        }

        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_compartment_code == undefined || lic_code == undefined || veh_code == undefined || action == undefined) {
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
            if (veh_compartment_code.toString().toUpperCase() != 'ALL') {
                script = `select 
                veh_compartment_code, 
                veh_compartment_number, 
                veh_compartment_flag,
                (select count(veh_compartment_level_code) 
                from tbl_vehicle_compartment_level 
                where veh_compartment_code = tbl_vehicle_compartment.veh_compartment_code and veh_compartment_level_flag = '1') :: integer as level_count,
                (select case when max(veh_compartment_level) is null then 0 else max(veh_compartment_level) end as veh_compartment_level 
                from tbl_vehicle_compartment_level 
                where veh_compartment_code = tbl_vehicle_compartment.veh_compartment_code and veh_compartment_level_flag = '1') as level_maximum_capacity,
                tbl_vehicle_compartment.ist_dt, 
                tbl_vehicle_compartment.mdf_dt, 
                tbl_vehicle_compartment.rm_dt, 
                (select array_to_string(array_agg(veh_compartment_level),',', '*') 
                from tbl_vehicle_compartment_level 
                where tbl_vehicle_compartment_level.veh_compartment_code = tbl_vehicle_compartment.veh_compartment_code 
                and veh_compartment_level_flag = '1') as level_capacity 
                from tbl_vehicle_compartment 
                where veh_compartment_flag = '1' and tbl_vehicle_compartment.veh_compartment_code = '${veh_compartment_code}'`;
            } else {
                script = `select 
                veh_compartment_code, 
                veh_compartment_number, 
                veh_compartment_flag,
                (select count(veh_compartment_level_code) 
                from tbl_vehicle_compartment_level 
                where veh_compartment_code = tbl_vehicle_compartment.veh_compartment_code and veh_compartment_level_flag = '1') :: integer as level_count,
                (select case when max(veh_compartment_level) is null then 0 else max(veh_compartment_level) end as veh_compartment_level 
                from tbl_vehicle_compartment_level 
                where veh_compartment_code = tbl_vehicle_compartment.veh_compartment_code and veh_compartment_level_flag = '1') as level_maximum_capacity,
                tbl_vehicle_compartment.ist_dt, 
                tbl_vehicle_compartment.mdf_dt, 
                tbl_vehicle_compartment.rm_dt, 
                (select array_to_string(array_agg(veh_compartment_level),',', '*') from tbl_vehicle_compartment_level 
                where tbl_vehicle_compartment_level.veh_compartment_code = tbl_vehicle_compartment.veh_compartment_code 
                and veh_compartment_level_flag = '1') as level_capacity 
                from tbl_vehicle_compartment 
                where veh_compartment_flag = '1'`;
            }

            script += ` and tbl_vehicle_compartment.veh_code = '${veh_code}' order by tbl_vehicle_compartment.ist_dt desc`
            script += ` offset (${page_index}*${page_limit}) limit ${page_limit};`

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));
                    let page_total = 0;
                    let rows_total = 0;

                    if (veh_compartment_code.toString().toUpperCase() != 'ALL') {
                        script = `select 
                         ceil((ceil(count(veh_compartment_code)) / ${page_limit})) as page_total, 
                        count(*) as rows_total
                        from tbl_vehicle_compartment 
                        where veh_compartment_flag = '1' and tbl_vehicle_compartment.veh_compartment_code = '${veh_compartment_code}'`;
                    } else {
                        script = `select 
                        ceil((ceil(count(veh_compartment_code)) / ${page_limit})) as page_total, 
                        count(*) as rows_total
                        from tbl_vehicle_compartment 
                        where veh_compartment_flag = '1'`;
                    }

                    let tbl_temporary_page = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
                    if (!tbl_temporary_page.code) {
                        if (tbl_temporary_page.data.length > 0) {
                            tbl_temporary_page.data = JSON.parse(JSON.stringify(tbl_temporary_page.data).replace(/\:null/gi, "\:\"\""));
                            page_total = parseInt(tbl_temporary_page.data[0].page_total);
                            rows_total = parseInt(tbl_temporary_page.data[0].rows_total);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลช่องน้ำมันของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลช่องน้ำมันของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.removeVehicleCompartment = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { veh_compartment_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_compartment_code == undefined || lic_code == undefined || action == undefined) {
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
            script = `update tbl_vehicle_compartment set veh_compartment_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' where veh_compartment_code = '${veh_compartment_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลช่องน้ำมันของรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลช่องน้ำมันของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลช่องน้ำมันของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.setVehicleCompartmentInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let { veh_compartment_code } = req.query;
        let {
            veh_code,
            veh_compartment_number,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_compartment_code == undefined || veh_compartment_number == undefined || veh_code == undefined || action == undefined) {
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
            script = `update tbl_vehicle_compartment set 
            veh_code = '${veh_code}',
            veh_compartment_number = '${veh_compartment_number}',
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where veh_compartment_code = '${veh_compartment_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลช่องน้ำมันของรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลช่องน้ำมันของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลช่องน้ำมันของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

//Success
exports.addVehicleCompartmentInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            veh_code,
            veh_compartment_number,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_compartment_number == undefined || veh_code == undefined || action == undefined) {
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
            script = `select veh_compartment_code from tbl_vehicle_compartment where veh_compartment_number = '${veh_compartment_number}' and veh_code = '${veh_code}' and veh_compartment_flag = '1';`
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
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลช่องน้ำมันของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ', action[0].value);
                    return;
                }
            }

            let veh_compartment_code = 'vcom-' + moment().format('x');
            script = `insert into tbl_vehicle_compartment 
            (veh_compartment_code, veh_code, veh_compartment_number, veh_compartment_flag, ist_dt) values 
            ('${veh_compartment_code}', '${veh_code}','${veh_compartment_number}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}');`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [{
                        veh_compartment_code: veh_compartment_code
                    }],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลช่องน้ำมันของรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลช่องน้ำมันของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลช่องน้ำมันของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}