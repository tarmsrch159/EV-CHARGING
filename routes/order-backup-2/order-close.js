const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js

exports.getVehicleOrderForCloseInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { ord_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ord_code == undefined || lic_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let script = ``;
            script = `select tbl_order.veh_code, veh_number, veh_license_number, veh_license_province, tbl_vehicle.veh_type_code, tbl_vehicle_type.veh_type_code, veh_status, 
            tbl_vehicle.veh_group_code, tbl_vehicle_group.veh_group_desc,
            veh_blackbox_number, veh_brand, veh_model, veh_tank_material, veh_loading_system, veh_maximum_compartment, veh_capacity_in_compartment, 
            veh_tare_weight, veh_gross_weight, veh_tank_width, veh_tank_length, veh_tank_height, veh_tank_capacity, veh_maximum_capacity, 
            veh_discharge_sequence, veh_option_pump, veh_option_doeb, veh_option_m12, veh_option_ivms, veh_option_afdd, veh_registration_starting_date, 
            veh_registration_expire_date, veh_registration_remark, veh_support_product, veh_sticker, veh_braking_system,  veh_service_life, 
            veh_flag, veh_image, veh_support_climb_mountain, veh_maximum_distance, veh_minimum_distance, veh_maximum_jobs, veh_remark, 
            veh_sub_license_number, veh_sub_license_province, veh_sub_brand, veh_sub_model, veh_sub_registration_starting_date, 
            veh_sub_registration_expire_date, veh_sub_registration_remark, veh_sub_service_life, veh_sub_braking_system, veh_sub_image, 
            tbl_vehicle.off_code, tbl_vehicle.ist_dt, tbl_vehicle.mdf_dt, tbl_vehicle.rm_dt 

            from tbl_order
            left join tbl_vehicle on tbl_order.veh_code = tbl_vehicle.veh_code
            left join tbl_vehicle_type on tbl_vehicle.veh_type_code = tbl_vehicle_type.veh_type_code
            left join tbl_vehicle_group on tbl_vehicle.veh_group_code = tbl_vehicle_group.veh_group_code 
            where tbl_order.ord_code = '${ord_code}' and tbl_vehicle.veh_flag = '1' `;

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: tbl_temporary.data,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                return;
            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลรถและหางลากตาม Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลรถและหางลากตาม Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

exports.getDriverOrderForCloseInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { ord_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ord_code == undefined || lic_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let script = ``;
            script = `select  tbl_order.dver_code, dver_username, dver_userpassword, dver_ref_code, dver_name, dver_surname, dver_mobile_number,
            dver_email, dver_div_code, div_desc as dver_div_desc, dver_dep_code, dep_desc as dver_dep_desc, dver_pos_code, pos_desc as dver_pos_desc, 
            tbl_driver.dver_group_code, dver_group_desc as dver_group_desc, dver_gender, tbl_driver_role.dver_role_code, dver_role_desc,
            dver_flag, dver_image_profile, tbl_driver.ist_dt, tbl_driver.mdf_dt, tbl_driver.rm_dt, dver_personal_number, application_mobile_version, 
            tbl_driver.off_code, tbl_office.off_desc

            from tbl_order 
            left join tbl_driver on tbl_order.dver_code = tbl_driver.dver_code
            left join tbl_division on tbl_driver.dver_div_code = tbl_division.div_code
            left join tbl_department on tbl_driver.dver_div_code = tbl_department.div_code
            and tbl_driver.dver_dep_code = tbl_department.dep_code
            left join tbl_position on tbl_driver.dver_div_code = tbl_position.div_code
            and tbl_driver.dver_dep_code = tbl_position.dep_code
            and tbl_driver.dver_pos_code = tbl_position.pos_code
            left join tbl_driver_group on tbl_driver.dver_group_code = tbl_driver_group.dver_group_code
            left join tbl_driver_role on tbl_driver.dver_role_code = tbl_driver_role.dver_role_code 
            left join tbl_office on tbl_driver.off_code = tbl_office.off_code 
            where tbl_order.ord_code = '${ord_code}' and tbl_driver.dver_flag = '1' `;

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: tbl_temporary.data,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                return;
            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลพนักงานขับรถตาม Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลพนักงานขับรถตาม Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}
