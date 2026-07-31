const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
//Success
exports.getVehicleCompartmentLevelInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        let { veh_compartment_code, veh_compartment_level_code, action, page_inde, page_limit } = req.body[0];
        page_inde = page_inde == undefined ? 1 : page_inde;
        page_limit = page_limit == undefined ? 10 : page_limit;

        if (page_inde > 0) {
            page_inde -= 1
        }

        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_compartment_level_code == undefined || veh_compartment_code == undefined || lic_code == undefined || action == undefined) {
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
            if (veh_compartment_level_code.toString().toUpperCase() != 'ALL') {
                script = `select veh_compartment_level_code, veh_compartment_code, veh_compartment_level_number, veh_compartment_level, veh_compartment_level_flag,
                tbl_vehicle_compartment_level.ist_dt, tbl_vehicle_compartment_level.mdf_dt, tbl_vehicle_compartment_level.rm_dt 
                from tbl_vehicle_compartment_level 
                where veh_compartment_level_flag = '1' and veh_compartment_level_code = '${veh_compartment_level_code}'`;
            }
            else {
                script = `select veh_compartment_level_code, veh_compartment_code, veh_compartment_level_number, veh_compartment_level, veh_compartment_level_flag,
                tbl_vehicle_compartment_level.ist_dt, tbl_vehicle_compartment_level.mdf_dt, tbl_vehicle_compartment_level.rm_dt 
                from tbl_vehicle_compartment_level 
                where veh_compartment_level_flag = '1'`;
            }

            if (veh_compartment_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_vehicle_compartment_level.veh_compartment_code = '${veh_compartment_code}' `
            }

            script += `  order by tbl_vehicle_compartment_level.ist_dt desc`
            script += ` offset (${page_inde}*${page_limit}) limit ${page_limit};`

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                    let page_total = 0;
                    let rows_total = 0;

                    if (veh_compartment_level_code.toString().toUpperCase() != 'ALL') {
                        script = `select 
                        ceil((ceil(count(veh_compartment_level_code)) / ${page_limit})) as page_total, 
                        count(*) as rows_total
                        from tbl_vehicle_compartment_level 
                        where veh_compartment_level_flag = '1' and veh_compartment_level_code = '${veh_compartment_level_code}'`;
                    }
                    else {
                        script = `select 
                        ceil((ceil(count(veh_compartment_level_code)) / ${page_limit})) as page_total, 
                        count(*) as rows_total
                        from tbl_vehicle_compartment_level 
                        where veh_compartment_level_flag = '1'`;
                    }

                    if (veh_compartment_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_vehicle_compartment_level.veh_compartment_code = '${veh_compartment_code}' `
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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลแป้นน้ำมันของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลแป้นน้ำมันของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.removeVehicleCompartmentLevel = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { veh_compartment_level_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_compartment_level_code == undefined || lic_code == undefined || action == undefined) {
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
            script = `update tbl_vehicle_compartment_level set veh_compartment_level_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' where veh_compartment_level_code = '${veh_compartment_level_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลแป้นน้ำมันของรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลแป้นน้ำมันของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลแป้นน้ำมันของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.setVehicleCompartmentLevelInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let { veh_compartment_level_code } = req.query;
        let {
            veh_compartment_code,
            veh_compartment_level_number,
            veh_compartment_level,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_compartment_level_code == undefined || veh_compartment_code == undefined || veh_compartment_level_number == undefined
            || veh_compartment_level == undefined || action == undefined) {
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
            script = `update tbl_vehicle_compartment_level set 
            veh_compartment_code = '${veh_compartment_code}',
            veh_compartment_level_number = '${veh_compartment_level_number}',
            veh_compartment_level = ${veh_compartment_level},
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where veh_compartment_level_code = '${veh_compartment_level_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลแป้นน้ำมันของรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลแป้นน้ำมันของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลแป้นน้ำมันของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

//Success
exports.addVehicleCompartmentLevelInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            veh_compartment_code,
            veh_compartment_level_number,
            veh_compartment_level,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (veh_compartment_code == undefined || veh_compartment_level_number == undefined || veh_compartment_level == undefined || action == undefined) {
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
            script = `select veh_compartment_level_code from tbl_vehicle_compartment_level where veh_compartment_level_number = '${veh_compartment_level_number}' and veh_compartment_code = '${veh_compartment_code}' and veh_compartment_level_flag = '1';`
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
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลแป้นน้ำมันของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ', action[0].value);
                    return;
                }
            }

            script = `select veh_compartment_level_code from tbl_vehicle_compartment_level where 
            veh_compartment_level >= ${veh_compartment_level} and veh_compartment_code = '${veh_compartment_code}' and veh_compartment_level_flag = '1';`
            let tbl_temporary1 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary1.code) {
                if (tbl_temporary1.data.length > 0) {
                    let response = [{
                        status: 'error',
                        invalid_code: '-4',
                        message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลระดับน้ำมันน้อยกว่าหรือเท่ากับค่าก่อนหน้า`,
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลแป้นน้ำมันของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลระดับน้ำมันน้อยกว่าค่าก่อนหน้า', action[0].value);
                    return;
                }
            }

            let veh_compartment_level_code = 'coml-' + moment().format('x');
            script = `insert into tbl_vehicle_compartment_level 
            (veh_compartment_level_code, veh_compartment_code, veh_compartment_level_number, veh_compartment_level, veh_compartment_level_flag, ist_dt) values 
            ('${veh_compartment_level_code}', '${veh_compartment_code}','${veh_compartment_level_number}', ${veh_compartment_level}, '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}');`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [{
                        veh_compartment_level_code: veh_compartment_level_code
                    }],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลแป้นน้ำมันของรถ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลแป้นน้ำมันของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลแป้นน้ำมันของรถ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}
