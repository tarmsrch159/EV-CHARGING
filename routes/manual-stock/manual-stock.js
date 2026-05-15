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
                date_at, close_at, tank_code, ptrl_tank_code,
                stock_at,
                stock_after_day
            } = item;

            const targetShipto = shipto;

            try {

                const petrolQuery = `
                    select tpt.ptrl_tank_code, tpt.ptrl_code,p.ptrl_desc, 
                    p.ptrl_number as shipto,tpt.itm_code, tpt.tnk_number, 
                    tpt.tnk_capacity ,tpt.tnk_deadstock , tpt.tnk_target ,
                    tpt.tnk_safety_factor, it.itm_desc   
                    from tbl_petrol_tank tpt 
                    left join tbl_petrol p on tpt.ptrl_code = p.ptrl_code
                    left join tbl_item it on tpt.itm_code = it.itm_code
                    where tpt.ptrl_tank_code = $1
                `;
                const petrolInfo = await pgConn.getWithParams(dbPrefix + lic_code, petrolQuery, [ptrl_tank_code], config.connectionString());


                // Sync ไป tbl_automatics_tanks_information และ tbl_automatics_sales_previous_information
                if (!petrolInfo.code && petrolInfo.data && petrolInfo.data.length > 0) {
                    const info = petrolInfo.data[0];
                    const ptrl_code = info.ptrl_code;
                    const itm_code = info.itm_code;
                    const target_tank_code = info.ptrl_tank_code;

                    const nowStr = moment().format('YYYY-MM-DD HH:mm:ss');
                    const yesterdayStr = moment().subtract(1, 'days').format('YYYY-MM-DD');
                    const dayBeforeYesterdayStr = moment().subtract(2, 'days').format('YYYY-MM-DD');
                    const stock_at_date = moment(stock_at).format('YYYY-MM-DD');
                    const dayBefore_stock_at_date = moment(stock_at).subtract(1, 'days').format('YYYY-MM-DD');
                    let resultEndStock = tank_end
                    if (stock_after_day) {
                        resultEndStock = stock_after_day + tank_end
                    }

                    let item_changes = [];
                    let day_sales_changes = [];
                    let item_day_sales_logs = [];
                    let item_logs_change = [];

                    // ============== Function Manual Stock ===============
                    const syncTank = async (targetStock, targetDate, label) => {
                        const checkSql = `SELECT automatic_code, stock FROM tbl_automatics_tanks_information WHERE ptrl_code = $1 AND tank_code = $2 AND itm_code = $3 AND stock_at = $4 LIMIT 1`;
                        const existing = await pgConn.getWithParams(dbPrefix + lic_code, checkSql, [ptrl_code, target_tank_code, itm_code, targetDate], config.connectionString());

                        let beforeValue = "0";
                        if (!existing.code && existing.data && existing.data.length > 0) {
                            beforeValue = String(existing.data[0].stock || 0);
                            const updateSql = `UPDATE tbl_automatics_tanks_information SET stock = $1, ist_dt = $2, mdf_dt = $3, tnk_capacity = $4, tnk_target = $5, tnk_deadstock = $6, tnk_safety_factor = $7
                                              WHERE ptrl_code = $8 AND tank_code = $9 AND itm_code = $10 AND stock_at = $11`;
                            await pgConn.execute2params(dbPrefix + lic_code, updateSql, [targetStock, nowStr, nowStr, info.tnk_capacity, info.tnk_target, info.tnk_deadstock, info.tnk_safety_factor, ptrl_code, target_tank_code, itm_code, targetDate], config.connectionString());
                        } else {
                            const insertSql = `INSERT INTO tbl_automatics_tanks_information (automatic_code, ptrl_code, tank_code, itm_code, stock, stock_at, ist_dt, mdf_dt, tnk_capacity, tnk_target, tnk_deadstock, tnk_safety_factor) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`;
                            await pgConn.execute2params(dbPrefix + lic_code, insertSql, [`auto-${moment().format('x')}`, ptrl_code, target_tank_code, itm_code, targetStock, targetDate, nowStr, nowStr, info.tnk_capacity, info.tnk_target, info.tnk_deadstock, info.tnk_safety_factor], config.connectionString());
                        }

                        if (beforeValue !== String(targetStock)) {
                            // ============ Item change Before After =============
                            item_changes.push({ field: `${label} (${targetDate})`, before: beforeValue, after: String(targetStock) });
                            // ============ Item logs change Before After =============
                            item_logs_change.push({ field: `${label}`, before: beforeValue, after: String(targetStock) })
                        }
                    };

                    // ============== Function Manual DaySales ===============
                    const syncSales = async (salesVal, targetDate) => {
                        const checkSql = `SELECT automatic_code, sale_previous FROM tbl_automatics_sales_previous_information WHERE ptrl_code = $1 AND tank_code = $2 AND itm_code = $3 AND sale_at_previous = $4 LIMIT 1`;
                        const existing = await pgConn.getWithParams(dbPrefix + lic_code, checkSql, [ptrl_code, target_tank_code, itm_code, targetDate], config.connectionString());

                        let beforeValue = 0;
                        if (!existing.code && existing.data && existing.data.length > 0) {
                            beforeValue = existing.data[0].sale_previous || 0;
                            const updateSql = `UPDATE tbl_automatics_sales_previous_information SET sale_previous = $1, ist_dt = $2, mdf_dt = $3 WHERE ptrl_code = $4 AND tank_code = $5 AND itm_code = $6 AND sale_at_previous = $7`;
                            await pgConn.execute2params(dbPrefix + lic_code, updateSql, [salesVal, nowStr, nowStr, ptrl_code, target_tank_code, itm_code, targetDate], config.connectionString());
                        } else {
                            const insertSql = `INSERT INTO tbl_automatics_sales_previous_information (automatic_code, ptrl_code, tank_code, itm_code, sale_previous, sale_at_previous, ist_dt, mdf_dt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
                            await pgConn.execute2params(dbPrefix + lic_code, insertSql, [`auto-${moment().format('x')}`, ptrl_code, target_tank_code, itm_code, salesVal, targetDate, nowStr, nowStr], config.connectionString());
                        }



                        if (beforeValue !== Number(salesVal)) {
                            day_sales_changes.push({ field: `ยอดขาย POS (${targetDate})`, before: beforeValue, after: String(salesVal) });
                            item_day_sales_logs.push({ field: `ยอดขาย POS`, before: beforeValue, after: String(salesVal) })
                        }
                    };



                    await syncTank(resultEndStock, stock_at_date, 'Stock สิ้นวัน');
                    await syncTank(tank_start, dayBefore_stock_at_date, 'Stock เริ่มวัน');
                    if (day_sales !== undefined && day_sales !== null && day_sales !== '') {
                        await syncSales(day_sales, stock_at_date);
                    }

                    console.log("item_logs_change : ", item_logs_change)

                    // บันทึก Log ราย Item (Audit Log)
                    if (item_changes.length > 0 && action && action.length > 0) {
                        let event_type = 'override';
                        let logPayloadObj = {
                            order_no: "-",
                            order_id: "-",
                            ship_to: info.shipto,
                            reason: "Manual Stock Update",
                            changes: item_changes,

                        };
                        await xglobal.action_logs(lic_code, action[0].id, event_type, JSON.stringify(logPayloadObj), "success", action[0].value);


                        let logPayloadManualStock = {
                            date_time: stock_at,
                            ptrl_code: info.ptrl_code,
                            ptrl_desc: info.ptrl_desc,
                            tnk_number: info.tnk_number,
                            item_desc: info.itm_desc,
                            tank_start: tank_start,
                            tank_end: tank_end,
                            day_sales: day_sales,
                            stock_after_day: stock_after_day,
                            action_id: action[0].id,
                            action_value: action[0].value,
                            reason: "Manual Stock Logs",
                            changes: item_logs_change,
                            day_sales_changes: item_day_sales_logs
                        };
                        await xglobal.action_logs(lic_code, action[0].id, event_type, JSON.stringify(logPayloadManualStock), "success", action[0].value);
                    }

                    if (day_sales_changes.length > 0 && action && action.length > 0) {
                        let event_type = 'override';
                        let logPayloadObj = {
                            order_no: "-",
                            order_id: "-",
                            ship_to: info.shipto,
                            reason: "Manual Day Sales Update",
                            changes: day_sales_changes
                        };
                        await xglobal.action_logs(lic_code, action[0].id, event_type, JSON.stringify(logPayloadObj), "success", action[0].value);
                    }
                }
                success_count++;
            } catch (innerErr) {
                console.error(innerErr);
                error_count++;
            }
        }

        let finalStatus = error_count === 0 ? 'success' : 'partial_success';
        let message = `บันทึกข้อมูลเรียบร้อย ${success_count} รายการ ${error_count > 0 ? `, ผิดพลาด ${error_count} รายการ` : ''}`;

        if (action && action.length > 0) {
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูล Manual Stock', JSON.stringify(items), message, action[0].value);
        }

        res.status(200).send([{
            status: 'success',
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

exports.getManualStockLogs = async (req, res, next) => {
    return (async () => {
        let lic_code = req.header('lic_code');

        if (!req.body || !req.body[0]) {
            return res.status(200).send([{
                status: 'error',
                invalid_code: '-1',
                message: 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]);
        }

        let body = req.body[0];
        let ptrl_code = (body.items && body.items[0]) ? body.items[0].ptrl_code : body.ptrl_code;
        let start_date = (body.items && body.items[0]) ? body.items[0].start_date : body.start_date;

        let params = [];
        let script = `
            SELECT l.action_body, l.action_code, l.ist_dt,
                   empr.emp_role_desc as emp_role, em.emp_username, em.emp_name || ' ' || em.emp_surname as emp_name
            FROM tbl_action_logs l
            LEFT JOIN tbl_employee em ON l.action_code = em.emp_code
            LEFT JOIN tbl_employee_role empr ON em.emp_role_code = empr.emp_role_code
            WHERE l.action_desc = 'override' 
              AND l.action_body ILIKE '%"reason":"Manual Stock Logs"%'
        `;

        if (ptrl_code && ptrl_code !== 'ALL') {
            params.push(ptrl_code);
            script += ` AND l.action_body::jsonb->>'ptrl_code' = $${params.length}`;
        }

        if (start_date) {
            params.push(`${moment(start_date).format('YYYY-MM-DD')}`);
            script += ` AND LEFT(l.action_body::jsonb->>'date_time', 10) = $${params.length}`;
        }

        script += ` ORDER BY (l.action_body::jsonb->>'tnk_number')::int ASC, l.ist_dt DESC LIMIT 1000`;

        let result = await pgConn.getWithParams(dbPrefix + lic_code, script, params, config.connectionString());

        if (!result.code) {
            let logs = result.data.map(item => {
                try {
                    let body = JSON.parse(item.action_body);
                    return {
                        ...body,
                        emp_role: item.emp_role || '',
                        emp_username: item.emp_username || '',
                        emp_name: item.emp_name || '',
                        ist_dt: item.ist_dt
                    };
                } catch (e) {
                    return null;
                }
            }).filter(item => item !== null);

            res.status(200).send([{
                status: 'success',
                invalid_code: '0',
                message: 'ดึงข้อมูลสำเร็จ',
                data: logs,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]);
        } else {
            res.status(200).send([{
                status: 'error',
                invalid_code: '-3',
                message: 'ไม่สามารถดึงข้อมูลได้',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]);
        }
    })().catch(err => {
        console.error(err);
        res.status(200).send([{
            status: 'error',
            invalid_code: '-4',
            message: 'เกิดข้อผิดพลาด: ' + err.message,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }]);
    });
};