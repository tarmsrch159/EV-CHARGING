const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
exports.getVehicleInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { veh_code, veh_group_code, off_code, action, page_index, page_limit } = req.body[0];
        page_index == undefined ? page_index = 1 : page_index;
        page_limit == undefined ? page_limit = 10 : page_limit;

        if (page_index > 0) {
            page_index -= 1;
        }
        //เช็คเฉพาะส่วนที่สำคัญ
        if (off_code == undefined || veh_code == undefined || lic_code == undefined || action == undefined || veh_group_code == undefined) {
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
            if (veh_code.toString().toUpperCase() != 'ALL') {
                script = `select veh_code, veh_number, veh_license_number, veh_license_province, tbl_vehicle.veh_type_code, tbl_vehicle_type.veh_type_code, veh_status, 
                tbl_vehicle.veh_group_code, tbl_vehicle_group.veh_group_desc,
                veh_blackbox_number, veh_brand, veh_model, veh_tank_material, veh_loading_system, veh_maximum_compartment, veh_capacity_in_compartment, 
                veh_tare_weight, veh_gross_weight, veh_tank_width, veh_tank_length, veh_tank_height, veh_tank_capacity, veh_maximum_capacity, 
                veh_discharge_sequence, veh_option_pump, veh_option_doeb, veh_option_m12, veh_option_ivms, veh_option_afdd, veh_registration_starting_date, 
                veh_registration_expire_date, veh_registration_remark, veh_support_product, veh_sticker, veh_braking_system,  veh_service_life, 
                veh_flag, veh_image, veh_support_climb_mountain, veh_maximum_distance, veh_minimum_distance, veh_maximum_jobs, veh_remark, 
                veh_sub_license_number, veh_sub_license_province, veh_sub_brand, veh_sub_model, veh_sub_registration_starting_date, 
                veh_sub_registration_expire_date, veh_sub_registration_remark, veh_sub_service_life, veh_sub_braking_system, veh_sub_image, 
                tbl_vehicle.off_code, tbl_vehicle.ist_dt, tbl_vehicle.mdf_dt, tbl_vehicle.rm_dt,
                case when tbl_vehicle.veh_start_dt is null then '08:00:00' else tbl_vehicle.veh_start_dt end as veh_start_dt, 
                case when tbl_vehicle.veh_end_dt is null then '18:00:00' else tbl_vehicle.veh_end_dt end as veh_end_dt 

                from tbl_vehicle 
                left join tbl_vehicle_type on tbl_vehicle.veh_type_code = tbl_vehicle_type.veh_type_code
                left join tbl_vehicle_group on tbl_vehicle.veh_group_code = tbl_vehicle_group.veh_group_code 
                where tbl_vehicle.veh_code = '${veh_code}' and tbl_vehicle.veh_flag = '1'`;
            }
            else {
                script = `select veh_code, veh_number, veh_license_number, veh_license_province, tbl_vehicle.veh_type_code, tbl_vehicle_type.veh_type_code, veh_status, 
                tbl_vehicle.veh_group_code, tbl_vehicle_group.veh_group_desc,
                veh_blackbox_number, veh_brand, veh_model, veh_tank_material, veh_loading_system, veh_maximum_compartment, veh_capacity_in_compartment, 
                veh_tare_weight, veh_gross_weight, veh_tank_width, veh_tank_length, veh_tank_height, veh_tank_capacity, veh_maximum_capacity, 
                veh_discharge_sequence, veh_option_pump, veh_option_doeb, veh_option_m12, veh_option_ivms, veh_option_afdd, veh_registration_starting_date, 
                veh_registration_expire_date, veh_registration_remark, veh_support_product, veh_sticker, veh_braking_system,  veh_service_life, 
                veh_flag, veh_image, veh_support_climb_mountain, veh_maximum_distance, veh_minimum_distance, veh_maximum_jobs, veh_remark, 
                veh_sub_license_number, veh_sub_license_province, veh_sub_brand, veh_sub_model, veh_sub_registration_starting_date, 
                veh_sub_registration_expire_date, veh_sub_registration_remark, veh_sub_service_life, veh_sub_braking_system, veh_sub_image, 
                tbl_vehicle.off_code, tbl_vehicle.ist_dt, tbl_vehicle.mdf_dt, tbl_vehicle.rm_dt,
                case when tbl_vehicle.veh_start_dt is null then '08:00:00' else tbl_vehicle.veh_start_dt end as veh_start_dt, 
                case when tbl_vehicle.veh_end_dt is null then '18:00:00' else tbl_vehicle.veh_end_dt end as veh_end_dt

                from tbl_vehicle 
                left join tbl_vehicle_type on tbl_vehicle.veh_type_code = tbl_vehicle_type.veh_type_code
                left join tbl_vehicle_group on tbl_vehicle.veh_group_code = tbl_vehicle_group.veh_group_code 
                where tbl_vehicle.veh_flag = '1'`;
            }

            if (veh_group_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_vehicle.veh_group_code = '${veh_group_code}'`
            }

            if (off_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_vehicle.off_code = '${off_code}'`
            }

            script += ` order by tbl_vehicle.ist_dt desc`
            script += ` offset (${page_index}*${page_limit}) limit ${page_limit};`
            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));
                    let page_total = 0;
                    let rows_total = 0;
                    if (veh_code.toString().toUpperCase() != 'ALL') {
                        script = `select 
                          ceil((ceil(count(veh_code)) / ${page_limit})) as page_total, 
                          (count(veh_code)) as rows_total 
                        from tbl_vehicle 
                        left join tbl_vehicle_type on tbl_vehicle.veh_type_code = tbl_vehicle_type.veh_type_code
                        left join tbl_vehicle_group on tbl_vehicle.veh_group_code = tbl_vehicle_group.veh_group_code 
                        where tbl_vehicle.veh_code = '${veh_code}' and tbl_vehicle.veh_flag = '1'`;
                    }
                    else {
                        script = `select 
                          ceil((ceil(count(veh_code)) / ${page_limit})) as page_total, 
                          (count(veh_code)) as rows_total 
                        from tbl_vehicle 
                        left join tbl_vehicle_type on tbl_vehicle.veh_type_code = tbl_vehicle_type.veh_type_code
                        left join tbl_vehicle_group on tbl_vehicle.veh_group_code = tbl_vehicle_group.veh_group_code 
                        where tbl_vehicle.veh_flag = '1'`;
                    }

                    if (veh_group_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_vehicle.veh_group_code = '${veh_group_code}'`
                    }

                    if (off_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_vehicle.off_code = '${off_code}'`
                    }

                    let tbl_temporary2 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
                    if (!tbl_temporary2.code) {
                        if (tbl_temporary2.data.length > 0) {
                            page_total = parseInt(tbl_temporary2.data[0].page_total);
                            rows_total = parseInt(tbl_temporary2.data[0].rows_total);
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

exports.removeVehicle = async (req, res, next) => {

    return (async () => {

        let lic_code = req.header('lic_code');
        let { veh_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_code == undefined || lic_code == undefined || action == undefined) {
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
            script = `update tbl_vehicle set veh_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' where veh_code = '${veh_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.setVehicleInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let { veh_code } = req.query;
        let {
            veh_number,
            veh_license_number,
            veh_license_province,
            veh_type_code,
            veh_status,
            veh_group_code,
            veh_blackbox_number,
            veh_brand,
            veh_model,
            veh_tank_material,
            veh_loading_system,
            veh_maximum_compartment,
            veh_capacity_in_compartment,
            veh_tare_weight,
            veh_gross_weight,
            veh_tank_width,
            veh_tank_length,
            veh_tank_height,
            veh_tank_capacity,
            veh_maximum_capacity,
            veh_discharge_sequence,
            veh_option_pump,
            veh_option_doeb,
            veh_option_m12,
            veh_option_ivms,
            veh_option_afdd,
            veh_registration_starting_date,
            veh_registration_expire_date,
            veh_registration_remark,
            veh_support_product,
            veh_sticker,
            veh_braking_system,
            veh_service_life,
            veh_image,
            veh_support_climb_mountain,
            veh_maximum_distance,
            veh_minimum_distance,
            veh_maximum_jobs,
            veh_remark,
            veh_sub_license_number,
            veh_sub_license_province,
            veh_sub_brand,
            veh_sub_model,
            veh_sub_registration_starting_date,
            veh_sub_registration_expire_date,
            veh_sub_registration_remark,
            veh_sub_service_life,
            veh_sub_braking_system,
            veh_sub_image,
            veh_start_dt,
            veh_end_dt,
            off_code,
            action
        } = req.body[0];

        if (veh_code == undefined || veh_number == undefined || veh_license_number == undefined || veh_license_province == undefined
            || veh_type_code == undefined || veh_status == undefined || veh_group_code == undefined || veh_blackbox_number == undefined
            || veh_brand == undefined || veh_model == undefined || veh_tank_material == undefined || veh_loading_system == undefined
            || veh_maximum_compartment == undefined || veh_capacity_in_compartment == undefined || veh_tare_weight == undefined
            || veh_gross_weight == undefined || veh_tank_width == undefined || veh_tank_length == undefined || veh_tank_height == undefined
            || veh_tank_capacity == undefined || veh_maximum_capacity == undefined || veh_discharge_sequence == undefined || veh_option_pump == undefined
            || veh_option_doeb == undefined || veh_option_m12 == undefined || veh_option_ivms == undefined || veh_option_afdd == undefined
            || veh_registration_starting_date == undefined || veh_registration_expire_date == undefined || veh_registration_remark == undefined || veh_support_product == undefined
            || veh_sticker == undefined || veh_braking_system == undefined || veh_service_life == undefined || veh_image == undefined
            || veh_sub_license_number == undefined || veh_sub_license_province == undefined || veh_sub_brand == undefined || veh_sub_model == undefined
            || veh_sub_registration_starting_date == undefined || veh_sub_registration_expire_date == undefined || veh_sub_registration_remark == undefined
            || veh_sub_service_life == undefined || veh_sub_braking_system == undefined || veh_support_climb_mountain == undefined || veh_maximum_distance == undefined
            || veh_minimum_distance == undefined || veh_maximum_jobs == undefined || veh_remark == undefined
            || veh_sub_image == undefined || off_code == undefined || action == undefined) {
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

            if (veh_start_dt == undefined) {
                veh_start_dt = '08:00:00'
            }

            if (veh_end_dt == undefined) {
                veh_end_dt = '18:00:00'
            }

            if (veh_registration_starting_date == '') {
                veh_registration_starting_date = 'NULL'
            }

            if (veh_registration_expire_date == '') {
                veh_registration_expire_date = 'NULL'
            }

            if (veh_sub_registration_starting_date == '') {
                veh_sub_registration_starting_date = 'NULL'
            }

            if (veh_sub_registration_expire_date == '') {
                veh_sub_registration_expire_date = 'NULL'
            }

            if (off_code.toString().toUpperCase() == 'ALL') {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง off_code ไม่รองรับ ALL',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง off_code ไม่รองรับ ALL', action[0].value);
                return;
            }

            script = `update tbl_vehicle set
            veh_number = '${veh_number}',
            veh_license_number = '${veh_license_number}',
            veh_license_province = '${veh_license_province}',
            veh_type_code = '${veh_type_code}',
            veh_status = '${veh_status}',
            veh_group_code = '${veh_group_code}',
            veh_blackbox_number = '${veh_blackbox_number}',
            veh_brand = '${veh_brand}',
            veh_model = '${veh_model}',
            veh_tank_material = '${veh_tank_material}',
            veh_loading_system = '${veh_loading_system}',
            veh_maximum_compartment = ${veh_maximum_compartment},
            veh_capacity_in_compartment = ${veh_capacity_in_compartment},
            veh_tare_weight = ${veh_tare_weight},
            veh_gross_weight = ${veh_gross_weight},
            veh_tank_width = ${veh_tank_width},
            veh_tank_length = ${veh_tank_length},
            veh_tank_height = ${veh_tank_height},
            veh_tank_capacity = ${veh_tank_capacity},
            veh_maximum_capacity = ${veh_maximum_capacity},
            veh_discharge_sequence = '${veh_discharge_sequence}',
            veh_option_pump = '${veh_option_pump}',
            veh_option_doeb = '${veh_option_doeb}',
            veh_option_m12 = '${veh_option_m12}',
            veh_option_ivms = '${veh_option_ivms}',
            veh_option_afdd = '${veh_option_afdd}',
            veh_registration_starting_date = '${veh_registration_starting_date}',
            veh_registration_expire_date = '${veh_registration_expire_date}',
            veh_registration_remark = '${veh_registration_remark}',
            veh_support_product = '${veh_support_product}',
            veh_sticker = '${veh_sticker}',
            veh_braking_system = '${veh_braking_system}',
            veh_service_life = ${veh_service_life},
            veh_image = '${veh_image}',
            veh_support_climb_mountain = '${veh_support_climb_mountain}',
            veh_maximum_distance = ${veh_maximum_distance},
            veh_minimum_distance = ${veh_minimum_distance},
            veh_maximum_jobs = ${veh_maximum_jobs},
            veh_remark = '${veh_remark}',
            veh_sub_license_number = '${veh_sub_license_number}',
            veh_sub_license_province = '${veh_sub_license_province}',
            veh_sub_brand = '${veh_sub_brand}',
            veh_sub_model = '${veh_sub_model}',
            veh_sub_registration_starting_date = '${veh_sub_registration_starting_date}',
            veh_sub_registration_expire_date = '${veh_sub_registration_expire_date}',
            veh_sub_registration_remark = '${veh_sub_registration_remark}',
            veh_sub_service_life = ${veh_sub_service_life},
            veh_sub_braking_system = '${veh_sub_braking_system}',
            veh_sub_image = '${veh_sub_image}',
            off_code = '${off_code}',
            veh_start_dt = '${veh_start_dt}',
            veh_end_dt = '${veh_end_dt}',
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where veh_code = '${veh_code}';`

            script = script.replace(/'NULL'/gi, "NULL")
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.addVehicleInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            veh_number,
            veh_license_number,
            veh_license_province,
            veh_type_code,
            veh_status,
            veh_group_code,
            veh_blackbox_number,
            veh_brand,
            veh_model,
            veh_tank_material,
            veh_loading_system,
            veh_maximum_compartment,
            veh_capacity_in_compartment,
            veh_tare_weight,
            veh_gross_weight,
            veh_tank_width,
            veh_tank_length,
            veh_tank_height,
            veh_tank_capacity,
            veh_maximum_capacity,
            veh_discharge_sequence,
            veh_option_pump,
            veh_option_doeb,
            veh_option_m12,
            veh_option_ivms,
            veh_option_afdd,
            veh_registration_starting_date,
            veh_registration_expire_date,
            veh_registration_remark,
            veh_support_product,
            veh_sticker,
            veh_braking_system,
            veh_service_life,
            veh_image,
            veh_support_climb_mountain,
            veh_maximum_distance,
            veh_minimum_distance,
            veh_maximum_jobs,
            veh_remark,
            veh_sub_license_number,
            veh_sub_license_province,
            veh_sub_brand,
            veh_sub_model,
            veh_sub_registration_starting_date,
            veh_sub_registration_expire_date,
            veh_sub_registration_remark,
            veh_sub_service_life,
            veh_sub_braking_system,
            veh_sub_image,
            off_code,
            veh_start_dt,
            veh_end_dt,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_number == undefined || veh_license_number == undefined || veh_license_province == undefined
            || veh_type_code == undefined || veh_status == undefined || veh_group_code == undefined || veh_blackbox_number == undefined
            || veh_brand == undefined || veh_model == undefined || veh_tank_material == undefined || veh_loading_system == undefined
            || veh_maximum_compartment == undefined || veh_capacity_in_compartment == undefined || veh_tare_weight == undefined
            || veh_gross_weight == undefined || veh_tank_width == undefined || veh_tank_length == undefined || veh_tank_height == undefined
            || veh_tank_capacity == undefined || veh_maximum_capacity == undefined || veh_discharge_sequence == undefined || veh_option_pump == undefined
            || veh_option_doeb == undefined || veh_option_m12 == undefined || veh_option_ivms == undefined || veh_option_afdd == undefined
            || veh_registration_starting_date == undefined || veh_registration_expire_date == undefined || veh_registration_remark == undefined || veh_support_product == undefined
            || veh_sticker == undefined || veh_braking_system == undefined || veh_service_life == undefined || veh_image == undefined
            || veh_sub_license_number == undefined || veh_sub_license_province == undefined || veh_sub_brand == undefined || veh_sub_model == undefined
            || veh_sub_registration_starting_date == undefined || veh_sub_registration_expire_date == undefined || veh_sub_registration_remark == undefined
            || veh_sub_service_life == undefined || veh_sub_braking_system == undefined
            || veh_support_climb_mountain == undefined || veh_maximum_distance == undefined || veh_minimum_distance == undefined || veh_maximum_jobs == undefined
            || veh_remark == undefined
            || veh_sub_image == undefined || off_code == undefined || action == undefined) {
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

            if (veh_start_dt == undefined) {
                veh_start_dt = '08:00:00'
            }

            if (veh_end_dt == undefined) {
                veh_end_dt = '18:00:00'
            }

            if (veh_registration_starting_date == '') {
                veh_registration_starting_date = 'NULL'
            }

            if (veh_registration_expire_date == '') {
                veh_registration_expire_date = 'NULL'
            }

            if (veh_sub_registration_starting_date == '') {
                veh_sub_registration_starting_date = 'NULL'
            }

            if (veh_sub_registration_expire_date == '') {
                veh_sub_registration_expire_date = 'NULL'
            }

            if (off_code.toString().toUpperCase() == 'ALL') {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง off_code ไม่รองรับ ALL',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง off_code ไม่รองรับ ALL', action[0].value);
                return;
            }

            script = `select veh_code from tbl_vehicle where (veh_number = '${veh_number}' or veh_number = '${veh_license_number}') and off_code = '${off_code}' and veh_flag = '1';`
            let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary0.code) {
                if (tbl_temporary0.data.length > 0) {
                    let response = [{
                        status: 'error',
                        invalid_code: '-4',
                        message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลเลขข้างรถหรือทะเบียนรถซ้ำ`,
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลเลขข้างรถหรือทะเบียนรถซ้ำ', action[0].value);
                    return;
                }
            }

            let veh_code = 'vehi-' + moment().format('x');
            script = `insert into tbl_vehicle 
            (veh_code,veh_number,veh_license_number,veh_license_province,veh_type_code,veh_status,veh_group_code,veh_blackbox_number,veh_brand,veh_model,veh_tank_material,veh_loading_system,veh_maximum_compartment,
            veh_capacity_in_compartment,veh_tare_weight,veh_gross_weight,veh_tank_width,veh_tank_length,veh_tank_height,veh_tank_capacity,veh_maximum_capacity,veh_discharge_sequence,veh_option_pump,
            veh_option_doeb,veh_option_m12,veh_option_ivms,veh_option_afdd,veh_registration_starting_date,veh_registration_expire_date,veh_registration_remark,veh_support_product,veh_sticker,
            veh_braking_system,veh_service_life,veh_image,veh_sub_license_number,veh_sub_license_province,veh_sub_brand,veh_sub_model,veh_sub_registration_starting_date,veh_sub_registration_expire_date,
            veh_sub_registration_remark,veh_sub_service_life,veh_sub_braking_system,veh_sub_image,off_code,veh_flag,ist_dt,veh_support_climb_mountain,veh_maximum_distance,veh_minimum_distance,veh_maximum_jobs,veh_remark, veh_start_dt, veh_end_dt) 
            values 
            ('${veh_code}','${veh_number}','${veh_license_number}','${veh_license_province}','${veh_type_code}','${veh_status}','${veh_group_code}','${veh_blackbox_number}','${veh_brand}','${veh_model}','${veh_tank_material}',
            '${veh_loading_system}',${veh_maximum_compartment},${veh_capacity_in_compartment},${veh_tare_weight},${veh_gross_weight},${veh_tank_width},${veh_tank_length},${veh_tank_height},${veh_tank_capacity},${veh_maximum_capacity},
            '${veh_discharge_sequence}','${veh_option_pump}','${veh_option_doeb}','${veh_option_m12}','${veh_option_ivms}','${veh_option_afdd}','${veh_registration_starting_date}','${veh_registration_expire_date}','${veh_registration_remark}',
            '${veh_support_product}','${veh_sticker}','${veh_braking_system}',${veh_service_life},'${veh_image}','${veh_sub_license_number}','${veh_sub_license_province}','${veh_sub_brand}','${veh_sub_model}','${veh_sub_registration_starting_date}',
            '${veh_sub_registration_expire_date}','${veh_sub_registration_remark}',${veh_sub_service_life},'${veh_sub_braking_system}','${veh_sub_image}','${off_code}','1','${moment().format('YYYY-MM-DD HH:mm:ss')}',
            '${veh_support_climb_mountain}',${veh_maximum_distance},${veh_minimum_distance},${veh_maximum_jobs},'${veh_remark}','${veh_start_dt}','${veh_end_dt}')`

            script = script.replace(/'NULL'/gi, "NULL")
            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [{
                        veh_code: veh_code
                    }],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}
