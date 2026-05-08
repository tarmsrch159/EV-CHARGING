const ExcelJS = require('exceljs');
const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const mailer = require('../../middleware/nodemailer/mail');
const xglobal = new require('../../middleware/global');
const fs = require('fs');
const path = require('path');

const dbPrefix = config.dbPrefix();

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
                    ${Number(prod.total_usable_stock).toLocaleString()} ลิตร
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
        console.error('❌ [generateLowStockExcel Error]:', err.message);
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
    const params = [tankInfo.ptrl_tank_code, stationInfo.ptrl_number, tankInfo.itm_code, tankInfo.itm_material_number];
    const result = await pgConn.getWithParams(dbName, sql, params, config.connectionString());
    return parseFloat(result.data[0]?.pending_qty) || 0;
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

            rowStock += stock;
            rowSales += sales;
            rowRecom += recom;

            rowHtml += `
                <td style="text-align: right; border-left: 2px solid #dee2e6;">${stock > 0 ? stock.toLocaleString() : '-'}</td>
                <td style="text-align: right;">${sales > 0 ? sales.toLocaleString() : '-'}</td>
                <td style="text-align: right;">${unpump > 0 ? unpump.toLocaleString() : '-'}</td>
                <td style="text-align: right; color:#d9534f; font-weight:bold;">${recom > 0 ? recom.toLocaleString() : '-'}</td>
            `;
        });

        totalAllStocks += rowStock;
        totalAllSales += rowSales;
        totalAllRecom += rowRecom;

        rowHtml += `
            <td style="text-align: right; border-left: 2px solid #dee2e6; background-color: #f8f9fa;">${rowStock.toLocaleString()}</td>
            <td style="text-align: right; background-color: #f8f9fa;">${rowSales.toLocaleString()}</td>
            <td style="text-align: right; background-color: #f8f9fa; color:#d9534f; font-weight:bold;">${rowRecom.toLocaleString()}</td>
        `;

        rowsHtml += `<tr style="border-bottom: 1px solid #ddd;">${rowHtml}</tr>`;
    });

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
                            <tr style="background-color: #f1f3f5; font-weight: bold;">
                                <td colspan="2" style="text-align: center;">รวมทั้งหมด</td>
                                ${productList.map(() => '<td colspan="4" style="border-left: 2px solid #dee2e6;"></td>').join('')}
                                <td style="text-align: right; border-left: 2px solid #dee2e6;">${totalAllStocks.toLocaleString()}</td>
                                <td style="text-align: right;">${totalAllSales.toLocaleString()}</td>
                                <td style="text-align: right; color:#d9534f;">${totalAllRecom.toLocaleString()}</td>
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

                rowStock += stock; rowSales += sales; rowRecom += recom;

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

            finalStock += rowStock; finalSales += rowSales; finalRecom += rowRecom;

            [rowStock, rowSales, rowRecom].forEach((val, i) => {
                const cell = worksheet.getCell(currentRow, colIndex + i);
                cell.value = val > 0 ? val : 0;
                cell.numFmt = '#,##0';
                cell.font = fontSarabunBold;
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
            currentRow++;
        });

        worksheet.mergeCells(currentRow, 1, currentRow, 2);
        const sumTitle = worksheet.getCell(currentRow, 1);
        sumTitle.value = 'รวมทั้งหมด (Grand Total)';
        sumTitle.font = fontSarabunBold;
        sumTitle.alignment = { horizontal: 'right', vertical: 'middle' };
        sumTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

        worksheet.getColumn(1).width = 5;
        worksheet.getColumn(2).width = 30;
        for (let i = 3; i <= totalCols; i++) worksheet.getColumn(i).width = 12;

        return await workbook.xlsx.writeBuffer();
    } catch (err) {
        console.error('❌ [generateCSSummaryExcel Error]:', err.message);
        return null;
    }
};

// ======= 2. จับคู่ CS กับกลุ่มปั๊มที่ดูแลเพื่อยิงเมลสรุป =======
// หาว่า CS คนไหนดูแลปั๊มกลุ่มไหนบ้าง แล้วกรองปั๊มที่เตือนโยนใส่เมลสรุปฉบับเดียว/คน
async function sendSummaryAlertToCS(dbName, summaryAlerts) {
    const logEntries = [];
    try {
        const csData = await pgConn.get(dbName, `
            SELECT e.emp_email, e.emp_name, epg.ptrl_group_code, pg.ptrl_group_desc
            FROM tbl_employee e
            JOIN tbl_employee_petrol_group epg ON e.emp_code = epg.emp_code
            LEFT JOIN tbl_petrol_group pg ON epg.ptrl_group_code = pg.ptrl_group_code
            WHERE e.emp_flag = '1' AND epg.emp_pgrp_flag = 1 
              AND e.emp_email IS NOT NULL AND e.emp_email != ''
        `, config.connectionString());

        if (!csData.data?.length) return logEntries;

        // Group by email to support employees with multiple groups
        const emailToGroups = {};
        for (const row of csData.data) {
            if (!emailToGroups[row.emp_email]) emailToGroups[row.emp_email] = new Set();
            emailToGroups[row.emp_email].add(row.ptrl_group_code);
        }

        for (const email in emailToGroups) {
            const allowedGroups = emailToGroups[email];

            // Filter global alerts to only those stations the CS manages
            const relevantAlerts = summaryAlerts.filter(a => allowedGroups.has(a.station.ptrl_group_code));

            if (relevantAlerts.length > 0) {
                const subject = `[AOS Alert] สรุปรายงานสถานีที่เสี่ยง Run Out (สำหรับ CS/Planner)`;
                const html = generateCSSummaryEmailHtml(relevantAlerts);
                const excel = await generateCSSummaryExcel(relevantAlerts);
                const attachments = excel ? [{ filename: `AOS_CS_Summary_RunOut_${moment().format('YYYYMMDD')}.xlsx`, content: excel }] : [];

                // ดึงชื่อพนักงานและข้อมูลสำหรับการพิมพ์ Log Debug
                const empName = csData.data.find(e => e.emp_email === email)?.emp_name || 'ไม่ทราบชื่อ';
                relevantAlerts.forEach(a => {
                    const groupDesc = a.station.ptrl_group_desc || 'ไม่มีกลุ่ม';
                    const groupID = a.station.ptrl_group_code || '-';
                    logEntries.push({
                        'สถานีบริการ (Station)': `${a.station.ptrl_desc} (${a.station.ptrl_number})`,
                        'กลุ่มปั๊ม (Petrol Group)': `${groupDesc} (${groupID})`,
                        'ชื่อพนักงาน': empName,
                        'ตำแหน่ง': 'CS/Planner',
                        'อีเมลปลายทาง (Email)': email
                    });
                });

                await mailer.sendMail(email, subject, html, attachments);
                console.log(`   ✅ [Success] ส่งอีเมลสรุป Low Stock ให้ทีม CS/Planner (${email}) รวบยอด ${relevantAlerts.length} ปั๊ม`);
            }
        }
    } catch (err) {
        console.error('❌ [sendSummaryAlertToCS Error]:', err);
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
exports.processLowStockAlerts = async (lic_code, manual_off_code = null) => {
    if (!lic_code) return;
    const dbName = dbPrefix + lic_code;
    const currentTime = moment();

    try {
        console.log(`\n🔍 [Low Stock Alert] เริ่มตรวจสอบ (${lic_code}) เวลา ${currentTime.format('HH:mm:ss')}...`);

        // 1. ดึงรายการปั๊มที่ถึงรอบการตรวจสอบ
        let wh = "";
        let params = [];
        if (manual_off_code && manual_off_code.toString().toUpperCase() !== 'ALL') {
            params.push(manual_off_code);
            wh = ` AND o.order_cutoff_time = (SELECT order_cutoff_time FROM tbl_office WHERE off_code = $${params.length} AND rm_dt IS NULL LIMIT 1) `;
        } else if (!manual_off_code) {
            params.push(currentTime.format('HH:mm:ss'));
            wh = ` AND o.order_cutoff_time <= $${params.length}::TIME `;
        }

        const scriptSql = `
            SELECT DISTINCT p.ptrl_code, p.ptrl_number, p.ptrl_desc, p.coverage_days, p.ptrl_group_code, pg.ptrl_group_desc
            FROM tbl_petrol p
            INNER JOIN tbl_office o ON p.off_code = o.off_code
            LEFT JOIN tbl_petrol_group pg ON p.ptrl_group_code = pg.ptrl_group_code
            WHERE p.ptrl_flag = '1' AND p.rm_dt IS NULL
                ${wh}
        `;
        const activeStations = await pgConn.getWithParams(dbName, scriptSql, params, config.connectionString());
        if (!activeStations.data?.length) return console.log(`   ⚪ ไม่มีปั๊มที่ต้องตรวจสอบในรอบนี้`);

        let globalLowStockData = [];
        let allDebugLogs = [];

        // 2. ตรวจสอบสต็อกรายปั๊มแบบทีละสถานี
        for (const station of activeStations.data) {
            const coverageLimit = parseFloat(station.coverage_days) || 3;

            // ดึงข้อมูลถังน้ำมันทั้งหมดของปั๊ม
            const tankData = await pgConn.getWithParams(dbName, `
                SELECT tpt.ptrl_tank_code, tpt.tnk_number, tpt.itm_code, itm.itm_material_number, 
                       itm.itm_desc AS product_name, tpt.unpump_level,
                       COALESCE(auto_tank.tnk_deadstock, 0) AS deadstock,
                       COALESCE(auto_tank.stock, 0) as current_stock,
                       COALESCE(auto_sales.sale_previous, 0) AS day_sales
                FROM tbl_petrol_tank tpt 
                LEFT JOIN tbl_item itm ON tpt.itm_code = itm.itm_code
                LEFT JOIN (
                    SELECT DISTINCT ON (tank_code, ptrl_code) * 
                    FROM tbl_automatics_tanks_information ORDER BY tank_code, ptrl_code, stock_at DESC
                ) auto_tank ON tpt.ptrl_tank_code = auto_tank.tank_code AND tpt.ptrl_code = auto_tank.ptrl_code
                LEFT JOIN (
                    SELECT DISTINCT ON (tank_code, ptrl_code) ptrl_code, tank_code, sale_previous 
                    FROM tbl_automatics_sales_previous_information 
                    ORDER BY tank_code, ptrl_code, sale_at_previous DESC
                ) auto_sales ON tpt.ptrl_code = auto_sales.ptrl_code AND tpt.ptrl_tank_code = auto_sales.tank_code
                WHERE tpt.ptrl_code = $1 AND tpt.ptrl_tank_flag = '1' AND tpt.rm_dt IS NULL
                ORDER BY tpt.tnk_number ASC
            `, [station.ptrl_code], config.connectionString());

            if (!tankData.data?.length) continue;

            // ดึงค่า Pending Order ของทุกถังพร้อมกันแบบขนาน 
            await Promise.all(tankData.data.map(async (tank) => {
                tank.pending_qty = await getPendingOrderQty(dbName, tank, station);
            }));

            // 3. จัดกลุ่มข้อมูลตามสินค้า (Aggregation)
            const productGroups = {};
            for (const tank of tankData.data) {
                if (!productGroups[tank.itm_code]) {
                    productGroups[tank.itm_code] = {
                        name: tank.product_name,
                        tanks: [],
                        total_stock: 0,
                        total_unpump: 0,
                        total_sales: 0,
                        total_pending: 0
                    };
                }
                const group = productGroups[tank.itm_code];
                const unpumpVolume = parseFloat(tank.deadstock) || 0;

                group.tanks.push(tank.tnk_number);
                group.total_stock += parseFloat(tank.current_stock) || 0;
                group.total_unpump += unpumpVolume;
                group.total_sales += parseFloat(tank.day_sales) || 0;
                group.total_pending += tank.pending_qty || 0;
            }

            // 4. คัดกรองสินค้าที่เข้าข่าย Low Stock
            const lowStockProducts = [];
            for (const itmCode in productGroups) {
                const group = productGroups[itmCode];
                const usableStock = Math.max(0, group.total_stock - group.total_unpump);
                const avgSales = group.total_sales > 0 ? group.total_sales : 0.001; // ป้องกันหารด้วยศูนย์
                const daysLeft = usableStock / avgSales;
                const potentialDaysLeft = (usableStock + group.total_pending) / avgSales;
                let stockDaysales = (group.total_stock - group.total_sales)
                if (stockDaysales < group.total_unpump) {
                    // ตรวจสอบว่าวันนี้มีการเปิดออเดอร์สำหรับสินค้านี้ที่ส่ง SAP สำเร็จแล้วหรือไม่
                    const todayOrderCheck = await pgConn.getWithParams(dbName, `
                        SELECT 1
                        FROM tbl_order o
                        JOIN tbl_order_item i ON o.id = i.order_no
                        WHERE o.ship_to = $1
                          AND i.item_no = $2
                          AND o.order_status = '1'
                          AND DATE(o.ist_dt) = CURRENT_DATE
                          AND o.rm_dt IS NULL 
                          AND i.rm_dt IS NULL
                        LIMIT 1
                    `, [station.ptrl_number, itmCode], config.connectionString());
                    // มีออเดอร์เปิดแล้ววันนี้และส่งเข้า SAP สำเร็จ ไม่ต้องแจ้งเตือน
                    if (todayOrderCheck.data && todayOrderCheck.data.length > 0) {

                        continue;
                    }

                    lowStockProducts.push({
                        product_name: group.name,
                        tank_numbers: group.tanks.sort((a, b) => a - b).join(', '),
                        total_usable_stock: stockDaysales,
                        total_actual_unpump: group.total_unpump,
                        total_day_sales: group.total_sales,
                        total_pending_qty: group.total_pending,
                        days_remaining: daysLeft,
                        coverage_days: coverageLimit
                    });
                }
            }

            // 5. ส่งแจ้งเตือน (Email & Excel Attachment)
            if (lowStockProducts.length > 0) {
                const logs = await sendAlertToRecipients(dbName, station, lowStockProducts);
                if (logs && logs.length > 0) allDebugLogs.push(...logs);
                globalLowStockData.push({ station, products: lowStockProducts });
            }
        }

        // 6. ส่งแจ้งเตือนสรุปรวมให้ทีม CS/Planner
        if (globalLowStockData.length > 0) {
            const csLogs = await sendSummaryAlertToCS(dbName, globalLowStockData);
            if (csLogs && csLogs.length > 0) allDebugLogs.push(...csLogs);
        }

        // 7. พิมพ์ตารางผลลัพธ์ด้วย console.table() แบบสวยงามไร้ Dependency
        if (allDebugLogs.length > 0) {
            console.log(`\n\x1b[32m\x1b[1m📊 [Low Stock Alert Summary] ตารางสรุปการจัดส่งแจ้งเตือนสำเร็จ:\x1b[0m`);
            console.table(allDebugLogs);
        } else {
            console.log(`\n\x1b[33m⚪ [Low Stock Alert] ตรวจสอบเสร็จสิ้น ไม่พบบัญชีน้ำมันใกล้หมดที่จะต้องส่งแจ้งเตือนในรอบนี้\x1b[0m`);
        }
    } catch (error) {
        console.error('❌ [processLowStockAlerts Error]:', error);
    }
};

/**
 * ฟังก์ชันย่อยสำหรับตรวจสอบเงื่อนไขความถี่และส่งอีเมล
 */
async function sendAlertToRecipients(dbName, station, lowStockProducts) {
    const currentTime = moment();
    const logEntries = [];
    const alertConfigs = await pgConn.getWithParams(dbName, `
        SELECT ptrl_mail_code, email_alert, re_alert_type, last_alert_dt 
        FROM tbl_petrol_mail_alert WHERE ptrl_code = $1 AND mail_alert_flag = 1 AND rm_dt IS NULL
    `, [station.ptrl_code], config.connectionString());

    if (!alertConfigs.data?.length) return logEntries;

    const emailsToSend = [];
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
            emailsToSend.push(conf.email_alert);
            mailCodesToUpdate.push(conf.ptrl_mail_code);
        }
    }

    if (emailsToSend.length > 0) {
        const subject = `[AOS Alert] แจ้งเตือนน้ำมันใกล้หมด - ${station.ptrl_desc}`;
        const html = generateLowStockEmailHtml(station, lowStockProducts);
        const excel = await generateLowStockExcel(station, lowStockProducts);

        const attachments = excel ? [{ filename: `AOS_RunOut_${station.ptrl_number}.xlsx`, content: excel }] : [];

        const groupDesc = station.ptrl_group_desc || 'ไม่มีกลุ่ม';
        const groupID = station.ptrl_group_code || '-';

        logEntries.push({
            'สถานีบริการ (Station)': `${station.ptrl_desc} (${station.ptrl_number})`,
            'กลุ่มปั๊ม (Petrol Group)': `${groupDesc} (${groupID})`,
            'ชื่อพนักงาน': 'ผู้จัดการปั๊ม',
            'ตำแหน่ง': 'ผู้จัดการสถานี',
            'อีเมลปลายทาง (Email)': emailsToSend.join(', ')
        });

        await mailer.sendMail(emailsToSend.join(','), subject, html, attachments);
        console.log(`   ✅ [Success] ส่งอีเมลแจ้งเตือนปั๊ม ${station.ptrl_desc} เรียบร้อยแล้ว`);

        // อัปเดต Last Alert Time
        for (const code of mailCodesToUpdate) {
            // await pgConn.execute2params(dbName, `UPDATE tbl_petrol_mail_alert SET last_alert_dt = $1 WHERE ptrl_mail_code = $2`, [currentTime.format('YYYY-MM-DD HH:mm:ss'), code], config.connectionString());
        }
    }
    return logEntries;
}

// ==========================================================================
// 4. API CONTROLLER
// ==========================================================================

/**
 * API สำหรับสั่งรันกระบวนการแจ้งเตือนแบบ Manual
 */
exports.triggerLowStockAlert = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { off_code, action } = req.body[0] || {};

        if (!lic_code || !action) {
            return xglobal.sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง', []);
        }

        const username = action[0].value || 'SYSTEM';
        await xglobal.action_logs(lic_code, action[0].id, 'Manual Low Stock Alert Triggered', JSON.stringify({ off_code }), 'success', username);

        // รันแบบ Background
        this.processLowStockAlerts(lic_code, off_code || 'ALL');

        return xglobal.sendResponse(res, 'success', '0', 'เริ่มกระบวนการตรวจสอบ Low Stock แล้ว (Background Task)', []);
    } catch (err) {
        return xglobal.sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดในการเริ่มกระบวนการ', []);
    }
};
