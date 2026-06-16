const moment = require('moment');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;
const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const mailer = require('../../middleware/nodemailer/mail');
const dbPrefix = config.dbPrefix();
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const { sapApiClient } = require("../order/sap-api-config");

let currentLicCode = 'aos_qa';
const setLicCode = (lic) => { currentLicCode = lic; };
const logInfo = (service, event) => {
    const prefix = currentLicCode ? `[${currentLicCode}] ` : '';
    xglobal.logInfo(service, prefix + event);
};
const logError = (service, event, err) => {
    const prefix = currentLicCode ? `[${currentLicCode}] ` : '';
    xglobal.logError(service, prefix + event, err);
};

// =========================================================
//  Helpers: AES-256-CBC Encryption & Decryption
// =========================================================
const SECRET_KEY = 'AOS_BangChak_SecretKey_2026!!@#$'; // 32 characters
const IV_LENGTH = 16;
const ALGORITHM = 'aes-256-cbc';

/**
 * เข้ารหัสข้อมูลเป็น Token
 */
const encryptPayload = (text) => {
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY, 'utf8'), iv);
        let encrypted = cipher.update(text, 'utf8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (err) {
        logError('Auto Order Mail', `encryptPayload Error: ${err.message}`);
        return null;
    }
};

/**
 * ถอดรหัส Token เป็นข้อมูลดิบ
 */
const decryptPayload = (text) => {
    try {
        if (!text) return null;
        logInfo('Auto Order Mail', `กำลังถอดรหัส Token: ${text.substring(0, 20)}...`);

        const parts = text.split(':');
        if (parts.length !== 2) {
            logError('Auto Order Mail', 'Token Format ผิด (ไม่มีเครื่องหมาย :)');
            return null;
        }

        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = Buffer.from(parts[1], 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY, 'utf8'), iv);

        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString('utf8');
    } catch (err) {
        logError('Auto Order Mail', `decryptPayload Error: ${err.message}`);
        return null;
    }
};

// =========================================================
//  Helpers: Data & Email Cleaning
// =========================================================

/**
 * จัดการอีเมลใน ptrl_remark ให้เป็นรูปแบบที่ถูกต้อง
 */
const cleanEmails = (emailStr) => {
    if (!emailStr) return '';
    return emailStr.replace(/;/g, ',').split(',').map(e => e.trim()).filter(e => e && e.includes('@')).join(',');
};

/**
 * ดึงรายการน้ำมัน (Order Items) ของออเดอร์นั้นๆ
 */
const getOrderItems = async (lic_code, order) => {
    const itemScript = `
        SELECT toi.id, toi.order_no, toi.item_no, toi.item_qty, toi.deli_plant,
               ti.itm_desc AS product_name, td.dpo_desc AS depot_name
        FROM tbl_order_item toi
        LEFT JOIN tbl_item ti ON toi.item_no = ti.itm_code
        LEFT JOIN tbl_depot td ON toi.deli_plant = td.dpo_code AND td.dpo_flag = '1'
        WHERE CAST(toi.order_no AS TEXT) = $1 AND toi.order_item_flag = '1' AND toi.rm_dt IS NULL
        ORDER BY toi.id ASC
    `;
    const result = await pgConn.getWithParams(dbPrefix + lic_code, itemScript, [String(order.id)], config.connectionString());

    if (result.code || !result.data) return [];
    return JSON.parse(JSON.stringify(result.data).replace(/:null/gi, ':""'));
};

/**
 * ดึงข้อมูลผู้จัดการปั๊มจาก tbl_employee โดยใช้ ptrl_code
 */
const getManagerByPtrlCode = async (lic_code, ptrl_code) => {
    const script = `
        SELECT emp_code, emp_username, emp_userpassword
        FROM tbl_employee
        WHERE ptrl_code = $1 AND emp_flag = '1' AND emp_role_code = '2' AND rm_dt IS NULL
        ORDER BY ist_dt ASC
        LIMIT 1
    `;
    const result = await pgConn.getWithParams(dbPrefix + lic_code, script, [ptrl_code], config.connectionString());
    if (result.code || !result.data || result.data.length === 0) return null;
    return result.data[0]; // { emp_code, emp_username, emp_userpassword }
};

// =========================================================
//  Helpers: HTML Template Generation
// =========================================================

/**
 * สร้างส่วนตารางรายการสินค้าใน HTML
 */
const generateEmailTableRows = (orders) => {
    let rowsHtml = '';
    orders.forEach(order => {
        const rowSpan = order.items.length;
        const aosNo = order.sh_cus_ref || order.order_no || '-';

        order.items.forEach((item, index) => {
            rowsHtml += '<tr>';
            if (index === 0) {
                rowsHtml += `<td rowspan="${rowSpan}" style="border: 1px solid #eee; padding: 12px; font-weight: bold; color: #00796b;">${aosNo}</td>`;
            }
            rowsHtml += `
                <td style="border: 1px solid #eee; padding: 12px;">${item.product_name}</td>
                <td style="border: 1px solid #eee; padding: 12px; text-align: right; font-family: monospace; font-size: 15px;">${Number(item.item_qty).toLocaleString()}</td>
            </tr>`;
        });
    });
    return rowsHtml;
};

/**
 * สร้าง Card Email
 */
const generateFullEmailHtml = (stationName, confirmUrl, ordersHtml, hasOrders = true) => {
    const logoUrl = "cid:bangchak_logo";

    if (!hasOrders) {
        return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    </head>
    <body style="margin: 0; padding: 30px 10px; background-color: #f4f7f5; font-family: 'Sarabun', 'Inter', -apple-system, sans-serif; -webkit-font-smoothing: antialiased;">
        <div style="max-width: 680px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #e3e8e5; box-shadow: 0 10px 25px rgba(14,130,63,0.05);">
            <div style="text-align: center; margin-bottom: 35px;">
                <img src="${logoUrl}" alt="Bangchak" style="max-height: 85px; margin-bottom: 15px;">
                <h2 style="color: #0E823F; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.3px;">รายงานออเดอร์อัตโนมัติ (Auto Order)</h2>
                <div style="width: 60px; height: 4px; background: linear-gradient(90deg, #0E823F 0%, #F05A28 100%); margin: 15px auto; border-radius: 2px;"></div>
            </div>

            <p style="font-size: 16px; color: #1C2421; line-height: 1.6; margin-bottom: 8px;">เรียน ผู้ดูแลสถานีบริการ สาขา <strong>${stationName}</strong>,</p>
            <p style="font-size: 15px; color: #4A5551; line-height: 1.6; margin-top: 0; margin-bottom: 30px;">
                ระบบ Automatic Ordering System (AOS) ได้จัดเตรียมและคำนวณการสั่งซื้อน้ำมันประจำวันที่ <strong>${moment().format('DD/MM/YYYY')}</strong> เสร็จสมบูรณ์แล้ว:
            </p>
            
            <div style="text-align: center; padding: 45px 30px; background: linear-gradient(135deg, #f7fbf8 0%, #edf7ef 100%); border: 1px solid #d0e7d7; border-radius: 16px; margin: 30px 0; box-shadow: inset 0 2px 6px rgba(14,130,63,0.02);">
                <div style="font-size: 48px; margin-bottom: 18px; display: inline-block; line-height: 1;">📝</div>
                <div style="color: #0E823F; font-size: 20px; font-weight: 700; margin-bottom: 6px;">ระบบวิเคราะห์สำเร็จ</div>
                <div style="color: #55605B; font-size: 15px; font-weight: 500;">ไม่มียอดสั่งน้ำมันแนะนำเพิ่มเติมในวันนี้</div>
            </div>

            <div style="margin-top: 40px; text-align: center; font-size: 13px; color: #8A9994; border-top: 1px solid #edf1ef; padding-top: 25px; line-height: 1.6;">
                <p style="margin: 0 0 4px 0; font-weight: 500; color: #55605B;">Bangchak Corporation Public Company Limited</p>
                <p style="margin: 0; font-size: 12px; color: #A0B0AB;">นี่คืออีเมลอัตโนมัติจากระบบ AOS กรุณาอย่าตอบกลับอีเมลนี้</p>
            </div>
        </div>
    </body>
    </html>`;
    }

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    </head>
    <body style="margin: 0; padding: 30px 10px; background-color: #f4f7f5; font-family: 'Sarabun', 'Inter', -apple-system, sans-serif; -webkit-font-smoothing: antialiased;">
        <div style="max-width: 680px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 20px; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 35px;">
                <img src="${logoUrl}" alt="Bangchak" style="max-height: 80px; margin-bottom: 20px;">
                <h2 style="color: #16A34A; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">รายงานออเดอร์อัตโนมัติ (Auto Order)</h2>
                <div style="width: 80px; height: 4px; background: linear-gradient(90deg, #16A34A 0%, #F97316 100%); margin: 15px auto; border-radius: 10px;"></div>
            </div>

            <p style="font-size: 16px; color: #1C2421; line-height: 1.6; margin-bottom: 8px;">เรียน ผู้จัดการปั๊ม <strong>${stationName}</strong>,</p>
            <p style="font-size: 15px; color: #4A5551; line-height: 1.6; margin-top: 0; margin-bottom: 25px;">
                ระบบ Automatic Ordering System (AOS) ได้สร้างคำสั่งซื้อน้ำมันแนะนำสำหรับรอบวันที่ <strong>${moment().format('DD/MM/YYYY')}</strong> เรียบร้อยแล้ว:
            </p>
            
            <div style="border-radius: 15px; overflow: hidden; border: 1px solid #e2e8f0; margin: 30px 0;">
                <table style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
                    <thead>
                        <tr style="background-color: #15803D; color: #ffffff;">
                            <th style="padding: 16px; text-align: left; font-size: 14px; font-weight: 600;">เลขที่ออเดอร์ (AOS)</th>
                            <th style="padding: 16px; text-align: left; font-size: 14px; font-weight: 600;">ผลิตภัณฑ์</th>
                            <th style="padding: 16px; text-align: right; font-size: 14px; font-weight: 600;">จำนวน (ลิตร)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ordersHtml}
                    </tbody>
                </table>
            </div>

            <div style="text-align: center; margin: 40px 0 30px 0;">
                <a href="${confirmUrl}" style="display: inline-block; padding: 16px 50px; background: linear-gradient(135deg, #16A34A 0%, #15803D 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(22,163,74,0.3); transition: transform 0.2s;">
                    ตรวจสอบข้อมูลและยืนยันออเดอร์
                </a>
            </div>

            <div style="margin-top: 30px; padding: 20px; background-color: #F0FDF4; border-left: 5px solid #22C55E; border-radius: 8px; text-align: left;">
                <p style="margin: 0; font-size: 14px; color: #166534; line-height: 1.6;">
                    <strong style="color: #15803D;">💡 หมายเหตุ:</strong> ออเดอร์นี้ถูกสร้างขึ้นโดยระบบแนะนำอัตโนมัติ กรุณาคลิกปุ่ม <strong>"ตรวจสอบข้อมูลและยืนยันออเดอร์"</strong> ด้านบนเพื่อจัดการและยืนยันสถานะออเดอร์ให้เสร็จสมบูรณ์
                </p>
            </div>

            <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 20px;">
              <p>Bangchak Corporation Public Company Limited | นี่คืออีเมลอัตโนมัติ กรุณาอย่าตอบกลับ</p>
            </div>
        </div>
    </body>
    </html>`;
};

// =========================================================
//  Main Functions
// =========================================================

/**
 * ดึงข้อมูลออเดอร์และรายการสินค้าสำหรับสถานี
 */
const getDataForStation = async (lic_code, autoItem) => {
    try {
        logInfo('Auto Order Mail', `อ่านข้อมูลปั๊ม: ${autoItem.ptrl_desc} (${autoItem.ptrl_number})`);

        const orderScript = `
            SELECT id, order_no, sh_cus_ref, ship_to, order_type, order_status, deli_date_req, description, ist_dt
            FROM tbl_order
            WHERE ship_to = $1 AND auto_order = '1' AND order_flag = '1' AND rm_dt IS NULL
            ORDER BY ist_dt DESC
        `;
        // ====== ดึงข้อมูล Order และ Manager พร้อมกันแบบ Parallel ======
        const [orderResult, manager] = await Promise.all([
            pgConn.getWithParams(dbPrefix + lic_code, orderScript, [autoItem.ptrl_number], config.connectionString()),
            getManagerByPtrlCode(lic_code, autoItem.ptrl_code)
        ]);

        let orderDetails = [];
        if (!orderResult.code && orderResult.data && orderResult.data.length > 0) {
            const orders = orderResult.data;
            // ดึง Item ของทุก Order พร้อมกัน
            orderDetails = await Promise.all(orders.map(async (order) => {
                const items = await getOrderItems(lic_code, order);
                return {
                    order_id: order.id,
                    order_no: order.order_no || '',
                    sh_cus_ref: order.sh_cus_ref || '',
                    order_status: order.order_status || '',
                    deli_date_req: order.deli_date_req || '',
                    description: order.description || '',
                    ist_dt: order.ist_dt || '',
                    items
                };
            }));
        }
        logInfo('Auto Order Mail', `   ผู้จัดการปั๊ม: ${manager ? manager.emp_code : 'ไม่พบ'}`);
        return {
            lic_code: lic_code,
            automatic_code: autoItem.automatic_code,
            ptrl_code: autoItem.ptrl_code,
            ptrl_number: autoItem.ptrl_number,
            ptrl_desc: autoItem.ptrl_desc,
            ptrl_short_desc: autoItem.ptrl_short_desc || '',
            // --- INTERCEPT MODE: ถ้ามีผู้รับในระบบ ให้เปลี่ยนมาส่งที่ 2 เมลนี้แทน ---
            manager_email: cleanEmails(autoItem.ptrl_remark) ? 'prattananien@gmail.com, puautarm@gmail.com' : '',
            // manager_email: cleanEmails(autoItem.ptrl_remark) ? 'amnart_pg@dtc.co.th, puautarm@gmail.com' : '',
            // ------------------------------------------------------------------
            manager_emp_code: manager ? manager.emp_code : '',
            manager_username: manager ? manager.emp_username : '',
            manager_password: manager ? manager.emp_userpassword : '',
            orders: orderDetails
        };
    } catch (err) {
        logError('Auto Order Mail', `Auto Order Mail Data Error ${autoItem.ptrl_number}`, err);
        return null;
    }
};

/**
 * ส่งอีเมลออเดอร์อัตโนมัติ
 */
const sendAutoOrderEmail = async (stationData) => {
    try {
        const toEmail = stationData.manager_email || 'test@example.com';
        const stationName = `${stationData.ptrl_desc} (${stationData.ptrl_number})`;
        const reportBaseUrlProd = 'https://spd-demo.dtc.co.th:9101/main/order/order-report';
        const reportBaseUrlTest = 'http://localhost:5173/main/order/order-report';
        const reportBaseUrl = reportBaseUrlProd;

        const hasOrders = stationData.orders && stationData.orders.length > 0;
        let confirmUrl = '';
        let rowsHtml = '';
        let subject = `[Auto Order] รายงานยอดสั่งซื้ออัตโนมัติ - ${stationData.ptrl_desc}`;

        // =========== กรณีมีAuto Order ของปั๊มนั้นๆ ============
        if (hasOrders) {
            const firstOrder = stationData.orders[0] || {};
            const orderId = firstOrder.order_id || '';
            // ====== สร้าง Encrypted Token สำหรับ Auto Signin ======
            const payload = JSON.stringify({
                lic_code: stationData.lic_code,
                order_id: orderId,
                emp_id: stationData.manager_emp_code || '',
                u: stationData.manager_username || '',
                p: stationData.manager_password || '',
                exp: moment().add(24, 'hours').valueOf()  // หมดอายุ 24 ชั่วโมง
            });
            const token = encryptPayload(payload);
            confirmUrl = `${reportBaseUrl}?token=${encodeURIComponent(token)}`;
            // console.log(`   🔗 สร้างลิงก์ตรวจสอบ: ${confirmUrl}`);

            rowsHtml = generateEmailTableRows(stationData.orders);
        } else {
            // =========== กรณีไม่Auto Order ของปั๊มนั้นๆ ===========
            subject = `[Auto Order] ไม่มียอดสั่งน้ำมันในวันนี้ - ${stationData.ptrl_desc}`;
            logInfo('Auto Order Mail', 'ไม่มียอดสั่งซื้อ: เตรียมส่งเมลแจ้งเตือนไม่มียอดสั่งน้ำมัน');
        }

        const htmlContent = generateFullEmailHtml(stationName, confirmUrl, rowsHtml, hasOrders);

        const attachments = [{
            filename: 'Logo.png',
            path: path.join(__dirname, '../../public/images/Logo.png'),
            cid: 'bangchak_logo'
        }];

        const result = await mailer.sendMail(['prattananien@gmail.com', 'ornwara.traiyavudh02@gmail.com', 'puautarm@gmail.com'], subject, htmlContent, attachments);
        // const result = await mailer.sendMail(toEmail, subject, htmlContent, attachments);

        if (!result.success) {
            // โยน Error ออกไปเพื่อให้ Caller จัดการ (เช่น เช็คเรื่อง Limit)
            throw new Error(result.error || 'Unknown Mail Error');
        }

        return true;
    } catch (err) {
        // ให้ Error bubble up ขึ้นไปที่ runAutoOrderMailTask
        throw err;
    }
};

/**
 * ดึงข้อมูลปั๊มที่มีการคำนวณ Auto Order เพื่อเอาไปใช้หารายการสั่งซื้อ
 */
const processAutoOrderMails = async (lic_code) => {
    setLicCode(lic_code);
    logInfo('Auto Order Mail', `เริ่มประมวลผล: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
    try {
        const query = `
            SELECT ao.automatic_code, ao.ptrl_code, ao.ist_dt, ao.result, ao.automatic_status,
                   p.ptrl_number, p.ptrl_desc, p.ptrl_short_desc, p.ptrl_remark
            FROM tbl_automatics_orders ao
            INNER JOIN tbl_petrol p ON ao.ptrl_code = p.ptrl_code
            WHERE ao.automatic_status = '1' 
              AND ao.ist_dt::date = (SELECT MAX(ist_dt::date) FROM tbl_automatics_orders WHERE automatic_status = '1')
              AND p.ptrl_remark IS NOT NULL AND p.ptrl_remark != ''
            ORDER BY ao.ist_dt DESC
        `;
        const result = await pgConn.get(dbPrefix + lic_code, query, config.connectionString());

        if (result.code || !result.data || result.data.length === 0) {
            return { success: true, message: 'ไม่มีรายการที่ต้องประมวลผล', data: [] };
        }

        const mailDataList = [];
        // [DEV TEST] จำกัดให้รันแค่ 2 ปั๊มแรก ป้องกัน Mail Spam
        // for (const item of result.data) {
        for (const item of result.data.slice(0, 2)) {
            const data = await getDataForStation(lic_code, item);
            if (data) {
                mailDataList.push(data);
                await sendAutoOrderEmail(data);
            }
        }
        return { success: true, message: `พบข้อมูล ${mailDataList.length} แห่ง`, data: mailDataList };
    } catch (err) {
        logError('Auto Order Mail', 'processAutoOrderMails Error', err);
        return { success: false, message: err.message };
    }
};

/**
 * Controller API
 */
exports.getAutoOrderMailData = async (req, res) => {
    try {
        let lic_code = req.header('lic_code');
        if (lic_code) {
            lic_code = lic_code.trim();
            if (lic_code === 'aos_01') lic_code = 'aos01';
        }

        if (!lic_code) return sendResponse(res, 'error', '-1', 'พารามิเตอร์ไม่ถูกต้อง', []);

        const result = await processAutoOrderMails(lic_code);
        if (!result.success) return sendResponse(res, 'error', '-3', result.message, []);
        return sendResponse(res, 'success', '0', result.message, result.data);
    } catch (err) {
        return sendResponse(res, 'error', '-4', 'System Error', []);
    }
};

/**
 * Background Process
 */
exports.runAutoOrderMailTask = async (lic_code = '') => {
    const defaultLicCode = process.env.IS_PROD === 'true' ? 'aos_qa' : 'aos01';
    lic_code = (lic_code && lic_code.trim()) ? lic_code.trim() : defaultLicCode;
    if (lic_code === 'aos_01') lic_code = 'aos01';

    setLicCode(lic_code);
    logInfo('Auto Order Mail', `เริ่ม Background Task สำหรับ ${lic_code}...`);

    try {
        // [Auto Order Cleanup] รันการล้างข้อมูลออเดอร์เก่าไปพร้อมกัน (ไม่ว่าจะพบข้อมูลส่งเมลหรือไม่)
        await exports.runAutoOrderCleanupTask(lic_code);
        await exports.runAutoOrderToSapTask(lic_code);

        const currentTime = moment().format('HH:mm:ss');
        const query = `
            SELECT ao.automatic_code, ao.ptrl_code, ao.ist_dt, ao.automatic_status,
                   p.ptrl_number, p.ptrl_desc, p.ptrl_short_desc, p.ptrl_remark,
                   oc.start_calculate_auto_order, oc.end_calculate_auto_order
            FROM tbl_automatics_orders ao
            INNER JOIN tbl_petrol p ON ao.ptrl_code = p.ptrl_code
            INNER JOIN tbl_sales_org_order_config oc ON p.ptrl_sales_group = oc.sales_org_code 
                  AND p.ptrl_sales_type = oc.order_type_code
            WHERE ao.automatic_status = '1' 
              AND ao.ist_dt::date = (SELECT MAX(ist_dt::date) FROM tbl_automatics_orders WHERE automatic_status = '1')
              AND p.ptrl_remark IS NOT NULL AND p.ptrl_remark != ''
              AND oc.sales_org_flag = 1 AND oc.rm_dt IS NULL
            ORDER BY ao.ist_dt DESC 
        `;
        const result = await pgConn.get(dbPrefix + lic_code, query, config.connectionString());
        if (result.code || !result.data || result.data.length === 0) {
            logInfo('Auto Order Mail', 'ไม่มีรายการที่ต้องประมวลผล');
            return { success: true };
        }

        const autoList = result.data;
        logInfo('Auto Order Mail', `พบรายการทั้งหมด: ${autoList.length} แห่ง`);

        // 1. อ่านข้อมูลทั้งหมดแบบ Parallel เพื่อความเร็วสูงสุด (Speed up reading)
        // [DEV TEST] จำกัดให้รันแค่ 2 ปั๊มแรก ป้องกัน Mail Spam
        logInfo('Auto Order Mail', 'กำลังอ่านข้อมูล (จำกัด 2 ปั๊มแรก)...');
        const stationDataResults = await Promise.all(autoList.map(item => getDataForStation(lic_code, item)));
        // const stationDataResults = await Promise.all(autoList.slice(0, 2).map(item => getDataForStation(lic_code, item)));
        const validStationData = stationDataResults.filter(d => d !== null);

        logInfo('Auto Order Mail', 'เริ่มส่งเมล (Batch Processing)...');

        await processEmailBatches(lic_code, validStationData);

        return { success: true };
    } catch (err) {
        logError('Auto Order Mail', 'runAutoOrderMailTask Error', err);
        return { success: false };
    }
};

/**
 * จัดการส่งเมลเป็นชุด (Batch)
 */
const processEmailBatches = async (lic_code, stationList) => {
    const BATCH_SIZE = 5;
    let isLimitHit = false;

    for (let i = 0; i < stationList.length; i += BATCH_SIZE) {
        if (isLimitHit) break;

        const batch = stationList.slice(i, i + BATCH_SIZE);
        logInfo('Auto Order Mail', `[Batch] กลุ่ม ${i / BATCH_SIZE + 1}: สถานีลำดับที่ ${i + 1} - ${Math.min(i + BATCH_SIZE, stationList.length)} จาก ${stationList.length}`);

        const results = await Promise.all(batch.map(station => processStationEmail(lic_code, station)));

        // ตรวจสอบว่ามีรายการไหนติด Gmail Limit หรือไม่
        if (results.some(r => r.limitExceeded)) {
            isLimitHit = true;
        }

        // พักเพื่อป้องกันสแปม
        if (!isLimitHit && i + BATCH_SIZE < stationList.length) {
            logInfo('Auto Order Mail', 'พัก 3 วินาทีเพื่อป้องกันสแปม...');
            await sleep(3000);
        }
    }
};

/**
 * ประมวลผลส่งเมลรายสถานี (Send + Update DB)
 */
const processStationEmail = async (lic_code, station) => {
    try {
        logInfo('Auto Order Mail', `   [SEND] -> ${station.manager_email}`);
        const success = await sendAutoOrderEmail(station);

        if (success) {
            const query = `UPDATE tbl_automatics_orders SET automatic_status = '2', mdf_dt = NOW() WHERE automatic_code = $1`;
            await pgConn.getWithParams(dbPrefix + lic_code, query, [station.automatic_code], config.connectionString());
            logInfo('Auto Order Mail', `   [SUCCESS] ${station.ptrl_number}`);
        }
        return { success: true };
    } catch (err) {
        const msg = err.message || '';
        if (msg.includes('limit exceeded') || msg.includes('550')) {
            logError('Auto Order Mail', 'Gmail Daily Limit Exceeded');
            return { success: false, limitExceeded: true };
        }
        logError('Auto Order Mail', `[ERROR] ${station.ptrl_number}: ${msg}`);
        return { success: false };
    }
};

exports.processAutoOrderMails = processAutoOrderMails;

// =========================================================
//  Decrypt Token API (สำหรับ Frontend ถอดรหัส)
// =========================================================
// redundant function removed
/*
    try {
        console.log(`   🔍 กำลังถอดรหัส Token: ${text ? text.substring(0, 20) : ''}...`);
        const parts = text.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = Buffer.from(parts[1], 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(SECRET_KEY, 'utf8'), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString('utf8');
    } catch (err) {
        return null;
    }
};*/

exports.decryptToken = async (req, res) => {
    try {
        const { token } = req.body[0] || {};
        logInfo('Auto Order Mail', `[API Decrypt] ได้รับ Request, Token ยาว: ${token ? token.length : 0} ตัวอักษร`);

        if (!token) {
            return sendResponse(res, 'error', '-1', 'ไม่พบ token', []);
        }

        // รองรับกรณี Token ติด %3A มาจาก URL
        const cleanToken = decodeURIComponent(token);
        const decrypted = decryptPayload(cleanToken);

        if (!decrypted) {
            return sendResponse(res, 'error', '-2', 'ไม่สามารถถอดรหัส token ได้ (อาจจะ Key ผิด หรือ Token ไม่ครบ)', []);
        }

        const payload = JSON.parse(decrypted);
        logInfo('Auto Order Mail', `ถอดรหัสสำเร็จ: order_id=${payload.order_id}`);

        // ตรวจสอบ Expiration
        if (payload.exp && Date.now() > payload.exp) {
            logInfo('Auto Order Mail', 'ลิงก์หมดอายุแล้ว');
            return sendResponse(res, 'error', '-5', 'ลิงก์หมดอายุแล้ว', []);
        }

        return sendResponse(res, 'success', '0', 'ถอดรหัสสำเร็จ', [{
            lic_code: payload.lic_code || '',
            order_id: payload.order_id || '',
            emp_id: payload.emp_id || '',
            emp_username: payload.u || '',
            emp_password: payload.p || '',
            expire_date: payload.exp || '',
        }]);
    } catch (err) {
        logError('Auto Order Mail', 'decryptToken Error', err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ', []);
    }
};

// ======================================================================= Auto Send to Sap Task =====================================================================

// =========== ดึงข้อมูลรายการสั่งซื้อ ที่มีการยืนยันจาก HANA ===========
const getConfirmOrder = async (lic_code, order_id, action) => {
    if (!order_id || !action) {
        let response = [
            {
                status: "error",
                invalid_code: "-1",
                message: "ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
            },
        ];
        return response;
    }

    return (async () => {
        // ================ ดึงข้อมูล tbl_order และ JOIN tbl_order_type เพื่อเอารหัส SAP ==================
        let orderScript = `
        SELECT tbl_order.*, tbl_order_type.sales_order_type 
        FROM tbl_order 
        LEFT JOIN tbl_order_type ON tbl_order.order_type = tbl_order_type.ord_type_code 
        WHERE tbl_order.id = '${order_id}' AND tbl_order.order_flag = '1' 
        LIMIT 1
    `;
        let orderResult = await pgConn.get(
            dbPrefix + lic_code,
            orderScript,
            config.connectionString(),
        );

        if (orderResult.code || orderResult.data.length === 0) {
            let response = [
                {
                    status: "error",
                    invalid_code: "-1",
                    message: "ไม่พบข้อมูลออเดอร์ในระบบ",
                },
            ];
            return response;
        }

        let orderData = orderResult.data[0];

        // ================ ดึงข้อมูล tbl_order_item ==================
        let itemScript = `
            SELECT i.item_no, i.item_qty, i.long_text_id, i.long_text, t.itm_material_number, t.itm_desc,i.sales_order_item, dp.dpo_number as delivery_plant
            FROM tbl_order_item i
            LEFT JOIN tbl_item t ON i.item_no = t.itm_code
            LEFT JOIN tbl_depot dp ON dp.dpo_code = i.deli_plant
            WHERE i.order_no = '${orderData.id}' AND i.order_item_flag = '1'
            ORDER BY i.id ASC
        `;
        let itemResult = await pgConn.get(
            dbPrefix + lic_code,
            itemScript,
            config.connectionString(),
        );
        // ================ Construct SAP Payload ==================
        let sapItems = [];
        if (!itemResult.code && itemResult.data.length > 0) {
            sapItems = itemResult.data.map((item, index) => {
                let salesOrderItem = String(item.sales_order_item);

                let qty = parseFloat(item.item_qty || 0).toLocaleString("en-US", {
                    minimumFractionDigits: 3,
                    maximumFractionDigits: 3,
                });

                let sapItemObj = {
                    SalesOrderItem: salesOrderItem,
                    Material: item.itm_material_number,
                    OrderQuantity: qty,
                    DeliveryPlant: '',
                    // DeliveryPlant: item.delivery_plant,
                    ItemText: [
                        {
                            LongTextID: item.long_text_id || 'ZT01',
                            LongText: item.long_text || 'Compartment',
                        }
                    ],
                };

                // if (item.long_text_id && item.long_text) {
                //   sapItemObj.ItemText.push({
                //     LongTextID: item.itm_material_number,
                //     LongText: item.itm_desc,
                //   });
                // }

                return sapItemObj;
            });
        }

        let cus_date_ref_formatted = orderData.cus_date_ref
            ? moment(orderData.cus_date_ref).format("YYYYMMDD")
            : "";
        let deli_date_req_formatted = orderData.deli_date_req
            ? moment(orderData.deli_date_req).format("YYYYMMDD")
            : "";
        let sh_cus_date_ref_formatted = orderData.sh_cus_date_ref
            ? moment(orderData.sh_cus_date_ref).format("YYYYMMDD")
            : "";

        if (!orderData.order_type || !orderData.order_group) {
            let response = [
                {
                    status: "error",
                    invalid_code: "-1",
                    message: "กรุณาระบุประเภทออเดอร์ และกลุ่มออเดอร์",
                },
            ];
            return response;
        }

        // let sapHeaders = [];
        // if (!itemResult.code && itemResult.data.length > 0) {
        //   sapHeaders = itemResult.data.map(item => ({
        //     "LongTextID": "ZT02",
        //     "LongText": "Driver Name"
        //   },
        //   {
        //     "LongTextID": "ZT03",
        //     "LongText": "Truck License"
        //   }));
        // }

        let payloadData = JSON.stringify({
            SalesDocuments: [
                {
                    SalesOrderType: orderData.sales_order_type,
                    SalesOrganization: orderData.order_group,
                    DistributionChannel: orderData.chanel || "01",
                    OrganizationDivision: orderData.division || "04",
                    ShipToParty: orderData.ship_to || "",
                    CustomerReference: orderData.cus_ref || "",
                    CustomerPurchaseOrderType: orderData.po_name || "AOS",
                    CustomerReferenceDate: cus_date_ref_formatted,
                    NameofOrderer: orderData.order_by || "AOS",
                    ShippingCondition: orderData.ship_cond || "T1",
                    CustomerPaymentTerms: "",
                    // CustomerPaymentTerms: orderData.pay_term || "Z001",
                    RequestedDeliveryDate: deli_date_req_formatted,
                    DeliveryTime: orderData.deli_time_req || "Z05",
                    Description: orderData.description || "",
                    SHCustomerReference: orderData.sh_cus_ref || "",
                    SHCustomerReferenceDate: sh_cus_date_ref_formatted,
                    HeaderText: [
                        {
                            "LongTextID": "ZT02",
                            "LongText": "Driver Name"
                        },
                        {
                            "LongTextID": "ZT03",
                            "LongText": "Truck License"
                        }
                    ],
                    Items: sapItems,
                },
            ],
        });

        try {
            // ============ SAP API =============
            let api_response = await sapApiClient.post(
                "/Logistics/SDI001/SOCreation",
                payloadData,
            );
            let statusRes = api_response.data.SalesDocuments[0].MessageType;
            let response = [];


            if (statusRes === "E") {
                response.push({
                    status: "error",
                    invalid_code: "-1",
                    message: api_response.data,
                });

                let messagesForLog = api_response.data.SalesDocuments[0].Messages
                    .filter(m => m.SubMessageType === 'E')
                    .map(m => m.SubMessageText)
                    .join(", ");

                let logPayload = {
                    order_id: order_id,
                    ...JSON.parse(payloadData),
                };

                await xglobal.action_logs(
                    lic_code,
                    action[0].id,
                    "confirm_order_api_error",
                    JSON.stringify(logPayload),
                    messagesForLog.substring(0, 200),
                    action[0].value,
                );

                let update_fail_script = `update tbl_order set order_status = '9', mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}' where id = '${order_id}'`;
                await pgConn.execute(dbPrefix + lic_code, update_fail_script, config.connectionString());
            } else {
                response.push({
                    status: "success",
                    data: api_response.data,
                });

                let logPayload = {
                    order_id: order_id,
                    reason: "",
                    ...JSON.parse(payloadData),
                };
                await xglobal.action_logs(
                    lic_code,
                    action[0].id,
                    "confirm_order_sap",
                    JSON.stringify(logPayload),
                    "success",
                    action[0].value,
                );
                // =============== ถ้าส่งเข้า SAP สำเร็จ (statusRes !== "E") ให้เปลี่ยนสถานะ order ในฐานข้อมูลเป็น "1" (ส่งเข้า SAP แล้ว) ===============
                let update_order_status_script = `update tbl_order set order_status = '1', mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}' `;
                update_order_status_script += ` where id = '${order_id}'`;
                await pgConn.execute(
                    dbPrefix + lic_code,
                    update_order_status_script,
                    config.connectionString(),
                );

                // =========== เชื่อมต่อ SAP Data ลงฐานข้อมูล ===========
                let sap_response = api_response.data;
                if (
                    sap_response &&
                    sap_response.SalesDocuments &&
                    Array.isArray(sap_response.SalesDocuments)
                ) {
                    for (let sap_order of sap_response.SalesDocuments) {
                        let sh_cus_ref = sap_order.SHCustomerReference;
                        if (!sh_cus_ref) continue;

                        // ===== เช็ค SHCustomerReference ว่ามีอยู่ในระบบหรือไม่ =====
                        let checkScript = `SELECT id, order_no FROM public.tbl_order WHERE sh_cus_ref = '${sh_cus_ref}' AND rm_dt IS NULL LIMIT 1`;
                        let checkResult = await pgConn.get(
                            dbPrefix + lic_code,
                            checkScript,
                            config.connectionString(),
                        );

                        // ===== Convert SAP Date to SQL Date =====
                        let creation_dt = sap_order.CreationDate
                            ? moment(sap_order.CreationDate, "YYYYMMDD").format("YYYY-MM-DD")
                            : moment().format("YYYY-MM-DD");
                        let creation_tm = sap_order.CreationTime
                            ? moment(sap_order.CreationTime, "HHmmss").format("HH:mm:ss")
                            : moment().format("HH:mm:ss");
                        let ist_dt = `${creation_dt} ${creation_tm} `;
                        // ===== Convert SAP Date to SQL Date =====
                        let deli_date_req = sap_order?.RequestedDeliveryDate
                            ? moment(sap_order?.RequestedDeliveryDate, "YYYYMMDD").format(
                                "YYYY-MM-DD",
                            )
                            : null;
                        let cus_date_ref = sap_order?.CustomerReferenceDate
                            ? moment(sap_order?.CustomerReferenceDate, "YYYYMMDD").format(
                                "YYYY-MM-DD",
                            )
                            : null;

                        if (!checkResult.code && checkResult.data.length > 0) {
                            // ===== ถ้าเจอ SHCustomerReference แล้ว Update =====
                            let existing_order_no = checkResult.data[0].order_no;
                            let existing_id = checkResult.data[0].id;
                            let orderId = existing_id || existing_order_no;

                            let updateOrderScript = `
                                UPDATE public.tbl_order SET
                                    order_no = ${sap_order.SalesOrder},
                                    status_deli = '${sap_order.OverallSDProcessStatus || "A"}',
                                    mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}'
                                WHERE sh_cus_ref = '${sh_cus_ref}'
                            `;
                            await pgConn.execute(
                                dbPrefix + lic_code,
                                updateOrderScript,
                                config.connectionString(),
                            );

                            // ===== Update Items (บันทึกเลขไอเทมที่ SAP กำหนดให้) =====
                            if (sap_order.Items && Array.isArray(sap_order.Items)) {
                                for (let sapItem of sap_order.Items) {
                                    let updateItemScript = `
                                        UPDATE public.tbl_order_item
                                        SET
                                            sales_order_item = '${sapItem.SalesOrderItem}'
                                        WHERE order_no = '${existing_id}'
                                        AND item_no IN (SELECT itm_code FROM tbl_item WHERE itm_material_number = '${sapItem.Material}')
                                    `;
                                    await pgConn.execute(
                                        dbPrefix + lic_code,
                                        updateItemScript,
                                        config.connectionString(),
                                    );
                                }
                            }
                        }
                    }
                }
            }

            return response;
        } catch (error) {
            let errMsg = error.response ? error.response.data : error.message;

            let errDetail = "";
            if (errMsg && errMsg.fault && errMsg.fault.detail) {
                errDetail = errMsg.fault.detail.errorcode || "Unknown Detail";
            } else {
                errDetail = typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg);
            }

            let response = [
                {
                    status: "error",
                    invalid_code: "-2",
                    message: "External API Error: " + errDetail,
                    data: errMsg,
                    response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                },
            ];

            let sapErrorLogs = "";
            if (errMsg && errMsg.SalesDocuments && errMsg.SalesDocuments[0] && errMsg.SalesDocuments[0].Messages) {
                let messageSub = errMsg.SalesDocuments[0].Messages
                    .filter(m => m.SubMessageType === 'E')
                    .map(m => ({
                        type: m.SubMessageType,
                        text: m.SubMessageText
                    }));
                sapErrorLogs = JSON.stringify({ message_sub: messageSub });
            } else {
                sapErrorLogs = typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg);
            }

            await xglobal.action_logs(
                lic_code,
                action[0].id,
                "confirm_order_api_error",
                sapErrorLogs,
                JSON.stringify({ order_id }),
                action[0].value,
            );

            let update_fail_script = `update tbl_order set order_status = '9', mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}' where id = '${order_id}'`;
            await pgConn.execute(dbPrefix + lic_code, update_fail_script, config.connectionString());

            return response;
        }
    })().catch(async (err) => {
        console.log(err);
        let response = [
            {
                status: "error",
                invalid_code: "-4",
                message: "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
                data: [],
                response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
            },
        ];
        return response;
    });
};


/**
 * ฟังก์ชันหลักสำหรับ Background Process ดึงออเดอร์ที่เข้าเงื่อนไขส่งเข้า SAP
 */
const runAutoOrderToSapTask = async (lic_code = '') => {
    const defaultLicCode = process.env.IS_PROD === 'true' ? 'aos_qa' : 'aos01';
    lic_code = (lic_code && lic_code.trim()) ? lic_code.trim() : defaultLicCode;
    if (lic_code === 'aos_01') lic_code = 'aos01';

    currentLicCode = lic_code;
    logInfo('Auto Order SAP Background', `เริ่มตรวจสอบรายการ Auto Order ประจำรอบเวลา ${moment().format('HH:mm:ss')}`);

    try {
        console.log(`Auto Order SAP Background [${lic_code}] เริ่มตรวจสอบรายการ Auto Order ประจำรอบเวลา ${moment().format('HH:mm:ss')}`)

        // โดยเช็คสถานะ order_status = '0' และยังมีสิทธิ์ใช้งานอยู่ (order_flag = '1' และ rm_dt IS NULL)
        const checkAutoOrderScript = `
            SELECT o.id AS order_id, o.order_no, o.ship_to, p.ptrl_desc, o.auto_order AS o_auto, p.auto_order AS p_auto  
            FROM tbl_order o 
            LEFT JOIN tbl_petrol p ON o.ship_to = p.ptrl_number 
            WHERE o.auto_order = '1' 
              AND p.auto_order = 1 
              AND o.order_status = '0'   
              AND o.order_flag = '1'     
              AND o.rm_dt IS NULL        
        `;

        const result = await pgConn.get(
            dbPrefix + lic_code,
            checkAutoOrderScript,
            config.connectionString()
        );



        if (result.code || !result.data || result.data.length === 0) {
            logInfo('Auto Order SAP Background', 'ไม่พบรายการออเดอร์อัตโนมัติที่ค้างส่งในรอบนี้');
            // console.log(`Auto Order SAP Background [aosQA] ไม่พบรายการออเดอร์อัตโนมัติที่ค้างส่งในรอบนี้`)
            return { success: true };
        }

        // logInfo('Auto Order SAP Background', `พบออเดอร์ระบบอัตโนมัติค้างส่งจำนวน ${result.data.length} รายการ`);
        console.log(`Auto Order SAP Background [aosQA] พบออเดอร์ระบบอัตโนมัติจำนวน ${result.data.length} รายการ`)

        for (const order of result.data) {
            // logInfo('Auto Order SAP Background', `กำลังส่งออเดอร์ ID: ${order.order_id} ของสถานี: ${order.ptrl_desc}`);
            console.log(`Auto Order SAP Background [aosQA] กำลังส่งออเดอร์ ID: ${order.order_id} ของสถานี: ${order.ptrl_desc}`)
            const targetOrderId = String(order.order_id);
            const sapResult = await getConfirmOrder(lic_code, targetOrderId, 'auto');

            // เช็คสถานะการส่งเพื่อเก็บ Log เบื้องต้น
            if (sapResult && sapResult[0] && sapResult[0].status === 'success') {
                // logInfo('Auto Order SAP Background', `   ✔️ ส่งออเดอร์ ID: ${order.order_id} เข้า SAP สำเร็จ`);
                console.log(`Auto Order SAP Background [aosQA] ส่งออเดอร์ ID: ${order.order_id} ของสถานี: ${order.ptrl_desc} สำเร็จ`)
            } else {
                // logError('Auto Order SAP Background', `   ❌ ส่งออเดอร์ ID: ${order.order_id} ล้มเหลว: ${sapResult[0]?.message || 'Unknown Error'}`);
                console.log(`Auto Order SAP Background [aosQA] ส่งออเดอร์ ID: ${order.order_id} ของสถานี: ${order.ptrl_desc} ล้มเหลว`)
            }
        }

        return { success: true };

    } catch (error) {
        logError('Auto Order SAP Background', 'เกิดข้อผิดพลาดในการทำงานของ Task Auto Order To SAP', error);
        return { success: false };
    }
};

exports.runAutoOrderToSapTask = runAutoOrderToSapTask;







// ======================================================================= Remove Auto Order that over 3 days =====================================================================

// Task สำหรับลบ Auto Order ที่ค้างเกิน 3 วัน (รันพร้อมกับรอบส่งเมล)
exports.runAutoOrderCleanupTask = async (lic_code = '') => {
    const defaultLicCode = process.env.IS_PROD === 'true' ? 'aos_qa' : 'aos01';
    lic_code = (lic_code && lic_code.trim()) ? lic_code.trim() : defaultLicCode;
    if (lic_code === 'aos_01') lic_code = 'aos01';

    setLicCode(lic_code);
    try {
        const dbName = dbPrefix + lic_code;

        console.log(dbName)
        console.log(lic_code)

        // วันที่ย้อนหลัง 3 วัน (นับจากวันนี้)
        const thresholdDate = moment().subtract(3, "days").format("YYYY-MM-DD");

        const updateScript = `
            UPDATE tbl_order 
            SET order_flag = '0', 
                rm_dt = CURRENT_TIMESTAMP 
            WHERE auto_order = '1' 
              AND order_flag = '1' 
              AND order_status = '0' 
              AND CURRENT_DATE >= (deli_date_req + INTERVAL '3 days')
        `;

        const result = await pgConn.execute(
            dbName,
            updateScript,
            config.connectionString(),
        );

        if (result.rowaction > 0) {
            logInfo('Auto Order Cleanup', `อัปเดตออเดอร์ที่หมดอายุจำนวน ${result.rowaction} รายการ (ก่อนวันที่ ${thresholdDate})`);
        } else {
            logInfo('Auto Order Cleanup', 'ไม่พบรายการที่ต้องลบสำหรับออเดอร์ที่มีอายุเกิน 3 วัน');
        }
    } catch (error) {
        logError('Auto Order Cleanup', 'Auto Order Cleanup Error', error);
    }
};

// =========== API สำหรับ Test การอัปเดต Flag Auto Order ===========
exports.updateAutoOrderFlag = async (req, res, next) => {
    let lic_code = req.header("lic_code");
    const defaultLicCode = process.env.IS_PROD === 'true' ? 'aos_qa' : 'aos01';
    lic_code = (lic_code && lic_code.trim()) ? lic_code.trim() : defaultLicCode;
    if (lic_code === 'aos_01') lic_code = 'aos01';

    setLicCode(lic_code);
    let dbName = dbPrefix + lic_code;

    try {
        const updateScript = `
                UPDATE tbl_order 
                SET order_flag = '0', 
                    rm_dt = CURRENT_TIMESTAMP 
                WHERE auto_order = '1' 
                AND order_flag = '1' 
                AND order_status = '0'
                AND CURRENT_DATE >= (deli_date_req + INTERVAL '3 days')
`;

        const result = await pgConn.execute(
            dbName,
            updateScript,
            config.connectionString(),
        );
        logInfo('Auto Order Mail', `updateAutoOrderFlag success: rowaction=${result.rowaction}`);

        let response = [
            {
                status: "success",
                invalid_code: "0",
                message: `ดำเนินการอัปเดตเรียบร้อย (พบรายการที่เข้าเงื่อนไข ${result.rowaction} รายการ)`,
                data: {
                    updated_count: result.rowaction,
                },
                response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
            },
        ];
        res.status(200).send(response);
    } catch (error) {
        logError('Auto Order Mail', 'updateAutoOrderFlag Error', error);
        let response = [
            {
                status: "error",
                invalid_code: "-1",
                message: "เกิดข้อผิดพลาดในการอัปเดตข้อมูล",
                data: error.message,
                response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
            },
        ];
        res.status(200).send(response);
    }
};


/**
 * ฟังก์ชันหลักสำหรับ Background Process ดึงออเดอร์ที่เข้าเงื่อนไขส่งเข้า SAP [AOS01 AND AOS02]
 */
// const runAutoOrderToSapTask = async (lic_code = 'aos01') => {
//     currentLicCode = lic_code;
//     logInfo('Auto Order SAP Background', `เริ่มตรวจสอบรายการ Auto Order ประจำรอบเวลา ${moment().format('HH:mm:ss')}`);

//     try {
//         // ใช้ SQL ตัวอย่างของคุณมาปรับเงื่อนไขดักจับเฉพาะตัวที่ 'ยังไม่ได้ส่ง' 
//         // โดยเช็คสถานะ order_status = '0' และยังมีสิทธิ์ใช้งานอยู่ (order_flag = '1' และ rm_dt IS NULL)
//         const checkAutoOrderScript = `
//             SELECT o.id AS order_id, o.order_no, o.ship_to, p.ptrl_desc, o.auto_order AS o_auto, p.auto_order AS p_auto  
//             FROM tbl_order o 
//             LEFT JOIN tbl_petrol p ON o.ship_to = p.ptrl_number 
//             WHERE o.auto_order = '1' 
//               AND p.auto_order = 1 
//               AND o.order_status = '0'   
//               AND o.order_flag = '1'     
//               AND o.rm_dt IS NULL        
//         `;

//         const result = await pgConn.get(
//             dbPrefix + lic_code,
//             checkAutoOrderScript,
//             config.connectionString()
//         );



//         if (result.code || !result.data || result.data.length === 0) {
//             logInfo('Auto Order SAP Background', 'ไม่พบรายการออเดอร์อัตโนมัติที่ค้างส่งในรอบนี้');
//             return { success: true };
//         }

//         // logInfo('Auto Order SAP Background', `พบออเดอร์ระบบอัตโนมัติค้างส่งจำนวน ${result.data.length} รายการ`);
//         console.log(`Auto Order SAP Background [aosQA] พบออเดอร์ระบบอัตโนมัติจำนวน ${result.data.length} รายการ`)

//         for (const order of result.data) {
//             // logInfo('Auto Order SAP Background', `กำลังส่งออเดอร์ ID: ${order.order_id} ของสถานี: ${order.ptrl_desc}`);
//             console.log(`Auto Order SAP Background [${lic_code}] กำลังส่งออเดอร์ ID: ${order.order_id} ของสถานี: ${order.ptrl_desc}`)
//             const targetOrderId = String(order.order_id);
//             const sapResult = await getConfirmOrder(lic_code, targetOrderId, 'auto');

//             // เช็คสถานะการส่งเพื่อเก็บ Log เบื้องต้น
//             if (sapResult && sapResult[0] && sapResult[0].status === 'success') {
//                 // logInfo('Auto Order SAP Background', `   ✔️ ส่งออเดอร์ ID: ${order.order_id} เข้า SAP สำเร็จ`);
//                 console.log(`Auto Order SAP Background [${lic_code}] ส่งออเดอร์ ID: ${order.order_id} ของสถานี: ${order.ptrl_desc} สำเร็จ`)
//             } else {
//                 // logError('Auto Order SAP Background', `   ❌ ส่งออเดอร์ ID: ${order.order_id} ล้มเหลว: ${sapResult[0]?.message || 'Unknown Error'}`);
//                 console.log(`Auto Order SAP Background [aosQA] ส่งออเดอร์ ID: ${order.order_id} ของสถานี: ${order.ptrl_desc} ล้มเหลว`)
//             }
//         }

//         return { success: true };

//     } catch (error) {
//         logError('Auto Order SAP Background', 'เกิดข้อผิดพลาดในการทำงานของ Task Auto Order To SAP', error);
//         return { success: false };
//     }
// };
