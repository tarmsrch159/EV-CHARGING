const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const xapikey = `1-qFLg-ltaUmdvGikk4MTxxTYLbNNtB5igcGRmVcJsc`;

const dbPrefix = config.dbPrefix();

const axios = require('axios');
//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
exports.getRouteOfJobInformation = async (req, res, next) => {

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
            //get location code from vehicle type
            script = `select case when tbl_vehicle_type.unloading_minute is null then 0 else tbl_vehicle_type.unloading_minute end unloading_minute, 
            case when tbl_vehicle_type.loading_minute is null then 0 else tbl_vehicle_type.loading_minute end as loading_minute from tbl_vehicle_type 
            left join tbl_vehicle on tbl_vehicle_type.veh_type_code = tbl_vehicle.veh_type_code
            where tbl_vehicle.veh_code in (select veh_code from tbl_job where job_code = '${job_code}')`;
            let tbl_veh_minute = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

            var veh_unloading_minute = 0;
            var veh_loading_minute = 0;
            if (!tbl_veh_minute.code) {
                if (tbl_veh_minute.data.length > 0) {
                    veh_unloading_minute = parseInt(tbl_veh_minute.data[0].unloading_minute)
                    veh_loading_minute = parseInt(tbl_veh_minute.data[0].loading_minute)
                }
            }

            script = `select ord_code, location_type_code, location_type_desc, location_code, location_number, location_desc, location_address, location_zip_code, location_country_code, location_lat, location_lon, location_city,
            location_minute, min(start_dt) as start_dt, max(end_dt) as end_dt, location_distance, location_req

            from
            (select '' as ord_code, 'depot' AS location_type_code, 'สถานที่โหลดน้ำมัน' as location_type_desc ,tbl_order_depot.dpo_code as location_code, tbl_depot.dpo_number as location_number, tbl_depot.dpo_desc as location_desc,
            case when tbl_order_depot.dpo_address is null then tbl_depot.dpo_address else tbl_order_depot.dpo_address end as location_address,
            case when tbl_order_depot.dpo_zip_code is null then tbl_depot.dpo_zip_code else tbl_order_depot.dpo_zip_code end as location_zip_code,
            case when tbl_order_depot.dpo_country_code is null then tbl_depot.dpo_country_code else tbl_order_depot.dpo_country_code end as location_country_code,
            case when tbl_order_depot.dpo_lat is null then tbl_depot.dpo_lat else tbl_order_depot.dpo_lat end as location_lat,
            case when tbl_order_depot.dpo_lon is null then tbl_depot.dpo_lon else tbl_order_depot.dpo_lon end as location_lon,
            case when tbl_order_depot.dpo_city is null then tbl_depot.dpo_city else tbl_order_depot.dpo_city end as location_city,
            (tbl_depot.dpo_loading_minute + ${veh_loading_minute}) as location_minute, tbl_order_depot.loading_start_dt as start_dt, tbl_order_depot.loading_end_dt as end_dt, 
            0.0 as location_distance, 0 as location_req

            from tbl_order
            left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code
            left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code
            where tbl_order.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') and tbl_order.ord_flag = '1' and tbl_order_depot.ord_depot_flag = '1'

            union

            select tbl_order.ord_code, 'petrol' AS location_type_code, 'สถานที่ลงน้ำมัน' as location_type_desc, tbl_order_petrol.ptrl_code as location_code, tbl_petrol.ptrl_number as location_number, tbl_petrol.ptrl_desc as location_desc,
            case when tbl_order_petrol.ptrl_address is null then tbl_petrol.ptrl_address else tbl_order_petrol.ptrl_address end as location_address,
            case when tbl_order_petrol.ptrl_zip_code is null then tbl_petrol.ptrl_zip_code else tbl_order_petrol.ptrl_zip_code end as location_zip_code,
            case when tbl_order_petrol.ptrl_country_code is null then tbl_petrol.ptrl_country_code else tbl_order_petrol.ptrl_country_code end as location_country_code,
            case when tbl_order_petrol.ptrl_lat is null then tbl_petrol.ptrl_lat else tbl_order_petrol.ptrl_lat end as location_lat,
            case when tbl_order_petrol.ptrl_lon is null then tbl_petrol.ptrl_lon else tbl_order_petrol.ptrl_lon end as location_lon,
            case when tbl_order_petrol.ptrl_city is null then tbl_petrol.ptrl_city else tbl_order_petrol.ptrl_city end as location_city,
            (tbl_petrol.ptrl_unloading_minute + ${veh_unloading_minute}) as location_minute, tbl_order_petrol.unloading_start_dt as start_dt, tbl_order_petrol.unloading_end_dt as end_dt, 
            0.0 as location_distance, 1 as location_req
            from tbl_order
            left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code
            left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
            where tbl_order.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') and tbl_order.ord_flag = '1' and tbl_order_petrol.ord_petrol_flag = '1'
            
            union

            select '' as ord_code, 'yard' AS location_type_code, 'สถานที่จอดหลังจากขนส่ง' as location_type_desc ,tbl_job.pkg_code as location_code, tbl_depot.dpo_number as location_number, tbl_depot.dpo_desc as location_desc,
            tbl_depot.dpo_address as location_address,
            tbl_depot.dpo_zip_code as location_zip_code,
            tbl_depot.dpo_country_code as location_country_code,
            tbl_depot.dpo_lat as location_lat,
            tbl_depot.dpo_lon as location_lon,
            tbl_depot.dpo_city as location_city,
            (tbl_depot.dpo_loading_minute + ${veh_loading_minute}) as location_minute,tbl_job.transit_end_dt as start_dt,tbl_job.transit_end_dt as end_dt, 0.0 as location_distance, 2 as location_req

            from tbl_job
            left join tbl_depot on tbl_job.pkg_code = tbl_depot.dpo_code
            where tbl_job.job_code = '${job_code}') xtblmaster

            group by ord_code,
            location_type_code, location_type_desc, location_code, location_number, location_desc, location_address, location_zip_code, location_country_code, location_lat, location_lon, location_city,
            location_minute, location_distance, location_req
            order by location_type_code,location_req, min(start_dt) asc `;

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

exports.setRouteOfOJobInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { job_code, location_type_code, location_code, start_dt, end_dt, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (job_code == undefined || location_type_code == undefined || location_code == undefined
            || start_dt == undefined || end_dt == undefined || lic_code == undefined || action == undefined) {
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
            if (location_type_code == 'depot') {
                script = `update tbl_order_depot set loading_start_dt = '${start_dt}', loading_end_dt = '${end_dt}' 
                    where tbl_order_depot.dpo_code = '${location_code}' and ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}');`
            }
            else {
                script = `update tbl_order_petrol set unloading_start_dt = '${start_dt}', unloading_end_dt = '${end_dt}' 
                    where tbl_order_petrol.ptrl_code = '${location_code}' and ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}');`
            }

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {

                script = `update tbl_job 
                set item_count = (select count(distinct itm_code) from tbl_order_item where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') and ord_item_flag = '1'),
                item_quantity = (select sum(item_quantity) from tbl_order_item where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') and ord_item_flag = '1'), 
                loading_count = (select count(distinct dpo_code) from tbl_order_depot where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') and ord_depot_flag = '1'),
                unloading_count = (select count(distinct ptrl_code) from tbl_order_petrol where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') and ord_petrol_flag = '1'),
                transit_start_dt = (select min(loading_start_dt) as transit_start_dt from tbl_order_depot where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}')
                and loading_start_dt is not null), 
                transit_end_dt = (select max(unloading_end_dt) as transit_end_dt from tbl_order_petrol where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}')
                and unloading_end_dt is not null) 
                where job_code = '${job_code}'`

                let tbl_temporary001 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                if (!tbl_temporary001.code) {

                    script = `update tbl_job set 
                    transit_minute = (select (extract(epoch from transit_end_dt::timestamp - transit_start_dt::timestamp) / 60) as transit_minute from tbl_job where job_code = '${job_code}')
                    where job_code = '${job_code}';`
                    let tbl_temporary002 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: xresult,
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'อัพเดทเวลาในการขนส่ง', JSON.stringify(req.body[0]), 'สำเร็จ', action[0].value);
                    return;
                }
                else {
                    let response = [{
                        status: 'error',
                        invalid_code: '-3',
                        message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                        data: xresult,
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]
                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'อัพเดทเวลาในการขนส่ง', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'อัพเดทเวลาในการขนส่ง', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'อัพเดทเวลาในการขนส่ง', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}
