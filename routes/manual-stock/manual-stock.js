const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../middleware/global');

const dbPrefix = config.dbPrefix();

exports.updateManualStock = async (req, res, next) => {
    let xresult = [];
    // ประกาศตัวแปรนับจำนวน
    let success_count = 0;
    let error_count = 0;

    return (async () => {
        let lic_code = req.header('lic_code');

        // ตรวจสอบโครงสร้าง req.body
        if (!req.body || !req.body[0]) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่พบข้อมูลที่ต้องการบันทึก',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            return res.status(200).send(response);
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
            return res.status(200).send(response);
        }

        // วนลูปจัดการ Items
        for (let item of items) {
            let {
                shipto, tank_no, product_no, product_name,
                tank_start, tank_end, recive_val, day_sales,
                date_at, close_at, tank_code, ptrl_tank_code
            } = item;

            const targetShipto = shipto;

            try {
                // 1. ดึงข้อมูล
                const petrolQuery = `
                    select tpt.ptrl_tank_code, tpt.ptrl_code, tpt.itm_code, tpt.tnk_number, tpt.tnk_capacity ,tpt.tnk_deadstock, tpt.tnk_target ,tpt.tnk_safety_factor   from tbl_petrol_tank tpt where tpt.ptrl_tank_code = $1
                `;
                const petrolInfo = await pgConn.getWithParams(dbPrefix + lic_code, petrolQuery, [ptrl_tank_code], config.connectionString());

                // 2. บันทึก tbl_order_eodtank
                // let insertScript = `
                //     INSERT INTO tbl_order_eodtank (
                //         shipto_no, tank_no, product_no, product_name, 
                //         tank_start, tank_end, recive_val, 
                //         date_at, close_at, ist_dt
                //     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                // `;
                // let params = [
                //     targetShipto || null, tank_no || null, product_no || null, product_name || null,
                //     tank_start || 0, tank_end || 0, recive_val || 0, date_at || null, close_at || null,
                //     moment().format('YYYY-MM-DD HH:mm:ss')
                // ];
                // let result = await pgConn.execute2params(dbPrefix + lic_code, insertScript, params, config.connectionString());

                // if (result.code) {
                //     error_count++;
                //     continue;
                // }

                // 3. Sync ไปยัง tbl_automatics_tanks_information และ tbl_automatics_sales_previous_information
                if (!petrolInfo.code && petrolInfo.data && petrolInfo.data.length > 0) {
                    const info = petrolInfo.data[0];
                    const ptrl_code = info.ptrl_code;
                    const itm_code = info.itm_code;
                    const target_tank_code = info.ptrl_tank_code;

                    const nowStr = moment().format('YYYY-MM-DD HH:mm:ss');
                    const yesterdayStr = moment().subtract(1, 'days').format('YYYY-MM-DD');
                    const dayBeforeYesterdayStr = moment().subtract(2, 'days').format('YYYY-MM-DD');

                    // ============== Function Manual Stock ===============
                    const syncTank = async (targetStock, targetDate) => {
                        const checkSql = `SELECT automatic_code FROM tbl_automatics_tanks_information WHERE ptrl_code = $1 AND tank_code = $2 AND itm_code = $3 AND stock_at = $4 LIMIT 1`;
                        const existing = await pgConn.getWithParams(dbPrefix + lic_code, checkSql, [ptrl_code, target_tank_code, itm_code, targetDate], config.connectionString());

                        if (!existing.code && existing.data && existing.data.length > 0) {
                            const updateSql = `UPDATE tbl_automatics_tanks_information SET stock = $1, ist_dt = $2, mdf_dt = $3, tnk_capacity = $4, tnk_target = $5, tnk_deadstock = $6, tnk_safety_factor = $7
                                              WHERE ptrl_code = $8 AND tank_code = $9 AND itm_code = $10 AND stock_at = $11`;
                            await pgConn.execute2params(dbPrefix + lic_code, updateSql, [targetStock, nowStr, nowStr, info.tnk_capacity, info.tnk_target, info.tnk_deadstock, info.tnk_safety_factor, ptrl_code, target_tank_code, itm_code, targetDate], config.connectionString());
                        } else {
                            const insertSql = `INSERT INTO tbl_automatics_tanks_information (automatic_code, ptrl_code, tank_code, itm_code, stock, stock_at, ist_dt, mdf_dt, tnk_capacity, tnk_target, tnk_deadstock, tnk_safety_factor) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`;
                            await pgConn.execute2params(dbPrefix + lic_code, insertSql, [`auto-${moment().format('x')}`, ptrl_code, target_tank_code, itm_code, targetStock, targetDate, nowStr, nowStr, info.tnk_capacity, info.tnk_target, info.tnk_deadstock, info.tnk_safety_factor], config.connectionString());
                        }
                    };

                    // ============== Function Manual DaySales ===============
                    const syncSales = async (salesVal, targetDate) => {
                        const checkSql = `SELECT automatic_code FROM tbl_automatics_sales_previous_information WHERE ptrl_code = $1 AND tank_code = $2 AND itm_code = $3 AND sale_at_previous = $4 LIMIT 1`;
                        const existing = await pgConn.getWithParams(dbPrefix + lic_code, checkSql, [ptrl_code, target_tank_code, itm_code, targetDate], config.connectionString());

                        if (!existing.code && existing.data && existing.data.length > 0) {
                            const updateSql = `UPDATE tbl_automatics_sales_previous_information SET sale_previous = $1, ist_dt = $2, mdf_dt = $3 WHERE ptrl_code = $4 AND tank_code = $5 AND itm_code = $6 AND sale_at_previous = $7`;
                            await pgConn.execute2params(dbPrefix + lic_code, updateSql, [salesVal, nowStr, nowStr, ptrl_code, target_tank_code, itm_code, targetDate], config.connectionString());
                        } else {
                            const insertSql = `INSERT INTO tbl_automatics_sales_previous_information (automatic_code, ptrl_code, tank_code, itm_code, sale_previous, sale_at_previous, ist_dt, mdf_dt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
                            await pgConn.execute2params(dbPrefix + lic_code, insertSql, [`auto-${moment().format('x')}`, ptrl_code, target_tank_code, itm_code, salesVal, targetDate, nowStr, nowStr], config.connectionString());
                        }
                    };

                    await syncTank(tank_end, yesterdayStr);
                    await syncTank(tank_start, dayBeforeYesterdayStr);
                    if (day_sales !== undefined && day_sales !== null && day_sales !== '') {
                        await syncSales(day_sales, yesterdayStr);
                    }
                }
                success_count++;
            } catch (innerErr) {
                console.error(innerErr);
                error_count++;
            }
        } // จบ loop items

        let finalStatus = error_count === 0 ? 'success' : 'partial_success';
        let message = `บันทึกข้อมูลเรียบร้อย ${success_count} รายการ ${error_count > 0 ? `, ผิดพลาด ${error_count} รายการ` : ''}`;

        if (action && action.length > 0) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Manual Stock', JSON.stringify(items), message, action[0].value);
        }

        res.status(200).send([{
            status: finalStatus,
            invalid_code: '0',
            message: message,
            data: xresult,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }]);

    })().catch(err => {
        console.error(err);
        res.status(200).send([{
            status: 'error',
            invalid_code: '-4',
            message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + err.message,
            data: xresult,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }]);
    });
};