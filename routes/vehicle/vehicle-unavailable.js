const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
//Success
exports.getVehicleUnavailableInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        let { veh_unavailable_code, veh_code, start_date, end_date, action, page_index, page_limit } = req.body[0];
        page_limit = page_limit == undefined ? 10 : page_limit;
        page_index = page_index == undefined ? 1 : page_index;

        if (page_index > 0) {
            page_index -= 1;
        }

        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_unavailable_code == undefined || veh_code == undefined || start_date == undefined || end_date == undefined || lic_code == undefined || action == undefined) {
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
            if (veh_unavailable_code.toString().toUpperCase() != 'ALL') {
                script = `select tbl_vehicle_unavailable.veh_unavailable_code, tbl_vehicle_unavailable.veh_code, tbl_vehicle.veh_number, tbl_vehicle.veh_license_number, tbl_vehicle_unavailable.veh_unavailable_date, tbl_vehicle_unavailable.veh_unavailable_desc,
                tbl_vehicle_unavailable.veh_unavailable_type_code, tbl_vehicle_unavailable_type.veh_unavailable_type_desc, veh_unavailable_status, veh_unavailable_flag, tbl_vehicle_unavailable.ist_dt, tbl_vehicle_unavailable.mdf_dt, tbl_vehicle_unavailable.rm_dt 
                from tbl_vehicle_unavailable 
                left join tbl_vehicle 
                on tbl_vehicle_unavailable.veh_code = tbl_vehicle.veh_code
                left join tbl_vehicle_unavailable_type on tbl_vehicle_unavailable.veh_unavailable_type_code = tbl_vehicle_unavailable_type.veh_unavailable_type_code
                where tbl_vehicle_unavailable.veh_unavailable_flag = '1' and tbl_vehicle_unavailable.veh_unavailable_code = '${veh_unavailable_code}'`;
            }
            else {
                script = `select tbl_vehicle_unavailable.veh_unavailable_code, tbl_vehicle_unavailable.veh_code, tbl_vehicle.veh_number, tbl_vehicle.veh_license_number, tbl_vehicle_unavailable.veh_unavailable_date, tbl_vehicle_unavailable.veh_unavailable_desc,
                tbl_vehicle_unavailable.veh_unavailable_type_code, tbl_vehicle_unavailable_type.veh_unavailable_type_desc, veh_unavailable_status, veh_unavailable_flag, tbl_vehicle_unavailable.ist_dt, tbl_vehicle_unavailable.mdf_dt, tbl_vehicle_unavailable.rm_dt 
                from tbl_vehicle_unavailable 
                left join tbl_vehicle 
                on tbl_vehicle_unavailable.veh_code = tbl_vehicle.veh_code
                left join tbl_vehicle_unavailable_type on tbl_vehicle_unavailable.veh_unavailable_type_code = tbl_vehicle_unavailable_type.veh_unavailable_type_code
                where tbl_vehicle_unavailable.veh_unavailable_flag = '1'`;
            }

            if (veh_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_vehicle.veh_code = '${veh_code}'`
            }

            script += ` and tbl_vehicle_unavailable.veh_unavailable_date >= '${start_date}' 
            and tbl_vehicle_unavailable.veh_unavailable_date <= '${end_date}' `
            script += ` order by tbl_vehicle_unavailable.ist_dt desc`
            script += ` limit ${page_limit} offset ${page_index * page_limit}`;

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));
                    let page_total = 0;
                    let rows_total = 0;

                    if (veh_unavailable_code.toString().toUpperCase() != 'ALL') {
                        script = `select 
                        count(*) as rows_total,
                        ceil(count(tbl_vehicle_unavailable.veh_unavailable_code)::numeric / ${page_limit}) as page_total
                        from tbl_vehicle_unavailable 
                        left join tbl_vehicle 
                        on tbl_vehicle_unavailable.veh_code = tbl_vehicle.veh_code
                        left join tbl_vehicle_unavailable_type on tbl_vehicle_unavailable.veh_unavailable_type_code = tbl_vehicle_unavailable_type.veh_unavailable_type_code
                        where tbl_vehicle_unavailable.veh_unavailable_flag = '1' and tbl_vehicle_unavailable.veh_unavailable_code = '${veh_unavailable_code}'`;
                    }
                    else {
                        script = `select 
                        count(*) as rows_total,
                        ceil(count(tbl_vehicle_unavailable.veh_unavailable_code)::numeric / ${page_limit}) as page_total
                        from tbl_vehicle_unavailable 
                        left join tbl_vehicle 
                        on tbl_vehicle_unavailable.veh_code = tbl_vehicle.veh_code
                        left join tbl_vehicle_unavailable_type on tbl_vehicle_unavailable.veh_unavailable_type_code = tbl_vehicle_unavailable_type.veh_unavailable_type_code
                        where tbl_vehicle_unavailable.veh_unavailable_flag = '1'`;
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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงการไม่พร้อมใช้งานของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงการไม่พร้อมใช้งานของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.removeVehicleUnavailable = async (req, res, next) => {

    return (async () => {

        let lic_code = req.header('lic_code');
        let { veh_unavailable_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_unavailable_code == undefined || lic_code == undefined || action == undefined) {
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
            script = `update tbl_vehicle_unavailable set veh_unavailable_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' where veh_unavailable_code = '${veh_unavailable_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบการไม่พร้อมใช้งานของรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
                return;
            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ลบการไม่พร้อมใช้งานของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ลบการไม่พร้อมใช้งานของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.setVehicleUnavailableInformation = async (req, res, next) => {

    return (async () => {
        //debugger
        let lic_code = req.header('lic_code');
        let { veh_unavailable_code } = req.query;
        let { veh_code, veh_unavailable_date, veh_unavailable_desc, veh_unavailable_type_code, veh_unavailable_status, action } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_unavailable_code == undefined || veh_code == undefined || veh_unavailable_date == undefined || veh_unavailable_desc == undefined || veh_unavailable_type_code == undefined
            || veh_unavailable_status == undefined || action == undefined) {
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

            script = `update tbl_vehicle_unavailable set
            veh_code = '${veh_code}',
            veh_unavailable_date = '${veh_unavailable_date}',
            veh_unavailable_desc = '${veh_unavailable_desc}',
            veh_unavailable_type_code = '${veh_unavailable_type_code}',
            veh_unavailable_status = '${veh_unavailable_status}',
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where veh_unavailable_code = '${veh_unavailable_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขการไม่พร้อมใช้งานของรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขการไม่พร้อมใช้งานของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขการไม่พร้อมใช้งานของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.addVehicleUnavailableInformation = async (req, res, next) => {

    return (async () => {
        //debugger
        let lic_code = req.header('lic_code');
        let { veh_code, veh_unavailable_date, veh_unavailable_desc, veh_unavailable_type_code, veh_unavailable_status, action } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_code == undefined || veh_unavailable_date == undefined || veh_unavailable_desc == undefined || veh_unavailable_type_code == undefined
            || veh_unavailable_status == undefined || action == undefined) {
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
            script = `select veh_unavailable_code from tbl_vehicle_unavailable where veh_code = '${veh_code}' and veh_unavailable_flag = '1' 
            and veh_unavailable_status = '${veh_unavailable_status}' and veh_unavailable_date = '${veh_unavailable_date}';`

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
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มการไม่พร้อมใช้งานของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ', action[0].value);
                    return;
                }
            }

            let veh_unavailable_code = 'uble-' + moment().format('x');
            script = `insert into tbl_vehicle_unavailable 
            (veh_unavailable_code, veh_code, veh_unavailable_date, veh_unavailable_desc, veh_unavailable_status, veh_unavailable_type_code ,veh_unavailable_flag, ist_dt) values 
            ('${veh_unavailable_code}', '${veh_code}', '${veh_unavailable_date}', '${veh_unavailable_desc}', '${veh_unavailable_status}', '${veh_unavailable_type_code}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}');`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [{
                        veh_unavailable_code: veh_unavailable_code
                    }],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มการไม่พร้อมใช้งานของรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มการไม่พร้อมใช้งานของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มการไม่พร้อมใช้งานของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}


exports.addVehicleUnavailableMutiDateInformation = async (req, res, next) => {

    return (async () => {
        //debugger
        let lic_code = req.header('lic_code');
        let { veh_code, veh_unavailable_date, veh_unavailable_desc, veh_unavailable_type_code, veh_unavailable_status, action } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_code == undefined || veh_unavailable_date == undefined || veh_unavailable_desc == undefined || veh_unavailable_type_code == undefined
            || veh_unavailable_status == undefined || action == undefined) {
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
            script = `select veh_unavailable_code from tbl_vehicle_unavailable where veh_code = '${veh_code}' and veh_unavailable_flag = '1' 
            and veh_unavailable_status = '${veh_unavailable_status}' 
            and veh_unavailable_date in (${veh_unavailable_date.map(number => `'${number}'`).toString()});`

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
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มการไม่พร้อมใช้งานของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ', action[0].value);
                    return;
                }
            }

            for (var xxr = 0; xxr <= veh_unavailable_date.length - 1; xxr++) {

                let veh_unavailable_code = 'uble-' + moment().format('x');
                script = `insert into tbl_vehicle_unavailable 
                (veh_unavailable_code, veh_code, veh_unavailable_date, veh_unavailable_desc, veh_unavailable_status, veh_unavailable_type_code ,veh_unavailable_flag, ist_dt) values 
                ('${veh_unavailable_code}', '${veh_code}', '${veh_unavailable_date[xxr]}', '${veh_unavailable_desc}', '${veh_unavailable_status}', '${veh_unavailable_type_code}', 
                '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}');`

                let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                if (tbl_temporary.code) {
                    let response = [{
                        status: 'error',
                        invalid_code: '-3',
                        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]
                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มการไม่พร้อมใช้งานของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                    return;
                }

                if (xxr == veh_unavailable_date.length - 1) {
                    //debugger
                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: [{
                            veh_unavailable_code: veh_unavailable_code
                        }],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มการไม่พร้อมใช้งานของรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
                    return;
                }
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มการไม่พร้อมใช้งานของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}
