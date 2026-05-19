const ExcelJS = require('exceljs');
const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const mailer = require('../../middleware/nodemailer/mail');
const xglobal = new require('../../middleware/global');
const fs = require('fs');
const path = require('path');

const dbPrefix = config.dbPrefix();

const logInfo = xglobal.logInfo;
const logError = xglobal.logError;

// ==========================================================================
// 1. TEMPLATE GENERATORS (Email & Excel)
// ==========================================================================

/**
 * สร้างโครงสร้าง HTML สำหรับเนื้อหาในอีเมลแจ้งเตือน
 */
const generateLowStockEmailHtml = (petrolInfo, lowStockProducts) => {
    let rowsHtml = '';
    lowStockProducts.forEach(prod => {
        const recom = Math.max(0, Number(prod.total_day_sales) - Number(prod.total_usable_stock));
        rowsHtml += `
            <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 12px 15px; text-align: center;">${prod.tank_numbers}</td>
                <td style="padding: 12px 15px;">${prod.product_name || '-'}</td>
                <td style="padding: 12px 15px; text-align: right; color: #d9534f; font-weight: bold;">
                    ${Math.max(0, Number(prod.total_usable_stock)).toLocaleString()} ลิตร
                </td>
                <td style="padding: 12px 15px; text-align: right;">
                    ${Number(prod.total_day_sales).toLocaleString()} ลิตร/วัน
                </td>
                <td style="padding: 12px 15px; text-align: right;">
                    ${Number(prod.total_actual_unpump).toLocaleString()} ลิตร
                </td>
                <td style="padding: 12px 15px; text-align: right; color: #d9534f; font-weight: bold;">
                    ${recom > 0 ? recom.toLocaleString() + ' ลิตร' : '-'}
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
                    <strong>คำเตือน:</strong> ตรวจพบปริมาณน้ำมันในระบบมียอดรวมไม่เพียงพอสำหรับการขายตามเกณฑ์ (Coverage Days) โปรดตรวจสอบข้อมูลและวางแผนการสั่งซื้อ
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
                                <th>ถัง (Tanks)</th>
                                <th>ผลิตภัณฑ์</th>
                                <th>Stock คงเหลือ</th>
                                <th>ยอดขายเฉลี่ยต่อวัน</th>
                                <th>Unpump</th>
                                <th>แนะนำ</th>
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
 * สร้างไฟล์ Excel รายงาน Low Stock ในรูปแบบ Matrix (รวมยอดรายสินค้า)
 */
const generateLowStockExcel = async (petrolInfo, lowStockProducts) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Run Out Report');

        const fontSarabun = { name: 'TH Sarabun PSK', size: 14 };
        const fontSarabunBold = { name: 'TH Sarabun PSK', size: 14, bold: true };
        const fontSarabunTitle = { name: 'TH Sarabun PSK', size: 16, bold: true };

        // 1. รายชื่อสินค้าทั้งหมดในรายงานนี้
        const productList = Array.from(new Set(lowStockProducts.map(p => p.product_name))).sort();

        // 2. ส่วนหัวของไฟล์ Excel
        const totalCols = (productList.length * 4) + 4; // เพิ่มจาก 3 เป็น 4 ต่อสินค้า
        worksheet.mergeCells(1, 1, 1, totalCols);
        const titleCell = worksheet.getCell(1, 1);
        titleCell.value = 'Run Out Report (Aggregated by Product)';
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF87CEEB' } };
        titleCell.font = fontSarabunTitle;
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // 3. หัวตาราง No., Station
        worksheet.mergeCells(2, 1, 3, 1);
        worksheet.getCell(2, 1).value = 'No.';
        worksheet.mergeCells(2, 2, 3, 2);
        worksheet.getCell(2, 2).value = 'Station';

        [worksheet.getCell(2, 1), worksheet.getCell(2, 2)].forEach(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
            cell.font = fontSarabunBold;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        // 4. หัวตารางรายสินค้า (Dynamic Columns)
        let currentCol = 3;
        productList.forEach(prodName => {
            worksheet.mergeCells(2, currentCol, 2, currentCol + 3); // ขยายจาก 3 เป็น 4
            const prodCell = worksheet.getCell(2, currentCol);
            prodCell.value = prodName;
            prodCell.font = fontSarabunBold;
            prodCell.alignment = { horizontal: 'center', vertical: 'middle' };
            prodCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

            ['Stock คงเหลือ', 'ยอดขาย', 'Unpump', 'แนะนำ'].forEach((sub, i) => {
                const subCell = worksheet.getCell(3, currentCol + i);
                subCell.value = sub;
                subCell.font = fontSarabunBold;
                subCell.alignment = { horizontal: 'center', vertical: 'middle' };
                subCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
            currentCol += 4;
        });

        // 5. หัวตารางคอลัมน์ "รวม" (Total)
        worksheet.mergeCells(2, currentCol, 2, currentCol + 1);
        worksheet.getCell(2, currentCol).value = 'รวมทั้งหมด';
        ['Stock คงเหลือ', 'ยอดขาย'].forEach((sub, i) => {
            const subCell = worksheet.getCell(3, currentCol + i);
            subCell.value = sub;
            subCell.font = fontSarabunBold;
            subCell.alignment = { horizontal: 'center', vertical: 'middle' };
            subCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        // 6. ใส่ข้อมูลแถว (Row Data)
        let currentRow = 4;
        worksheet.getCell(currentRow, 1).value = 1;
        worksheet.getCell(currentRow, 2).value = petrolInfo.ptrl_desc;

        [worksheet.getCell(currentRow, 1), worksheet.getCell(currentRow, 2)].forEach(cell => {
            cell.font = fontSarabun;
            cell.alignment = { horizontal: cell.address.includes('A') ? 'center' : 'left', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        let colIndex = 3;
        let grandTotalStock = 0;
        let grandTotalSales = 0;

        productList.forEach(prodName => {
            const prodData = lowStockProducts.find(p => p.product_name === prodName);
            const stock = prodData ? Number(prodData.total_usable_stock) : 0;
            const sales = prodData ? Number(prodData.total_day_sales) : 0;
            const unpump = prodData ? Number(prodData.total_actual_unpump) : 0;
            const pending = prodData ? Number(prodData.total_pending_qty) : 0;

            // คำนวณยอดแนะนำ: จำนวนแนะนำต้องรวมกับ stock คงเหลือ + กันแล้วต้องเท่ากับยอดขายเฉลี่ยต่อวัน
            const recom = Math.max(0, sales - stock);

            grandTotalStock += stock;
            grandTotalSales += sales;

            [stock, sales, unpump, recom].forEach((val, i) => {
                const cell = worksheet.getCell(currentRow, colIndex + i);
                cell.value = val > 0 ? val : 0;
                cell.numFmt = '#,##0';
                cell.font = (i === 3 && val > 0) ? { ...fontSarabun, color: { argb: 'FFFF0000' }, bold: true } : fontSarabun;
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
            colIndex += 4;
        });

        // ใส่ยอดรวมท้ายแถว
        [grandTotalStock, grandTotalSales].forEach((val, i) => {
            const cell = worksheet.getCell(currentRow, colIndex + i);
            cell.value = val > 0 ? val : 0;
            cell.numFmt = '#,##0';
            cell.font = fontSarabunBold;
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        // ปรับความกว้างคอลัมน์อัตโนมัติเบื้องต้น
        worksheet.getColumn(1).width = 5;
        worksheet.getColumn(2).width = 30;
        for (let i = 3; i <= totalCols; i++) worksheet.getColumn(i).width = 12;

        return await workbook.xlsx.writeBuffer();
    } catch (err) {
        console.error('[generateLowStockExcel Error]:', err.message);
        return null;
    }
};

// ==========================================================================
// 2. CALCULATION HELPERS
// ==========================================================================

/**
 * ค้นหายอดสั่งซื้อที่ค้างอยู่ในระบบ (Pending Orders) สำหรับถังหรือสินค้านั้นๆ
 */
async function getPendingOrderQty(dbName, tankInfo, stationInfo) {
    const sql = `
        SELECT coalesce(SUM(oi.item_qty), 0) as pending_qty
        FROM tbl_order_item oi
        JOIN tbl_order o ON oi.order_no = o.id
        WHERE oi.ptrl_tank_code = $1 AND o.ship_to = $2 AND oi.item_no = $3
            AND oi.order_item_flag = '1'
            AND oi.rm_dt IS NULL
            AND o.rm_dt IS NULL
            AND o.order_flag = '1'
            AND DATE(o.ist_dt) = CURRENT_DATE
            AND o.order_status IN ('1', '3', '10')
    `;
    const params = [tankInfo.ptrl_tank_code, stationInfo.ptrl_number, tankInfo.itm_code];
    const result = await pgConn.getWithParams(dbName, sql, params, config.connectionString());
    return parseFloat(result.data[0]?.pending_qty) || 0;
}


/**
 * บันทึกข้อมูล Runout ลง tbl_runout_information หลังส่งอีเมลสำเร็จ
 */
async function saveRunoutToDatabase(dbName, station, lowStockProducts, recipientEmail, recipientType, empCode, empRoleDesc) {
    try {
        const insertScript = `
            INSERT INTO public.tbl_runout_information (
                runout_code, ptrl_code, ptrl_desc, itm_code, itm_desc,
                ptrl_tank_code, tank_numbers, stock, day_sales, stock_minus_sales,
                unpump, recommend_qty, pending_qty, recipient_email, recipient_type,
                emp_code, emp_role_desc
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15,
                $16, $17
            )
        `;

        for (const prod of lowStockProducts) {
            const runout_code = 'rnot-' + moment().format('YYYYMMDDHHmmssSSS') + Math.floor(Math.random() * 10000);
            const stock = Number(prod.total_stock) || 0;
            const daySales = Number(prod.total_day_sales) || 0;
            let stockMinusSales = Number(prod.total_usable_stock) || 0;
            if (stockMinusSales < 0) stockMinusSales = 0;
            const unpump = Number(prod.total_actual_unpump) || 0;
            const recom = Math.max(0, daySales - stockMinusSales);
            const pending = Number(prod.total_pending_qty) || 0;

            const params = [
                runout_code,
                station.ptrl_code,
                station.ptrl_desc || null,
                prod.itm_code || '',
                prod.product_name || null,
                prod.ptrl_tank_codes || null,
                prod.tank_numbers || null,
                stock,
                daySales,
                stockMinusSales,
                unpump,
                recom,
                pending,
                recipientEmail || null,
                recipientType || null,
                empCode || null,
                empRoleDesc || null
            ];

            await pgConn.execute2params(dbName, insertScript, params, config.connectionString());
        }
        logInfo('Runout Alert', `บันทึกข้อมูลลงฐานข้อมูล ${lowStockProducts.length} รายการ สำหรับ ${station.ptrl_desc} (${recipientType})`);
    } catch (err) {
        logError('Runout Alert', `saveRunoutToDatabase Error: ${err.message}`);
    }
}

// ==========================================================================
// 2.5 CS/PLANNER SUMMARY GENERATORS & DISPATCHER
// ==========================================================================

// ======= 3. วาดตาราง HTML & Excel ส่งให้ CS =======
// เอาข้อมูลหลายๆ ปั๊มมามัดรวมกัน แล้วจัดหน้าตาตารางสรุปแนวขวาง (Matrix) ปั๊มไหนไม่มีก็แดช (-) ไว้ ยอดรวมอยู่ท้ายตาราง
const generateCSSummaryEmailHtml = (stationsData) => {
    const productSet = new Set();
    stationsData.forEach(data => data.products.forEach(p => productSet.add(p.product_name)));
    const productList = Array.from(productSet).sort();

    let thHtml = `<th rowspan="2" style="border-bottom: 2px solid #dee2e6;">No.</th><th rowspan="2" style="border-bottom: 2px solid #dee2e6;">Station</th>`;
    productList.forEach(prod => {
        thHtml += `<th colspan="4" style="border-left: 2px solid #dee2e6; border-bottom: 1px solid #dee2e6;">${prod}</th>`;
    });
    thHtml += `<th colspan="3" style="border-left: 2px solid #dee2e6; background-color: #e9ecef; border-bottom: 1px solid #dee2e6;">รวม</th>`;

    let subThHtml = ``;
    productList.forEach(() => {
        subThHtml += `<th style="border-left: 2px solid #dee2e6; font-size:12px;">Stock คงเหลือ</th><th style="font-size:12px;">ยอดขาย</th><th style="font-size:12px;">Unpump</th><th style="font-size:12px; color:#d9534f;">แนะนำ</th>`;
    });
    subThHtml += `<th style="border-left: 2px solid #dee2e6; font-size:12px; background-color: #e9ecef;">Stock คงเหลือ</th><th style="font-size:12px; background-color: #e9ecef;">ยอดขาย</th><th style="font-size:12px; color:#d9534f; background-color: #e9ecef;">แนะนำ</th>`;

    let rowsHtml = '';
    let totalAllStocks = 0, totalAllSales = 0, totalAllRecom = 0;

    stationsData.forEach((data, idx) => {
        const { station, products } = data;
        let rowHtml = `<td style="text-align: center;">${idx + 1}</td><td>${station.ptrl_desc} (${station.ptrl_group_desc})</td>`;

        let rowStock = 0, rowSales = 0, rowRecom = 0;

        productList.forEach(prodName => {
            const prod = products.find(p => p.product_name === prodName);
            const stock = prod ? Number(prod.total_usable_stock) : 0;
            const sales = prod ? Number(prod.total_day_sales) : 0;
            const unpump = prod ? Number(prod.total_actual_unpump) : 0;
            const pending = prod ? Number(prod.total_pending_qty) : 0;

            const recom = Math.max(0, sales - stock);

            rowStock += Math.max(0, stock);
            rowSales += Math.max(0, sales);
            rowRecom += Math.max(0, recom);

            rowHtml += `
                <td style="text-align: right; border-left: 2px solid #dee2e6;">${Math.max(0, stock).toLocaleString()}</td>
                <td style="text-align: right;">${Math.max(0, sales).toLocaleString()}</td>
                <td style="text-align: right;">${Math.max(0, unpump).toLocaleString()}</td>
                <td style="text-align: right; color:#d9534f; font-weight:bold;">${Math.max(0, recom).toLocaleString()}</td>
            `;
        });

        totalAllStocks += (rowStock || 0);
        totalAllSales += (rowSales || 0);
        totalAllRecom += (rowRecom || 0);

        rowHtml += `
            <td style="text-align: right; border-left: 2px solid #dee2e6; background-color: #f8f9fa;">${Math.max(0, rowStock).toLocaleString()}</td>
            <td style="text-align: right; background-color: #f8f9fa;">${Math.max(0, rowSales).toLocaleString()}</td>
            <td style="text-align: right; background-color: #f8f9fa; color:#d9534f; font-weight:bold;">${Math.max(0, rowRecom).toLocaleString()}</td>
        `;

        rowsHtml += `<tr style="border-bottom: 1px solid #ddd;">${rowHtml}</tr>`;
    });

    // คำนวณยอดรวมสรุปท้าย (HTML)
    // totalAllStocks, totalAllSales, totalAllRecom ถูกคำนวณไว้แล้วใน loop stationsData

    return `
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: 'Sarabun', Tahoma, sans-serif; background-color: #f4f7f6; margin: 0; padding: 20px; color: #333; }
            .container { max-width: 1200px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
            .header { background-color: #17a2b8; padding: 25px 30px; color: white; display: flex; justify-content: space-between; align-items: center; }
            .header h1 { margin: 0; font-size: 22px; font-weight: 600; display: flex; align-items: center; }
            .content { padding: 30px; }
            .alert-box { background-color: #e0f7fa; border-left: 4px solid #17a2b8; padding: 15px; margin-bottom: 25px; border-radius: 4px; }
            .table-container { overflow-x: auto; margin-bottom: 30px; border-radius: 8px; border: 1px solid #e0e0e0; }
            table { width: 100%; border-collapse: collapse; white-space: nowrap; }
            thead { background-color: #f1f3f5; }
            th { padding: 10px 15px; text-align: center; font-size: 14px; color: #495057; font-weight: 600; border-bottom: 2px solid #dee2e6; }
            td { padding: 10px 15px; font-size: 13px; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 13px; color: #6c757d; border-top: 1px solid #e9ecef; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📊 สรุปแจ้งเตือนน้ำมันใกล้หมด (Run Out Report)</h1>
            </div>
            <div class="content">
                <div class="alert-box">
                    <strong>เรียน ทีมปฏิบัติการ / ทีมวางแผนจัดส่ง:</strong><br>
                    ตามที่ระบบได้ทำการตรวจสอบ พบว่ามีสถานีบริการบางแห่งถึง Cut-off Time แล้ว แต่ยังไม่ได้ทำการสั่งน้ำมัน และมีความเสี่ยง Run Out ดังรายการด้านล่าง
                </div>
                
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>${thHtml}</tr>
                            <tr>${subThHtml}</tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                        <tfoot>
                            <tr style="background-color: #ffff00; font-weight: bold;">
                                <td colspan="2" style="text-align: center; border: 1px solid #ddd;">รวม</td>
                                ${productList.map(() => '<td colspan="4" style="border: 1px solid #ddd;"></td>').join('')}
                                <td style="text-align: right; border: 1px solid #ddd;">${Math.max(0, totalAllStocks).toLocaleString()}</td>
                                <td style="text-align: right; border: 1px solid #ddd;">${Math.max(0, totalAllSales).toLocaleString()}</td>
                                <td style="text-align: right; border: 1px solid #ddd; color:#d9534f;">${Math.max(0, totalAllRecom).toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <p style="font-size: 14px; color: #555;">(รายละเอียดเพิ่มเติมสามารถดูได้จากไฟล์ Excel ที่แนบมาพร้อมอีเมลฉบับนี้)</p>
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

const generateCSSummaryExcel = async (stationsData) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Run Out Report Summary');

        const fontSarabun = { name: 'TH Sarabun PSK', size: 14 };
        const fontSarabunBold = { name: 'TH Sarabun PSK', size: 14, bold: true };
        const fontSarabunTitle = { name: 'TH Sarabun PSK', size: 16, bold: true };

        const productSet = new Set();
        stationsData.forEach(data => data.products.forEach(p => productSet.add(p.product_name)));
        const productList = Array.from(productSet).sort();

        const totalCols = (productList.length * 4) + 5;
        worksheet.mergeCells(1, 1, 1, totalCols);
        const titleCell = worksheet.getCell(1, 1);
        titleCell.value = 'Run Out Report (Aggregated for CS/Planner)';
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF87CEEB' } };
        titleCell.font = fontSarabunTitle;
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

        worksheet.mergeCells(2, 1, 3, 1); worksheet.getCell(2, 1).value = 'No.';
        worksheet.mergeCells(2, 2, 3, 2); worksheet.getCell(2, 2).value = 'Station';

        [worksheet.getCell(2, 1), worksheet.getCell(2, 2)].forEach(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
            cell.font = fontSarabunBold;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        let currentCol = 3;
        productList.forEach(prodName => {
            worksheet.mergeCells(2, currentCol, 2, currentCol + 3);
            const prodCell = worksheet.getCell(2, currentCol);
            prodCell.value = prodName;
            prodCell.font = fontSarabunBold;
            prodCell.alignment = { horizontal: 'center', vertical: 'middle' };
            prodCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

            ['Stock คงเหลือ', 'ยอดขาย', 'Unpump', 'แนะนำ'].forEach((sub, i) => {
                const subCell = worksheet.getCell(3, currentCol + i);
                subCell.value = sub;
                subCell.font = fontSarabunBold;
                subCell.alignment = { horizontal: 'center', vertical: 'middle' };
                subCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
            currentCol += 4;
        });

        worksheet.mergeCells(2, currentCol, 2, currentCol + 2);
        worksheet.getCell(2, currentCol).value = 'รวมทั้งหมด';
        ['Stock คงเหลือ', 'ยอดขาย', 'แนะนำ'].forEach((sub, i) => {
            const subCell = worksheet.getCell(3, currentCol + i);
            subCell.value = sub;
            subCell.font = fontSarabunBold;
            subCell.alignment = { horizontal: 'center', vertical: 'middle' };
            subCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        let currentRow = 4;
        let finalStock = 0, finalSales = 0, finalRecom = 0;

        stationsData.forEach((data, idx) => {
            const { station, products } = data;
            worksheet.getCell(currentRow, 1).value = idx + 1;
            worksheet.getCell(currentRow, 2).value = station.ptrl_desc;

            [worksheet.getCell(currentRow, 1), worksheet.getCell(currentRow, 2)].forEach(cell => {
                cell.font = fontSarabun;
                cell.alignment = { horizontal: cell.address.includes('A') ? 'center' : 'left', vertical: 'middle' };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });

            let colIndex = 3;
            let rowStock = 0, rowSales = 0, rowRecom = 0;

            productList.forEach(prodName => {
                const prodData = products.find(p => p.product_name === prodName);
                const stock = prodData ? Number(prodData.total_usable_stock) : 0;
                const sales = prodData ? Number(prodData.total_day_sales) : 0;
                const unpump = prodData ? Number(prodData.total_actual_unpump) : 0;
                const pending = prodData ? Number(prodData.total_pending_qty) : 0;

                const recom = Math.max(0, sales - stock);
                const s_val = Math.max(0, stock);
                const sa_val = Math.max(0, sales);
                const r_val = Math.max(0, recom);

                rowStock += s_val; rowSales += sa_val; rowRecom += r_val;

                [s_val, sa_val, unpump, r_val].forEach((val, i) => {
                    const cell = worksheet.getCell(currentRow, colIndex + i);
                    cell.value = val;
                    cell.numFmt = '#,##0';
                    cell.font = (i === 3 && val > 0) ? { ...fontSarabun, color: { argb: 'FFFF0000' }, bold: true } : fontSarabun;
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                });
                colIndex += 4;
            });

            finalStock += rowStock; finalSales += rowSales; finalRecom += rowRecom;

            [rowStock, rowSales, rowRecom].forEach((val, i) => {
                const cell = worksheet.getCell(currentRow, colIndex + i);
                cell.value = val;
                cell.numFmt = '#,##0';
                cell.font = fontSarabunBold;
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
            currentRow++;
        });

        // --- 4. Grand Total Row (Excel) ---
        worksheet.mergeCells(currentRow, 1, currentRow, 2);
        const sumTitle = worksheet.getCell(currentRow, 1);
        sumTitle.value = 'รวม';
        sumTitle.font = fontSarabunBold;
        sumTitle.alignment = { horizontal: 'center', vertical: 'middle' };
        sumTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // สีเหลืองตามรูป
        sumTitle.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

        // เว้นว่างคอลัมน์รายสินค้า (Grand Total Row)
        let totalColIndex = 3;
        productList.forEach(() => {
            for (let i = 0; i < 4; i++) {
                const cell = worksheet.getCell(currentRow, totalColIndex + i);
                cell.value = '';
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // สีเหลืองตามรูป
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            }
            totalColIndex += 4;
        });

        // ใส่ยอดรวมสรุปท้าย (Final Totals)
        [finalStock, finalSales, finalRecom].forEach((val, i) => {
            const cell = worksheet.getCell(currentRow, totalColIndex + i);
            cell.value = val;
            cell.numFmt = '#,##0';
            cell.font = fontSarabunBold;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // สีเหลืองตามรูป
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        worksheet.getColumn(1).width = 5;
        worksheet.getColumn(2).width = 30;
        for (let i = 3; i <= totalCols; i++) worksheet.getColumn(i).width = 12;

        return await workbook.xlsx.writeBuffer();
    } catch (err) {
        logError('Runout Alert', `generateCSSummaryExcel Error: ${err.message}`);
        return null;
    }
};

// ======= 2. จับคู่ CS กับกลุ่มปั๊มที่ดูแลเพื่อยิงเมลสรุป =======
// หาว่า CS คนไหนดูแลปั๊มกลุ่มไหนบ้าง แล้วกรองปั๊มที่เตือนโยนใส่เมลสรุปฉบับเดียว/คน
const sendSummaryAlertToCS = async (dbName, csData, summaryAlerts, historySet) => {
    const logEntries = [];
    logInfo('Runout Alert', `ตรวจสอบการส่งสรุปให้ CS (CS Count: ${csData.length}, Alert Count: ${summaryAlerts.length})`);
    try {
        const testEmails = 'amnart_pg@dtc.co.th, puautarm@gmail.com';
        const emailToGroups = {};

        for (const row of csData) {
            if (!emailToGroups[row.emp_email]) emailToGroups[row.emp_email] = new Set();
            emailToGroups[row.emp_email].add(row.ptrl_group_code);
        }

        for (const email in emailToGroups) {
            const empInfo = csData.find(e => e.emp_email === email);
            const empCode = empInfo?.emp_code || null;
            const allowedGroups = emailToGroups[email];

            const relevantAlerts = [];
            for (const alert of summaryAlerts) {
                if (!allowedGroups.has(alert.station.ptrl_group_code)) {
                    logInfo('Runout Alert', `   [Skip CS] ปั๊ม ${alert.station.ptrl_desc} ไม่อยู่ในกลุ่มที่ ${email} ดูแล`);
                    continue;
                }

                const newProducts = alert.products.filter(p => {
                    const checkKey = `${alert.station.ptrl_code}_${p.itm_code}_${email}_${empCode}_cs_planner`;
                    const hasHistory = historySet.has(checkKey);
                    if (hasHistory) logInfo('Runout Alert', `Skip CS รายการ ${alert.station.ptrl_desc} - ${p.product_name} ได้ทำการส่งให้ ${email} ในวันนี้แล้ว`);
                    return !hasHistory;
                });

                if (newProducts.length > 0) {
                    relevantAlerts.push({ ...alert, products: newProducts });
                }
            }

            if (relevantAlerts.length > 0) {
                const subject = `[AOS Alert] สรุปรายงานสถานีที่เสี่ยง Run Out (สำหรับ CS/Planner)`;
                const html = generateCSSummaryEmailHtml(relevantAlerts);
                const excel = await generateCSSummaryExcel(relevantAlerts);
                const attachments = excel ? [{ filename: `AOS_Order_Recommendation_Runout_${moment().format('YYYYMMDD')}.xlsx`, content: excel }] : [];

                await mailer.sendMail(testEmails, subject, html, attachments);
                logInfo('Runout Alert', `ส่งสรุปของ (${email}) ไปที่ -> ${testEmails}`);

                // บันทึกประวัติ
                const empName = empInfo?.emp_name || 'ไม่ทราบชื่อ';
                const empRoleDesc = empInfo?.emp_role_desc || 'CS/Planner';

                for (const alert of relevantAlerts) {
                    await saveRunoutToDatabase(dbName, alert.station, alert.products, email, 'cs_planner', empCode, empRoleDesc);

                    const groupDesc = alert.station.ptrl_group_desc || 'ไม่มีกลุ่ม';
                    const groupID = alert.station.ptrl_group_code || '-';
                    logEntries.push({
                        'สถานีบริการ (Station)': `${alert.station.ptrl_desc} (${alert.station.ptrl_number})`,
                        'กลุ่มปั๊ม (Petrol Group)': `${groupDesc} (${groupID})`,
                        'ชื่อพนักงาน': empName,
                        'ตำแหน่ง': empRoleDesc,
                        'อีเมลเดิม (Original)': email,
                        'ส่งจริงไปที่ (Intercepted)': testEmails
                    });
                }
            }
        }

    } catch (err) {
        console.error('[sendSummaryAlertToCS Error]:', err);
    }
    return logEntries;
}


/**
 * ฟังก์ชันย่อยสำหรับตรวจสอบเงื่อนไขความถี่และส่งอีเมล
 */
async function sendAlertToRecipients(dbName, station, lowStockProducts) {
    const currentTime = moment();
    const logEntries = [];
    const alertConfigs = await pgConn.getWithParams(dbName, `
        SELECT DISTINCT ON (a.email_alert) 
               a.ptrl_mail_code, a.email_alert, a.re_alert_type, a.last_alert_dt, a.ptrl_mail_status,
               COALESCE(e.emp_code, a.emp_code) as emp_code, 
               e.emp_name, r.emp_role_desc
        FROM tbl_petrol_mail_alert a
        LEFT JOIN tbl_employee e ON a.emp_code = e.emp_code AND e.rm_dt IS NULL AND e.emp_flag = '1'
        LEFT JOIN tbl_employee_role r ON e.emp_role_code = r.emp_role_code
        WHERE a.ptrl_code = $1 
              AND a.alert_status = '1' AND a.rm_dt IS NULL
              AND a.email_alert IN ('amnart_pg@dtc.co.th', 'puautarm@gmail.com')
        `, [station.ptrl_code], config.connectionString());

    if (!alertConfigs.data?.length) return logEntries;

    const validRecipients = [];
    const mailCodesToUpdate = [];

    for (const conf of alertConfigs.data) {
        const lastAlert = conf.last_alert_dt ? moment(conf.last_alert_dt) : null;
        let canSend = false;

        if (conf.re_alert_type == 1) { // ครั้งเดียวต่อวัน
            if (!lastAlert || lastAlert.format('YYYY-MM-DD') !== currentTime.format('YYYY-MM-DD')) canSend = true;
        } else if (conf.re_alert_type == 2) { // ทุก 30 นาที
            if (!lastAlert || currentTime.diff(lastAlert, 'minutes') >= 30) canSend = true;
        }

        if (canSend) {
            validRecipients.push({
                email: conf.email_alert,
                empCode: conf.emp_code || null,
                empName: conf.emp_name || 'ผู้จัดการปั๊ม',
                empRoleDesc: conf.emp_role_desc || 'ผู้จัดการสถานี',
                mailStatus: conf.ptrl_mail_status
            });
            mailCodesToUpdate.push(conf.ptrl_mail_code);
        } else {
            logInfo('Runout Alert', `ข้ามการส่งให้ผู้จัดการ: ${conf.email_alert} (เพิ่งส่งไปเมื่อ ${lastAlert.format('HH:mm')} ติดเงื่อนไขความถี่)`);
        }
    }

    if (validRecipients.length > 0) {
        const subject = `[AOS Alert] แจ้งเตือนน้ำมันใกล้หมด - ${station.ptrl_desc}`;
        const html = generateLowStockEmailHtml(station, lowStockProducts);
        const excel = await generateLowStockExcel(station, lowStockProducts);

        const attachments = excel ? [{ filename: `AOS_Order_Recommendation_RunOut${station.ptrl_number}.xlsx`, content: excel }] : [];

        const groupDesc = station.ptrl_group_desc || 'ไม่มีกลุ่ม';
        const groupID = station.ptrl_group_code || '-';
        // ============ Email Mockup For sending to Primary and Secondary (To, CC)
        const primaryEmailMockup = 'puautarm@gmail.com';
        const secondaryEmailMockup = 'amnart_pg@dtc.co.th';

        // ================ Backup Send Email to Primary and Secondary ================ 
        // แยกรายชื่อผู้รับเป็น To (Primary=1) และ CC (Secondary=2)
        // const toEmails = validRecipients.filter(r => r.mailStatus == 1).map(r => r.email).join(', ');
        // const ccEmails = validRecipients.filter(r => r.mailStatus == 2).map(r => r.email).join(', ');


        // ป้องกันกรณีไม่มี To แต่มี CC (ให้ย้าย CC มาเป็น To ตัวแรก)
        // let primaryEmail = toEmails;
        // let secondaryEmail = ccEmails;
        // if (!primaryEmail && secondaryEmail) {
        //     const ccList = secondaryEmail.split(', ');
        //     primaryEmail = ccList.shift();
        //     secondaryEmail = ccList.join(', ');
        // }

        // if (primaryEmail) {
        //     await mailer.sendMail(primaryEmail, subject, html, attachments, secondaryEmail);
        //     console.log(`[Runout Alert] ส่งแจ้งเตือนปั๊ม ${station.ptrl_desc} ไปที่ (To: ${primaryEmail}) | (Cc: ${secondaryEmail || '-'})`);
        // }

        await mailer.sendMail(primaryEmailMockup, subject, html, attachments, secondaryEmailMockup);
        logInfo('Runout Alert', `ส่งแจ้งเตือนปั๊ม ${station.ptrl_desc} ไปที่ (To: ${primaryEmailMockup}) | (Cc: ${secondaryEmailMockup || '-'})`);
        // บันทึกข้อมูล Runout หลังส่งอีเมลแจ้งเตือนสำเร็จ (ใช้ข้อมูลจริงเพื่อประวัติ)
        for (const r of validRecipients) {
            await saveRunoutToDatabase(dbName, station, lowStockProducts, r.email, 'station_manager', r.empCode, r.empRoleDesc);

            logEntries.push({
                'สถานีบริการ (Station)': `${station.ptrl_desc} (${station.ptrl_number})`,
                'กลุ่มปั๊ม (Petrol Group)': `${groupDesc} (${groupID})`,
                'ชื่อพนักงาน': r.empName,
                'ตำแหน่ง': r.empRoleDesc,
                'อีเมลเดิม (Original)': r.email,
                'ส่งจริงไปที่ (Intercepted)': primaryEmailMockup + ' | ' + secondaryEmailMockup
            });
        }

        // อัปเดต Last Alert Time
        for (const code of mailCodesToUpdate) {
            await pgConn.execute2params(dbName, `UPDATE tbl_petrol_mail_alert SET last_alert_dt = $1 WHERE ptrl_mail_code = $2`, [currentTime.format('YYYY-MM-DD HH:mm:ss'), code], config.connectionString());
        }
    }
    return logEntries;
}

// ==========================================================================
// 3. CORE PROCESSOR
// ==========================================================================

/**
 * ฟังก์ชันหลัก: ตรวจสอบและประมวลผลการแจ้งเตือน Low Stock
 * 
 * ======= 1. แผนส่งเมลแจ้งเตือน 2 รอบ =======
 * รอบที่ 1: วนเช็ครายปั๊ม ยิงเมลหา ผจก.ปั๊ม 
 * รอบที่ 2: เอาข้อมูลปั๊มที่น้ำมันเหลือน้อยในรอบนั้น มาส่งสรุปรวมฉบับเดียวให้ CS แต่ละคน
 */
exports.processLowStockAlerts = async (lic_code, filter_sales_org = null, filter_order_type = null) => {
    if (!lic_code) return;
    const dbName = dbPrefix + lic_code;
    try {
        const currentTime = moment();
        logInfo('Runout Alert', `เริ่มตรวจสอบ (${lic_code}) เวลา ${currentTime.format('HH:mm:ss')}...`);

        // 1. ดึงรายการปั๊มที่ถึงรอบการตรวจสอบ (อ้างอิงตาม Sales Org และ Order Type)
        let wh = "";
        let params = [];

        if (filter_sales_org && filter_sales_org !== 'ALL') {
            params.push(filter_sales_org);
            wh += ` AND oc.sales_org_code = $${params.length} `;
        }

        if (filter_order_type && filter_order_type !== 'ALL') {
            params.push(filter_order_type);
            wh += ` AND oc.order_type_code = $${params.length} `;
        }

        // กรณีเป็นการรันอัตโนมัติ (ไม่ได้ระบุเจาะจง) ให้เช็คเวลาที่ตรงกับปัจจุบัน
        if (!filter_sales_org && !filter_order_type) {
            params.push(currentTime.format('HH:mm:ss'));
            wh += ` AND oc.order_cutoff_time <= $${params.length}::TIME `;
        }

        const scriptSql = `
            SELECT DISTINCT p.ptrl_code, p.ptrl_number, p.ptrl_desc, p.coverage_days, p.ptrl_group_code, pg.ptrl_group_desc,
                   oc.sales_org_code, oc.order_type_code, ot.sales_order_type
            FROM tbl_petrol p
            INNER JOIN tbl_sales_org_order_config oc ON p.ptrl_sales_group = oc.sales_org_code 
                  AND p.ptrl_sales_type = oc.order_type_code
            LEFT JOIN tbl_order_type ot ON oc.order_type_code = ot.ord_type_code
            LEFT JOIN tbl_petrol_group pg ON p.ptrl_group_code = pg.ptrl_group_code
            WHERE p.ptrl_flag = '1' AND p.rm_dt IS NULL 
                  AND oc.sales_org_flag = 1 AND oc.rm_dt IS NULL
                ${wh}
        `;
        const activeStations = await pgConn.getWithParams(dbName, scriptSql, params, config.connectionString());
        if (!activeStations.data?.length) {
            logInfo('Runout Alert', 'ไม่มีปั๊มที่ต้องตรวจสอบในรอบนี้');
            return;
        }

        // 2. ดึงข้อมูลพนักงาน CS/Planner 
        const csDataQuery = await pgConn.get(dbName, `
            SELECT e.emp_code, e.emp_email, e.emp_name, epg.ptrl_group_code, pg.ptrl_group_desc, r.emp_role_desc
            FROM tbl_employee e
            LEFT JOIN tbl_employee_role r ON e.emp_role_code = r.emp_role_code
            JOIN tbl_employee_petrol_group epg ON e.emp_code = epg.emp_code
            LEFT JOIN tbl_petrol_group pg ON epg.ptrl_group_code = pg.ptrl_group_code
            WHERE e.emp_flag = '1' 
              AND epg.emp_pgrp_flag = '1'
              AND e.emp_email IN ('amnart_pg@dtc.co.th', 'puautarm@gmail.com')
        `, config.connectionString());

        const csData = csDataQuery.data || [];

        // 3. ดึงประวัติการส่งวันนี้
        const historyQuery = await pgConn.get(dbName, `
            SELECT ptrl_code, itm_code, recipient_email, emp_code, recipient_type
            FROM tbl_runout_information 
            WHERE DATE(ist_dt) = CURRENT_DATE
        `, config.connectionString());

        const historySet = new Set();
        if (historyQuery.data) {
            historyQuery.data.forEach(h => {
                historySet.add(`${h.ptrl_code}_${h.itm_code}_${h.recipient_email}_${h.emp_code}_${h.recipient_type}`);
            });
        }

        let globalLowStockData = [];
        let allDebugLogs = [];

        // 4. เริ่มประมวลผลรายปั๊ม... (จำกัดแค่ 2 ปั๊มแรกเพื่อทดสอบ ป้องกัน Mail Spam)
        // for (const station of activeStations.data) {
        for (const station of activeStations.data.slice(0, 2)) {
            logInfo('Runout Alert', `ประมวลผลปั๊ม: ${station.ptrl_desc} (${station.ptrl_number}) [Org: ${station.sales_org_code} | Type: ${station.sales_order_type}]`);
            const coverageLimit = parseFloat(station.coverage_days) || 3;

            const script = `
                SELECT tpt.ptrl_tank_code, tpt.tnk_number, tpt.itm_code, itm.itm_material_number, 
                       itm.itm_desc AS product_name, tpt.unpump_level,
                       COALESCE(auto_tank.tnk_deadstock, 0) AS deadstock,
                       COALESCE(auto_tank.stock, 0) as current_stock,
                       COALESCE(auto_sales.sale_previous, 0) AS day_sales,
                       auto_tank.stock_at 
                FROM tbl_petrol_tank tpt 
                LEFT JOIN tbl_item itm ON tpt.itm_code = itm.itm_code
                LEFT JOIN (
                    SELECT * FROM (
                        SELECT *, 
                               ROW_NUMBER() OVER (PARTITION BY tank_code, ptrl_code ORDER BY stock_at DESC) as rn
                        FROM tbl_automatics_tanks_information 
                        WHERE stock > 0 
                          AND stock_at >= (
                              SELECT MAX(stock_at) - INTERVAL '1 day'
                              FROM tbl_automatics_tanks_information 
                          )
                    ) tmp WHERE rn = 1 
                ) auto_tank ON tpt.ptrl_tank_code = auto_tank.tank_code AND tpt.ptrl_code = auto_tank.ptrl_code 
                LEFT JOIN (
                    SELECT DISTINCT ON (tank_code, ptrl_code, DATE(sale_at_previous)) 
                           ptrl_code, tank_code, sale_previous, DATE(sale_at_previous) as sale_date
                    FROM tbl_automatics_sales_previous_information 
                    WHERE sale_previous > 0 
                    ORDER BY tank_code, ptrl_code, DATE(sale_at_previous), sale_at_previous DESC
                ) auto_sales ON tpt.ptrl_code = auto_sales.ptrl_code 
                             AND tpt.ptrl_tank_code = auto_sales.tank_code 
                             AND DATE(auto_tank.stock_at) = auto_sales.sale_date
                WHERE tpt.ptrl_code = $1 AND tpt.ptrl_tank_flag = '1' AND tpt.rm_dt IS NULL 
                ORDER BY tpt.tnk_number ASC
            `;

            // ดึงข้อมูลถังน้ำมันทั้งหมดของปั๊ม
            const tankData = await pgConn.getWithParams(dbName, script, [station.ptrl_code], config.connectionString());

            if (!tankData.data?.length) continue;

            // ดึงค่า Pending Order ของทุกถังพร้อมกันแบบขนาน 
            await Promise.all(tankData.data.map(async (tank) => {
                tank.pending_qty = await getPendingOrderQty(dbName, tank, station);
            }));

            // จัดกลุ่มข้อมูลตามสินค้า (Aggregation)
            const productGroups = {};
            for (const tank of tankData.data) {
                // ถ้าข้อมูลย้อนหลังจาก stock_at ย้อนหลัง 1 วัน ไม่มีข้อมูล (หรือไม่อยู่ในเงื่อนไข SQL) -> ข้าม
                if (!tank.stock_at) {
                    logInfo('Runout Alert', `ข้ามถัง ${tank.tnk_number} (${station.ptrl_desc} [${station.sales_org_code} | ${station.sales_order_type}]) เนื่องจากไม่มีข้อมูล stock ล่าสุดภายใน 1 วัน`);
                    continue;
                }

                if (!productGroups[tank.itm_code]) {
                    productGroups[tank.itm_code] = {
                        name: tank.product_name,
                        tanks: [],
                        tank_codes: [],
                        total_stock: 0,
                        total_unpump: 0,
                        total_sales: 0,
                        total_pending: 0
                    };
                }
                const group = productGroups[tank.itm_code];
                const unpumpVolume = parseFloat(tank.deadstock) || 0;

                group.tanks.push(tank.tnk_number);
                group.tank_codes.push(tank.ptrl_tank_code);
                group.total_stock += parseFloat(tank.current_stock) || 0;
                group.total_unpump += unpumpVolume;
                group.total_sales += parseFloat(tank.day_sales) || 0;
                group.total_pending += tank.pending_qty || 0;
            }

            // 5. คัดกรองสินค้าที่เข้าข่าย Low Stock
            const lowStockProducts = [];
            for (const itmCode in productGroups) {
                const group = productGroups[itmCode];
                const usableStock = Math.max(0, group.total_stock - group.total_unpump);
                const avgSales = group.total_sales > 0 ? group.total_sales : 0.001;
                const daysLeft = usableStock / avgSales;
                let stockDaysales = (group.total_stock - group.total_sales)
                if (stockDaysales < group.total_unpump) {
                    if (group.total_pending > 0) continue;

                    lowStockProducts.push({
                        itm_code: itmCode,
                        product_name: group.name,
                        tank_numbers: group.tanks.sort((a, b) => a - b).join(', '),
                        ptrl_tank_codes: group.tank_codes.join(', '),
                        total_stock: group.total_stock,
                        total_usable_stock: stockDaysales,
                        total_actual_unpump: group.total_unpump,
                        total_day_sales: group.total_sales,
                        total_pending_qty: group.total_pending,
                        days_remaining: daysLeft,
                        coverage_days: coverageLimit
                    });
                }
            }

            // 6. ส่งแจ้งเตือน (Email & Excel Attachment)
            if (lowStockProducts.length > 0) {
                const logs = await sendAlertToRecipients(dbName, station, lowStockProducts);
                if (logs && logs.length > 0) allDebugLogs.push(...logs);
                globalLowStockData.push({ station, products: lowStockProducts });
            }
        }

        // 7. ส่งรายงานสรุปให้ CS/Planner
        if (globalLowStockData.length > 0) {
            const summaryLog = await sendSummaryAlertToCS(dbName, csData, globalLowStockData, historySet);
            if (summaryLog && summaryLog.length > 0) allDebugLogs.push(...summaryLog);
        }

        if (allDebugLogs.length > 0) {
            logInfo('Runout Alert Summary', 'ตารางสรุปการจัดส่งแจ้งเตือนสำเร็จ:');
            console.table(allDebugLogs);
        } else {
            logInfo('Runout Alert', 'ตรวจสอบเสร็จสิ้น ไม่พบบัญชีน้ำมันใกล้หมดที่จะต้องส่งแจ้งเตือนในรอบนี้');
        }
    } catch (error) {
        logError('Runout Alert', 'processLowStockAlerts Error', error);
    }
};


// ==========================================================================
// 4. API CONTROLLER
// ==========================================================================

/**
 * API สำหรับสั่งรันกระบวนการแจ้งเตือนแบบ Manual
 */
exports.triggerLowStockAlert = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { sales_org_code, order_type_code, action } = req.body[0] || {};

        if (!lic_code || !action) {
            return xglobal.sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง', []);
        }

        const username = action[0].value || 'SYSTEM';
        await xglobal.action_logs(lic_code, action[0].id, 'Manual Low Stock Alert Triggered', JSON.stringify({ sales_org_code, order_type_code }), 'success', username);

        // รันแบบ Background (ส่ง Sales Org และ Order Type แทน Office)
        this.processLowStockAlerts(lic_code, sales_org_code || 'ALL', order_type_code || 'ALL');

        return xglobal.sendResponse(res, 'success', '0', 'เริ่มกระบวนการตรวจสอบ Low Stock แล้ว (Background Task)', []);
    } catch (err) {
        return xglobal.sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดในการเริ่มกระบวนการ', []);
    }
};





// ================================================================== Backup Send Email Features  ==================================================================
// ======= 2. จับคู่ CS กับกลุ่มปั๊มที่ดูแลเพื่อยิงเมลสรุป =======
// หาว่า CS คนไหนดูแลปั๊มกลุ่มไหนบ้าง แล้วกรองปั๊มที่เตือนโยนใส่เมลสรุปฉบับเดียว/คน
// async function sendSummaryAlertToCS(dbName, summaryAlerts) {
//     const logEntries = [];
//     try {
//         const csData = await pgConn.get(dbName, `
//             SELECT e.emp_code, e.emp_email, e.emp_name, epg.ptrl_group_code, pg.ptrl_group_desc, r.emp_role_desc
//             FROM tbl_employee e
//             LEFT JOIN tbl_employee_role r ON e.emp_role_code = r.emp_role_code
//             JOIN tbl_employee_petrol_group epg ON e.emp_code = epg.emp_code
//             LEFT JOIN tbl_petrol_group pg ON epg.ptrl_group_code = pg.ptrl_group_code
//             WHERE e.emp_flag = '1' 
//               AND epg.emp_pgrp_flag = '1'
//               AND e.emp_email IS NOT NULL AND e.emp_email != ''
//         `, config.connectionString());

//         if (!csData.data?.length) return logEntries;

//         // ดึงประวัติการส่งของวันนี้มาไว้เช็คกันส่งซ้ำ (เช็คแบบรายคน และแยกประเภทการส่ง)
//         const historyQuery = await pgConn.get(dbName, `
//             SELECT ptrl_code, itm_code, recipient_email, emp_code, recipient_type
//             FROM tbl_runout_information 
//             WHERE DATE(ist_dt) = CURRENT_DATE
//         `, config.connectionString());

//         const historySet = new Set();
//         if (historyQuery.data) {
//             historyQuery.data.forEach(h => {
//                 // Key: ptrl_itm_email_empCode_type
//                 historySet.add(`${h.ptrl_code}_${h.itm_code}_${h.recipient_email}_${h.emp_code}_${h.recipient_type}`);
//             });
//         }

//         // Group by email to support employees with multiple groups
//         const emailToGroups = {};
//         for (const row of csData.data) {
//             if (!emailToGroups[row.emp_email]) emailToGroups[row.emp_email] = new Set();
//             emailToGroups[row.emp_email].add(row.ptrl_group_code);
//         }

//         for (const email in emailToGroups) {
//             const empInfo = csData.data.find(e => e.emp_email === email);
//             const empCode = empInfo?.emp_code || null;
//             const allowedGroups = emailToGroups[email];

//             // --- เริ่มกระบวนการกรองข้อมูลแบบอ่านง่าย ---
//             const relevantAlerts = [];

//             for (const alert of summaryAlerts) {
//                 // 1. เช็คก่อนว่าปั๊มนี้อยู่ในกลุ่มที่ CS คนนี้ดูแลหรือไม่
//                 if (!allowedGroups.has(alert.station.ptrl_group_code)) continue;

//                 // 2. กรองเฉพาะสินค้าที่ CS คนนี้ "ยังไม่เคยได้รับแจ้ง" ในรูปแบบรายงานสรุป (cs_planner) ในวันนี้
//                 const newProducts = [];
//                 for (const p of alert.products) {
//                     const checkKey = `${alert.station.ptrl_code}_${p.itm_code}_${email}_${empCode}_cs_planner`;

//                     if (historySet.has(checkKey)) {
//                         console.log(`    [Runout Alert]  [Skip] ข้ามรายการซ้ำในรายงานสรุป: ${alert.station.ptrl_desc} (${p.product_name}) สำหรับคุณ ${email}`);
//                     } else {
//                         newProducts.push(p);
//                     }
//                 }

//                 // 3. ถ้ามีสินค้าใหม่ที่ต้องแจ้งเตือน ให้เพิ่มลงในลิสต์ที่จะส่ง
//                 if (newProducts.length > 0) {
//                     relevantAlerts.push({
//                         ...alert,
//                         products: newProducts
//                     });
//                 }
//             }

//             if (relevantAlerts.length > 0) {
//                 const subject = `[AOS Alert] สรุปรายงานสถานีที่เสี่ยง Run Out (สำหรับ CS/Planner)`;
//                 const html = generateCSSummaryEmailHtml(relevantAlerts);
//                 const excel = await generateCSSummaryExcel(relevantAlerts);
//                 const attachments = excel ? [{ filename: `AOS_CS_Summary_RunOut_${moment().format('YYYYMMDD')}.xlsx`, content: excel }] : [];

//                 // ดึงชื่อพนักงานและข้อมูลสำหรับการพิมพ์ Log Debug
//                 const empInfo = csData.data.find(e => e.emp_email === email);
//                 const empName = empInfo?.emp_name || 'ไม่ทราบชื่อ';
//                 const empRoleDesc = empInfo?.emp_role_desc || 'CS/Planner';

//                 relevantAlerts.forEach(a => {
//                     const groupDesc = a.station.ptrl_group_desc || 'ไม่มีกลุ่ม';
//                     const groupID = a.station.ptrl_group_code || '-';
//                     logEntries.push({
//                         'สถานีบริการ (Station)': `${a.station.ptrl_desc} (${a.station.ptrl_number})`,
//                         'กลุ่มปั๊ม (Petrol Group)': `${groupDesc} (${groupID})`,
//                         'ชื่อพนักงาน': empName,
//                         'ตำแหน่ง': empRoleDesc,
//                         'อีเมลปลายทาง (Email)': email
//                     });
//                 });

//                 await mailer.sendMail(email, subject, html, attachments);
//                 console.log(`   🔋 [Runout Alert] ✅ ส่งอีเมลสรุปให้ทีม CS/Planner (${email}) รวบยอด ${relevantAlerts.length} ปั๊ม`);

//                 // บันทึกข้อมูล Runout หลังส่งอีเมลสรุปให้ CS/Planner สำเร็จ
//                 const csEmpCode = empInfo?.emp_code || null;
//                 for (const alert of relevantAlerts) {
//                     await saveRunoutToDatabase(dbName, alert.station, alert.products, email, 'cs_planner', csEmpCode, empRoleDesc);
//                 }
//             }
//         }
//     } catch (err) {
//         console.error('❌ [sendSummaryAlertToCS Error]:', err);
//     }
//     return logEntries;
// }



// /**
//  * ฟังก์ชันย่อยสำหรับตรวจสอบเงื่อนไขความถี่และส่งอีเมล
//  */
// async function sendAlertToRecipients(dbName, station, lowStockProducts) {
//     const currentTime = moment();
//     const logEntries = [];
//     const alertConfigs = await pgConn.getWithParams(dbName, `
//         SELECT DISTINCT ON (a.email_alert) 
//                a.ptrl_mail_code, a.email_alert, a.re_alert_type, a.last_alert_dt,
//                COALESCE(e.emp_code, a.emp_code) as emp_code, 
//                e.emp_name, r.emp_role_desc
//         FROM tbl_petrol_mail_alert a
//         LEFT JOIN tbl_employee e ON a.emp_code = e.emp_code AND e.rm_dt IS NULL AND e.emp_flag = '1'
//         LEFT JOIN tbl_employee_role r ON e.emp_role_code = r.emp_role_code
//         WHERE a.ptrl_code = $1 AND a.alert_status = '1' AND a.rm_dt IS NULL
//         ORDER BY a.email_alert, a.ptrl_mail_code DESC
//     `, [station.ptrl_code], config.connectionString());

//     if (!alertConfigs.data?.length) return logEntries;

//     const validRecipients = [];
//     const mailCodesToUpdate = [];

//     for (const conf of alertConfigs.data) {
//         const lastAlert = conf.last_alert_dt ? moment(conf.last_alert_dt) : null;
//         let canSend = false;

//         if (conf.re_alert_type == 1) { // ครั้งเดียวต่อวัน
//             if (!lastAlert || lastAlert.format('YYYY-MM-DD') !== currentTime.format('YYYY-MM-DD')) canSend = true;
//         } else if (conf.re_alert_type == 2) { // ทุก 30 นาที
//             if (!lastAlert || currentTime.diff(lastAlert, 'minutes') >= 30) canSend = true;
//         }

//         if (canSend) {
//             validRecipients.push({
//                 email: conf.email_alert,
//                 empCode: conf.emp_code || null,
//                 empName: conf.emp_name || 'ผู้จัดการปั๊ม',
//                 empRoleDesc: conf.emp_role_desc || 'ผู้จัดการสถานี'
//             });
//             mailCodesToUpdate.push(conf.ptrl_mail_code);
//         } else {
//             console.log(`    [Runout Alert]  ข้ามการส่งให้ผู้จัดการ: ${conf.email_alert} (เพิ่งส่งไปเมื่อ ${lastAlert.format('HH:mm')} ติดเงื่อนไขความถี่)`);
//         }
//     }

//     if (validRecipients.length > 0) {
//         const subject = `[AOS Alert] แจ้งเตือนน้ำมันใกล้หมด - ${station.ptrl_desc}`;
//         const html = generateLowStockEmailHtml(station, lowStockProducts);
//         const excel = await generateLowStockExcel(station, lowStockProducts);

//         const attachments = excel ? [{ filename: `AOS_RunOut_${station.ptrl_number}.xlsx`, content: excel }] : [];

//         const groupDesc = station.ptrl_group_desc || 'ไม่มีกลุ่ม';
//         const groupID = station.ptrl_group_code || '-';

//         const emailsToSend = validRecipients.map(r => r.email).join(',');

//         validRecipients.forEach(r => {
//             logEntries.push({
//                 'สถานีบริการ (Station)': `${station.ptrl_desc} (${station.ptrl_number})`,
//                 'กลุ่มปั๊ม (Petrol Group)': `${groupDesc} (${groupID})`,
//                 'ชื่อพนักงาน': r.empName,
//                 'ตำแหน่ง': r.empRoleDesc,
//                 'อีเมลปลายทาง (Email)': r.email
//             });
//         });

//         await mailer.sendMail(emailsToSend, subject, html, attachments);
//         console.log(`    [Runout Alert]  ส่งอีเมลแจ้งเตือนปั๊ม ${station.ptrl_desc} เรียบร้อยแล้ว`);

//         // บันทึกข้อมูล Runout หลังส่งอีเมลแจ้งเตือนสำเร็จ (บันทึกทีละคนเพื่อให้ emp_code ตรงกับคนรับ)
//         for (const r of validRecipients) {
//             // บันทึกเป็นสถานะ station_manager เพราะเป็นการส่งเมลรายปั๊ม (Individual)
//             await saveRunoutToDatabase(dbName, station, lowStockProducts, r.email, 'station_manager', r.empCode, r.empRoleDesc);
//         }

//         // อัปเดต Last Alert Time
//         for (const code of mailCodesToUpdate) {
//             await pgConn.execute2params(dbName, `UPDATE tbl_petrol_mail_alert SET last_alert_dt = $1 WHERE ptrl_mail_code = $2`, [currentTime.format('YYYY-MM-DD HH:mm:ss'), code], config.connectionString());
//         }
//     }
//     return logEntries;
// }