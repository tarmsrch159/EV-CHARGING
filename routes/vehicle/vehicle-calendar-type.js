const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

// Success
exports.getVehicleTypeCalendarInformation = async (req, res, next) => {
    var xresult = [];
    let lic_code = req.header('lic_code');
    let action_data = req.body[0] ? req.body[0].action : undefined;

    return (async () => {
        if (!req.body[0] || lic_code == undefined || action_data == undefined) {
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

        let { veh_type_calendar_code, veh_type_code, month, year, page_index, page_limit } = req.body[0];
        page_limit = page_limit == undefined ? 10 : page_limit;
        page_index = page_index == undefined ? 1 : page_index;

        if (page_index > 0) {
            page_index -= 1;
        }

        if (veh_type_calendar_code == undefined || veh_type_code == undefined) {
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

        let script = `select 
            tc.veh_type_calendar_code, 
            tc.veh_type_code, 
            vt.veh_type_desc,
            tc.veh_qty_unavailable, 
            tc.unavailable_date, 
            tc.remark,
            tc.flag, 
            tc.ist_dt, 
            tc.mdf_dt, 
            tc.rm_dt 
            from tbl_vehicle_type_calendar tc
            left join tbl_vehicle_type vt on tc.veh_type_code = vt.veh_type_code
            where tc.flag = '1'`;

        if (veh_type_calendar_code.toString().toUpperCase() != 'ALL') {
            script += ` and tc.veh_type_calendar_code = '${veh_type_calendar_code}'`;
        }

        if (veh_type_code.toString().toUpperCase() != 'ALL') {
            script += ` and tc.veh_type_code = '${veh_type_code}'`;
        }

        if (month != undefined && month != '') {
            script += ` and extract(month from tc.unavailable_date::date) = '${month}'`;
        }

        if (year != undefined && year != '') {
            let filterYear = year;
            if (parseInt(year) > 2400) {
                filterYear = parseInt(year) - 543;
            }
            script += ` and extract(year from tc.unavailable_date::date) = '${filterYear}'`;
        }


        script += ` order by tc.ist_dt desc`;
        script += ` limit ${page_limit} offset ${page_index * page_limit}`;

        let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
        if (!tbl_temporary.code) {
            if (tbl_temporary.data.length > 0) {
                tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                let countScript = `select 
                    count(*) as rows_total,
                    ceil(count(tc.veh_type_calendar_code)::numeric / ${page_limit}) as page_total
                    from tbl_vehicle_type_calendar tc
                    where tc.flag = '1'`;

                if (veh_type_calendar_code.toString().toUpperCase() != 'ALL') {
                    countScript += ` and tc.veh_type_calendar_code = '${veh_type_calendar_code}'`;
                }

                if (veh_type_code.toString().toUpperCase() != 'ALL') {
                    countScript += ` and tc.veh_type_code = '${veh_type_code}'`;
                }

                if (month != undefined && month != '') {
                    countScript += ` and extract(month from tc.unavailable_date::date) = '${month}'`;
                }

                if (year != undefined && year != '') {
                    let filterYear = year;
                    if (parseInt(year) > 2400) {
                        filterYear = parseInt(year) - 543;
                    }
                    countScript += ` and extract(year from tc.unavailable_date::date) = '${filterYear}'`;
                }



                let tbl_temporary_count = await pgConn.get(dbPrefix + lic_code, countScript, config.connectionString());
                let page_total = 0;
                let rows_total = 0;

                if (!tbl_temporary_count.code && tbl_temporary_count.data.length > 0) {
                    page_total = parseInt(tbl_temporary_count.data[0].page_total);
                    rows_total = parseInt(tbl_temporary_count.data[0].rows_total);
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
            await xglobal.action_logs(lic_code, action_data[0].id, 'ดึงข้อมูลปฏิทินประเภทรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action_data[0].value);
            return;
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
        if (lic_code && action_data && action_data[0]) {
            await xglobal.action_logs(lic_code, action_data[0].id, 'ดึงข้อมูลปฏิทินประเภทรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action_data[0].value);
        }
        return;
    });
}

// Success
exports.removeVehicleTypeCalendarInformation = async (req, res, next) => {
    let lic_code = req.header('lic_code');
    let action_data = req.body[0] ? req.body[0].action : undefined;

    return (async () => {
        if (!req.body[0] || lic_code == undefined || action_data == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return;
        }

        let { veh_type_calendar_code } = req.body[0];
        if (veh_type_calendar_code == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return;
        }

        let script = `update tbl_vehicle_type_calendar set flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' where veh_type_calendar_code = '${veh_type_calendar_code}';`

        let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
        if (!tbl_temporary.code) {
            let response = [{
                status: 'success',
                invalid_code: '0',
                message: '',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action_data[0].id, 'ลบข้อมูลปฏิทินประเภทรถ', JSON.stringify(req.body[0]), 'success', action_data[0].value);
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
            await xglobal.action_logs(lic_code, action_data[0].id, 'ลบข้อมูลปฏิทินประเภทรถ', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action_data[0].value);
            return;
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
        if (lic_code && action_data && action_data[0]) {
            await xglobal.action_logs(lic_code, action_data[0].id, 'ลบข้อมูลปฏิทินประเภทรถ', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action_data[0].value);
        }
        return;
    });
}

// Success
exports.setVehicleTypeCalendarInformation = async (req, res, next) => {
    let lic_code = req.header('lic_code');
    let action_data = req.body[0] ? req.body[0].action : undefined;
    let { veh_type_calendar_code } = req.query;

    return (async () => {
        if (!req.body[0] || lic_code == undefined || action_data == undefined || veh_type_calendar_code == undefined) {
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

        let { veh_qty_unavailable, action } = req.body[0];

        if (veh_qty_unavailable == undefined || action == undefined) {
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

        let script = `update tbl_vehicle_type_calendar set
            veh_qty_unavailable = ${veh_qty_unavailable},
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where veh_type_calendar_code = '${veh_type_calendar_code}';`

        let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
        if (!tbl_temporary.code) {
            let response = [{
                status: 'success',
                invalid_code: '0',
                message: '',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action_data[0].id, 'แก้ไขข้อมูลปฏิทินประเภทรถ', JSON.stringify(req.body[0]), 'success', action_data[0].value);
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
            await xglobal.action_logs(lic_code, action_data[0].id, 'แก้ไขข้อมูลปฏิทินประเภทรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action_data[0].value);
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
        if (lic_code && action_data && action_data[0]) {
            await xglobal.action_logs(lic_code, action_data[0].id, 'แก้ไขข้อมูลปฏิทินประเภทรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action_data[0].value);
        }
        return;
    });
}

// Success
exports.addVehicleTypeCalendarInformation = async (req, res, next) => {
    let lic_code = req.header('lic_code');
    let action_data = req.body[0] ? req.body[0].action : undefined;

    return (async () => {
        if (!req.body[0] || lic_code == undefined || action_data == undefined) {
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

        let { veh_type_code, veh_qty_unavailable, unavailable_date, remark } = req.body[0];

        if (veh_type_code == undefined || veh_qty_unavailable == undefined || unavailable_date == undefined) {
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

        // Check Duplicate
        let checkScript = `select veh_type_calendar_code from tbl_vehicle_type_calendar 
            where veh_type_code = '${veh_type_code}' and flag = '1' 
            and unavailable_date = '${unavailable_date}';`

        let tbl_check = await pgConn.get(dbPrefix + lic_code, checkScript, config.connectionString());
        if (!tbl_check.code && tbl_check.data.length > 0) {
            let response = [{
                status: 'error',
                invalid_code: '-4',
                message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ`,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action_data[0].id, 'เพิ่มข้อมูลปฏิทินประเภทรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ', action_data[0].value);
            return;
        }

        let veh_type_calendar_code = 'vtcl-' + moment().format('x');
        let script = `insert into tbl_vehicle_type_calendar 
        (veh_type_calendar_code, veh_type_code, veh_qty_unavailable, unavailable_date, remark, flag, ist_dt) values 
        ('${veh_type_calendar_code}', '${veh_type_code}', ${veh_qty_unavailable}, '${unavailable_date}', '${remark}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}');`

        let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
        if (!tbl_temporary.code) {
            let response = [{
                status: 'success',
                invalid_code: '0',
                message: '',
                data: [{
                    veh_type_calendar_code: veh_type_calendar_code
                }],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action_data[0].id, 'เพิ่มข้อมูลปฏิทินประเภทรถ', JSON.stringify(req.body[0]), 'success', action_data[0].value);
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
            await xglobal.action_logs(lic_code, action_data[0].id, 'เพิ่มข้อมูลปฏิทินประเภทรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action_data[0].value);
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
        if (lic_code && action_data && action_data[0]) {
            await xglobal.action_logs(lic_code, action_data[0].id, 'เพิ่มข้อมูลปฏิทินประเภทรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action_data[0].value);
        }
        return;
    });
}
