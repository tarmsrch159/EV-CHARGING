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

        let scriptSql_bk = `
            INSERT INTO tbl_petrol_sales (
                ptrl_number,
                tnk_number,
                total_sales,
                sales_at,
                ist_dt,
                mdf_dt
            ),
            SELECT
                tpr.ptrl_number,
                tpt.tnk_number,
                MAX(COALESCE(CAST(meter_summary.total_sales AS NUMERIC(18,2)), 0)) AS total_sales,
                $1::timestamp AS sales_at,
                NOW() AS ist_dt,
                NOW() AS mdf_dt
            FROM tbl_petrol_tank tpt 
            INNER JOIN tbl_petrol tpr ON tpt.ptrl_code = tpr.ptrl_code
            LEFT JOIN (
                SELECT 
                    tank_no,
                    shipto_no,
                    buy_date,
                    SUM(meter_diff) AS total_sales
                FROM (
                    SELECT DISTINCT ON (product_name, shipto_no, tank_no, buy_date, meter_start)
                        shipto_no,
                        tank_no,
                        buy_date,
                        (meter_end - meter_start) AS meter_diff
                    FROM tbl_order_eodmeter
                    WHERE buy_date = $1
                    ORDER BY product_name, shipto_no, tank_no, buy_date, meter_start, id DESC
                ) AS latest_meters
                GROUP BY tank_no, shipto_no, buy_date
            ) meter_summary ON (
                tpt.tnk_number = meter_summary.tank_no 
                AND tpr.ptrl_sitecode = meter_summary.shipto_no
            )
            WHERE 1=1 ${wh}
            GROUP BY tpr.ptrl_number, tpt.tnk_number
            ON CONFLICT (ptrl_number, tnk_number, sales_at) 
            DO UPDATE SET 
                total_sales = EXCLUDED.total_sales, 
                mdf_dt = NOW();
        `;

        let scriptSql = `
            WITH source_data AS (
                SELECT
                    tpr.ptrl_number,
                    tpt.tnk_number,
                    MAX(COALESCE(CAST(meter_summary.total_sales AS NUMERIC(18,2)), 0)) AS total_sales,
                    MAX(COALESCE(tank.tank_end, 0) + COALESCE(tank.recive_val::INT, 0)) AS current_stock,
                    $1::timestamp AS at_date,
                    NOW() AS now_time
                FROM tbl_petrol_tank tpt 
                INNER JOIN tbl_petrol tpr ON tpt.ptrl_code = tpr.ptrl_code
                LEFT JOIN tbl_order_eodtank tank ON (
                    tpt.tnk_number = tank.tank_no 
                    AND tpr.ptrl_sitecode = tank.shipto_no
                    AND tank.date_at = $1
                )
                LEFT JOIN (
                    SELECT 
                        tank_no,
                        shipto_no,
                        buy_date,
                        SUM(meter_diff) AS total_sales
                    FROM (
                        SELECT DISTINCT ON (product_name, shipto_no, tank_no, buy_date, meter_start)
                            shipto_no,
                            tank_no,
                            buy_date,
                            (meter_end - meter_start) AS meter_diff
                        FROM tbl_order_eodmeter
                        WHERE buy_date = $1
                        ORDER BY product_name, shipto_no, tank_no, buy_date, meter_start, id DESC
                    ) AS latest_meters
                    GROUP BY tank_no, shipto_no, buy_date
                ) meter_summary ON (
                    tpt.tnk_number = meter_summary.tank_no 
                    AND tpr.ptrl_sitecode = meter_summary.shipto_no
                )
                WHERE 1=1 ${wh}
                GROUP BY tpr.ptrl_number, tpt.tnk_number
            ),
            ins1 AS (
                INSERT INTO tbl_petrol_sales (ptrl_number, tnk_number, total_sales, sales_at, ist_dt, mdf_dt)
                SELECT ptrl_number, tnk_number, total_sales, at_date, now_time, now_time FROM source_data
                ON CONFLICT (ptrl_number, tnk_number, sales_at) DO UPDATE SET total_sales = EXCLUDED.total_sales, mdf_dt = NOW()
            )
            INSERT INTO tbl_petrol_stock (ptrl_number, tnk_number, stock, stock_at, ist_dt, mdf_dt)
            SELECT ptrl_number, tnk_number, current_stock, at_date, now_time, now_time FROM source_data
            ON CONFLICT (ptrl_number, tnk_number) DO UPDATE SET stock = EXCLUDED.stock, mdf_dt = NOW();
        `;

        let result = await pgConn.getWithParams(dbPrefix + lic_code, scriptSql, param, config.connectionString());
        console.log(result);
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
        date_at = moment().format('YYYY-MM-DD');

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
                        'tank_no', tpt.tnk_number,
                        'itm_material_number', tit.itm_material_number,
                        'product_name', tit.itm_short_desc,
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
                AND tpr.ptrl_sitecode = tank.shipto_no
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
                        (meter_end - meter_start) AS meter_diff
                    FROM tbl_order_eodmeter
                    WHERE buy_date = $1
                    ORDER BY product_name, shipto_no, tank_no, buy_date, meter_start, meter_start, id DESC
                ) AS latest_meters
                GROUP BY product_name, tank_no, shipto_no, buy_date
            ) meter_summary ON (
                tpt.tnk_number = meter_summary.tank_no 
                AND tpr.ptrl_sitecode = meter_summary.shipto_no
            )
            WHERE 1=1 ${wh}
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