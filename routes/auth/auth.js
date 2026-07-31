const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../middleware/global');

const dbPrefix = config.dbPrefix();

<<<<<<< HEAD
// API เข้าสู่ระบบผู้ใช้งาน (User Authentication)
exports.authUserInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const {
            user_name,
            user_password,
            action
        } = req.body[0] || {};
=======
//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
exports.authEmployeeInformation = async (req, res, next) => {
    // console.log(dbPrefix);
    var xresult = [];
>>>>>>> parent of e952446 (first commit)

    return (async () => {
        let lic_code = req.header('lic_code');
        let { emp_username, emp_userpassword } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (emp_username == undefined || emp_userpassword == undefined || lic_code == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

<<<<<<< HEAD
        if (!lic_code || !username || !password) {
            return sendResponse(
                res,
                'error',
                '-1',
                'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง'
            );
        }

        const encodedPassword = xglobal.Base64.encode(password);

        const script = `
            SELECT 
                u.user_code,
                u.user_name,
                u.emp_code,
                u.name,
                u.lastname,
                u.photo,
                u.email,
                u.mobile,
                u.gender,
                u.id_card,
                u.default_lang,
                u.user_authority,
                a.authority_code,
                a.authority_name
            FROM tbl_users u
            LEFT JOIN tbl_authority a ON u.user_authority = a.authority_code AND a.rm_dt IS NULL AND a.authority_flag = 1
            WHERE u.user_name = $1 
              AND u.user_password = $2 
              AND u.user_flag = 1 
              AND u.rm_dt IS NULL
            LIMIT 1;
        `;

        const result = await pgConn.getWithParams(
            dbPrefix + lic_code,
            script,
            [username, encodedPassword],
            config.connectionString()
        );

        if (result.code) {
            if (action && action[0]) {
                await xglobal.action_logs(
                    lic_code,
                    username,
                    'เข้าสู่ระบบ',
                    JSON.stringify(req.body[0]),
                    result.message,
                    action[0].value || 'SYSTEM'
                );
=======
            res.status(200).send(response);
            return
        } else {

            let script = ``;
            if (emp_userpassword != '' && emp_userpassword != '') {
                let emp_encode = xglobal.Base64.encode(emp_userpassword);
                script = `select  emp_code, emp_username, emp_ref_code, emp_name, emp_surname, emp_mobile_number,
                    emp_email, emp_div_code, div_desc as emp_div_desc, emp_dep_code, dep_desc as emp_dep_desc, emp_pos_code, pos_desc as emp_pos_desc, 
                    tbl_employee.emp_group_code, emp_group_desc as emp_group_desc, emp_gender, tbl_employee.emp_role_code, emp_role_desc, emp_image_profile, tbl_employee.off_code, tbl_office.off_desc,tbl_petrol.ptrl_code, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_number, tbl_petrol.ptrl_sitecode
        
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
                    where emp_flag = '1' and emp_username = '${emp_username}' and emp_userpassword = '${emp_encode}'`;
                script += ` order by emp_name asc;`
>>>>>>> parent of e952446 (first commit)
            }
            else {
                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                return;
            }

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: tbl_temporary.data,
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, tbl_temporary.data[0].emp_code, 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'success', tbl_temporary.data[0].off_code);
                    return;
                } else {
                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: xresult,
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    return;
                }
            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
                return;
            }
        }
    })().catch(async (err) => {
        console.log('AOS => ' + err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: xresult,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }]
        res.status(200).send(response);
        await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
        return;
    });
}

exports.resetEmployeeInformation = async (req, res, next) => {
    var xresult = [];
    return (async () => {

        debugger
        let lic_code = req.header('lic_code');
        let { emp_username, emp_email, emp_userpassword } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (emp_username == undefined || emp_email == undefined || emp_userpassword == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถคืนค่ารหัสผ่านได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let script = ``;
            if (emp_username != '' && emp_email != '' && emp_userpassword != '') {
                let emp_encode = xglobal.Base64.encode(emp_userpassword);

                script = `select  emp_code, emp_username, emp_userpassword, emp_ref_code, emp_name, emp_surname, emp_mobile_number,
                emp_email, emp_div_code, div_desc as emp_div_desc, emp_dep_code, dep_desc as emp_dep_desc, emp_pos_code, pos_desc as emp_pos_desc, 
                tbl_employee.emp_group_code, emp_group_desc as emp_group_desc, emp_gender, tbl_employee.emp_role_code, emp_role_desc,
                emp_flag, emp_image_profile, tbl_employee.ist_dt, tbl_employee.mdf_dt, tbl_employee.rm_dt, tbl_employee.off_code, tbl_office.off_desc
    
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
                where emp_flag = '1' and emp_username = '${emp_username}' and emp_email = '${emp_email}'`;

                script += ` order by emp_name asc;`

                let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
                if (!tbl_temporary.code) {
                    //debugger
                    if (tbl_temporary.data.length > 0) {
                        tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                        let emp_encode = xglobal.Base64.encode(emp_userpassword);
                        script = `update tbl_employee set 
                        emp_userpassword = '${emp_encode}',
                        mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
                        where emp_code = '${tbl_temporary.data[0].emp_code}';`

                        let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                        if (!tbl_temporary0.code) {
                            //debugger
                            let response = [{
                                status: 'success',
                                invalid_code: '0',
                                message: '',
                                data: [],
                                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                            }]

                            res.status(200).send(response);
                            await xglobal.action_logs(lic_code, tbl_temporary.data[0].emp_code, 'แก้ไขรหัสผ่านพนักงาน', JSON.stringify(req.body[0]), 'success', tbl_temporary.data[0].off_code);
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

                    } else {
                        let response = [{
                            status: 'error',
                            invalid_code: '-3',
                            message: `ไม่สามารถเข้าสู่ระบบ, ข้อมูลไม่ถูกต้อง`,
                            data: xresult,
                            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                        }]
                        res.status(200).send(response);
                        await xglobal.action_logs(lic_code, '', 'แก้ไขรหัสผ่านพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, ข้อมูลไม่ถูกต้อง', '');
                        return;
                    }
                } else {
                    let response = [{
                        status: 'error',
                        invalid_code: '-3',
                        message: `ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                        data: xresult,
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]
                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, '', 'แก้ไขรหัสผ่านพนักงาน', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
                    return;
                }
            }
            else {
                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                return;
            }

        }

    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }]
        res.status(200).send(response);
    });

}
