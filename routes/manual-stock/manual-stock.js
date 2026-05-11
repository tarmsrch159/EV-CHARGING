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
                shipto, tank_no, product_no, product_name,
                tank_start, tank_end, recive_val, day_sales,
                date_at, close_at
            } = item;

            const targetShipto = shipto;

            // 1. ดึงข้อมูล Metadata ของปั๊มและถังน้ำมัน เพื่อนำไปใช้ในตาราง Automatics
            const petrolQuery = `
                SELECT p.ptrl_code, p.ptrl_sitecode, t.itm_code, t.tnk_capacity, t.tnk_target, t.tnk_deadstock, t.tnk_safety_factor
                FROM tbl_petrol p
                LEFT JOIN tbl_petrol_tank t ON p.ptrl_code = t.ptrl_code AND t.tnk_number = $2
                WHERE p.ptrl_number = $1 AND p.ptrl_flag = '1'
                LIMIT 1
            `;
            const petrolInfo = await pgConn.getWithParams(dbPrefix + lic_code, petrolQuery, [targetShipto, tank_no], config.connectionString());

            // 2. บันทึกข้อมูลลง tbl_order_eodtank (ตารางหลักของ Manual Stock)
            let insertScript = `
                INSERT INTO tbl_order_eodtank (
                    shipto_no, tank_no, product_no, product_name, 
                    tank_start, tank_end, recive_val, 
                    date_at, close_at, ist_dt
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `;
            let params = [
                targetShipto || null,
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
                continue; // ข้ามไปรายการถัดไปหากบันทึกตารางหลักไม่สำเร็จ
            }

            // 3. หากมีข้อมูลปั๊มและถัง ให้ Sync ไปยังตาราง Automatics สำหรับคำนวณ Auto Order
            if (!petrolInfo.code && petrolInfo.data && petrolInfo.data.length > 0) {
                const info = petrolInfo.data[0];
                const ptrl_code = info.ptrl_code;
                const sh_cus_ref = info.ptrl_sitecode; // ใช้ Site Code เป็นตัวอ้างอิงเบื้องต้น
                const itm_code = info.itm_code || product_no;

                const nowStr = moment().format('YYYY-MM-DD HH:mm:ss');
                const yesterdayStr = moment().subtract(1, 'days').format('YYYY-MM-DD HH:mm:ss');

                const stockAtEnd = moment().subtract(1, 'days').format('YYYY-MM-DD HH:mm:ss');
                const stockAtStart = moment().subtract(2, 'days').format('YYYY-MM-DD HH:mm:ss');

                // บันทึก Tank End (วันนี้)
                const autoCodeEnd = `auto-${moment().format('x')}`;
                const sqlTankEnd = `
                    INSERT INTO tbl_automatics_tanks_information (
                        automatic_code, ptrl_code, tank_code, itm_code, stock, stock_at, ist_dt,
                        tnk_capacity, tnk_target, tnk_deadstock, tnk_safety_factor, sh_cus_ref
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                `;
                const paramsEnd = [
                    autoCodeEnd, ptrl_code, tank_no, itm_code, tank_end, stockAtEnd, nowStr,
                    info.tnk_capacity, info.tnk_target, info.tnk_deadstock, info.tnk_safety_factor, sh_cus_ref
                ];
                console.log(`[Manual Stock] Inserting Tank End:`, paramsEnd);
                const resEnd = await pgConn.execute2params(dbPrefix + lic_code, sqlTankEnd, paramsEnd, config.connectionString());
                console.log(`[Manual Stock] Tank End Result:`, resEnd);

                // บันทึก Tank Start (เมื่อวาน)
                const autoCodeStart = `auto-${moment().format('x')}`;
                const sqlTankStart = `
                    INSERT INTO tbl_automatics_tanks_information (
                        automatic_code, ptrl_code, tank_code, itm_code, stock, stock_at, ist_dt,
                        tnk_capacity, tnk_target, tnk_deadstock, tnk_safety_factor, sh_cus_ref
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                `;
                const paramsStart = [
                    autoCodeStart, ptrl_code, tank_no, itm_code, tank_start, stockAtStart, nowStr,
                    info.tnk_capacity, info.tnk_target, info.tnk_deadstock, info.tnk_safety_factor, sh_cus_ref
                ];
                console.log(`[Manual Stock] Inserting Tank Start:`, paramsStart);
                const resStart = await pgConn.execute2params(dbPrefix + lic_code, sqlTankStart, paramsStart, config.connectionString());
                console.log(`[Manual Stock] Tank Start Result:`, resStart);

                // บันทึกยอดขาย (Sales Previous)
                // const sale_val = (parseFloat(tank_start || 0) + parseFloat(recive_val || 0)) - parseFloat(tank_end || 0);
                // บันทึกยอดขาย (Sales Previous)
                if (parseFloat(day_sales) >= 0) {
                    const autoCodeSale = `auto-${moment().format('x')}`;
                    const sqlSale = `
                        INSERT INTO tbl_automatics_sales_previous_information (
                            automatic_code, ptrl_code, tank_code, itm_code, sale_previous, sale_at_previous, ist_dt, sh_cus_ref
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    `;
                    const paramsSale = [
                        autoCodeSale, ptrl_code, tank_no, itm_code, day_sales, yesterdayStr, nowStr, sh_cus_ref
                    ];
                    console.log(`[Manual Stock] Inserting Sales:`, paramsSale);
                    const resSale = await pgConn.execute2params(dbPrefix + lic_code, sqlSale, paramsSale, config.connectionString());
                    console.log(`[Manual Stock] Sales Result:`, resSale);
                }
            }

            success_count++;
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
