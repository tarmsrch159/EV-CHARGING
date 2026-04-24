const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js

exports.setLocationDepotOrderInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            ord_code,
            dpo_code,
            dpo_address,
            dpo_zip_code,
            dpo_city,
            dpo_country_code,
            dpo_lat,
            dpo_lon,
            change_master,
            action
        } = req.body[0];

        if (ord_code == undefined || dpo_code == undefined || dpo_address == undefined
            || dpo_zip_code == undefined || dpo_city == undefined || dpo_country_code == undefined || dpo_lat == undefined || dpo_lon == undefined
            || change_master == undefined || action == undefined) {
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

            if (ord_code == '') {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลคลังใน Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง', action[0].value);
                return;
            }

            script = `update tbl_order_depot set
            dpo_address = '${dpo_address}',
            dpo_zip_code = '${dpo_zip_code}',
            dpo_city = '${dpo_city}',
            dpo_country_code = '${dpo_country_code}',
            dpo_lat = ${dpo_lat},
            dpo_lon = ${dpo_lon},
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where tbl_order_depot.ord_code = '${ord_code}' and tbl_order_depot.dpo_code = '${dpo_code}';`

            script = script.replace(/'NULL'/gi, "NULL")
            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (change_master == '1') {

                    script = `update tbl_depot set
                    dpo_address = '${dpo_address}',
                    dpo_zip_code = '${dpo_zip_code}',
                    dpo_city = '${dpo_city}',
                    dpo_country_code = '${dpo_country_code}',
                    dpo_lat = ${dpo_lat},
                    dpo_lon = ${dpo_lon},
                    mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
                    where tbl_depot.dpo_code = '${dpo_code}';`

                    let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                    if (!tbl_temporary0.code) {
                        let response = [{
                            status: 'success',
                            invalid_code: '0',
                            message: '',
                            data: [],
                            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                        }]

                        res.status(200).send(response);
                        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลคลังใน Order และ Master', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลคลังใน Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                        return;
                    }

                }
                else {
                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลคลังใน Order', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลคลังใน Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลคลังใน Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.setLocationPetrolOrderInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            ord_code,
            ptrl_code,
            ptrl_address,
            ptrl_zip_code,
            ptrl_city,
            ptrl_country_code,
            ptrl_lat,
            ptrl_lon,
            change_master,
            action
        } = req.body[0];

        if (ord_code == undefined || ptrl_code == undefined || ptrl_address == undefined
            || ptrl_zip_code == undefined || ptrl_city == undefined || ptrl_country_code == undefined || ptrl_lat == undefined || ptrl_lon == undefined
            || change_master == undefined || action == undefined) {
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

            if (ord_code == '') {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลปั้มใน Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง', action[0].value);
                return;
            }

            script = `update tbl_order_petrol set
            ptrl_address = '${ptrl_address}',
            ptrl_zip_code = '${ptrl_zip_code}',
            ptrl_city = '${ptrl_city}',
            ptrl_country_code = '${ptrl_country_code}',
            ptrl_lat = ${ptrl_lat},
            ptrl_lon = ${ptrl_lon},
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where tbl_order_petrol.ord_code = '${ord_code}' and tbl_order_petrol.ptrl_code = '${ptrl_code}';`

            script = script.replace(/'NULL'/gi, "NULL")
            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (change_master == '1') {

                    script = `update tbl_petrol set
                    ptrl_address = '${ptrl_address}',
                    ptrl_zip_code = '${ptrl_zip_code}',
                    ptrl_city = '${ptrl_city}',
                    ptrl_country_code = '${ptrl_country_code}',
                    ptrl_lat = ${ptrl_lat},
                    ptrl_lon = ${ptrl_lon},
                    mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
                    where tbl_petrol.ptrl_code = '${ptrl_code}';`

                    let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                    if (!tbl_temporary0.code) {
                        let response = [{
                            status: 'success',
                            invalid_code: '0',
                            message: '',
                            data: [],
                            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                        }]

                        res.status(200).send(response);
                        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลปั้มใน Order และ Master', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลปั้มใน Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                        return;
                    }
                }
                else {
                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลปั้มใน Order', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลปั้มใน Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลปั้มใน Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.setFuelOrderInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            ord_item_code,
            ord_code,
            item_quantity,
            action
        } = req.body[0];

        if (ord_code == undefined || ord_item_code == undefined || item_quantity == undefined || action == undefined) {
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

            if (ord_code == '') {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขน้ำหนักของน้ำมันข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง', action[0].value);
                return;
            }

            script = `update tbl_order_item set
            item_quantity = ${item_quantity},
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where tbl_order_item.ord_code = '${ord_code}' and tbl_order_item.ord_item_code = '${ord_item_code}';`

            script = script.replace(/'NULL'/gi, "NULL")
            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                script = `update tbl_order set 
                item_quantity = (SELECT sum(item_quantity) as item_quantity FROM public.tbl_order_item where ord_code = '${ord_code}'),
                mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
                where ord_code = '${ord_code}'`

                let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                if (!tbl_temporary0.code) {
                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขน้ำหนักของน้ำมันข้อมูล Order', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                    await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขน้ำหนักของน้ำมันข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขน้ำหนักของน้ำมันข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขน้ำหนักของน้ำมันข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.setCancelOrderInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            ord_code,
            ord_comment,
            action
        } = req.body[0];

        if (ord_code == undefined || ord_comment == undefined || action == undefined) {
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

            if (ord_code == '' || ord_comment == '') {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code, ord_comment ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ยกเลิก Order VMI', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code, ord_comment ไม่รองรับค่าว่าง', action[0].value);
                return;
            }

            script = `update tbl_order set
            ord_comment = '${ord_comment}',
            ord_flag = '0',
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where tbl_order.ord_code = '${ord_code}';`

            script = script.replace(/'NULL'/gi, "NULL")
            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {

                script = `delete from tbl_order where ord_code = '${ord_code}' and ord_type_code = 'otyp-9999999999998';`
                let tbl_temporary0 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ยกเลิก Order VMI', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ยกเลิก Order VMI', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ยกเลิก Order VMI', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.addLocationDepotOrderInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            ord_code,
            dpo_code,
            itm_code,
            itm_unit_code,
            item_quantity,
            action
        } = req.body[0];

        if (ord_code == undefined || dpo_code == undefined || itm_code == undefined
            || itm_unit_code == undefined || item_quantity == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            if (ord_code == '') {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลคลังใน Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง', action[0].value);
                return;
            }

            var ord_depot_code = 'odpo-' + moment().format('x');
            let script = `INSERT INTO public.tbl_order_depot 
            (ord_depot_code, ord_code, dpo_code, itm_code, itm_unit_code, item_quantity, ord_depot_flag, ist_dt) 
            values ('${ord_depot_code}', '${ord_code}', '${dpo_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity}, 
            '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}')`

            script = script.replace(/'NULL'/gi, "NULL")
            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                script = `update tbl_order 
                set item_count = (select count(itm_code) from tbl_order_item where ord_code = '${ord_code}' and ord_item_flag = '1'),
                item_quantity = (select sum(item_quantity) from tbl_order_item where ord_code = '${ord_code}' and ord_item_flag = '1'), 
                loading_count = (select count(distinct dpo_code) from tbl_order_depot where ord_code = '${ord_code}' and ord_depot_flag = '1'),
                unloading_count = (select count(distinct ptrl_code) from tbl_order_petrol where ord_code = '${ord_code}' and ord_petrol_flag = '1')
                where ord_code = '${ord_code}'`

                await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลคลังใน Order', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลคลังใน Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลคลังใน Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.addLocationPetrolOrderInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            ord_code,
            ptrl_code,
            ptrl_tank_code,
            itm_code,
            itm_unit_code,
            item_quantity,
            req_dt,
            action
        } = req.body[0];

        if (ord_code == undefined || ptrl_code == undefined || ptrl_tank_code == undefined
            || itm_code == undefined || itm_unit_code == undefined || item_quantity == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {
            if (ord_code == '') {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปั้มใน Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง', action[0].value);
                return;
            }

            let script00 = `select * from tbl_order_petrol 
            where ord_code = '${ord_code}' and ptrl_tank_code = '${ptrl_tank_code}' and ptrl_code = '${ptrl_code}' and itm_code = '${itm_code}'`
            let tbl_temporary00 = await pgConn.get(dbPrefix + lic_code, script00, config.connectionString());

            if (!tbl_temporary00.code) {
                if (tbl_temporary00.data.length == 0) {
                    var ord_petrol_code = 'optrl-' + moment().format('x');
                    let script = `INSERT INTO public.tbl_order_petrol 
                    (ord_petrol_code, ord_code, ptrl_code, ptrl_tank_code, itm_code, itm_unit_code, item_quantity, req_dt, ord_petrol_flag, ist_dt) 
                    values ('${ord_petrol_code}', '${ord_code}', '${ptrl_code}', '${ptrl_tank_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity},
                    '${req_dt}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}')`

                    console.log(script);
                    let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

                    if (tbl_temporary.code) {
                        let response = [{
                            status: 'error',
                            invalid_code: '-3',
                            message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                            data: [],
                            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                        }]
                        res.status(200).send(response);
                        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปั้มใน Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                        return;
                    }
                }
            }

            let script002 = `select * from tbl_order_item 
            where ord_code = '${ord_code}' and ptrl_tank_code = '${ptrl_tank_code}' and itm_code = '${itm_code}'`
            let tbl_temporary002 = await pgConn.get(dbPrefix + lic_code, script002, config.connectionString());

            if (!tbl_temporary002.code) {
                if (tbl_temporary002.data.length == 0) {
                    var ord_item_code = 'oitm-' + moment().format('x');
                    let script2 = `INSERT INTO public.tbl_order_item 
                    (ord_item_code, ord_code, itm_code, itm_unit_code, item_quantity, ptrl_tank_code, ord_item_flag, ist_dt) 
                    values ('${ord_item_code}', '${ord_code}', '${itm_code}', '${itm_unit_code}', ${item_quantity}, '${ptrl_tank_code}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}')`
                    await pgConn.execute(dbPrefix + lic_code, script2, config.connectionString());

                    script = `update tbl_order 
                    set item_count = (select count(itm_code) from tbl_order_item where ord_code = '${ord_code}' and ord_item_flag = '1'),
                    item_quantity = (select sum(item_quantity) from tbl_order_item where ord_code = '${ord_code}' and ord_item_flag = '1'), 
                    loading_count = (select count(distinct dpo_code) from tbl_order_depot where ord_code = '${ord_code}' and ord_depot_flag = '1'),
                    unloading_count = (select count(distinct ptrl_code) from tbl_order_petrol where ord_code = '${ord_code}' and ord_petrol_flag = '1'),
                    req_dt = (select min(req_dt) from tbl_order_petrol where ord_code = '${ord_code}' and ord_petrol_flag = '1'),
                    ord_customer_code = '${ptrl_code}',
                    ord_customer_name = (select ptrl_number from tbl_petrol where ptrl_code = '${ptrl_code}' limit 1),
                    ord_customer_number = (select ptrl_desc from tbl_petrol where ptrl_code = '${ptrl_code}' limit 1) 
                    where ord_code = '${ord_code}'`

                    await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปั้มใน Order', JSON.stringify(req.body[0]), 'success', action[0].value);
                    return;
                }
                else {
                    await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปั้มใน Order', JSON.stringify(req.body[0]), 'success', action[0].value);
                    return;
                }
            }
            else {
                if (tbl_temporary.code) {
                    let response = [{
                        status: 'error',
                        invalid_code: '-3',
                        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]
                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปั้มใน Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                    return;
                }
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปั้มใน Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.getItemOfOrderInformationForConfig = async (req, res, next) => {

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
            script = `select tbl_order_item.itm_code,
                tbl_item.itm_desc,
                tbl_item.itm_short_desc,
                tbl_item.itm_material_number,
                tbl_order_item.itm_unit_code,
                tbl_item_unit.itm_unit_desc,
                tbl_order_item.item_quantity,
                tbl_order_item.ist_dt,
                tbl_order_item.mdf_dt,
                tbl_order_item.rm_dt

                from tbl_order_item 
                left join tbl_item on tbl_order_item.itm_code = tbl_item.itm_code
                left join tbl_item_unit on tbl_order_item.itm_unit_code = tbl_item_unit.itm_unit_code
                where ord_code = '${ord_code}' and tbl_item.itm_flag = '1' order by tbl_item.itm_desc asc;`;

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

exports.setDateTimeOrderInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            ord_code,
            req_dt,
            action
        } = req.body[0];

        if (ord_code == undefined || req_dt == undefined || action == undefined) {
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

            if (ord_code == '') {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลเวลาที่ต้องการส่งใน Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง', action[0].value);
                return;
            }

            script = `update tbl_order set
            req_dt = '${req_dt}',
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where tbl_order.ord_code = '${ord_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลเวลาที่ต้องการส่งใน Order', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลเวลาที่ต้องการส่งใน Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลเวลาที่ต้องการส่งใน Order', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}


exports.getItemOfOrderInformationForPetrol = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { ord_code, ptrl_code, itm_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ord_code == undefined || ptrl_code == undefined || lic_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
        } else {

            if (itm_code == undefined) {
                itm_code = 'ALL'
            }


            let script = ``;
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
                tbl_item_unit.itm_unit_code,
                itm_unit_desc,
                itm_icon,
                itm_image,
                itm_material_number,
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
                left join tbl_item_unit on tbl_item.itm_unit_code = tbl_item_unit.itm_unit_code 
                left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                where tbl_petrol_tank.ptrl_tank_flag = '1' and ptrl_tank_code is not null

                and ptrl_tank_code not in (
                        select tbl_order_item.ptrl_tank_code
                        from tbl_order_item
                        where tbl_order_item.ord_code = '${ord_code}' 
                    )

                
                `;


            if (ptrl_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_petrol.ptrl_code = '${ptrl_code}' `
            }

            if (itm_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_petrol_tank.itm_code = '${itm_code}' `
            }


            script += `  order by tnk_number asc;`

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
