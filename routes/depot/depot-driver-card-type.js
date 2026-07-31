const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
//Success
exports.getDepotDriverCardTypeInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        let { dver_card_type_code, page_index, page_limit, action } = req.body[0];

        page_index == undefined ? page_index = 1 : page_index;
        page_limit == undefined ? page_limit = 10 : page_limit;

        if (page_index > 0) {
            page_index -= 1;
        }
        //เช็คเฉพาะส่วนที่สำคัญ
        if (dver_card_type_code == undefined || lic_code == undefined || action == undefined) {
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
            if (dver_card_type_code.toString().toUpperCase() != 'ALL') {
                script = `select
                dpo_driver_card_type_code,
                tbl_depot.dpo_code,
                dpo_number,
                dpo_desc,
                dpo_short_desc,
                tbl_depot.dpo_group_code,
                dpo_group_desc,
                tbl_depot_driver_card_type.dver_card_type_code,
                tbl_driver_card_type.dver_card_type_desc,
                tbl_depot.off_code,
                off_desc,
                tbl_depot_driver_card_type.ist_dt,
                tbl_depot_driver_card_type.mdf_dt,
                tbl_depot_driver_card_type.rm_dt 
                from tbl_depot
                left join tbl_office on tbl_depot.off_code = tbl_office.off_code
                left join tbl_depot_driver_card_type on tbl_depot.dpo_code = tbl_depot_driver_card_type.dpo_code 
                left join tbl_driver_card_type on tbl_depot_driver_card_type.dver_card_type_code = tbl_driver_card_type.dver_card_type_code 
                left join tbl_depot_group on tbl_depot.dpo_group_code = tbl_depot_group.dpo_group_code 
                where tbl_depot_driver_card_type.dpo_driver_card_type_flag = '1' and dpo_driver_card_type_code is not null 
                and tbl_depot_driver_card_type.dver_card_type_code = '${dver_card_type_code}' `;
            }
            else {
                script = `select
                dpo_driver_card_type_code,
                tbl_depot.dpo_code,
                dpo_number,
                dpo_desc,
                dpo_short_desc,
                tbl_depot.dpo_group_code,
                dpo_group_desc,
                tbl_depot_driver_card_type.dver_card_type_code,
                tbl_driver_card_type.dver_card_type_desc,
                tbl_depot.off_code,
                off_desc,
                tbl_depot_driver_card_type.ist_dt,
                tbl_depot_driver_card_type.mdf_dt,
                tbl_depot_driver_card_type.rm_dt 
                from tbl_depot
                left join tbl_office on tbl_depot.off_code = tbl_office.off_code
                left join tbl_depot_driver_card_type on tbl_depot.dpo_code = tbl_depot_driver_card_type.dpo_code 
                left join tbl_driver_card_type on tbl_depot_driver_card_type.dver_card_type_code = tbl_driver_card_type.dver_card_type_code 
                left join tbl_depot_group on tbl_depot.dpo_group_code = tbl_depot_group.dpo_group_code 
                where tbl_depot_driver_card_type.dpo_driver_card_type_flag = '1' and dpo_driver_card_type_code is not null `;
            }

            if (dpo_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_depot.dpo_code = '${dpo_code}' `
            }

            script += `  order by tbl_depot_driver_card_type.ist_dt desc`
            script += ` offset (${page_index}*${page_limit}) limit ${page_limit};`
            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));
                    let page_total = 0;
                    let rows_total = 0;
                    script = ``
                    if (dver_card_type_code.toString().toUpperCase() != 'ALL') {
                        script = `select ceil((ceil(count(dpo_driver_card_type_code)) / ${page_limit})) as page_total, (count(dpo_driver_card_type_code)) as rows_total 
                    from tbl_depot
                    left join tbl_depot_driver_card_type on tbl_depot.dpo_code = tbl_depot_driver_card_type.dpo_code 
                    left join tbl_driver_card_type on tbl_depot_driver_card_type.dver_card_type_code = tbl_driver_card_type.dver_card_type_code 
                    where tbl_depot_driver_card_type.dpo_driver_card_type_flag = '1' and dpo_driver_card_type_code is not null 
                    and tbl_depot_driver_card_type.dver_card_type_code = '${dver_card_type_code}'`;
                    } else {
                        script = `select ceil((ceil(count(dpo_driver_card_type_code)) / ${page_limit})) as page_total, (count(dpo_driver_card_type_code)) as rows_total 
                    from tbl_depot
                    left join tbl_depot_driver_card_type on tbl_depot.dpo_code = tbl_depot_driver_card_type.dpo_code 
                    left join tbl_driver_card_type on tbl_depot_driver_card_type.dver_card_type_code = tbl_driver_card_type.dver_card_type_code 
                    where tbl_depot_driver_card_type.dpo_driver_card_type_flag = '1' and dpo_driver_card_type_code is not null`;
                    }

                    if (dpo_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_depot.dpo_code = '${dpo_code}'`
                    }

                    let tbl_temporary_count = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
                    if (!tbl_temporary_count.code) {
                        if (tbl_temporary_count.data.length > 0) {
                            page_total = parseInt(tbl_temporary_count.data[0].page_total);
                            rows_total = parseInt(tbl_temporary_count.data[0].rows_total);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลประเภทใบอนุญาตที่ได้รับอนุญาตเข้าคลัง', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลประเภทใบอนุญาตที่ได้รับอนุญาตเข้าคลัง', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.removeDepotDriverCardType = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { dpo_driver_card_type_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (dpo_driver_card_type_code == undefined || lic_code == undefined || action == undefined) {
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
            script = `update tbl_depot_driver_card_type set dpo_driver_card_type_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' where dpo_driver_card_type_code = '${dpo_driver_card_type_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลประเภทใบอนุญาตที่ได้รับอนุญาตเข้าคลัง', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลประเภทใบอนุญาตที่ได้รับอนุญาตเข้าคลัง', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลประเภทใบอนุญาตที่ได้รับอนุญาตเข้าคลัง', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.setDepotDriverCardTypeInformation = async (req, res, next) => {

    return (async () => {
        //debugger
        let lic_code = req.header('lic_code');
        let { dpo_driver_card_type_code } = req.query;
        let {
            dpo_code,
            dver_card_type_code,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (dpo_driver_card_type_code == undefined || dpo_code == undefined || dver_card_type_code == undefined || action == undefined) {
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
            script = `update tbl_depot_driver_card_type set
            dpo_code = '${dpo_code}', 
            dver_card_type_code = '${dver_card_type_code}',
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where dpo_driver_card_type_code = '${dpo_driver_card_type_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลประเภทใบอนุญาตที่ได้รับอนุญาตเข้าคลัง', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลประเภทใบอนุญาตที่ได้รับอนุญาตเข้าคลัง', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลประเภทใบอนุญาตที่ได้รับอนุญาตเข้าคลัง', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

//Success
exports.addDepotDriverCardTypeInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            dpo_code,
            dver_card_type_code,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (dpo_code == undefined || dver_card_type_code == undefined || action == undefined || lic_code == undefined) {
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
            script = `select dpo_driver_card_type_code from tbl_depot_driver_card_type 
            where dpo_driver_card_type_flag = '1' and dpo_code = '${dpo_code}' and dver_card_type_code = '${dver_card_type_code}';`
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
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลประเภทใบอนุญาตที่ได้รับอนุญาตเข้าคลัง', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ', action[0].value);
                    return;
                }
            }

            let dpo_driver_card_type_code = 'dcty-' + moment().format('x');
            script = `insert into tbl_depot_driver_card_type 
            (dpo_driver_card_type_code, dpo_code, dver_card_type_code, dpo_driver_card_type_flag, ist_dt) values 
            ('${dpo_driver_card_type_code}', '${dpo_code}', '${dver_card_type_code}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}');`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [{
                        dpo_driver_card_type_code: dpo_driver_card_type_code
                    }],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลประเภทใบอนุญาตที่ได้รับอนุญาตเข้าคลัง', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลประเภทใบอนุญาตที่ได้รับอนุญาตเข้าคลัง', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลประเภทใบอนุญาตที่ได้รับอนุญาตเข้าคลัง', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}
