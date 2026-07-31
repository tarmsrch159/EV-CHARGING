const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js

//Success
exports.getJobInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { job_code, start_date, end_date, job_status, off_code,
            search, page_index, page_limit, action } = req.body[0];
        page_index == undefined ? page_index = 1 : page_index;
        page_limit == undefined ? page_limit = 10 : page_limit;
        //เช็คเฉพาะส่วนที่สำคัญ
        if (job_code == undefined || start_date == undefined || end_date == undefined
            || job_status == undefined || search == undefined || action == undefined) {
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
            if (page_index > 0) {
                page_index -= 1;
            }

            if (start_date.length == 10) {
                start_date = start_date + ' 00:00:00'
            }

            if (end_date.length == 10) {
                end_date = end_date + ' 23:59:59'
            }

            if (job_code.toString().toUpperCase() != 'ALL') {
                script = `select 
                job_code, tms_transport_code, transport_code, tour_code, pull_code, number, document_reference, 
                job_dt, job_status, job_comment, gsap_order_type_code, gsap_order_status, gsap_order_number, 
                case when gsap_shipments_number is null then '' else gsap_shipments_number end as gsap_shipments_number, transporeon_status, tbl_job.off_code, job_flag, tbl_job.ist_dt, tbl_job.mdf_dt, tbl_job.rm_dt, loading_count, 
                unloading_count, item_count, item_quantity, tbl_job.dver_code, tbl_job.veh_code, transporeon_result, transporeon_ist_dt, transporeon_mdf_dt, 
                transporeon_rm_dt, distance, transit_start_dt, transit_end_dt, transit_minute, tbl_driver.dver_name, tbl_driver.dver_surname,
                tbl_driver.dver_mobile_number ,tbl_driver.dver_image_profile, tbl_vehicle.veh_blackbox_number, 
                tbl_vehicle.veh_number, tbl_vehicle.veh_license_number, tbl_vehicle.veh_license_province,
                tbl_vehicle.veh_sub_license_number, tbl_vehicle.veh_sub_license_province, tbl_vehicle.veh_type_code, tbl_vehicle_type.veh_type_desc   
                from tbl_job 
                left join tbl_driver on tbl_job.dver_code  = tbl_driver.dver_code 
                left join tbl_vehicle on tbl_job.veh_code  = tbl_vehicle.veh_code 
                left join tbl_vehicle_type on tbl_vehicle.veh_type_code   = tbl_vehicle_type.veh_type_code 
                where tbl_job.job_flag = '1' and tbl_job.job_code = '${job_code}'`;
            }
            else {
                script = `select 
                job_code, tms_transport_code, transport_code, tour_code, pull_code, number, document_reference, 
                job_dt, job_status, job_comment, gsap_order_type_code, gsap_order_status, gsap_order_number, 
                case when gsap_shipments_number is null then '' else gsap_shipments_number end as gsap_shipments_number, transporeon_status, tbl_job.off_code, job_flag, tbl_job.ist_dt, tbl_job.mdf_dt, tbl_job.rm_dt, loading_count, 
                unloading_count, item_count, item_quantity, tbl_job.dver_code, tbl_job.veh_code, transporeon_result, transporeon_ist_dt, transporeon_mdf_dt, 
                transporeon_rm_dt, distance, transit_start_dt, transit_end_dt, transit_minute, tbl_driver.dver_name, tbl_driver.dver_surname,
                tbl_driver.dver_mobile_number ,tbl_driver.dver_image_profile, tbl_vehicle.veh_blackbox_number, 
                tbl_vehicle.veh_number, tbl_vehicle.veh_license_number, tbl_vehicle.veh_license_province,
                tbl_vehicle.veh_sub_license_number, tbl_vehicle.veh_sub_license_province, tbl_vehicle.veh_type_code, tbl_vehicle_type.veh_type_desc   
                from tbl_job 
                left join tbl_driver on tbl_job.dver_code  = tbl_driver.dver_code 
                left join tbl_vehicle on tbl_job.veh_code  = tbl_vehicle.veh_code 
                left join tbl_vehicle_type on tbl_vehicle.veh_type_code   = tbl_vehicle_type.veh_type_code 
                where tbl_job.job_flag = '1'`;
            }

            if (off_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_job.off_code = '${off_code}' `
            }

            if (job_status.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_job.job_status = '${job_status}' `
            }

            if (search != '') {
                script += ` and (tbl_job.tms_transport_code like '%${search}%' 
                or tbl_job.transport_code like '%${search}%' 
                or tbl_job.tour_code like '%${search}%' 
                or tbl_job.document_reference like '%${search}%')`
            }

            script += ` order by tbl_job.tms_transport_code asc `
            script += ` offset (${page_index}*${page_limit}) limit ${page_limit};`

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                    let page_total = 0;
                    let rows_total = 0;
                    script = ``
                    if (job_code.toString().toUpperCase() != 'ALL') {
                        script = `select ceil((ceil(count(tbl_job.job_code)) / ${page_limit})) as page_total, (count(tbl_job.job_code)) as rows_total 
                        from tbl_job where tbl_job.job_flag = '1' and tbl_job.job_code = '${job_code}' `;
                    }
                    else {
                        script = `select ceil((ceil(count(tbl_job.job_code)) / ${page_limit})) as page_total, (count(tbl_job.job_code)) as rows_total 
                        from tbl_job where tbl_job.job_flag = '1' `;
                    }

                    if (off_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_job.off_code = '${off_code}' `
                    }

                    if (job_status.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_job.job_status = '${job_status}' `
                    }

                    if (search != '') {
                        script += ` and (tbl_job.tms_transport_code like '%${search}%' 
                        or tbl_job.transport_code like '%${search}%' 
                        or tbl_job.tour_code like '%${search}%' 
                        or tbl_job.document_reference like '%${search}%')`
                    }

                    let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

                    if (!tbl_temporary0.code) {
                        if (tbl_temporary0.data.length > 0) {
                            page_total = parseInt(tbl_temporary0.data[0].page_total);
                            rows_total = parseInt(tbl_temporary0.data[0].rows_total);
                        }
                    }

                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: tbl_temporary.data,
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss'),
                        page_total: (page_total <= 0 ? 1 : page_total),
                        rows_total: rows_total
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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

exports.setJobInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');

        let {
            job_code,
            job_comment,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (job_code == undefined || job_comment == undefined || action == undefined) {
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
            script = `update tbl_job set
            job_status = '-1',
            job_comment = '${job_comment}',
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where job_code = '${job_code}';`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                debugger
                script = `update tbl_order set ord_status = '1' 
                where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}');`

                let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

                if (!tbl_temporary0.code) {

                    script = `delete from tbl_job_order where job_code = '${job_code}';`
                    let tbl_temporary00 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

                    if (!tbl_temporary00.code) {
                        let response = [{
                            status: 'success',
                            invalid_code: '0',
                            message: '',
                            data: [],
                            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                        }]

                        res.status(200).send(response);
                        await xglobal.action_logs(lic_code, action[0].id, 'ยกเลิกข้อมูลใบงาน', JSON.stringify(req.body[0]), 'success', action[0].value);
                        return;
                    }
                    else {
                        let response = [{
                            status: 'error',
                            invalid_code: '-5',
                            message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                            data: [],
                            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                        }]
                        res.status(200).send(response);
                        await xglobal.action_logs(lic_code, action[0].id, 'ยกเลิกข้อมูลใบงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                        return;
                    }
                }
                else {
                    let response = [{
                        status: 'error',
                        invalid_code: '-4',
                        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]
                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'ยกเลิกข้อมูลใบงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ยกเลิกข้อมูลใบงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ยกเลิกข้อมูลใบงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.addJobInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            ord_code,
            off_code,
            action
        } = req.body[0];

        if (ord_code == undefined || off_code == undefined || action == undefined) {
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

            if (ord_code.length <= 0) {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ตรวจสอบข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง', action[0].value);
                return;
            }

            script = `select tbl_order.ord_code, shipments_code, case when ord_status != '1' then '-9' else 1 end as checked 
            from tbl_order where tbl_order.ord_flag = '1' and tbl_order.ord_code in (${ord_code.map(number => `'${number}'`).toString()}) `

            script = script.replace(/'NULL'/gi, "NULL")
            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                var xresult = [];
                var xlist = [];
                if (tbl_temporary.data.length > 0) {
                    debugger
                    if (tbl_temporary.data.length != ord_code.length) {
                        let response = [{
                            status: 'error',
                            invalid_code: '-3',
                            message: `ไม่สามารถบันทึกข้อมูล, ข้อมูลบาง Order ไม่ถูกต้อง`,
                            data: [],
                            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                        }]
                        res.status(200).send(response);
                        await xglobal.action_logs(lic_code, action[0].id, 'สร้างใบงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                        return;
                    }

                    debugger
                    var job_code = 'job-' + moment().format('x');
                    var tms_transport_code = moment().format('x').substring(0, 6);

                    script = `select case when max(tms_transport_code) is null then '000001' 
                    else LPAD((replace(max(tms_transport_code),'','') :: integer + 1) :: text,6,'0') end as tms_transport_code
                    from tbl_job`
                    let tbl_temporaryx0 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

                    if (!tbl_temporaryx0.code) {
                        if (tbl_temporaryx0.data.length > 0) {
                            tms_transport_code = tbl_temporaryx0.data[0].tms_transport_code;
                        }
                    }

                    for (var xjob = 0; xjob <= tbl_temporary.data.length - 1; xjob++) {
                        if (tbl_temporary.data[xjob].checked.toString() == '1') {
                            var job_ord_code = 'jord-' + moment().format('x');
                            let ist_dt = moment().format('YYYY-MM-DD HH:mm:ss');

                            script = `insert into tbl_job_order (job_ord_code, job_code, ord_code, ist_dt) values 
                            ('${job_ord_code}','${job_code}','${tbl_temporary.data[xjob].ord_code}', '${ist_dt}');`

                            let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                            console.log('insert tbl_job_order,', job_ord_code, ':', !tbl_temporary0.code);

                            if (!tbl_temporary0.code) {
                                script = `update tbl_order set mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}', ord_status = '3'
                                where ord_code = '${tbl_temporary.data[xjob].ord_code.toString()}';`
                                let tbl_temporary00 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

                                if (!tbl_temporary00.code) {
                                    if (xlist.indexOf(tbl_temporary.data[xjob].shipments_code) == -1) {
                                        xlist.push(tbl_temporary.data[xjob].shipments_code);
                                        xresult.push(
                                            {
                                                shipments_code: tbl_temporary.data[xjob].shipments_code.toString(),
                                                status: "success",
                                                reason: ""
                                            });
                                    }
                                }
                                else {
                                    var xreason = `บันทึกไม่สำเร็จ`;
                                    if (xlist.indexOf(tbl_temporary.data[xjob].shipments_code) == -1) {
                                        xlist.push(tbl_temporary.data[xjob].shipments_code);
                                        xresult.push(
                                            {
                                                shipments_code: tbl_temporary.data[xjob].shipments_code.toString(),
                                                status: "error",
                                                reason: xreason
                                            });
                                    }
                                }
                            }
                            else {
                                var xreason = `บันทึกไม่สำเร็จ`;
                                if (xlist.indexOf(tbl_temporary.data[xjob].shipments_code) == -1) {
                                    xlist.push(tbl_temporary.data[xjob].shipments_code);
                                    xresult.push(
                                        {
                                            shipments_code: tbl_temporary.data[xjob].shipments_code.toString(),
                                            status: "error",
                                            reason: xreason
                                        });
                                }
                            }
                        }
                        else {
                            var xreason = `ไม่สำเร็จ`;

                            switch (tbl_temporary.data[xjob].checked.toString()) {
                                case "-9":
                                    xreason = `ไม่สำเร็จ, Order ไม่พร้อมนำมาจัดงาน`;
                                    break;
                            }

                            if (xlist.indexOf(tbl_temporary.data[xjob].shipments_code) == -1) {
                                xlist.push(tbl_temporary.data[xjob].shipments_code);
                                xresult.push(
                                    {
                                        shipments_code: tbl_temporary.data[xjob].shipments_code.toString(),
                                        status: "error",
                                        reason: xreason
                                    });
                            }
                        }

                        if (xjob == tbl_temporary.data.length - 1) {
                            //insert tbl_job
                            let loading_count = 0;
                            let unloading_count = 0;
                            let item_count = 0;
                            let item_quantity = 0;
                            let distance = 0;
                            let transit_start_dt = moment().format('YYYY-MM-DD HH:mm:ss');
                            let transit_end_dt = moment().add('minute', 180).format('YYYY-MM-DD HH:mm:ss');
                            let transit_minute = '180';
                            let ist_dt = moment().format('YYYY-MM-DD HH:mm:ss');
                            let job_status = '1';
                            let job_dt = moment().format('YYYY-MM-DD HH:mm:ss');

                            script = `insert into tbl_job 
                            (job_code, tms_transport_code, job_dt, job_status, off_code, job_flag, loading_count, unloading_count, item_count, 
                            item_quantity, distance, transit_start_dt, transit_end_dt, transit_minute, ist_dt) values 

                            ('${job_code}', '${tms_transport_code}', '${job_dt}', '${job_status}', '${off_code}', '1', ${loading_count}, ${unloading_count}, ${item_count}, 
                            ${item_quantity}, ${distance}, '${transit_start_dt}', '${transit_end_dt}', ${transit_minute}, '${ist_dt}');`;

                            let tbl_temporary000 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

                            if (!tbl_temporary000.code) {

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
                                    await xglobal.action_logs(lic_code, action[0].id, 'สร้างใบงาน', JSON.stringify(req.body[0]), 'ไม่สำเร็จ', action[0].value);
                                    return;
                                }
                                else {
                                    let response = [{
                                        status: 'error',
                                        invalid_code: '-4',
                                        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                        data: [],
                                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                    }]
                                    res.status(200).send(response);
                                    await xglobal.action_logs(lic_code, action[0].id, 'สร้างใบงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                                    return;
                                }
                            }
                            else {
                                let response = [{
                                    status: 'error',
                                    invalid_code: '-4',
                                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                    data: [],
                                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                }]
                                res.status(200).send(response);
                                await xglobal.action_logs(lic_code, action[0].id, 'สร้างใบงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                                return;
                            }
                        }
                    }
                }
                else {
                    var xresult = [];
                    if (ord_code.length >= 0) {
                        for (var ord = 0; ord <= ord_code.length - 1; ord++) {
                            xresult.push(
                                {
                                    shipments_code: ord_code[ord].toString(),
                                    status: "error",
                                    reason: "ไม่พบข้อมูล Order หรือ Order ยังไม่ได้ตรวจสอบ"
                                });

                            if (ord == ord_code.length - 1) {

                                let response = [{
                                    status: 'success',
                                    invalid_code: '0',
                                    message: '',
                                    data: xresult,
                                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                }]

                                res.status(200).send(response);
                                await xglobal.action_logs(lic_code, action[0].id, 'สร้างใบงาน', JSON.stringify(req.body[0]), 'ไม่สำเร็จ', action[0].value);
                                return;
                            }
                        }
                    }
                    else {
                        let response = [{
                            status: 'success',
                            invalid_code: '0',
                            message: '',
                            data: xresult,
                            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                        }]

                        res.status(200).send(response);
                        await xglobal.action_logs(lic_code, action[0].id, 'สร้างใบงาน', JSON.stringify(req.body[0]), 'ไม่สำเร็จ', action[0].value);
                        return;
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
                await xglobal.action_logs(lic_code, action[0].id, 'สร้างใบงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'สร้างใบงาน', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.getOrderInJobInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { job_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (job_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let script = `select tbl_job_order.ord_code, tbl_order.shipments_code
            from tbl_job_order 
            left join tbl_order on tbl_job_order.ord_code = tbl_order.ord_code
            where job_code = '${job_code}' and tbl_order.ord_flag = '1'`;

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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Order from Job', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Order from Job', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}


exports.setCancelJobsJobInformation = async (req, res, next) => {

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

            if (job_code == '') {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง job_code ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ยกเลิกแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง', action[0].value);
                return;
            }

            script = `update tbl_job set
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
            job_status = '1', 
            dver_code = NULL,
            veh_code = NULL,
            transporeon_status = 'N' 
            where job_code = '${job_code}';`

            script = script.replace(/'NULL'/gi, "NULL")
            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                debugger
                script = `update tbl_order set
                mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
                ord_status = '1', 
                dver_code = NULL,
                veh_code = NULL,
                transporeon_status = 'N' 
                where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}');`
                let tbl_temporary00 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

                script = `delete from tbl_order_compartment where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}');`
                let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

                if (!tbl_temporary00.code && !tbl_temporary0.code) {
                    var xtmp_status = await xglobal.deleteJob2TmpWithShipment(lic_code, job_code);

                    if (xtmp_status == true) {
                        await xglobal.action_logs(lic_code, action[0].id, job_code + ' TMP Complete', JSON.stringify(req.body[0]), 'success', action[0].value);
                    }
                    else {
                        await xglobal.action_logs(lic_code, action[0].id, job_code + ' TMP Reject', JSON.stringify(req.body[0]), 'success', action[0].value);
                    }

                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'ยกเลิกแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'success', action[0].value);
                    return;
                }
                else {
                    let response = [{
                        status: 'error',
                        invalid_code: '-4',
                        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]
                    res.status(200).send(response);
                    await xglobal.a
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
                await xglobal.action_logs(lic_code, action[0].id, 'ยกเลิกแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ยกเลิกแผนงานข้อมูล Job', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.getJobItemInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { job_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (job_code == undefined || action == undefined) {
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
            script = `select '${job_code}' as job_code, tbl_order_depot.dpo_code, tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_depot.dpo_short_desc, 
            case when tbl_order_depot.dpo_address is null then tbl_depot.dpo_address else tbl_order_depot.dpo_address end as dpo_address,
            case when tbl_order_depot.dpo_zip_code is null then tbl_depot.dpo_zip_code else tbl_order_depot.dpo_zip_code end as dpo_zip_code,
            case when tbl_order_depot.dpo_country_code is null then tbl_depot.dpo_country_code else tbl_order_depot.dpo_country_code end as dpo_country_code,
            case when tbl_order_depot.dpo_lat is null then tbl_depot.dpo_lat else tbl_order_depot.dpo_lat end as dpo_lat,
            case when tbl_order_depot.dpo_lon is null then tbl_depot.dpo_lon else tbl_order_depot.dpo_lon end as dpo_lon,
            case when tbl_order_depot.dpo_city is null then tbl_depot.dpo_city else tbl_order_depot.dpo_city end as dpo_city,
            tbl_depot.dpo_loading_minute,
            tbl_master.itm_code, tbl_item.itm_desc, tbl_item.itm_short_desc, tbl_item.itm_image, tbl_item.itm_material_number, tbl_item_type.itm_type_code,
            tbl_item_type.itm_type_desc, tbl_master.itm_unit_code, tbl_item_unit.itm_unit_desc, tbl_item_unit.itm_unit_short_desc,
            (select sum(tbl_order_item.item_quantity) from tbl_order_item 
            where tbl_order_item.ord_code 
            in (select ord_code from tbl_job_order where job_code = '${job_code}') and tbl_order_item.itm_code = tbl_master.itm_code) as item_quantity,
            tbl_petrol.ptrl_code, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_short_desc, 
            case when tbl_order_petrol.ptrl_address is null then tbl_petrol.ptrl_address else tbl_order_petrol.ptrl_address end as ptrl_address, 
            case when tbl_order_petrol.ptrl_zip_code is null then tbl_petrol.ptrl_zip_code else tbl_order_petrol.ptrl_zip_code end as ptrl_zip_code, 
            case when tbl_order_petrol.ptrl_country_code is null then tbl_petrol.ptrl_country_code else tbl_order_petrol.ptrl_country_code end as ptrl_country_code, 
            case when tbl_order_petrol.ptrl_lat is null then tbl_petrol.ptrl_lat else tbl_order_petrol.ptrl_lat end as ptrl_lat, 
            case when tbl_order_petrol.ptrl_lon is null then tbl_petrol.ptrl_lon else tbl_order_petrol.ptrl_lon end as ptrl_lon,
            case when tbl_order_petrol.ptrl_city is null then tbl_petrol.ptrl_city else tbl_order_petrol.ptrl_city end as ptrl_city,
            tbl_petrol.ptrl_unloading_minute, tbl_item.ist_dt, tbl_item.mdf_dt, tbl_item.rm_dt
            from tbl_order_item tbl_master 
            left join tbl_item on tbl_master.itm_code = tbl_item.itm_code
            left join tbl_item_type on tbl_item.itm_type_code = tbl_item_type.itm_type_code 
            left join tbl_item_unit on tbl_item.itm_unit_code = tbl_item_unit.itm_unit_code 
            left join tbl_order_depot on tbl_master.ord_code = tbl_order_depot.ord_code
            left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code
            left join tbl_order_petrol on tbl_master.ord_code = tbl_order_petrol.ord_code
            left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code 
            where tbl_master.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') 
            and tbl_master.ord_item_flag = '1' and tbl_order_depot.ord_depot_flag = '1' and tbl_order_petrol.ord_petrol_flag = '1' 

            group by tbl_order_depot.dpo_code, tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_depot.dpo_short_desc, tbl_depot.dpo_address,
            tbl_order_depot.dpo_address,tbl_depot.dpo_zip_code,tbl_order_depot.dpo_zip_code,tbl_depot.dpo_country_code,tbl_order_depot.dpo_country_code,
            tbl_depot.dpo_lat, tbl_order_depot.dpo_lat, tbl_depot.dpo_lon, tbl_order_depot.dpo_lon, tbl_order_depot.dpo_city, tbl_depot.dpo_loading_minute,
            tbl_petrol.ptrl_code, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_short_desc, 
            tbl_petrol.ptrl_address, tbl_petrol.ptrl_zip_code,tbl_petrol.ptrl_country_code, tbl_petrol.ptrl_lat, tbl_petrol.ptrl_lon, 
            tbl_order_petrol.ptrl_address, tbl_order_petrol.ptrl_zip_code,tbl_order_petrol.ptrl_country_code, tbl_order_petrol.ptrl_lat, tbl_order_petrol.ptrl_lon, 
            tbl_order_petrol.ptrl_city, tbl_petrol.ptrl_unloading_minute, tbl_item.ist_dt, tbl_item.mdf_dt, 
            tbl_item.rm_dt, tbl_depot.dpo_city, tbl_petrol.ptrl_city, tbl_master.itm_code, tbl_item.itm_desc, tbl_item.itm_short_desc, 
            tbl_item.itm_image, tbl_item.itm_material_number, tbl_item_type.itm_type_code, tbl_master.item_quantity, 
            tbl_item_type.itm_type_desc, tbl_master.itm_unit_code, tbl_item_unit.itm_unit_desc, tbl_item_unit.itm_unit_short_desc

            order by tbl_master.itm_code asc`

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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Job Item', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Job Item', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

exports.getJobItemWithoutDepotPetrolInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { job_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (job_code == undefined || action == undefined) {
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
            script = `select ROW_NUMBER () OVER (ORDER BY job_code) as row_number,ord_code, shipments_code,job_code, ptrl_tank_code, tnk_number,itm_code,itm_desc,itm_short_desc,itm_image,itm_material_number,itm_type_code,itm_type_desc,itm_unit_code,itm_unit_desc,itm_unit_short_desc,item_quantity 
            from 
            (select tbl_master.ord_code, tbl_order.shipments_code,'${job_code}' as job_code,tbl_master.itm_code, tbl_item.itm_desc, tbl_item.itm_short_desc, tbl_item.itm_image, tbl_item.itm_material_number, tbl_item.itm_type_code,
            tbl_item_type.itm_type_desc, tbl_master.itm_unit_code, tbl_item_unit.itm_unit_desc, tbl_item_unit.itm_unit_short_desc,
            tbl_master.item_quantity, tbl_order_petrol.ptrl_tank_code, tbl_petrol_tank.tnk_number
            from tbl_order_item tbl_master 
            left join tbl_item on tbl_master.itm_code = tbl_item.itm_code
            left join tbl_item_type on tbl_item.itm_type_code = tbl_item_type.itm_type_code 
            left join tbl_item_unit on tbl_item.itm_unit_code = tbl_item_unit.itm_unit_code 
            left join tbl_order on tbl_master.ord_code = tbl_order.ord_code
            left join tbl_order_petrol on tbl_master.ord_code = tbl_order_petrol.ord_code
            and tbl_order_petrol.itm_code = tbl_master.itm_code
            left join tbl_petrol_tank on tbl_order_petrol.ptrl_code = tbl_petrol_tank.ptrl_code 
            and tbl_order_petrol.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code

            where tbl_master.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') 
            and tbl_master.ord_item_flag = '1' 
            group by tbl_master.ord_code, tbl_order.shipments_code,job_code,tbl_master.item_quantity,tbl_master.itm_code,tbl_master.itm_desc,tbl_master.itm_short_desc,tbl_item.itm_image,tbl_item.itm_material_number,
            tbl_item.itm_type_code,tbl_item_type.itm_type_desc,tbl_master.itm_unit_code,tbl_item_unit.itm_unit_desc,tbl_item_unit.itm_unit_short_desc, 
            tbl_item.itm_desc, tbl_item.itm_short_desc, tbl_order_petrol.ptrl_tank_code, tbl_petrol_tank.tnk_number) tbl_xmaster`

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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Job Item', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Job Item', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

exports.getJobDepotInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { job_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (job_code == undefined || action == undefined) {
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
            script = `select '${job_code}' as job_code, tbl_order_depot.dpo_code, tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_depot.dpo_short_desc, 
            case when tbl_order_depot.dpo_address is null then tbl_depot.dpo_address else tbl_order_depot.dpo_address end as dpo_address,
            case when tbl_order_depot.dpo_zip_code is null then tbl_depot.dpo_zip_code else tbl_order_depot.dpo_zip_code end as dpo_zip_code,
            case when tbl_order_depot.dpo_country_code is null then tbl_depot.dpo_country_code else tbl_order_depot.dpo_country_code end as dpo_country_code,
            case when tbl_order_depot.dpo_lat is null then tbl_depot.dpo_lat else tbl_order_depot.dpo_lat end as dpo_lat,
            case when tbl_order_depot.dpo_lon is null then tbl_depot.dpo_lon else tbl_order_depot.dpo_lon end as dpo_lon,
            case when tbl_order_depot.dpo_city is null then tbl_depot.dpo_city else tbl_order_depot.dpo_city end as dpo_city,
            tbl_depot.dpo_loading_minute, tbl_depot.ist_dt, tbl_depot.mdf_dt, 
            tbl_depot.rm_dt
            from tbl_order
            left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code
            left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code
            where tbl_order.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') and tbl_order.ord_flag = '1' and tbl_order_depot.ord_depot_flag = '1'

            group by tbl_order_depot.dpo_code, tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_depot.dpo_short_desc, 
            tbl_depot.dpo_address,tbl_depot.dpo_zip_code, tbl_depot.dpo_country_code, tbl_depot.dpo_lat, tbl_depot.dpo_lon, 
            tbl_order_depot.dpo_address,tbl_order_depot.dpo_zip_code, tbl_order_depot.dpo_country_code, tbl_order_depot.dpo_lat, tbl_order_depot.dpo_lon, 
            tbl_depot.dpo_loading_minute, tbl_depot.ist_dt, tbl_depot.mdf_dt, tbl_order_depot.dpo_city, tbl_depot.dpo_city, 
            tbl_depot.rm_dt`;

            script += ` order by tbl_order_depot.dpo_code asc `

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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

exports.getJobPetrolInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { job_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (job_code == undefined || action == undefined) {
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
            script = `select tbl_order.ord_code, tbl_order_petrol.ptrl_code, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_short_desc, 
            case when tbl_order_petrol.ptrl_address is null then tbl_petrol.ptrl_address else tbl_order_petrol.ptrl_address end as ptrl_address,
            case when tbl_order_petrol.ptrl_zip_code is null then tbl_petrol.ptrl_zip_code else tbl_order_petrol.ptrl_zip_code end as ptrl_zip_code,
            case when tbl_order_petrol.ptrl_country_code is null then tbl_petrol.ptrl_country_code else tbl_order_petrol.ptrl_country_code end as ptrl_country_code,
            case when tbl_order_petrol.ptrl_lat is null then tbl_petrol.ptrl_lat else tbl_order_petrol.ptrl_lat end as ptrl_lat,
            case when tbl_order_petrol.ptrl_lon is null then tbl_petrol.ptrl_lon else tbl_order_petrol.ptrl_lon end as ptrl_lon,
            case when tbl_order_petrol.ptrl_city is null then tbl_petrol.ptrl_city else tbl_order_petrol.ptrl_city end as ptrl_city,
            tbl_petrol.ptrl_unloading_minute, tbl_petrol.ist_dt, tbl_petrol.mdf_dt, 
            tbl_petrol.rm_dt
            from tbl_order
            left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code
            left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
            where tbl_order.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') and tbl_order.ord_flag = '1' and tbl_order_petrol.ord_petrol_flag = '1'

            group by tbl_order.ord_code, tbl_order_petrol.ptrl_code, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_short_desc, 
            tbl_petrol.ptrl_address,tbl_petrol.ptrl_zip_code, tbl_petrol.ptrl_country_code, tbl_petrol.ptrl_lat, tbl_petrol.ptrl_lon, 
            tbl_order_petrol.ptrl_address,tbl_order_petrol.ptrl_zip_code, tbl_order_petrol.ptrl_country_code, tbl_order_petrol.ptrl_lat, tbl_order_petrol.ptrl_lon, 
            tbl_petrol.ptrl_unloading_minute, tbl_petrol.ist_dt, tbl_petrol.mdf_dt, tbl_order_petrol.ptrl_city, tbl_petrol.ptrl_city, 
            tbl_petrol.rm_dt`;

            script += ` order by tbl_order.ord_code asc `

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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

exports.addJobInformationWithPreEvent2Tmp = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            job_code,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
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
            await xglobal.postJob2TmpWithShipment(lic_code, job_code, action);
            let response = [{
                status: 'success',
                invalid_code: '0',
                message: '',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.getJobTMPStatusInformationold = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { job_code, start_date, end_date, transporeon_status, job_status, off_code,
            search, page_index, page_limit, action } = req.body[0];
        page_index == undefined ? page_index = 1 : page_index;
        page_limit == undefined ? page_limit = 10 : page_limit;
        //เช็คเฉพาะส่วนที่สำคัญ
        if (job_code == undefined || start_date == undefined || end_date == undefined
            || transporeon_status == undefined || search == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            if (job_status == undefined) {
                job_status = 'ALL';
            }

            let script = ``;
            if (page_index > 0) {
                page_index -= 1;
            }

            if (start_date.length == 10) {
                start_date = start_date + ' 00:00:00'
            }

            if (end_date.length == 10) {
                end_date = end_date + ' 23:59:59'
            }

            if (job_code.toString().toUpperCase() != 'ALL') {
                script = `select 
                job_code, tms_transport_code, transport_code, tour_code, pull_code, number, document_reference, 
                job_dt, job_status, job_comment, gsap_order_type_code, gsap_order_status, gsap_order_number, 
                case when gsap_shipments_number is null then '' else gsap_shipments_number end as gsap_shipments_number, case when job_status = '-2' then 'N' else transporeon_status end as transporeon_status, off_code, job_flag, ist_dt, mdf_dt, rm_dt, loading_count, 
                unloading_count, item_count, item_quantity, dver_code, veh_code, transporeon_result, transporeon_ist_dt, transporeon_mdf_dt, 
                transporeon_rm_dt, distance, transit_start_dt, transit_end_dt, transit_minute 
                from tbl_job where tbl_job.job_flag = '1' and tbl_job.job_code = '${job_code}'`;
            }
            else {
                script = `select 
                job_code, tms_transport_code, transport_code, tour_code, pull_code, number, document_reference, 
                job_dt, job_status, job_comment, gsap_order_type_code, gsap_order_status, gsap_order_number, 
                case when gsap_shipments_number is null then '' else gsap_shipments_number end as gsap_shipments_number, case when job_status = '-2' then 'N' else transporeon_status end as transporeon_status, off_code, job_flag, ist_dt, mdf_dt, rm_dt, loading_count, 
                unloading_count, item_count, item_quantity, dver_code, veh_code, transporeon_result, transporeon_ist_dt, transporeon_mdf_dt, 
                transporeon_rm_dt, distance, transit_start_dt, transit_end_dt, transit_minute 
                from tbl_job where tbl_job.job_flag = '1'`;
            }

            if (off_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_job.off_code = '${off_code}' `
            }

            //job_status
            if (job_status.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_job.job_status = '${job_status}' `
            }

            if (transporeon_status.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_job.transporeon_status = '${transporeon_status}' `
            }
            else {
                script += ` and tbl_job.transporeon_status in ('WA','A','D') and job_status != '-2' `
            }

            if (search != '') {
                script += ` and (tbl_job.tms_transport_code like '%${search}%' 
                or tbl_job.transport_code like '%${search}%' 
                or tbl_job.tour_code like '%${search}%' 
                or tbl_job.document_reference like '%${search}%')`
            }

            script += ` order by tbl_job.tms_transport_code asc `
            script += ` offset (${page_index}*${page_limit}) limit ${page_limit};`

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                    let page_total = 0;
                    let rows_total = 0;
                    script = ``
                    if (job_code.toString().toUpperCase() != 'ALL') {
                        script = `select ceil((ceil(count(tbl_job.job_code)) / ${page_limit})) as page_total, (count(tbl_job.job_code)) as rows_total 
                        from tbl_job where tbl_job.job_flag = '1' and tbl_job.job_code = '${job_code}' `;
                    }
                    else {
                        script = `select ceil((ceil(count(tbl_job.job_code)) / ${page_limit})) as page_total, (count(tbl_job.job_code)) as rows_total 
                        from tbl_job where tbl_job.job_flag = '1' `;
                    }

                    if (off_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_job.off_code = '${off_code}' `
                    }

                    //job_status
                    if (job_status.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_job.job_status = '${job_status}' `
                    }

                    if (transporeon_status.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_job.transporeon_status = '${transporeon_status}' `
                    }
                    else {
                        script += ` and tbl_job.transporeon_status in ('WA','A','D') `
                    }

                    if (search != '') {
                        script += ` and (tbl_job.tms_transport_code like '%${search}%' 
                        or tbl_job.transport_code like '%${search}%' 
                        or tbl_job.tour_code like '%${search}%' 
                        or tbl_job.document_reference like '%${search}%')`
                    }

                    let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

                    if (!tbl_temporary0.code) {
                        if (tbl_temporary0.data.length > 0) {
                            page_total = parseInt(tbl_temporary0.data[0].page_total);
                            rows_total = parseInt(tbl_temporary0.data[0].rows_total);
                        }
                    }

                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: tbl_temporary.data,
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss'),
                        page_total: (page_total <= 0 ? 1 : page_total),
                        rows_total: rows_total
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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}
exports.getJobTMPStatusInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { job_code, start_date, end_date, transporeon_status, job_status, off_code,
            search, page_index, page_limit, ptrl_group_code, veh_group_code, action } = req.body[0];
        page_index == undefined ? page_index = 1 : page_index;
        page_limit == undefined ? page_limit = 10 : page_limit;
        //เช็คเฉพาะส่วนที่สำคัญ
        if (job_code == undefined || start_date == undefined || end_date == undefined
            || transporeon_status == undefined || search == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            if (job_status == undefined) {
                job_status = 'ALL';
            }

            let script = ``;
            if (page_index > 0) {
                page_index -= 1;
            }

            if (start_date.length == 10) {
                start_date = start_date + ' 00:00:00'
            }

            if (end_date.length == 10) {
                end_date = end_date + ' 23:59:59'
            }

            if (ptrl_group_code == undefined) {
                ptrl_group_code = 'ALL';
            }
            if (veh_group_code == undefined) {
                veh_group_code = 'ALL';
            }

            if (job_code.toString().toUpperCase() != 'ALL') {
                script = `select 
                tbl_job.job_code, tms_transport_code, transport_code, tour_code, pull_code, number, document_reference, 
                job_dt, job_status, job_comment, gsap_order_type_code, gsap_order_status, 
                case when (substring((select ARRAY_AGG(gsap_order_number) from tbl_order 
                where ord_code in (select ord_code from tbl_job_order xjoborder where xjoborder.job_code = tbl_job.job_code)) :: varchar(255),2,
                length((select ARRAY_AGG(gsap_order_number) from tbl_order 
                where ord_code in (select ord_code from tbl_job_order xjoborder where xjoborder.job_code = tbl_job.job_code)) :: varchar(255)) - 2) = 'NULL') 
                or 
                (substring((select ARRAY_AGG(gsap_order_number) from tbl_order 
                where ord_code in (select ord_code from tbl_job_order xjoborder where xjoborder.job_code = tbl_job.job_code)) :: varchar(255),2,
                length((select ARRAY_AGG(gsap_order_number) from tbl_order 
                where ord_code in (select ord_code from tbl_job_order xjoborder where xjoborder.job_code = tbl_job.job_code)) :: varchar(255)) - 2) = 'NULL,NULL') 
                or 
                (substring((select ARRAY_AGG(gsap_order_number) from tbl_order 
                where ord_code in (select ord_code from tbl_job_order xjoborder where xjoborder.job_code = tbl_job.job_code)) :: varchar(255),2,
                length((select ARRAY_AGG(gsap_order_number) from tbl_order 
                where ord_code in (select ord_code from tbl_job_order xjoborder where xjoborder.job_code = tbl_job.job_code)) :: varchar(255)) - 2) = 'NULL,NULL,NULL') 

                then '' 
                else substring((select ARRAY_AGG(gsap_order_number) from tbl_order 
                where ord_code in (select ord_code from tbl_job_order xjoborder where xjoborder.job_code = tbl_job.job_code)) :: varchar(255),2,
                length((select ARRAY_AGG(gsap_order_number) from tbl_order 
                where ord_code in (select ord_code from tbl_job_order xjoborder where xjoborder.job_code = tbl_job.job_code)) :: varchar(255)) - 2) end as gsap_order_number, 
                case when gsap_shipments_number is null then '' else gsap_shipments_number end as gsap_shipments_number, case when job_status = '-2' then 'N' else transporeon_status end as transporeon_status, tbl_job.off_code, job_flag, tbl_job.ist_dt,tbl_job.mdf_dt, tbl_job.rm_dt, loading_count, 
                unloading_count, item_count, tbl_job.item_quantity, dver_code, tbl_job.veh_code, transporeon_result, transporeon_ist_dt, transporeon_mdf_dt, 
                transporeon_rm_dt, tbl_job.distance, transit_start_dt, transit_end_dt, transit_minute 
                from tbl_job 
                left join tbl_vehicle on tbl_job.veh_code = tbl_vehicle.veh_code 
                left join tbl_job_order on tbl_job_order.job_code = tbl_job.job_code
                left join tbl_order_petrol on tbl_job_order.ord_code = tbl_order_petrol.ord_code
                left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
                where tbl_job.job_flag = '1' and tbl_job.job_code = '${job_code}'`;
            }
            else {
                script = `select 
                tbl_job.job_code, tms_transport_code, transport_code, tour_code, pull_code, number, document_reference, 
                job_dt, job_status, job_comment, gsap_order_type_code, gsap_order_status, 
                case when (substring((select ARRAY_AGG(gsap_order_number) from tbl_order 
                where ord_code in (select ord_code from tbl_job_order xjoborder where xjoborder.job_code = tbl_job.job_code)) :: varchar(255),2,
                length((select ARRAY_AGG(gsap_order_number) from tbl_order 
                where ord_code in (select ord_code from tbl_job_order xjoborder where xjoborder.job_code = tbl_job.job_code)) :: varchar(255)) - 2) = 'NULL') 
                or 
                (substring((select ARRAY_AGG(gsap_order_number) from tbl_order 
                where ord_code in (select ord_code from tbl_job_order xjoborder where xjoborder.job_code = tbl_job.job_code)) :: varchar(255),2,
                length((select ARRAY_AGG(gsap_order_number) from tbl_order 
                where ord_code in (select ord_code from tbl_job_order xjoborder where xjoborder.job_code = tbl_job.job_code)) :: varchar(255)) - 2) = 'NULL,NULL') 
                or 
                (substring((select ARRAY_AGG(gsap_order_number) from tbl_order 
                where ord_code in (select ord_code from tbl_job_order xjoborder where xjoborder.job_code = tbl_job.job_code)) :: varchar(255),2,
                length((select ARRAY_AGG(gsap_order_number) from tbl_order 
                where ord_code in (select ord_code from tbl_job_order xjoborder where xjoborder.job_code = tbl_job.job_code)) :: varchar(255)) - 2) = 'NULL,NULL,NULL') 

                then '' 
                else substring((select ARRAY_AGG(gsap_order_number) from tbl_order 
                where ord_code in (select ord_code from tbl_job_order xjoborder where xjoborder.job_code = tbl_job.job_code)) :: varchar(255),2,
                length((select ARRAY_AGG(gsap_order_number) from tbl_order 
                where ord_code in (select ord_code from tbl_job_order xjoborder where xjoborder.job_code = tbl_job.job_code)) :: varchar(255)) - 2) end as gsap_order_number, 
                case when gsap_shipments_number is null then '' else gsap_shipments_number end as gsap_shipments_number, case when job_status = '-2' then 'N' else transporeon_status end as transporeon_status, tbl_job.off_code, job_flag, tbl_job.ist_dt,tbl_job.mdf_dt, tbl_job.rm_dt, loading_count, 
                unloading_count, item_count, tbl_job.item_quantity, dver_code, tbl_job.veh_code, transporeon_result, transporeon_ist_dt, transporeon_mdf_dt, 
                transporeon_rm_dt, tbl_job.distance, transit_start_dt, transit_end_dt, transit_minute 
                from tbl_job 
                left join tbl_vehicle on tbl_job.veh_code = tbl_vehicle.veh_code
                left join tbl_job_order on tbl_job_order.job_code = tbl_job.job_code
                left join tbl_order_petrol on tbl_job_order.ord_code = tbl_order_petrol.ord_code
                left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
                where tbl_job.job_flag = '1'`;
            }

            if (off_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_job.off_code = '${off_code}' `
            }
            if (start_date.toString().toUpperCase() != 'ALL' && end_date.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_job.job_dt >= '${start_date}' and tbl_job.job_dt <= '${end_date}'`
            }


            //job_status
            if (job_status.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_job.job_status = '${job_status}' `
            }

            if (transporeon_status.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_job.transporeon_status = '${transporeon_status}' `
            }
            else {
                script += ` and tbl_job.transporeon_status in ('WA','A','D') and job_status != '-2' `
            }

            if (ptrl_group_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_petrol.ptrl_group_code = '${ptrl_group_code}' `
            }
            if (veh_group_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_vehicle.veh_group_code = '${veh_group_code}' `
            }

            if (search != '') {
                script += ` and (tbl_job.tms_transport_code like '%${search}%' 
                or tbl_job.transport_code like '%${search}%' 
                or tbl_job.tour_code like '%${search}%' 
                or tbl_job.document_reference like '%${search}%')`
            }

            script += ` Group by  tbl_job.job_code, tms_transport_code, transport_code, tour_code, pull_code, number, document_reference, 
                job_dt, job_status, job_comment, gsap_order_type_code, gsap_order_status, gsap_order_number, 
                gsap_shipments_number,job_status, tbl_job.off_code, job_flag, tbl_job.ist_dt, tbl_job.mdf_dt, tbl_job.rm_dt, loading_count, 
                unloading_count, item_count, tbl_job.item_quantity, dver_code, tbl_job.veh_code, transporeon_result, transporeon_ist_dt, transporeon_mdf_dt, 
                transporeon_rm_dt, tbl_job.distance, transit_start_dt, transit_end_dt, transit_minute  `

            script += ` order by tbl_job.tms_transport_code asc `
            script += ` offset (${page_index}*${page_limit}) limit ${page_limit};`

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                    let page_total = 0;
                    let rows_total = 0;
                    script = `select 
                    ceil(count(distinct tbl_job.job_code) * 1.0 / ${page_limit}) as page_total,
                    count(distinct tbl_job.job_code) as rows_total
                    from tbl_job 
                    left join tbl_vehicle on tbl_job.veh_code = tbl_vehicle.veh_code
                    left join tbl_job_order on tbl_job_order.job_code = tbl_job.job_code
                    left join tbl_order_petrol on tbl_job_order.ord_code = tbl_order_petrol.ord_code
                    left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
                    where tbl_job.job_flag = '1'
                    and (${job_code.toString().toUpperCase() != 'ALL' ? `tbl_job.job_code = '${job_code}'` : '1=1'})
                    ${off_code.toString().toUpperCase() != 'ALL' ? `and tbl_job.off_code = '${off_code}'` : ''}
                    ${(start_date.toString().toUpperCase() != 'ALL' && end_date.toString().toUpperCase() != 'ALL') ? ` and tbl_job.job_dt >= '${start_date}' and tbl_job.job_dt <= '${end_date}'` : ''}
                    ${job_status.toString().toUpperCase() != 'ALL' ? `and tbl_job.job_status = '${job_status}'` : ''}
                    ${transporeon_status.toString().toUpperCase() != 'ALL'
                            ? `and tbl_job.transporeon_status = '${transporeon_status}'`
                            : `and tbl_job.transporeon_status in ('WA','A','D') and job_status != '-2'`}
                    ${ptrl_group_code.toString().toUpperCase() != 'ALL' ? `and tbl_petrol.ptrl_group_code = '${ptrl_group_code}'` : ''}
                    ${veh_group_code.toString().toUpperCase() != 'ALL' ? `and tbl_vehicle.veh_group_code = '${veh_group_code}'` : ''}
                    ${search != '' ? `and (tbl_job.tms_transport_code like '%${search}%' 
                                            or tbl_job.transport_code like '%${search}%' 
                                            or tbl_job.tour_code like '%${search}%' 
                                            or tbl_job.document_reference like '%${search}%')` : ''}
                    `;

                    let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

                    if (!tbl_temporary0.code) {
                        if (tbl_temporary0.data.length > 0) {
                            page_total = parseInt(tbl_temporary0.data[0].page_total);
                            rows_total = parseInt(tbl_temporary0.data[0].rows_total);
                        }
                    }

                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: tbl_temporary.data,
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss'),
                        page_total: (page_total <= 0 ? 1 : page_total),
                        rows_total: rows_total
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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.setAceptJobTMPStatusInformation = async (req, res, next) => {

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

            if (job_code == '') {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง job_code ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ยืนยัน Acept Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง job_code ไม่รองรับค่าว่าง', action[0].value);
                return;
            }

            script = `update tbl_job set
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}', 
            transporeon_status = 'A' 
            where job_code = '${job_code}';`

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

                var xtmp_status = await xglobal.postAcceptJob2Tmp(lic_code, job_code);

                if (xtmp_status == true) {
                    await xglobal.action_logs(lic_code, action[0].id, job_code + ' Accept TMP ' + xtmp_status, JSON.stringify(req.body[0]), 'success', action[0].value);
                }
                else {
                    await xglobal.action_logs(lic_code, action[0].id, job_code + ' Accept TMP ' + xtmp_status, JSON.stringify(req.body[0]), 'success', action[0].value);
                }

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ยืนยัน Acept Order', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ยืนยัน Acept Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ยืนยัน Acept Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.setDeclineJobTMPStatusInformation = async (req, res, next) => {

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

            if (job_code == '') {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง job_code ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ยืนยัน Decline Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง job_code ไม่รองรับค่าว่าง', action[0].value);
                return;
            }

            script = `update tbl_job set
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}', 
            transporeon_status = 'D' 
            where job_code = '${job_code}';`

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

                var xtmp_status = await xglobal.postDeclineJob2Tmp(lic_code, job_code);

                if (xtmp_status == true) {
                    await xglobal.action_logs(lic_code, action[0].id, job_code + ' Decline TMP Complete', JSON.stringify(req.body[0]), 'success', action[0].value);
                }
                else {
                    await xglobal.action_logs(lic_code, action[0].id, job_code + ' Decline TMP Reject', JSON.stringify(req.body[0]), 'success', action[0].value);
                }

                res.status(200).send(response);


                await xglobal.action_logs(lic_code, action[0].id, 'ยืนยัน Decline Order', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ยืนยัน Decline Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ยืนยัน Decline Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.closeJobInformationWithPreEvent2Tmp = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            job_code,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
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
            let xdata = await xglobal.postBeforeCloseDischargedJob2Tmp(lic_code, job_code);
            let response = [{
                status: 'success',
                invalid_code: '0',
                message: '',
                data: xdata,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.setAssignJobsJobInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            job_code,
            dver_code,
            veh_code,
            item,
            action
        } = req.body[0];

        if (job_code == undefined || action == undefined || dver_code == undefined || veh_code == undefined || item == undefined) {
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
            console.log(JSON.stringify(req.body[0]));

            if (item.length <= 0) {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง item ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'กำหนดแผนงานข้อมูล Job:setAssignJobsJobInformation', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง item ไม่รองรับค่าว่าง', action[0].value);
                return;
            }

            script = `update tbl_job set
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
            job_status = '2', 
            dver_code = '${dver_code}',
            veh_code = '${veh_code}'
            where job_code = '${job_code}';`

            script = script.replace(/'NULL'/gi, "NULL")
            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

            script = `delete from tbl_order_compartment where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}');`
            tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            debugger

            if (!tbl_temporary.code) {
                debugger
                script = `update tbl_order set
                mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}',
                ord_status = '2', 
                dver_code = '${dver_code}',
                veh_code = '${veh_code}'
                where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}');`

                let tbl_temporary0x = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                if (!tbl_temporary0x.code) {
                    debugger
                    for (var xitm = 0; xitm <= item.length - 1; xitm++) {
                        let ord_veh_compartment_code = 'jvhc-' + moment().format('x');
                        script = `insert into tbl_order_compartment (ord_veh_compartment_code, ord_code, itm_code, itm_unit_code, item_quantity, 
                        ord_veh_compartment_flag, ist_dt, mdf_dt, rm_dt, veh_compartment_code) 
                        values ('${ord_veh_compartment_code}', '${item[xitm].ord_code}', '${item[xitm].itm_code}', '${item[xitm].itm_unit_code}', 
                        ${item[xitm].item_quantity}, '1', 
                        '${moment().format('YYYY-MM-DD HH:mm:ss')}', NULL, NULL, '${item[xitm].veh_compartment_code}');`

                        debugger
                        let tbl_temporary01x = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                        if (xitm == item.length - 1) {
                            //debugger
                            let response = [{
                                status: 'success',
                                invalid_code: '0',
                                message: '',
                                data: [],
                                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                            }]

                            var xtmp_status = await xglobal.postJob2TmpWithShipment(lic_code, job_code, action);
                            if (xtmp_status == true) {
                                await xglobal.action_logs(lic_code, action[0].id, job_code + ' TMP Complete', JSON.stringify(req.body[0]), 'success', action[0].value);
                            }
                            else {
                                await xglobal.action_logs(lic_code, action[0].id, job_code + ' TMP Reject', JSON.stringify(req.body[0]), 'success', action[0].value);
                            }

                            res.status(200).send(response);
                            await xglobal.action_logs(lic_code, action[0].id, 'กำหนดแผนงานข้อมูล Job:setAssignJobsJobInformation', JSON.stringify(req.body[0]), 'success', action[0].value);
                            return;
                        }


                    }
                }
                else {
                    let response = [{
                        status: 'error',
                        invalid_code: '-5',
                        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]
                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, '', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'กำหนดแผนงานข้อมูล Job:setAssignJobsJobInformation', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'กำหนดแผนงานข้อมูล Job:setAssignJobsJobInformation', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.setJobDepotInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { job_code, dpo_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (job_code == undefined || dpo_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let script = `update tbl_order_depot set dpo_code = '${dpo_code}' 
            where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}')`;

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เปลี่ยนแปลงข้อมูลคลังน้ำมัน', JSON.stringify(req.body[0]), 'success', action[0].value);
                return;
            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถอัพเดทข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เปลี่ยนแปลงข้อมูลคลังน้ำมัน', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'เปลี่ยนแปลงข้อมูลคลังน้ำมัน', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

exports.setGSapInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { job_code, gsap_shipments_number, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (job_code == undefined || gsap_shipments_number == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            let script = `update tbl_job set gsap_shipments_number = '${gsap_shipments_number}' where 
            job_code = '${job_code}' 
            and (gsap_shipments_number = '' or gsap_shipments_number is null)`;

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'อัพเดทข้อมูล gsap_shipments_number ', JSON.stringify(req.body[0]), 'success', action[0].value);
                return;
            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถอัพเดทข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เปลี่ยนแปลงข้อมูลคลังน้ำมัน', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'เปลี่ยนแปลงข้อมูลคลังน้ำมัน', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}