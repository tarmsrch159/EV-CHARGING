const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
exports.getEmployeeInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { emp_code, off_code, ptrl_code, page_index, page_limit, action } = req.body[0];
        ptrl_code = ptrl_code == undefined ? 'ALL' : ptrl_code;
        page_index = page_index == undefined ? 0 : page_index;
        page_limit = page_limit == undefined ? 10 : page_limit;
        if (page_index > 0) {
            page_index -= 1;
        }

        //เช็คเฉพาะส่วนที่สำคัญ
        if (off_code == undefined || emp_code == undefined || lic_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            return res.status(200).send(response);
        } else {

            let script = ``;

            // =========================================================
            // Subquery ใหม่: จัดกลุ่มซ้อนกลุ่ม (Group -> Stations)
            // =========================================================
            let subquery_petrol_groups = `
                (
                    SELECT COALESCE(
                        json_agg(
                            json_build_object(
                                'group_code', grouped.ptrl_group_code,
                                'group_desc', grouped.ptrl_group_desc,
                                'stations', grouped.stations
                            )
                        ), '[]'
                    )
                    FROM (
                        SELECT 
                            epg.ptrl_group_code,
                            pg.ptrl_group_desc,
                            json_agg(
                                json_build_object(
                                    'ptrl_code', p.ptrl_code,
                                    'ptrl_number', p.ptrl_number, 
                                    'ptrl_desc', p.ptrl_desc
                                )
                            ) as stations
                        FROM tbl_employee_petrol_group epg
                        INNER JOIN tbl_petrol p ON epg.ptrl_group_code = p.ptrl_group_code
                        LEFT JOIN tbl_petrol_group pg ON epg.ptrl_group_code = pg.ptrl_group_code
                        WHERE epg.emp_code = tbl_employee.emp_code 
                          AND epg.emp_pgrp_flag = 1 
                          AND p.ptrl_flag = '1'
                        GROUP BY epg.ptrl_group_code, pg.ptrl_group_desc
                    ) grouped
                ) AS petrol_groups
            `;

            if (emp_code.toString().toUpperCase() != 'ALL') {
                script = `select  
                emp_code, 
                emp_username, 
                emp_userpassword, 
                emp_ref_code, 
                emp_name, 
                emp_surname, 
                emp_mobile_number,
                emp_email, 
                emp_div_code, 
                div_desc as emp_div_desc, 
                emp_dep_code, 
                dep_desc as emp_dep_desc, 
                emp_pos_code, 
                pos_desc as emp_pos_desc, 
                tbl_employee.emp_group_code, 
                emp_group_desc as emp_group_desc, 
                emp_gender, 
                tbl_employee.emp_role_code, 
                emp_role_desc,
                emp_flag, 
                emp_image_profile, 
                tbl_employee.ist_dt, 
                tbl_employee.mdf_dt, 
                tbl_employee.rm_dt, 
                tbl_employee.off_code, 
                tbl_office.off_desc, 
                
                tbl_employee.ptrl_code, 
                tbl_petrol.ptrl_desc,

                -- แทรกข้อมูลกลุ่มปั๊มที่จัดรูปแบบแล้ว
                ${subquery_petrol_groups}

                from tbl_employee 
                left join tbl_division on tbl_employee.emp_div_code = tbl_division.div_code
                left join tbl_department on tbl_employee.emp_div_code = tbl_department.div_code
                and tbl_employee.emp_dep_code = tbl_department.dep_code
                left join tbl_position on tbl_employee.emp_div_code = tbl_position.div_code
                and tbl_employee.emp_dep_code = tbl_position.dep_code
                and tbl_employee.emp_pos_code = tbl_position.pos_code
                left join tbl_employee_group on tbl_employee.emp_group_code = tbl_employee_group.emp_group_code
                left join tbl_employee_role on tbl_employee.emp_role_code = tbl_employee_role.emp_role_code
                left join tbl_office on tbl_employee.off_code = tbl_office.off_code
                left join tbl_petrol on tbl_employee.ptrl_code = tbl_petrol.ptrl_code 
                where emp_flag = '1' and emp_code = '${emp_code}'`;
            }
            else {
                script = `select  
                emp_code, 
                emp_username, 
                emp_userpassword, 
                emp_ref_code, 
                emp_name, 
                emp_surname, 
                emp_mobile_number,
                emp_email, 
                emp_div_code, 
                div_desc as emp_div_desc, 
                emp_dep_code, 
                dep_desc as emp_dep_desc, 
                emp_pos_code, 
                pos_desc as emp_pos_desc, 
                tbl_employee.emp_group_code, 
                emp_group_desc as emp_group_desc, 
                emp_gender, 
                tbl_employee.emp_role_code, 
                emp_role_desc,
                emp_flag, 
                emp_image_profile, 
                tbl_employee.ist_dt, 
                tbl_employee.mdf_dt, 
                tbl_employee.rm_dt, 
                tbl_employee.off_code, 
                tbl_office.off_desc, 

                tbl_employee.ptrl_code, 
                tbl_petrol.ptrl_desc,

                -- แทรกข้อมูลกลุ่มปั๊มที่จัดรูปแบบแล้ว
                ${subquery_petrol_groups}

                from tbl_employee 
                left join tbl_division on tbl_employee.emp_div_code = tbl_division.div_code
                left join tbl_department on tbl_employee.emp_div_code = tbl_department.div_code
                and tbl_employee.emp_dep_code = tbl_department.dep_code
                left join tbl_position on tbl_employee.emp_div_code = tbl_position.div_code
                and tbl_employee.emp_dep_code = tbl_position.dep_code
                and tbl_employee.emp_pos_code = tbl_position.pos_code
                left join tbl_petrol on tbl_employee.ptrl_code = tbl_petrol.ptrl_code 
                left join tbl_employee_group on tbl_employee.emp_group_code = tbl_employee_group.emp_group_code
                left join tbl_employee_role on tbl_employee.emp_role_code = tbl_employee_role.emp_role_code
                left join tbl_office on tbl_employee.off_code = tbl_office.off_code 
                where emp_flag = '1' `;
            }

            if (off_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_employee.off_code = '${off_code}'`
            }

            if (ptrl_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_employee.ptrl_code = '${ptrl_code}'`
            }

            script += ` order by tbl_employee.ist_dt desc`
            script += ` offset (${page_index}*${page_limit}) limit ${page_limit};`

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

            if (!tbl_temporary.code) {
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                    let page_total = 0;
                    let rows_total = 0;
                    let scriptCount = ``;

                    if (emp_code.toString().toUpperCase() != 'ALL') {
                        scriptCount = `select ceil((ceil(count(emp_code)) / ${page_limit})) as page_total, (count(emp_code)) as rows_total 
                        from tbl_employee 
                        where emp_flag = '1' and emp_code = '${emp_code}'`;
                    } else {
                        scriptCount = `select ceil((ceil(count(emp_code)) / ${page_limit})) as page_total, (count(emp_code)) as rows_total 
                        from tbl_employee 
                        where emp_flag = '1' `;
                    }

                    if (off_code.toString().toUpperCase() != 'ALL') {
                        scriptCount += ` and off_code = '${off_code}'`
                    }
                    if (ptrl_code.toString().toUpperCase() != 'ALL') {
                        scriptCount += ` and ptrl_code = '${ptrl_code}'`
                    }

                    let tbl_temporary_count = await pgConn.get(dbPrefix + lic_code, scriptCount, config.connectionString());

                    if (!tbl_temporary_count.code) {
                        if (tbl_temporary_count.data.length > 0) {
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

                    return res.status(200).send(response);

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

                    return res.status(200).send(response);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                return;
            }
        }
    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `เกิดข้อผิดพลาดภายในระบบ`,
            data: xresult,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }]
        res.status(200).send(response);
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'System Error: ' + err.message, action[0].value);
        return;
    });
}

exports.removeEmployee = async (req, res, next) => {

    return (async () => {

        let lic_code = req.header('lic_code');
        let { emp_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (emp_code == undefined || lic_code == undefined || action == undefined) {
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
            script = `update tbl_employee set emp_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' where emp_code = '${emp_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.setEmployeeInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let { emp_code } = req.query;
        let {
            emp_ref_code,
            emp_name,
            emp_surname,
            emp_mobile_number,
            emp_email,
            emp_div_code,
            emp_dep_code,
            emp_pos_code,
            emp_group_code,
            emp_gender,
            emp_role_code,
            emp_image_profile,
            off_code,
            ptrl_code,
            ptrl_group_code,
            action
        } = req.body[0];


        //เช็คเฉพาะส่วนที่สำคัญ
        if (emp_code == undefined || off_code == undefined
            || emp_ref_code == undefined || emp_name == undefined || emp_surname == undefined || emp_mobile_number == undefined
            || emp_email == undefined || emp_gender == undefined || emp_role_code == undefined
            || emp_image_profile == undefined || action == undefined || ptrl_code == undefined) {
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
            emp_div_code = emp_div_code == undefined ? '' : emp_div_code;
            emp_dep_code = emp_dep_code == undefined ? '' : emp_dep_code;
            emp_pos_code = emp_pos_code == undefined ? '' : emp_pos_code;
            emp_group_code = emp_group_code == undefined ? '' : emp_group_code;
            ptrl_code = ptrl_code == undefined ? '' : ptrl_code;
            ptrl_group_code = ptrl_group_code == undefined ? [] : ptrl_group_code;

            // if (off_code.toString().toUpperCase() == 'ALL') {

            //     let response = [{
            //         status: 'error',
            //         invalid_code: '-1',
            //         message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง off_code ไม่รองรับ ALL',
            //         data: [],
            //         response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            //     }]

            //     res.status(200).send(response);
            //     await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง off_code ไม่รองรับ ALL', action[0].value);
            //     return;
            // }

            let now_dt = moment().format('YYYY-MM-DD HH:mm:ss');
            script = `BEGIN;\n`;
            script += `update tbl_employee set 
            emp_ref_code = '${emp_ref_code}',
            emp_name = '${emp_name}',
            emp_surname = '${emp_surname}',
            emp_mobile_number = '${emp_mobile_number}',
            emp_email = '${emp_email}',
            emp_div_code = '${emp_div_code}',
            emp_dep_code = '${emp_dep_code}',
            emp_pos_code = '${emp_pos_code}',
            emp_group_code = '${emp_group_code}',
            emp_gender = '${emp_gender}',
            emp_role_code = '${emp_role_code}',
            emp_image_profile = '${emp_image_profile}',
            off_code = '${off_code}',
            ptrl_code = '${ptrl_code}',
            mdf_dt = '${now_dt}' 
            where emp_code = '${emp_code}';\n`;

            // อัปเดตข้อมูล petrol group (ถ้ามีการส่งมา)
            // ========= ลบอันเก่าแล้ว Insert ใหม่ทั้งหมดตามที่ส่งมาล่าสุด =========
            script += `DELETE FROM tbl_employee_petrol_group WHERE emp_code = '${emp_code}';\n`;
            if (Array.isArray(ptrl_group_code) && ptrl_group_code.length > 0) {
                for (const code of ptrl_group_code) {
                    script += `INSERT INTO tbl_employee_petrol_group (emp_code, ptrl_group_code, emp_pgrp_flag, ist_dt) VALUES ('${emp_code}', '${code}', 1, '${now_dt}');\n`;
                }
            }

            script += `COMMIT;`;

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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'success', action[0].value);
                return;
            } else {
                await pgConn.execute(dbPrefix + lic_code, `ROLLBACK;`, config.connectionString());
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.setEmployeePasswordInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let { emp_code } = req.query;
        let {
            emp_userpassword,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (emp_code == undefined || emp_userpassword == undefined || action == undefined) {
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
            let emp_encode = xglobal.Base64.encode(emp_userpassword);
            script = `update tbl_employee set 
            emp_userpassword = '${emp_encode}',
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where emp_code = '${emp_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขรหัสผ่านพนักงาน', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขรหัสผ่านพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขรหัสผ่านพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.addEmployeeInformation = async (req, res, next) => {
    let lic_code = req.header('lic_code');
    return (async () => {
        debugger

        let {
            emp_username,
            emp_userpassword,
            emp_ref_code,
            emp_name,
            emp_surname,
            emp_mobile_number,
            emp_email,
            emp_div_code,
            emp_dep_code,
            emp_pos_code,
            emp_group_code,
            emp_gender,
            emp_role_code,
            emp_image_profile,
            off_code,
            ptrl_code,
            ptrl_group_code,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (emp_username == undefined || off_code == undefined || emp_userpassword == undefined
            || emp_ref_code == undefined || emp_name == undefined || emp_surname == undefined || emp_mobile_number == undefined
            || emp_email == undefined || emp_gender == undefined || emp_role_code == undefined
            || emp_image_profile == undefined || action == undefined) {
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
            emp_div_code = emp_div_code == undefined ? '' : emp_div_code;
            emp_dep_code = emp_dep_code == undefined ? '' : emp_dep_code;
            emp_pos_code = emp_pos_code == undefined ? '' : emp_pos_code;
            emp_group_code = emp_group_code == undefined ? '' : emp_group_code;
            ptrl_code = ptrl_code == undefined ? '' : ptrl_code;
            ptrl_group_code = ptrl_group_code == undefined ? [] : ptrl_group_code;

            // let query_ptrl = `SELECT ptrl_code, ptrl_number, ptrl_desc FROM tbl_petrol WHERE ptrl_code = '${ptrl_code}'`
            // let tbl_temporary_ptrl = await pgConn.get(dbPrefix + lic_code, query_ptrl, config.connectionString());

            // if (!tbl_temporary_ptrl.code) {
            //     if (tbl_temporary_ptrl.data.length == 0) {
            //         let response = [{
            //             invalid_code: '-1',
            //             message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ptrl_code ไม่ถูกต้อง',
            //             data: [],
            //             response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            //         }]

            //         res.status(200).send(response);
            //         await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ptrl_code ไม่ถูกต้อง', action[0].value);
            //         return;
            //     }
            // }



            // if (off_code.toString().toUpperCase() == 'ALL') {

            //     let response = [{
            //         status: 'error',
            //         invalid_code: '-1',
            //         message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง off_code ไม่รองรับ ALL',
            //         data: [],
            //         response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            //     }]

            //     res.status(200).send(response);
            //     await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง off_code ไม่รองรับ ALL', action[0].value);
            //     return;
            // }

            script = `select emp_code from tbl_employee where emp_username = '${emp_username}' and off_code = '${off_code}' and emp_flag = '1';`
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
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลผู้ใช้งานซ้ำ', action[0].value);
                    return;
                }
            }

            let emp_code = 'empl-' + moment().format('x');
            let emp_encode = xglobal.Base64.encode(emp_userpassword);
            let now_dt = moment().format('YYYY-MM-DD HH:mm:ss');

            // สร้าง script แบบ transaction (BEGIN / COMMIT) เพื่อป้องกันข้อมูลพัง
            script = `BEGIN;\n`;

            // 1) Insert ข้อมูลพนักงาน
            script += `INSERT INTO tbl_employee 
            (emp_code, emp_username, emp_userpassword, emp_ref_code, emp_name, emp_surname, emp_mobile_number,
            emp_email, emp_div_code, emp_dep_code, emp_pos_code, emp_group_code, emp_gender, emp_role_code, emp_image_profile, emp_flag, ist_dt, off_code, ptrl_code) VALUES 
            ('${emp_code}', '${emp_username}', '${emp_encode}', '${emp_ref_code}', '${emp_name}', '${emp_surname}', '${emp_mobile_number}',
            '${emp_email}', '${emp_div_code}', '${emp_dep_code}', '${emp_pos_code}', '${emp_group_code}',
            '${emp_gender}', '${emp_role_code}', '${emp_image_profile}', '1', '${now_dt}', '${off_code}', '${ptrl_code}');\n`;

            // 2) Insert ข้อมูล petrol group ที่ relate กับพนักงาน (รองรับหลายรายการ)
            if (Array.isArray(ptrl_group_code) && ptrl_group_code.length > 0) {
                for (const code of ptrl_group_code) {
                    script += `INSERT INTO tbl_employee_petrol_group (emp_code, ptrl_group_code, emp_pgrp_flag, ist_dt) VALUES ('${emp_code}', '${code}', 1, '${now_dt}');\n`;
                }
            }

            script += `COMMIT;`;

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [{
                        emp_code: emp_code
                    }],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'success', action[0].value);
                return;
            } else {
                // ROLLBACK กรณี execute error (pgConn จะไม่ commit เพราะ error ก่อน COMMIT)
                // ส่ง ROLLBACK เพื่อให้แน่ใจว่า transaction ถูกยกเลิก
                await pgConn.execute(dbPrefix + lic_code, 'ROLLBACK;', config.connectionString());

                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}
