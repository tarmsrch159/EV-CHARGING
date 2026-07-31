const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
exports.getActionLogInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { action_code, start_date, end_date, off_code, search, page_index, page_limit, action } = req.body[0];
        page_index == undefined ? page_index = 1 : page_index;
        page_limit == undefined ? page_limit = 10 : page_limit;
        //เช็คเฉพาะส่วนที่สำคัญ
        if (action_code == undefined || start_date == undefined || end_date == undefined || off_code == undefined
            || search == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return
        } else {

            let script = ``;
            if (start_date != '' && end_date != '') {

                let script = ``;
                if (page_index > 0) {
                    page_index -= 1;
                }

                if (action_code.toString().toUpperCase() != 'ALL') {
                    script = `select 
                    tbl_order.ord_code, tbl_order.shipments_code, tbl_order.transport_code, tbl_order.tour_code, tbl_order.pull_code, tbl_order.number,
                    tbl_order.document_reference, tbl_order.plant, tbl_order.assigned_carrier_id, tbl_order.assigned_carrier_name, tbl_order.assigned_creditor_number,
                    tbl_order.assigned_carrier_number, tbl_order.ord_dt, tbl_order.req_dt, tbl_order.ord_status, tbl_order.ord_comment, tbl_order.ord_customer_code,
                    tbl_order.ord_customer_name, tbl_order.ord_customer_number, tbl_order.ord_type_code, tbl_order_type.ord_type_desc, tbl_order.gsap_order_type_code,
                    tbl_order.gsap_order_status, tbl_order.transporeon_status, tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt, tbl_order.off_code,
                    tbl_order.ord_flag, tbl_order.loading_count, tbl_order.unloading_count, tbl_order.item_count, tbl_order.item_quantity 
                    from tbl_order 
                    left join tbl_order_type 
                    on tbl_order.ord_type_code = tbl_order_type.ord_type_code
                    where tbl_order.ord_flag = '1' and tbl_order.ord_code = '${ord_code}'`;
                }
                else {
                    script = `select 
                    tbl_order.ord_code, tbl_order.shipments_code, tbl_order.transport_code, tbl_order.tour_code, tbl_order.pull_code, tbl_order.number,
                    tbl_order.document_reference, tbl_order.plant, tbl_order.assigned_carrier_id, tbl_order.assigned_carrier_name, tbl_order.assigned_creditor_number,
                    tbl_order.assigned_carrier_number, tbl_order.ord_dt, tbl_order.req_dt, tbl_order.ord_status, tbl_order.ord_comment, tbl_order.ord_customer_code,
                    tbl_order.ord_customer_name, tbl_order.ord_customer_number, tbl_order.ord_type_code, tbl_order_type.ord_type_desc, tbl_order.gsap_order_type_code,
                    tbl_order.gsap_order_status, tbl_order.transporeon_status, tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt, tbl_order.off_code,
                    tbl_order.ord_flag, tbl_order.loading_count, tbl_order.unloading_count, tbl_order.item_count, tbl_order.item_quantity 
                    from tbl_order 
                    left join tbl_order_type 
                    on tbl_order.ord_type_code = tbl_order_type.ord_type_code 
                    where tbl_order.ord_flag = '1'`;
                }

                if (off_code.toString().toUpperCase() != 'ALL') {
                    script += ` and tbl_order.off_code = '${off_code}'`
                }

                if (ord_status.toString().toUpperCase() != 'ALL') {
                    script += ` and tbl_order.ord_status = '${ord_status}'`
                }

                if (search != '') {
                    script += ` and (tbl_order.shipments_code like '%${search}%' 
                    or tbl_order.transport_code like '%${search}%' 
                    or tbl_order.tour_code like '%${search}%' 
                    or tbl_order.number like '%${search}%' 
                    or tbl_order.document_reference like '%${search}%' 
                    or tbl_order.ord_customer_code like '%${search}%' 
                    or tbl_order.ord_customer_name like '%${search}%' 
                    or tbl_order.ord_customer_number like '%${search}%'
                    or tbl_order_type.ord_type_desc like '%${search}%')`
                }

                script += ` order by tbl_order.shipments_code asc `
                script += ` offset (${page_index}*${page_limit}) limit ${page_limit};`

            }
            else {
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
                    await xglobal.action_logs(lic_code, tbl_temporary.data[0].emp_code, 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'success', tbl_temporary.data[0].off_code);
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
                    message: `ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
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
        await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
        return;
    });
}


exports.getNotificaionInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { flag, action } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (flag == undefined || action == undefined || lic_code == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return
        } else {

            let script = ``;
            if (flag != '') {
                script = `select notificaion_code, ord_code, shipments_code, ord_comment, ord_status, remark, flag, ist_dt, mdf_dt
                from tbl_order_notificaion where flag = '${flag}' order by ist_dt asc limit 100;`;
            }
            else {
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
                    await xglobal.action_logs(lic_code, tbl_temporary.data[0].emp_code, 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'success', tbl_temporary.data[0].off_code);
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
                    message: `ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
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
        await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
        return;
    });
}

//Success
exports.setNotificaionInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let { notificaion_code } = req.query;
        let {
            flag,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (flag == undefined || action == undefined || notificaion_code == undefined) {
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

            script = `update tbl_order_notificaion set 
            flag = '${flag}', 
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where notificaion_code = '${notificaion_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'อ่านข้อมูลแจ้งเตือน ', notificaion_code, 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'อ่านข้อมูลแจ้งเตือน ', notificaion_code, 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'อ่านข้อมูลแจ้งเตือน ', notificaion_code, 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}