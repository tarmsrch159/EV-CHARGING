const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../middleware/global');

const dbPrefix = config.dbPrefix();

exports.updateManualStock = async (req, res, next) => {
    let xresult = [];
    return (async () => {
        let lic_code = req.header('lic_code');

        // Pattern แบบเดิม: รับข้อมูลจาก req.body[0]
        if (!req.body || !req.body[0]) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่พบข้อมูลที่ต้องการบันทึก',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            return;
        }

        let { items, action } = req.body[0];

        if (lic_code == undefined || items == undefined || !Array.isArray(items)) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            return;
        }

        let success_count = 0;
        let error_count = 0;

        // แก้ปัญหา Sequence คลาดเคลื่อน (Duplicate Key) โดยการ Sync เลข ID ล่าสุด
        await pgConn.get(dbPrefix + lic_code, `SELECT setval('tbl_order_eodtank_id_seq', (SELECT COALESCE(MAX(id), 0) FROM tbl_order_eodtank))`, config.connectionString());

        for (let item of items) {
            let {
                shipto, shipto_no, tank_no, product_no, product_name,
                tank_start, tank_end, recive_val,
                date_at, close_at
            } = item;

            let insertScript = `
                INSERT INTO tbl_order_eodtank (
                    shipto_no, tank_no, product_no, product_name, 
                    tank_start, tank_end, recive_val, 
                    date_at, close_at, ist_dt
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `;
            let params = [
                shipto || shipto_no || null,
                tank_no || null,
                product_no || null,
                product_name || null,
                tank_start || 0,
                tank_end || 0,
                recive_val || 0,
                date_at || null,
                close_at || null,
                moment().format('YYYY-MM-DD HH:mm:ss')
            ];

            let result = await pgConn.execute2params(dbPrefix + lic_code, insertScript, params, config.connectionString());

            if (result.code) {
                error_count++;
            } else {
                success_count++;
            }
        }

        let finalStatus = error_count === 0 ? 'success' : 'partial_success';
        let message = `บันทึกข้อมูลเรียบร้อย ${success_count} รายการ ${error_count > 0 ? `, ผิดพลาด ${error_count} รายการ` : ''}`;

        // บันทึก Log ตาม Pattern เดิม
        if (action && action.length > 0) {
            await xglobal.action_logs(
                lic_code,
                action[0].id,
                'เพิ่มข้อมูล Manual Stock',
                JSON.stringify(items),
                message,
                action[0].value
            );
        }

        let response = [{
            status: finalStatus,
            invalid_code: '0',
            message: message,
            data: xresult,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }];

        res.status(200).send(response);

    })().catch(err => {
        console.error(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + err.message,
            data: xresult,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }];
        res.status(200).send(response);
    });
};
