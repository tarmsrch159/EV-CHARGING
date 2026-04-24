const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;
const moment = require('moment');
const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const dbPrefix = config.dbPrefix();
const path = require('path');
const fs = require('fs');

const mailer = require('./nodemailer/mail');

// =========================================================
//  Helper: Sleep
// =========================================================
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));



/**
 * ดึงข้อมูล Order และ Items ของสถานีน้ำมันรายปั๊ม
 */
const getDataForStation = async (lic_code, autoItem) => {
    try {
        console.log(`\n🔍 [Auto Order Mail] อ่านข้อมูลปั๊ม: ${autoItem.ptrl_desc} (${autoItem.ptrl_number})`);

        // 1. ดึง order ที่เป็น auto_order ของปั๊มนั้นๆ
        const orderScript = `
            SELECT id, order_no, sh_cus_ref, ship_to, order_type, order_status, deli_date_req, description, ist_dt
            FROM tbl_order
            WHERE ship_to = $1 AND auto_order = '1' AND order_flag = '1' AND rm_dt IS NULL
            ORDER BY ist_dt DESC
        `;
        const orderResult = await pgConn.getWithParams(dbPrefix + lic_code, orderScript, [autoItem.ptrl_number], config.connectionString());

        if (orderResult.code || !orderResult.data || orderResult.data.length === 0) {
            console.log(`   ⚪ ไม่พบ auto order สำหรับปั๊มนี้`);
            return null;
        }

        const orders = orderResult.data;
        console.log(`   📦 พบ auto order: ${orders.length} รายการ`);

        // 2. ดึงรายละเอียดน้ำมันของแต่ละ order
        const orderDetails = [];
        for (const order of orders) {
            const itemScript = `
                SELECT toi.id, toi.order_no, toi.item_no, toi.item_qty, toi.deli_plant,
                       ti.itm_desc AS product_name, td.dpo_desc AS depot_name
                FROM tbl_order_item toi
                LEFT JOIN tbl_item ti ON toi.item_no = ti.itm_code
                LEFT JOIN tbl_depot td ON toi.deli_plant = td.dpo_code AND td.dpo_flag = '1'
                WHERE CAST(toi.order_no AS TEXT) = $1 AND toi.order_item_flag = '1' AND toi.rm_dt IS NULL
                ORDER BY toi.id ASC
            `;
            const itemResult = await pgConn.getWithParams(dbPrefix + lic_code, itemScript, [String(order.id)], config.connectionString());

            let items = [];
            if (!itemResult.code && itemResult.data) {
                items = JSON.parse(JSON.stringify(itemResult.data).replace(/:null/gi, ':""'));
            }

            // ========= เตรียมชุดข้อมูล Order และ Items ของสถานีน้ำมันรายปั๊ม เพื่อส่งเมล =========
            orderDetails.push({
                order_id: order.id,
                order_no: order.order_no || '',
                sh_cus_ref: order.sh_cus_ref || '',
                order_status: order.order_status || '',
                deli_date_req: order.deli_date_req || '',
                description: order.description || '',
                ist_dt: order.ist_dt || '',
                items: items
            });
            console.log(`      📋 Order #${order.order_no || order.id}: พบ ${items.length} รายการน้ำมัน`);
        }

        return {
            automatic_code: autoItem.automatic_code,
            ptrl_code: autoItem.ptrl_code,
            ptrl_number: autoItem.ptrl_number,
            ptrl_desc: autoItem.ptrl_desc,
            ptrl_short_desc: autoItem.ptrl_short_desc || '',
            manager_email: autoItem.ptrl_remark ? autoItem.ptrl_remark.replace(/;/g, ',').split(',').map(e => e.trim()).filter(e => e).join(',') : '',
            orders: orderDetails
        };
    } catch (err) {
        console.error(`❌ [Auto Order Mail] Error gathering data for station ${autoItem.ptrl_number}:`, err);
        return null;
    }
};

/**
 * 📧 Helper: สร้างเนื้อหา HTML และใช้ Nodemailer ส่งเมล
 * พร้อมบันทึกไฟล์เพื่อดูตัวอย่าง (Preview)
 */
const sendAutoOrderEmail = async (stationData, actionId) => {
    try {
        const toEmail = stationData.manager_email || 'test@example.com';
        const stationName = `${stationData.ptrl_desc} (${stationData.ptrl_number})`;
        const reportBaseUrl = 'https://spd-demo.dtc.co.th:9101/main/order/order-report';

        // 1. สร้างหัวข้อตาราง HTML
        let htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            </head>
            <body style="margin: 0; padding: 20px; background-color: #f9f9f9;">
                <div style="max-width: 750px; margin: 0 auto; background-color: #ffffff; font-family: sans-serif; padding: 30px; border: 1px solid #e0e0e0; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                    <div style="text-align: center; margin-bottom: 25px;">
                        <img src="https://www.bangchak.co.th/uploads/logos/logo.png" alt="Bangchak" style="max-height: 50px; margin-bottom: 10px;">
                        <h2 style="color: #00695c; margin: 0; font-size: 24px;">รายงานออเดอร์อัตโนมัติ (Auto Order)</h2>
                        <div style="width: 50px; height: 3px; background-color: #8bc34a; margin: 15px auto;"></div>
                    </div>

                    <p style="font-size: 16px; color: #333;">เรียน ผู้จัดการปั๊ม <strong>${stationName}</strong>,</p>
                    <p style="font-size: 15px; color: #555; line-height: 1.5;">
                        ระบบ Automatic Ordering System (AOS) ได้ทำการประมวลผลและสร้างคำสั่งซื้อน้ำมันสำหรับรอบวันที่ <strong>${moment().format('DD/MM/YYYY')}</strong> เรียบร้อยแล้ว โดยมีรายละเอียดดังตารางด้านล่าง:
                    </p>
                    
                    <table style="width: 100%; border-collapse: collapse; margin-top: 25px; border: 1px solid #eee;">
                        <thead>
                            <tr style="background-color: #00695c; color: #ffffff;">
                                <th style="padding: 12px; text-align: left; border: 1px solid #004d40; font-size: 14px;">เลขที่ออเดอร์ (AOS)</th>
                                <th style="padding: 12px; text-align: left; border: 1px solid #004d40; font-size: 14px;">ผลิตภัณฑ์</th>
                                <th style="padding: 12px; text-align: right; border: 1px solid #004d40; font-size: 14px;">จำนวน (ลิตร)</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        // 2. เตรียม URL สำหรับปุ่มตรวจสอบ (ใช้ออเดอร์แรกเป็นหลัก)
        const firstOrder = stationData.orders[0] || {};
        const firstAosNo = firstOrder.sh_cus_ref || firstOrder.order_no || '-';
        const mainConfirmUrl = `${reportBaseUrl}?aos_order_no=${firstAosNo}&emp_id=${actionId}`;

        // 3. วนลูปสร้างแถวในตาราง
        for (const order of stationData.orders) {
            const rowSpan = order.items.length;
            const aosNo = order.sh_cus_ref || order.order_no || '-';
            const confirmUrl = `${reportBaseUrl}?aos_order_no=${aosNo}&emp_id=${actionId}`;

            for (let i = 0; i < order.items.length; i++) {
                const item = order.items[i];
                htmlContent += `
                    <tr>
                `;

                // คอลัมน์แรก (เลขออเดอร์) และคอลัมน์สุดท้าย (ปุ่มกด) จะแสดงเฉพาะแถวแรกของ Order นั้นๆ
                if (i === 0) {
                    htmlContent += `
                        <td rowspan="${rowSpan}" style="border: 1px solid #eee; padding: 12px; font-weight: bold; color: #00796b;">${aosNo}</td>
                    `;
                }

                htmlContent += `
                    <td style="border: 1px solid #eee; padding: 12px;">${item.product_name}</td>
                    <td style="border: 1px solid #eee; padding: 12px; text-align: right; font-family: monospace; font-size: 15px;">${Number(item.item_qty).toLocaleString()}</td>
                `;



                htmlContent += `
                    </tr>
                `;
            }
        }

        htmlContent += `
                        </tbody>
                    </table>

                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${mainConfirmUrl}" style="display: inline-block; padding: 14px 40px; background-color: #00695c; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 10px rgba(0,105,92,0.2);">
                            ตรวจสอบข้อมูลและยืนยันออเดอร์
                        </a>
                    </div>

                    <div style="margin-top: 30px; padding: 15px; background-color: #f1f8e9; border-left: 4px solid #8bc34a; border-radius: 4px;">
                        <p style="margin: 0; font-size: 14px; color: #33691e;">
                            <strong>💡 หมายเหตุ:</strong> ออเดอร์นี้ถูกสร้างโดยระบบอัตโนมัติ กรุณาคลิกปุ่ม <strong>"ตรวจสอบ"</strong> เพื่อดูรายละเอียดเพิ่มเติมหรือจัดการสถานะออเดอร์ในหน้าจอหลัก
                        </p>
                    </div>

                    <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 20px;">
                        <p style="margin: 5px 0;">Bangchak Corporation Public Company Limited</p>
                        <p style="margin: 5px 0;">นี่คืออีเมลอัตโนมัติ กรุณาอย่าตอบกลับ</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        // 3. บันทึกไฟล์ HTML สำหรับแสดงตัวอย่าง (Preview)
        const previewPath = path.join(__dirname, 'preview_html/preview_email.html');
        // ตรวจสอบโฟลเดอร์ก่อนบันทึก
        const dir = path.dirname(previewPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(previewPath, htmlContent, 'utf8');
        console.log(`   📝 [PREVIEW] บันทึกไฟล์ตัวอย่างไว้ที่: ${previewPath}`);

        // 4. ส่งเมลจริง (หรือ Mock ตามที่ตั้งค่าใน mailer)
        const mailResult = await mailer.sendMail(
            toEmail,
            `[Auto Order] รายงานยอดสั่งซื้ออัตโนมัติ - ${stationData.ptrl_desc}`,
            htmlContent
        );

        return mailResult.success;
    } catch (err) {
        console.error('❌ [sendAutoOrderEmail Error]:', err);
        return false;
    }
};


// =========================================================
//  ฟังก์ชันหลัก: ดึงข้อมูล (Sync กับ Scheduler Logic)
// =========================================================
const processAutoOrderMails = async (lic_code, actionId) => {
    console.log(`\n========================================`);
    console.log(`📧 [Auto Order Mail] เริ่มประมวลผล (Sync Mode): ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`========================================`);

    try {
        const autoOrderScript = `
            SELECT ao.automatic_code, ao.ptrl_code, ao.ist_dt, ao.result, ao.automatic_status,
                   p.ptrl_number, p.ptrl_desc, p.ptrl_short_desc, p.ptrl_remark
            FROM tbl_automatics_orders ao
            INNER JOIN tbl_petrol p ON ao.ptrl_code = p.ptrl_code
            WHERE ao.automatic_status = '1' AND ao.ist_dt::date = CURRENT_DATE - 1
              AND p.ptrl_remark IS NOT NULL AND p.ptrl_remark != ''
            ORDER BY ao.ist_dt DESC
        `;
        const autoOrderResult = await pgConn.get(dbPrefix + lic_code, autoOrderScript, config.connectionString());

        if (autoOrderResult.code || !autoOrderResult.data || autoOrderResult.data.length === 0) {
            return { success: true, message: 'ไม่มีรายการที่ต้องประมวลผล', data: [] };
        }

        const mailDataList = [];
        for (const autoItem of autoOrderResult.data) {
            // ======== ส่งข้อมูลปั๊มที่มีการคำนวณ Auto Order ไปดึงรายละเอียดข้อมูล Order =========  
            const data = await getDataForStation(lic_code, autoItem);
            if (data) {
                mailDataList.push(data);

                // สำหรับการ TEST ผ่าน API: ให้จำลองการส่งเมลด้วย
                console.log(`🧪 [API TEST] ทดลองส่งเมลสำหรับสถานี: ${data.ptrl_desc}`);
                await sendAutoOrderEmail(data, actionId);
            }
        }

        return { success: true, message: `พบข้อมูล ${mailDataList.length} แห่ง`, data: mailDataList };
    } catch (err) {
        console.error('❌ [Auto Order Mail] Bulk Process Error:', err);
        return { success: false, message: err.message, data: [] };
    }
};

// =========================================================
//  API Endpoint: เรียกดูข้อมูล Auto Order Mail (Manual Trigger)
// =========================================================
exports.getAutoOrderMailData = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { action } = req.body[0] || {};
        const actionId = (action && action.length > 0) ? action[0].id : 'MANUAL';

        if (!lic_code) return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง', []);

        // ======= เรียกใช้ Function สำหรับดึงข้อมูลปั๊มที่มีการคำนวณAuto Order แล้ว =======
        const result = await processAutoOrderMails(lic_code, actionId);

        if (!result.success) return sendResponse(res, 'error', '-3', result.message, []);
        return sendResponse(res, 'success', '0', result.message, result.data);
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบ', []);
    }
};

// =========================================================
//  Background Task: Sequential Workflow (Read -> Send -> Update -> Wait)
// =========================================================
exports.runAutoOrderMailTask = async () => {
    const lic_code = 'aos01';
    console.log(`\n🚀 [Auto Order Mail] เริ่มงาน Background Task: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);

    try {
        // 1. ดึงรายการปั๊มที่มีการคำนวณ Auto Order แล้ว
        const listScript = `
            SELECT ao.automatic_code, ao.ptrl_code, ao.ist_dt, ao.automatic_status,
                   p.ptrl_number, p.ptrl_desc, p.ptrl_short_desc, p.ptrl_remark
            FROM tbl_automatics_orders ao
            INNER JOIN tbl_petrol p ON ao.ptrl_code = p.ptrl_code
            WHERE ao.automatic_status = '1' AND ao.ist_dt::date = CURRENT_DATE - 1
              AND p.ptrl_remark IS NOT NULL AND p.ptrl_remark != ''
            ORDER BY ao.ist_dt DESC 
        `;
        const listResult = await pgConn.get(dbPrefix + lic_code, listScript, config.connectionString());

        if (listResult.code || !listResult.data || listResult.data.length === 0) {
            console.log(`ℹ️  [Auto Order Mail] ไม่มีงานค้างในวันนี้`);
            return { success: true, data: [] };
        }

        const autoList = listResult.data;
        console.log(`✅ [Auto Order Mail] มีงานที่ต้องส่งเมลทั้งหมด: ${autoList.length} รายการ`);

        // 2. วนลูปทีละรายการ (Read -> Send -> Update -> Wait)
        for (const [index, autoItem] of autoList.entries()) {
            console.log(`\n--- [รายการที่ ${index + 1}/${autoList.length}] ---`);

            // ============= Phase 1: ดึงข้อมูล Order และ Items ของสถานีน้ำมันรายปั๊มที่เป็น Auto Order =============
            const stationData = await getDataForStation(lic_code, autoItem);

            if (stationData) {
                // ============= Phase 2: SEND (เตรียมส่งข้อมูลชุดนั้นเลย) =============
                console.log(`📧 [SEND] กำลังส่งอีเมลไปที่: ${stationData.manager_email} (ปั๊ม: ${stationData.ptrl_desc})`);

                // จำลองการส่งเมล (ระบบอัตโนมัติจะใช้ actionId เป็น 'SYSTEM')
                const isSent = await sendAutoOrderEmail(stationData, 'SYSTEM');

                if (isSent) {
                    // ============== Phase 3: UPDATE (อัปเดตสถานะทันทีเมื่อทำเสร็จหนึ่งรายการ) ==============
                    const updateScript = `UPDATE tbl_automatics_orders SET automatic_status = '2', mdf_dt = NOW() WHERE automatic_code = $1`;
                    await pgConn.getWithParams(dbPrefix + lic_code, updateScript, [autoItem.automatic_code], config.connectionString());
                    console.log(`✅ [UPDATE] ปรับสถานะ ${autoItem.automatic_code} เป็น '2' (เสร็จสมบูรณ์)`);
                } else {
                    console.error(`❌ [SEND FAILED] ไม่สามารถส่งเมลของปั๊ม ${stationData.ptrl_number} ได้`);
                }
            }

            // Phase 4: WAIT (หน่วงแต่ละครั้งในการส่ง เพื่อป้องกัน mail spam)
            if (index < autoList.length - 1) {
                console.log(`[WAIT] รอ 2 วินาทีก่อนเริ่มรายการถัดไป...`);
                await sleep(2000);
            }
        }

        console.log(`\n========================================`);
        console.log(`🏁 [Auto Order Mail] จบการทำงานครบทุกรายการ`);
        console.log(`========================================\n`);

        return { success: true, total: autoList.length };

    } catch (err) {
        console.error('❌ [Auto Order Mail Task Error]:', err);
        return { success: false, message: err.message };
    }
};

// Export สำหรับใช้ภายนอก
exports.processAutoOrderMails = processAutoOrderMails;
