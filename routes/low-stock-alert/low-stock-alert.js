const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const mailer = require('../auto-order-mails/nodemailer/mail');
const xglobal = new require('../../middleware/global');

/**
 * Helper: สร้าง Template HTML สำหรับแจ้งเตือน Low Stock
 */
const generateLowStockEmailHtml = (petrolInfo, lowStockTanks) => {
    let rowsHtml = '';
    lowStockTanks.forEach(tank => {
        rowsHtml += `
            <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 12px 15px; text-align: center;">${tank.tnk_number}</td>
                <td style="padding: 12px 15px;">${tank.product_name || '-'}</td>
                <td style="padding: 12px 15px; text-align: right; color: #d9534f; font-weight: bold;">
                    ${Number(tank.usable_stock).toLocaleString()} ลิตร
                </td>
                <td style="padding: 12px 15px; text-align: right;">
                    ${Number(tank.day_sales).toLocaleString()} ลิตร/วัน
                </td>
                <td style="padding: 12px 15px; text-align: center; color: #d9534f; font-weight: bold;">
                    ${Number(tank.days_remaining).toFixed(1)} วัน
                </td>
                <td style="padding: 12px 15px; text-align: center;">
                    ${tank.coverage_days} วัน
                </td>
            </tr>
        `;
    });

    return `
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: 'Sarabun', Tahoma, sans-serif; background-color: #f4f7f6; margin: 0; padding: 20px; color: #333; }
            .container { max-width: 800px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
            .header { background-color: #d9534f; padding: 25px 30px; color: white; display: flex; justify-content: space-between; align-items: center; }
            .header h1 { margin: 0; font-size: 22px; font-weight: 600; display: flex; align-items: center; }
            .content { padding: 30px; }
            .alert-box { background-color: #fdf2f2; border-left: 4px solid #d9534f; padding: 15px; margin-bottom: 25px; border-radius: 4px; }
            .station-info { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px; border: 1px solid #e9ecef; }
            .station-info p { margin: 5px 0; font-size: 15px; }
            .table-container { overflow-x: auto; margin-bottom: 30px; border-radius: 8px; border: 1px solid #e0e0e0; }
            table { width: 100%; border-collapse: collapse; }
            thead { background-color: #f1f3f5; }
            th { padding: 15px; text-align: center; font-size: 14px; color: #495057; font-weight: 600; border-bottom: 2px solid #dee2e6; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 13px; color: #6c757d; border-top: 1px solid #e9ecef; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>⚠️ แจ้งเตือนน้ำมันใกล้หมด (Low Stock Alert)</h1>
            </div>
            <div class="content">
                <div class="alert-box">
                    <strong>คำเตือน:</strong> ตรวจพบปริมาณน้ำมันในบางแทงก์มีไม่เพียงพอสำหรับการขายตามเกณฑ์ (Coverage Days) โปรดตรวจสอบและสั่งซื้อน้ำมันเพิ่มเติม
                </div>
                
                <div class="station-info">
                    <p><strong>รหัสปั๊ม:</strong> ${petrolInfo.ptrl_number}</p>
                    <p><strong>ชื่อปั๊ม:</strong> ${petrolInfo.ptrl_desc || '-'}</p>
                    <p><strong>เวลาที่ตรวจสอบ:</strong> ${moment().format('DD/MM/YYYY HH:mm:ss')}</p>
                </div>

                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>ถัง (Tank)</th>
                                <th>ผลิตภัณฑ์</th>
                                <th>ปริมาณที่ขายได้จริง<br><small>(ลบก้นถังแล้ว)</small></th>
                                <th>ยอดขายเฉลี่ย<br><small>(ล่าสุด)</small></th>
                                <th>เหลือขายได้<br><small>(โดยประมาณ)</small></th>
                                <th>เกณฑ์ขั้นต่ำ<br><small>(Coverage Days)</small></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
                
                <p style="font-size: 14px; color: #555;">กรุณาพิจารณาดำเนินการสั่งซื้อน้ำมันผ่านระบบ AOS เพื่อป้องกันน้ำมันขาดสถานี</p>
            </div>
            <div class="footer">
                <p>นี่คืออีเมลอัตโนมัติจากระบบ AOS Backend กรุณาอย่าตอบกลับอีเมลนี้</p>
                <p>© ${moment().format('YYYY')} DTC Enterprise PCL. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;
};

/**
 * ฟังก์ชันหลักในการตรวจสอบและส่งแจ้งเตือน Low Stock
 * @param {string} lic_code - License Code
 * @param {string} manual_off_code - (Optional) รหัส Office กรณีสั่งรันแบบ Manual
 */
exports.processLowStockAlerts = async (lic_code, manual_off_code = null) => {
    if (!lic_code) return;
    const dbName = config.dbPrefix() + lic_code;
    const currentTime = moment();

    try {
        console.log(`\n🔍 [Low Stock Alert] เริ่มตรวจสอบปั๊ม (${lic_code}) เวลา ${currentTime.format('HH:mm:ss')}...`);

        let wh = "";
        let params = [];

        // ============ กรณีที่ มี office_code ส่งมา ===============
        if (manual_off_code && manual_off_code !== 'ALL') {
            params.push(manual_off_code);
            wh = ` AND o.off_code = $1 `;
        } else {
            // ============ กรณีที่ ไม่ มี office_code ส่งมา ===============
            const currentHM = currentTime.format('HH:mm:ss');
            params.push(currentHM);
            wh = ` AND o.order_cutoff_time <= $1::TIME `;
        }

        // 1. ดึงปั๊มที่เข้าข่าย (อ้างอิงเวลา cutoff)
        let scriptSql = `
            SELECT 
                p.ptrl_code, p.ptrl_number, p.ptrl_sitecode, p.ptrl_desc, p.coverage_days
            FROM tbl_petrol p
            INNER JOIN tbl_office o ON p.off_code = o.off_code
            WHERE p.ptrl_flag = '1' 
                AND p.rm_dt IS NULL 
                ${wh}
        `;

        const activeStations = await pgConn.getWithParams(dbName, scriptSql, params, config.connectionString());

        if (!activeStations.data || activeStations.data.length === 0) {
            console.log(`   ⚪ ไม่มีปั๊มที่ถึงเวลาประเมินในขณะนี้`);
            return;
        }

        const dateAt = currentTime.clone().subtract(1, 'days').format('YYYY-MM-DD');

        // 2. ตรวจสอบสต็อกรายปั๊ม
        for (const station of activeStations.data) {
            const coverageDays = parseFloat(station.coverage_days) || 3;

            let stockSql = `
                WITH meter_summary AS (
                    SELECT 
                        tank_no, shipto_no, buy_date, product_name,
                        SUM(meter_diff) AS day_sales
                    FROM (
                        SELECT DISTINCT ON (shipto_no, tank_no, buy_date, meter_start)
                            shipto_no, tank_no, buy_date, product_name,
                            ABS(meter_end - meter_start) AS meter_diff
                        FROM tbl_order_eodmeter
                        WHERE buy_date = $1
                        ORDER BY shipto_no, tank_no, buy_date, meter_start, id DESC
                    ) AS m 
                    GROUP BY tank_no, shipto_no, buy_date, product_name
                )
                SELECT 
                    tpt.tnk_number,
                    tpt.tnk_deadstock AS un_pump,
                    ms.product_name,
                    COALESCE(ms.day_sales, 1) AS day_sales,
                    COALESCE(tank.tank_end, 0) + COALESCE(tank.recive_val::NUMERIC, 0) AS current_stock
                FROM tbl_petrol_tank tpt 
                LEFT JOIN tbl_order_eodtank tank ON (
                    tpt.tnk_number = tank.tank_no 
                    AND tank.shipto_no = $2 
                    AND tank.date_at = $1
                )
                LEFT JOIN meter_summary ms ON (
                    tpt.tnk_number = ms.tank_no 
                    AND ms.shipto_no = $2
                )
                WHERE tpt.ptrl_code = $3 
                    AND tpt.ptrl_tank_flag = '1'
                ORDER BY tpt.tnk_number ASC
            `;

            const tankData = await pgConn.getWithParams(dbName, stockSql, [dateAt, station.ptrl_sitecode, station.ptrl_code], config.connectionString());

            if (!tankData.data || tankData.data.length === 0) continue;

            const lowStockTanks = [];

            for (const tank of tankData.data) {
                const currentStock = parseFloat(tank.current_stock) || 0;
                const deadStock = parseFloat(tank.un_pump) || 0;
                const daySales = parseFloat(tank.day_sales) > 0 ? parseFloat(tank.day_sales) : 1;

                const usableStock = currentStock - deadStock;
                const actualUsable = usableStock > 0 ? usableStock : 0;
                const daysRemaining = actualUsable / daySales;

                console.log(`      DEBUG Tank ${tank.tnk_number}: Current=${currentStock}, Deadstock=${deadStock}, Usable=${actualUsable}`);

                if (daysRemaining <= coverageDays) {
                    lowStockTanks.push({
                        ...tank,
                        usable_stock: actualUsable,
                        days_remaining: daysRemaining,
                        coverage_days: coverageDays
                    });
                }
            }

            if (lowStockTanks.length > 0) {
                console.log(`   ⚠️ [Low Stock Detected] ปั๊ม ${station.ptrl_desc} (${station.ptrl_number})`);
                lowStockTanks.forEach(tank => {
                    console.log(`      - ถัง ${tank.tnk_number} (${tank.product_name}): คงเหลือ ${Number(tank.usable_stock).toLocaleString()} ลิตร | ยอดขาย ${Number(tank.day_sales).toLocaleString()} ลิตร/วัน | เหลือ ${Number(tank.days_remaining).toFixed(1)} วัน (เกณฑ์ ${tank.coverage_days} วัน)`);
                });

                // 3. ตรวจสอบเงื่อนไขการส่งแจ้งเตือน (tbl_petrol_mail_alert)
                let alertSql = `
                    SELECT 
                        ptrl_mail_code, email_alert, alert_status, re_alert_type, last_alert_dt 
                    FROM tbl_petrol_mail_alert 
                    WHERE ptrl_code = $1 
                        AND mail_alert_flag = 1 
                        AND rm_dt IS NULL
                `;
                const alertConfigs = await pgConn.getWithParams(dbName, alertSql, [station.ptrl_code], config.connectionString());

                if (!alertConfigs.data || alertConfigs.data.length === 0) {
                    console.log(`   ⚪ ไม่มีรายชื่ออีเมลแจ้งเตือนสำหรับปั๊มนี้`);
                    continue;
                }

                let shouldSendAlert = false;
                const emailsToSend = [];
                const mailCodesToUpdate = [];

                for (const configItem of alertConfigs.data) {
                    const lastAlertDt = configItem.last_alert_dt ? moment(configItem.last_alert_dt) : null;
                    const alertType = configItem.re_alert_type; // 1 = ครั้งเดียว, 2 = ทุก 30 นาที

                    if (alertType == 1) {
                        if (!lastAlertDt || lastAlertDt.format('YYYY-MM-DD') !== currentTime.format('YYYY-MM-DD')) {
                            shouldSendAlert = true;
                            emailsToSend.push(configItem.email_alert);
                            mailCodesToUpdate.push(configItem.ptrl_mail_code);
                        } else {
                            console.log(`   ⚪ อีเมล ${configItem.email_alert} ถูกส่งไปแล้วในวันนี้ (Type: Once)`);
                        }
                    } else if (alertType == 2) {
                        if (!lastAlertDt || currentTime.diff(lastAlertDt, 'minutes') >= 30) {
                            shouldSendAlert = true;
                            emailsToSend.push(configItem.email_alert);
                            mailCodesToUpdate.push(configItem.ptrl_mail_code);
                        } else {
                            const nextAlertIn = 30 - currentTime.diff(lastAlertDt, 'minutes');
                            console.log(`   ⚪ อีเมล ${configItem.email_alert} เพิ่งส่งไป (ยังไม่ถึงรอบ 30 นาที, เหลืออีก ${nextAlertIn} นาที)`);
                        }
                    }
                }

                if (shouldSendAlert && emailsToSend.length > 0) {
                    const recipientList = emailsToSend.join(',');
                    const subject = `[AOS Alert] แจ้งเตือนน้ำมันใกล้หมด - ${station.ptrl_desc}`;
                    const htmlContent = generateLowStockEmailHtml(station, lowStockTanks);

                    console.log(`   📧 [Alert] ปั๊ม ${station.ptrl_desc} | กำลังส่งอีเมลจริงไปที่: ${recipientList}`);

                    try {
                        // ส่งแบบ 3 parameter ตามที่ mail.js กำหนดไว้
                        await mailer.sendMail(recipientList, subject, htmlContent);
                        console.log(`   ✅ [Success] ส่งอีเมลแจ้งเตือนเรียบร้อยแล้ว`);

                        // อัปเดต Last Alert Time
                        for (const mailCode of mailCodesToUpdate) {
                            await pgConn.execute(dbName,
                                `UPDATE tbl_petrol_mail_alert SET last_alert_dt = $1 WHERE ptrl_mail_code = $2`,
                                [currentTime.format('YYYY-MM-DD HH:mm:ss'), mailCode],
                                config.connectionString()
                            );
                        }
                    } catch (mailErr) {
                        console.error(`   ❌ [Error] ส่งอีเมลแจ้งเตือนไม่สำเร็จ:`, mailErr.message);
                    }
                }
            }
        }

    } catch (error) {
        console.error('❌ [processLowStockAlerts Error]:', error);
        await xglobal.action_logs(lic_code, 'SYSTEM', 'Low Stock Alert Error', error.message, 'error', 'SYSTEM');
    }
};

// ====================== API Controller: Trigger Manual Alert ======================
exports.triggerLowStockAlert = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { off_code, action } = req.body[0] || {};

        // ======= 1. ตรวจสอบพารามิเตอร์ (Validation) =======
        const missing = [];
        if (!lic_code) missing.push('lic_code');
        if (!action) missing.push('action');

        if (missing.length > 0) {
            return xglobal.sendResponse(res, 'error', '-1', `ข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`, []);
        }

        const manual_off_code = off_code || 'ALL';
        const emp_username = action[0].value || 'SYSTEM';

        // ======= 2. บันทึก Log การสั่งรันแบบ Manual =======
        await xglobal.action_logs(lic_code, action[0].id, 'Manual Low Stock Alert Triggered', JSON.stringify({ manual_off_code }), 'success', emp_username);

        // ======= 3. เริ่ม Background Task =======
        // หมายเหตุ: ไม่ต้อง await เพราะเราต้องการให้ Response กลับทันที ส่วนงานประมวลผลทำเป็น Background
        this.processLowStockAlerts(lic_code, manual_off_code);

        return xglobal.sendResponse(res, 'success', '0', 'เริ่มกระบวนการตรวจสอบและแจ้งเตือน Low Stock ในระบบแล้ว', []);

    } catch (err) {
        console.error('❌ [triggerLowStockAlert Error]:', err);
        return xglobal.sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดในการเริ่มกระบวนการแจ้งเตือน', []);
    }
};
