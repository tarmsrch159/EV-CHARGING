const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
//Success
exports.getDriverCardLicenseInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        let { dver_code, dver_card_license_code } = req.query;
        let { action, page_index, page_limit } = req.body[0];
        page_limit = page_limit == undefined ? 10 : page_limit;
        page_index = page_index == undefined ? 1 : page_index;

        if (page_index > 0) {
            page_index -= 1;
        }
        //เช็คเฉพาะส่วนที่สำคัญ
        if (dver_code == undefined || dver_card_license_code == undefined || lic_code == undefined || action == undefined) {
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
            if (dver_card_license_code.toString().toUpperCase() != 'ALL') {
                script = `select dver_card_license_code, dver_code, dver_card_license_number, 
                tbl_driver_card_license.dver_card_license_type_code, tbl_driver_card_license_type.dver_card_license_type_desc, dver_card_license_date,
                dver_card_license_expire_date, dver_card_license_flag, tbl_driver_card_license.ist_dt, tbl_driver_card_license.mdf_dt, tbl_driver_card_license.rm_dt 
                from tbl_driver_card_license left join tbl_driver_card_license_type 
                on tbl_driver_card_license.dver_card_license_type_code = tbl_driver_card_license_type.dver_card_license_type_code 
                where dver_card_license_code = '${dver_card_license_code}' `;
            }
            else {
                script = `select dver_card_license_code, dver_code, dver_card_license_number, 
                tbl_driver_card_license.dver_card_license_type_code, tbl_driver_card_license_type.dver_card_license_type_desc, dver_card_license_date,
                dver_card_license_expire_date, dver_card_license_flag, tbl_driver_card_license.ist_dt, tbl_driver_card_license.mdf_dt, tbl_driver_card_license.rm_dt 
                from tbl_driver_card_license left join tbl_driver_card_license_type 
                on tbl_driver_card_license.dver_card_license_type_code = tbl_driver_card_license_type.dver_card_license_type_code 
                where dver_card_license_code is not null `;
            }

            if (dver_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_driver_card_license.dver_code = '${dver_code}' `
            }

            script += ` order by tbl_driver_card_license.ist_dt desc`
            script += ` limit ${page_limit} offset ${page_index * page_limit}`;

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));
                    let page_total = 0;
                    let rows_total = 0;

                    if (dver_card_license_code.toString().toUpperCase() != 'ALL') {
                        script = `select 
                        count(*) as rows_total,
                        ceil(count(tbl_driver_card_license.dver_card_license_type_code)::numeric / ${page_limit}) as page_total 
                        from tbl_driver_card_license left join tbl_driver_card_license_type 
                        on tbl_driver_card_license.dver_card_license_type_code = tbl_driver_card_license_type.dver_card_license_type_code 
                        where dver_card_license_code = '${dver_card_license_code}' `;
                    }
                    else {
                        script = `select 
                        count(*) as rows_total,
                        ceil(count(tbl_driver_card_license.dver_card_license_type_code)::numeric / ${page_limit}) as page_total 
                        from tbl_driver_card_license left join tbl_driver_card_license_type 
                        on tbl_driver_card_license.dver_card_license_type_code = tbl_driver_card_license_type.dver_card_license_type_code 
                        where dver_card_license_code is not null `;
                    }

                    if (dver_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_driver_card_license.dver_code = '${dver_code}' `
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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลใบขับขี่ของพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลใบขับขี่ของพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.removeDriverCardLicense = async (req, res, next) => {

    return (async () => {

        let lic_code = req.header('lic_code');
        let { dver_card_license_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (dver_card_license_code == undefined || lic_code == undefined || action == undefined) {
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
            script = `update tbl_driver_card_license set dver_card_license_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' where dver_card_license_code = '${dver_card_license_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลใบขับขี่ของพนักงาน', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลใบขับขี่ของพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลใบขับขี่ของพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.setDriverCardLicenseInformation = async (req, res, next) => {

    return (async () => {

        //debugger
        let lic_code = req.header('lic_code');
        let { dver_card_license_code } = req.query;
        let { dver_code, dver_card_license_number, dver_card_license_type_code, dver_card_license_date, dver_card_license_expire_date, action } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (dver_card_license_code == undefined || dver_code == undefined || dver_card_license_type_code == undefined
            || dver_card_license_number == undefined || dver_card_license_date == undefined || dver_card_license_expire_date == undefined || action == undefined) {
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

            script = `update tbl_driver_card_license set
            dver_code = '${dver_code}',
            dver_card_license_number = '${dver_card_license_number}',
            dver_card_license_type_code = '${dver_card_license_type_code}',
            dver_card_license_date = '${dver_card_license_date}',
            dver_card_license_expire_date = '${dver_card_license_expire_date}',
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where dver_card_license_code = '${dver_card_license_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลใบขับขี่ของพนักงาน', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลใบขับขี่ของพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลใบขับขี่ของพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;

    });

}

//Success
exports.addDriverCardLicenseInformation = async (req, res, next) => {

    return (async () => {

        //debugger
        let lic_code = req.header('lic_code');
        let {
            dver_code,
            dver_card_license_number,
            dver_card_license_type_code,
            dver_card_license_date,
            dver_card_license_expire_date,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (dver_code == undefined || dver_card_license_number == undefined
            || dver_card_license_type_code == undefined || dver_card_license_date == undefined
            || dver_card_license_expire_date == undefined || lic_code == undefined || action == undefined) {
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

            script = `select dver_card_license_number from tbl_driver_card_license where dver_card_license_number = '${dver_card_license_number}' and dver_card_license_flag = '1';`
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
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลใบขับขี่ของพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ', action[0].value);
                    return;
                }
            }

            let dver_card_license_code = 'dcrd-' + moment().format('x');
            script = `insert into tbl_driver_card_license 
            (dver_card_license_code, dver_code, dver_card_license_number, dver_card_license_type_code, dver_card_license_date, dver_card_license_expire_date, dver_card_license_flag, ist_dt) values 
            ('${dver_card_license_code}', '${dver_code}', '${dver_card_license_number}', '${dver_card_license_type_code}', '${dver_card_license_date}', '${dver_card_license_expire_date}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}');`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [{
                        dver_card_license_code: dver_card_license_code
                    }],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลใบขับขี่ของพนักงาน', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลใบขับขี่ของพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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

        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลใบขับขี่ของพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        res.status(200).send(response);
        return;
    });

}
