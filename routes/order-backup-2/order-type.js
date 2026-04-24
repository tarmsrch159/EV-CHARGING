const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

// ========== ดึงข้อมูลประเภท Order (API) ==========
exports.getOrderTypeInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        // ========== ดึงข้อมูลสำคัญจาก Header และ Reqeust Body ==========
        let lic_code = req.header('lic_code');
        let { ord_type_code, action } = req.body[0] || {};

        // ========== เช็คเฉพาะส่วนที่สำคัญ ==========
        if (ord_type_code == undefined || lic_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            return;
        }

        // ========== จัดการเงื่อนไข WHERE ==========
        let conditions = ["tbl_order_type.ord_type_flag = '1'"];

        if (ord_type_code.toString().toUpperCase() != 'ALL') {
            conditions.push(`tbl_order_type.ord_type_code = '${ord_type_code}'`);
        } else {
            conditions.push(`tbl_order_type.ord_type_code IS NOT NULL`);
        }

        let whereClause = "WHERE " + conditions.join(" AND ");

        // ========== ประกอบ Query ==========
        let script = `
            SELECT 
                tbl_order_type.ord_type_code, 
                tbl_order_type.sales_order_type,
                tbl_order_type.ord_type_desc, 
                tbl_order_type.ord_type_flag, 
                tbl_order_type.ist_dt, 
                tbl_order_type.mdf_dt, 
                tbl_order_type.rm_dt 
            FROM tbl_order_type
            ${whereClause}
            ORDER BY tbl_order_type.ord_type_desc ASC;
        `;

        // ========== ดึงข้อมูลจาก Database ==========
        let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

        if (!tbl_temporary.code) {

            if (tbl_temporary.data.length > 0) {
                tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: tbl_temporary.data,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }];
                res.status(200).send(response);
                return;
            } else {
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }];
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
            }];
            res.status(200).send(response);


            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลประเภท Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        }];
        res.status(200).send(response);

        let lic_code = req.header('lic_code');
        let action = req.body && req.body[0] ? req.body[0].action : null;
        if (lic_code && action) {

            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลประเภท Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        }
        return;
    });
}

// ========== เพิ่มข้อมูลประเภทการสั่งซื้อ ==========
exports.addOrderType = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let {
            ord_type_desc,
            action
        } = req.body[0];

        // ========== เช็คข้อมูลพารามิเตอร์ที่ส่งมา ==========
        if (ord_type_desc == undefined || action == undefined) {
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

        // ========== ตรวจสอบและจัดรูปแบบข้อมูลประเภทการสั่งซื้อ ==========
        if (typeof ord_type_desc === 'object' && !Array.isArray(ord_type_desc) && Array.isArray(ord_type_desc.desc) && ord_type_desc.desc.length > 0) {
            descList = ord_type_desc.desc;
            isDescValid = true;
        } else if (Array.isArray(ord_type_desc) && ord_type_desc.length > 0) {
            descList = ord_type_desc;
            isDescValid = true;
        } else if (typeof ord_type_desc === 'string' && ord_type_desc.trim() !== '') {
            descList = [ord_type_desc];
            isDescValid = true;
        }

        // ========== ตรวจสอบความถูกต้องของข้อมูล (Validation) ==========
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

        // ========== วนลูปเพื่อบันทึกข้อมูลประเภทการสั่งซื้อใหม่ ==========
        for (var i = 0; i < descList.length; i++) {
            let desc_value = descList[i];
            if (!desc_value || desc_value.trim() === '') continue;

            // ========== ตรวจสอบว่ามีข้อมูลประเภทการสั่งซื้อที่ซ้ำกันหรือไม่ (Duplicate Check) ==========
            let check_script = `SELECT ord_type_desc FROM tbl_order_type WHERE ord_type_desc = '${desc_value.replace(/'/g, "''")}' AND ord_type_flag = '1';`
            console.log(check_script)
            let check_tbl_temporary = await pgConn.get(dbPrefix + lic_code, check_script, config.connectionString());
            console.log(check_tbl_temporary)
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

            let ord_type_code = `otyp-${moment().format('x')}${i}`
            script = `INSERT INTO tbl_order_type 
            (ord_type_code, ord_type_desc, ord_type_flag, ist_dt, mdf_dt, rm_dt) 
            VALUES ($1, $2, '1', $3, NULL, NULL);`

            // ========== บันทึกข้อมูลประเภทการสั่งซื้อใหม่ลงใน Database (Execute Query) ==========
            let tbl_temporary = await pgConn.execute2params(script, [ord_type_code, desc_value.replace(/'/g, "''"), moment().format('YYYY-MM-DD HH:mm:ss')]);

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

        // ========== ส่งผลลัพธ์การบันทึกข้อมูลสำเร็จ ==========
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

// ========== แก้ไขข้อมูลประเภทการสั่งซื้อ ==========
exports.setOrderType = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { ord_type_code } = req.query
        let {
            ord_type_desc,
            action
        } = req.body[0];

        // ========== เช็คข้อมูลพารามิเตอร์ที่ส่งมา ==========
        if (ord_type_code == undefined || ord_type_desc == undefined || action == undefined) {
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

        // ========== ตรวจสอบว่าชื่อประเภทการสั่งซื้อใหม่มีอยู่แล้วหรือไม่ (Duplicate Check) ==========
        let check_script = `SELECT ord_type_desc FROM tbl_order_type WHERE ord_type_desc = '${ord_type_desc.replace(/'/g, "''")}' AND ord_type_flag = '1';`
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


        let script = `UPDATE tbl_order_type SET ord_type_desc = $1, mdf_dt = $2 WHERE ord_type_code = $3 AND ord_type_flag = '1';`

        let tbl_temporary = await pgConn.execute2params(script, [ord_type_desc.replace(/'/g, "''"), moment().format('YYYY-MM-DD HH:mm:ss'), ord_type_code]);
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

        // ========== ส่งผลลัพธ์การแก้ไขข้อมูลสำเร็จ ==========
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

// ========== ลบข้อมูลประเภทการสั่งซื้อ (Soft Delete) ==========
exports.removeOrderType = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let {
            ord_type_code,
            action
        } = req.body[0];

        // ========== เช็คข้อมูลพารามิเตอร์ที่ส่งมา ==========
        if (ord_type_code == undefined || action == undefined) {
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

        // ========== จัดการรูปแบบข้อมูลรหัสประเภทการสั่งซื้อเพื่อใช้ใน IN clause ==========
        let order_type_codeArr = Array.isArray(ord_type_code) ? ord_type_code : [ord_type_code];
        let order_type_codeIn = order_type_codeArr.map(c => `'${c}'`).join(', ');


        let script = `UPDATE tbl_order_type SET ord_type_flag = '0' WHERE ord_type_code IN (${order_type_codeIn});`

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

        // ========== ส่งผลลัพธ์การลบข้อมูลสำเร็จ ==========
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
