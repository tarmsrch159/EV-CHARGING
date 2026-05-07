const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../middleware/global');

const dbPrefix = config.dbPrefix();

const formatIfValid = (date) => {
    return moment(date, moment.ISO_8601, true).isValid()
        ? moment(date).format('YYYY-MM-DD')
        : null;
};

exports.syncSalesInfo = async (date_at, ptrl_number, lic_code) => {
    date_at = date_at ? moment(date_at).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD');
    date_at = moment(date_at).subtract(1, 'days').format('YYYY-MM-DD');
    ptrl_number = ptrl_number ? ptrl_number : 'ALL';

    if (!lic_code) {
        return;
    }

    try {
        let wh = '';
        let param = [];
        param.push(date_at);

        if (ptrl_number && ptrl_number !== 'ALL' && ptrl_number !== '') {
            param.push(ptrl_number);
            wh += ` AND tpr.ptrl_number = $${param.length} `;
        }

        const dayIndex = moment(date_at).day();
        const coverageDays = 3;
        const threshold = 2000; // ถ้าน้อยกว่า 2000 ลิตร ไม่ต้องสั่ง

        let scriptSql = `
            WITH daily_stats AS (
                SELECT 
                    tpr.ptrl_sitecode,
                    tpt.tnk_number,
                    tpt.tnk_capacity,
                    tpt.tnk_target,
                    tpt.tnk_deadstock AS un_pump,
                    tank.date_at::date as record_date,
                    COALESCE(meter_summary.day_sales, 0) AS day_sales,
                    COALESCE(tank.tank_end, 0) + COALESCE(tank.recive_val::NUMERIC, 0) AS current_stock
                FROM tbl_petrol_tank tpt 
                INNER JOIN tbl_petrol tpr ON tpt.ptrl_code = tpr.ptrl_code
                LEFT JOIN tbl_order_eodtank tank ON (tpt.tnk_number = tank.tank_no AND tpr.ptrl_sitecode = tank.shipto_no)
                LEFT JOIN (
                    SELECT tank_no, shipto_no, buy_date, SUM(meter_diff) AS day_sales
                    FROM (
                        SELECT DISTINCT ON (shipto_no, tank_no, buy_date, meter_start)
                            shipto_no, tank_no, buy_date, ABS(meter_end - meter_start) AS meter_diff
                        FROM tbl_order_eodmeter
                        ORDER BY shipto_no, tank_no, buy_date, meter_start, id DESC
                    ) AS m GROUP BY tank_no, shipto_no, buy_date
                ) meter_summary ON (tpt.tnk_number = meter_summary.tank_no AND tpr.ptrl_sitecode = meter_summary.shipto_no AND tank.date_at = meter_summary.buy_date)
                WHERE 1=1 ${wh}
            ),
            raw_data AS (
                SELECT 
                    ptrl_sitecode,
                    tnk_number,
                    tnk_capacity,
                    tnk_target,
                    un_pump,
                    MAX(CASE WHEN record_date = $1 THEN day_sales END) AS day_sales,
                    COALESCE(
                        MAX(CASE WHEN record_date = $1 THEN current_stock END),
                        MAX(CASE WHEN record_date = $1::date - 1 THEN current_stock END),
                        0
                    ) AS current_stock,
                    AVG(CASE WHEN record_date < $1 
                            AND record_date >= $1::date - INTERVAL '7 weeks'
                            AND EXTRACT(DOW FROM record_date) = ${dayIndex}
                        THEN day_sales END
                    ) AS avg_prev,
                    AVG(CASE 
                        WHEN record_date BETWEEN ($1::date - INTERVAL '1 year') 
                            AND ($1::date - INTERVAL '1 year' + INTERVAL '7 weeks')
                        AND EXTRACT(DOW FROM record_date) = ${dayIndex}
                        THEN day_sales END
                    ) AS avg_next,
                    $1::date AS at_date,
                    NOW() AS now_time
                FROM daily_stats
                GROUP BY ptrl_sitecode, tnk_number, tnk_capacity, tnk_target, un_pump
            ),
            source_data AS (
                SELECT *,
                    (CASE WHEN current_stock IS NOT NULL THEN (tnk_target - current_stock) END ) AS suggest_qty
                FROM raw_data
            ),
            ins_sales AS (
                INSERT INTO tbl_petrol_sales (
                    ptrl_sitecode, tnk_number, day_sales, 
                    avg_prev, avg_next, sales_at, ist_dt, mdf_dt
                )
                SELECT 
                    ptrl_sitecode, tnk_number, day_sales, 
                    COALESCE(avg_prev, 0), COALESCE(avg_next, 0), 
                    at_date, now_time, now_time     
                FROM source_data
                WHERE day_sales IS NOT NULL AND day_sales > 0
                ON CONFLICT (ptrl_sitecode, tnk_number, sales_at) 
                DO UPDATE SET 
                    day_sales = EXCLUDED.day_sales,
                    avg_prev = EXCLUDED.avg_prev,
                    avg_next = EXCLUDED.avg_next,
                    mdf_dt = NOW()
                RETURNING *
            ),
            ins_stock AS (
                INSERT INTO tbl_petrol_stock (ptrl_sitecode, tnk_number, stock, stock_at, ist_dt, mdf_dt)
                SELECT ptrl_sitecode, tnk_number, current_stock, at_date, now_time, now_time 
                FROM source_data
                WHERE current_stock > 0
                ON CONFLICT (ptrl_sitecode, tnk_number, stock_at) 
                DO UPDATE SET stock = EXCLUDED.stock, mdf_dt = NOW()
            )
            INSERT INTO tbl_petrol_order (ptrl_sitecode, tnk_number, suggest_qty, at_date, ist_dt, mdf_dt)
            SELECT 
                ptrl_sitecode, 
                tnk_number, 
                suggest_qty, 
                at_date, 
                now_time, 
                now_time 
            FROM source_data
            WHERE suggest_qty > 0
            ON CONFLICT (ptrl_sitecode, tnk_number, at_date) 
            DO UPDATE SET 
                suggest_qty = EXCLUDED.suggest_qty, 
                mdf_dt = NOW();
        `;

        await pgConn.getWithParams(dbPrefix + lic_code, scriptSql, param, config.connectionString());
        await xglobal.action_logs(lic_code, 'SYSTEM', 'Sync Sales', JSON.stringify({ date_at, ptrl_number }), 'success', 'SYSTEM');
        return;
    } catch (error) {
        console.log(error);
        await xglobal.action_logs(lic_code, 'SYSTEM', 'Sync Sales', JSON.stringify({ date_at, ptrl_number }), 'error', 'SYSTEM');
        return;
    }
}

exports.getReportStock = async (req, res, next) => {
    var xresult = [];
    let { date_at, ptrl_number, ptrl_sitecode, action } = req.body[0];
    let lic_code = req.header('lic_code');
    let roleId = action[0].id;
    let roleValue = action[0].value !== 'ALL' ? action[0].value : 'ALL';

    if (!lic_code || !ptrl_sitecode) {
        let response = [{
            status: 'error',
            invalid_code: '-1',
            message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
            data: xresult,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }]

        res.status(200).send(response);
        return
    }

    try {
        date_at = date_at ? moment(date_at).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD');
        date_at = moment(date_at).subtract(1, 'days').format('YYYY-MM-DD');
        console.log('date_at', date_at);
        console.log('ptrl_sitecode', ptrl_sitecode);

        let param = [];
        param.push(date_at); // $1
        param.push(ptrl_sitecode); // $2

        let scriptSql = `
            SELECT
                tpr.ptrl_sitecode AS shipto,
                $1::date AS date_at,
                JSONB_AGG(
                    JSONB_BUILD_OBJECT(
                        'ptrl_tank_code', tpt.ptrl_tank_code,
                        'tank_no', tpt.tnk_number,
                        'itm_code', tit.itm_code,
                        'itm_material_number', tit.itm_material_number,
                        'product_no', eod.product_no,
                        'itm_desc', tit.itm_desc,
                        'un_pump', COALESCE(auto_tank.tnk_deadstock, tpt.tnk_deadstock),
                        'max_stock', COALESCE(auto_tank.tnk_capacity, tpt.tnk_capacity),
                        'target_stock', tpt.tnk_target,
                        'tank_start', COALESCE(auto_tank.tank_start, 0),
                        'tank_end', COALESCE(auto_tank.tank_end, 0),
                        'total_sales', COALESCE(auto_sales.total_sales, 0),
                        'min_stock', COALESCE(auto_sales.total_sales, 0) + COALESCE(auto_tank.tnk_deadstock, tpt.tnk_deadstock, 0),
                        'recive_val', 0,
                        'current_stock', COALESCE(auto_tank.tank_end, 0),
                        'dpo_desc', (SELECT dpo_desc FROM tbl_depot WHERE dpo_code = (SELECT dpo_code FROM tbl_petrol_depot WHERE ptrl_code = tpr.ptrl_code AND rm_dt IS NULL LIMIT 1))
                    )
                    ORDER BY tpt.tnk_number ASC
                ) AS data
            FROM tbl_petrol_tank tpt 
            INNER JOIN (
                SELECT ptrl_code, ptrl_sitecode FROM tbl_petrol WHERE ptrl_flag = '1'
            ) tpr ON tpt.ptrl_code = tpr.ptrl_code
            LEFT JOIN tbl_item tit ON tpt.itm_code = tit.itm_code
            LEFT JOIN tbl_order_eodtank eod ON tpr.ptrl_sitecode = eod.shipto_no 
                AND tpt.tnk_number::text = eod.tank_no 
                AND eod.date_at = $1::date
            LEFT JOIN (
                SELECT 
                    ptrl_code, 
                    tank_code,
                    MAX(tnk_capacity) as tnk_capacity,
                    MAX(tnk_deadstock) as tnk_deadstock,
                    MAX(CASE WHEN stock_at::date = $1::date - INTERVAL '1 day' THEN stock END) as tank_start,
                    MAX(CASE WHEN stock_at::date = $1::date THEN stock END) as tank_end
                FROM tbl_automatics_tanks_information
                GROUP BY ptrl_code, tank_code
            ) auto_tank ON tpr.ptrl_code = auto_tank.ptrl_code AND tpt.ptrl_tank_code = auto_tank.tank_code
            LEFT JOIN (
                SELECT 
                    ptrl_code, 
                    tank_code, 
                    MAX(sale_previous) as total_sales
                FROM tbl_automatics_sales_previous_information
                WHERE sale_at_previous::date = $1::date
                GROUP BY ptrl_code, tank_code
            ) auto_sales ON tpr.ptrl_code = auto_sales.ptrl_code AND tpt.ptrl_tank_code = auto_sales.tank_code
            WHERE tpr.ptrl_sitecode = $2
            GROUP BY tpr.ptrl_sitecode, tpr.ptrl_code
            ORDER BY tpr.ptrl_sitecode ASC;
        `;

        let result = await pgConn.getWithParams(dbPrefix + lic_code, scriptSql, param, config.connectionString());
        console.log(result);
        if (result.code) {
            res.status(200).json(result);
        } else {
            res.status(200).json(result);
        }

    } catch (error) {
        let response = [{
            status: 'error',
            invalid_code: '-1',
            message: 'ไม่สามารถดึงข้อมูลได้, ระบบเกิดข้อผิดพลาด',
            data: error.message,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }];
        res.status(500).json(response);
    }
}