const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
exports.getVehicleOfOrderInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { ord_code, off_code, filter, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ord_code == undefined || off_code == undefined || filter == undefined || lic_code == undefined || action == undefined) {
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
            script = `select veh_code, veh_number, veh_license_number, veh_license_province, veh_type_code, veh_status, veh_group_code, veh_blackbox_number, veh_brand, veh_model, 
            veh_tank_material, veh_loading_system, veh_maximum_compartment, veh_capacity_in_compartment, veh_tare_weight, veh_gross_weight, veh_tank_width, veh_tank_length, 
            veh_tank_height, veh_tank_capacity, veh_maximum_capacity, veh_discharge_sequence, veh_option_pump, veh_option_doeb, veh_option_m12, veh_option_ivms, veh_option_afdd, 
            veh_registration_starting_date, veh_registration_expire_date, veh_registration_remark, veh_support_product, veh_sticker, veh_braking_system, veh_service_life, veh_flag, 
            veh_image, veh_sub_license_number, veh_sub_license_province, veh_sub_brand, veh_sub_model, veh_sub_registration_starting_date, veh_sub_registration_expire_date, veh_sub_registration_remark, 
            veh_sub_service_life, veh_sub_braking_system, veh_sub_image, ist_dt, mdf_dt, rm_dt, off_code, veh_support_climb_mountain, veh_maximum_distance, veh_minimum_distance, veh_maximum_jobs, veh_remark,
            job_currently, capacity_currently, order_capacity , order_option_pump , order_option_merge_order, unavailable,'1' as checked, '' as veh_resson,
            (veh_maximum_capacity - capacity_currently) as capacity_remain 

            from 
            (select veh_code, veh_number, veh_license_number, veh_license_province, veh_type_code, veh_status, veh_group_code, veh_blackbox_number, veh_brand, veh_model, 
            veh_tank_material, veh_loading_system, veh_maximum_compartment, veh_capacity_in_compartment, veh_tare_weight, veh_gross_weight, veh_tank_width, veh_tank_length, 
            veh_tank_height, veh_tank_capacity, veh_maximum_capacity, veh_discharge_sequence, veh_option_pump, veh_option_doeb, veh_option_m12, veh_option_ivms, veh_option_afdd, 
            veh_registration_starting_date, veh_registration_expire_date, veh_registration_remark, veh_support_product, veh_sticker, veh_braking_system, veh_service_life, veh_flag, 
            veh_image, veh_sub_license_number, veh_sub_license_province, veh_sub_brand, veh_sub_model, veh_sub_registration_starting_date, veh_sub_registration_expire_date, veh_sub_registration_remark, 
            veh_sub_service_life, veh_sub_braking_system, veh_sub_image, ist_dt, mdf_dt, rm_dt, off_code, veh_support_climb_mountain, veh_maximum_distance, veh_minimum_distance, veh_maximum_jobs, veh_remark,

            (select count(ord_code) from tbl_order where TO_CHAR(req_dt, 'YYYY-MM-DD') = 
            (select TO_CHAR(req_dt, 'YYYY-MM-DD') from tbl_order where ord_code = '${ord_code}')
            and tbl_order.veh_code = tbl_vehicle.veh_code) as job_currently,

            (select case when sum(item_quantity) is null then 0 else sum(item_quantity) end from tbl_vehicle_compartment
            left join tbl_order_compartment on tbl_vehicle_compartment.veh_compartment_code = tbl_order_compartment.veh_compartment_code
            where ord_code in 
            (select ord_code from tbl_order
            where TO_CHAR(req_dt, 'YYYY-MM-DD') = (select TO_CHAR(req_dt, 'YYYY-MM-DD') from tbl_order where ord_code = '${ord_code}')
            and tbl_order.veh_code = tbl_vehicle.veh_code) 
            and ord_veh_compartment_flag = '1' and tbl_vehicle_compartment.veh_code = tbl_vehicle.veh_code) as capacity_currently,

            (select tbl_order.item_quantity from tbl_order where ord_code = '${ord_code}') as  order_capacity,

            (select max(tbl_petrol.ptrl_option_pump) from tbl_petrol left join tbl_order_petrol 
            on tbl_petrol.ptrl_code = tbl_order_petrol.ptrl_code where ord_code = '${ord_code}') as order_option_pump,

            (select max(tbl_petrol.ptrl_option_mrge_orders) from tbl_petrol  left join tbl_order_petrol 
            on tbl_petrol.ptrl_code = tbl_order_petrol.ptrl_code where ord_code = '${ord_code}') as order_option_merge_order,

            (select case when count(veh_unavailable_code) is null or count(veh_unavailable_code) = 0 then 0 else 1 end from tbl_vehicle_unavailable 
            where TO_CHAR(veh_unavailable_date, 'YYYY-MM-DD') = (select TO_CHAR(req_dt, 'YYYY-MM-DD') from tbl_order where ord_code = '${ord_code}')
            and tbl_vehicle_unavailable.veh_code = tbl_vehicle.veh_code) as unavailable

            from tbl_vehicle 
            where off_code = '${off_code}' order by veh_number, job_currently asc) xtblmaster`;

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                    xresult = [];
                    for (var xveh = 0; xveh <= tbl_temporary.data.length - 1; xveh++) {
                        //debugger
                        if (tbl_temporary.data[xveh].unavailable == '1') {
                            tbl_temporary.data[xveh].checked = '0'
                            tbl_temporary.data[xveh].veh_resson = 'รถอยู่ในสถานะไม่พร้อมใช้งาน'
                        } else if (tbl_temporary.data[xveh].capacity_remain < tbl_temporary.data[xveh].order_capacity) {
                            tbl_temporary.data[xveh].checked = '0'
                            tbl_temporary.data[xveh].veh_resson = 'พื้นที่ไม่เพียงพอ'
                        } else if (tbl_temporary.data[xveh].order_option_pump == '1' && tbl_temporary.data[xveh].veh_option_pump == '0') {
                            tbl_temporary.data[xveh].checked = '0'
                            tbl_temporary.data[xveh].veh_resson = 'ปั้มต้องการ Pump ในการลงน้ำมัน'
                        } else if (tbl_temporary.data[xveh].order_option_merge_order == '0' && tbl_temporary.data[xveh].job_currently != '0') {
                            tbl_temporary.data[xveh].checked = '0'
                            tbl_temporary.data[xveh].veh_resson = 'ปั้มไม่ต้องการให้มีการพ่วงงาน'
                        }

                        if (xveh == tbl_temporary.data.length - 1) {
                            let response = [{
                                status: 'success',
                                invalid_code: '0',
                                message: '',
                                data: tbl_temporary.data,
                                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                            }]

                            res.status(200).send(response);
                            return;
                        }
                    }

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
