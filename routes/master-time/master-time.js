const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
// const moment = require('moment/tm3.1-typings/moment');
const moment = require('moment');

const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js

exports.getMasterTimeInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { time_code, time_value, page_index, page_limit, action } = req.body[0] || {};

        page_index = page_index == undefined ? 1 : parseInt(page_index);
        page_limit = page_limit == undefined ? 10 : parseInt(page_limit);
        let offset = (page_index > 0 ? page_index - 1 : 0) * page_limit;

        // ========== เช็คเฉพาะส่วนที่สำคัญ ==========
        if (time_code == undefined || time_value == undefined || action == undefined) {
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

        // ========== ตรวจสอบรูปแบบเวลา (Regex) ==========
        const timeFormatRegex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;

        if (time_value != undefined && time_value.toString().toUpperCase() != 'ALL' && !timeFormatRegex.test(time_value.toString())) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'กรุณาใส่รูปแบบเวลาให้ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            return;
        }

        // =========================================================
        //                  จัดการเงื่อนไข WHERE
        // =========================================================
        let conditions = [
            "tbl_master_time.rm_dt IS NULL",
            "tbl_master_time.master_time_flag = '1'"
        ];

        if (time_code.toString().toUpperCase() != 'ALL') {
            conditions.push(`tbl_master_time.time_code = '${time_code}'`);
        }

        if (time_value.toString().toUpperCase() != 'ALL') {
            conditions.push(`tbl_master_time.time_value = '${time_value}'`);
        }

        let whereClause = "WHERE " + conditions.join(" AND ");

        // =========================================================
        //                      Query ดึงข้อมูลหลัก
        // =========================================================
        let script = `
            SELECT 
                tbl_master_time.id,
                tbl_master_time.time_code,
                tbl_master_time.time_value,
                tbl_master_time.ist_dt
            FROM tbl_master_time 
            ${whereClause}
            ORDER BY tbl_master_time.time_value ASC 
            OFFSET ${offset} LIMIT ${page_limit};
        `;

        let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

        if (!tbl_temporary.code) {
            if (tbl_temporary.data.length > 0) {
                tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                // =========================================================
                //           Query หาจำนวนแถวทั้งหมด (Count Rows)
                // =========================================================
                let page_total = 0;
                let rows_total = 0;

                let countScript = `
                    SELECT CEIL((CEIL(SUM(rows_total)) / ${page_limit})) as page_total, SUM(rows_total) as rows_total  
                    FROM (
                        SELECT 1 as rows_total FROM tbl_master_time 
                        ${whereClause}
                    ) xtbl_master;
                `;

                let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, countScript, config.connectionString());

                if (!tbl_temporary0.code && tbl_temporary0.data.length > 0) {
                    page_total = parseInt(tbl_temporary0.data[0].page_total);
                    rows_total = parseInt(tbl_temporary0.data[0].rows_total);
                }

                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: tbl_temporary.data,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss'),
                    page_total: (page_total <= 0 ? 1 : page_total),
                    rows_total: rows_total
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
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลเวลา', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
    });
}


// =========== เพิ่มข้อมูลเวลา (Master Time) ===========
exports.addMasterTimeInformation = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { time_data, action } = req.body[0] || {};

        console.log('time_data', time_data);
        console.log('action', action);

        // ========== เช็คเฉพาะส่วนที่สำคัญ ==========
        if (!time_data || !action) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            return;
        }

        // ========== เช็คว่ามีข้อมูลส่งมาให้บันทึกหรือไม่ ==========
        if (!Array.isArray(time_data) || time_data.length === 0) {
            let response = [{
                status: 'error',
                invalid_code: '-2',
                message: 'ไม่มีข้อมูลเวลาสำหรับบันทึก',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            return;
        }

        let invalid_time_data = []; // ตัวแปรสำหรับเก็บรายการที่ Format ผิด
        let success_count = 0;
        const timeFormatRegex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;
        const now = moment().format('YYYY-MM-DD HH:mm:ss');

        // ========== วนลูป Insert ข้อมูล ==========
        for (let item of time_data) {
            let { time_code, time_value } = item;

            // ตรวจสอบรูปแบบเวลา (Regex)
            if (!time_value || !timeFormatRegex.test(time_value)) {
                invalid_time_data.push(item);
                continue; // ข้ามไปทำรายการถัดไป
            }

            let script = `
                INSERT INTO public.tbl_master_time 
                (time_code, time_value, ist_dt, master_time_flag) 
                VALUES ($1, $2, $3, $4)
            `;

            let tbl_temporary = await pgConn.execute2params(script, [time_code, time_value, now, '1']);

            if (tbl_temporary.code) {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }];
                res.status(200).send(response);

                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลเวลา', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลเวลา', action[0].value);
                return;
            }

            success_count++;
        }

        // ========== สรุปผลการทำงานและส่ง Response ==========
        let responseMessage = 'บันทึกข้อมูลสำเร็จทั้งหมด';

        if (invalid_time_data.length > 0) {
            if (success_count === 0) {
                responseMessage = 'ไม่สามารถบันทึกได้ รูปแบบเวลาไม่ถูกต้องทั้งหมด';
            } else {
                responseMessage = `บันทึกข้อมูลสำเร็จ ${success_count} รายการ, รูปแบบเวลาไม่ถูกต้อง ${invalid_time_data.length} รายการ`;
            }
        }

        let response = [{
            status: 'success',
            invalid_code: '0',
            message: responseMessage,
            invalid_time_data: invalid_time_data,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }];

        res.status(200).send(response);

        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลเวลา', JSON.stringify(req.body[0]), 'success', action[0].value);
        return;

    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }];
        res.status(200).send(response);
    });
};

exports.setMasterTimeInformation = async (req, res, next) => {
    return (async () => {
        let lic_code = req.header('lic_code');
        let { id } = req.query;
        let { time_code, time_value, action } = req.body[0];
        // เช็คเฉพาะส่วนที่สำคัญ
        if (id == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            return;
        }

        let script = `UPDATE public.tbl_master_time 
        SET 
        time_code = $1,
        time_value = $2,
        mdf_dt = $3
        WHERE id = $4`;

        let temporary = await pgConn.execute2params(script, [time_code, time_value, moment().format('YYYY-MM-DD HH:mm:ss'), id]);

        if (temporary.code) {
            let response = [{
                status: 'error',
                invalid_code: '-3',
                message: `ไม่สามารถบันทึกข้อมูล Master Time ได้, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูล Master Time', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล Master Time', action[0].value);
            return;
        }


        let response = [{
            status: 'success',
            invalid_code: '0',
            message: '',
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }];
        res.status(200).send(response);
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Order', JSON.stringify(req.body[0]), 'success', action[0].value);
        return;


    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }];
        res.status(200).send(response);
    });
}



//Success
exports.removeMasterTimeInformationById = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { master_time_id, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (master_time_id == undefined || lic_code == undefined || action == undefined) {
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
            // ดัก petrol_merge_job_id เป็น array
            let master_time_idArr = Array.isArray(master_time_id) ? master_time_id : [master_time_id];
            let master_time_idIn = master_time_idArr.map(c => `'${c}'`).join(', ');
            script = `update tbl_master_time set master_time_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where id in (${master_time_idIn});`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: 'ลบข้อมูล Master Time ได้สำเร็จ',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูล Master Time', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูล Master Time', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูล Master Time', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}
