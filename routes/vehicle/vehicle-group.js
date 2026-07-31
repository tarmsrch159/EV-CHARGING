const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
//Success
exports.getVehicleGroupTableInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        let { veh_group_code, off_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_group_code == undefined || off_code == undefined || lic_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return;
        } else {

            let script = ``;
            if (veh_group_code.toString().toUpperCase() != 'ALL') {
                script = `select veh_group_code, veh_group_desc, veh_group_flag, tbl_vehicle_group.off_code, tbl_office.off_desc, 
                tbl_vehicle_group.ist_dt, tbl_vehicle_group.mdf_dt, tbl_vehicle_group.rm_dt,
                (select count(dpo_code) from tbl_vehicle_group_depot where tbl_vehicle_group_depot.veh_group_code = tbl_vehicle_group.veh_group_code) :: integer as dpo_count,
                (select count(veh_code) from tbl_vehicle where tbl_vehicle.veh_group_code = tbl_vehicle_group.veh_group_code) :: integer as veh_count
                from tbl_vehicle_group 
                left join tbl_office on tbl_vehicle_group.off_code = tbl_office.off_code
                where veh_group_flag = '1' and veh_group_code = '${veh_group_code}'`;
            }
            else {
                script = ` select veh_group_code, veh_group_desc, veh_group_flag, tbl_vehicle_group.off_code, tbl_office.off_desc, 
                tbl_vehicle_group.ist_dt, tbl_vehicle_group.mdf_dt, tbl_vehicle_group.rm_dt,
                (select count(dpo_code) from tbl_vehicle_group_depot where tbl_vehicle_group_depot.veh_group_code = tbl_vehicle_group.veh_group_code) :: integer as dpo_count,
                (select count(veh_code) from tbl_vehicle where tbl_vehicle.veh_group_code = tbl_vehicle_group.veh_group_code) :: integer as veh_count
                from tbl_vehicle_group 
                left join tbl_office on tbl_vehicle_group.off_code = tbl_office.off_code
                where veh_group_flag = '1'`;
            }

            if (off_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_vehicle_group.off_code = '${off_code}'`
            }

            script += `  order by tbl_vehicle_group.ist_dt desc;`

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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลกลุ่มรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลกลุ่มรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.getVehicleGroupInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        let { veh_group_code, off_code, action, page_index, page_limit } = req.body[0];
        page_index = page_index == undefined ? 1 : page_index;
        page_limit = page_limit == undefined ? 10 : page_limit;
        if (page_index > 0) {
            page_index -= 1;
        }
        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_group_code == undefined || off_code == undefined || lic_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return;
        } else {

            let script = ``;
            if (veh_group_code.toString().toUpperCase() != 'ALL') {
                script = `select veh_group_code, veh_group_desc, veh_group_flag, tbl_vehicle_group.off_code, tbl_office.off_desc, 
                tbl_vehicle_group.ist_dt, tbl_vehicle_group.mdf_dt, tbl_vehicle_group.rm_dt,
                case when tbl_vehicle_group.veh_yard_desc is null then '' else tbl_vehicle_group.veh_yard_desc end as veh_yard_desc,
                case when tbl_vehicle_group.veh_yard_lat is null then 0.0 else tbl_vehicle_group.veh_yard_lat end as veh_yard_lat,
                case when tbl_vehicle_group.veh_yard_lon is null then 0.0 else tbl_vehicle_group.veh_yard_lon end as veh_yard_lon  
                from tbl_vehicle_group 
                left join tbl_office on tbl_vehicle_group.off_code = tbl_office.off_code
                where veh_group_flag = '1' and veh_group_code = '${veh_group_code}'`;
            }
            else {
                script = `select veh_group_code, veh_group_desc, veh_group_flag, tbl_vehicle_group.off_code, tbl_office.off_desc, 
                tbl_vehicle_group.ist_dt, tbl_vehicle_group.mdf_dt, tbl_vehicle_group.rm_dt,
                case when tbl_vehicle_group.veh_yard_desc is null then '' else tbl_vehicle_group.veh_yard_desc end as veh_yard_desc,
                case when tbl_vehicle_group.veh_yard_lat is null then 0.0 else tbl_vehicle_group.veh_yard_lat end as veh_yard_lat,
                case when tbl_vehicle_group.veh_yard_lon is null then 0.0 else tbl_vehicle_group.veh_yard_lon end as veh_yard_lon  
                from tbl_vehicle_group 
                left join tbl_office on tbl_vehicle_group.off_code = tbl_office.off_code
                where veh_group_flag = '1'`;
            }

            if (off_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_vehicle_group.off_code = '${off_code}'`
            }

            script += `  order by tbl_vehicle_group.ist_dt desc`
            script += ` offset (${page_index}*${page_limit}) limit ${page_limit};`

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));
                    let page_total = 0;
                    let rows_total = 0;

                    if (veh_group_code.toString().toUpperCase() != 'ALL') {
                        script = `select count(*) as rows_total,
                        ceil((ceil(count(veh_group_code)) / ${page_limit})) as page_total
                        from tbl_vehicle_group 
                        left join tbl_office on tbl_vehicle_group.off_code = tbl_office.off_code
                        where veh_group_flag = '1' and veh_group_code = '${veh_group_code}'`;
                    }
                    else {
                        script = `select count(*) as rows_total,
                        ceil((ceil(count(veh_group_code)) / ${page_limit})) as page_total 
                        from tbl_vehicle_group 
                        left join tbl_office on tbl_vehicle_group.off_code = tbl_office.off_code
                        where veh_group_flag = '1'`;
                    }

                    if (off_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_vehicle_group.off_code = '${off_code}'`
                    }

                    let tbl_temporary_page = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
                    if (!tbl_temporary_page.code) {
                        if (tbl_temporary_page.data.length > 0) {
                            tbl_temporary_page.data = JSON.parse(JSON.stringify(tbl_temporary_page.data).replace(/\:null/gi, "\:\"\""));
                            page_total = parseInt(tbl_temporary_page.data[0].page_total);
                            rows_total = parseInt(tbl_temporary_page.data[0].rows_total);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลกลุ่มรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลกลุ่มรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.removeVehicleGroup = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { veh_group_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_group_code == undefined || lic_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return;
        } else {

            let script = ``;
            script = `update tbl_vehicle_group set veh_group_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' where veh_group_code = '${veh_group_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลกลุ่มรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลกลุ่มรถ', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                return;
            }
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
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลกลุ่มรถ', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.setVehicleGroupInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let { veh_group_code } = req.query;
        let {
            veh_group_desc,
            veh_yard_desc,
            veh_yard_lat,
            veh_yard_lon,
            off_code,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_group_code == undefined || off_code == undefined || veh_group_desc == undefined || action == undefined) {
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

            if (veh_yard_desc == undefined) {
                veh_yard_desc = '';
            }

            if (veh_yard_lat == undefined) {
                veh_yard_lat = 0.0;
            }

            if (veh_yard_lon == undefined) {
                veh_yard_lon = 0.0;
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลกลุ่มรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง off_code ไม่รองรับ ALL', action[0].value);
                return;
            }

            script = `update tbl_vehicle_group set
            veh_group_desc = '${veh_group_desc}',
            off_code = '${off_code}',
            veh_yard_desc = '${veh_yard_desc}',
            veh_yard_lat = ${veh_yard_lat},
            veh_yard_lon = ${veh_yard_lat},
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where veh_group_code = '${veh_group_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลกลุ่มรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลกลุ่มรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลกลุ่มรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

//Success
exports.addVehicleGroupInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            veh_group_desc,
            veh_yard_desc,
            veh_yard_lat,
            veh_yard_lon,
            off_code,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_group_desc == undefined || off_code == undefined || action == undefined) {
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

            if (veh_yard_desc == undefined) {
                veh_yard_desc = '';
            }

            if (veh_yard_lat == undefined) {
                veh_yard_lat = 0.0;
            }

            if (veh_yard_lon == undefined) {
                veh_yard_lon = 0.0;
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
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลกลุ่มรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง off_code ไม่รองรับ ALL', action[0].value);
                return;
            }

            script = `select veh_group_code from tbl_vehicle_group where veh_group_desc = '${veh_group_desc}' and off_code = '${off_code}' and veh_group_flag = '1';`
            let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary0.code) {
                if (tbl_temporary0.data.length > 0) {
                    let response = [{
                        status: 'error',
                        invalid_code: '-4',
                        message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ`,
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลกลุ่มรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ', action[0].value);
                    return;
                }
            }

            let veh_group_code = 'vehg-' + moment().format('x');
            script = `insert into tbl_vehicle_group 
            (veh_group_code, veh_group_desc, veh_group_flag, ist_dt, off_code, veh_yard_desc, veh_yard_lat, veh_yard_lon) values 
            ('${veh_group_code}', '${veh_group_desc}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}', '${off_code}', 
            '${veh_yard_desc}', ${veh_yard_lat}, ${veh_yard_lon});`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [{
                        veh_group_code: veh_group_code
                    }],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลกลุ่มรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลกลุ่มรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลกลุ่มรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}
