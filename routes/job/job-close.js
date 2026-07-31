const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
exports.getCompartmentJobForCloseInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { job_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (job_code == undefined || lic_code == undefined || action == undefined) {
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
            script = `	select 
            veh_code,veh_license_number,veh_license_province,ord_veh_compartment_code,ord_code,shipments_code,itm_code,itm_desc,itm_material_number,itm_unit_code,itm_unit_desc,item_quantity,
            ord_veh_compartment_flag,veh_compartment_code,veh_compartment_number,ptrl_code,ptrl_desc,ptrl_number,ptrl_tank_code,tnk_number
            
            from 
            (select tbl_vehicle.veh_code, tbl_vehicle.veh_license_number, tbl_vehicle.veh_license_province, ord_veh_compartment_code, 
            tbl_order_compartment.ord_code, tbl_order.shipments_code, 
            tbl_order_compartment.itm_code, tbl_item.itm_desc, tbl_item.itm_material_number,   
            tbl_order_compartment.itm_unit_code, tbl_item_unit.itm_unit_desc, tbl_order_compartment.item_quantity, 
            ord_veh_compartment_flag, tbl_order_compartment.veh_compartment_code, tbl_vehicle_compartment.veh_compartment_number,
            tbl_order_petrol.ptrl_code, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_number, tbl_order_petrol.ptrl_tank_code, tbl_petrol_tank.tnk_number 
            from tbl_job 
            left join tbl_order_compartment on tbl_order_compartment.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}')
            left join tbl_order_petrol on tbl_order_petrol.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') 
            and tbl_order_compartment.itm_code = tbl_order_petrol.itm_code 
            and tbl_order_compartment.ord_code = tbl_order_petrol.ord_code 
            and tbl_order_compartment.ptrl_tank_code = tbl_order_petrol.ptrl_tank_code 
            left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code	
            left join tbl_petrol_tank on tbl_order_petrol.ptrl_code = tbl_petrol_tank.ptrl_code
            and tbl_petrol_tank.ptrl_tank_code = tbl_order_petrol.ptrl_tank_code
            
            left join tbl_vehicle on tbl_job.veh_code = tbl_vehicle.veh_code 
            left join tbl_vehicle_compartment on tbl_vehicle.veh_code = tbl_vehicle_compartment.veh_code
            and tbl_vehicle_compartment.veh_compartment_code = tbl_order_compartment.veh_compartment_code
            left join tbl_item on tbl_order_compartment.itm_code = tbl_item.itm_code
            left join tbl_item_unit on tbl_order_compartment.itm_unit_code = tbl_item_unit.itm_unit_code 
            left join tbl_order on tbl_order_compartment.ord_code = tbl_order.ord_code 
            where tbl_job.job_code = '${job_code}' and tbl_order.ord_type_code != 'otyp-9999999999996') xtbl_master 
            
            where xtbl_master.ptrl_tank_code 
            in (select ptrl_tank_code from tbl_order_petrol where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}'))
            group by veh_code,veh_license_number,veh_license_province,ord_veh_compartment_code,
            ord_code,shipments_code,itm_code,itm_desc,itm_material_number,itm_unit_code,itm_unit_desc,item_quantity,
            ord_veh_compartment_flag,veh_compartment_code,veh_compartment_number,ptrl_code,ptrl_desc,ptrl_number,ptrl_tank_code,tnk_number `;

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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

exports.getVehicleJobForCloseInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { job_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (job_code == undefined || lic_code == undefined || action == undefined) {
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
            script = `select tbl_job.veh_code, veh_number, veh_license_number, veh_license_province, tbl_vehicle.veh_type_code, tbl_vehicle_type.veh_type_code, veh_status, 
            tbl_vehicle.veh_group_code, tbl_vehicle_group.veh_group_desc,
            veh_blackbox_number, veh_brand, veh_model, veh_tank_material, veh_loading_system, veh_maximum_compartment, veh_capacity_in_compartment, 
            veh_tare_weight, veh_gross_weight, veh_tank_width, veh_tank_length, veh_tank_height, veh_tank_capacity, veh_maximum_capacity, 
            veh_discharge_sequence, veh_option_pump, veh_option_doeb, veh_option_m12, veh_option_ivms, veh_option_afdd, veh_registration_starting_date, 
            veh_registration_expire_date, veh_registration_remark, veh_support_product, veh_sticker, veh_braking_system,  veh_service_life, 
            veh_flag, veh_image, veh_support_climb_mountain, veh_maximum_distance, veh_minimum_distance, veh_maximum_jobs, veh_remark, 
            veh_sub_license_number, veh_sub_license_province, veh_sub_brand, veh_sub_model, veh_sub_registration_starting_date, 
            veh_sub_registration_expire_date, veh_sub_registration_remark, veh_sub_service_life, veh_sub_braking_system, veh_sub_image, 
            tbl_vehicle.off_code, tbl_vehicle.ist_dt, tbl_vehicle.mdf_dt, tbl_vehicle.rm_dt 

            from tbl_job
            left join tbl_vehicle on tbl_job.veh_code = tbl_vehicle.veh_code
            left join tbl_vehicle_type on tbl_vehicle.veh_type_code = tbl_vehicle_type.veh_type_code
            left join tbl_vehicle_group on tbl_vehicle.veh_group_code = tbl_vehicle_group.veh_group_code 
            where tbl_job.job_code = '${job_code}' and tbl_vehicle.veh_flag = '1'`;

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

exports.getDriverJobForCloseInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { job_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (job_code == undefined || lic_code == undefined || action == undefined) {
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
            script = `select  tbl_job.dver_code, dver_username, dver_userpassword, dver_ref_code, dver_name, dver_surname, dver_mobile_number,
            dver_email, dver_div_code, div_desc as dver_div_desc, dver_dep_code, dep_desc as dver_dep_desc, dver_pos_code, pos_desc as dver_pos_desc, 
            tbl_driver.dver_group_code, dver_group_desc as dver_group_desc, dver_gender, tbl_driver_role.dver_role_code, dver_role_desc,
            dver_flag, dver_image_profile, tbl_driver.ist_dt, tbl_driver.mdf_dt, tbl_driver.rm_dt, dver_personal_number, application_mobile_version, 
            tbl_driver.off_code, tbl_office.off_desc

            from tbl_job 
            left join tbl_driver on tbl_job.dver_code = tbl_driver.dver_code
            left join tbl_division on tbl_driver.dver_div_code = tbl_division.div_code
            left join tbl_department on tbl_driver.dver_div_code = tbl_department.div_code
            and tbl_driver.dver_dep_code = tbl_department.dep_code
            left join tbl_position on tbl_driver.dver_div_code = tbl_position.div_code
            and tbl_driver.dver_dep_code = tbl_position.dep_code
            and tbl_driver.dver_pos_code = tbl_position.pos_code
            left join tbl_driver_group on tbl_driver.dver_group_code = tbl_driver_group.dver_group_code
            left join tbl_driver_role on tbl_driver.dver_role_code = tbl_driver_role.dver_role_code 
            left join tbl_office on tbl_driver.off_code = tbl_office.off_code 
            where tbl_job.job_code = '${job_code}' and tbl_driver.dver_flag = '1' `;

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

exports.setCompartmentJobForCancleCloseInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            job_code,
            action
        } = req.body[0];

        if (job_code == undefined || action == undefined) {
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
            script = `update tbl_job set
                mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
                job_status = '2' 
                where job_code = '${job_code}';`

            script = script.replace(/'NULL'/gi, "NULL")
            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

            script = `update tbl_order set
                mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
                ord_status = '2' 
                where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}');`

            console.log(script);
            tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

            if (!tbl_temporary.code) {
                debugger
                script = `delete from tbl_order_close where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}');`
                let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

                if (!tbl_temporary0.code) {

                    let script = ``;
                    script = `update tbl_order set
                    mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
                    ord_status = '2' 
                    where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}');`

                    script = script.replace(/'NULL'/gi, "NULL")
                    let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'ยกเลิกปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'success', action[0].value);
                    return;
                }
                else {
                    let response = [{
                        status: 'error',
                        invalid_code: '-3',
                        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]
                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'ยกเลิกปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                    return;
                }

            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ยกเลิกปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ยกเลิกปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

exports.getXmlBeforeCompartmentJobForCloseInformation = async (req, res, next) => {

    return (async () => {
        //debugger
        let lic_code = req.header('lic_code');
        let {
            job_code,
            item,
            action
        } = req.body[0];

        if (job_code == undefined || action == undefined || item == undefined) {
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

            if (item.length <= 0) {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง item ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบก่อนปิดงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง item ไม่รองรับค่าว่าง', action[0].value);
                return;
            }


            script = `select job_code from tbl_job where job_code = '${job_code}' and job_status = '4';`
            let tbl_temporary0001 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

            if (tbl_temporary0001.code) {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: '',
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบก่อนปิดงาน, มีการเปิดงานซ้ำซ้อน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                return;
            }
            else {
                if (tbl_temporary0001.data.length > 0) {
                    let response = [{
                        status: 'error',
                        invalid_code: '-99',
                        message: `ไม่สามารถบันทึกข้อมูล, เนื่องจาก Jobs นี้มีการปิดงานไปแล้ว`,
                        data: '',
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]
                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบก่อนปิดงาน, มีการเปิดงานซ้ำซ้อน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                    return;
                }
            }

            //clear 
            script = `delete from tbl_order_close where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}');`
            let tbl_temporary00 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

            //update
            script = `update tbl_job set
                mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
                job_status = '4' 
                where job_code = '${job_code}';`

            script = script.replace(/'NULL'/gi, "NULL")
            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                for (var itm = 0; itm <= item.length - 1; itm++) {

                    let ord_close_code = 'ocle-' + moment().format('x');
                    script = `insert into tbl_order_close (ord_close_code, ord_code, itm_code, itm_unit_code, item_quantity, 
                    ord_close_flag, ist_dt, mdf_dt, rm_dt, veh_compartment_code, ptrl_code, ptrl_tank_code, delivery_flag) 
                    values ('${ord_close_code}', '${item[itm].ord_code}', '${item[itm].itm_code}', '${item[itm].itm_unit_code}', ${item[itm].item_quantity}, '1', 
                    '${moment().format('YYYY-MM-DD HH:mm:ss')}', NULL, NULL, '${item[itm].veh_compartment_code}', '${item[itm].ptrl_code}', 
                    '${item[itm].ptrl_tank_code}', '${item[itm].delivery_flag}');`

                    let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                    if (item[itm].delivery_flag == '3') {
                        //add order
                        let ord_code = 'odr-' + moment().format('x');
                        var itm_code = item[itm].itm_code;
                        var itm_unit_code = item[itm].itm_unit_code;
                        var item_quantity = parseFloat(item[itm].item_quantity);
                        var veh_compartment_code = item[itm].veh_compartment_code;
                        var veh_code = '';
                        var veh_number = '';
                        var script00 = `select tbl_order_depot.dpo_code, loading_start_dt, loading_end_dt, tbl_depot.off_code from tbl_order_depot 
                        left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code and tbl_depot.dpo_flag = '1'
                        where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') and itm_code = '${itm_code}' limit 1;`

                        let tbl_temporary00 = await pgConn.get(dbPrefix + lic_code, script00, config.connectionString());
                        if (!tbl_temporary00.code) {

                            var dpo_code = '';
                            var loading_start_dt = '';
                            var loading_end_dt = '';
                            var off_code = ''
                            if (tbl_temporary00.data.length > 0) {
                                dpo_code = tbl_temporary00.data[0].dpo_code;
                                off_code = tbl_temporary00.data[0].off_code;
                                loading_start_dt = moment(tbl_temporary00.data[0].loading_start_dt).format('YYYY-MM-DD HH:mm:ss')
                                loading_end_dt = moment(tbl_temporary00.data[0].loading_end_dt).format('YYYY-MM-DD HH:mm:ss')
                            }

                            //get veh_code 
                            script00 = `select tbl_vehicle.veh_code, tbl_vehicle.veh_number from
                            tbl_vehicle_compartment 
                            left join tbl_vehicle on tbl_vehicle.veh_code = tbl_vehicle_compartment.veh_code
                            where veh_compartment_code = '${veh_compartment_code}' limit 1;`
                            tbl_temporary00 = await pgConn.get(dbPrefix + lic_code, script00, config.connectionString());

                            if (!tbl_temporary00.code) {
                                if (tbl_temporary00.data.length > 0) {
                                    veh_code = tbl_temporary00.data[0].veh_code;
                                    veh_number = tbl_temporary00.data[0].veh_number;
                                }
                                else {
                                    dpo_code = '';
                                }
                            }
                            else {
                                dpo_code = '';
                            }

                            if (dpo_code != '') {
                                var ord_depot_code = 'odpo-' + moment().format('x');
                                let script0 = `INSERT INTO public.tbl_order_depot 
                                (ord_depot_code, ord_code, dpo_code, itm_code, itm_unit_code, item_quantity, ord_depot_flag, ist_dt, loading_start_dt, loading_end_dt) 
                                values ('${ord_depot_code}', '${ord_code}', '${dpo_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity}, 
                                '1', '${moment(loading_start_dt).format('YYYY-MM-DD HH:mm:ss')}', '${moment(loading_end_dt).format('YYYY-MM-DD HH:mm:ss')}',
                                '${moment().format('YYYY-MM-DD HH:mm:ss')}')`

                                let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script0, config.connectionString());
                                if (!tbl_temporary0.code) {
                                    //add item
                                    var ord_item_code = 'oitm-' + moment().format('x');
                                    let script1 = `INSERT INTO public.tbl_order_item 
                                    (ord_item_code, ord_code, itm_code, itm_unit_code, item_quantity, ord_item_flag, ist_dt) 
                                    values ('${ord_item_code}', '${ord_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity}, 
                                    '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}')`

                                    let tbl_temporary1 = await pgConn.execute(dbPrefix + lic_code, script1, config.connectionString());
                                    if (!tbl_temporary1.code) {
                                        var transport_code = '';
                                        var tour_code = '';
                                        var pull_code = '';
                                        var number = '';
                                        var document_reference = '';
                                        var plant = '';
                                        var assigned_carrier_id = '624745';
                                        var assigned_carrier_name = 'PONGRAWE Co.,Ltd';
                                        var assigned_creditor_number = '68057026';
                                        var assigned_carrier_number = '';
                                        var ord_dt = moment().format('YYYY-MM-DD HH:mm:ss');
                                        var req_dt = moment().add('day', 2).format('YYYY-MM-DD HH:mm:ss');
                                        var ord_comment = 'Order In Track:' + veh_number;
                                        var ord_customer_code = '';
                                        var ord_customer_name = '';
                                        var ord_customer_number = '';
                                        var gsap_order_type_code = 'ZOR';
                                        var gsap_order_status = 'N';
                                        var transporeon_status = 'N';
                                        var loading_count = 0;
                                        var unloading_count = 0;
                                        var item_count = 0;
                                        var item_quantity = 0;
                                        var shipments_code = '';

                                        var script001 = `select case when max(shipments_code) is null then '000001' 
                                        else LPAD((replace(max(shipments_code),'','') :: integer + 1) :: text,6,'0') end as shipments_code
                                        from tbl_order where ord_type_code in ('otyp-9999999999997', 'otyp-9999999999996')`;

                                        let tbl_temporary001 = await pgConn.get(dbPrefix + lic_code, script001, config.connectionString());

                                        if (!tbl_temporary001.code) {
                                            if (tbl_temporary001.data.length > 0) {
                                                shipments_code = tbl_temporary001.data[0].shipments_code;
                                            }
                                            else {
                                                let response = [{
                                                    status: 'error',
                                                    invalid_code: '-3',
                                                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                                    data: '',
                                                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                                }]
                                                res.status(200).send(response);
                                                await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบก่อนปิดงาน, หาค่า Shipments Code ไม่พบ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                                                return;
                                            }
                                        }
                                        else {
                                            let response = [{
                                                status: 'error',
                                                invalid_code: '-3',
                                                message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                                data: '',
                                                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                            }]
                                            res.status(200).send(response);
                                            await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบก่อนปิดงาน, หาค่า Shipments Code ไม่ได้', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                                            return;
                                        }

                                        script = `insert into tbl_order 
                                        (ord_code, shipments_code, transport_code, tour_code, pull_code, number, document_reference, plant, assigned_carrier_id, assigned_carrier_name, assigned_creditor_number,
                                        assigned_carrier_number, ord_dt, req_dt, ord_comment, ord_customer_code, ord_customer_name, ord_customer_number, gsap_order_type_code, gsap_order_status, ord_type_code, transporeon_status,
                                        loading_count, unloading_count, item_count, item_quantity, off_code, ist_dt, ord_flag, ord_status, veh_compartment_code, veh_code, ref_job_code) 
                                        values 
                                        ('${ord_code}','${shipments_code}','${transport_code}','${tour_code}','${pull_code}','${number}','${document_reference}','${plant}','${assigned_carrier_id}','${assigned_carrier_name}','${assigned_creditor_number}',
                                        '${assigned_carrier_number}','${ord_dt}','${req_dt}','${ord_comment}','${ord_customer_code}','${ord_customer_name}','${ord_customer_number}','${gsap_order_type_code}','${gsap_order_status}','otyp-9999999999996',
                                        '${transporeon_status}',${loading_count},${unloading_count},${item_count},${item_quantity},'${off_code}', '${moment().format('YYYY-MM-DD HH:mm:ss')}', '1', '0', '${veh_compartment_code}', '${veh_code}', '${job_code}')`

                                        script = script.replace(/'NULL'/gi, "NULL")
                                        let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                                        if (!tbl_temporary.code) {
                                            //debugger
                                            script = `update tbl_order 
                                            set item_count = (select count(itm_code) from tbl_order_item where ord_code = '${ord_code}' and ord_item_flag = '1'),
                                            item_quantity = (select sum(item_quantity) from tbl_order_item where ord_code = '${ord_code}' and ord_item_flag = '1'), 
                                            loading_count = (select count(distinct dpo_code) from tbl_order_depot where ord_code = '${ord_code}' and ord_depot_flag = '1'),
                                            unloading_count = (select count(distinct ptrl_code) from tbl_order_petrol where ord_code = '${ord_code}' and ord_petrol_flag = '1')
                                            where ord_code = '${ord_code}'`
                                            let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                                        } else {
                                            let response = [{
                                                status: 'error',
                                                invalid_code: '-3',
                                                message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                                data: '',
                                                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                            }]
                                            res.status(200).send(response);
                                            await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบก่อนปิดงาน, เพิ่ม Order In Truck', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                                            return;
                                        }
                                    }
                                    else {
                                        let response = [{
                                            status: 'error',
                                            invalid_code: '-3',
                                            message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                            data: '',
                                            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                        }]
                                        res.status(200).send(response);
                                        await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบก่อนปิดงาน, เพิ่ม Order In Truck (Item)', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                                        return;
                                    }
                                }
                                else {
                                    let response = [{
                                        status: 'error',
                                        invalid_code: '-3',
                                        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                        data: '',
                                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                    }]
                                    res.status(200).send(response);
                                    await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบก่อนปิดงาน, เพิ่ม Order In Truck (Depot)', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                                    return;
                                }
                            }
                            else {
                                let response = [{
                                    status: 'error',
                                    invalid_code: '-3',
                                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                    data: '',
                                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                }]
                                res.status(200).send(response);
                                await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบก่อนปิดงาน, เพิ่ม Order In Truck (Depot ค่าว่าง)', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                                return;
                            }
                        }
                        else {
                            let response = [{
                                status: 'error',
                                invalid_code: '-3',
                                message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                data: '',
                                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                            }]
                            res.status(200).send(response);
                            await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบก่อนปิดงาน, เพิ่ม Order In Truck (Get Depot)', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                            return;
                        }
                    }

                    //debugger
                    if (itm == item.length - 1) {

                        var xmlfull = await xglobal.postBeforeCloseDischargedJob2Tmp(lic_code, job_code);

                        if (xmlfull != '') {
                            await xglobal.action_logs(lic_code, action[0].id, job_code + 'ตรวจสอบก่อนปิดงาน, Get Xml Complete', JSON.stringify(req.body[0]), 'success', action[0].value);
                        }
                        else {
                            await xglobal.action_logs(lic_code, action[0].id, job_code + 'ตรวจสอบก่อนปิดงาน, Get Xml Reject', JSON.stringify(req.body[0]), 'success', action[0].value);
                        }

                        //clear ค่าเพื่อบันทึกใหม่หลังจากยืนยัน
                        let script = ``;
                        script = `update tbl_job set
                        mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
                        job_status = '2' 
                        where job_code = '${job_code}';`

                        script = script.replace(/'NULL'/gi, "NULL")
                        let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                        if (!tbl_temporary.code) {
                            //debugger
                            script = `delete from tbl_order_close where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}');`
                            let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                            //debugger
                            if (!tbl_temporary0.code) {
                                script = `update tbl_order set ord_flag = '0' where ord_type_code = 'otyp-9999999999996' and ref_job_code = '${job_code}';`
                                let tbl_temporary0xx = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

                                if (tbl_temporary0xx.code) {
                                    let response = [{
                                        status: 'error',
                                        invalid_code: '-3',
                                        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                        data: '',
                                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                    }]
                                    res.status(200).send(response);
                                    await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบก่อนปิดงาน, Clear Order In Trucks', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                                    return;
                                }
                            }
                            else {
                                let response = [{
                                    status: 'error',
                                    invalid_code: '-3',
                                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                    data: '',
                                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                }]
                                res.status(200).send(response);
                                await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบก่อนปิดงาน, Clear Order Close', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                                return;
                            }
                        }
                        else {
                            let response = [{
                                status: 'error',
                                invalid_code: '-3',
                                message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                data: '',
                                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                            }]
                            res.status(200).send(response);
                            await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบก่อนปิดงาน, Clear Order Status', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                            return;
                        }

                        //debugger
                        if (xmlfull == '' || xmlfull == undefined) {
                            let response = [{
                                status: 'error',
                                invalid_code: '-3',
                                message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                data: '',
                                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                            }]
                            res.status(200).send(response);
                            await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบก่อนปิดงาน, Get Xml Reject', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                            return;
                        }
                        else {
                            let response = [{
                                status: 'success',
                                invalid_code: '0',
                                message: '',
                                data: xmlfull,
                                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                            }]

                            res.status(200).send(response);
                            await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบก่อนปิดงาน, Get Xml Complete', JSON.stringify(req.body[0]), 'success', action[0].value);
                            return;
                        }
                    }
                }
            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบก่อนปิดงาน, Update Status Jobs', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบก่อนปิดงาน, Catch', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

exports.removeXmlBeforeCompartmentJobForCloseInformation = async (req, res, next) => {

    return (async () => {
        //debugger
        let lic_code = req.header('lic_code');
        let {
            job_code,
            action
        } = req.body[0];

        if (job_code == undefined || action == undefined) {
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
            script = `update tbl_job set
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
            job_status = '2' 
            where job_code = '${job_code}';`

            script = script.replace(/'NULL'/gi, "NULL")
            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                script = `delete from tbl_order_close where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}');`
                let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                //debugger
                if (!tbl_temporary0.code) {
                    script = `update tbl_order set ord_flag = '0' where ord_type_code = 'otyp-9999999999996' and ref_job_code = '${job_code}';`
                    let tbl_temporary0xx = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                    await xglobal.action_logs(lic_code, action[0].id, 'remove order in truck: ' + job_code, JSON.stringify(req.body[0]), 'success', action[0].value);

                    //debugger
                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'Clear Xml ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'success', action[0].value);
                    return;
                }
                else {
                    let response = [{
                        status: 'error',
                        invalid_code: '-3',
                        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]
                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'Clear Xml ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                    return;
                }
            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'Clear Xml ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'Clear Xml ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

exports.setCommitCompartmentJobForCloseInformation = async (req, res, next) => {

    var xresult = [];
    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            job_code,
            xml,
            action
        } = req.body[0];

        if (job_code == undefined || action == undefined || xml == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            if (xml.length <= 0) {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง xml ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง item ไม่รองรับค่าว่าง', action[0].value);
                return;
            }

            let response = [{
                status: 'success',
                invalid_code: '0',
                message: '',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            var xtmp_status = await xglobal.postCloseDischargedJob2TmpWithXml(lic_code, job_code, xml);

            if (xtmp_status == true) {
                await xglobal.action_logs(lic_code, action[0].id, job_code + ' Close Job TMP Complete', JSON.stringify(req.body[0]), 'success', action[0].value);
            }
            else {
                await xglobal.action_logs(lic_code, action[0].id, job_code + ' Close Job TMP Reject', JSON.stringify(req.body[0]), 'success', action[0].value);
            }

            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'success', action[0].value);
            return;

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
        await xglobal.action_logs(lic_code, action[0].id, 'ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

exports.getXmlAfterCompartmentJobForCloseInformation = async (req, res, next) => {

    return (async () => {
        //debugger
        let lic_code = req.header('lic_code');
        let {
            job_code,
            action
        } = req.body[0];

        if (job_code == undefined || action == undefined) {
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
            script = `select action_body from tbl_action_logs where action_body like '%${job_code}%' and action_desc = 'ปิดแผนงานข้อมูล Job' order by ist_dt desc limit 1`
            let tbl_temporary00 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

            var xmlfull = ''
            if (!tbl_temporary00.code) {
                if (tbl_temporary00.data.length > 0) {

                    var action_body = JSON.parse(tbl_temporary00.data[0].action_body);
                    xmlfull = action_body.xml;

                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: xmlfull,
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'Get Xml หลังจากปิดงาน', JSON.stringify(req.body[0]), 'success', action[0].value);
                    return;
                }
                else {
                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: `ไม่พบข้อมูล Xml`,
                        data: xmlfull,
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
                    }]
                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'Get Xml หลังจากปิดงาน', JSON.stringify(req.body[0]), 'success', action[0].value);
                    return;
                }
            }
            else {
                let response = [{
                    status: 'error',
                    invalid_code: '-4',
                    message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: xmlfull,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'Get Xml หลังจากปิดงาน', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'Get Xml หลังจากปิดงาน', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

exports.setCommitCompartmentJobForCloseInformation2UpateJob = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            job_code,
            item,
            action
        } = req.body[0];

        if (job_code == undefined || action == undefined || item == undefined) {
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

            if (item.length <= 0) {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง item ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'Get Xml ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง item ไม่รองรับค่าว่าง', action[0].value);
                return;
            }

            script = `select job_code from tbl_job where job_code = '${job_code}' and job_status = '4';`
            let tbl_temporary0001 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

            if (tbl_temporary0001.code) {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: '',
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'มีการเปิดงานซ้ำซ้อน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                return;
            }
            else {
                if (tbl_temporary0001.data.length > 0) {
                    let response = [{
                        status: 'error',
                        invalid_code: '-99',
                        message: `ไม่สามารถบันทึกข้อมูล, เนื่องจาก Jobs นี้มีการปิดงานไปแล้ว`,
                        data: '',
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]
                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'มีการเปิดงานซ้ำซ้อน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                    return;
                }
            }

            //check gsap order number
            script = `select tbl_order.shipments_code, tbl_order.ord_code, count(tbl_order_item.ord_item_code) as xcount 
            from tbl_order 
            left join tbl_order_item on tbl_order.ord_code = tbl_order_item.ord_code
            where tbl_order.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') 
            and (gsap_order_number is null or gsap_order_number = '') and tbl_order.ord_flag = '1' 
            and tbl_order.ord_type_code != 'otyp-9999999999996' 
            group by tbl_order.shipments_code, tbl_order.ord_code`
            let tbl_temporary0002 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (tbl_temporary0002.code) {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: '',
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ไม่สามารถตรวจสอบข้อมูล gsap_order_number', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                return;
            }
            else {
                if (tbl_temporary0002.data.length > 0) {

                    if (tbl_temporary0002.data[0].xcount.toString() != '0') {
                        let response = [{
                            status: 'error',
                            invalid_code: '-3',
                            message: `ไม่สามารถบันทึกข้อมูล, เนื่องจาก gsap_order_number ไม่ครบทุก Order,${tbl_temporary0002.data[0].shipments_code}`,
                            data: '',
                            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                        }]
                        res.status(200).send(response);
                        await xglobal.action_logs(lic_code, action[0].id, 'ไม่สามารถตรวจสอบข้อมูล gsap_order_number', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                        return;
                    }
                }
            }

            //clear 
            script = `delete from tbl_order_close where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}');`
            let tbl_temporary00 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

            //update
            script = `update tbl_job set
                mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
                job_status = '4' 
                where job_code = '${job_code}';`

            script = script.replace(/'NULL'/gi, "NULL")
            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                for (var itm = 0; itm <= item.length - 1; itm++) {

                    let ord_close_code = 'ocle-' + moment().format('x');
                    script = `insert into tbl_order_close (ord_close_code, ord_code, itm_code, itm_unit_code, item_quantity, 
                    ord_close_flag, ist_dt, mdf_dt, rm_dt, veh_compartment_code, ptrl_code, ptrl_tank_code, delivery_flag) 
                    values ('${ord_close_code}', '${item[itm].ord_code}', '${item[itm].itm_code}', '${item[itm].itm_unit_code}', ${item[itm].item_quantity}, '1', 
                    '${moment().format('YYYY-MM-DD HH:mm:ss')}', NULL, NULL, '${item[itm].veh_compartment_code}', '${item[itm].ptrl_code}', 
                    '${item[itm].ptrl_tank_code}', '${item[itm].delivery_flag}');`

                    let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                    if (item[itm].delivery_flag == '3') {
                        //add order
                        let ord_code = 'odr-' + moment().format('x');
                        var itm_code = item[itm].itm_code;
                        var itm_unit_code = item[itm].itm_unit_code;
                        var item_quantity = parseFloat(item[itm].item_quantity);
                        var veh_compartment_code = item[itm].veh_compartment_code;
                        var veh_code = '';
                        var veh_number = '';
                        var script00 = `select tbl_order_depot.dpo_code, loading_start_dt, loading_end_dt, tbl_depot.off_code from tbl_order_depot 
                        left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code and tbl_depot.dpo_flag = '1'
                        where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') and itm_code = '${itm_code}' limit 1;`

                        let tbl_temporary00 = await pgConn.get(dbPrefix + lic_code, script00, config.connectionString());
                        if (!tbl_temporary00.code) {

                            var dpo_code = '';
                            var loading_start_dt = '';
                            var loading_end_dt = '';
                            var off_code = ''
                            if (tbl_temporary00.data.length > 0) {
                                dpo_code = tbl_temporary00.data[0].dpo_code;
                                off_code = tbl_temporary00.data[0].off_code;
                                loading_start_dt = moment(tbl_temporary00.data[0].loading_start_dt).format('YYYY-MM-DD HH:mm:ss')
                                loading_end_dt = moment(tbl_temporary00.data[0].loading_end_dt).format('YYYY-MM-DD HH:mm:ss')
                            }

                            //get veh_code 
                            script00 = `select tbl_vehicle.veh_code, tbl_vehicle.veh_number from
                            tbl_vehicle_compartment 
                            left join tbl_vehicle on tbl_vehicle.veh_code = tbl_vehicle_compartment.veh_code
                            where veh_compartment_code = '${veh_compartment_code}' limit 1;`
                            tbl_temporary00 = await pgConn.get(dbPrefix + lic_code, script00, config.connectionString());

                            if (!tbl_temporary00.code) {
                                if (tbl_temporary00.data.length > 0) {
                                    veh_code = tbl_temporary00.data[0].veh_code;
                                    veh_number = tbl_temporary00.data[0].veh_number;
                                }
                                else {
                                    dpo_code = '';
                                }
                            }
                            else {
                                dpo_code = '';
                            }

                            if (dpo_code != '') {
                                var ord_depot_code = 'odpo-' + moment().format('x');
                                let script0 = `INSERT INTO public.tbl_order_depot 
                                (ord_depot_code, ord_code, dpo_code, itm_code, itm_unit_code, item_quantity, ord_depot_flag, ist_dt, loading_start_dt, loading_end_dt) 
                                values ('${ord_depot_code}', '${ord_code}', '${dpo_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity}, 
                                '1', '${moment(loading_start_dt).format('YYYY-MM-DD HH:mm:ss')}', '${moment(loading_end_dt).format('YYYY-MM-DD HH:mm:ss')}',
                                '${moment().format('YYYY-MM-DD HH:mm:ss')}')`

                                let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script0, config.connectionString());
                                if (!tbl_temporary0.code) {
                                    //add item
                                    var ord_item_code = 'oitm-' + moment().format('x');
                                    let script1 = `INSERT INTO public.tbl_order_item 
                                    (ord_item_code, ord_code, itm_code, itm_unit_code, item_quantity, ord_item_flag, ist_dt) 
                                    values ('${ord_item_code}', '${ord_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity}, 
                                    '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}')`

                                    let tbl_temporary1 = await pgConn.execute(dbPrefix + lic_code, script1, config.connectionString());
                                    if (!tbl_temporary1.code) {
                                        var transport_code = '';
                                        var tour_code = '';
                                        var pull_code = '';
                                        var number = '';
                                        var document_reference = '';
                                        var plant = '';
                                        var assigned_carrier_id = '624745';
                                        var assigned_carrier_name = 'PONGRAWE Co.,Ltd';
                                        var assigned_creditor_number = '68057026';
                                        var assigned_carrier_number = '';
                                        var ord_dt = moment().format('YYYY-MM-DD HH:mm:ss');
                                        var req_dt = moment().add('day', 2).format('YYYY-MM-DD HH:mm:ss');
                                        var ord_comment = 'Order In Track:' + veh_number;
                                        var ord_customer_code = '';
                                        var ord_customer_name = '';
                                        var ord_customer_number = '';
                                        var gsap_order_type_code = 'ZOR';
                                        var gsap_order_status = 'N';
                                        var transporeon_status = 'N';
                                        var loading_count = 0;
                                        var unloading_count = 0;
                                        var item_count = 0;
                                        var item_quantity = 0;
                                        var shipments_code = '';

                                        var script001 = `select case when max(shipments_code) is null then '000001' 
                                        else LPAD((replace(max(shipments_code),'','') :: integer + 1) :: text,6,'0') end as shipments_code
                                        from tbl_order where ord_type_code in ('otyp-9999999999997', 'otyp-9999999999996')`;

                                        let tbl_temporary001 = await pgConn.get(dbPrefix + lic_code, script001, config.connectionString());

                                        if (!tbl_temporary001.code) {
                                            if (tbl_temporary001.data.length > 0) {
                                                shipments_code = tbl_temporary001.data[0].shipments_code;
                                            }
                                            else {
                                                let response = [{
                                                    status: 'error',
                                                    invalid_code: '-3',
                                                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                                    data: '',
                                                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                                }]
                                                res.status(200).send(response);
                                                await xglobal.action_logs(lic_code, action[0].id, 'Get Xml ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                                                return;
                                            }
                                        }
                                        else {
                                            let response = [{
                                                status: 'error',
                                                invalid_code: '-3',
                                                message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                                data: '',
                                                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                            }]
                                            res.status(200).send(response);
                                            await xglobal.action_logs(lic_code, action[0].id, 'Get Xml ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                                            return;
                                        }

                                        script = `insert into tbl_order 
                                        (ord_code, shipments_code, transport_code, tour_code, pull_code, number, document_reference, plant, assigned_carrier_id, assigned_carrier_name, assigned_creditor_number,
                                        assigned_carrier_number, ord_dt, req_dt, ord_comment, ord_customer_code, ord_customer_name, ord_customer_number, gsap_order_type_code, gsap_order_status, ord_type_code, transporeon_status,
                                        loading_count, unloading_count, item_count, item_quantity, off_code, ist_dt, ord_flag, ord_status, veh_compartment_code, veh_code, ref_job_code) 
                                        values 
                                        ('${ord_code}','${shipments_code}','${transport_code}','${tour_code}','${pull_code}','${number}','${document_reference}','${plant}','${assigned_carrier_id}','${assigned_carrier_name}','${assigned_creditor_number}',
                                        '${assigned_carrier_number}','${ord_dt}','${req_dt}','${ord_comment}','${ord_customer_code}','${ord_customer_name}','${ord_customer_number}','${gsap_order_type_code}','${gsap_order_status}','otyp-9999999999996',
                                        '${transporeon_status}',${loading_count},${unloading_count},${item_count},${item_quantity},'${off_code}', '${moment().format('YYYY-MM-DD HH:mm:ss')}', '1', '0', '${veh_compartment_code}', '${veh_code}', '${job_code}')`

                                        script = script.replace(/'NULL'/gi, "NULL")
                                        let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                                        if (!tbl_temporary.code) {
                                            //debugger
                                            script = `update tbl_order 
                                            set item_count = (select count(itm_code) from tbl_order_item where ord_code = '${ord_code}' and ord_item_flag = '1'),
                                            item_quantity = (select sum(item_quantity) from tbl_order_item where ord_code = '${ord_code}' and ord_item_flag = '1'), 
                                            loading_count = (select count(distinct dpo_code) from tbl_order_depot where ord_code = '${ord_code}' and ord_depot_flag = '1'),
                                            unloading_count = (select count(distinct ptrl_code) from tbl_order_petrol where ord_code = '${ord_code}' and ord_petrol_flag = '1')
                                            where ord_code = '${ord_code}'`
                                            let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                                        } else {
                                            let response = [{
                                                status: 'error',
                                                invalid_code: '-3',
                                                message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                                data: '',
                                                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                            }]
                                            res.status(200).send(response);
                                            await xglobal.action_logs(lic_code, action[0].id, 'Get Xml ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                                            return;
                                        }
                                    }
                                    else {
                                        let response = [{
                                            status: 'error',
                                            invalid_code: '-3',
                                            message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                            data: '',
                                            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                        }]
                                        res.status(200).send(response);
                                        await xglobal.action_logs(lic_code, action[0].id, 'Get Xml ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                                        return;
                                    }
                                }
                                else {
                                    let response = [{
                                        status: 'error',
                                        invalid_code: '-3',
                                        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                        data: '',
                                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                    }]
                                    res.status(200).send(response);
                                    await xglobal.action_logs(lic_code, action[0].id, 'Get Xml ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                                    return;
                                }
                            }
                            else {
                                let response = [{
                                    status: 'error',
                                    invalid_code: '-3',
                                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                    data: '',
                                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                }]
                                res.status(200).send(response);
                                await xglobal.action_logs(lic_code, action[0].id, 'Get Xml ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                                return;
                            }
                        }
                        else {
                            let response = [{
                                status: 'error',
                                invalid_code: '-3',
                                message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                data: '',
                                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                            }]
                            res.status(200).send(response);
                            await xglobal.action_logs(lic_code, action[0].id, 'Get Xml ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                            return;
                        }
                    }

                    //debugger
                    if (itm == item.length - 1) {
                        var xml = await xglobal.postBeforeCloseDischargedJob2Tmp(lic_code, job_code);

                        if (xml != '') {
                            req.body[0].xml = xml;
                            var xtmp_status = await xglobal.postCloseDischargedJob2TmpWithXml(lic_code, job_code, xml);
                            console.log('xtmp_status', xtmp_status);
                            await xglobal.action_logs(lic_code, action[0].id, job_code + ' ปิดแผนงานข้อมูล Job ' + xtmp_status, JSON.stringify(req.body[0]), 'success', action[0].value);
                            debugger
                            if (xtmp_status == true) {

                                let script = ``;
                                script = `update tbl_order set
                                mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
                                ord_status = '4' 
                                where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}');`

                                script = script.replace(/'NULL'/gi, "NULL")
                                let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                                await xglobal.action_logs(lic_code, action[0].id, job_code + ' Close Job TMP Complete', JSON.stringify(req.body[0]), 'success', action[0].value);
                            }
                            else {
                                //revert 
                                //clear ค่าเพื่อบันทึกใหม่หลังจากยืนยัน
                                let script = ``;
                                script = `update tbl_job set
                                mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
                                job_status = '2' 
                                where job_code = '${job_code}';`

                                script = script.replace(/'NULL'/gi, "NULL")
                                let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                                if (!tbl_temporary.code) {
                                    //debugger
                                    script = `delete from tbl_order_close where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}');`
                                    let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                                    //debugger
                                    if (!tbl_temporary0.code) {
                                        script = `update tbl_order set ord_flag = '0' where ord_type_code = 'otyp-9999999999996' and ref_job_code = '${job_code}';`
                                        let tbl_temporary0xx = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

                                        if (tbl_temporary0xx.code) {
                                            let response = [{
                                                status: 'error',
                                                invalid_code: '-3',
                                                message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                                data: '',
                                                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                            }]
                                            res.status(200).send(response);
                                            await xglobal.action_logs(lic_code, action[0].id, 'Get Xml ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                                            return;
                                        }
                                    }
                                    else {
                                        let response = [{
                                            status: 'error',
                                            invalid_code: '-3',
                                            message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                            data: '',
                                            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                        }]
                                        res.status(200).send(response);
                                        await xglobal.action_logs(lic_code, action[0].id, 'Get Xml ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                                        return;
                                    }
                                }
                                else {
                                    let response = [{
                                        status: 'error',
                                        invalid_code: '-3',
                                        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                        data: '',
                                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                    }]
                                    res.status(200).send(response);
                                    await xglobal.action_logs(lic_code, action[0].id, 'Get Xml ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                                    return;
                                }

                                await xglobal.action_logs(lic_code, action[0].id, job_code + ' Close Job TMP Reject', JSON.stringify(req.body[0]), 'success', action[0].value);
                            }

                            debugger
                            if (xtmp_status) {
                                let response = [{
                                    status: 'success',
                                    invalid_code: '0',
                                    message: '',
                                    data: [],
                                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                }]

                                res.status(200).send(response);
                                await xglobal.action_logs(lic_code, action[0].id, 'ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'success', action[0].value);
                                return;
                            }
                            else {
                                let response = [{
                                    status: 'error',
                                    invalid_code: '-3',
                                    message: `ไม่สามารถบันทึกข้อมูล, TMP Reject,Please Check Job Comment`,
                                    data: '',
                                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                }]
                                res.status(200).send(response);
                                await xglobal.action_logs(lic_code, action[0].id, 'Get Xml ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                                return;
                            }

                        }
                        else {
                            //revert 
                            //clear ค่าเพื่อบันทึกใหม่หลังจากยืนยัน
                            let script = ``;
                            script = `update tbl_job set
                                mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
                                job_status = '2' 
                                where job_code = '${job_code}';`

                            script = script.replace(/'NULL'/gi, "NULL")
                            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                            if (!tbl_temporary.code) {
                                //debugger
                                script = `delete from tbl_order_close where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}');`
                                let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                                //debugger
                                if (!tbl_temporary0.code) {
                                    script = `update tbl_order set ord_flag = '0' where ord_type_code = 'otyp-9999999999996' and ref_job_code = '${job_code}';`
                                    let tbl_temporary0xx = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

                                    if (tbl_temporary0xx.code) {
                                        let response = [{
                                            status: 'error',
                                            invalid_code: '-3',
                                            message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                            data: '',
                                            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                        }]
                                        res.status(200).send(response);
                                        await xglobal.action_logs(lic_code, action[0].id, 'Get Xml ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                                        return;
                                    }
                                    else {
                                        let response = [{
                                            status: 'error',
                                            invalid_code: '-3',
                                            message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                            data: '',
                                            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                        }]
                                        res.status(200).send(response);
                                        await xglobal.action_logs(lic_code, action[0].id, 'Get Xml ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                                        return;
                                    }
                                }
                                else {
                                    let response = [{
                                        status: 'error',
                                        invalid_code: '-3',
                                        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                        data: '',
                                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                    }]
                                    res.status(200).send(response);
                                    await xglobal.action_logs(lic_code, action[0].id, 'Get Xml ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                                    return;
                                }
                            }
                            else {
                                let response = [{
                                    status: 'error',
                                    invalid_code: '-3',
                                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                    data: '',
                                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                }]
                                res.status(200).send(response);
                                await xglobal.action_logs(lic_code, action[0].id, 'Get Xml ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                                return;
                            }

                        }
                    }
                }
            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'Get Xml ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'Get Xml ปิดแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}