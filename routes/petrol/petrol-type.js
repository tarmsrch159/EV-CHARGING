const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
exports.getPetrolTypeInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { ptrl_type_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_type_code == undefined || lic_code == undefined || action == undefined) {
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
            if (ptrl_type_code.toString().toUpperCase() != 'ALL') {
                script = `select tbl_order_type.ord_type_code as ptrl_type_code, tbl_order_type.sales_order_type as ptrl_type, tbl_order_type.ord_type_desc as ptrl_type_desc, tbl_order_type.ord_type_flag as ptrl_type_flag, tbl_order_type.ist_dt, 
                tbl_order_type.mdf_dt, tbl_order_type.rm_dt 

                from tbl_order_type
                where tbl_order_type.ord_type_code = '${ptrl_type_code}' and tbl_order_type.ord_type_flag = '1'`;
            }
            else {
                script = `select tbl_order_type.ord_type_code as ptrl_type_code,tbl_order_type.sales_order_type as ptrl_type, tbl_order_type.ord_type_desc as ptrl_type_desc, tbl_order_type.ord_type_flag as ptrl_type_flag, tbl_order_type.ist_dt, 
                tbl_order_type.mdf_dt, tbl_order_type.rm_dt 

                from tbl_order_type
                where tbl_order_type.ord_type_code is not null and tbl_order_type.ord_type_flag = '1'`;
            }

            script += ` order by tbl_order_type.ord_type_desc asc;`

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


// =========== เพิ่มข้อมูลประเภทการสั่งซื้อ ===========
exports.addPetrolType = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let {
            ptrl_type_desc,
            action
        } = req.body[0];

        // เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_type_desc == undefined || action == undefined) {
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
        let isDescValid = false;
        let descList = [];

        // ======== เช็คข้อมูลประเภทการสั่งซื้อ ==========
        if (typeof ptrl_type_desc === 'object' && !Array.isArray(ptrl_type_desc) && Array.isArray(ptrl_type_desc.desc) && ptrl_type_desc.desc.length > 0) {
            descList = ptrl_type_desc.desc;
            isDescValid = true;
        } else if (Array.isArray(ptrl_type_desc) && ptrl_type_desc.length > 0) {
            descList = ptrl_type_desc;
            isDescValid = true;
        } else if (typeof ptrl_type_desc === 'string' && ptrl_type_desc.trim() !== '') {
            descList = [ptrl_type_desc];
            isDescValid = true;
        }

        // ======= เช็คข้อมูลประเภทการสั่งซื้อ ========== 
        if (!isDescValid) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, ข้อมูลประเภทการสั่งซื้อไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            let logPayload = { ...req.body[0] };
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลประเภทการสั่งซื้อ', JSON.stringify(logPayload), 'ข้อมูลประเภทการสั่งซื้อไม่ถูกต้อง', action[0].value);
            return;
        }

        var script = ``;

        // ============ Loop เพิ่มข้อมูลประเภทการสั่งซื้อ ============
        for (var i = 0; i < descList.length; i++) {
            let desc_value = descList[i];
            if (!desc_value || desc_value.trim() === '') continue;

            let check_script = `SELECT ord_type_desc FROM tbl_order_type WHERE ord_type_desc = '${desc_value.replace(/'/g, "''")}' AND ord_type_flag = '1';`

            let check_tbl_temporary = await pgConn.get(dbPrefix + lic_code, check_script, config.connectionString());

            if (check_tbl_temporary.code || check_tbl_temporary.data.length > 0) {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากมีข้อมูลประเภทการสั่งซื้อนี้อยู่แล้ว`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลประเภทการสั่งซื้อ', JSON.stringify(req.body[0]), 'error', action[0].value);
                return;
            }

            let ptrl_type_code = `otyp-${moment().format('x')}${i}`
            script = `INSERT INTO tbl_order_type 
            (ord_type_code, ord_type_desc, ord_type_flag, ist_dt, mdf_dt, rm_dt) 
            VALUES ('${ptrl_type_code}', '${desc_value.replace(/'/g, "''")}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}', NULL, NULL);`

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
                let logPayload = { ...req.body[0] };
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลประเภทการสั่งซื้อ', JSON.stringify(logPayload), 'ไม่สามารถบันทึกข้อมูล, เนื่องจากมีข้อมูลประเภทการสั่งซื้อนี้อยู่แล้ว', action[0].value);
                return;
            }
        }

        // ============ Success response ============
        let response = [{
            status: 'success',
            invalid_code: '0',
            message: 'เพิ่มข้อมูลประเภทการสั่งซื้อสำเร็จ',
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }]

        res.status(200).send(response);
        let logPayload = { ...req.body[0] };
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลประเภทการสั่งซื้อ', JSON.stringify(logPayload), 'success', action[0].value);
        return;

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
    });

}


// =========== แก้ไขข้อมูลประเภทการสั่งซื้อ ===========
exports.setPetrolType = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { ptrl_type_code } = req.query
        let {
            ptrl_type_desc,
            action
        } = req.body[0];

        // เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_type_code == undefined || ptrl_type_desc == undefined || action == undefined) {
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

        let check_script = `SELECT ord_type_desc FROM tbl_order_type WHERE ord_type_desc = '${ptrl_type_desc.replace(/'/g, "''")}' AND ord_type_flag = '1';`
        let check_tbl_temporary = await pgConn.get(dbPrefix + lic_code, check_script, config.connectionString());
        if (check_tbl_temporary.code || check_tbl_temporary.data.length > 0) {
            let response = [{
                status: 'error',
                invalid_code: '-3',
                message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากมีข้อมูลประเภทการสั่งซื้อนี้อยู่แล้ว`,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]
            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลประเภทการสั่งซื้อ', JSON.stringify(req.body[0]), 'error', action[0].value);
            return;
        }


        let script = `UPDATE tbl_order_type SET ord_type_desc = '${ptrl_type_desc.replace(/'/g, "''")}', mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' WHERE ord_type_code = '${ptrl_type_code}' AND ord_type_flag = '1';`

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
            return;
        }

        // ============ Success response ============
        let response = [{
            status: 'success',
            invalid_code: '0',
            message: 'แก้ไขข้อมูลประเภทการสั่งซื้อสำเร็จ',
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }]

        res.status(200).send(response);
        let logPayload = { ord_type_code, ...req.body[0] };
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลประเภทการสั่งซื้อ', JSON.stringify(logPayload), 'success', action[0].value);
        return;

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
    });

}


// =========== ลบข้อมูลประเภทการสั่งซื้อ ===========
exports.removePetrolType = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let {
            ptrl_type_code,
            action
        } = req.body[0];

        // เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_type_code == undefined || action == undefined) {
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

        let ptrl_type_codeArr = Array.isArray(ptrl_type_code) ? ptrl_type_code : [ptrl_type_code];
        let ptrl_type_codeIn = ptrl_type_codeArr.map(c => `'${c}'`).join(', ');


        let script = `UPDATE tbl_order_type SET ord_type_flag = '0' WHERE ord_type_code IN (${ptrl_type_codeIn});`

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
            return;
        }

        // ============ Success response ============
        let response = [{
            status: 'success',
            invalid_code: '0',
            message: 'แก้ไขข้อมูลประเภทการสั่งซื้อสำเร็จ',
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }]

        res.status(200).send(response);
        let logPayload = { ord_type_code, ...req.body[0] };
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลประเภทการสั่งซื้อ', JSON.stringify(logPayload), 'success', action[0].value);
        return;

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
    });

}