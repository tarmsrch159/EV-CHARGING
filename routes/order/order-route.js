const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const xapikey = `1-qFLg-ltaUmdvGikk4MTxxTYLbNNtB5igcGRmVcJsc`;
const axios = require('axios');
const { json } = require('express');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
exports.getRouteOfOrderInformation = async (req, res, next) => {

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
            script = `select location_type_code, location_type_desc, location_code, location_number, location_desc, location_address, location_zip_code, location_country_code, location_lat, location_lon, location_city,
            location_minute, start_dt, end_dt, location_distance

            from 
            (select 'depot' AS location_type_code, 'สถานที่โหลดน้ำมัน' as location_type_desc ,tbl_order_depot.dpo_code as location_code, tbl_depot.dpo_number as location_number, tbl_depot.dpo_desc as location_desc, 
            case when tbl_order_depot.dpo_address is null then tbl_depot.dpo_address else tbl_order_depot.dpo_address end as location_address,
            case when tbl_order_depot.dpo_zip_code is null then tbl_depot.dpo_zip_code else tbl_order_depot.dpo_zip_code end as location_zip_code,
            case when tbl_order_depot.dpo_country_code is null then tbl_depot.dpo_country_code else tbl_order_depot.dpo_country_code end as location_country_code,
            case when tbl_order_depot.dpo_lat is null then tbl_depot.dpo_lat else tbl_order_depot.dpo_lat end as location_lat,
            case when tbl_order_depot.dpo_lon is null then tbl_depot.dpo_lon else tbl_order_depot.dpo_lon end as location_lon,
            case when tbl_order_depot.dpo_city is null then tbl_depot.dpo_city else tbl_order_depot.dpo_city end as location_city,
            tbl_depot.dpo_loading_minute as location_minute, tbl_order_depot.loading_start_dt as start_dt, tbl_order_depot.loading_end_dt as end_dt, 0.0 as location_distance

            from tbl_order
            left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code
            left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code
            where tbl_order.ord_code = '${ord_code}' and tbl_order.ord_flag = '1' and tbl_order_depot.ord_depot_flag = '1'

            union 

            select 'petrol' AS location_type_code, 'สถานที่ลงน้ำมัน' as location_type_desc, tbl_order_petrol.ptrl_code as location_code, tbl_petrol.ptrl_number as location_number, tbl_petrol.ptrl_desc as location_desc, 
            case when tbl_order_petrol.ptrl_address is null then tbl_petrol.ptrl_address else tbl_order_petrol.ptrl_address end as location_address,
            case when tbl_order_petrol.ptrl_zip_code is null then tbl_petrol.ptrl_zip_code else tbl_order_petrol.ptrl_zip_code end as location_zip_code,
            case when tbl_order_petrol.ptrl_country_code is null then tbl_petrol.ptrl_country_code else tbl_order_petrol.ptrl_country_code end as location_country_code,
            case when tbl_order_petrol.ptrl_lat is null then tbl_petrol.ptrl_lat else tbl_order_petrol.ptrl_lat end as location_lat,
            case when tbl_order_petrol.ptrl_lon is null then tbl_petrol.ptrl_lon else tbl_order_petrol.ptrl_lon end as location_lon,
            case when tbl_order_petrol.ptrl_city is null then tbl_petrol.ptrl_city else tbl_order_petrol.ptrl_city end as location_city,
            tbl_petrol.ptrl_unloading_minute as location_minute, tbl_order_petrol.unloading_start_dt as start_dt, tbl_order_petrol.unloading_end_dt as end_dt, 0.0 as location_distance 
            from tbl_order
            left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code
            left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
            where tbl_order.ord_code = '${ord_code}' and tbl_order.ord_flag = '1' and tbl_order_petrol.ord_petrol_flag = '1') xtblmaster `;

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                    xresult = [];
                    var xlat = 0.0;
                    var xlon = 0.0;
                    var xurl = '';
                    for (var xlocation = 0; xlocation <= tbl_temporary.data.length - 1; xlocation++) {
                        debugger
                        if (xlocation == 0) {
                            xlat = parseFloat(tbl_temporary.data[xlocation].location_lat);
                            xlon = parseFloat(tbl_temporary.data[xlocation].location_lon);
                        }
                        else {
                            xurl = `https://wps.hereapi.com/v8/findsequence2?start=start1;${xlat},${xlon}&end=end1;${tbl_temporary.data[xlocation].location_lat},${tbl_temporary.data[xlocation].location_lon}&mode=shortest;truck&apiKey=${xapikey}`
                            xlat = parseFloat(tbl_temporary.data[xlocation].location_lat);
                            xlon = parseFloat(tbl_temporary.data[xlocation].location_lon);

                            let xconfig = {
                                method: 'get',
                                maxBodyLength: Infinity,
                                url: xurl,
                                headers: {
                                    'Content-Type': 'application/json',
                                }
                            };

                            await axios.request(xconfig)
                                .then((response) => {
                                    debugger
                                    console.log(JSON.stringify(response.data));

                                    if (response.data.results.length > 0) {
                                        if (response.data.results[0].distance != undefined) {
                                            try {
                                                tbl_temporary.data[xlocation].location_distance = parseFloat(response.data.results[0].distance) / 1000;
                                            }
                                            catch (ex) { }
                                        }
                                    }

                                })
                                .catch((error) => {
                                    console.log(error);
                                });
                        }

                        if (xlocation == tbl_temporary.data.length - 1) {
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

exports.setRouteOfOrderInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { ord_code, location_type_code, location_code, start_dt, end_dt, action } = req.body[0];

        console.log(JSON.stringify(req.body[0]));
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ord_code == undefined || location_type_code == undefined || location_code == undefined
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
                    where tbl_order_depot.dpo_code = '${location_code}' and ord_code = '${ord_code}';`
            }
            else {
                script = `update tbl_order_petrol set unloading_start_dt = '${start_dt}', unloading_end_dt = '${end_dt}' 
                    where tbl_order_petrol.ptrl_code = '${location_code}' and ord_code = '${ord_code}';`
            }

            console.log('setRouteOfOrderInformation', script);
            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: xresult,
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
