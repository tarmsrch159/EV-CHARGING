const config = require("../../configuration/connection");
const pgConn = require("../../library/pgConnection");
const moment = require("moment");
const axios = require("axios");
const { sapApiClient } = require("./sap-api-config");
const xglobal = require("../../middleware/global");
const dbPrefix = config.dbPrefix();
const sendResponse = xglobal.sendResponse;



// =========== ดึงข้อมูลรายการสั่งซื้อ ===========
exports.getSapOrderErrorLogsInformation = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    // =========================================================================
    // รับค่า Request Parameters และกำหนดค่าเริ่มต้น
    // =========================================================================
    let lic_code = req.header("lic_code");
    let {
      order_id,
      page_index,
      page_limit,
      action,
    } = req.body[0] || {};

    // กำหนด Default Values ให้กับตัวแปรสำคัญที่ไม่ได้ส่งมา
    page_index = page_index === undefined ? 1 : page_index;
    page_limit = page_limit === undefined ? 10 : page_limit;


    // =========================================================================
    // (ตรวจสอบความครบถ้วนของข้อมูลสำคัญ)
    // =========================================================================
    if (
      order_id === undefined ||
      action === undefined
    ) {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message:
            "ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
          data: xresult,
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      res.status(200).send(response);
      return;
    }

    // =========================================================================
    // จัดการ Data Type และ Format สำหรับ Pagination และ Date
    // =========================================================================
    if (page_index > 0) page_index -= 1;



    // =========================================================================
    // สร้าง Dynamic WHERE Clause สำหรับ Query หลัก (ดึงข้อมูล Order)
    // =========================================================================
    let conditions = [
      "tbl_action_logs.rm_dt IS NULL",
      "tbl_action_logs.action_desc IN ('confirm_order_api_error', 'confirm_order_sap_msg')"
    ];

    if (order_id.toString().toUpperCase() !== "ALL") {
      conditions.push(`(tbl_action_logs.action_body ILIKE '%"order_id":%${order_id}%' OR tbl_action_logs.action_result ILIKE '%"order_id":%${order_id}%')`);
    }


    let whereClause = "WHERE " + conditions.join(" AND ");

    // =========================================================================
    // SQL Query หลักสำหรับดึงข้อมูลออเดอร์ (พร้อม JOIN ข้อมูลที่เกี่ยวข้อง)
    // =========================================================================
    // *มีการ Sub-query tbl_sum_item เพื่อหาผลรวมจำนวนสินค้า (total_qty) ของแต่ละ order_no
    let baseSelectQuery = `
            SELECT 
                tbl_action_logs.action_log_code,
                tbl_action_logs.action_desc,
                tbl_action_logs.action_body,
                tbl_action_logs.action_result,
                tbl_action_logs.ist_dt
            FROM tbl_action_logs  
        `;

    let dataScript = `
            ${baseSelectQuery}
            ${whereClause}
            ORDER BY ist_dt DESC
            OFFSET (${page_index} * ${page_limit}) LIMIT ${page_limit};
        `;

    // =========================================================================
    // Execute Query หลัก และประมวลผลผลลัพธ์เพื่อส่ง Response
    // =========================================================================
    let tbl_temporary = await pgConn.get(
      dbPrefix + lic_code,
      dataScript,
      config.connectionString(),
    );


    // ตรวจสอบว่า Query สำเร็จหรือไม่
    if (!tbl_temporary.code) {
      if (tbl_temporary.data.length > 0) {
        tbl_temporary.data = tbl_temporary.data.map(item => {
          let errorMsg = "";
          if (item.action_desc === 'confirm_order_api_error') {
            errorMsg = item.action_body;
          } else if (item.action_desc === 'confirm_order_sap_msg') {
            errorMsg = item.action_result;
          } else {
            errorMsg = item.action_result || item.action_body || "";
          }
          return {
            action_log_code: item.action_log_code,
            action_result: errorMsg,
            ist_dt: item.ist_dt
          };
        });

        tbl_temporary.data = JSON.parse(
          JSON.stringify(tbl_temporary.data, (key, value) => value === null ? "" : value)
        );

        console.log("tbl_temporary.data", tbl_temporary.data);

        // =========================================================================
        // นับจำนวน Record ทั้งหมด (สำหรับทำ Total Pages ในระบบ Pagination)
        // =========================================================================
        let countScript = `
                    SELECT 
                        CEIL((CEIL(SUM(rows_total)) / ${page_limit})) as page_total, 
                        SUM(rows_total) as rows_total  
                    FROM (
                        SELECT 1 as rows_total FROM tbl_action_logs  
                        ${whereClause}
                    ) xtbl_master;
                `;

        let tbl_temporary0 = await pgConn.get(
          dbPrefix + lic_code,
          countScript,
          config.connectionString(),
        );

        let page_total = 0;
        let rows_total = 0;

        if (!tbl_temporary0.code && tbl_temporary0.data.length > 0) {
          page_total = parseInt(tbl_temporary0.data[0].page_total);
          rows_total = parseInt(tbl_temporary0.data[0].rows_total);
        }

        // ส่ง Response กรณีสำเร็จ (มีข้อมูล) พร้อมแนบ Summary Report
        let response = [
          {
            status: "success",
            invalid_code: "0",
            message: "",
            data: tbl_temporary.data,
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
            page_total: page_total <= 0 ? 1 : page_total,
            rows_total: rows_total,
          },
        ];
        res.status(200).send(response);
        return;
      } else {
        let response = [
          {
            status: "success",
            invalid_code: "0",
            message: "",
            data: xresult,
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
        res.status(200).send(response);
        return;
      }
    } else {
      let response = [
        {
          status: "error",
          invalid_code: "-3",
          message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
          data: xresult,
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      res.status(200).send(response);

      // บันทึก Log เมื่อเกิดข้อผิดพลาด
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "ดึงข้อมูล Order",
        JSON.stringify(req.body[0]),
        "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        action[0].value,
      );
      return;
    }
  })().catch(async (err) => {
    console.error(err);
    let response = [
      {
        status: "error",
        invalid_code: "-4",
        message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
      },
    ];
    res.status(200).send(response);
  });
};