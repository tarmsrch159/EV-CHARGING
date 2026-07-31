const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js

//Success
exports.getDriverInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        let { dver_code, off_code, action, page_index, page_limit } = req.body[0];
        page_limit = page_limit == undefined ? 10 : page_limit;
        page_index = page_index == undefined ? 1 : page_index;

        if (page_index > 0) {
            page_index -= 1;
        }
        //เช็คเฉพาะส่วนที่สำคัญ
        if (dver_code == undefined || off_code == undefined || lic_code == undefined || action == undefined) {
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
            if (dver_code.toString().toUpperCase() != 'ALL') {
                script = `select  dver_code, dver_username, dver_userpassword, dver_ref_code, dver_name, dver_surname, dver_mobile_number,
                dver_email, dver_div_code, div_desc as dver_div_desc, dver_dep_code, dep_desc as dver_dep_desc, dver_pos_code, pos_desc as dver_pos_desc, 
                tbl_driver.dver_group_code, dver_group_desc as dver_group_desc, dver_gender, tbl_driver_role.dver_role_code, dver_role_desc,
                dver_flag, dver_image_profile, tbl_driver.ist_dt, tbl_driver.mdf_dt, tbl_driver.rm_dt, dver_personal_number, application_mobile_version, 
                tbl_driver.off_code, tbl_office.off_desc

                from tbl_driver 
                left join tbl_division on tbl_driver.dver_div_code = tbl_division.div_code
                left join tbl_department on tbl_driver.dver_div_code = tbl_department.div_code
                and tbl_driver.dver_dep_code = tbl_department.dep_code
                left join tbl_position on tbl_driver.dver_div_code = tbl_position.div_code
                and tbl_driver.dver_dep_code = tbl_position.dep_code
                and tbl_driver.dver_pos_code = tbl_position.pos_code
                left join tbl_driver_group on tbl_driver.dver_group_code = tbl_driver_group.dver_group_code
                left join tbl_driver_role on tbl_driver.dver_role_code = tbl_driver_role.dver_role_code 
                left join tbl_office on tbl_driver.off_code = tbl_office.off_code 
                where dver_flag = '1' and dver_code = '${dver_code}'`;
            }
            else {
                script = `select  dver_code, dver_username, dver_userpassword, dver_ref_code, dver_name, dver_surname, dver_mobile_number,
                dver_email, dver_div_code, div_desc as dver_div_desc, dver_dep_code, dep_desc as dver_dep_desc, dver_pos_code, pos_desc as dver_pos_desc, 
                tbl_driver.dver_group_code, dver_group_desc as dver_group_desc, dver_gender, tbl_driver_role.dver_role_code, dver_role_desc,
                dver_flag, dver_image_profile, tbl_driver.ist_dt, tbl_driver.mdf_dt, tbl_driver.rm_dt, dver_personal_number, application_mobile_version, 
                tbl_driver.off_code, tbl_office.off_desc

                from tbl_driver 
                left join tbl_division on tbl_driver.dver_div_code = tbl_division.div_code
                left join tbl_department on tbl_driver.dver_div_code = tbl_department.div_code
                and tbl_driver.dver_dep_code = tbl_department.dep_code
                left join tbl_position on tbl_driver.dver_div_code = tbl_position.div_code
                and tbl_driver.dver_dep_code = tbl_position.dep_code
                and tbl_driver.dver_pos_code = tbl_position.pos_code
                left join tbl_driver_group on tbl_driver.dver_group_code = tbl_driver_group.dver_group_code
                left join tbl_driver_role on tbl_driver.dver_role_code = tbl_driver_role.dver_role_code 
                left join tbl_office on tbl_driver.off_code = tbl_office.off_code 
                where dver_flag = '1'`;
            }

            if (off_code.toString().toUpperCase() != 'ALL') {
                script += `tbl_driver.off_code = '${off_code}' `
            }

            script += ` order by tbl_driver.ist_dt desc`
            script += ` limit ${page_limit} offset ${page_index * page_limit}`;

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));
                    let page_total = 0;
                    let rows_total = 0;

                    if (dver_code.toString().toUpperCase() != 'ALL') {
                        script = `select  
                        count(*) as rows_total,
                        ceil(count(dver_code) / ${page_limit}) as page_total
                        from tbl_driver 
                        left join tbl_division on tbl_driver.dver_div_code = tbl_division.div_code
                        left join tbl_department on tbl_driver.dver_div_code = tbl_department.div_code
                        and tbl_driver.dver_dep_code = tbl_department.dep_code
                        left join tbl_position on tbl_driver.dver_div_code = tbl_position.div_code
                        and tbl_driver.dver_dep_code = tbl_position.dep_code
                        and tbl_driver.dver_pos_code = tbl_position.pos_code
                        left join tbl_driver_group on tbl_driver.dver_group_code = tbl_driver_group.dver_group_code
                        left join tbl_driver_role on tbl_driver.dver_role_code = tbl_driver_role.dver_role_code 
                        left join tbl_office on tbl_driver.off_code = tbl_office.off_code 
                        where dver_flag = '1' and dver_code = '${dver_code}'`;
                    }
                    else {
                        script = `select 
                        count(*) as rows_total,
                        ceil(count(dver_code) / ${page_limit}) as page_total
                        from tbl_driver 
                        left join tbl_division on tbl_driver.dver_div_code = tbl_division.div_code
                        left join tbl_department on tbl_driver.dver_div_code = tbl_department.div_code
                        and tbl_driver.dver_dep_code = tbl_department.dep_code
                        left join tbl_position on tbl_driver.dver_div_code = tbl_position.div_code
                        and tbl_driver.dver_dep_code = tbl_position.dep_code
                        and tbl_driver.dver_pos_code = tbl_position.pos_code
                        left join tbl_driver_group on tbl_driver.dver_group_code = tbl_driver_group.dver_group_code
                        left join tbl_driver_role on tbl_driver.dver_role_code = tbl_driver_role.dver_role_code 
                        left join tbl_office on tbl_driver.off_code = tbl_office.off_code 
                        where dver_flag = '1'`;
                    }

                    if (off_code.toString().toUpperCase() != 'ALL') {
                        script += `tbl_driver.off_code = '${off_code}' `
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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลพนักงานขับรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลพนักงานขับรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return
    });

}

//Success
exports.removeDriver = async (req, res, next) => {

    return (async () => {

        let lic_code = req.header('lic_code');
        let { driver_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (driver_code == undefined || lic_code == undefined || action == undefined) {
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
            script = `update tbl_driver set driver_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' where driver_code = '${driver_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลพนักงานขับรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลพนักงานขับรถ', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลพนักงานขับรถ', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.setDriverInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let { dver_code } = req.query;
        let {
            dver_username,
            dver_userpassword,
            dver_ref_code,
            dver_name,
            dver_surname,
            dver_mobile_number,
            dver_email,
            dver_div_code,
            dver_dep_code,
            dver_pos_code,
            dver_group_code,
            dver_gender,
            dver_role_code,
            dver_image_profile,
            application_mobile_version,
            dver_personal_number,
            off_code,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (off_code == undefined || dver_code == undefined || dver_username == undefined || dver_userpassword == undefined
            || dver_ref_code == undefined || dver_name == undefined || dver_surname == undefined || dver_mobile_number == undefined
            || dver_email == undefined || dver_div_code == undefined || dver_dep_code == undefined || dver_pos_code == undefined
            || dver_group_code == undefined || dver_gender == undefined || dver_role_code == undefined || dver_image_profile == undefined
            || application_mobile_version == undefined || dver_personal_number == undefined || action == undefined) {
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
            script = `update tbl_driver set
            dver_username = '${dver_username}',
            dver_userpassword = '${dver_userpassword}',
            dver_ref_code = '${dver_ref_code}',
            dver_name = '${dver_name}',
            dver_surname = '${dver_surname}',
            dver_mobile_number = '${dver_mobile_number}',
            dver_email = '${dver_email}',
            dver_div_code = '${dver_div_code}',
            dver_dep_code = '${dver_dep_code}',
            dver_pos_code = '${dver_pos_code}',
            dver_group_code = '${dver_group_code}',
            dver_gender = '${dver_gender}',
            dver_role_code = '${dver_role_code}',
            dver_image_profile = '${dver_image_profile}',
            dver_personal_number = '${dver_personal_number}',
            application_mobile_version = '${application_mobile_version}',
            off_code = '${off_code}',
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where dver_code = '${dver_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลพนักงานขับรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลพนักงานขับรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลพนักงานขับรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.addDriverInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            dver_username,
            dver_userpassword,
            dver_ref_code,
            dver_name,
            dver_surname,
            dver_mobile_number,
            dver_email,
            dver_div_code,
            dver_dep_code,
            dver_pos_code,
            dver_group_code,
            dver_gender,
            dver_role_code,
            dver_image_profile,
            application_mobile_version,
            dver_personal_number,
            off_code,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (dver_username == undefined || off_code == undefined || dver_userpassword == undefined
            || dver_ref_code == undefined || dver_name == undefined || dver_surname == undefined || dver_mobile_number == undefined
            || dver_email == undefined || dver_div_code == undefined || dver_dep_code == undefined || dver_pos_code == undefined
            || dver_group_code == undefined || dver_gender == undefined || dver_role_code == undefined || dver_image_profile == undefined
            || application_mobile_version == undefined || dver_personal_number == undefined || action == undefined) {
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
            if (dver_username == '' || dver_userpassword == '') {
                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                return;
            }

            script = `select dver_code from tbl_driver where dver_username = '${dver_username}' and dver_flag = '1';`
            let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary0.code) {
                if (tbl_temporary0.data.length > 0) {
                    let response = [{
                        status: 'error',
                        invalid_code: '-4',
                        message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลผู้ใช้งานซ้ำ`,
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลพนักงานขับรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล เนื่องจากข้อมูลผู้ใช้งานซ้ำ', action[0].value);
                    return;
                }
            }

            let dver_code = 'dver-' + moment().format('x');
            script = `insert into tbl_driver 
            (dver_code,dver_username,dver_userpassword,dver_ref_code,dver_name,dver_surname,dver_mobile_number,dver_email,dver_div_code,dver_dep_code,
            dver_pos_code,dver_group_code,dver_gender,dver_role_code,dver_image_profile,application_mobile_version,dver_personal_number,dver_flag,ist_dt,off_code) values 
            ('${dver_code}', '${dver_username}', '${dver_userpassword}', '${dver_ref_code}', '${dver_name}', '${dver_surname}', '${dver_mobile_number}',
            '${dver_email}', '${dver_div_code}', '${dver_dep_code}', '${dver_pos_code}', '${dver_group_code}',
            '${dver_gender}', '${dver_role_code}', '${dver_image_profile}', '${application_mobile_version}', '${dver_personal_number}', '1',
            '${moment().format('YYYY-MM-DD HH:mm:ss')}', '${off_code}');`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [{
                        dver_code: dver_code
                    }],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลพนักงานขับรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลพนักงานขับรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลพนักงานขับรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}
