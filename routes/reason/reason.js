const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

// =========================================================
//              ดึงข้อมูลเหตุผล (Reason Information)
// =========================================================
exports.getReasonInformation = async (req, res, next) => {
    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { reason_id, search, page_index, page_limit, action } = req.body[0] || {};

        // กำหนดค่าเริ่มต้นสำหรับ Pagination
        page_index = page_index === undefined ? 1 : page_index;
        page_limit = page_limit === undefined || page_limit === "" ? 10 : page_limit;

        // ========== เช็คเฉพาะส่วนที่สำคัญ ==========
        if (action == undefined) {
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

        // =========================================================
        //                  จัดการเงื่อนไข WHERE
        // =========================================================
        let conditions = [
            "tbl_reason.rm_dt IS NULL",
            "tbl_reason.reason_flag = 1"
        ];

        if (reason_id != undefined && reason_id.toString().toUpperCase() != 'ALL' && reason_id != "") {
            conditions.push(`tbl_reason.reason_id = ${reason_id}`);
        }

        if (search != undefined && search != "") {
            conditions.push(`(
                CAST(tbl_reason.reason_id AS TEXT) LIKE '%${search}%' 
                OR tbl_reason.reason_desc LIKE '%${search}%'
            )`);
        }

        let paginationClause = ``;

        if (page_limit.toString().toUpperCase() != "ALL") {
            let limit = parseInt(page_limit);
            let offset = (page_index - 1) * limit;
            paginationClause = `LIMIT ${limit} OFFSET ${offset}`;
        }

        let whereClause = "WHERE " + conditions.join(" AND ");

        // =========================================================
        //                      Query ดึงข้อมูลหลัก
        // =========================================================
        let script = `
            SELECT 
                tbl_reason.reason_id,
                tbl_reason.reason_desc,
                tbl_reason.ist_dt,
                tbl_reason.mdf_dt
            FROM tbl_reason 
            ${whereClause}
            ORDER BY tbl_reason.ist_dt DESC 
            ${paginationClause};
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



                let countScript = ``;
                if (page_limit.toString().toUpperCase() === "ALL") {
                    countScript = `
                        SELECT 
                            1 as page_total, 
                            COUNT(tbl_reason.reason_id) as rows_total 
                        FROM tbl_reason 
                        ${whereClause};
                    `;
                } else {
                    countScript = `
                        SELECT 
                            CEIL(COUNT(tbl_reason.reason_id)::float / ${parseInt(page_limit)}) as page_total, 
                            COUNT(tbl_reason.reason_id) as rows_total 
                        FROM tbl_reason 
                        ${whereClause};
                    `;
                }

                let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, countScript, config.connectionString());

                if (!tbl_temporary0.code && tbl_temporary0.data.length > 0) {
                    page_total = parseInt(tbl_temporary0.data[0].page_total) || 1;
                    rows_total = parseInt(tbl_temporary0.data[0].rows_total) || 0;
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
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลเหตุผล', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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

// =========================================================
//                เพิ่มข้อมูลเหตุผล (Add Reason)
// =========================================================
exports.addReasonInformation = async (req, res, next) => {
    return (async () => {
        let lic_code = req.header('lic_code');
        let { reason_desc, action } = req.body[0] || {};

        // ========== เช็คเฉพาะส่วนที่สำคัญ ==========
        if (!reason_desc || !action) {
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

        // ตรวจสอบว่ามีข้อมูลซ้ำหรือไม่
        let checkScript = `SELECT reason_id FROM tbl_reason WHERE reason_desc = '${reason_desc}' AND rm_dt IS NULL AND reason_flag = 1`;
        let checkRes = await pgConn.get(dbPrefix + lic_code, checkScript, config.connectionString());

        if (!checkRes.code && checkRes.data.length > 0) {
            let response = [{
                status: 'error',
                invalid_code: '-2',
                message: 'ไม่สามารถบันทึกข้อมูลได้, เนื่องจากมีข้อมูลนี้อยู่ในระบบแล้ว',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            return;
        }

        const now = moment().format('YYYY-MM-DD HH:mm:ss');

        let script = `
            INSERT INTO tbl_reason 
            (reason_desc, reason_flag, ist_dt) 
            VALUES ('${reason_desc}', 1, '${now}')
            RETURNING reason_id
        `;

        let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

        if (tbl_temporary.code) {
            let response = [{
                status: 'error',
                invalid_code: '-3',
                message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลเหตุผล', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลเหตุผล', action[0].value);
            return;
        }


        let response = [{
            status: 'success',
            invalid_code: '0',
            message: 'บันทึกข้อมูลสำเร็จ',
            data: [{ reason_desc: reason_desc || "" }],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }];

        res.status(200).send(response);
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลเหตุผล', JSON.stringify(req.body[0]), 'success', action[0].value);

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

// =========================================================
//               แก้ไขข้อมูลเหตุผล (Edit Reason)
// =========================================================
exports.setReasonInformation = async (req, res, next) => {
    return (async () => {
        let lic_code = req.header('lic_code');
        let { reason_id } = req.query; // รับค่า Code จาก Query String
        let { reason_desc, action } = req.body[0];

        if (reason_id == undefined || action == undefined) {
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

        let script = `
            UPDATE tbl_reason 
            SET 
                reason_desc = $1,
                mdf_dt = $2
            WHERE reason_id = $3 AND rm_dt IS NULL
        `;

        let temporary = await pgConn.execute2params(script, [reason_desc, moment().format('YYYY-MM-DD HH:mm:ss'), reason_id]);

        if (temporary.code) {
            let response = [{
                status: 'error',
                invalid_code: '-3',
                message: `ไม่สามารถแก้ไขข้อมูลเหตุผลได้, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลเหตุผล', JSON.stringify(req.body[0]), 'ไม่สามารถแก้ไขข้อมูลเหตุผล', action[0].value);
            return;
        }

        let response = [{
            status: 'success',
            invalid_code: '0',
            message: 'แก้ไขข้อมูลสำเร็จ',
            data: [{
                reason_desc: reason_desc
            }],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }];
        res.status(200).send(response);
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลเหตุผล', JSON.stringify(req.body[0]), 'success', action[0].value);

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

// =========================================================
//            ลบข้อมูลเหตุผล (Soft Delete Reason)
// =========================================================
exports.removeReasonInformation = async (req, res, next) => {
    return (async () => {
        let lic_code = req.header('lic_code');
        let { reason_id, action } = req.body[0];

        if (reason_id == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถลบข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            return;
        }

        // รองรับการลบหลายรายการพร้อมกัน (Array)
        let reasonIdsArr = Array.isArray(reason_id) ? reason_id : [reason_id];
        let reasonIdsIn = reasonIdsArr.map(id => `${id}`).join(', ');

        let script = `
            UPDATE tbl_reason 
            SET 
                reason_flag = 0, 
                rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            WHERE reason_id IN (${reasonIdsIn})
        `;

        let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

        if (!tbl_temporary.code) {
            let response = [{
                status: 'success',
                invalid_code: '0',
                message: 'ลบข้อมูลเหตุผลสำเร็จ',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลเหตุผล', JSON.stringify(req.body[0]), 'success', action[0].value);
        } else {
            let response = [{
                status: 'error',
                invalid_code: '-3',
                message: `ไม่สามารถลบข้อมูลได้, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลเหตุผล', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูลเหตุผล', action[0].value);
        }

    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถลบข้อมูลได้, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }];
        res.status(200).send(response);
    });
}
