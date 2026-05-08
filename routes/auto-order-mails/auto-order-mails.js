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
        console.error('   ❌ [encryptPayload Error]:', err.message);
        return null;
    }
};

/**
 * ถอดรหัส Token เป็นข้อมูลดิบ
 */
const decryptPayload = (text) => {
    try {
        if (!text) return null;
        console.log(`   🔍 กำลังถอดรหัส Token: ${text.substring(0, 20)}...`);

        const parts = text.split(':');
        if (parts.length !== 2) {
            console.error('   ❌ Token Format ผิด (ไม่มีเครื่องหมาย :)');
            return null;
        }

        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = Buffer.from(parts[1], 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY, 'utf8'), iv);

        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString('utf8');
    } catch (err) {
        console.error('   ❌ [decryptPayload Error]:', err.message);
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
        <div style="max-width: 680px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #e3e8e5; box-shadow: 0 10px 25px rgba(14,130,63,0.05);">
            <div style="text-align: center; margin-bottom: 35px;">
                <img src="${logoUrl}" alt="Bangchak" style="max-height: 85px; margin-bottom: 15px;">
                <h2 style="color: #0E823F; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.3px;">รายงานออเดอร์อัตโนมัติ (Auto Order)</h2>
                <div style="width: 60px; height: 4px; background: linear-gradient(90deg, #0E823F 0%, #F05A28 100%); margin: 15px auto; border-radius: 2px;"></div>
            </div>

            <p style="font-size: 16px; color: #1C2421; line-height: 1.6; margin-bottom: 8px;">เรียน ผู้จัดการปั๊ม <strong>${stationName}</strong>,</p>
            <p style="font-size: 15px; color: #4A5551; line-height: 1.6; margin-top: 0; margin-bottom: 25px;">
                ระบบ Automatic Ordering System (AOS) ได้สร้างคำสั่งซื้อน้ำมันแนะนำสำหรับรอบวันที่ <strong>${moment().format('DD/MM/YYYY')}</strong> เรียบร้อยแล้ว:
            </p>
            
            <div style="border-radius: 12px; overflow: hidden; border: 1px solid #e1e8e4; margin: 25px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.01);">
                <table style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
                    <thead>
                        <tr style="background-color: #0E823F; color: #ffffff;">
                            <th style="padding: 14px 16px; text-align: left; font-size: 14px; font-weight: 600; border-bottom: 2px solid #0B6B34;">เลขที่ออเดอร์ (AOS)</th>
                            <th style="padding: 14px 16px; text-align: left; font-size: 14px; font-weight: 600; border-bottom: 2px solid #0B6B34;">ผลิตภัณฑ์</th>
                            <th style="padding: 14px 16px; text-align: right; font-size: 14px; font-weight: 600; border-bottom: 2px solid #0B6B34;">จำนวน (ลิตร)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ordersHtml}
                    </tbody>
                </table>
            </div>

            <div style="text-align: center; margin: 35px 0 25px 0;">
                <a href="${confirmUrl}" style="display: inline-block; padding: 14px 45px; background: linear-gradient(135deg, #0E823F 0%, #0B6B34 100%); color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 6px 20px rgba(14,130,63,0.25); transition: all 0.2s ease;">
                    ตรวจสอบข้อมูลและยืนยันออเดอร์
                </a>
            </div>

            <div style="margin-top: 30px; padding: 16px 20px; background-color: #f0f9f3; border-left: 4px solid #0E823F; border-radius: 6px; text-align: left;">
                <p style="margin: 0; font-size: 14px; color: #1C3F2A; line-height: 1.5;">
                    <strong style="color: #0E823F;">💡 หมายเหตุ:</strong> ออเดอร์นี้ถูกสร้างขึ้นโดยระบบแนะนำอัตโนมัติ กรุณาคลิกปุ่ม <strong>"ตรวจสอบข้อมูลและยืนยันออเดอร์"</strong> ด้านบนเพื่อจัดการและยืนยันสถานะออเดอร์ให้เสร็จสมบูรณ์
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
        console.log(`\n🔍 [Auto Order Mail] อ่านข้อมูลปั๊ม: ${autoItem.ptrl_desc} (${autoItem.ptrl_number})`);

        const orderScript = `
            SELECT id, order_no, sh_cus_ref, ship_to, order_type, order_status, deli_date_req, description, ist_dt
            FROM tbl_order
            WHERE ship_to = $1 AND auto_order = '1' AND order_flag = '1' AND rm_dt IS NULL
            ORDER BY ist_dt DESC
        `;
        // ====== ดึงข้อมูล Order (ออเดอร์หลัก) ======
        const orderResult = await pgConn.getWithParams(dbPrefix + lic_code, orderScript, [autoItem.ptrl_number], config.connectionString());

        let orderDetails = [];
        if (orderResult.code || !orderResult.data || orderResult.data.length === 0) {
            console.log(`   ⚪ ไม่พบ auto order สำหรับปั๊มนี้ (จะส่งรายงานไม่มียอดสั่งน้ำมันแทน)`);
        } else {
            const orders = orderResult.data;
            orderDetails = await Promise.all(orders.map(async (order) => {
                // ====== ดึงข้อมูล Order Items (ออเดอร์ย่อย) ======
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

        // ====== ดึงข้อมูลผู้จัดการปั๊ม (emp_code) จาก tbl_employee ======
        const manager = await getManagerByPtrlCode(lic_code, autoItem.ptrl_code);
        console.log(`   👤 ผู้จัดการปั๊ม: ${manager ? manager.emp_code : 'ไม่พบ'}`);
        return {
            lic_code: lic_code,
            automatic_code: autoItem.automatic_code,
            ptrl_code: autoItem.ptrl_code,
            ptrl_number: autoItem.ptrl_number,
            ptrl_desc: autoItem.ptrl_desc,
            ptrl_short_desc: autoItem.ptrl_short_desc || '',
            manager_email: cleanEmails(autoItem.ptrl_remark),
            manager_emp_code: manager ? manager.emp_code : '',
            manager_username: manager ? manager.emp_username : '',
            manager_password: manager ? manager.emp_userpassword : '',
            orders: orderDetails
        };
    } catch (err) {
        console.error(`❌ [Auto Order Mail Data Error] ${autoItem.ptrl_number}:`, err);
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
            console.log(`   🔗 สร้างลิงก์ตรวจสอบ: ${confirmUrl}`);

            rowsHtml = generateEmailTableRows(stationData.orders);
        } else {
            // =========== กรณีไม่Auto Order ของปั๊มนั้นๆ ===========
            subject = `[Auto Order] ไม่มียอดสั่งน้ำมันในวันนี้ - ${stationData.ptrl_desc}`;
            console.log(`   ℹ️  ไม่มียอดสั่งซื้อ: เตรียมส่งเมลแจ้งเตือนไม่มียอดสั่งน้ำมัน`);
        }

        const htmlContent = generateFullEmailHtml(stationName, confirmUrl, rowsHtml, hasOrders);

        // Preview File
        const previewPath = path.join(__dirname, 'preview_html', 'preview_email.html');
        if (!fs.existsSync(path.dirname(previewPath))) fs.mkdirSync(path.dirname(previewPath), { recursive: true });
        fs.writeFileSync(previewPath, htmlContent, 'utf8');

        const attachments = [{
            filename: 'Logo.png',
            path: path.join(__dirname, '../../public/images/Logo.png'),
            cid: 'bangchak_logo'
        }];

        return (await mailer.sendMail(toEmail, subject, htmlContent, attachments)).success;
    } catch (err) {
        console.error('❌ [sendAutoOrderEmail Error]:', err);
        return false;
    }
};

/**
 * ดึงข้อมูลปั๊มที่มีการคำนวณ Auto Order เพื่อเอาไปใช้หารายการสั่งซื้อ
 */
const processAutoOrderMails = async (lic_code) => {
    console.log(`\n📧 [Auto Order Mail] เริ่มประมวลผล: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
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
        for (const item of result.data) {
            const data = await getDataForStation(lic_code, item);
            if (data) {
                mailDataList.push(data);
                await sendAutoOrderEmail(data);
            }
        }
        return { success: true, message: `พบข้อมูล ${mailDataList.length} แห่ง`, data: mailDataList };
    } catch (err) {
        console.error('❌ [processAutoOrderMails Error]:', err);
        return { success: false, message: err.message };
    }
};

/**
 * Controller API
 */
exports.getAutoOrderMailData = async (req, res) => {
    try {
        const lic_code = req.header('lic_code');

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
exports.runAutoOrderMailTask = async () => {
    const lic_code = 'aos01';
    console.log(`\n🚀 [Auto Order Mail] เริ่ม Background Task: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);

    try {
        const query = `
            SELECT ao.automatic_code, ao.ptrl_code, ao.ist_dt, ao.automatic_status,
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
            console.log(`ℹ️  [Auto Order Mail] ไม่มีงานค้าง`);
            return { success: true };
        }

        const autoList = result.data;
        console.log(`✅ [Auto Order Mail] รวม: ${autoList.length} รายการ`);

        for (const [index, item] of autoList.entries()) {
            console.log(`\n--- [${index + 1}/${autoList.length}] ---`);
            const autoOrderInfo = await getDataForStation(lic_code, item);

            if (autoOrderInfo) {
                console.log(`📧 [SEND] กำลังส่งเมล: ${autoOrderInfo.manager_email}`);
                if (await sendAutoOrderEmail(autoOrderInfo)) {
                    const updateQuery = `UPDATE tbl_automatics_orders SET automatic_status = '2', mdf_dt = NOW() WHERE automatic_code = $1`;
                    await pgConn.getWithParams(dbPrefix + lic_code, updateQuery, [item.automatic_code], config.connectionString());
                    console.log(`✅ [UPDATE] เรียบร้อย (${item.automatic_code})`);
                }
            }
            // ===== พัก 2 วินาทีระหว่างการส่งเมลแต่ละฉบับ =====
            if (index < autoList.length - 1) await sleep(2000);
        }
        return { success: true };
    } catch (err) {
        console.error('❌ [runAutoOrderMailTask Error]:', err);
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
        console.log(`\n📥 [API Decrypt] ได้รับ Request, Token ยาว: ${token ? token.length : 0} ตัวอักษร`);

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
        console.log(`   ✅ ถอดรหัสสำเร็จ: order_id=${payload.order_id}`);

        // ตรวจสอบ Expiration
        if (payload.exp && Date.now() > payload.exp) {
            console.warn('   ⚠️ ลิงก์หมดอายุแล้ว');
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
        console.error('   ❌ [decryptToken Error]:', err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ', []);
    }
};
