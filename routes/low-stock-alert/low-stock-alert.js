const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const mailer = require('../../middleware/nodemailer/mail');
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
exports.processLowStockAlerts = async (lic_code, manual_off_code = "off-1747276087326") => {
    if (!lic_code) return;
    const dbName = config.dbPrefix() + lic_code;
    const currentTime = moment();

    try {
        console.log(`\n🔍 [Low Stock Alert] เริ่มตรวจสอบปั๊ม (${lic_code}) เวลา ${currentTime.format('HH:mm:ss')}...`);

        // ============ เตรียมเงื่อนไขการดึงข้อมูลปั๊ม ============
        let wh = "";
        let params = [manual_off_code];

        // ============ กรณีที่ มี office_code ส่งมา ===============
        if (manual_off_code) {
            wh = ` AND o.off_code = $1 `;
        } else {
            // ============ กรณีที่ ไม่ มี office_code ส่งมา ===============
            const currentHM = currentTime.format('HH:mm:ss');
            params.push(currentHM);
            wh = ` AND o.order_cutoff_time <= $1::TIME `;
        }

        // ============ ดึงรายการปั๊มที่ต้องตรวจสอบ ============
        let scriptSql = `
            SELECT DISTINCT
                p.ptrl_code, p.ptrl_number, p.ptrl_sitecode, p.ptrl_desc, p.coverage_days
            FROM tbl_petrol p
            INNER JOIN tbl_office o ON p.off_code = o.off_code
            WHERE p.ptrl_flag = '1' 
                AND p.rm_dt IS NULL
                AND p.ptrl_code = 'petr-202604091340184930'
                ${wh}
        `;


        const activeStations = await pgConn.getWithParams(dbName, scriptSql, params, config.connectionString());

        if (!activeStations.data || activeStations.data.length === 0) {
            console.log(`   ⚪ ไม่มีปั๊มที่ถึงเวลาตรวจสอบจำนวนน้ำมันในขณะนี้`);
            return;
        }



        const dateAt = currentTime.clone().subtract(1, 'days').format('YYYY-MM-DD');

        // ตรวจสอบสต็อกรายปั๊ม
        for (const station of activeStations.data) {
            const coverageDays = parseFloat(station.coverage_days) || 3;

            // ============ ดึงข้อมูลสต็อกน้ำมันแต่ละถัง (ATG) ============
            let stockSql = `
                  SELECT 
                    tpt.ptrl_tank_code,
                    tpt.tnk_number,
                    tpt.itm_code,
                    itm.itm_material_number,
                    COALESCE(auto_tank.tnk_deadstock, 0) AS un_pump,
                    tpt.unpump_level,
                    itm.itm_desc AS product_name,
                    COALESCE(auto_sales.sale_previous, 0) AS day_sales,
                    COALESCE(auto_tank.stock, 0) as current_stock,
                    auto_tank.stock_at
                FROM tbl_petrol_tank tpt 
                LEFT JOIN tbl_item itm ON tpt.itm_code = itm.itm_code
                LEFT JOIN (
                    select
                    DISTINCT ON (tank_code, ptrl_code)
                        tank_code, ptrl_code, stock, tnk_deadstock, stock_at
                    FROM tbl_automatics_tanks_information
                    ORDER BY tank_code, ptrl_code, stock_at DESC
                ) auto_tank ON tpt.ptrl_tank_code = auto_tank.tank_code AND tpt.ptrl_code = auto_tank.ptrl_code
                 LEFT JOIN (
                    SELECT ptrl_code, tank_code, 
                    MAX(sale_previous) as sale_previous
                    FROM tbl_automatics_sales_previous_information
                    GROUP BY ptrl_code, tank_code
                ) auto_sales ON tpt.ptrl_code = auto_sales.ptrl_code AND tpt.ptrl_tank_code = auto_sales.tank_code
                WHERE tpt.ptrl_code = $1
                    AND tpt.ptrl_tank_flag = '1'
                    AND tpt.rm_dt IS NULL
                ORDER BY tpt.tnk_number ASC
            `;


            const tankData = await pgConn.getWithParams(dbName, stockSql, [station.ptrl_code], config.connectionString());

            if (!tankData.data || tankData.data.length === 0) continue;

            const lowStockTanks = [];

            for (const tank of tankData.data) {
                const currentStock = parseFloat(tank.current_stock) || 0;
                const deadStock = parseFloat(tank.un_pump) || 0;
                const unpumpLevel = parseFloat(tank.unpump_level) || 0;
                const daySales = parseFloat(tank.day_sales) > 0 ? parseFloat(tank.day_sales) : 1;
                const unpump = (deadStock * unpumpLevel) / 100;
                const actualUnpump = deadStock + unpump;


                const usableStock = currentStock - actualUnpump;
                const actualUsable = usableStock > 0 ? usableStock : 0;
                const daysRemaining = Math.floor(actualUsable / daySales);
                // ============ ตรวจสอบคำสั่งซื้อที่ค้างอยู่ (Pending Orders) ============
                let pendingQty = 0;
                let orderCheckSql = `
                    SELECT SUM(oi.item_qty) as pending_qty
                    FROM tbl_order_item oi
                    JOIN tbl_order o ON oi.order_no = o.id
                    WHERE (oi.ptrl_tank_code = $1 OR (o.ship_to = $2 AND (oi.item_no = $3 OR oi.item_no = $4)))
                      AND oi.order_item_flag = '1'
                      AND oi.rm_dt IS NULL
                      AND o.rm_dt IS NULL
                      AND o.order_flag = '1'
                      AND o.order_status IN ('0', '1', '2')
                      AND (oi.sd_process_status IS NULL OR oi.sd_process_status != 'C')
                      AND (oi.sd_reject_reason IS NULL OR oi.sd_reject_reason = '')
                `;
                const orderResult = await pgConn.getWithParams(dbName, orderCheckSql, [tank.ptrl_tank_code, station.ptrl_number, tank.itm_code, tank.itm_material_number], config.connectionString());
                if (orderResult.data && orderResult.data[0]) {
                    pendingQty = parseFloat(orderResult.data[0].pending_qty) || 0;
                }

                // console.log(`   🔍 [Debug] ถัง ${tank.tnk_number} | Stock: ${actualUsable.toFixed(2)} | Pending: ${pendingQty} | Total: ${(actualUsable + pendingQty).toFixed(2)} | Days: ${Math.floor((actualUsable + pendingQty) / daySales)} / ${coverageDays}`);

                const totalPotentialStock = actualUsable + pendingQty;
                const potentialDaysRemaining = Math.floor(totalPotentialStock / daySales);

                if (daysRemaining <= coverageDays) {
                    // ถ้ามียอดสั่งซื้อเพิ่มแล้วรวมแล้วเกินเกณฑ์ ไม่ต้องแจ้งเตือน
                    if (potentialDaysRemaining <= coverageDays) {
                        lowStockTanks.push({
                            ...tank,
                            usable_stock: actualUsable,
                            pending_qty: pendingQty,
                            days_remaining: daysRemaining,
                            coverage_days: coverageDays
                        });
                    } else {
                        console.log(`   ⚪ [Order Found] ถัง ${tank.tnk_number} มีการสั่งเพิ่ม ${pendingQty.toLocaleString()} ลิตร (รวมแล้วอยู่ได้ ${potentialDaysRemaining} วัน) จึงข้ามการแจ้งเตือน`);
                    }
                }
            }

            // ============ ตรวจสอบและส่งอีเมลแจ้งเตือน ============
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

                    console.log(`   📧 [Alert] ปั๊ม ${station.ptrl_desc} | กำลังส่งอีเมลไปที่: ${recipientList}`);

                    try {

                        await mailer.sendMail(recipientList, subject, htmlContent);
                        console.log(`   ✅ [Success] ส่งอีเมลแจ้งเตือนเรียบร้อยแล้ว`);

                        // ============ อัปเดตสถานะการแจ้งเตือนลง Database ============
                        for (const mailCode of mailCodesToUpdate) {
                            await pgConn.execute2params(dbName,
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
