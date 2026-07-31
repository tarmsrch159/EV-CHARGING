const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
//Success
exports.getDriverLeaveInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        let { dver_leave_code, dver_code, start_date, end_date, action, page_index, page_limit } = req.body[0];
        page_limit = page_limit == undefined ? 10 : page_limit;
        page_index = page_index == undefined ? 1 : page_index;

        if (page_index > 0) {
            page_index -= 1;
        }
        //เช็คเฉพาะส่วนที่สำคัญ
        if (dver_leave_code == undefined || dver_code == undefined || start_date == undefined || end_date == undefined || lic_code == undefined || action == undefined) {
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
            if (dver_leave_code.toString().toUpperCase() != 'ALL') {
                script = `select tbl_driver_leave.dver_leave_code, tbl_driver_leave.dver_code, tbl_driver.dver_name, tbl_driver.dver_surname, tbl_driver_leave.dver_leave_date, tbl_driver_leave.dver_leave_desc,
                tbl_driver_leave.dver_leave_type_code, tbl_driver_leave_type.dver_leave_type_desc, dver_leave_status, dver_leave_flag, tbl_driver_leave.ist_dt, tbl_driver_leave.mdf_dt, tbl_driver_leave.rm_dt 
                from tbl_driver_leave 
                left join tbl_driver 
                on tbl_driver_leave.dver_code = tbl_driver.dver_code
                left join tbl_driver_leave_type on tbl_driver_leave.dver_leave_type_code = tbl_driver_leave_type.dver_leave_type_code
                where tbl_driver_leave.dver_leave_flag = '1' and tbl_driver_leave.dver_leave_code = '${dver_leave_code}'`;
            }
            else {
                script = `select tbl_driver_leave.dver_leave_code, tbl_driver_leave.dver_code, tbl_driver.dver_name, tbl_driver.dver_surname, tbl_driver_leave.dver_leave_date, tbl_driver_leave.dver_leave_desc,
                tbl_driver_leave.dver_leave_type_code, tbl_driver_leave_type.dver_leave_type_desc, dver_leave_status, dver_leave_flag, tbl_driver_leave.ist_dt, tbl_driver_leave.mdf_dt, tbl_driver_leave.rm_dt 
                from tbl_driver_leave 
                left join tbl_driver 
                on tbl_driver_leave.dver_code = tbl_driver.dver_code
                left join tbl_driver_leave_type on tbl_driver_leave.dver_leave_type_code = tbl_driver_leave_type.dver_leave_type_code
                where tbl_driver_leave.dver_leave_flag = '1'`;
            }

            if (dver_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_driver_leave.dver_code = '${dver_code}'`
            }

            script += ` and tbl_driver_leave.dver_leave_date >= '${start_date}' 
            and tbl_driver_leave.dver_leave_date <= '${end_date}' `
            script += ` order by tbl_driver_leave.ist_dt desc `
            script += ` limit ${page_limit} offset ${page_index * page_limit}`;
            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));
                    let page_total = 0;
                    let rows_total = 0;

                    if (dver_leave_code.toString().toUpperCase() != 'ALL') {
                        script = `select count(*) as rows_total 
                        ceil(count(tbl_driver_leave.dver_leave_code)::numeric / ${page_limit}) as page_total
                        from tbl_driver_leave 
                        left join tbl_driver 
                        on tbl_driver_leave.dver_code = tbl_driver.dver_code
                        left join tbl_driver_leave_type on tbl_driver_leave.dver_leave_type_code = tbl_driver_leave_type.dver_leave_type_code
                        where tbl_driver_leave.dver_leave_flag = '1' and tbl_driver_leave.dver_leave_code = '${dver_leave_code}'`;
                    }
                    else {
                        script = `select count(*) as rows_total 
                        ceil(count(tbl_driver_leave.dver_leave_code)::numeric / ${page_limit}) as page_total
                        from tbl_driver_leave 
                        left join tbl_driver 
                        on tbl_driver_leave.dver_code = tbl_driver.dver_code
                        left join tbl_driver_leave_type on tbl_driver_leave.dver_leave_type_code = tbl_driver_leave_type.dver_leave_type_code
                        where tbl_driver_leave.dver_leave_flag = '1'`;
                    }

                    if (dver_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_driver_leave.dver_code = '${dver_code}'`
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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงการลาของพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงการลาของพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.removeDriverLeave = async (req, res, next) => {

    return (async () => {

        let lic_code = req.header('lic_code');
        let { dver_leave_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (dver_leave_code == undefined || lic_code == undefined || action == undefined) {
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
            script = `update tbl_driver_leave set dver_leave_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' where dver_leave_code = '${dver_leave_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบการลาของพนักงาน', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบการลาของพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ลบการลาของพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.setDriverLeaveInformation = async (req, res, next) => {

    return (async () => {
        //debugger
        let lic_code = req.header('lic_code');
        let { dver_leave_code } = req.query;
        let { dver_code, dver_leave_date, dver_leave_desc, dver_leave_type_code, dver_leave_status, action } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (dver_leave_code == undefined || dver_code == undefined || dver_leave_date == undefined || dver_leave_desc == undefined || dver_leave_type_code == undefined
            || dver_leave_status == undefined || action == undefined) {
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

            script = `update tbl_driver_leave set
            dver_code = '${dver_code}',
            dver_leave_date = '${dver_leave_date}',
            dver_leave_desc = '${dver_leave_desc}',
            dver_leave_type_code = '${dver_leave_type_code}',
            dver_leave_status = '${dver_leave_status}',
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where dver_leave_code = '${dver_leave_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขการลาของพนักงาน', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขการลาของพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขการลาของพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.addDriverLeaveInformation = async (req, res, next) => {

    return (async () => {
        //debugger
        let lic_code = req.header('lic_code');
        let { dver_code, dver_leave_date, dver_leave_desc, dver_leave_type_code, dver_leave_status, action } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (dver_code == undefined || dver_leave_date == undefined || dver_leave_desc == undefined || dver_leave_type_code == undefined
            || dver_leave_status == undefined || action == undefined) {
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
            script = `select dver_leave_code from tbl_driver_leave where dver_code = '${dver_code}' and dver_leave_flag = '1' 
            and dver_leave_status = '${dver_leave_status}' and dver_leave_date = '${dver_leave_date}';`

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
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มการลาของพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ', action[0].value);
                    return;
                }
            }

            let dver_leave_code = 'leav-' + moment().format('x');
            script = `insert into tbl_driver_leave 
            (dver_leave_code, dver_code, dver_leave_date, dver_leave_desc, dver_leave_status, dver_leave_flag, dver_leave_type_code, ist_dt) values 
            ('${dver_leave_code}', '${dver_code}', '${dver_leave_date}', '${dver_leave_desc}', '${dver_leave_status}', '1', '${dver_leave_type_code}', '${moment().format('YYYY-MM-DD HH:mm:ss')}');`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [{
                        dver_leave_code: dver_leave_code
                    }],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มการลาของพนักงาน', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มการลาของพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มการลาของพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}
