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
                    tpr.ptrl_number,
                    tpt.tnk_number,
                    tpt.tnk_capacity,
                    tpt.tnk_target,
                    tpt.tnk_deadstock AS un_pump,
                    tank.date_at::date as record_date,
                    COALESCE(meter_summary.day_sales, 0) AS day_sales,
                    COALESCE(tank.tank_end, 0) + COALESCE(tank.recive_val::NUMERIC, 0) AS current_stock
                FROM tbl_petrol_tank tpt 
                INNER JOIN tbl_petrol tpr ON tpt.ptrl_code = tpr.ptrl_code
                LEFT JOIN tbl_order_eodtank tank ON (tpt.tnk_number = tank.tank_no AND tpr.ptrl_number = tank.shipto_no)
                LEFT JOIN (
                    SELECT tank_no, shipto_no, buy_date, SUM(meter_diff) AS day_sales
                    FROM (
                        SELECT DISTINCT ON (shipto_no, tank_no, buy_date, meter_start)
                            shipto_no, tank_no, buy_date, ABS(meter_end - meter_start) AS meter_diff
                        FROM tbl_order_eodmeter
                        ORDER BY shipto_no, tank_no, buy_date, meter_start, id DESC
                    ) AS m GROUP BY tank_no, shipto_no, buy_date
                ) meter_summary ON (tpt.tnk_number = meter_summary.tank_no AND tpr.ptrl_number = meter_summary.shipto_no AND tank.date_at = meter_summary.buy_date)
                WHERE 1=1 ${wh}
            ),
            raw_data AS (
                SELECT 
                    ptrl_number,
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
                GROUP BY ptrl_number, tnk_number, tnk_capacity, tnk_target, un_pump
            ),
            source_data AS (
                SELECT *,
                    (CASE WHEN current_stock IS NOT NULL THEN (tnk_target - current_stock) END ) AS suggest_qty
                FROM raw_data
            ),
            ins_sales AS (
                INSERT INTO tbl_petrol_sales (
                    ptrl_number, tnk_number, day_sales, 
                    avg_prev, avg_next, sales_at, ist_dt, mdf_dt
                )
                SELECT 
                    ptrl_number, tnk_number, day_sales, 
                    COALESCE(avg_prev, 0), COALESCE(avg_next, 0), 
                    at_date, now_time, now_time     
                FROM source_data
                WHERE day_sales IS NOT NULL AND day_sales > 0
                ON CONFLICT (ptrl_number, tnk_number, sales_at) 
                DO UPDATE SET 
                    day_sales = EXCLUDED.day_sales,
                    avg_prev = EXCLUDED.avg_prev,
                    avg_next = EXCLUDED.avg_next,
                    mdf_dt = NOW()
                RETURNING *
            ),
            ins_stock AS (
                INSERT INTO tbl_petrol_stock (ptrl_number, tnk_number, stock, stock_at, ist_dt, mdf_dt)
                SELECT ptrl_number, tnk_number, current_stock, at_date, now_time, now_time 
                FROM source_data
                WHERE current_stock > 0
                ON CONFLICT (ptrl_number, tnk_number, stock_at) 
                DO UPDATE SET stock = EXCLUDED.stock, mdf_dt = NOW()
            )
            INSERT INTO tbl_petrol_order (ptrl_number, tnk_number, suggest_qty, at_date, ist_dt, mdf_dt)
            SELECT 
                ptrl_number, 
                tnk_number, 
                suggest_qty, 
                at_date, 
                now_time, 
                now_time 
            FROM source_data
            WHERE suggest_qty > 0
            ON CONFLICT (ptrl_number, tnk_number, at_date) 
            DO UPDATE SET 
                suggest_qty = EXCLUDED.suggest_qty, 
                mdf_dt = NOW();
        `;

        let scriptSql_V2 = `
            WITH daily_stats AS (
                SELECT 
                    tpr.ptrl_number,
                    tpt.tnk_number,
                    tpt.tnk_capacity,
                    tpt.tnk_deadstock AS un_pump, -- ค่า UN ตามสูตร
                    tank.date_at::date as record_date,
                    COALESCE(meter_summary.day_sales, 0) AS day_sales,
                    COALESCE(tank.tank_end, 0) + COALESCE(tank.recive_val::NUMERIC, 0) AS current_stock
                FROM tbl_petrol_tank tpt 
                INNER JOIN tbl_petrol tpr ON tpt.ptrl_code = tpr.ptrl_code
                LEFT JOIN tbl_order_eodtank tank ON (tpt.tnk_number = tank.tank_no AND tpr.ptrl_number = tank.shipto_no)
                LEFT JOIN (
                    SELECT tank_no, shipto_no, buy_date, SUM(meter_diff) AS day_sales
                    FROM (
                        SELECT DISTINCT ON (shipto_no, tank_no, buy_date, meter_start)
                            shipto_no, tank_no, buy_date, ABS(meter_end - meter_start) AS meter_diff
                        FROM tbl_order_eodmeter
                        ORDER BY shipto_no, tank_no, buy_date, meter_start, id DESC
                    ) AS m GROUP BY tank_no, shipto_no, buy_date
                ) meter_summary ON (tpt.tnk_number = meter_summary.tank_no AND tpr.ptrl_number = meter_summary.shipto_no AND tank.date_at = meter_summary.buy_date)
                WHERE 1=1 ${wh}
            ),
            source_data AS (
                SELECT 
                    ptrl_number,
                    tnk_number,
                    tnk_capacity,
                    un_pump,
                    -- ใช้ยอดขายวันนี้ ถ้าไม่มีให้ใช้ค่าเฉลี่ย 7 สัปดาห์ (Safety Factor)
                    COALESCE(
                        MAX(CASE WHEN record_date = $1 THEN day_sales END),
                        AVG(CASE WHEN record_date < $1 AND record_date >= $1::date - INTERVAL '7 weeks' AND EXTRACT(DOW FROM record_date) = ${dayIndex} THEN day_sales END),
                        0
                    ) AS calc_day_sales,
                    -- สต็อกวันนี้ หรือ เมื่อวาน
                    COALESCE(
                        MAX(CASE WHEN record_date = $1 THEN current_stock END),
                        MAX(CASE WHEN record_date = $1::date - 1 THEN current_stock END),
                        0
                    ) AS stock,
                    $1::date AS at_date,
                    NOW() AS now_time
                FROM daily_stats
                GROUP BY ptrl_number, tnk_number, tnk_capacity, un_pump
            ),
            order_calculation AS (
                SELECT 
                    *,
                    (calc_day_sales * ${coverageDays}) + un_pump AS target_stock
                FROM source_data
            ),
            final_suggestion AS (
                SELECT 
                    *,
                    CASE 
                        WHEN (target_stock - stock) < ${threshold} THEN 0
                        WHEN (target_stock - stock) > (tnk_capacity - stock) THEN (tnk_capacity - stock)
                        ELSE GREATEST(0, target_stock - stock)
                    END AS suggest_qty
                FROM order_calculation
            ),
            ins_sales AS (
                INSERT INTO tbl_petrol_sales (ptrl_number, tnk_number, day_sales, avg_prev, avg_next, sales_at, ist_dt, mdf_dt)
                SELECT ptrl_number, tnk_number, MAX(CASE WHEN record_date = $1 THEN day_sales END), 0, 0, at_date, now_time, now_time 
                FROM daily_stats 
                CROSS JOIN (SELECT at_date, now_time FROM source_data LIMIT 1) s 
                WHERE day_sales > 0 AND day_sales IS NOT NULL
                GROUP BY ptrl_number, tnk_number, at_date, now_time
                ON CONFLICT (ptrl_number, tnk_number, sales_at) DO UPDATE SET day_sales = EXCLUDED.day_sales, mdf_dt = NOW()
                RETURNING *
            ),
            ins_stock AS (
                INSERT INTO tbl_petrol_stock (ptrl_number, tnk_number, stock, stock_at, ist_dt, mdf_dt)
                SELECT ptrl_number, tnk_number, stock, at_date, now_time, now_time 
                FROM source_data
                WHERE stock > 0 AND stock IS NOT NULL
                ON CONFLICT (ptrl_number, tnk_number, stock_at) DO UPDATE SET stock = EXCLUDED.stock, mdf_dt = NOW()
                RETURNING *
            )
            INSERT INTO tbl_petrol_order (ptrl_number, tnk_number, suggest_qty, at_date, ist_dt, mdf_dt)
            SELECT 
                ptrl_number, 
                tnk_number, 
                suggest_qty, 
                at_date, 
                now_time,
                now_time 
            FROM final_suggestion
            WHERE suggest_qty > 0
            ON CONFLICT (ptrl_number, tnk_number, at_date) 
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
    let { date_at, ptrl_number, action } = req.body[0];
    let lic_code = req.header('lic_code');
    let roleId = action[0].id;
    let roleValue = action[0].value !== 'ALL' ? action[0].value : 'ALL';

    if (!lic_code || !ptrl_number) {
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

        let param = [];
        param.push(date_at);

        let wh = '';
        param.push(ptrl_number);
        wh += ` AND tpr.ptrl_number = $${param.length} `;

        let scriptSql = `
            SELECT
                tpr.ptrl_number AS shipto,
                tank.date_at,
                JSONB_AGG(
                    JSONB_BUILD_OBJECT(
                        'ptrl_tank_code', tpt.ptrl_tank_code,
                        'tank_no', tpt.tnk_number,
                        'itm_code', tit.itm_code,
                        'itm_material_number', tit.itm_material_number,
                        'itm_desc', tit.itm_desc,
                        'un_pump', tpt.tnk_deadstock,
                        'max_stock', tpt.tnk_capacity,
                        'target_stock', tpt.tnk_target,
                        'tank_start', tank.tank_start,
                        'tank_end', tank.tank_end,
                        'total_sales', COALESCE(CAST(meter_summary.total_sales AS NUMERIC(18,2)), 0),
                        'min_stock', CAST(meter_summary.total_sales AS NUMERIC(18,2)) + tpt.tnk_deadstock,
                        'recive_val', tank.recive_val::INT,
                        'current_stock', tank.tank_end + COALESCE(tank.recive_val::INT, 0)
                    )
                    ORDER BY tpt.tnk_number ASC
                ) AS data
            FROM tbl_petrol_tank tpt 
            INNER JOIN tbl_petrol tpr ON tpt.ptrl_code = tpr.ptrl_code
            LEFT JOIN tbl_item tit ON tpt.itm_code = tit.itm_code
            LEFT JOIN tbl_order_eodtank tank ON (
                tpt.tnk_number = tank.tank_no 
                AND tpr.ptrl_number = tank.shipto_no
                AND tank.date_at = $1
            )
            LEFT JOIN (
                SELECT 
                    tank_no,
                    product_name,
                    shipto_no,
                    buy_date,
                    SUM(meter_diff) AS total_sales
                FROM (
                    SELECT DISTINCT ON (product_name, shipto_no, tank_no, buy_date, meter_start, meter_start)
                        product_name,
                        shipto_no,
                        tank_no,
                        buy_date,
                        ABS(meter_end - meter_start) AS meter_diff
                    FROM tbl_order_eodmeter
                    WHERE buy_date = $1
                    ORDER BY product_name, shipto_no, tank_no, buy_date, meter_start, meter_start, id DESC
                ) AS latest_meters
                GROUP BY product_name, tank_no, shipto_no, buy_date
            ) meter_summary ON (
                tpt.tnk_number = meter_summary.tank_no 
                AND tpr.ptrl_number = meter_summary.shipto_no
            )
            WHERE tpt.ptrl_tank_flag = '1' ${wh}
            GROUP BY tpr.ptrl_number, tank.date_at
            ORDER BY tpr.ptrl_number ASC;
        `;

        let result = await pgConn.getWithParams(dbPrefix + lic_code, scriptSql, param, config.connectionString());
        res.status(200).json(result);

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