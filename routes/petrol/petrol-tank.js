const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
//Success
exports.getPetrolTankInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        let { tnk_number, ptrl_code, itm_code, action, page_index, page_limit } = req.body[0];
        page_index = page_index == undefined ? 0 : page_index;
        page_limit = page_limit == undefined ? 10 : page_limit;

        if (page_index > 0) {
            page_index -= 1;
        }
        //เช็คเฉพาะส่วนที่สำคัญ
        if (tnk_number == undefined || ptrl_code == undefined || lic_code == undefined || action == undefined) {
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

            if (itm_code == undefined) {
                itm_code = 'ALL'
            }


            let script = ``;
            if (tnk_number.toString().toUpperCase() != 'ALL') {
                script = `select
                ptrl_tank_code,
                tbl_petrol.ptrl_code,
                ptrl_number,
                ptrl_desc,
                ptrl_short_desc,
                tbl_petrol.ptrl_group_code,
                ptrl_group_desc,
                tbl_petrol_tank.tnk_number,
                tbl_petrol_tank.tnk_capacity,
                tbl_petrol_tank.tnk_target,
                tbl_petrol_tank.tnk_deadstock,
                tbl_petrol_tank.itm_code,
                itm_desc,
                itm_short_desc,
                tbl_item.itm_type_code,
                itm_type_desc,
                itm_unit_code,
                itm_unit_code,
                itm_icon,
                itm_image,
                itm_material_number,
                tbl_petrol_tank.tnk_safety_factor,
                tbl_petrol.off_code,
                off_desc,
                tbl_petrol_tank.ist_dt,
                tbl_petrol_tank.mdf_dt,
                tbl_petrol_tank.rm_dt
                from tbl_petrol
                left join tbl_office on tbl_petrol.off_code = tbl_office.off_code
                left join tbl_petrol_tank on tbl_petrol.ptrl_code = tbl_petrol_tank.ptrl_code 
                left join tbl_item on tbl_petrol_tank.itm_code = tbl_item.itm_code 
                left join tbl_item_type on tbl_item.itm_type_code = tbl_item_type.itm_type_code 
                left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                where tbl_petrol_tank.ptrl_tank_flag = '1' and ptrl_tank_code is not null and tbl_petrol_tank.tnk_number = '${tnk_number}' `;
            }
            else {
                script = `select
                ptrl_tank_code,
                tbl_petrol.ptrl_code,
                ptrl_number,
                ptrl_desc,
                ptrl_short_desc,
                tbl_petrol.ptrl_group_code,
                ptrl_group_desc,
                tbl_petrol_tank.tnk_number,
                tbl_petrol_tank.tnk_capacity,
                tbl_petrol_tank.tnk_target,
                tbl_petrol_tank.tnk_deadstock,
                tbl_petrol_tank.itm_code,
                itm_desc,
                itm_short_desc,
                tbl_item.itm_type_code,
                itm_type_desc,
                itm_unit_code,
                itm_unit_code,
                itm_icon,
                itm_image,
                itm_material_number,
                tbl_petrol_tank.tnk_safety_factor,
                tbl_petrol.off_code,
                off_desc,
                tbl_petrol_tank.ist_dt,
                tbl_petrol_tank.mdf_dt,
                tbl_petrol_tank.rm_dt 
                from tbl_petrol
                left join tbl_office on tbl_petrol.off_code = tbl_office.off_code
                left join tbl_petrol_tank on tbl_petrol.ptrl_code = tbl_petrol_tank.ptrl_code 
                left join tbl_item on tbl_petrol_tank.itm_code = tbl_item.itm_code 
                left join tbl_item_type on tbl_item.itm_type_code = tbl_item_type.itm_type_code 
                left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                where tbl_petrol_tank.ptrl_tank_flag = '1' and ptrl_tank_code is not null `;
            }

            if (ptrl_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_petrol.ptrl_code = '${ptrl_code}' `
            }

            if (itm_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_petrol_tank.itm_code = '${itm_code}' `
            }

            script += `  order by tbl_petrol_tank.tnk_number asc`
            script += ` offset (${page_index}*${page_limit}) limit ${page_limit};`

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));
                    let page_total = 0;
                    let rows_total = 0;

                    let script = ``;
                    if (tnk_number.toString().toUpperCase() != 'ALL') {
                        script = `select
                    ceil((ceil(count(tnk_number)) / ${page_limit})) as page_total, 
                    (count(tnk_number)) as rows_total 
                    from tbl_petrol
                    left join tbl_office on tbl_petrol.off_code = tbl_office.off_code
                    left join tbl_petrol_tank on tbl_petrol.ptrl_code = tbl_petrol_tank.ptrl_code 
                    left join tbl_item on tbl_petrol_tank.itm_code = tbl_item.itm_code 
                    left join tbl_item_type on tbl_item.itm_type_code = tbl_item_type.itm_type_code 
                    left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                    where tbl_petrol_tank.ptrl_tank_flag = '1' and ptrl_tank_code is not null 
                    and tbl_petrol_tank.tnk_number = '${tnk_number}' `;
                    }
                    else {
                        script = `select
                    ceil((ceil(count(tnk_number)) / ${page_limit})) as page_total, 
                    (count(tnk_number)) as rows_total 
                    from tbl_petrol
                    left join tbl_office on tbl_petrol.off_code = tbl_office.off_code
                    left join tbl_petrol_tank on tbl_petrol.ptrl_code = tbl_petrol_tank.ptrl_code 
                    left join tbl_item on tbl_petrol_tank.itm_code = tbl_item.itm_code 
                    left join tbl_item_type on tbl_item.itm_type_code = tbl_item_type.itm_type_code 
                    left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                    where tbl_petrol_tank.ptrl_tank_flag = '1' and ptrl_tank_code is not null 
                    and ptrl_tank_code is not null `;
                    }

                    if (ptrl_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_petrol.ptrl_code = '${ptrl_code}' `
                    }

                    if (itm_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_petrol_tank.itm_code = '${itm_code}' `
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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลแทงค์ปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลแทงค์ปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.removePetrolTank = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { ptrl_tank_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_tank_code == undefined || lic_code == undefined || action == undefined) {
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
            script = `update tbl_petrol_tank set ptrl_tank_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' where ptrl_tank_code = '${ptrl_tank_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลแทงค์ปั้ม', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลแทงค์ปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลแทงค์ปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.setPetrolTankInformation = async (req, res, next) => {

    return (async () => {
        //debugger
        let lic_code = req.header('lic_code');
        let { ptrl_tank_code } = req.query;
        let {
            ptrl_code,
            tnk_number,
            itm_code,
            tnk_capacity,
            tnk_target,
            tnk_deadstock,
            tnk_safety_factor,
            action
        } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_tank_code == undefined || ptrl_code == undefined || itm_code == undefined
            || tnk_number == undefined || tnk_capacity == undefined || tnk_target == undefined || tnk_deadstock == undefined || tnk_safety_factor == undefined || action == undefined) {
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
            script = `update tbl_petrol_tank set
            ptrl_code = '${ptrl_code}', 
            itm_code = '${itm_code}',
            tnk_number = '${tnk_number}',
            tnk_capacity = ${tnk_capacity},
            tnk_deadstock = ${tnk_deadstock},
            tnk_target = ${tnk_target},
            tnk_safety_factor = ${tnk_safety_factor},
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where ptrl_tank_code = '${ptrl_tank_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลแทงค์ปั้ม', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลแทงค์ปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลแทงค์ปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

//Success
exports.addPetrolTankInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            ptrl_code,
            tnk_number,
            itm_code,
            tnk_capacity,
            tnk_target,
            tnk_deadstock,
            tnk_safety_factor,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_code == undefined || itm_code == undefined || tnk_number == undefined || tnk_capacity == undefined
            || tnk_target == undefined || tnk_deadstock == undefined || tnk_safety_factor == undefined || action == undefined || lic_code == undefined) {
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
            script = `select ptrl_tank_code from tbl_petrol_tank where ptrl_tank_flag = '1' and ptrl_code = '${ptrl_code}' and tnk_number = '${tnk_number}';`
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
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลแทงค์ปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ', action[0].value);
                    return;
                }
            }

            let ptrl_tank_code = 'ptnk-' + moment().format('x');
            script = `insert into tbl_petrol_tank 
            (ptrl_tank_code, ptrl_code, tnk_number, itm_code, tnk_capacity, tnk_target, tnk_deadstock, tnk_safety_factor, ptrl_tank_flag, ist_dt) values 
            ('${ptrl_tank_code}', '${ptrl_code}', '${tnk_number}','${itm_code}', ${tnk_capacity}, 
            ${tnk_target}, ${tnk_deadstock}, ${tnk_safety_factor},'1', '${moment().format('YYYY-MM-DD HH:mm:ss')}');`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [{
                        ptrl_tank_code: ptrl_tank_code
                    }],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลแทงค์ปั้ม', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลแทงค์ปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลแทงค์ปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}
