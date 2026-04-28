const config = require("../../configuration/connection");
const pgConn = require("../../library/pgConnection");
const moment = require("moment");
const axios = require("axios");
const { sapApiClient } = require("./sap-api-config");
const xglobal = require("../../middleware/global");
const dbPrefix = config.dbPrefix();
const sendResponse = xglobal.sendResponse;

// =========== ดึงข้อมูลรายการสั่งซื้อ ===========
exports.getOrderInformation = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    // =========================================================================
    // รับค่า Request Parameters และกำหนดค่าเริ่มต้น
    // =========================================================================
    let lic_code = req.header("lic_code");
    let {
      order_id,
      order_no,
      start_date,
      end_date,
      order_type,
      order_status,
      auto_order,
      status_deli,
      ptrl_number,
      ptrl_group_code,
      search,
      page_index,
      page_limit,
      action,
    } = req.body[0] || {};

    // กำหนด Default Values ให้กับตัวแปรสำคัญที่ไม่ได้ส่งมา
    page_index = page_index === undefined ? 1 : page_index;
    page_limit = page_limit === undefined ? 10 : page_limit;
    auto_order = auto_order === undefined ? "ALL" : auto_order;
    status_deli = status_deli === undefined ? "ALL" : status_deli;
    ptrl_number = ptrl_number === undefined ? "ALL" : ptrl_number;
    ptrl_group_code = ptrl_group_code === undefined ? "ALL" : ptrl_group_code;

    // =========================================================================
    // (ตรวจสอบความครบถ้วนของข้อมูลสำคัญ)
    // =========================================================================
    if (
      start_date === undefined ||
      end_date === undefined ||
      order_type === undefined ||
      order_status === undefined ||
      search === undefined ||
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

    let original_start_date = start_date;
    let original_end_date = end_date;

    if (start_date.length === 10) start_date += " 00:00:00";
    if (end_date.length === 10) end_date += " 23:59:59";

    // =========================================================================
    // สร้าง Dynamic WHERE Clause สำหรับ Query หลัก (ดึงข้อมูล Order)
    // =========================================================================
    let conditions = ["tbl_order.rm_dt IS NULL", "tbl_order.order_flag = '1'"];

    if (order_no.toString().toUpperCase() !== "ALL")
      conditions.push(`tbl_order.order_no = '${order_no}'`);
    if (status_deli.toString().toUpperCase() !== "ALL")
      conditions.push(`tbl_order.status_deli = '${status_deli}'`);
    if (order_type.toString().toUpperCase() !== "ALL")
      conditions.push(`tbl_order.order_type = '${order_type}'`);
    if (auto_order.toString().toUpperCase() !== "ALL")
      conditions.push(`tbl_order.auto_order = '${auto_order}'`);
    if (order_status.toString().toUpperCase() !== "ALL")
      conditions.push(`tbl_order.order_status = '${order_status}'`);
    if (order_id.toString().toUpperCase() !== "ALL")
      conditions.push(`tbl_order.id = '${order_id}'`);

    if (
      original_start_date.toString().toUpperCase() !== "ALL" &&
      original_end_date.toString().toUpperCase() !== "ALL" &&
      original_start_date !== "" &&
      original_end_date !== ""
    ) {
      conditions.push(
        `tbl_order.ist_dt >= '${start_date}' AND tbl_order.ist_dt <= '${end_date}'`,
      );
    }

    if (
      ptrl_number !== undefined &&
      ptrl_number.toString().toUpperCase() !== "ALL"
    ) {
      conditions.push(`tbl_order.ship_to = '${ptrl_number}'`);
    }

    if (
      ptrl_group_code !== undefined &&
      ptrl_group_code.toString().toUpperCase() !== "ALL"
    ) {
      conditions.push(`tbl_petrol.ptrl_group_code = '${ptrl_group_code}'`);
    }

    // =========================================================================
    // กรองข้อมูลตามสิทธิ์การเข้าถึง (Role Authorization)
    // =========================================================================
    let act_val = action[0].value.toString().toUpperCase();
    let act_id = action[0].id;

    if (act_val === "GROUP") {
      // สิทธิ์ GROUP (เช่น Planner/CS): มองเห็นเฉพาะ Order ของปั๊มที่อยู่ในความดูแลของตัวเอง
      conditions.push(
        `tbl_petrol.ptrl_group_code IN (SELECT ptrl_group_code FROM tbl_employee_petrol_group WHERE emp_code = '${act_id}' AND emp_pgrp_flag = 1)`,
      );
      conditions.push(`tbl_petrol.ptrl_flag = '1'`);
    } else if (act_val !== "ALL") {
      // สิทธิ์พนักงานทั่วไป: มองเห็นเฉพาะ Order ที่ตัวเองเป็นคนสร้าง
      conditions.push(`tbl_order.ship_to IN (SELECT ptrl_number FROM tbl_petrol WHERE ptrl_code IN (SELECT ptrl_code FROM tbl_employee WHERE emp_code = '${act_id}' AND emp_flag = '1'))`);
    }

    if (search !== "") {
      conditions.push(`(
                tbl_order.order_no LIKE '%${search}%' 
                OR tbl_order.sh_cus_ref LIKE '%${search}%' 
                OR tbl_order.cus_ref LIKE '%${search}%' 
                OR tbl_order.po_name LIKE '%${search}%' 
                OR tbl_order.description LIKE '%${search}%'
            )`);
    }

    let whereClause = "WHERE " + conditions.join(" AND ");

    // =========================================================================
    // SQL Query หลักสำหรับดึงข้อมูลออเดอร์ (พร้อม JOIN ข้อมูลที่เกี่ยวข้อง)
    // =========================================================================
    // *มีการ Sub-query tbl_sum_item เพื่อหาผลรวมจำนวนสินค้า (total_qty) ของแต่ละ order_no
    let baseSelectQuery = `
            SELECT 
                tbl_order.id, tbl_order.order_no, tbl_order.sh_cus_ref as aos_order_no, tbl_order.order_type, tbl_order.order_group, 
                tbl_order_type.ord_type_desc, tbl_petrol_group.ptrl_group_desc, tbl_order.order_status,
                tbl_order.chanel, tbl_order.division, tbl_order.sold_to, tbl_order.ship_to, tbl_petrol.ptrl_code,
                tbl_petrol.ptrl_desc, tbl_order.cus_ref, tbl_order.cus_date_ref, tbl_order.po_name, tbl_order.order_by, 
                tbl_order.ship_cond, tbl_order.pay_term, tbl_order.deli_date_req as request_date, tbl_master_time.time_value as RequestTime, 
                tbl_order.description, tbl_order.sh_cus_date_ref, tbl_order.status_deli, tbl_order.status_block, tbl_order.status_sd_process, 
                tbl_order.status_check, tbl_order.sd_doc_reject, tbl_order.cus_group, 
                tbl_order.hana_created, tbl_order.hana_time, tbl_order.created_by, 
                tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt, tbl_order.auto_order,
                COALESCE(tbl_sum_item.total_qty, 0) as total_item_qty,
                tbl_employee.emp_name,
                tbl_order.consignment_no,
                tbl_order.master_order_id
            FROM tbl_order  
            LEFT JOIN tbl_order_type ON tbl_order.order_type = tbl_order_type.ord_type_code
            LEFT JOIN tbl_petrol_group ON tbl_petrol_group.ptrl_group_code = tbl_order.order_group
            LEFT JOIN tbl_petrol ON tbl_order.ship_to = tbl_petrol.ptrl_number
            LEFT JOIN tbl_master_time ON tbl_order.deli_time_req = tbl_master_time.time_code
            LEFT JOIN tbl_employee ON tbl_order.created_by_tms = tbl_employee.emp_code
            LEFT JOIN (
                SELECT 
                    TRIM(CAST(order_no AS TEXT)) as order_no_text, 
                    SUM(NULLIF(TRIM(CAST(item_qty AS TEXT)), '')::numeric) as total_qty 
                FROM tbl_order_item 
                WHERE rm_dt IS NULL 
                GROUP BY TRIM(CAST(order_no AS TEXT))
            ) tbl_sum_item ON TRIM(CAST(tbl_order.id AS TEXT)) = tbl_sum_item.order_no_text
        `;

    let dataScript = `
            ${baseSelectQuery}
            ${whereClause}
            ORDER BY tbl_order.ist_dt DESC 
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
        tbl_temporary.data = JSON.parse(
          JSON.stringify(tbl_temporary.data).replace(/\:null/gi, '\:""'),
        );

        // =========================================================================
        // นับจำนวน Record ทั้งหมด (สำหรับทำ Total Pages ในระบบ Pagination)
        // =========================================================================
        let countScript = `
                    SELECT 
                        CEIL((CEIL(SUM(rows_total)) / ${page_limit})) as page_total, 
                        SUM(rows_total) as rows_total  
                    FROM (
                        SELECT 1 as rows_total FROM tbl_order 
                        LEFT JOIN tbl_petrol ON tbl_order.ship_to = tbl_petrol.ptrl_number
                        ${whereClause}
                        ORDER BY tbl_order.ist_dt DESC 
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


// =========== ดึงข้อมูลรายละเอียดของออเดอร์ตาม ID ที่ระบุ ========
exports.getOrderInformationByID = async (req, res, next) => {
  var xresult = [];
  // let date_at = moment().subtract(1, "days").format("YYYY-MM-DD");
  let date_at = moment().format("YYYY-MM-DD");
  return (async () => {
    let lic_code = req.header("lic_code");
    let { id, action } = req.body[0];

    // ======== ตรวจสอบว่ามีการส่งพารามิเตอร์ที่จำเป็น ========
    if (id == undefined || action == undefined) {
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

    // ======== คำสั่ง SQL สำหรับดึงข้อมูลของออเดอร์ และ Join ข้อมูลพื้นฐานที่เกี่ยวข้อง ========
    let orderScript = `SELECT 
                tbl_order.id, tbl_order.order_no, tbl_order.sh_cus_ref as aos_order_no, tbl_order.order_type, tbl_order.order_group, 
                tbl_order_type.ord_type_desc,
                tbl_petrol_group.ptrl_group_desc,
                tbl_order.order_status,
                tbl_order.chanel, tbl_order.division, tbl_order.sold_to, tbl_order.ship_to, 
                tbl_petrol.ptrl_desc, tbl_petrol.ptrl_code, tbl_petrol.ptrl_number, tbl_petrol.ptrl_sitecode,
                tbl_order.cus_ref, tbl_order.cus_date_ref, tbl_order.po_name, tbl_order.order_by, 
                tbl_order.ship_cond, tbl_order.pay_term, tbl_order.deli_date_req as request_date, tbl_master_time.time_value as RequestTime, 
                tbl_order.description, tbl_order.sh_cus_date_ref, 
                tbl_order.status_deli, tbl_order.status_block, tbl_order.status_sd_process, 
                tbl_order.status_check, tbl_order.sd_doc_reject, tbl_order.cus_group, 
                tbl_order.hana_created, tbl_order.hana_time, tbl_order.created_by, 
                tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt,
                tbl_order.auto_order,
                tbl_petrol.ptrl_address,
                tbl_petrol.ptrl_zip_code
            FROM tbl_order  
            
            LEFT JOIN tbl_order_type ON tbl_order.order_type = tbl_order_type.ord_type_code
            LEFT JOIN tbl_petrol_group ON tbl_petrol_group.ptrl_group_code = tbl_order.order_group
            LEFT JOIN tbl_petrol ON tbl_order.ship_to = tbl_petrol.ptrl_number
            LEFT JOIN tbl_master_time ON tbl_order.deli_time_req = tbl_master_time.time_code
            WHERE tbl_order.rm_dt IS NULL AND tbl_order.id = ${id}`;

    let orderResult = await pgConn.get(
      dbPrefix + lic_code,
      orderScript,
      config.connectionString(),
    );

    // ======== จัดการกรณีเกิดข้อผิดพลาดในการรัน Query ========
    if (orderResult.code) {
      let response = [
        {
          status: "error",
          invalid_code: "-3",
          message: "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
          data: xresult,
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      res.status(200).send(response);
      return;
    }

    // ======== จัดการกรณี Query สำเร็จ แต่ไม่พบข้อมูลออเดอร์ตาม ID ที่ส่งมา ========
    if (orderResult.data.length === 0) {
      let response = [
        {
          status: "success",
          invalid_code: "0",
          message: "ไม่พบข้อมูล Order",
          data: xresult,
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      res.status(200).send(response);
      return;
    }

    // ======== แปลงข้อมูล null ให้เป็นค่าว่าง (String ว่าง) ========
    let orderData = JSON.parse(
      JSON.stringify(orderResult.data[0]).replace(/\:null/gi, '\:""'),
    );

    // ======== คำสั่ง SQL สำหรับดึงรายการสินค้า (Items) ที่อยู่ในออเดอร์นี้ และถังที่ไม่ได้สั่ง (UNION ALL) ========
    let itemScript = `
        (
            SELECT 
                tbl_order_item.id, tbl_order_item.order_no, tbl_order_item.item_no,
                tbl_order_item.ptrl_tank_code,
                tbl_petrol_tank.tnk_number as tank_number,
                COALESCE(auto_tank.tnk_capacity::text, tbl_petrol_tank.tnk_capacity::text) as tank_capacity,
                tbl_order_item.item_qty, tbl_order_item.deli_plant, 
                tbl_order_item.long_text_id, tbl_order_item.long_text,
                tbl_order_item.sales_order_item, tbl_order_item.auto_order,
                tbl_order_item.sd_reject_reason, tbl_order_item.sd_process_status, 
                tbl_order_item.deli_status, tbl_order_item.misc_deli_no,
                tbl_order_item.ist_dt, tbl_order_item.mdf_dt,
                tbl_item.itm_desc as product, tbl_item.itm_material_number, tbl_item.itm_code,
                COALESCE(auto_tank.tnk_deadstock, tbl_petrol_tank.tnk_deadstock) AS un_pump,
                COALESCE(auto_tank.tnk_capacity, tbl_petrol_tank.tnk_capacity) AS max_stock,
                tbl_petrol_tank.tnk_target AS target_stock,
                COALESCE(auto_tank.current_stock, 0) as tank_start,
                COALESCE(auto_tank.yesterday_stock, 0) as tank_end,
                COALESCE(auto_sales.sale_previous, 0) as day_sales,
                (COALESCE(auto_sales.sale_previous, 0) + COALESCE(auto_tank.tnk_deadstock, tbl_petrol_tank.tnk_deadstock, 0)) as min_stock,
                tbl_order_item.remark,
                tbl_depot.dpo_code, tbl_depot.dpo_desc, tbl_depot.dpo_short_desc
            FROM tbl_order_item
            LEFT JOIN tbl_item ON tbl_order_item.item_no = tbl_item.itm_code
            LEFT JOIN tbl_depot ON tbl_order_item.deli_plant = tbl_depot.dpo_code AND tbl_depot.dpo_flag = '1'
            LEFT JOIN tbl_order ON tbl_order_item.order_no = tbl_order.id
            LEFT JOIN tbl_petrol ON tbl_order.ship_to = tbl_petrol.ptrl_number
            INNER JOIN tbl_petrol_tank ON tbl_order_item.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code 
                AND tbl_petrol_tank.ptrl_tank_flag = '1'
            LEFT JOIN (
                SELECT 
                    ptrl_code, 
                    tank_code,
                    MAX(tnk_capacity) as tnk_capacity,
                    MAX(tnk_deadstock) as tnk_deadstock,
                    MAX(CASE WHEN stock_at::date = '${moment(orderData.ist_dt).format("YYYY-MM-DD")}'::date - INTERVAL '1 day' THEN stock END) as current_stock,
                    MAX(CASE WHEN stock_at::date = '${moment(orderData.ist_dt).format("YYYY-MM-DD")}'::date - INTERVAL '2 day' THEN stock END) as yesterday_stock
                FROM tbl_automatics_tanks_information
                GROUP BY ptrl_code, tank_code
            ) auto_tank ON tbl_petrol.ptrl_code = auto_tank.ptrl_code 
                 AND tbl_petrol_tank.ptrl_tank_code = auto_tank.tank_code
             LEFT JOIN (
                SELECT ptrl_code, tank_code, MAX(sale_previous) as sale_previous,
                MAX(case when sale_at_previous::date = '${moment(orderData.ist_dt).format('YYYY-MM-DD')}'::date - INTERVAL '1 day' THEN sale_previous END),
                MAX(case when sale_at_previous::date = '${moment(orderData.ist_dt).format('YYYY-MM-DD')}'::date - INTERVAL '2 day' THEN sale_previous END)
                FROM tbl_automatics_sales_previous_information
                GROUP BY ptrl_code, tank_code
            ) auto_sales ON tbl_petrol.ptrl_code = auto_sales.ptrl_code AND tbl_petrol_tank.ptrl_tank_code = auto_sales.tank_code
            WHERE CAST(tbl_order_item.order_no AS TEXT) = '${id}'
            AND tbl_order_item.order_item_flag = '1'
            AND tbl_order_item.rm_dt IS NULL
        )
        UNION ALL
        (
            SELECT 
                NULL as id, 
                '${id}' as order_no, 
                tpt.itm_code as item_no,
                tpt.ptrl_tank_code,
                tpt.tnk_number as tank_number,
                COALESCE(auto_tank.tnk_capacity::text, tpt.tnk_capacity::text) as tank_capacity,
                0 as item_qty,
                NULL as deli_plant, 
                NULL as long_text_id, 
                NULL as long_text,
                NULL as sales_order_item, 
                0 as auto_order,
                NULL as sd_reject_reason, 
                NULL as sd_process_status, 
                NULL as deli_status, 
                NULL as misc_deli_no,
                NULL as ist_dt, 
                NULL as mdf_dt,
                itm.itm_desc as product, itm.itm_material_number, itm.itm_code,
                COALESCE(auto_tank.tnk_deadstock, tpt.tnk_deadstock) AS un_pump,
                COALESCE(auto_tank.tnk_capacity, tpt.tnk_capacity) AS max_stock,
                tpt.tnk_target AS target_stock,
                COALESCE(auto_tank.current_stock, 0) as tank_start,
                COALESCE(auto_tank.yesterday_stock, 0) as tank_end,
                COALESCE(auto_sales.sale_previous, 0) as day_sales,
                (COALESCE(auto_sales.sale_previous, 0) + COALESCE(auto_tank.tnk_deadstock, tpt.tnk_deadstock, 0)) as min_stock,
                NULL as remark,
                NULL as dpo_code, NULL as dpo_desc, NULL as dpo_short_desc
            FROM tbl_petrol_tank tpt
            LEFT JOIN tbl_item itm ON tpt.itm_code = itm.itm_code
            LEFT JOIN (
                SELECT 
                    ptrl_code, 
                    tank_code,
                    MAX(tnk_capacity) as tnk_capacity,
                    MAX(tnk_deadstock) as tnk_deadstock,
                    MAX(CASE WHEN stock_at::date = '${moment(orderData.ist_dt).format("YYYY-MM-DD")}'::date - INTERVAL '1 day' THEN stock END) as current_stock,
                    MAX(CASE WHEN stock_at::date = '${moment(orderData.ist_dt).format("YYYY-MM-DD")}'::date - INTERVAL '2 day' THEN stock END) as yesterday_stock
                FROM tbl_automatics_tanks_information
                GROUP BY ptrl_code, tank_code
            ) auto_tank ON tpt.ptrl_code = auto_tank.ptrl_code 
                 AND tpt.ptrl_tank_code = auto_tank.tank_code
             LEFT JOIN (
                SELECT ptrl_code, tank_code, MAX(sale_previous) as sale_previous,
                MAX(case when sale_at_previous::date = '${moment(orderData.ist_dt).format('YYYY-MM-DD')}'::date - INTERVAL '1 day' THEN sale_previous END),
                MAX(case when sale_at_previous::date = '${moment(orderData.ist_dt).format('YYYY-MM-DD')}'::date - INTERVAL '2 day' THEN sale_previous END)
                FROM tbl_automatics_sales_previous_information
                GROUP BY ptrl_code, tank_code
            ) auto_sales ON tpt.ptrl_code = auto_sales.ptrl_code AND tpt.ptrl_tank_code = auto_sales.tank_code
            WHERE tpt.ptrl_code = '${orderData.ptrl_code}' 
              AND tpt.ptrl_tank_flag = '1'
              AND tpt.rm_dt IS NULL
              AND tpt.ptrl_tank_code NOT IN (SELECT ptrl_tank_code FROM tbl_order_item WHERE CAST(order_no AS TEXT) = '${id}' AND rm_dt IS NULL AND ptrl_tank_code IS NOT NULL)
        )
        ORDER BY item_qty DESC`;

    console.log('itemScript', itemScript)

    // ======== ยิง Query เพื่อดึงรายการสินค้า (Items) และจัดการข้อมูล null ========
    let itemResult = await pgConn.get(
      dbPrefix + lic_code,
      itemScript,
      config.connectionString(),
    );
    let orderItems = [];
    if (!itemResult.code && itemResult.data.length > 0) {
      orderItems = JSON.parse(
        JSON.stringify(itemResult.data).replace(/\:null/gi, '\:""'),
      );
    }

    // ======== ส่ง Response กลับไปให้ Client ========
    let response = [
      {
        status: "success",
        invalid_code: "0",
        message: "",
        data: orderData,
        order_items: orderItems,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
      },
    ];

    res.status(200).send(response);
    return;
  })().catch(async (err) => {
    console.log(err);
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

// =========== ดึงข้อมูลรายละเอียดของออเดอร์ตาม ID ที่ระบุ ========
// exports.getOrderInformationByIDBackup = async (req, res, next) => {
//   var xresult = [];
//   // let date_at = moment().subtract(1, "days").format("YYYY-MM-DD");
//   let date_at = moment().format("YYYY-MM-DD");
//   return (async () => {
//     let lic_code = req.header("lic_code");
//     let { id, action } = req.body[0];

//     // ======== ตรวจสอบว่ามีการส่งพารามิเตอร์ที่จำเป็น ========
//     if (id == undefined || action == undefined) {
//       let response = [
//         {
//           status: "error",
//           invalid_code: "-1",
//           message:
//             "ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
//           data: xresult,
//           response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
//         },
//       ];
//       res.status(200).send(response);
//       return;
//     }

//     // ======== คำสั่ง SQL สำหรับดึงข้อมูลของออเดอร์ และ Join ข้อมูลพื้นฐานที่เกี่ยวข้อง ========
//     let orderScript = `SELECT 
//                 tbl_order.id, tbl_order.order_no, tbl_order.sh_cus_ref as aos_order_no, tbl_order.order_type, tbl_order.order_group, 
//                 tbl_order_type.ord_type_desc,
//                 tbl_petrol_group.ptrl_group_desc,
//                 tbl_order.order_status,
//                 tbl_order.chanel, tbl_order.division, tbl_order.sold_to, tbl_order.ship_to, 
//                 tbl_petrol.ptrl_desc as station, tbl_petrol.ptrl_code, tbl_petrol.ptrl_number, tbl_petrol.ptrl_sitecode,
//                 tbl_order.cus_ref, tbl_order.cus_date_ref, tbl_order.po_name, tbl_order.order_by, 
//                 tbl_order.ship_cond, tbl_order.pay_term, tbl_order.deli_date_req as request_date, tbl_master_time.time_value as RequestTime, 
//                 tbl_order.description, tbl_order.sh_cus_date_ref, 
//                 tbl_order.status_deli, tbl_order.status_block, tbl_order.status_sd_process, 
//                 tbl_order.status_check, tbl_order.sd_doc_reject, tbl_order.cus_group, 
//                 tbl_order.hana_created, tbl_order.hana_time, tbl_order.created_by, 
//                 tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt,
//                 tbl_order.auto_order,
//                 tbl_petrol.ptrl_address,
//                 tbl_petrol.ptrl_zip_code
//             FROM tbl_order  

//             LEFT JOIN tbl_order_type ON tbl_order.order_type = tbl_order_type.ord_type_code
//             LEFT JOIN tbl_petrol_group ON tbl_petrol_group.ptrl_group_code = tbl_order.order_group
//             LEFT JOIN tbl_petrol ON tbl_order.ship_to = tbl_petrol.ptrl_number
//             LEFT JOIN tbl_master_time ON tbl_order.deli_time_req = tbl_master_time.time_code
//             WHERE tbl_order.rm_dt IS NULL AND tbl_order.id = ${id}`;

//     let orderResult = await pgConn.get(
//       dbPrefix + lic_code,
//       orderScript,
//       config.connectionString(),
//     );

//     // ======== จัดการกรณีเกิดข้อผิดพลาดในการรัน Query ========
//     if (orderResult.code) {
//       let response = [
//         {
//           status: "error",
//           invalid_code: "-3",
//           message: "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
//           data: xresult,
//           response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
//         },
//       ];
//       res.status(200).send(response);
//       return;
//     }

//     // ======== จัดการกรณี Query สำเร็จ แต่ไม่พบข้อมูลออเดอร์ตาม ID ที่ส่งมา ========
//     if (orderResult.data.length === 0) {
//       let response = [
//         {
//           status: "success",
//           invalid_code: "0",
//           message: "ไม่พบข้อมูล Order",
//           data: xresult,
//           response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
//         },
//       ];
//       res.status(200).send(response);
//       return;
//     }

//     // ======== แปลงข้อมูล null ให้เป็นค่าว่าง (String ว่าง) ========
//     let orderData = JSON.parse(
//       JSON.stringify(orderResult.data[0]).replace(/\:null/gi, '\:""'),
//     );

//     // ======== คำสั่ง SQL สำหรับดึงรายการสินค้า (Items) ที่อยู่ในออเดอร์นี้ ========
//     let itemScript = `SELECT 
//                 tbl_order_item.id, tbl_order_item.order_no, tbl_order_item.item_no,
//                 tbl_order_item.ptrl_tank_code,
//                 tbl_petrol_tank.tnk_number as tank_number,
//                 tbl_petrol_tank.tnk_capacity as tank_capacity,
//                 tbl_order_item.item_qty, tbl_order_item.deli_plant, 
//                 tbl_order_item.long_text_id, tbl_order_item.long_text,
//                 tbl_order_item.sales_order_item, tbl_order_item.auto_order,
//                 tbl_order_item.sd_reject_reason, tbl_order_item.sd_process_status, 
//                 tbl_order_item.deli_status, tbl_order_item.misc_deli_no,
//                 tbl_order_item.ist_dt, tbl_order_item.mdf_dt,
//                 tbl_item.itm_desc as product, tbl_item.itm_material_number, tbl_item.itm_code,
//                 tbl_petrol_tank.tnk_deadstock AS un_pump,
//                 tbl_petrol_tank.tnk_capacity AS max_stock,
//                 tbl_petrol_tank.tnk_target AS target_stock,
//                 tank.tank_start,
//                 tank.tank_end,
//                 meter_summary.total_sales,
//                 meter_summary.total_sales + tbl_petrol_tank.tnk_deadstock AS min_stock,
//                 tank.recive_val::INT,
//                 tbl_order_item.remark,
//                 tbl_depot.dpo_code, tbl_depot.dpo_desc, tbl_depot.dpo_short_desc
//             FROM tbl_order_item
//             LEFT JOIN tbl_item ON tbl_order_item.item_no = tbl_item.itm_code
//             LEFT JOIN tbl_depot ON tbl_order_item.deli_plant = tbl_depot.dpo_code AND tbl_depot.dpo_flag = '1'
//           INNER JOIN tbl_petrol_tank ON tbl_order_item.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code 
//                 AND tbl_petrol_tank.ptrl_tank_flag = '1'

//             LEFT JOIN tbl_order_eodtank tank ON (
//                 tbl_petrol_tank.tnk_number = tank.tank_no 
//                 AND tank.shipto_no = '${orderData.ptrl_sitecode || orderData.ptrl_number}'
//                 AND tank.date_at = '${date_at}'
//             )
//             LEFT JOIN (
//                 SELECT 
//                     tank_no,
//                     product_name,
//                     shipto_no,
//                     buy_date,
//                     SUM(meter_diff) AS total_sales
//                 FROM (
//                     SELECT DISTINCT ON (product_name, shipto_no, tank_no, buy_date, meter_start)
//                         product_name,
//                         shipto_no,
//                         tank_no,
//                         buy_date,
//                         (meter_end - meter_start) AS meter_diff
//                     FROM tbl_order_eodmeter
//                     WHERE buy_date = '${date_at}'
//                     AND shipto_no = '${orderData.ptrl_sitecode || orderData.ptrl_number}'
//                     ORDER BY product_name, shipto_no, tank_no, buy_date, meter_start, id DESC
//                 ) AS latest_meters
//                 GROUP BY product_name, tank_no, shipto_no, buy_date
//             ) meter_summary ON (
//                 tbl_petrol_tank.tnk_number = meter_summary.tank_no 
//                 AND meter_summary.shipto_no = '${orderData.ptrl_number}'
//             )
//             WHERE CAST(tbl_order_item.order_no AS TEXT) = '${id}'
//             AND tbl_order_item.order_item_flag = '1'
//             ORDER BY tbl_order_item.ptrl_tank_code ASC`;

//     // ======== ยิง Query เพื่อดึงรายการสินค้า (Items) และจัดการข้อมูล null ========
//     let itemResult = await pgConn.get(
//       dbPrefix + lic_code,
//       itemScript,
//       config.connectionString(),
//     );
//     let orderItems = [];
//     if (!itemResult.code && itemResult.data.length > 0) {
//       orderItems = JSON.parse(
//         JSON.stringify(itemResult.data).replace(/\:null/gi, '\:""'),
//       );
//     }

//     // ======== ส่ง Response กลับไปให้ Client ========
//     let response = [
//       {
//         status: "success",
//         invalid_code: "0",
//         message: "",
//         data: orderData,
//         order_items: orderItems,
//         response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
//       },
//     ];

//     res.status(200).send(response);
//     return;
//   })().catch(async (err) => {
//     console.log(err);
//     let response = [
//       {
//         status: "error",
//         invalid_code: "-4",
//         message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
//         data: xresult,
//         response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
//       },
//     ];
//     res.status(200).send(response);
//   });
// };

// =========== ดึงข้อมูลรายงานการสั่งซื้อ ===========
exports.getOrderReportInformation = async (req, res, next) => {
  var xresult = [];
  return (async () => {
    let lic_code = req.header("lic_code");
    let {
      order_no,
      start_date,
      end_date,
      order_type,
      order_status,
      auto_order,
      status_deli,
      ptrl_group_code,
      ptrl_number,
      search,
      page_index,
      page_limit,
      action,
    } = req.body[0];

    page_index = page_index === undefined ? 1 : page_index;
    page_limit = page_limit === undefined ? 10 : page_limit;
    auto_order =
      auto_order === undefined || auto_order === "" ? "0" : auto_order;
    status_deli = status_deli === undefined ? "ALL" : status_deli;
    order_status = order_status === undefined ? "ALL" : order_status;
    ptrl_group_code = ptrl_group_code === undefined ? "ALL" : ptrl_group_code;
    ptrl_number = ptrl_number === undefined ? "ALL" : ptrl_number;
    // ========== เช็คเฉพาะส่วนที่สำคัญ ==========
    if (
      start_date === undefined ||
      end_date === undefined ||
      order_type === undefined ||
      order_status === undefined ||
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

    // ========== เตรียมข้อมูลสำหรับ Query และ Format Dates ==========
    if (page_index > 0) page_index -= 1;

    let original_start_date = start_date;
    let original_end_date = end_date;

    if (start_date.length === 10) start_date += " 00:00:00";
    if (end_date.length === 10) end_date += " 23:59:59";

    // =========================================================
    // 1. จัดการเงื่อนไข WHERE แบบรวมศูนย์ (Dynamic Conditions)
    // =========================================================
    let conditions = ["tbl_order.rm_dt IS NULL", "tbl_order.order_flag = '1'"];

    if (
      order_no.toString().toUpperCase() !== "ALL" &&
      order_no.toString().toUpperCase() !== ""
    ) {
      conditions.push(`tbl_order.order_no = '${order_no}'`);
    }
    if (
      status_deli.toString().toUpperCase() !== "ALL" &&
      status_deli.toString().toUpperCase() !== ""
    ) {
      conditions.push(`tbl_order.status_deli = '${status_deli}'`);
    }
    if (
      order_type.toString().toUpperCase() !== "ALL" &&
      order_type.toString().toUpperCase() !== ""
    ) {
      conditions.push(`tbl_order.order_type = '${order_type}'`);
    }
    if (
      auto_order.toString().toUpperCase() !== "ALL" &&
      auto_order.toString().toUpperCase() !== ""
    ) {
      conditions.push(`tbl_order.auto_order = '${auto_order}'`);
    }
    if (
      order_status.toString().toUpperCase() !== "ALL" &&
      order_status.toString().toUpperCase() !== ""
    ) {
      conditions.push(`tbl_order.order_status = '${order_status}'`);
    }

    if (
      ptrl_number !== undefined &&
      ptrl_number.toString().toUpperCase() !== "ALL"
    ) {
      conditions.push(`tbl_order.ship_to = '${ptrl_number}'`);
    }

    if (
      ptrl_group_code !== undefined &&
      ptrl_group_code.toString().toUpperCase() !== "ALL"
    ) {
      conditions.push(`tbl_petrol.ptrl_group_code = '${ptrl_group_code}'`);
    }

    if (search !== "" && search !== undefined && search !== null) {
      conditions.push(`(
                tbl_order.order_no LIKE '%${search}%' 
                OR tbl_order.sold_to LIKE '%${search}%' 
                OR tbl_order.ship_to LIKE '%${search}%' 
                OR tbl_order.po_name LIKE '%${search}%' 
                OR tbl_order.description LIKE '%${search}%'
            )`);
    }
    if (
      original_start_date.toString().toUpperCase() !== "ALL" &&
      original_end_date.toString().toUpperCase() !== "ALL"
    ) {
      conditions.push(
        `tbl_order.ist_dt >= '${start_date}' AND tbl_order.ist_dt <= '${end_date}'`,
      );
    }

    let act_val = action[0].value.toString().toUpperCase();
    let act_id = action[0].id;

    if (act_val === "GROUP") {
      // สิทธิ์ GROUP (เช่น Planner/CS): มองเห็นเฉพาะ Order ของปั๊มที่อยู่ในความดูแลของตัวเอง
      conditions.push(
        `tbl_petrol.ptrl_group_code IN (SELECT ptrl_group_code FROM tbl_employee_petrol_group WHERE emp_code = '${act_id}' AND emp_pgrp_flag = 1)`,
      );
      conditions.push(`tbl_petrol.ptrl_flag = '1'`);
    } else if (act_val !== "ALL") {
      // สิทธิ์พนักงานทั่วไป: มองเห็นเฉพาะ Order ที่ตัวเองเป็นคนสร้าง
      conditions.push(`tbl_order.created_by_tms = '${act_id}'`);
    }

    // รวมเงื่อนไขทั้งหมดเข้าด้วยกัน
    let whereClause = "WHERE " + conditions.join(" AND ");

    // =========================================================================
    // [SUMMARY 1] คำนวณยอดรวมของ Manual Order (auto_order = '0')
    // =========================================================================
    let total_manual_order = 0;
    let countManualOrderScript = `
            SELECT COUNT(DISTINCT tbl_order.id) AS total_manual_order 
            FROM tbl_order 
            LEFT JOIN tbl_petrol ON tbl_order.ship_to = tbl_petrol.ptrl_number
            ${whereClause} AND tbl_order.auto_order = '0';
        `;
    let tbl_count_manual = await pgConn.get(
      dbPrefix + lic_code,
      countManualOrderScript,
      config.connectionString(),
    );
    if (
      !tbl_count_manual.code &&
      tbl_count_manual.data &&
      tbl_count_manual.data.length > 0
    ) {
      total_manual_order =
        parseInt(tbl_count_manual.data[0].total_manual_order) || 0;
    }

    let top_remark = "-";
    let topRemarkScript = `
            SELECT item.remark, COUNT(*) AS remark_count 
            FROM tbl_order 
            INNER JOIN tbl_order_item item ON CAST(tbl_order.id AS TEXT) = CAST(item.order_no AS TEXT)
            LEFT JOIN tbl_petrol ON tbl_order.ship_to = tbl_petrol.ptrl_number
            ${whereClause} 
            AND item.rm_dt IS NULL 
            AND item.remark IS NOT NULL 
            AND TRIM(item.remark) <> '' 
            GROUP BY item.remark 
            ORDER BY remark_count DESC 
            LIMIT 1;
        `;
    let tbl_top_remark = await pgConn.get(
      dbPrefix + lic_code,
      topRemarkScript,
      config.connectionString(),
    );
    if (
      !tbl_top_remark.code &&
      tbl_top_remark.data &&
      tbl_top_remark.data.length > 0
    ) {
      top_remark = tbl_top_remark.data[0].remark;
    }

    let top_sum_qty = 0;
    let topSumQtyScript = `
            SELECT SUM(CAST(item.item_qty AS numeric)) AS sum_qty 
            FROM tbl_order 
            INNER JOIN tbl_order_item item ON CAST(tbl_order.id AS TEXT) = CAST(item.order_no AS TEXT)
            LEFT JOIN tbl_petrol ON tbl_order.ship_to = tbl_petrol.ptrl_number
            ${whereClause} 
            AND item.rm_dt IS NULL;
        `;
    let tbl_top_sum_qty = await pgConn.get(
      dbPrefix + lic_code,
      topSumQtyScript,
      config.connectionString(),
    );
    if (
      !tbl_top_sum_qty.code &&
      tbl_top_sum_qty.data &&
      tbl_top_sum_qty.data.length > 0
    ) {
      top_sum_qty = parseFloat(tbl_top_sum_qty.data[0].sum_qty) || 0;
    }

    let top_orderer = "-";
    let topOrdererScript = `
            SELECT tbl_order.created_by_tms, tbl_employee.emp_name, tbl_employee_role.emp_role_desc, MAX(tbl_order.ist_dt) as latest_order
            FROM tbl_order 
            LEFT JOIN tbl_employee ON tbl_order.created_by_tms = tbl_employee.emp_code
            LEFT JOIN tbl_employee_role ON tbl_employee.emp_role_code = tbl_employee_role.emp_role_code
            LEFT JOIN tbl_petrol ON tbl_order.ship_to = tbl_petrol.ptrl_number
            ${whereClause}
            AND tbl_order.created_by_tms IS NOT NULL 
            AND TRIM(tbl_order.created_by_tms) <> '' 
            GROUP BY tbl_order.created_by_tms, tbl_employee.emp_name, tbl_employee_role.emp_role_desc
            ORDER BY latest_order DESC 
            LIMIT 1;
        `;
    let tbl_top_orderer = await pgConn.get(
      dbPrefix + lic_code,
      topOrdererScript,
      config.connectionString(),
    );
    if (
      !tbl_top_orderer.code &&
      tbl_top_orderer.data &&
      tbl_top_orderer.data.length > 0
    ) {
      let Orderer_name = tbl_top_orderer.data[0].emp_role_desc;
      let code = tbl_top_orderer.data[0].created_by_tms;
      top_orderer = Orderer_name ? Orderer_name : code;
    }

    // =========================================================
    // 2. Query ดึงข้อมูลหลัก (Main Script)
    // =========================================================
    let baseSelectQuery = `
            SELECT 
            tbl_order.id, tbl_order.order_no, tbl_order.sh_cus_ref as aos_order_no, 
            tbl_order.order_type, tbl_order.order_group, 
            tbl_order_type.ord_type_desc, tbl_petrol_group.ptrl_group_desc, tbl_order.order_status,
            tbl_order.chanel, tbl_order.division, tbl_order.sold_to, tbl_order.ship_to, 
            tbl_petrol.ptrl_desc as station, tbl_order.cus_ref, tbl_order.cus_date_ref, tbl_order.po_name, tbl_order.order_by, 
            tbl_order.ship_cond, tbl_order.pay_term, tbl_order.deli_date_req as request_date, tbl_master_time.time_value as requesttime, 
            tbl_order.description, tbl_order.sh_cus_date_ref, tbl_order.status_deli, tbl_order.status_block, tbl_order.status_sd_process, 
            tbl_order.status_check, tbl_order.sd_doc_reject, tbl_order.cus_group, 
            tbl_order.hana_created, tbl_order.hana_time, tbl_order.created_by, 
            tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt,
            json_build_array(json_build_object(
                'id', tbl_order_item.id,
                'sales_order_item', tbl_order_item.sales_order_item,
                'itm_code', tbl_item.itm_code,
                'tnk_number', tbl_petrol_tank.tnk_number,
                'petrol_desc', tbl_petrol.ptrl_desc,
                'itm_material_number', tbl_item.itm_material_number,
                'product', tbl_item.itm_desc,
                'item_qty', tbl_order_item.item_qty,
                'long_text_id', tbl_order_item.long_text_id,
                'long_text', tbl_order_item.long_text,
                'auto_order', tbl_order_item.auto_order ,
                'remark', tbl_order_item.remark
            )) as item_information,
            tbl_order.auto_order,
            tbl_order_item.remark,
            tbl_employee_role.emp_role_desc
            FROM tbl_order  
            INNER JOIN tbl_order_item ON CAST(tbl_order.id AS TEXT) = CAST(tbl_order_item.order_no AS TEXT) 
            LEFT JOIN tbl_order_type ON tbl_order.order_type = tbl_order_type.ord_type_code
            LEFT JOIN tbl_item ON tbl_order_item.item_no = tbl_item.itm_code
            LEFT JOIN tbl_petrol ON tbl_order.ship_to = tbl_petrol.ptrl_number
            LEFT JOIN tbl_petrol_group ON tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code
            LEFT JOIN tbl_master_time ON tbl_order.deli_time_req = tbl_master_time.time_code
            LEFT JOIN tbl_employee ON tbl_order.created_by_tms = tbl_employee.emp_code
            LEFT JOIN tbl_employee_role ON tbl_employee.emp_role_code = tbl_employee_role.emp_role_code
            LEFT JOIN (
                SELECT ptrl_code, itm_code, string_agg(tnk_number, ', ') as tnk_number 
                FROM tbl_petrol_tank 
                WHERE rm_dt IS NULL GROUP BY ptrl_code, itm_code
            ) tbl_petrol_tank ON tbl_item.itm_code = tbl_petrol_tank.itm_code AND tbl_petrol.ptrl_code = tbl_petrol_tank.ptrl_code
            WHERE tbl_order_item.rm_dt IS NULL
        `;

    // ประกอบร่าง Script หลัก
    let script = `
            ${baseSelectQuery}
            AND ${whereClause.replace("WHERE", "")}
            ORDER BY tbl_order.ist_dt DESC 
            OFFSET (${page_index} * ${page_limit}) LIMIT ${page_limit};
        `;

    let tbl_temporary = await pgConn.get(
      dbPrefix + lic_code,
      script,
      config.connectionString(),
    );

    if (!tbl_temporary.code) {
      if (tbl_temporary.data.length > 0) {
        tbl_temporary.data = JSON.parse(
          JSON.stringify(tbl_temporary.data).replace(/\:null/gi, '\:""'),
        );

        // =========================================================
        //              Query หาจำนวนแถวทั้งหมด (Count Rows)
        // =========================================================
        let countScript = `
                    SELECT CEIL((COUNT(*)::numeric / ${page_limit})) as page_total, COUNT(*) as rows_total  
                    FROM tbl_order
                    INNER JOIN tbl_order_item ON CAST(tbl_order.id AS TEXT) = CAST(tbl_order_item.order_no AS TEXT)
                    LEFT JOIN tbl_petrol ON tbl_order.ship_to = tbl_petrol.ptrl_number
                    ${whereClause} AND tbl_order_item.rm_dt IS NULL;
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

        let response = [
          {
            status: "success",
            invalid_code: "0",
            message: "",
            data: tbl_temporary.data,
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
            page_total: page_total <= 0 ? 1 : page_total,
            rows_total: rows_total,
            summary: {
              total_manual_order: total_manual_order,
              top_remark: top_remark,
              top_orderer: top_orderer,
              top_sum_qty: top_sum_qty,
            },
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
            summary: {
              total_manual_order: total_manual_order,
              top_remark: top_remark,
              top_orderer: top_orderer,
              top_sum_qty: top_sum_qty,
            },
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
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "ดึงข้อมูล Order Report",
        JSON.stringify(req.body[0]),
        "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        action[0].value,
      );
      return;
    }
  })().catch(async (err) => {
    console.log(err);
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

// =========== ดึงข้อมูลรายการสั่งซื้อ Order Log ===========
exports.getLoggingOrderInformation = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let {
      action_desc,
      page_index,
      page_limit,
      start_date,
      end_date,
      search,
      role,
      ptrl_group_code,
      action,
    } = req.body[0];

    page_index = page_index == undefined ? 1 : page_index;
    page_limit = page_limit == undefined ? 10 : page_limit;

    // =========================================================
    //          ตรวจสอบความถูกต้องของพารามิเตอร์เบื้องต้น
    // =========================================================
    if (action_desc == undefined || action == undefined) {
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

    let script = ``;
    if (page_index > 0) {
      page_index -= 1;
    }

    // =========================================================
    //             จัดการรูปแบบวันที่ (Date Formatting)
    // =========================================================
    if (start_date && start_date.length === 10) start_date += " 00:00:00";
    if (end_date && end_date.length === 10) end_date += " 23:59:59";

    // =========================================================
    //      จัดการเงื่อนไข WHERE แบบรวมศูนย์ (Dynamic Conditions)
    // =========================================================
    let conditions = ["tbl_action_logs.rm_dt IS NULL"];

    if (action_desc && action_desc.toString().toLowerCase() != "all") {
      action_desc = action_desc.toString().toLowerCase();
      conditions.push(`tbl_action_logs.action_desc = '${action_desc}'`);
    } else {
      conditions.push(
        `tbl_action_logs.action_desc IN ('override', 'manual', 'cancel', 'cancel_order_sap')`,
      );
    }

    if (start_date)
      conditions.push(`tbl_action_logs.ist_dt >= '${start_date}'`);
    if (end_date) conditions.push(`tbl_action_logs.ist_dt <= '${end_date}'`);

    // =========================================================
    //                ระบบกรองตาม Role (Role Filter)
    // =========================================================
    if (role && role !== "ALL") {
      conditions.push(`tbl_employee.emp_role_code = '${role}'`);
    }

    // =========================================================
    //             ระบบกรองตามกลุ่มปั๊ม (Station Group)
    // =========================================================
    if (ptrl_group_code && ptrl_group_code !== "ALL") {
      conditions.push(`tbl_petrol.ptrl_group_code = '${ptrl_group_code}'`);
    }

    // =========================================================
    //              ระบบค้นหา (Search Engine Logic)
    // =========================================================
    if (search) {
      conditions.push(`(
                tbl_action_logs.action_body::text ILIKE '%${search}%'
                OR EXISTS (
                    SELECT 1 FROM tbl_petrol 
                    WHERE ptrl_number = COALESCE(tbl_action_logs.action_body::json->'body'->>'ship_to', tbl_action_logs.action_body::json->>'ship_to')
                    AND ptrl_desc ILIKE '%${search}%'
                )
            )`);
    }

    let whereClause = "WHERE " + conditions.join(" AND ");

    let summary = {
      manual: 0,
      override: 0,
      cancel: 0,
      total_logs: 0,
    };

    // =========================================================
    //       สร้างเงื่อนไขจำเพาะสำหรับส่วนสรุป (Summary Filter)
    // =========================================================
    let summaryFilter = ``;
    if (start_date)
      summaryFilter += ` AND tbl_action_logs.ist_dt >= '${start_date}'`;
    if (end_date)
      summaryFilter += ` AND tbl_action_logs.ist_dt <= '${end_date}'`;
    if (role && role !== "ALL")
      summaryFilter += ` AND emp_role_code = '${role}'`;
    if (ptrl_group_code && ptrl_group_code !== "ALL")
      summaryFilter += ` AND tbl_petrol.ptrl_group_code = '${ptrl_group_code}'`;

    if (search) {
      summaryFilter += ` AND (
                tbl_action_logs.action_body::text ILIKE '%${search}%'
                OR EXISTS (
                    SELECT 1 FROM tbl_petrol subp 
                    WHERE subp.ptrl_number = COALESCE(tbl_action_logs.action_body::json->'body'->>'ship_to', tbl_action_logs.action_body::json->>'ship_to')
                    AND subp.ptrl_desc ILIKE '%${search}%'
                )
            )`;
    }

    // =========================================================
    //      คำนวณสรุปแยกประเภทตามเงื่อนไข (Summary Aggregation)
    // =========================================================
    let summaryScript = `
            SELECT 
                COUNT(*) FILTER (WHERE LOWER(tbl_action_logs.action_desc) = 'manual' ${summaryFilter}) as manual_count,
                COUNT(*) FILTER (WHERE LOWER(tbl_action_logs.action_desc) = 'override' ${summaryFilter}) as override_count,
                COUNT(*) FILTER (WHERE LOWER(tbl_action_logs.action_desc) IN ('cancel', 'cancel_order_sap') ${summaryFilter}) as cancel_count,
                COUNT(*) FILTER (WHERE LOWER(tbl_action_logs.action_desc) IN ('manual', 'override', 'cancel', 'cancel_order_sap')) as total_count
            FROM tbl_action_logs 
            LEFT JOIN tbl_employee ON tbl_action_logs.action_code = tbl_employee.emp_code
            LEFT JOIN tbl_petrol ON COALESCE(tbl_action_logs.action_body::json->'body'->>'ship_to', tbl_action_logs.action_body::json->>'ship_to') = tbl_petrol.ptrl_number
            WHERE tbl_action_logs.rm_dt IS NULL;
        `;
    let tbl_summary = await pgConn.get(
      dbPrefix + lic_code,
      summaryScript,
      config.connectionString(),
    );
    if (!tbl_summary.code && tbl_summary.data && tbl_summary.data.length > 0) {
      summary.manual = parseInt(tbl_summary.data[0].manual_count) || 0;
      summary.override = parseInt(tbl_summary.data[0].override_count) || 0;
      summary.cancel = parseInt(tbl_summary.data[0].cancel_count) || 0;
      summary.total_logs = parseInt(tbl_summary.data[0].total_count) || 0;
    }

    // =========================================================
    //             ดึงข้อมูล Audit Logs หลัก (Main Query)
    // =========================================================
    script = `SELECT 
            tbl_employee.emp_name || ' / ' || tbl_employee_role.emp_role_desc as action_by,
            tbl_action_logs.action_desc as event_type,
            tbl_action_logs.action_body,
            tbl_action_logs.ist_dt as action_date,
            tbl_petrol_group.ptrl_group_desc as station_group,
            tbl_order.order_no
            FROM tbl_action_logs 
            LEFT JOIN tbl_employee ON tbl_action_logs.action_code = tbl_employee.emp_code
            LEFT JOIN tbl_employee_role ON tbl_employee.emp_role_code = tbl_employee_role.emp_role_code
            LEFT JOIN tbl_petrol ON COALESCE(tbl_action_logs.action_body::json->'body'->>'ship_to', tbl_action_logs.action_body::json->>'ship_to') = tbl_petrol.ptrl_number
            LEFT JOIN tbl_petrol_group ON tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code
            LEFT JOIN tbl_order ON tbl_order.id::text = COALESCE(
                tbl_action_logs.action_body::json->>'order_id', 
                tbl_action_logs.action_body::json->'body'->>'order_id',
                tbl_action_logs.action_body::json->>'id'
            )
            
            ${whereClause}
            ORDER BY tbl_action_logs.ist_dt DESC 
            OFFSET (${page_index}*${page_limit}) LIMIT ${page_limit};`;

    let mainLogResult = await pgConn.get(
      dbPrefix + lic_code,
      script,
      config.connectionString(),
    );

    if (!mainLogResult.code && mainLogResult.data) {
      if (mainLogResult.data.length > 0) {
        // =========================================================
        //      จัดฟอร์แมตข้อมูลและดึงรายชื่อ Ship-To ทั้งหมด
        // =========================================================
        let { processedData, allShipTos } = xglobal.formatAuditLogs(
          mainLogResult.data,
        );

        // =========================================================
        //         ดึงชื่อปั๊มทั้งหมดแบบรวมศูนย์ (Batch Station Query)
        // =========================================================
        if (allShipTos.size > 0) {
          let shipToArr = Array.from(allShipTos)
            .map((s) => `'${s}'`)
            .join(", ");
          let stationScript = `SELECT ptrl_number, ptrl_desc FROM tbl_petrol WHERE ptrl_number IN (${shipToArr})`;
          let stationTemp = await pgConn.get(
            dbPrefix + lic_code,
            stationScript,
            config.connectionString(),
          );

          if (!stationTemp.code && stationTemp.data.length > 0) {
            let stationDataMap = {};
            stationTemp.data.forEach((row) => {
              stationDataMap[row.ptrl_number] = row.ptrl_desc;
            });

            // จับคู่ชื่อสถานีกลับเข้ากับรายการข้อมูล
            processedData.forEach((item) => {
              if (item.ship_to && stationDataMap[item.ship_to]) {
                item.station_name = stationDataMap[item.ship_to];
              }
            });
          }
        }

        mainLogResult.data = processedData;

        // =========================================================
        //     นับจำนวนแถวและหน้าทั้งหมด (Pagination Calculation)
        // =========================================================
        let page_total = 1;
        let rows_total = 0;

        let countScript = `
                    SELECT 
                        CEIL(COUNT(*)::float / ${page_limit}) as page_total, 
                        COUNT(*) as rows_total  
                    FROM tbl_action_logs 
                    LEFT JOIN tbl_employee ON tbl_action_logs.action_code = tbl_employee.emp_code
                    LEFT JOIN tbl_petrol ON COALESCE(tbl_action_logs.action_body::json->'body'->>'ship_to', tbl_action_logs.action_body::json->>'ship_to') = tbl_petrol.ptrl_number
                    ${whereClause}
                `;

        let countResult = await pgConn.get(
          dbPrefix + lic_code,
          countScript,
          config.connectionString(),
        );

        if (
          !countResult.code &&
          countResult.data &&
          countResult.data.length > 0
        ) {
          page_total = parseInt(countResult.data[0].page_total) || 1;
          rows_total = parseInt(countResult.data[0].rows_total) || 0;
        }

        // =========================================================
        //               ส่งข้อมูลตอบกลับ (Success Response)
        // =========================================================
        let response = [
          {
            status: "success",
            invalid_code: "0",
            message: "",
            data: mainLogResult.data,
            summary: summary,
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
            page_total: page_total <= 0 ? 1 : page_total,
            rows_total: rows_total,
          },
        ];

        res.status(200).send(response);
        return;
      } else {
        // =========================================================
        //            กรณีไม่พบข้อมูล (No Data Found)
        // =========================================================
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
      // =========================================================
      //            จัดการข้อผิดพลาดจาก DB (DB Error Handling)
      // =========================================================
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
    // =========================================================
    //         จัดการข้อผิดพลาดที่ไม่คาดคิด (Exception Handling)
    // =========================================================
    console.log(err);
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
// =========================================================
//  Helper Functions
// =========================================================

// =========== ดึงข้อมูลรายการสั่งซื้อ Order Report ===========
exports.getOrderReport = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let {
      order_no,
      req_dt,
      ptrl_tank_code,
      itm_code,
      search,
      page_index,
      page_limit,
      action,
    } = req.body[0];

    page_index = page_index === undefined ? 1 : page_index;
    page_limit = page_limit === undefined ? 10 : page_limit;

    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      req_dt === undefined ||
      order_no === undefined ||
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

    // ========== เตรียมข้อมูลสำหรับ Pagination ==========
    if (page_index > 0) page_index -= 1;

    // =========================================================
    //      จัดการเงื่อนไข WHERE แบบรวมศูนย์ (Dynamic Conditions)
    // =========================================================
    let conditions = ["tbl_order_petrol.rm_dt IS NULL"];

    if (order_no.toString().toUpperCase() !== "ALL") {
      conditions.push(
        `tbl_order_petrol.ord_code = (SELECT id::text FROM tbl_order WHERE order_no = '${order_no}' LIMIT 1)`,
      );
    }

    if (req_dt.toString().toUpperCase() !== "ALL") {
      if (req_dt.length === 10) {
        conditions.push(
          `tbl_order.cus_date_ref >= '${req_dt} 00:00:00' AND tbl_order.cus_date_ref <= '${req_dt} 23:59:59'`,
        );
      } else {
        conditions.push(`tbl_order.cus_date_ref >= '${req_dt}'`);
      }
    }

    if (ptrl_tank_code && ptrl_tank_code.toString().toUpperCase() !== "ALL") {
      conditions.push(`tbl_order_petrol.ptrl_tank_code = '${ptrl_tank_code}'`);
    }

    if (itm_code && itm_code.toString().toUpperCase() !== "ALL") {
      conditions.push(`tbl_order_petrol.itm_code = '${itm_code}'`);
    }

    let whereClause = "WHERE " + conditions.join(" AND ");

    // โครงสร้าง JOIN ที่ใช้ร่วมกันทั้ง Main Query และ Count Query
    let baseJoins = `
            FROM tbl_order_petrol 
            LEFT JOIN tbl_petrol ON tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
            LEFT JOIN tbl_item ON tbl_order_petrol.itm_code = tbl_item.itm_code
            LEFT JOIN tbl_petrol_tank ON tbl_order_petrol.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code
            LEFT JOIN tbl_order ON tbl_order_petrol.ord_code = tbl_order.id::text
        `;

    // =========================================================
    //              Query ดึงข้อมูลหลัก (Main Script)
    // =========================================================
    let mainScript = `
            SELECT 
                tbl_order_petrol.ord_code,
                tbl_order.cus_date_ref,
                json_agg(json_build_object(
                    'ord_petrol_code', tbl_order_petrol.ord_petrol_code,
                    'shipto', tbl_petrol.ptrl_number,
                    'station', tbl_petrol.ptrl_desc,
                    'req_dt', tbl_order_petrol.req_dt,
                    'ptrl_tank_code', tbl_order_petrol.ptrl_tank_code,
                    'tnk_number', tbl_petrol_tank.tnk_number,
                    'itm_code', tbl_order_petrol.itm_code,
                    'itm_desc', tbl_item.itm_desc,
                    'item_qty', tbl_order_petrol.item_quantity
                )) as items
            ${baseJoins}
            ${whereClause}
            GROUP BY tbl_order_petrol.ord_code, tbl_order.cus_date_ref
            ORDER BY MAX(tbl_order_petrol.ist_dt) DESC 
            OFFSET (${page_index} * ${page_limit}) LIMIT ${page_limit};
        `;

    console.log("Main Script: ", mainScript);
    let tbl_temporary = await pgConn.get(
      dbPrefix + lic_code,
      mainScript,
      config.connectionString(),
    );

    if (!tbl_temporary.code) {
      if (tbl_temporary.data.length > 0) {
        tbl_temporary.data = JSON.parse(
          JSON.stringify(tbl_temporary.data).replace(/\:null/gi, '\:""'),
        );

        // =========================================================
        //   Query หาจำนวนแถวทั้งหมด
        // =========================================================
        let countScript = `
                    SELECT 
                        CEIL((COUNT(*)::numeric / ${page_limit})) as page_total, 
                        COUNT(*) as rows_total
                    FROM (
                        SELECT tbl_order_petrol.ord_code 
                        ${baseJoins}
                        ${whereClause}
                        GROUP BY tbl_order_petrol.ord_code, tbl_order.cus_date_ref
                    ) as grouped_data;
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
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "ดึงข้อมูล Order Report",
        JSON.stringify(req.body[0]),
        "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        action[0].value,
      );
      return;
    }
  })().catch(async (err) => {
    console.log(err);
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

// =========== ดึงข้อมูล Order Runout ===========
exports.getOrderRunout = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let { action } = req.body[0];

    if (action == undefined) {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message:
            "ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      res.status(200).send(response);
      return;
    }

    // เช็ค order ที่ auto_order = '1' และ order_no ยังว่าง/null
    // และ ist_dt เกินเวลากำหนด (RUNOUT_TIMEOUT_MINUTES นาที)
    let script = `SELECT id, order_no, order_type, order_group, sold_to, ship_to,
                deli_date_req, description, auto_order, ist_dt,
                EXTRACT(EPOCH FROM(NOW() - ist_dt)) / 60 AS minutes_since_created
            FROM public.tbl_order 
            WHERE auto_order = '1'
                AND(order_no IS NULL OR order_no = '') 
                AND rm_dt IS NULL 
                AND ist_dt <= NOW() - INTERVAL '${RUNOUT_TIMEOUT_MINUTES} minutes'
            ORDER BY ist_dt ASC`;

    let tbl_temporary = await pgConn.get(
      dbPrefix + lic_code,
      script,
      config.connectionString(),
    );

    if (!tbl_temporary.code) {
      if (tbl_temporary.data.length > 0) {
        // เพิ่ม status runout ให้แต่ละ order
        let runout_orders = tbl_temporary.data.map((order) => ({
          ...order,
          runout_status: "Run-out",
          runout_reason: `ไม่ได้รับ order_no กลับมาภายใน ${RUNOUT_TIMEOUT_MINUTES} นาที`,
        }));

        tbl_temporary.data = JSON.parse(
          JSON.stringify(runout_orders).replace(/\:null/gi, '\:""'),
        );

        let response = [
          {
            status: "success",
            invalid_code: "0",
            message: "",
            data: tbl_temporary.data,
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];

        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "ตรวจสอบ Order Runout",
          JSON.stringify(req.body[0]),
          "success",
          action[0].value,
        );
        return;
      } else {
        let response = [
          {
            status: "success",
            invalid_code: "0",
            message: "ไม่พบ Order ที่ Runout",
            data: [],
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
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      res.status(200).send(response);
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "ตรวจสอบ Order Runout",
        JSON.stringify(req.body[0]),
        "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        action[0].value,
      );
      return;
    }
  })().catch(async (err) => {
    console.log(err);
    let response = [
      {
        status: "error",
        invalid_code: "-4",
        message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
        data: [],
        response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
      },
    ];
    res.status(200).send(response);
  });
};

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
    // ================ ดึงข้อมูล tbl_order ==================
    let orderScript = `SELECT * FROM tbl_order WHERE id = '${order_id}' AND order_flag = '1' LIMIT 1`;
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
            SELECT i.item_no, i.item_qty, i.long_text_id, i.long_text, t.itm_material_number, i.sales_order_item
            FROM tbl_order_item i
            LEFT JOIN tbl_item t ON i.item_no = t.itm_code
            WHERE i.order_no = '${orderData.id}' AND i.order_item_flag = '1' AND i.order_item_flag = '1'
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
          DeliveryPlant: "",
          ItemText: [],
        };

        if (item.long_text_id && item.long_text) {
          sapItemObj.ItemText.push({
            LongTextID: item.long_text_id,
            LongText: item.long_text,
          });
        }

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

    let payloadData = JSON.stringify({
      SalesDocuments: [
        {
          SalesOrderType: orderData.order_type,
          SalesOrganization: orderData.order_group,
          DistributionChannel: orderData.chanel || "01",
          OrganizationDivision: orderData.division || "04",
          ShipToParty: orderData.ship_to || "",
          CustomerReference: orderData.cus_ref || "",
          CustomerPurchaseOrderType: orderData.po_name || "AOS",
          CustomerReferenceDate: cus_date_ref_formatted,
          NameofOrderer: orderData.order_by || "AOS",
          ShippingCondition: orderData.ship_cond || "T1",
          CustomerPaymentTerms: orderData.pay_term,
          RequestedDeliveryDate: deli_date_req_formatted,
          DeliveryTime: orderData.deli_time_req || "Z05",
          Description: orderData.description || "",
          SHCustomerReference: orderData.sh_cus_ref || "",
          SHCustomerReferenceDate: sh_cus_date_ref_formatted,
          HeaderText: [],
          Items: sapItems,
        },
      ],
    });
    // console.log(payloadData);

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

        let logPayloadErr = {
          order_id: order_id,
          reason: req.body[0].reason || req.body[0].description || "",
          ...JSON.parse(payloadData),
        };
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "confirm_order_sap",
          JSON.stringify(logPayloadErr),
          "error",
          action[0].value,
        );
      } else {
        response.push({
          status: "success",
          data: api_response.data,
        });

        let logPayload = {
          order_id: order_id,
          reason: req.body[0].reason || req.body[0].description || "",
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

              // ===== Update Items =====
              // if (sap_order.Items && Array.isArray(sap_order.Items)) {
              //     for (let sapItem of sap_order.Items) {
              //         let updateItemScript = `
              //             UPDATE public.tbl_order_item
              //             SET
              //                 order_no = ${orderId},
              //                 sales_order_item = '${sapItem.SalesOrderItem}'
              //             WHERE order_no = ${orderId}
              //             AND item_no IN(SELECT itm_code FROM tbl_item WHERE itm_material_number = '${sapItem.Material}')
              //         `;
              //         await pgConn.execute(dbPrefix + lic_code, updateItemScript, config.connectionString());
              //     }
              // }
            }
          }
        }
      }

      return response;
    } catch (error) {
      // console.log(error);
      let errMsg = error.response ? error.response.data : error.message;
      let errDetail = errMsg.fault.detail.errorcode;

      let response = [
        {
          status: "error",
          invalid_code: "-2",
          message: "External API Error: " + errDetail,
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];

      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "confirm_order_api_error",
        JSON.stringify({ order_id }),
        JSON.stringify(errMsg),
        action[0].value,
      );
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

exports.getConfirmOrder = async (req, res, next) => {
  let lic_code = req.header("lic_code");
  let { order_id, action } = req.body[0];

  // ปรับให้รองรับทั้งค่าเดี่ยว และ Array
  let orderIds = Array.isArray(order_id) ? order_id : [order_id];

  let response = [];
  let status = "fail";
  let error_message = [];

  for (let current_id of orderIds) {
    let result = await getConfirmOrder(lic_code, current_id, action);
    // let result = ex_data;
    console.log("status =>", result[0].status);
    console.log("result =>", result);

    if (result[0].status === "success") {
      status = "success";
      response.push(result[0].data);
    } else {
      const msg = Array.isArray(result)
        ? result[0]?.message
        : result?.message || "Internal Error";
      const sDocs = msg?.SalesDocuments;

      if (sDocs && sDocs.length > 0) {
        error_message.push({
          order_id: current_id,
          message_text: sDocs[0].MessageText,
          message_value: sDocs[0].SHCustomerReference,
          message_sub: sDocs[0].Messages,
        });
      } else {
        error_message.push({
          order_id: current_id,
          message_text: msg,
        });
      }
    }
  }

  res.status(200).send([
    {
      status: status,
      error_message: error_message,
      data: response,
    },
  ]);
};

// =========== ดึงรายการสั่งซื้อจาก Hana เพื่ออัพเดตลง Database ===========
exports.getOrderInformationHana = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");

    // 1. ดึงข้อมูลจาก SOInputParameter ตามโครงสร้าง JSON ใหม่
    let inputParam = req.body[0]?.SOInputParameter || {};
    let { SalesOrderList, CreationDate, CreationDateTo, action } = inputParam;

    if (!SalesOrderList || !action) {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message:
            "ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      res.status(200).send(response);
      return;
    }

    // ================ Construct SAP Payload ==================
    let sapItems = [];

    let payloadData = JSON.stringify({
      SOInputParameter: {
        SalesOrderList: SalesOrderList,
        SalesOrderTypeList: inputParam.SalesOrderTypeList || [],
        ShipToPartyList: inputParam.ShipToPartyList || [],
        CreationDate: CreationDate || "",
        CreationTime: inputParam.CreationTime || "",
        CreationDateTo: CreationDateTo || "",
        CreationTimeTo: inputParam.CreationTimeTo || "",
        CustomerPurchaseOrderType: inputParam.CustomerPurchaseOrderType || "",
        CustomerGroup1List: inputParam.CustomerGroup1List || [],
        NameofOrdererList: inputParam.NameofOrdererList || [],
      },
    });

    try {
      // ============ SAP API ==============
      let apiResponse = await sapApiClient.post(
        "/Logistics/SDI024/SODetail",
        payloadData,
      );

      for (let i = 0; i < apiResponse.data.Response.SalesOrders.length; i++) {
        let salesOrder = apiResponse.data.Response.SalesOrders[i];

        console.log(
          `[Item ${i + 1}/${apiResponse.data.Response.SalesOrders.length}] 📦 ประมวลผล SHCustomerReference: ${salesOrder.SHCustomerReference}`,
        );

        // =========== เช็ค SHCustomerReference ว่ามีใน tbl_order หรือไม่ ==================
        let check_script_order = `SELECT * FROM tbl_order WHERE sh_cus_ref = '${salesOrder.SHCustomerReference}'`;
        let check_order = await pgConn.get(
          dbPrefix + lic_code,
          check_script_order,
          config.connectionString(),
        );
        if (!check_order.code) {
          if (check_order.data.length > 0) {
            console.log(`   ➡️  เจอออเดอร์ในระบบ (Update Mode)`);
            console.log(
              "เจอ SHCustomerReference : " + salesOrder.SHCustomerReference,
            );

            // ================ เช็ค ship_to ว่ามีใน tbl_petrol ==================
            let isOrderComplete = true;
            if (salesOrder.ShipToParty) {
              let check_script_ship_to = `SELECT ptrl_number FROM tbl_petrol WHERE ptrl_number = '${salesOrder.ShipToParty}' LIMIT 1`;
              let check_ship_to = await pgConn.get(
                dbPrefix + lic_code,
                check_script_ship_to,
                config.connectionString(),
              );
              if (check_ship_to.code || check_ship_to.data.length === 0) {
                console.log(
                  `   ⚠️  ข้อมูลไม่สมบูรณ์: ไม่พบรหัสปั๊ม ShipToParty [${salesOrder.ShipToParty}] ใน tbl_petrol`,
                );
                isOrderComplete = false;
              }
            } else {
              console.log(`   ⚠️  ข้อมูลไม่สมบูรณ์: ไม่มีรหัสปั๊ม ShipToParty`);
              isOrderComplete = false;
            }

            // ================ เช็ค Material ใน Items ว่ามีใน tbl_item หรือไม่ ==================
            if (
              salesOrder.Items &&
              Array.isArray(salesOrder.Items) &&
              salesOrder.Items.length > 0
            ) {
              for (let j = 0; j < salesOrder.Items.length; j++) {
                let item = salesOrder.Items[j];
                if (item.Material) {
                  let check_script_material = `SELECT itm_code FROM tbl_item WHERE itm_material_number = '${item.Material}' LIMIT 1`;
                  let check_material = await pgConn.get(
                    dbPrefix + lic_code,
                    check_script_material,
                    config.connectionString(),
                  );
                  if (check_material.code || check_material.data.length === 0) {
                    console.log(
                      `   ⚠️  ข้อมูลไม่สมบูรณ์: ไม่พบสินค้ารหัส Material [${item.Material}] ใน tbl_item`,
                    );
                    isOrderComplete = false;
                    break;
                  }
                } else {
                  console.log(
                    `   ⚠️  ข้อมูลไม่สมบูรณ์: ไม่มีรหัสสินค้า Material`,
                  );
                  isOrderComplete = false;
                  break;
                }
              }
            }

            // ================ ถ้า Order ไม่สมบูรณ์ → set status 9 แต่ยังดำเนินการต่อเพื่อให้ Update Item ได้ ==================
            let current_order_status = 1;
            if (!isOrderComplete) {
              console.log(
                `   ❌  ข้อมูลมาสเตอร์ไม่ครบ → Set สถานะออเดอร์เป็น 9 แต่ยังดำเนินการอัปเดตรายการสินค้าต่อ`,
              );
              current_order_status = 9;
            }

            let rejection = salesOrder.OverallSDDocumentRejectionSts;
            if (rejection === "C") current_order_status = 2;

            // ================ อัพเดต tbl_order ==================
            console.log(`   🔄  กำลังอัปเดต tbl_order และ tbl_order_item...`);
            let update_script_order = `UPDATE tbl_order SET 
                            order_no = '${salesOrder.SalesOrder || ""}',
                            order_type = '${salesOrder.SalesOrderType || ""}',
                            order_group = '${salesOrder.SalesOrganization || ""}',
                            sold_to = '${salesOrder.SoldToParty || ""}',
                            ship_to = '${salesOrder.ShipToParty || ""}',
                            cus_ref = '${(salesOrder.CustomerReference || "").replace(/'/g, "''")}',
                            cus_date_ref = ${salesOrder.CustomerReferenceDate ? `'${salesOrder.CustomerReferenceDate}'` : "NULL"},
                            status_deli = '${salesOrder.OverallDeliveryStatus || ""}',
                            status_block = '${salesOrder.TotalBlockStatus || ""}',
                            status_sd_process = '${salesOrder.OverallSDProcessStatus || ""}',
                            status_check = '${salesOrder.TotalCreditCheckStatus || ""}',
                            sd_doc_reject = '${rejection || ""}',
                            cus_group = '${salesOrder.CustomerGroup1 || ""}',
                            hana_created = ${salesOrder.CreationDate ? `'${salesOrder.CreationDate}'` : "NULL"},
                            hana_time = '${salesOrder.CreationTime || ""}',
                            created_by = '${salesOrder.CreatedByUser || ""}',
                            deli_date_req = ${salesOrder.RequestedDeliveryDate ? `'${salesOrder.RequestedDeliveryDate}'` : "NULL"},
                            deli_time_req = ${salesOrder.DeliveryTime ? `'${salesOrder.DeliveryTime}'` : "NULL"},
                            description = '${(salesOrder.Description || "").replace(/'/g, "''")}',
                            order_status = ${current_order_status},
                            mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}' 
                            WHERE sh_cus_ref = '${salesOrder.SHCustomerReference}'`;
            await pgConn.execute(
              dbPrefix + lic_code,
              update_script_order,
              config.connectionString(),
            );

            // ================ อัพเดต tbl_order_item จาก Items ==================
            let orderId = check_order.data[0].id;
            if (
              salesOrder.Items &&
              Array.isArray(salesOrder.Items) &&
              salesOrder.Items.length > 0
            ) {
              for (let j = 0; j < salesOrder.Items.length; j++) {
                let item = salesOrder.Items[j];
                let itm_code = "";

                // ===== ค้นหา itm_code จาก material number ของ SAP =====
                if (item.Material) {
                  let check_item_script = `SELECT itm_code FROM tbl_item WHERE itm_material_number = '${item.Material}' LIMIT 1`;
                  let checkItemResult = await pgConn.get(
                    dbPrefix + lic_code,
                    check_item_script,
                    config.connectionString(),
                  );
                  if (
                    !checkItemResult.code &&
                    checkItemResult.data.length > 0
                  ) {
                    itm_code = checkItemResult.data[0].itm_code;
                  }
                }

                let update_item_script = `UPDATE tbl_order_item SET 
                                    item_no = '${itm_code || ""}',
                                    sales_order_item = '${item.SalesOrderItem || ""}',
                                    sd_reject_reason = '${item.SalesDocumentRjcnReason || ""}',
                                    sd_process_status = '${item.SDProcessStatus || ""}',
                                    deli_status = '${item.DeliveryStatus || ""}',
                                    misc_deli_no = '${item.MiscellaneousDeliveryNumber || ""}',
                                    mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}'
                                    WHERE order_no = '${orderId}' 
                                    AND (sales_order_item = '${item.SalesOrderItem}' OR (sales_order_item IS NULL OR sales_order_item = '') AND item_no = '${itm_code}')
                                    AND order_item_flag = '1'`;
                await pgConn.execute(
                  dbPrefix + lic_code,
                  update_item_script,
                  config.connectionString(),
                );
              }
            }
            console.log(`   ✅  อัปเดตสำเร็จ`);
            console.log(
              `------------------------------------------------------`,
            );
          } else {
            // ================ กรณีไม่เจอ Order ในระบบ → เพื่ม Order ใหม่จาก SAP ==================
            console.log(
              "ไม่เจอ SHCustomerReference ในระบบ → กำลังสร้าง Order ใหม่: " +
              salesOrder.SHCustomerReference,
            );
            console.log(`   ➡️  ไม่เจอออเดอร์ในระบบ (Insert Mode)`);
            console.log(`   ➕  กำลังสร้าง Order ใหม่จากข้อมูล SAP...`);

            // ================ Insert ข้อมูลออร์เดอของ SAP ลงใน tbl_order ==================

            let insert_order_script = `INSERT INTO tbl_order
                            (order_no, order_type, order_group, chanel, division, sold_to, ship_to,
                                cus_ref, cus_date_ref, po_name, order_by, ship_cond, pay_term,
                                deli_date_req, deli_time_req, description, sh_cus_ref, sh_cus_date_ref,
                                status_deli, status_block, status_sd_process, status_check, sd_doc_reject,
                                cus_group, hana_created, hana_time, created_by,
                                ist_dt, order_flag, auto_order, order_status)
                            VALUES
                            ('${salesOrder.SalesOrder || ""}', '${salesOrder.SalesOrderType || ""}', '${salesOrder.SalesOrganization || ""}', 
                             '${salesOrder.DistributionChannel || ""}', '${salesOrder.OrganizationDivision || ""}',
                             '${salesOrder.SoldToParty || ""}', '${salesOrder.ShipToParty || ""}', 
                             '${(salesOrder.CustomerReference || "").replace(/'/g, "''")}', ${salesOrder.CustomerReferenceDate ? `'${salesOrder.CustomerReferenceDate}'` : "NULL"},
                             '${salesOrder.CustomerPurchaseOrderType || ""}', '${salesOrder.NameofOrderer || ""}', 'T1', '',
                             ${salesOrder.RequestedDeliveryDate ? `'${salesOrder.RequestedDeliveryDate}'` : "NULL"}, '${salesOrder.DeliveryTime || ""}',
                             '${(salesOrder.Description || "").replace(/'/g, "''")}', '${salesOrder.SHCustomerReference || ""}', 
                             ${salesOrder.CustomerReferenceDate ? `'${salesOrder.CustomerReferenceDate}'` : "NULL"},
                             '${salesOrder.OverallDeliveryStatus || ""}', '${salesOrder.TotalBlockStatus || ""}', 
                             '${salesOrder.OverallSDProcessStatus || ""}', '${salesOrder.TotalCreditCheckStatus || ""}', 
                             '${salesOrder.OverallSDDocumentRejectionSts || ""}', '${salesOrder.CustomerGroup1 || ""}',
                             ${salesOrder.CreationDate ? `'${salesOrder.CreationDate}'` : "NULL"}, '${salesOrder.CreationTime || ""}', 
                             '${salesOrder.CreatedByUser || ""}',
                             '${moment().format("YYYY-MM-DD HH:mm:ss")}', '1', 0, 3) RETURNING id`;

            let res_new_order = await pgConn.get(
              dbPrefix + lic_code,
              insert_order_script,
              config.connectionString(),
            );

            if (!res_new_order.code && res_new_order.data.length > 0) {
              let newOrderId = res_new_order.data[0].id;

              if (
                salesOrder.Items &&
                Array.isArray(salesOrder.Items) &&
                salesOrder.Items.length > 0
              ) {
                for (let j = 0; j < salesOrder.Items.length; j++) {
                  let item = salesOrder.Items[j];
                  let itm_code = "";
                  let itm_no = item.Material || "";

                  let insert_item_script = `INSERT INTO tbl_order_item
                                                (order_no, item_no, item_qty, ist_dt, order_item_flag, auto_order, 
                                                 sales_order_item, sd_reject_reason, sd_process_status, deli_status, misc_deli_no)
                                                VALUES
                                                (${newOrderId}, '${itm_no}', ${item.OrderQuantity ? parseFloat(item.OrderQuantity) : 0}, 
                                                 '${moment().format("YYYY-MM-DD HH:mm:ss")}', '1', 0,
                                                 '${item.SalesOrderItem || ""}', '${item.SalesDocumentRjcnReason || ""}', 
                                                 '${item.SDProcessStatus || ""}', '${item.DeliveryStatus || ""}', 
                                                 '${item.MiscellaneousDeliveryNumber || ""}')`;

                  await pgConn.execute(
                    dbPrefix + lic_code,
                    insert_item_script,
                    config.connectionString(),
                  );
                }
              }
              console.log(
                `------------------------------------------------------`,
              );
            } else {
              console.error(
                "เกิดข้อผิดพลาดในการสร้าง Order ใหม่จาก SAP: " +
                (res_new_order.message || "Unknown Error"),
              );
            }
          }
        } else {
          console.error("Database Error (check_order): " + check_order.message);
        }
      }

      let response = [
        {
          status: "success",
          invalid_code: "0",
          message: "ดึงข้อมูล Order จาก SAP",
          data: apiResponse.data,
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      res.status(200).send(response);
    } catch (error) {
      console.log(error);
      let errMsg = error.response
        ? JSON.stringify(error.response.data)
        : error.message;
      let response = [
        {
          status: "error",
          invalid_code: "-2",
          message: "External API Error: " + errMsg,
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      res.status(200).send(response);

      // 3. เปลี่ยนตัวแปร log จาก order_no เป็น SalesOrderList เพื่อไม่ให้เกิด error
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "confirm_order_api_error",
        JSON.stringify({ SalesOrderList }),
        errMsg,
        action[0].value,
      );
      return;
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
    res.status(200).send(response);
  });
};

// =========== ดึงรายการสั่งซื้อจาก Hana เพื่ออัพเดตลง Database ===========
exports.getOrderInformationHanaBackUp = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");

    // 1. ดึงข้อมูลจาก SOInputParameter ตามโครงสร้าง JSON ใหม่
    let inputParam = req.body[0]?.SOInputParameter || {};
    let { SalesOrderList, CreationDate, CreationDateTo, action } = inputParam;

    if (!SalesOrderList || !action) {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message:
            "ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      res.status(200).send(response);
      return;
    }

    // ================ Construct SAP Payload ==================
    let sapItems = [];

    let payloadData = JSON.stringify({
      SOInputParameter: {
        SalesOrderList: SalesOrderList,
        SalesOrderTypeList: inputParam.SalesOrderTypeList || [],
        ShipToPartyList: inputParam.ShipToPartyList || [],
        CreationDate: CreationDate || "",
        CreationTime: inputParam.CreationTime || "",
        CreationDateTo: CreationDateTo || "",
        CreationTimeTo: inputParam.CreationTimeTo || "",
        CustomerPurchaseOrderType: inputParam.CustomerPurchaseOrderType || "",
        CustomerGroup1List: inputParam.CustomerGroup1List || [],
        NameofOrdererList: inputParam.NameofOrdererList || [],
      },
    });

    try {
      // ============ SAP API =============
      let apiResponse = await sapApiClient.post(
        "/Logistics/SDI024/SODetail",
        payloadData,
      );
      let response = [
        {
          status: "success",
          invalid_code: "0",
          message: "ดึงข้อมูล Order จาก SAP",
          data: apiResponse.data,
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      res.status(200).send(response);
      for (let i = 0; i < apiResponse.data.Response.SalesOrders.length; i++) {
        let salesOrder = apiResponse.data.Response.SalesOrders[i];

        console.log(
          `[Item ${i + 1}/${apiResponse.data.Response.SalesOrders.length}] 📦 ประมวลผล SHCustomerReference: ${salesOrder.SHCustomerReference}`,
        );

        // =========== เช็ค SHCustomerReference ว่ามีใน tbl_order หรือไม่ ==================
        let check_script_order = `SELECT * FROM tbl_order WHERE sh_cus_ref = '${salesOrder.SHCustomerReference}'`;
        let check_order = await pgConn.get(
          dbPrefix + lic_code,
          check_script_order,
          config.connectionString(),
        );
        if (!check_order.code) {
          if (check_order.data.length > 0) {
            console.log(`   ➡️  เจอออเดอร์ในระบบ (Update Mode)`);
            console.log(
              "เจอ SHCustomerReference : " + salesOrder.SHCustomerReference,
            );

            // ================ เช็ค ship_to ว่ามีใน tbl_petrol ==================
            let isOrderComplete = true;
            if (salesOrder.ShipToParty) {
              let check_script_ship_to = `SELECT ptrl_number FROM tbl_petrol WHERE ptrl_number = '${salesOrder.ShipToParty}' LIMIT 1`;
              let check_ship_to = await pgConn.get(
                dbPrefix + lic_code,
                check_script_ship_to,
                config.connectionString(),
              );
              if (check_ship_to.code || check_ship_to.data.length === 0) {
                console.log(
                  `   ⚠️  ข้อมูลไม่สมบูรณ์: ไม่พบรหัสปั๊ม ShipToParty [${salesOrder.ShipToParty}] ใน tbl_petrol`,
                );
                isOrderComplete = false;
              }
            } else {
              console.log(`   ⚠️  ข้อมูลไม่สมบูรณ์: ไม่มีรหัสปั๊ม ShipToParty`);
              isOrderComplete = false;
            }

            // ================ เช็ค Material ใน Items ว่ามีใน tbl_item หรือไม่ ==================
            if (
              salesOrder.Items &&
              Array.isArray(salesOrder.Items) &&
              salesOrder.Items.length > 0
            ) {
              for (let j = 0; j < salesOrder.Items.length; j++) {
                let item = salesOrder.Items[j];
                if (item.Material) {
                  let check_script_material = `SELECT itm_code FROM tbl_item WHERE itm_material_number = '${item.Material}' LIMIT 1`;
                  let check_material = await pgConn.get(
                    dbPrefix + lic_code,
                    check_script_material,
                    config.connectionString(),
                  );
                  if (check_material.code || check_material.data.length === 0) {
                    console.log(
                      `   ⚠️  ข้อมูลไม่สมบูรณ์: ไม่พบสินค้ารหัส Material [${item.Material}] ใน tbl_item`,
                    );
                    isOrderComplete = false;
                    break;
                  }
                } else {
                  console.log(
                    `   ⚠️  ข้อมูลไม่สมบูรณ์: ไม่มีรหัสสินค้า Material`,
                  );
                  isOrderComplete = false;
                  break;
                }
              }
            }

            // ================ ถ้า Order ไม่สมบูรณ์ → set status 9 แต่ยังดำเนินการต่อเพื่อให้ Update Item ได้ ==================
            let current_order_status = 1;
            if (!isOrderComplete) {
              console.log(
                `   ❌  ข้อมูลมาสเตอร์ไม่ครบ → Set สถานะออเดอร์เป็น 9 แต่ยังดำเนินการอัปเดตรายการสินค้าต่อ`,
              );
              current_order_status = 9;
            }

            // ================ อัพเดต tbl_order ==================
            console.log(`   🔄  กำลังอัปเดต tbl_order และ tbl_order_item...`);
            let update_script_order = `UPDATE tbl_order SET 
                            order_no = '${salesOrder.SalesOrder || ""}',
                            order_type = '${salesOrder.SalesOrderType || ""}',
                            order_group = '${salesOrder.SalesOrganization || ""}',
                            sold_to = '${salesOrder.SoldToParty || ""}',
                            ship_to = '${salesOrder.ShipToParty || ""}',
                            cus_ref = '${(salesOrder.CustomerReference || "").replace(/'/g, "''")}',
                            cus_date_ref = ${salesOrder.CustomerReferenceDate ? `'${salesOrder.CustomerReferenceDate}'` : "NULL"},
                            status_deli = '${salesOrder.OverallDeliveryStatus || ""}',
                            status_block = '${salesOrder.TotalBlockStatus || ""}',
                            status_sd_process = '${salesOrder.OverallSDProcessStatus || ""}',
                            status_check = '${salesOrder.TotalCreditCheckStatus || ""}',
                            sd_doc_reject = '${salesOrder.OverallSDDocumentRejectionSts || ""}',
                            cus_group = '${salesOrder.CustomerGroup1 || ""}',
                            hana_created = ${salesOrder.CreationDate ? `'${salesOrder.CreationDate}'` : "NULL"},
                            hana_time = '${salesOrder.CreationTime || ""}',
                            created_by = '${salesOrder.CreatedByUser || ""}',
                            deli_date_req = ${salesOrder.RequestedDeliveryDate ? `'${salesOrder.RequestedDeliveryDate}'` : "NULL"},
                            deli_time_req = ${salesOrder.DeliveryTime ? `'${salesOrder.DeliveryTime}'` : "NULL"},
                            description = '${(salesOrder.Description || "").replace(/'/g, "''")}',
                            order_status = ${current_order_status},
                            mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}' 
                            WHERE sh_cus_ref = '${salesOrder.SHCustomerReference}'`;
            await pgConn.execute(
              dbPrefix + lic_code,
              update_script_order,
              config.connectionString(),
            );

            // ================ อัพเดต tbl_order_item จาก Items ==================
            let orderId = check_order.data[0].id;
            if (
              salesOrder.Items &&
              Array.isArray(salesOrder.Items) &&
              salesOrder.Items.length > 0
            ) {
              for (let j = 0; j < salesOrder.Items.length; j++) {
                let item = salesOrder.Items[j];
                let itm_code = "";

                // ===== ค้นหา itm_code จาก material number ของ SAP =====
                if (item.Material) {
                  let check_item_script = `SELECT itm_code FROM tbl_item WHERE itm_material_number = '${item.Material}' LIMIT 1`;
                  let checkItemResult = await pgConn.get(
                    dbPrefix + lic_code,
                    check_item_script,
                    config.connectionString(),
                  );
                  if (
                    !checkItemResult.code &&
                    checkItemResult.data.length > 0
                  ) {
                    itm_code = checkItemResult.data[0].itm_code;
                  }
                }

                let update_item_script = `UPDATE tbl_order_item SET 
                                    item_no = '${itm_code || ""}',
                                    sales_order_item = '${item.SalesOrderItem || ""}',
                                    sd_reject_reason = '${item.SalesDocumentRjcnReason || ""}',
                                    sd_process_status = '${item.SDProcessStatus || ""}',
                                    deli_status = '${item.DeliveryStatus || ""}',
                                    misc_deli_no = '${item.MiscellaneousDeliveryNumber || ""}',
                                    mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}'
                                    WHERE order_no = '${orderId}' 
                                    AND (sales_order_item = '${item.SalesOrderItem}' OR (sales_order_item IS NULL OR sales_order_item = '') AND item_no = '${itm_code}')
                                    AND order_item_flag = '1'`;
                await pgConn.execute(
                  dbPrefix + lic_code,
                  update_item_script,
                  config.connectionString(),
                );
              }
            }
            console.log(`   ✅  อัปเดตสำเร็จ`);
            console.log(
              `------------------------------------------------------`,
            );
          } else {
            // ================ กรณีไม่เจอ Order ในระบบ → เพื่ม Order ใหม่จาก SAP ==================
            console.log(
              "ไม่เจอ SHCustomerReference ในระบบ → กำลังสร้าง Order ใหม่: " +
              salesOrder.SHCustomerReference,
            );
            console.log(`   ➡️  ไม่เจอออเดอร์ในระบบ (Insert Mode)`);
            console.log(`   ➕  กำลังสร้าง Order ใหม่จากข้อมูล SAP...`);

            // ================ เช็คความสมบูรณ์ของข้อมูลก่อน Insert ==================
            let isNewOrderComplete = true;

            // 1. เช็ค ship_to
            if (salesOrder.ShipToParty) {
              let check_script_ship_to = `SELECT ptrl_number FROM tbl_petrol WHERE ptrl_number = '${salesOrder.ShipToParty}' LIMIT 1`;
              let check_ship_to = await pgConn.get(
                dbPrefix + lic_code,
                check_script_ship_to,
                config.connectionString(),
              );
              if (check_ship_to.code || check_ship_to.data.length === 0) {
                console.log(
                  `   ⚠️  ข้อมูลไม่สมบูรณ์: ไม่พบรหัสปั๊ม ShipToParty [${salesOrder.ShipToParty}] ใน tbl_petrol`,
                );
                isNewOrderComplete = false;
              }
            } else {
              console.log(`   ⚠️  ข้อมูลไม่สมบูรณ์: ไม่มีรหัสปั๊ม ShipToParty`);
              isNewOrderComplete = false;
            }

            // 2. เช็ค Material ใน Items
            if (
              salesOrder.Items &&
              Array.isArray(salesOrder.Items) &&
              salesOrder.Items.length > 0
            ) {
              for (let j = 0; j < salesOrder.Items.length; j++) {
                let item = salesOrder.Items[j];
                if (item.Material) {
                  let check_script_material = `SELECT itm_code FROM tbl_item WHERE itm_material_number = '${item.Material}' LIMIT 1`;
                  let check_material = await pgConn.get(
                    dbPrefix + lic_code,
                    check_script_material,
                    config.connectionString(),
                  );
                  if (check_material.code || check_material.data.length === 0) {
                    console.log(
                      `   ⚠️  ข้อมูลไม่สมบูรณ์: ไม่พบสินค้ารหัส Material [${item.Material}] ใน tbl_item`,
                    );
                    isNewOrderComplete = false;
                    break;
                  }
                } else {
                  console.log(
                    `   ⚠️  ข้อมูลไม่สมบูรณ์: ไม่มีรหัสสินค้า Material`,
                  );
                  isNewOrderComplete = false;
                  break;
                }
              }
            } else {
              console.log(`   ⚠️  ข้อมูลไม่สมบูรณ์: ไม่มีรายการสินค้า Items`);
              isNewOrderComplete = false;
            }

            let final_order_status = isNewOrderComplete ? 1 : 9;
            if (!isNewOrderComplete) {
              console.log(
                `   ❌  ข้อมูลมาสเตอร์ไม่ครบถ้วน → จะสร้าง Order ด้วยสถานะ 9 (Incomplete)`,
              );
            }

            let insert_order_script = `INSERT INTO tbl_order
                            (order_no, order_type, order_group, chanel, division, sold_to, ship_to,
                                cus_ref, cus_date_ref, po_name, order_by, ship_cond, pay_term,
                                deli_date_req, deli_time_req, description, sh_cus_ref, sh_cus_date_ref,
                                status_deli, status_block, status_sd_process, status_check, sd_doc_reject,
                                cus_group, hana_created, hana_time, created_by,
                                ist_dt, order_flag, auto_order, order_status)
                            VALUES
                            ('${salesOrder.SalesOrder || ""}', '${salesOrder.SalesOrderType || ""}', '${salesOrder.SalesOrganization || ""}', 
                             '${salesOrder.DistributionChannel || ""}', '${salesOrder.OrganizationDivision || ""}',
                             '${salesOrder.SoldToParty || ""}', '${salesOrder.ShipToParty || ""}', 
                             '${(salesOrder.CustomerReference || "").replace(/'/g, "''")}', ${salesOrder.CustomerReferenceDate ? `'${salesOrder.CustomerReferenceDate}'` : "NULL"},
                             'AOS', 'AOS', 'T1', '',
                             ${salesOrder.RequestedDeliveryDate ? `'${salesOrder.RequestedDeliveryDate}'` : "NULL"}, '${salesOrder.DeliveryTime || ""}',
                             '${(salesOrder.Description || "").replace(/'/g, "''")}', '${salesOrder.SHCustomerReference || ""}', 
                             ${salesOrder.CustomerReferenceDate ? `'${salesOrder.CustomerReferenceDate}'` : "NULL"},
                             '${salesOrder.OverallDeliveryStatus || ""}', '${salesOrder.TotalBlockStatus || ""}', 
                             '${salesOrder.OverallSDProcessStatus || ""}', '${salesOrder.TotalCreditCheckStatus || ""}', 
                             '${salesOrder.OverallSDDocumentRejectionSts || ""}', '${salesOrder.CustomerGroup1 || ""}',
                             ${salesOrder.CreationDate ? `'${salesOrder.CreationDate}'` : "NULL"}, '${salesOrder.CreationTime || ""}', 
                             '${salesOrder.CreatedByUser || ""}',
                             '${moment().format("YYYY-MM-DD HH:mm:ss")}', '1', 0, 3) RETURNING id`;

            let res_new_order = await pgConn.get(
              dbPrefix + lic_code,
              insert_order_script,
              config.connectionString(),
            );

            if (!res_new_order.code && res_new_order.data.length > 0) {
              let newOrderId = res_new_order.data[0].id;

              // ================ ถ้า Order สมบูรณ์ → เพิ่มรายการสินค้า ==================
              if (final_order_status === 1) {
                console.log(
                  `สร้าง Order ใหม่สำเร็จ (ID: ${newOrderId}) → กำลังเพิ่มรายการสินค้า...`,
                );

                if (
                  salesOrder.Items &&
                  Array.isArray(salesOrder.Items) &&
                  salesOrder.Items.length > 0
                ) {
                  for (let j = 0; j < salesOrder.Items.length; j++) {
                    let item = salesOrder.Items[j];
                    let itm_code = "";

                    // ===== ค้นหา itm_code จาก material number ของ SAP =====
                    if (item.Material) {
                      let check_item_script = `SELECT itm_code FROM tbl_item WHERE itm_material_number = '${item.Material}' LIMIT 1`;
                      let checkItemResult = await pgConn.get(
                        dbPrefix + lic_code,
                        check_item_script,
                        config.connectionString(),
                      );
                      if (
                        !checkItemResult.code &&
                        checkItemResult.data.length > 0
                      ) {
                        itm_code = checkItemResult.data[0].itm_code;
                      }
                    }

                    if (itm_code) {
                      let insert_item_script = `INSERT INTO tbl_order_item
                                                (order_no, item_no, item_qty, ist_dt, order_item_flag, auto_order, 
                                                 sales_order_item, sd_reject_reason, sd_process_status, deli_status, misc_deli_no)
                                                VALUES
                                                (${newOrderId}, '${itm_code}', ${item.OrderQuantity ? parseFloat(item.OrderQuantity) : 0}, 
                                                 '${moment().format("YYYY-MM-DD HH:mm:ss")}', '1', 0,
                                                 '${item.SalesOrderItem || ""}', '${item.SalesDocumentRjcnReason || ""}', 
                                                 '${item.SDProcessStatus || ""}', '${item.DeliveryStatus || ""}', 
                                                 '${item.MiscellaneousDeliveryNumber || ""}')`;

                      await pgConn.execute(
                        dbPrefix + lic_code,
                        insert_item_script,
                        config.connectionString(),
                      );
                    }
                  }
                }
                console.log(`   ✅  สร้าง Order และรายการสินค้าสำเร็จ`);
              } else {
                console.log(
                  `   ⚠️  เพิ่มไอเทมที่ไม่มีในระบบ และ Set สถานะ Order เป็นไม่สมบูรณ์ (Status 9) `,
                );
                if (
                  salesOrder.Items &&
                  Array.isArray(salesOrder.Items) &&
                  salesOrder.Items.length > 0
                ) {
                  for (let j = 0; j < salesOrder.Items.length; j++) {
                    let item = salesOrder.Items[j];
                    let itm_code = "";

                    // ===== ค้นหา itm_code จาก material number ของ SAP =====
                    if (item.Material) {
                      let check_item_script = `SELECT itm_code FROM tbl_item WHERE itm_material_number = '${item.Material}' LIMIT 1`;
                      let checkItemResult = await pgConn.get(
                        dbPrefix + lic_code,
                        check_item_script,
                        config.connectionString(),
                      );
                      if (
                        !checkItemResult.code &&
                        checkItemResult.data.length > 0
                      ) {
                        itm_code = checkItemResult.data[0].itm_code;
                      }
                    }

                    if (itm_code) {
                      let insert_item_script = `INSERT INTO tbl_order_item
                                                (order_no, item_no, item_qty, ist_dt, order_item_flag, auto_order, 
                                                 sales_order_item, sd_reject_reason, sd_process_status, deli_status, misc_deli_no)
                                                VALUES
                                                (${newOrderId}, '${itm_code}', ${item.OrderQuantity ? parseFloat(item.OrderQuantity) : 0}, 
                                                 '${moment().format("YYYY-MM-DD HH:mm:ss")}', '1', 0,
                                                 '${item.SalesOrderItem || ""}', '${item.SalesDocumentRjcnReason || ""}', 
                                                 '${item.SDProcessStatus || ""}', '${item.DeliveryStatus || ""}', 
                                                 '${item.MiscellaneousDeliveryNumber || ""}')`;

                      await pgConn.execute(
                        dbPrefix + lic_code,
                        insert_item_script,
                        config.connectionString(),
                      );
                    } else {
                      let insert_item_script = `INSERT INTO tbl_order_item
                                                (order_no, item_no, item_qty, ist_dt, order_item_flag, auto_order, 
                                                 sales_order_item, sd_reject_reason, sd_process_status, deli_status, misc_deli_no)
                                                VALUES
                                                (${newOrderId}, '', ${item.OrderQuantity ? parseFloat(item.OrderQuantity) : 0}, 
                                                 '${moment().format("YYYY-MM-DD HH:mm:ss")}', '1', 0,
                                                 '${item.SalesOrderItem || ""}', '${item.SalesDocumentRjcnReason || ""}', 
                                                 '${item.SDProcessStatus || ""}', '${item.DeliveryStatus || ""}', 
                                                 '${item.MiscellaneousDeliveryNumber || ""}')`;

                      await pgConn.execute(
                        dbPrefix + lic_code,
                        insert_item_script,
                        config.connectionString(),
                      );
                    }
                  }
                }
              }
              console.log(
                `------------------------------------------------------`,
              );
            } else {
              console.error(
                "เกิดข้อผิดพลาดในการสร้าง Order ใหม่จาก SAP: " +
                (res_new_order.message || "Unknown Error"),
              );
            }
          }
        } else {
          console.error("Database Error (check_order): " + check_order.message);
        }
      }
    } catch (error) {
      console.log(error);
      let errMsg = error.response
        ? JSON.stringify(error.response.data)
        : error.message;
      let response = [
        {
          status: "error",
          invalid_code: "-2",
          message: "External API Error: " + errMsg,
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      res.status(200).send(response);

      // 3. เปลี่ยนตัวแปร log จาก order_no เป็น SalesOrderList เพื่อไม่ให้เกิด error
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "confirm_order_api_error",
        JSON.stringify({ SalesOrderList }),
        errMsg,
        action[0].value,
      );
      return;
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
    res.status(200).send(response);
  });
};

// =========== ส่งคำขอยกเลิกคำสั่งซื้อ ไปที่ HANA
exports.cancelOrderInformationHana = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let { order_id, action } = req.body[0];
    let orderIds = Array.isArray(order_id) ? order_id : [order_id];

    if (!orderIds || !action) {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message:
            "ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      res.status(200).send(response);
      return;
    }

    // ========== เช็ีคก่อนว่ามี order มั้ย ================
    let payloadData = [];
    for (let id of order_id) {
      var script_check_sales_order = `
                SELECT ti.sales_order_item, tod.order_no
                FROM tbl_order_item ti
                INNER JOIN tbl_order tod ON ti.order_no = tod.id
                WHERE tod.id = ${id} AND tod.order_no IS NOT NULL
            `;
      var check_sales_order = await pgConn.get(
        dbPrefix + lic_code,
        script_check_sales_order,
        config.connectionString(),
      );

      if (!check_sales_order.code && check_sales_order.data.length <= 0) {
        let response = [
          {
            status: "error",
            invalid_code: "-2",
            message: "ไม่พบข้อมูลคำสั่งซื้อ",
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
        res.status(200).send(response);
        return;
      }

      let sapItems = [];
      let order_no = check_sales_order.data[0].order_no;
      for (let item of check_sales_order.data) {
        sapItems.push({
          SalesOrderItem: item.sales_order_item,
          SalesDocumentRjcnReason: "85",
        });
      }

      payloadData.push({
        SalesDocuments: [
          {
            SalesOrder: order_no,
            Items: sapItems,
          },
        ],
      });
    }

    const updateStatusOrder = async (payload) => {
      let order_no = payload.SalesDocuments[0].SalesOrder;

      try {
        // ============ SAP API =============
        let apiResponse = await sapApiClient.post(
          "/Logistics/SDI022/SOUpdate",
          payload,
        );
        let status = false;
        if (apiResponse.data.SalesDocuments[0].MessageType === "S") {
          status = true;

          let script_update_order = `
                        UPDATE tbl_order 
                        SET order_status = '2', 
                            mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}' 
                        WHERE order_no = '${order_no}'
                    `;
          await pgConn.execute(
            dbPrefix + lic_code,
            script_update_order,
            config.connectionString(),
          );
        }

        let response = [
          {
            status: status ? "success" : "error",
            invalid_code: "0",
            message: status
              ? "ขอยกเลิกคำสั่งซื้อ จาก SAP สำเร็จ"
              : "ขอยกเลิกคำสั่งซื้อ จาก SAP ไม่สำเร็จ",
            data: apiResponse.data,
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];

        let logPayloadSuccess = {
          reason: req.body[0].reason || "",
          ...payload,
        };
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "cancel_order_sap",
          JSON.stringify(logPayloadSuccess),
          "success",
          action[0].value,
        );
        return response;
      } catch (error) {
        console.log(error);
        let errMsg = error.response
          ? JSON.stringify(error.response.data)
          : error.message;
        let response = [
          {
            status: "error",
            invalid_code: "-2",
            message: "External API Error: " + errMsg,
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];

        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "cancel_order_error",
          JSON.stringify({ order_no }),
          errMsg,
          action[0].value,
        );
        return response;
      }
    };

    let response = [];
    let status = false;
    for (let item of payloadData) {
      let res = await updateStatusOrder(item);
      response.push(res);

      if (res[0].status === "success") {
        status = true;
      }
    }

    res.status(200).send({
      status: status ? "success" : "error",
      message: status
        ? "ขอยกเลิกคำสั่งซื้อ จาก SAP สำเร็จ"
        : "ขอยกเลิกคำสั่งซื้อ จาก SAP ไม่สำเร็จ",
      data: response,
      response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
    });
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
    res.status(200).send(response);
  });
};

// Mockup: กำหนดเวลา runout (นาที)
const RUNOUT_TIMEOUT_MINUTES = 1;

// =========== ดึงข้อมูลรายการสั่งซื้อ Order Runout ===========
exports.getOrderRunout = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let { action } = req.body[0];

    if (action == undefined) {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message:
            "ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      res.status(200).send(response);
      return;
    }

    // เช็ค order ที่ auto_order = '1' และ order_no ยังว่าง/null
    // และ ist_dt เกินเวลากำหนด (RUNOUT_TIMEOUT_MINUTES นาที)
    let script = `SELECT id, order_no, order_type, order_group, sold_to, ship_to,
            deli_date_req, description, auto_order, ist_dt,
            EXTRACT(EPOCH FROM(NOW() - ist_dt)) / 60 AS minutes_since_created
            FROM public.tbl_order 
            WHERE auto_order = '1'
        AND(order_no IS NULL OR order_no = '') 
            AND rm_dt IS NULL 
            AND ist_dt <= NOW() - INTERVAL '${RUNOUT_TIMEOUT_MINUTES} minutes'
            ORDER BY ist_dt ASC`;

    console.log(script)

    let tbl_temporary = await pgConn.get(
      dbPrefix + lic_code,
      script,
      config.connectionString(),
    );

    if (!tbl_temporary.code) {
      if (tbl_temporary.data.length > 0) {
        // เพิ่ม status runout ให้แต่ละ order
        let runout_orders = tbl_temporary.data.map((order) => ({
          ...order,
          runout_status: "Run-out",
          runout_reason: `ไม่ได้รับ order_no กลับมาภายใน ${RUNOUT_TIMEOUT_MINUTES} นาที`,
        }));

        tbl_temporary.data = JSON.parse(
          JSON.stringify(runout_orders).replace(/\:null/gi, '\:""'),
        );

        let response = [
          {
            status: "success",
            invalid_code: "0",
            message: "",
            data: tbl_temporary.data,
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];

        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "ตรวจสอบ Order Runout",
          JSON.stringify(req.body[0]),
          "success",
          action[0].value,
        );
        return;
      } else {
        let response = [
          {
            status: "success",
            invalid_code: "0",
            message: "ไม่พบ Order ที่ Runout",
            data: [],
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
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      res.status(200).send(response);
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "ตรวจสอบ Order Runout",
        JSON.stringify(req.body[0]),
        "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        action[0].value,
      );
      return;
    }
  })().catch(async (err) => {
    console.log(err);
    let response = [
      {
        status: "error",
        invalid_code: "-4",
        message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
        data: [],
        response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
      },
    ];
    res.status(200).send(response);
  });
};

const genCusRef = async (lic_code, req_date_str) => {
  // ====================== หาค่า sh_cus_ref ล่าสุด ======================
  let scriptCheckShCusRef = `
        SELECT MAX(CAST(SUBSTRING(sh_cus_ref FROM 12) AS INTEGER)) as last_running 
        FROM public.tbl_order 
        WHERE sh_cus_ref LIKE 'AOS${req_date_str}%' AND sh_cus_ref ~ '^AOS[0-9]{8}[0-9]+$'
        `;
  let checkShCusRefResult = await pgConn.get(
    dbPrefix + lic_code,
    scriptCheckShCusRef,
    config.connectionString(),
  );

  let running_number = 1;
  if (
    !checkShCusRefResult.code &&
    checkShCusRefResult.data.length > 0 &&
    checkShCusRefResult.data[0].last_running !== null
  ) {
    running_number = parseInt(checkShCusRefResult.data[0].last_running) + 1;
  }

  return "AOS" + req_date_str + String(running_number).padStart(4, "0");
};

// =========== เพิ่มข้อมูลรายการสั่งซื้อ =============
exports.addOrderInformation = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let {
      order_type,
      order_group,
      chanel,
      division,
      sold_to,
      ship_to,
      cus_ref,
      cus_date_ref,
      po_name,
      order_by,
      ship_cond,
      pay_term,
      deli_date_req,
      deli_time_req,
      description,
      sh_cus_ref,
      sh_cus_date_ref,
      order_item,
      action,
    } = req.body[0];

    // ====================== เช็คเฉพาะส่วนที่สำคัญ ======================
    if (
      order_type == undefined ||
      order_group == undefined ||
      sold_to == undefined ||
      ship_to == undefined ||
      deli_date_req == undefined ||
      deli_time_req == undefined ||
      order_item == undefined ||
      action == undefined
    ) {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message:
            "ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];

      res.status(200).send(response);
      return;
    }

    // ============== Set Default Value ==============
    chanel = chanel === undefined || chanel === "" ? "01" : chanel;
    division = division === undefined || division === "" ? "04" : division;
    deli_date_req =
      deli_date_req === undefined || deli_date_req === ""
        ? null
        : deli_date_req;

    let script = ``;
    // =========== Order-No Mockup ===========
    let order_no = "ord-" + moment().format("x");

    // ====================== เช็ค Validate item_quantity ======================
    if (order_item && Array.isArray(order_item) && order_item.length > 0) {
      for (var i = 0; i < order_item.length; i++) {
        var item_quantity_check = order_item[i].item_quantity;
        if (!/^\d+(\.\d+)?$/.test(String(item_quantity_check))) {
          let response = [
            {
              status: "error",
              invalid_code: "-1",
              message:
                "ไม่สามารถบันทึกข้อมูล Order ได้ เนื่องจาก item_quantity ต้องเป็นตัวเลขที่ถูกต้องเท่านั้น (ห้ามมีเครื่องหมายพิเศษ หน้าข้อความ)",
              data: [],
              response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
            },
          ];
          res.status(200).send(response);
          let logPayload = { order_no: "-", ...req.body[0] };
          await xglobal.action_logs(
            lic_code,
            action[0].id,
            "เพิ่ม Order",
            JSON.stringify(logPayload),
            "ไม่สามารถบันทึกข้อมูล Order ได้ เนื่องจาก item_quantity ต้องเป็นตัวเลขที่ถูกต้องเท่านั้น (ห้ามมีเครื่องหมายพิเศษ หน้าข้อความ)",
            action[0].value,
          );
          return;
        }
      }
    }

    // ====================== เช็คก่อนว่า มีรหัสน้ำมันในระบบรึเปล่า ======================
    let hasValidItem = false;
    if (order_item && Array.isArray(order_item) && order_item.length > 0) {
      for (var i = 0; i < order_item.length; i++) {
        var pre_itm_material_number = order_item[i].itm_material_number;
        if (pre_itm_material_number) {
          let check_item_script = `SELECT 1 FROM tbl_item WHERE itm_material_number = '${pre_itm_material_number}' LIMIT 1`;
          let checkItemResult = await pgConn.get(
            dbPrefix + lic_code,
            check_item_script,
            config.connectionString(),
          );
          if (!checkItemResult.code && checkItemResult.data.length > 0) {
            hasValidItem = true;
            break;
          }
        }
      }
    }

    if (!hasValidItem) {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message:
            "ไม่สามารถบันทึกข้อมูล Order ได้ เนื่องจากไม่พบรหัสสินค้าน้ำมัน (material_code) ที่ถูกต้องในระบบ",
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      res.status(200).send(response);
      let logPayload = { order_no: "-", ...req.body[0] };
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "เพิ่ม Order",
        JSON.stringify(logPayload),
        "ไม่สามารถบันทึกข้อมูล Order เนื่องจากไม่มี รหัสน้ำมันอยู่ในระบบ",
        action[0].value,
      );
      return;
    }
    // ====================== จบการเช็ค ======================

    cus_date_ref = deli_date_req;
    sh_cus_date_ref = deli_date_req;

    let req_date_str = moment(deli_date_req).format("YYYYMMDD");

    // ====================== หาค่า sh_cus_ref ล่าสุด ======================
    let scriptCheckShCusRef = `
            SELECT MAX(CAST(SUBSTRING(sh_cus_ref FROM 12) AS INTEGER)) as last_running 
            FROM public.tbl_order 
            WHERE sh_cus_ref LIKE 'AOS${req_date_str}%' AND sh_cus_ref ~ '^AOS[0-9]{8}[0-9]+$'
            `;
    let checkShCusRefResult = await pgConn.get(
      dbPrefix + lic_code,
      scriptCheckShCusRef,
      config.connectionString(),
    );

    let running_number = 1;
    if (
      !checkShCusRefResult.code &&
      checkShCusRefResult.data.length > 0 &&
      checkShCusRefResult.data[0].last_running !== null
    ) {
      running_number = parseInt(checkShCusRefResult.data[0].last_running) + 1;
    }

    sh_cus_ref = "AOS" + req_date_str + String(running_number).padStart(4, "0");

    // ====================== เพิ่มข้อมูลลงใน tbl_order ======================
    script = `INSERT INTO public.tbl_order
            (order_no, order_type, order_group, chanel, division, sold_to, ship_to,
                cus_ref, cus_date_ref, po_name, order_by, ship_cond, pay_term,
                deli_date_req, deli_time_req, description, sh_cus_ref, sh_cus_date_ref,
                status_deli, ist_dt, order_flag, auto_order, order_status, created_by_tms)
        VALUES
            (NULL, '${order_type}', '${order_group}', '${chanel}', '${division}',
                '${sold_to}', '${ship_to}', '${(cus_ref || "").replace(/'/g, "''")}', ${cus_date_ref ? "'" + moment(cus_date_ref).format("YYYY-MM-DD HH:mm:ss") + "'" : "NULL"},
                '${(po_name || "AOS").replace(/'/g, "''")}', '${(order_by || "AOS").replace(/'/g, "''")}', '${ship_cond || "T1"}', '${pay_term || ""}',
                ${deli_date_req ? "'" + moment(deli_date_req).format("YYYY-MM-DD HH:mm:ss") + "'" : "NULL"}, '${deli_time_req || ""}',
                '${(description || "").replace(/'/g, "''")}', '${sh_cus_ref || ""}', ${sh_cus_date_ref ? "'" + moment(sh_cus_date_ref).format("YYYY-MM-DD HH:mm:ss") + "'" : "NULL"},
                'A', '${moment().format("YYYY-MM-DD HH:mm:ss")}', '1', 0, 0, '${action[0].id}') RETURNING id`;

    script = script.replace(/'NULL'/gi, "NULL");
    let tbl_temporary = await pgConn.get(
      dbPrefix + lic_code,
      script,
      config.connectionString(),
    );
    if (tbl_temporary.code || tbl_temporary.data.length === 0) {
      let response = [
        {
          status: "error",
          invalid_code: "-3",
          message: `ไม่สามารถบันทึกข้อมูล Order, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      res.status(200).send(response);
      let logPayload = { order_no: "-", ...req.body[0] };
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "เพิ่ม Order",
        JSON.stringify(logPayload),
        "ไม่สามารถบันทึกข้อมูล Order",
        action[0].value,
      );
      return;
    }

    let order_id = tbl_temporary.data[0].id;

    let invalid_material_item = [];

    // ====================== หาค่า sales_order_item ล่าสุด ======================
    let script_max_sales_order_item = `SELECT MAX(CAST(sales_order_item AS INTEGER)) as last_running FROM public.tbl_order_item`;
    let check_max_result = await pgConn.get(
      dbPrefix + lic_code,
      script_max_sales_order_item,
      config.connectionString(),
    );
    let last_sales_order_item = 0;
    if (
      !check_max_result.code &&
      check_max_result.data.length > 0 &&
      check_max_result.data[0].last_running !== null
    ) {
      last_sales_order_item = parseInt(check_max_result.data[0].last_running);
    }

    // ====================== เพิ่มข้อมูลลงใน tbl_order_item จาก order_item array ======================
    if (order_item && Array.isArray(order_item) && order_item.length > 0) {
      console.log(
        `Database Name: ${dbPrefix + lic_code}, Order ID: ${order_id}, Item Count: ${order_item.length}`,
      );

      for (var i = 0; i < order_item.length; i++) {
        last_sales_order_item += 10;
        let sales_order_item = String(last_sales_order_item);
        var itm_code = order_item[i].itm_code;
        var item_quantity = parseFloat(order_item[i].item_quantity) || 0;
        var itm_material_number = (
          order_item[i].itm_material_number || ""
        ).trim();
        var deli_plant = order_item[i].deli_plant;
        var remark = order_item[i].remark;
        var ptrl_tank_code = order_item[i].ptrl_tank_code

        console.log(
          `ตรวจสอบ Item [${i}]: Material=${itm_material_number}, Code=${itm_code}`,
        );

        // ===== เช็ค itm_material_number ว่ามีอยู่ใน tbl_item หรือไม่ (ถ้าไม่มี itm_code มาให้) =====
        if (itm_material_number && !itm_code) {
          let check_item_script = `SELECT itm_code FROM tbl_item WHERE itm_material_number = '${itm_material_number}' LIMIT 1`;
          let checkItemResult = await pgConn.get(
            dbPrefix + lic_code,
            check_item_script,
            config.connectionString(),
          );

          if (!checkItemResult.code && checkItemResult.data.length > 0) {
            itm_code = checkItemResult.data[0].itm_code;
          }
        }

        if (itm_code) {
          // ===== เพิ่มข้อมูลลงใน tbl_order_item =====
          if (
            order_item[i].item_text &&
            Array.isArray(order_item[i].item_text) &&
            order_item[i].item_text.length > 0
          ) {
            // กรณีที่มี item_text
            for (var k = 0; k < order_item[i].item_text.length; k++) {
              var item_text = order_item[i].item_text[k];
              let script_item = `INSERT INTO public.tbl_order_item
                        (order_no, item_no, item_qty, long_text_id, long_text, ist_dt, order_item_flag, auto_order, deli_plant, sales_order_item, remark, ptrl_tank_code)
                        VALUES(${order_id}, '${itm_code}', ${item_quantity}, '${(item_text.long_text_id || "").replace(/'/g, "''")}', '${(item_text.long_text || "").replace(/'/g, "''")}',
                        '${moment().format("YYYY-MM-DD HH:mm:ss")}', '1', 0, '${deli_plant || ""}', '${sales_order_item}', '${remark || ""}', '${ptrl_tank_code || ""}')`;

              console.log(
                `กำลัง Insert Item [${itm_code}] (with text) สำหรับ Order ${order_id}`,
              );
              let res_item = await pgConn.execute(
                dbPrefix + lic_code,
                script_item,
                config.connectionString(),
              );
              if (res_item.code) {
                console.error(
                  `Error Insert Item [${itm_code}]: ${res_item.message}`,
                );
              }
            }
          } else {
            // กรณีที่ไม่มี item_text
            let script_item = `INSERT INTO public.tbl_order_item
                            (order_no, item_no, item_qty, long_text_id, long_text, ist_dt, order_item_flag, auto_order, deli_plant, sales_order_item, remark, ptrl_tank_code)
                        VALUES(${order_id}, '${itm_code}', ${item_quantity}, '', '',
                            '${moment().format("YYYY-MM-DD HH:mm:ss")}', '1', 0, '${deli_plant || ""}', '${sales_order_item}', '${remark || ""}', '${ptrl_tank_code || ""}')`;

            console.log(
              `กำลัง Insert Item [${itm_code}] (no text) สำหรับ Order ${order_id}`,
            );
            let res_item = await pgConn.execute(
              dbPrefix + lic_code,
              script_item,
              config.connectionString(),
            );
            if (res_item.code) {
              console.error(
                `Error Insert Item [${itm_code}]: ${res_item.message}`,
              );
            }
          }
        } else {
          console.log(
            `ข้ามรายการน้ำมัน [${i}]: ไม่พบ itm_code สำหรับ material number ${itm_material_number}`,
          );
          invalid_material_item.push(itm_material_number || itm_code);
        }
      }
    }

    // ============ Success response ============
    let response = [
      {
        status: "success",
        invalid_code: "0",
        message: "ยืนยันคำสั่ง Order สำเร็จ รอคำสั่ง SAP",
        data: [
          {
            sh_cus_ref: sh_cus_ref,
            order_id: order_id,
          },
        ],
        invalid_material_item: invalid_material_item,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
      },
    ];

    res.status(200).send(response);
    let event_type = req.body[0].event_type || "manual";

    // ========== Audit Log: สร้าง changes array และบันทึกทีละ order_item ==========
    if (order_item && Array.isArray(order_item) && order_item.length > 0) {
      for (let item of order_item) {
        let itemDesc = item.itm_material_number || item.itm_code || "N/A";
        let logPayloadItem = {
          order_no: "-",
          order_id: order_id,
          ship_to: ship_to || "",
          reason:
            item.remark ||
            req.body[0].remark ||
            req.body[0].reason ||
            req.body[0].description ||
            "",
          field: `Order Qty (${itemDesc})`,
          before: "0",
          after: String(item.item_quantity || 0),
        };
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          event_type,
          JSON.stringify(logPayloadItem),
          "success",
          action[0].value,
        );
      }
    } else {
      let logPayload = {
        order_no: "-",
        order_id: order_id,
        ship_to: ship_to || "",
        reason:
          req.body[0].remark ||
          req.body[0].reason ||
          req.body[0].description ||
          "",
        field: "",
        before: "",
        after: "",
      };
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        event_type,
        JSON.stringify(logPayload),
        "success",
        action[0].value,
      );
    }
    return;
  })().catch(async (err) => {
    console.log(err);
    let response = [
      {
        status: "error",
        invalid_code: "-4",
        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
        data: [],
        response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
      },
    ];
    res.status(200).send(response);
  });
};
// =========== แก้ไขข้อมูลรายการสั่งซื้อ ===========
exports.setOrderInformation = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let { order_id } = req.query;
    let { description, order_item, deli_date_req, deli_time_req, action } =
      req.body[0];

    // เช็คเฉพาะส่วนที่สำคัญ
    if (
      description == undefined ||
      description == "" ||
      action == undefined ||
      order_item == undefined
    ) {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message:
            "ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];

      res.status(200).send(response);
      return;
    }

    let order_no = order_id || req.body[0].order_id || req.body[0].order_no;
    if (order_no == undefined || order_no == "") {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message: "ไม่สามารถบันทึกข้อมูล, เนื่องจากไม่พบ order_id",
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      res.status(200).send(response);
      return;
    }

    deli_date_req =
      deli_date_req != undefined
        ? moment(deli_date_req).format("YYYY-MM-DD")
        : moment().format("YYYY-MM-DD");
    deli_time_req = deli_time_req != undefined ? deli_time_req : "Z00";

    // ====================== เช็ค Validate item_quantity ======================
    if (order_item && Array.isArray(order_item) && order_item.length > 0) {
      for (var i = 0; i < order_item.length; i++) {
        var item_quantity_check = order_item[i].item_quantity;
        if (!/^\d+(\.\d+)?$/.test(String(item_quantity_check))) {
          let response = [
            {
              status: "error",
              invalid_code: "-1",
              message:
                "ไม่สามารถบันทึกข้อมูล Order ได้ เนื่องจาก item_quantity ต้องเป็นตัวเลขที่ถูกต้องเท่านั้น (ห้ามมีเครื่องหมายพิเศษ หน้าข้อความ)",
              data: [],
              response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
            },
          ];
          res.status(200).send(response);
          return;
        }
      }
    }

    // ========== Audit Log: ดึงข้อมูลเก่าก่อน update ==========
    let scriptCheckOrderNo = `SELECT id, order_no, sh_cus_ref, ship_to, status_deli, order_status FROM tbl_order WHERE id = $1`;
    let checkOrderNo = await pgConn.getWithParams(
      dbPrefix + lic_code,
      scriptCheckOrderNo,
      [order_no],
      config.connectionString(),
    );

    if (
      oldOrderResult.code ||
      oldOrderResult.data.length === 0 ||
      oldOrderResult.data[0].status_deli != "A"
    ) {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message:
            "ไม่พบข้อมูลออเดอร์ที่สามารถแก้ไขได้ในระบบ Not Found Status Delivery หรือ Status Delivery ไม่ใช่ A",
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      res.status(200).send(response);
      let logPayloadObj = { order_no: "-", ...req.body[0] };
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "แก้ไขข้อมูล Order",
        JSON.stringify(logPayloadObj),
        "ไม่พบข้อมูลออเดอร์ที่สามารถแก้ไขได้ในระบบ Not Found Status Delivery หรือ Status Delivery ไม่ใช่ A",
        action[0].value,
      );
      return;
    } else {
      let oldOrder = oldOrderResult.data[0];

      let addOrderScript = `
                UPDATE tbl_order SET 
                    description = $1, 
                    deli_date_req = $2, 
                    deli_time_req = $3,
                    mdf_dt = $4
                WHERE id = $5`;

      let params = [
        description,
        deli_date_req,
        deli_time_req,
        moment().format("YYYY-MM-DD HH:mm:ss"),
        order_no,
      ];
      let tbl_temporary_add_order = await pgConn.getWithParams(
        dbPrefix + lic_code,
        addOrderScript,
        params,
        config.connectionString(),
      );

      if (tbl_temporary_add_order.code) {
        let response = [
          {
            status: "error",
            invalid_code: "-1",
            message: "ไม่สามารถแก้ไข Order ได้",
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];

        res.status(200).send(response);
        let logPayloadObj = { order_no: "-", ...req.body[0] };
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "แก้ไขข้อมูล Order",
          JSON.stringify(logPayloadObj),
          "ไม่สามารถแก้ไข Order ได้",
          action[0].value,
        );
        return;
      }

      let event_type = req.body[0].event_type || "override";

      // ========== Audit Log: สร้าง changes array สำหรับ order level ==========
      let orderLevelChanges = [];

      // -- เปรียบเทียบ order-level fields --
      //   if (oldOrder.description !== description) {
      //     orderLevelChanges.push({
      //       field: "Description",
      //       before: oldOrder.description || "",
      //       after: description || "",
      //     });
      //   }
      //   let oldDeliDate = oldOrder.deli_date_req
      //     ? moment(oldOrder.deli_date_req).format("YYYY-MM-DD")
      //     : "";
      //   if (oldDeliDate !== deli_date_req) {
      //     orderLevelChanges.push({
      //       field: "Delivery Date",
      //       before: oldDeliDate,
      //       after: deli_date_req || "",
      //     });
      //   }
      //   if ((oldOrder.deli_time_req || "") !== (deli_time_req || "")) {
      //     orderLevelChanges.push({
      //       field: "Delivery Time",
      //       before: oldOrder.deli_time_req || "",
      //       after: deli_time_req || "",
      //     });
      //   }

      if (orderLevelChanges.length > 0) {
        let logPayloadOrder = {
          order_no: oldOrder.order_no || "-",
          order_id: order_no,
          ship_to: oldOrder.ship_to || "",
          reason: req.body[0].remark || req.body[0].reason || description || "",
          changes: orderLevelChanges,
        };
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          event_type,
          JSON.stringify(logPayloadOrder),
          "success",
          action[0].value,
        );
      }

      // ============= UPDATE tbl_order_item (item_quantity) =================
      if (order_item && Array.isArray(order_item) && order_item.length > 0) {
        for (let i = 0; i < order_item.length; i++) {
          let currentItem = order_item[i];
          if (currentItem.item_no) {
            let item_no = currentItem.item_no;
            let item_quantity = parseFloat(currentItem.item_quantity) || 0;
            let remark = currentItem.remark || "";
            let itemChanges = [];

            // ========== Audit Log: ดึงค่าเก่าของ item ==========
            let getItemScript = `SELECT oi.id, oi.item_qty, oi.remark, itm.itm_desc 
                            FROM public.tbl_order_item oi 
                            LEFT JOIN tbl_item itm ON oi.item_no = itm.itm_code
                            WHERE oi.order_no = $1 and oi.item_no = $2 order by oi.id desc limit 1`;
            let oldItemResult = await pgConn.getWithParams(
              dbPrefix + lic_code,
              getItemScript,
              [order_no, item_no],
              config.connectionString(),
            );

            if (!oldItemResult.code && oldItemResult.data.length > 0) {
              let oldItem = oldItemResult.data[0];
              let itemLabel = oldItem.itm_desc || item_no;

              // -- เปรียบเทียบ item_qty --
              let oldQty = parseFloat(oldItem.item_qty) || 0;
              if (oldQty !== item_quantity) {
                itemChanges.push({
                  field: `Order Qty (${itemLabel})`,
                  before: String(oldQty),
                  after: String(item_quantity),
                });
              }
              // -- เปรียบเทียบ remark --
              if ((oldItem.remark || "") !== remark) {
                itemChanges.push({
                  field: `Remark (${itemLabel})`,
                  before: oldItem.remark || "",
                  after: remark,
                });
              }

              let script_item = `
                                UPDATE public.tbl_order_item
                                SET item_qty = $1, remark = $2, mdf_dt = $3
                                WHERE order_no = $4 and item_no = $5
                            `;
              let params = [
                item_quantity,
                remark,
                moment().format("YYYY-MM-DD HH:mm:ss"),
                order_no,
                item_no,
              ];
              let tbl_temporary_update_order_item = await pgConn.getWithParams(
                dbPrefix + lic_code,
                script_item,
                params,
                config.connectionString(),
              );
            } else {
              // ============= กรณีหาของเดิมไม่เจอ ให้ทำการ Insert ของใหม่เข้าไปเลยครับ โดยผูกกับ new_order_id =============
              itemChanges.push({
                field: `Order Qty (${item_no})`,
                before: "0",
                after: String(item_quantity),
              });

              let script_item = `
                                INSERT INTO public.tbl_order_item
                                (order_no, item_no, item_qty, long_text_id, long_text, ist_dt, order_item_flag, auto_order)
                                VALUES(
                                    ${order_no}, '${item_no}', ${item_quantity}, '', '', '${moment().format("YYYY-MM-DD HH:mm:ss")}', '1', '0'
                                )
                            `;
              await pgConn.execute(
                dbPrefix + lic_code,
                script_item,
                config.connectionString(),
              );
            }

            if (itemChanges.length > 0) {
              let logPayloadItem = {
                order_no: oldOrder.order_no || "-",
                order_id: order_no,
                ship_to: oldOrder.ship_to || "",
                reason:
                  remark || req.body[0].remark || req.body[0].reason || "",
                changes: itemChanges,
              };
              await xglobal.action_logs(
                lic_code,
                action[0].id,
                event_type,
                JSON.stringify(logPayloadItem),
                "success",
                action[0].value,
              );
            }
          }
        }
      }
      // ============= Success response =============
      let response = [
        {
          status: "success",
          invalid_code: "0",
          message: "",
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      res.status(200).send(response);
    }
  })().catch(async (err) => {
    console.log(err);
    let response = [
      {
        status: "error",
        invalid_code: "-4",
        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
        data: [],
        response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
      },
    ];
    res.status(200).send(response);
  });
};

// =========== แก้ไขรายการน้ำมันย่อย ===========
exports.editOrderItem = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let { order_id } = req.query;
    let { description, order_item, deli_date_req, deli_time_req, action } =
      req.body[0];

    // เช็คเฉพาะส่วนที่สำคัญ
    if (action == undefined || order_item == undefined) {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message:
            "ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];

      res.status(200).send(response);
      return;
    }

    let order_no = order_id || req.body[0].order_id || req.body[0].order_no;

    if (order_no == undefined || order_no == "") {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message: "ไม่สามารถบันทึกข้อมูล, เนื่องจากไม่พบ order_id",
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      res.status(200).send(response);
      return;
    }

    deli_date_req =
      deli_date_req != undefined
        ? moment(deli_date_req).format("YYYY-MM-DD")
        : moment().format("YYYY-MM-DD");
    deli_time_req = deli_time_req != undefined ? deli_time_req : "Z00";

    // ====================== เช็ค Validate item_quantity ======================
    // if (order_item && Array.isArray(order_item) && order_item.length > 0) {
    //   for (var i = 0; i < order_item.length; i++) {
    //     var item_quantity_check = order_item[i].item_quantity;
    //     if (!/^\d+(\.\d+)?$/.test(String(item_quantity_check))) {
    //       let response = [
    //         {
    //           status: "error",
    //           invalid_code: "-1",
    //           message:
    //             "ไม่สามารถบันทึกข้อมูล Order ได้ เนื่องจาก item_quantity ต้องเป็นตัวเลขที่ถูกต้องเท่านั้น (ห้ามมีเครื่องหมายพิเศษ หน้าข้อความ)",
    //           data: [],
    //           response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
    //         },
    //       ];
    //       res.status(200).send(response);
    //       return;
    //     }
    //   }
    // }

    let scriptCheckOrderNo = `SELECT id, order_no, sh_cus_ref, ship_to, status_deli, order_status FROM tbl_order WHERE id = $1`;
    let checkOrderNo = await pgConn.getWithParams(
      dbPrefix + lic_code,
      scriptCheckOrderNo,
      [order_no],
      config.connectionString(),
    );

    if (
      checkOrderNo.code ||
      checkOrderNo.data.length === 0 ||
      checkOrderNo.data[0].status_deli != "A"
    ) {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message:
            "ไม่พบข้อมูลออเดอร์ที่สามารถแก้ไขได้ในระบบ Not Found Status Delivery หรือ Status Delivery ไม่ใช่ A",
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      res.status(200).send(response);
      let logPayloadObj = { order_no: "-", ...req.body[0] };
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "แก้ไขข้อมูล Order",
        JSON.stringify(logPayloadObj),
        "ไม่พบข้อมูลออเดอร์ที่สามารถแก้ไขได้ในระบบ Not Found Status Delivery หรือ Status Delivery ไม่ใช่ A",
        action[0].value,
      );
      return;
    } else {
      let orderInfo = checkOrderNo.data[0];
      let event_type = req.body[0].event_type || "override";

      // --- ดึงข้อมูลพื้นฐาน (เช่น คลัง) จากรายการเดิมเก็บไว้ก่อน ---
      let getDeliPlantScript = `SELECT deli_plant FROM tbl_order_item WHERE order_no = $1 AND rm_dt IS NULL LIMIT 1`;
      let deliPlantRes = await pgConn.getWithParams(dbPrefix + lic_code, getDeliPlantScript, [order_no], config.connectionString());
      let default_deli_plant = (!deliPlantRes.code && deliPlantRes.data.length > 0) ? deliPlantRes.data[0].deli_plant : "";

      // --- ลบรายการเดิมทั้งหมด (Hard Delete) ---
      let deleteOldItemsScript = `DELETE FROM tbl_order_item WHERE order_no = $1`;
      await pgConn.execute2params(
        dbPrefix + lic_code,
        deleteOldItemsScript,
        [order_no],
        config.connectionString()
      );

      // --- เพิ่มรายการใหม่เข้าไปทั้งหมด ---
      let itemLogs = [];
      for (let i = 0; i < order_item.length; i++) {
        let item = order_item[i];
        let item_quantity = item.item_quantity;
        let item_no = item.item_no;
        let remark = item.remark;
        let ptrl_tank_code = item.ptrl_tank_code;

        if (parseFloat(item_quantity) > 0) {
          let insertScript = `
              INSERT INTO tbl_order_item (
                  order_no, item_no, item_qty, remark, ptrl_tank_code, 
                  ist_dt, auto_order, deli_plant, order_item_flag
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `;
          let insertParams = [
            order_no, item_no, item_quantity, remark, ptrl_tank_code,
            moment().format("YYYY-MM-DD HH:mm:ss"), 0, default_deli_plant, '1'
          ];
          await pgConn.execute2params(
            dbPrefix + lic_code,
            insertScript,
            insertParams,
            config.connectionString(),
          );

          itemLogs.push(`${item_no} (${item_quantity} L)`);
        }
      }

      // บันทึก Log การเปลี่ยนแปลงแบบสรุป
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "แก้ไขข้อมูล Order",
        JSON.stringify(req.body[0]),
        `อัปเดตรายการสินค้าใหม่ทั้งหมด: ${itemLogs.join(", ")}`,
        action[0].value,
      );

      // ========== อัปเดตข้อมูลหลักของออเดอร์ (อัปเดต Description และเวลาแก้ไข) ==========
      let updateOrder = `
                UPDATE tbl_order 
                SET description = $1, 
                    auto_order = $2,
                    mdf_dt = $3
                WHERE id = $4
            `;
      let paramsOrder = [
        description || "",
        0,
        moment().format("YYYY-MM-DD HH:mm:ss"),
        order_no
      ];
      await pgConn.execute2params(
        dbPrefix + lic_code,
        updateOrder,
        paramsOrder,
        config.connectionString(),
      );

      // ============= Success response =============
      let response = [
        {
          status: "success",
          invalid_code: "0",
          message: "",
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      res.status(200).send(response);
    }
  })().catch(async (err) => {
    console.log(err);
    let response = [
      {
        status: "error",
        invalid_code: "-4",
        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
        data: [],
        response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
      },
    ];
    res.status(200).send(response);
  });
};

// =========== Approve Order Status Deli ===========
exports.setStatusDeli = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let { order_no } = req.query;
    let { status_deli, action } = req.body[0];

    // เช็คเฉพาะส่วนที่สำคัญ
    if (status_deli == undefined || action == undefined) {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message:
            "ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];

      res.status(200).send(response);
      return;
    }

    // ========== Audit Log: ดึงข้อมูลเดิมก่อน update ==========
    let scriptCheckOrderNo = `SELECT id, order_no, sh_cus_ref, ship_to, status_deli, order_status FROM tbl_order WHERE order_no = $1`;
    let checkOrderNo = await pgConn.getWithParams(
      dbPrefix + lic_code,
      scriptCheckOrderNo,
      [order_no],
      config.connectionString(),
    );
    if (checkOrderNo.code || checkOrderNo.data.length == 0) {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message: "ไม่พบข้อมูลออเดอร์ในระบบ",
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];

      res.status(200).send(response);
      return;
    }

    let oldOrderData = checkOrderNo.data[0];
    let old_status_deli = oldOrderData.status_deli || "";

    let updateOrderScript = `UPDATE tbl_order SET status_deli = $1, mdf_dt = $2 WHERE order_no = $3`;
    let tbl_temporary_update_order = await pgConn.execute2params(
      dbPrefix + lic_code,
      updateOrderScript,
      [status_deli, moment().format("YYYY-MM-DD HH:mm:ss"), order_no],
      config.connectionString(),
    );

    if (tbl_temporary_update_order.code) {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message: "ไม่สามารถอัปเดตสถานะ Order ได้",
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];

      res.status(200).send(response);
      return;
    }

    // ============= Success response =============
    let response = [
      {
        status: "success",
        invalid_code: "0",
        message: "",
        data: [],
        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
      },
    ];

    res.status(200).send(response);
    let event_type = req.body[0].event_type || "approve";
    // ========== Audit Log: สร้าง changes array ==========
    let auditChangesApprove = [];
    if (old_status_deli !== status_deli) {
      auditChangesApprove.push({
        field: "Status Delivery",
        before: old_status_deli,
        after: status_deli,
      });
    }
    let logPayloadObj = {
      order_no: oldOrderData.order_no || "-",
      order_id: oldOrderData.id,
      ship_to: oldOrderData.ship_to || "",
      reason: req.body[0].remark || req.body[0].reason || "",
      changes: auditChangesApprove,
    };
    await xglobal.action_logs(
      lic_code,
      action[0].id,
      event_type,
      JSON.stringify(logPayloadObj),
      "success",
      action[0].value,
    );
    return;
  })().catch(async (err) => {
    console.log(err);
    let response = [
      {
        status: "error",
        invalid_code: "-4",
        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
        data: [],
        response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
      },
    ];
    res.status(200).send(response);
  });
};

// =========== ลบข้อมูลรายการสั่งซื้อ ===========
exports.removeOrderInformationById_bk = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let { order_id, action } = req.body[0];
    //เช็คเฉพาะส่วนที่สำคัญ
    if (order_id == undefined || lic_code == undefined || action == undefined) {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message: "ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];

      res.status(200).send(response);
      return;
    } else {
      // ดัก id เป็น array
      let order_idArr = Array.isArray(order_id) ? order_id : [order_id];
      let order_idIn = order_idArr.map((c) => `'${c}'`).join(", ");

      // ================= เช็ค Validate Status Deli และ Flag =================
      let scriptCheckStatus = `SELECT id, order_no, sh_cus_ref, ship_to, status_deli, order_flag FROM tbl_order WHERE id IN (${order_idIn})`;
      let status_deli_res = await pgConn.get(
        dbPrefix + lic_code,
        scriptCheckStatus,
        config.connectionString(),
      );

      if (status_deli_res.code || status_deli_res.data.length === 0) {
        let response = [
          {
            status: "error",
            invalid_code: "-1",
            message: "ไม่พบข้อมูลออเดอร์ที่สามารถลบได้ในระบบ",
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
        res.status(200).send(response);
        let logPayloadObj = { order_no: "-", ...req.body[0] };
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "ลบข้อมูล Order",
          JSON.stringify(logPayloadObj),
          "ไม่พบข้อมูลออเดอร์ที่สามารถลบได้ในระบบ",
          action[0].value,
        );
        return;
      }

      // ============ เช็คเงื่อนไขถ้าตัวไหนที่ปิด flag แล้วไม่ต้องบันทึก logs ============
      let closedOrders = status_deli_res.data.filter(
        (order) => order.order_flag === "0",
      );
      if (closedOrders.length > 0) {
        let response = [
          {
            status: "error",
            invalid_code: "-2",
            message: "ไม่สามารถลบข้อมูลเนื่องจากออเดอร์นี้ปิดใช้งานไปแล้ว",
            data: [],
            closed_orders: closedOrders.map((o) => o.order_no || o.id),
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
        res.status(200).send(response);
        let logPayloadObj = { order_no: "-", ...req.body[0] };
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "ลบข้อมูล Order",
          JSON.stringify(logPayloadObj),
          "ไม่สามารถลบข้อมูลเนื่องจากออเดอร์นี้ปิดใช้งานไปแล้ว",
          action[0].value,
        );
        return;
      }

      let validIds = [];
      let skippedIds = [];

      status_deli_res.data.forEach((order) => {
        if (order.status_deli === "A") {
          validIds.push(order.id);
        } else {
          skippedIds.push(order.id);
        }
      });

      // ถ้าไม่มีออเดอร์สถานะ A เลยสักตัวเดียว ให้ตีกลับ Error
      if (validIds.length === 0) {
        let response = [
          {
            status: "error",
            invalid_code: "-1",
            message:
              "ไม่สามารถยกเลิก/ลบออเดอร์ได้ เนื่องจากไม่มีออเดอร์ใดที่มี Status Delivery เป็น A",
            data: [],
            skipped_ids: skippedIds, // แนบไปบอกหน้าบ้านว่าตัวไหนโดนข้ามบ้าง
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];

        let logPayloadObj = { id: id, ...req.body[0] };
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "ลบข้อมูล Order",
          JSON.stringify(logPayloadObj),
          "ไม่สามารถยกเลิก/ลบออเดอร์ได้ เนื่องจากไม่มีออเดอร์ใดที่มี Status Delivery เป็น A",
          action[0].value,
        );

        res.status(200).send(response);
        return;
      }
      // ================= จบการเช็ค Status Deli =================
      let validIdIn = validIds.map((c) => `'${c}'`).join(", ");

      let script = `update tbl_order set order_flag = '0', rm_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}' 
            where id in (${validIdIn});`;

      let tbl_temporary = await pgConn.execute(
        dbPrefix + lic_code,
        script,
        config.connectionString(),
      );
      if (!tbl_temporary.code) {
        let successMessage =
          skippedIds.length > 0
            ? `ลบข้อมูล Order สำเร็จ ${validIds.length} รายการ (ข้าม Order ที่สถานะไม่ใช่ A จำนวน ${skippedIds.length} รายการ)`
            : "ลบข้อมูล Order ได้สำเร็จทั้งหมด";

        let response = [
          {
            status: "success",
            invalid_code: "0",
            message: successMessage,
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];

        const { event_type: req_event_type, remark, reason } = req.body[0];
        const log_event_type = req_event_type || "cancel_aos";
        const log_reason = remark || reason || "";

        // ========== Audit Log: บันทึกแยกรายออร์เดอร์ตามจำนวนที่ลบได้ ==========
        for (const validId of validIds) {
          const foundOrder = status_deli_res.data.find(
            (o) => String(o.id) === String(validId),
          );
          const order_no = foundOrder?.order_no || "-";
          const ship_to = foundOrder?.ship_to || "";

          const logPayload = {
            order_no,
            order_id: String(validId),
            ship_to,
            reason: log_reason,
            changes: [
              { field: "Order Status", before: "Active", after: "Cancelled" },
            ],
          };

          await xglobal.action_logs(
            lic_code,
            action[0].id,
            log_event_type,
            JSON.stringify(logPayload),
            "success",
            action[0].value,
          );
        }

        res.status(200).send(response);
        return;
      } else {
        let response = [
          {
            status: "error",
            invalid_code: "-3",
            message: `ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];

        let event_type = req.body[0].event_type || "cancel_aos";
        let logPayload = { order_no: "-", id: id, ...req.body[0] };
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          event_type,
          JSON.stringify(logPayload),
          "ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
          action[0].value,
        );

        res.status(200).send(response);
        return;
      }
    }
  })().catch(async (err) => {
    console.log(err);
    let response = [
      {
        status: "error",
        invalid_code: "-4",
        message: `ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
        data: [],
        response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
      },
    ];

    let event_type = req.body[0].event_type || "cancel";
    let logPayload = {
      order_no: "-",
      id: req.body[0].id || "",
      ...req.body[0],
    };
    await xglobal.action_logs(
      lic_code,
      action[0].id,
      event_type,
      JSON.stringify(logPayload),
      "ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      action[0].value,
    );
    res.status(200).send(response);
    return;
  });
};

// ============= ลบข้อมูลออเดอร์ =============
exports.removeOrderInformationById = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let { order_id, action } = req.body[0];
    //เช็คเฉพาะส่วนที่สำคัญ
    if (order_id == undefined || lic_code == undefined || action == undefined) {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message: "ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];

      res.status(200).send(response);
      await xglobal.action_logs(
        lic_code,
        action ? action[0].id : "-",
        "cancel",
        JSON.stringify({ order_no: "-", ...req.body[0] }),
        "ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        action ? action[0].value : "-",
      );
      return;
    }

    // ดัก id เป็น array
    let order_idArr = Array.isArray(order_id) ? order_id : [order_id];
    let order_idIn = order_idArr.map((c) => `${c}`).join(", ");

    // --- Start Unlink Logic (AOS-Linked Order) ---
    try {
      let scriptCheckMaster = `SELECT id, master_order_id, consignment_no FROM public.tbl_order WHERE id IN (${order_idIn})`;
      let masterCheckResult = await pgConn.get(dbPrefix + lic_code, scriptCheckMaster, config.connectionString());
      if (!masterCheckResult.code && masterCheckResult.data.length > 0) {
        for (let orderRow of masterCheckResult.data) {
          if (orderRow.master_order_id == 1 && orderRow.consignment_no) {
            let unlinkScript = `UPDATE public.tbl_order SET master_order_id = NULL, consignment_no = NULL WHERE consignment_no = $1 AND master_order_id = 2`;
            await pgConn.executeWithParams(dbPrefix + lic_code, unlinkScript, [orderRow.consignment_no], config.connectionString());
          }
        }
      }
    } catch (e) { console.error("Unlink Error:", e); }
    // --- End Unlink Logic ---

    // ========== Audit Log: ดึงข้อมูล order ก่อนลบ ==========
    let scriptGetOrders = `SELECT id, order_no, sh_cus_ref, ship_to, status_deli FROM tbl_order WHERE id IN (${order_idIn});`;
    let rs = await pgConn.get(
      dbPrefix + lic_code,
      scriptGetOrders,
      config.connectionString(),
    );
    console.log(rs);
    let orderData = rs.data;
    let dataResponse = [];
    let auditChangesMain = [];

    for (let item of orderData) {
      if (item.status_deli !== "A") {
        dataResponse.push({
          order_no: item.order_no,
          message: "สถานะถูกวางแผนแล้ว ไม่สามารถลบได้",
        });
      } else {
        dataResponse.push({
          order_no: item.order_no,
          message: "ลบข้อมูล Order สำเร็จ",
        });

        let script = `
                    update tbl_order set order_flag = '0', rm_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}' 
                    where id = '${item.id}';
                `;
        await pgConn.execute(
          dbPrefix + lic_code,
          script,
          config.connectionString(),
        );
      }
    }

    // ========== Audit Log (บันทึกแยกรายออร์เดอร์ตามจำนวนที่ส่งมา) ==========
    const { event_type: req_event_type, remark, reason } = req.body[0];
    const log_event_type = req_event_type || "cancel";
    const log_reason = remark || reason || "";

    for (const current_id of order_idArr) {
      const foundOrder = orderData.find(
        (o) => String(o.id) === String(current_id),
      );
      const order_no = foundOrder?.order_no || "-";
      const ship_to = foundOrder?.ship_to || "";
      const status = foundOrder ? "success" : "order not found";

      const changes =
        foundOrder?.status_deli === "A"
          ? [{ field: "Order Status", before: "Confirmed", after: "Cancelled" }]
          : [];

      const logPayload = {
        order_no,
        order_id: String(current_id),
        ship_to,
        reason: log_reason,
        changes,
      };

      await xglobal.action_logs(
        lic_code,
        action[0].id,
        log_event_type,
        JSON.stringify(logPayload),
        status,
        action[0].value,
      );
    }

    let response = [
      {
        status: "success",
        invalid_code: "0",
        message: "ลบข้อมูล Order สำเร็จ",
        data: dataResponse,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
      },
    ];

    res.status(200).send(response);
  })().catch(async (err) => {
    console.log(err);
    let response = [
      {
        status: "error",
        invalid_code: "-4",
        message: `ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
        data: [],
        response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
      },
    ];
    res.status(200).send(response);
    let event_type = req.body[0].event_type || "cancel";
    let logPayload = {
      order_no: "-",
      id: req.body[0].order_id || req.body[0].id || "",
      ...req.body[0],
    };
    await xglobal.action_logs(
      lic_code,
      action[0].id,
      event_type,
      JSON.stringify(logPayload),
      "ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      action[0].value,
    );
    return;
  });
};

// =========== สร้างรายการสั่งซื้อใหม่ (Re-create Order) ===========
exports.reCreateOrderInformation = async (req, res, next) => {
  try {
    const lic_code = req.header("lic_code");
    const payload = req.body[0] || {};
    const { id, action } = payload;

    // ====================== เช็คข้อมูลที่ต้องใช้ ======================
    if (id === undefined || action === undefined) {
      return res.status(200).send([
        {
          status: "error",
          invalid_code: "-1",
          message:
            "ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ]);
    }

    const idList = Array.isArray(id) ? id : [id];
    const newOrders = [];
    const currentDateTime = moment().format("YYYY-MM-DD HH:mm:ss");
    const req_date_str = moment().format("YYYYMMDD");

    // ====================== ดึงเลข MAX ตัวล่าสุดของวัน ======================
    let scriptCheckShCusRef = `
            SELECT MAX(CAST(SUBSTRING(sh_cus_ref FROM 12) AS INTEGER)) as last_running 
            FROM public.tbl_order 
            WHERE sh_cus_ref LIKE 'AOS${req_date_str}%' AND sh_cus_ref ~ '^AOS[0-9]{8}[0-9]+$'
        `;
    let checkShCusRefResult = await pgConn.get(
      dbPrefix + lic_code,
      scriptCheckShCusRef,
      config.connectionString(),
    );

    let running_number = 1;
    if (
      !checkShCusRefResult.code &&
      checkShCusRefResult.data.length > 0 &&
      checkShCusRefResult.data[0].last_running !== null
    ) {
      running_number = parseInt(checkShCusRefResult.data[0].last_running) + 1;
    }

    // ====================== วนลูปสร้าง Order ใหม่ ======================
    for (const currentId of idList) {
      if (!currentId) continue;

      // ====================== ดึงข้อมูล Order เดิม ======================
      const scriptGetOrder = `SELECT * FROM tbl_order WHERE id = ${currentId}`;
      const oldOrderRes = await pgConn.get(
        dbPrefix + lic_code,
        scriptGetOrder,
        config.connectionString(),
      );

      if (
        oldOrderRes.code ||
        !oldOrderRes.data ||
        oldOrderRes.data.length === 0
      )
        continue;
      const oldOrder = oldOrderRes.data[0];

      // ====================== ดึง Item เดิม ======================
      const order_no_to_check =
        oldOrder.order_id || oldOrder.order_no || currentId;
      const scriptGetItems = `SELECT * FROM tbl_order_item WHERE order_no = '${order_no_to_check}' AND order_item_flag = '1'`;
      const oldItemsRes = await pgConn.get(
        dbPrefix + lic_code,
        scriptGetItems,
        config.connectionString(),
      );
      const order_items =
        !oldItemsRes.code && oldItemsRes.data ? oldItemsRes.data : [];

      // ====================== สร้าง Reference ใหม่ตามรอบลูป ======================
      const current_sh_cus_ref =
        "AOS" + req_date_str + String(running_number).padStart(4, "0");
      running_number++;

      // ====================== Insert Order ใหม่ ======================
      const insertOrderScript = `
                INSERT INTO tbl_order (
                    order_type, order_group, chanel, division, sold_to, ship_to,
                    cus_ref, cus_date_ref, po_name, order_by, ship_cond, pay_term,
                    deli_date_req, deli_time_req, description, sh_cus_ref, sh_cus_date_ref,
                    status_deli, ist_dt, order_flag, auto_order, order_status, order_ref
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
                    $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 
                    $21, $22, $23
                ) RETURNING id`;

      const paramsOrder = [
        oldOrder.order_type || "",
        oldOrder.order_group || "",
        oldOrder.chanel || "",
        oldOrder.division || "",
        oldOrder.sold_to || "",
        oldOrder.ship_to || "",
        oldOrder.cus_ref || "",
        oldOrder.cus_date_ref
          ? moment(oldOrder.cus_date_ref).format("YYYY-MM-DD HH:mm:ss")
          : null,
        oldOrder.po_name || "AOS",
        oldOrder.order_by || "AOS",
        oldOrder.ship_cond || "T1",
        oldOrder.pay_term || "",
        moment().format("YYYY-MM-DD"),
        oldOrder.deli_time_req || "Z00",
        oldOrder.description || "",
        current_sh_cus_ref,
        currentDateTime,
        "A",
        currentDateTime,
        "1",
        "0",
        "0",
        oldOrder.id,
      ];

      const resNewOrder = await pgConn.execute2params(
        dbPrefix + lic_code,
        insertOrderScript,
        paramsOrder,
        config.connectionString(),
      );

      if (resNewOrder.code) {
        console.log(
          `⚠️ ไม่สามารถสร้าง Order ใหม่ให้ ID: ${currentId} ได้ (อาจจะเลขซ้ำหรือข้อมูลผิด)`,
        );
        continue;
      }

      // ====================== ดึง ID ใหม่มาใช้ ======================
      let newOrderId = resNewOrder.data?.[0]?.id;
      if (!newOrderId) {
        const newIdResult = await pgConn.get(
          dbPrefix + lic_code,
          `SELECT id FROM tbl_order WHERE sh_cus_ref = '${current_sh_cus_ref}' ORDER BY id DESC LIMIT 1`,
          config.connectionString(),
        );
        if (!newIdResult.code && newIdResult.data.length > 0)
          newOrderId = newIdResult.data[0].id;
      }

      if (!newOrderId) continue;

      // ====================== Insert Items ใหม่ ======================
      if (order_items.length > 0) {
        for (const oldItem of order_items) {
          const insertItemScript = `INSERT INTO tbl_order_item (order_no, item_no, item_qty, ist_dt, order_item_flag, auto_order, deli_plant, sales_order_item) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
          await pgConn.execute2params(
            dbPrefix + lic_code,
            insertItemScript,
            [
              newOrderId,
              oldItem.item_no || "",
              parseFloat(oldItem.item_qty) || 0,
              currentDateTime,
              "1",
              "0",
              oldItem.deli_plant || "",
              oldItem.sales_order_item || "",
            ],
            config.connectionString(),
          );
        }
      }

      // ====================== บันทึกผลลัพธ์และ Log ======================
      newOrders.push({
        old_id: currentId,
        new_id: newOrderId,
        sh_cus_ref: current_sh_cus_ref,
      });
      await xglobal.action_logs(
        lic_code,
        action[0]?.id,
        "re_order_duplicate",
        JSON.stringify({
          old_id: currentId,
          new_order_id: newOrderId,
          sh_cus_ref: current_sh_cus_ref,
        }),
        "success",
        action[0]?.value,
      );
    }

    // ====================== ส่งผลลัพธ์ ======================
    return res.status(200).send([
      {
        status: "success",
        invalid_code: "0",
        message: `ทำการ Re-order เรียบร้อยแล้ว (${newOrders.length} รายการ)`,
        data: newOrders,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
      },
    ]);
  } catch (err) {
    console.error("Error in reCreateOrderInformation:", err);
    return res.status(200).send([
      {
        status: "error",
        invalid_code: "-4",
        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
        data: [],
        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
      },
    ]);
  }
};



// exports.reCreateOrderInformation = async (req, res, next) => {

//     return (async () => {
//         let lic_code = req.header('lic_code');
//         let {
//             id,
//             action
//         } = req.body[0];

//         // เช็คเฉพาะส่วนที่สำคัญ
//         if (id == undefined || action == undefined) {
//             let response = [{
//                 status: 'error',
//                 invalid_code: '-1',
//                 message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
//                 data: [],
//                 response_time: moment().format('YYYY-MM-DD HH:mm:ss')
//             }]

//             res.status(200).send(response);
//             return;
//         }

//         try {

//             let idList = Array.isArray(id) ? id : [id];
//             let newOrders = [];

//             for (let i = 0; i < idList.length; i++) {
//                 let currentId = idList[i];
//                 if (!currentId) continue;

//                 // ============ ดึงข้อมูล Order ต้นฉบับ ============
//                 let script_get_order = `SELECT * FROM tbl_order WHERE id = $1`;
//                 let old_order_res = await pgConn.execute2params(script_get_order, [currentId]);

//                 if (old_order_res.code || old_order_res.data.length === 0) {
//                     console.log(`⚠️ ไม่พบข้อมูล Order ต้นฉบับ ID: ${currentId}`);
//                     continue;
//                 }

//                 let oldOrder = old_order_res.data[0];

//                 console.log(oldOrder.order_no);

//                 // ============ ดึงข้อมูลรายการสินค้า (Items) ทั้งหมดจาก Order ต้นฉบับ ============
//                 let script_get_items = `SELECT * FROM tbl_order_item WHERE order_no = $1 AND order_item_flag = '1'`;
//                 let old_items_res = await pgConn.execute2params(script_get_items, [currentId.toString()]);
//                 let order_items = old_items_res.data || [];

//                 // ============ สร้าง sh_cus_ref ใหม่ตามรูปแบบ AOS + YYYYMMDD + Running Number ============
//                 let req_date_str = moment().format('YYYYMMDD');
//                 let script_check_sh_cus_ref = `
//                     SELECT MAX(CAST(SUBSTRING(sh_cus_ref FROM 12) AS INTEGER)) as last_running
//                     FROM tbl_order
//                     WHERE sh_cus_ref LIKE $1 AND sh_cus_ref ~ '^AOS[0-9]{8}[0-9]+$'
//                 `;
//                 let check_sh_res = await pgConn.execute2params(script_check_sh_cus_ref, ['AOS' + req_date_str + '%'], config.connectionString());

//                 let running_number = 1;
//                 if (!check_sh_res.code && check_sh_res.data.length > 0 && check_sh_res.data[0].last_running !== null) {
//                     running_number = parseInt(check_sh_res.data[0].last_running) + 1;
//                 }

//                 // ============ ปรับ running_number หากมีการสร้างในลูปนี้ไปแล้ว ============
//                 if (newOrders.length > 0) {
//                     let lastInBatch = newOrders[newOrders.length - 1].sh_cus_ref;
//                     if (lastInBatch.startsWith('AOS' + req_date_str)) {
//                         let lastRunningInBatch = parseInt(lastInBatch.substring(11));
//                         if (lastRunningInBatch >= running_number) {
//                             running_number = lastRunningInBatch + 1;
//                         }
//                     }
//                 }

//                 let new_sh_cus_ref = 'AOS' + req_date_str + String(running_number).padStart(4, '0');

//                 // ============ สร้าง Order ใหม่ ============
//                 let insert_order_script = `INSERT INTO tbl_order
//                     (order_no, order_type, order_group, chanel, division, sold_to, ship_to,
//                         cus_ref, cus_date_ref, po_name, order_by, ship_cond, pay_term,
//                         deli_date_req, deli_time_req, description, sh_cus_ref, sh_cus_date_ref,
//                         status_deli, ist_dt, order_flag, auto_order, order_status)
//                     VALUES
//                     (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22) RETURNING id`;

//                 let params_order = [
//                     oldOrder.order_type || '', oldOrder.order_group || '', oldOrder.chanel || '', oldOrder.division || '',
//                     oldOrder.sold_to || '', oldOrder.ship_to || '', oldOrder.cus_ref || '',
//                     oldOrder.cus_date_ref ? moment(oldOrder.cus_date_ref).format('YYYY-MM-DD HH:mm:ss') : null,
//                     oldOrder.po_name || 'AOS', oldOrder.order_by || 'AOS', oldOrder.ship_cond || 'T1', oldOrder.pay_term || '',
//                     moment().format('YYYY-MM-DD'), oldOrder.deli_time_req || 'Z00', oldOrder.description || '',
//                     new_sh_cus_ref, moment().format('YYYY-MM-DD HH:mm:ss'), 'A', moment().format('YYYY-MM-DD HH:mm:ss'), '1', 0, 0
//                 ];

//                 let res_new_order = await pgConn.execute2params(insert_order_script, params_order);

//                 if (!res_new_order.code && res_new_order.data.length > 0) {
//                     let newOrderId = res_new_order.data[0].id;

//                     // ============ คัดลอกรายการสินค้าจาก Order ต้นฉบับมายัง Order ใหม่ ============
//                     for (let j = 0; j < order_items.length; j++) {
//                         let oldItem = order_items[j];
//                         let insert_item_script = `INSERT INTO tbl_order_item
//                             (order_no, item_no, item_qty, ist_dt, order_item_flag, auto_order,
//                              deli_plant, sales_order_item)
//                             VALUES
//                             ($1, $2, $3, $4, $5, $6, $7, $8)`;

//                         let params_item = [
//                             newOrderId, oldItem.item_no || '', parseFloat(oldItem.item_qty) || 0,
//                             moment().format('YYYY-MM-DD HH:mm:ss'), '1', 0,
//                             oldItem.deli_plant || '', oldItem.sales_order_item || ''
//                         ];

//                         await pgConn.execute2params(insert_item_script, params_item);
//                     }

//                     newOrders.push({
//                         old_id: currentId,
//                         new_id: newOrderId,
//                         sh_cus_ref: new_sh_cus_ref
//                     });

//                     let logPayload = { old_id: currentId, new_order_id: newOrderId, sh_cus_ref: new_sh_cus_ref };
//                     await xglobal.action_logs(lic_code, action[0].id, 're_order_duplicate', JSON.stringify(logPayload), 'success', action[0].value);
//                 }
//             }

//             let response = [{
//                 status: 'success',
//                 invalid_code: '0',
//                 message: `ทำการ Re-order เรียบร้อยแล้ว (${newOrders.length} รายการ)`,
//                 data: newOrders,
//                 response_time: moment().format('YYYY-MM-DD HH:mm:ss')
//             }];

//             res.status(200).send(response);

//         } catch (err) {
//             console.log(err);
//             let response = [{
//                 status: 'error',
//                 invalid_code: '-99',
//                 message: 'Internal Server Error: ' + err.message,
//                 data: [],
//                 response_time: moment().format('YYYY-MM-DD HH:mm:ss')
//             }];
//             res.status(200).send(response);
//         }

//     })().catch(async (err) => {
//         console.log(err);
//         let response = [{
//             status: 'error',
//             invalid_code: '-4',
//             message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
//             data: [],
//             response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
//         }]
//         res.status(200).send(response);
//     });

// }

// ====================== สร้าง Order แบบพ่วง (Linked Order) ======================
exports.addLinkedOrderInformation = async (req, res, next) => {
  try {
    const lic_code = req.header('lic_code');
    const {
      order_type, order_group, chanel, division, sold_to, ship_to,
      cus_ref, cus_date_ref, po_name, order_by, ship_cond, pay_term,
      deli_date_req, deli_time_req, description, sh_cus_ref, sh_cus_date_ref,
      order_item, action, child_order_id
    } = req.body[0] || {};

    // ======= 1. ตรวจสอบพารามิเตอร์ที่จำเป็น =======
    const missing = [];
    if (!lic_code) missing.push('lic_code');
    if (!order_type) missing.push('order_type');
    if (!order_group) missing.push('order_group');
    if (!sold_to) missing.push('sold_to');
    if (!ship_to) missing.push('ship_to');
    if (!deli_date_req) missing.push('deli_date_req');
    if (!deli_time_req) missing.push('deli_time_req');
    if (!order_item || !Array.isArray(order_item)) missing.push('order_item (Array)');
    if (!action) missing.push('action');
    if (!child_order_id || !Array.isArray(child_order_id)) missing.push('child_order_id (Array)');

    if (missing.length > 0) {
      return sendResponse(res, 'error', '-1', `ข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`, []);
    }

    const now = moment().format('YYYY-MM-DD HH:mm:ss');


    // ======= 2. รัน Transaction =======
    const transactionResult = await pgConn.runTransaction(dbPrefix + lic_code, async (client) => {
      const consignment_no = 'CSMN-' + moment().format('YYYYMMDD') + Math.floor(100000 + Math.random() * 900000);

      // (2.1) จัดการ sh_cus_ref และ sh_cus_date_ref (เหมือน addOrderInformation)
      let final_sh_cus_ref = sh_cus_ref;
      let req_date_str = moment(deli_date_req).format("YYYYMMDD");

      if (!final_sh_cus_ref) {
        let scriptCheckShCusRef = `
          SELECT MAX(CAST(SUBSTRING(sh_cus_ref FROM 12) AS INTEGER)) as last_running 
          FROM public.tbl_order 
          WHERE sh_cus_ref LIKE 'AOS${req_date_str}%' AND sh_cus_ref ~ '^AOS[0-9]{8}[0-9]+$'
        `;
        let checkRes = await client.query(scriptCheckShCusRef);
        let running_number = 1;
        if (checkRes.rows.length > 0 && checkRes.rows[0].last_running !== null) {
          running_number = parseInt(checkRes.rows[0].last_running) + 1;
        }
        final_sh_cus_ref = "AOS" + req_date_str + String(running_number).padStart(4, "0");
      }

      // (2.2) บันทึกออเดอร์หลัก
      const mainOrderScript = `
        INSERT INTO public.tbl_order
        (order_type, order_group, chanel, division, sold_to, ship_to,
            cus_ref, cus_date_ref, po_name, order_by, ship_cond, pay_term,
            deli_date_req, deli_time_req, description, sh_cus_ref, sh_cus_date_ref,
            status_deli, ist_dt, order_flag, auto_order, order_status, created_by_tms,
            master_order_id, consignment_no)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
        RETURNING id
      `;
      const mainParams = [
        order_type, order_group, chanel || '01', division || '04',
        sold_to, ship_to, cus_ref || "",
        cus_date_ref ? moment(cus_date_ref).format("YYYY-MM-DD HH:mm:ss") : null,
        po_name || "AOS", order_by || "AOS", ship_cond || "T1", pay_term || "",
        deli_date_req ? moment(deli_date_req).format("YYYY-MM-DD HH:mm:ss") : null,
        deli_time_req, description || "", final_sh_cus_ref,
        sh_cus_date_ref ? moment(sh_cus_date_ref).format("YYYY-MM-DD HH:mm:ss") : (deli_date_req ? moment(deli_date_req).format("YYYY-MM-DD HH:mm:ss") : null),
        'A', now, '1', 0, 0, action[0].id, 1, consignment_no
      ];

      const mainRes = await client.query(mainOrderScript, mainParams);
      const master_id = mainRes.rows[0].id;

      // (2.2) อัปเดตออเดอร์พ่วง
      if (child_order_id.length > 0) {
        const updateChildScript = `
          UPDATE public.tbl_order 
          SET master_order_id = 2, consignment_no = $1
          WHERE id = ANY($2) AND rm_dt IS NULL AND order_status = 0
        `;
        await client.query(updateChildScript, [consignment_no, child_order_id]);
      }

      // (2.3) บันทึกรายการสินค้า
      let invalid_material_item = [];
      for (const itm of order_item) {
        const getItmRes = await client.query(`SELECT itm_code FROM tbl_item WHERE itm_material_number = $1 LIMIT 1`, [itm.itm_material_number]);
        if (getItmRes.rows.length > 0) {
          const itm_code = getItmRes.rows[0].itm_code;
          const maxRes = await client.query(`SELECT MAX(CAST(sales_order_item AS INTEGER)) as last_running FROM public.tbl_order_item`);
          const nextRunning = (maxRes.rows[0].last_running ? parseInt(maxRes.rows[0].last_running) : 0) + 1;

          const insertItemScript = `
            INSERT INTO public.tbl_order_item(order_no, item_no, item_qty, ist_dt, order_item_flag, auto_order, deli_plant, sales_order_item, remark, ptrl_tank_code)
            VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `;
          const itemParams = [master_id, itm_code, itm.item_quantity, now, '1', 0, itm.deli_plant || "", nextRunning, itm.remark || "", itm.ptrl_tank_code || ""];
          await client.query(insertItemScript, itemParams);
        } else {
          invalid_material_item.push(itm.itm_material_number);
        }
      }

      return { master_id, consignment_no, invalid_material_item };
    }, config.connectionString());

    // ======= 3. ตรวจสอบผลลัพธ์ Transaction =======
    if (transactionResult.code) {
      return sendResponse(res, 'error', '-3', `ไม่สามารถบันทึกข้อมูลได้: ${transactionResult.message}`, []);
    }

    const { master_id, consignment_no, invalid_material_item } = transactionResult.data;

    // ======= 4. บันทึก Log และส่งคำตอบกลับ =======
    await xglobal.action_logs(lic_code, action[0].id, 'สร้างออเดอร์พ่วง', JSON.stringify(req.body[0]), 'success', action[0].value);
    return sendResponse(res, 'success', '0', 'สร้างออเดอร์พ่วงสำเร็จ', [{
      order_id: master_id,
      consignment_no: consignment_no,
      invalid_material_item: invalid_material_item
    }]);

  } catch (err) {
    console.error(err);
    return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบในการสร้างออเดอร์พ่วง', []);
  }
};

exports.setLinkedOrderInformation = async (req, res, next) => {
  try {
    const lic_code = req.header('lic_code');
    const {
      order_id,
      child_order_id,
      action
    } = req.body[0] || {};

    // ======= 1. ตรวจสอบพารามิเตอร์ที่จำเป็น =======
    const missing = [];
    if (!lic_code) missing.push('lic_code');
    if (!order_id) missing.push('order_id');
    if (!child_order_id || !Array.isArray(child_order_id)) missing.push('child_order_id (Array)');
    if (!action) missing.push('action');

    if (missing.length > 0) {
      return sendResponse(res, 'error', '-1', `ข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`, []);
    }

    const now = moment().format('YYYY-MM-DD HH:mm:ss');

    // ======= 2. รัน Transaction เพื่ออัปเดตความสัมพันธ์ใหม่ =======
    const transactionResult = await pgConn.runTransaction(dbPrefix + lic_code, async (client) => {

      // ดึง consignment_no จากออเดอร์หลัก
      const getConsignmentNoRes = await client.query(`SELECT consignment_no FROM tbl_order WHERE id = $1 AND rm_dt IS NULL`, [order_id]);
      if (!getConsignmentNoRes.rows.length) {
        return { code: '-3', message: 'ไม่พบข้อมูลออเดอร์หลัก หรือออเดอร์หลักไม่มี consignment_no' };
      }
      const consignment_no = getConsignmentNoRes.rows[0].consignment_no;


      if (!consignment_no) {
        return { code: '-4', message: 'ออเดอร์หลักนี้ยังไม่มีการตั้งเลข consignment_no' };
      }

      //  ยืนยันตัวหลักเป็น Master
      const updateMasterScript = `
        UPDATE tbl_order 
        SET master_order_id = 1, mdf_dt = $1
        WHERE id = $2 AND rm_dt IS NULL
      `;
      await client.query(updateMasterScript, [now, order_id]);

      //  อัปเดตออเดอร์ตัวอื่นๆ ให้มาเป็นออเดอร์พ่วง ของกลุ่มนี้
      if (child_order_id.length > 0) {
        const updateChildScript = `
          UPDATE tbl_order 
          SET master_order_id = 2, consignment_no = $1, mdf_dt = $2
          WHERE id = ANY($3) AND rm_dt IS NULL AND order_status = 0
        `;
        await client.query(updateChildScript, [consignment_no, now, child_order_id]);
      }

      return { order_id, consignment_no };
    }, config.connectionString());

    // ======= 3. ตรวจสอบผลลัพธ์ =======
    if (transactionResult.code) {
      return sendResponse(res, 'error', '-3', `ไม่สามารถบันทึกข้อมูลได้: ${transactionResult.message}`, []);
    }

    const { order_id: final_id, consignment_no: final_consignment } = transactionResult.data;

    // ======= 4. บันทึก Log และส่งคำตอบกลับ =======
    await xglobal.action_logs(lic_code, action[0].id, 'ปรับปรุงการพ่วงออเดอร์', JSON.stringify(req.body[0]), 'success', action[0].value);
    return sendResponse(res, 'success', '0', 'อัปเดตการพ่วงออเดอร์สำเร็จ', [{
      order_id: final_id,
      consignment_no: final_consignment
    }]);

  } catch (err) {
    console.error(err);
    return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบในการอัปเดตออเดอร์พ่วง', []);
  }
};

// ====================== ปลดออเดอร์ออกจากกลุ่มพ่วง (Unlink) ======================
exports.unlinkOrderInformation = async (req, res, next) => {
  try {
    const lic_code = req.header('lic_code');
    const { order_id, action } = req.body[0] || {};

    // ======= 1. ตรวจสอบพารามิเตอร์ที่จำเป็น =======
    const missing = [];
    if (!lic_code) missing.push('lic_code');
    if (!order_id) missing.push('order_id');
    if (!action) missing.push('action');

    if (missing.length > 0) {
      return sendResponse(res, 'error', '-1', `ข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`, []);
    }

    // ======= 2. ตรวจสอบสถานะและเงื่อนไข (ต้องเป็นลูกพ่วงและยังไม่ถูกจัดส่ง) =======
    const checkScript = `SELECT master_order_id, order_status FROM public.tbl_order WHERE id = $1 AND rm_dt IS NULL`;
    const checkRes = await pgConn.getWithParams(dbPrefix + lic_code, checkScript, [order_id], config.connectionString());

    if (checkRes.data.length === 0) {
      return sendResponse(res, 'error', '-2', 'ไม่พบข้อมูลออเดอร์ในระบบ', []);
    }

    const orderData = checkRes.data[0];

    if (orderData.master_order_id != 2) {
      return sendResponse(res, 'error', '-2', 'ออเดอร์นี้ไม่ได้เป็นออเดอร์พ่วง (Child Order) จึงไม่สามารถปลดได้', []);
    }

    if (orderData.order_status != 0) {
      return sendResponse(res, 'error', '-3', 'ออเดอร์ถูกวางแผนหรือจัดส่งแล้ว ไม่สามารถปลดออกจากการพ่วงได้', []);
    }

    // ======= 3. ดำเนินการปลดการพ่วง (Update เป็น NULL) =======
    const updateScript = `UPDATE public.tbl_order SET master_order_id = NULL, consignment_no = NULL WHERE id = $1`;
    const updateRes = await pgConn.execute2params(dbPrefix + lic_code, updateScript, [order_id], config.connectionString());

    if (updateRes.affected_rows === 0) {
      return sendResponse(res, 'error', '-4', 'ไม่สามารถปลดการพ่วงได้ เนื่องจากไม่พบข้อมูลออเดอร์ที่ตรงกับเงื่อนไข', []);
    }

    // ======= 4. บันทึก Log และส่งคำตอบกลับ =======
    await xglobal.action_logs(lic_code, action[0].id, 'ปลดออเดอร์พ่วงออกด้วยตนเอง', JSON.stringify(req.body[0]), 'success', action[0].value);
    return sendResponse(res, 'success', '0', 'ปลดการพ่วงสำเร็จ ออเดอร์ของคุณกลับเป็นออเดอร์ปกติแล้ว', []);

  } catch (err) {
    console.error(err);
    return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบในการปลดออเดอร์พ่วง', []);
  }
};

// ====================== ดึงรายการออเดอร์ที่พ่วงกัน (Linked Order List) ======================
exports.getLinkedOrderList = async (req, res, next) => {
  try {
    const lic_code = req.header('lic_code');
    const { consignment_no, order_id, master_order_id } = req.body[0] || {};

    // ======= 1. ตรวจสอบพารามิเตอร์ขาเข้า =======
    const missing = [];
    if (!lic_code) missing.push('lic_code');
    if (!consignment_no) missing.push('consignment_no');
    if (!order_id) missing.push('order_id');

    if (missing.length > 0) {
      return sendResponse(res, 'error', '-1', `ข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`, []);
    }

    // ======= 2. ตรวจสอบ Role ของผู้เรียก =======
    let requesterRole = master_order_id;
    if (requesterRole === undefined) {
      const checkRoleScript = `SELECT master_order_id FROM public.tbl_order WHERE id = $1 AND rm_dt IS NULL`;
      const roleRes = await pgConn.getWithParams(dbPrefix + lic_code, checkRoleScript, [order_id], config.connectionString());

      if (roleRes.data.length === 0) {
        return sendResponse(res, 'error', '-2', 'ไม่พบข้อมูลออเดอร์ของผู้เรียกในระบบ', []);
      }
      requesterRole = roleRes.data[0].master_order_id;
    }

    if (requesterRole === null || requesterRole === undefined) {
      return sendResponse(res, 'error', '-2', 'ไม่สามารถระบุสถานะ (Master/Child) ของออเดอร์นี้ได้', []);
    }

    // ======= 3. ดึงข้อมูลรายการในกลุ่มพ่วง =======
    let listScript = `
      SELECT 
        tbl_order.id, 
        tbl_order.order_no, 
        tbl_order.sh_cus_ref as aos_order_no, 
        tbl_order.order_type, 
        tbl_order.order_group, 
        tbl_order_type.ord_type_desc,
        tbl_petrol_group.ptrl_group_desc,
        tbl_order.order_status,
        tbl_order.chanel, 
        tbl_order.division, 
        tbl_order.sold_to, 
        tbl_order.ship_to, 
        tbl_petrol.ptrl_code, 
        tbl_petrol.ptrl_number, 
        tbl_petrol.ptrl_sitecode,
        tbl_petrol.ptrl_desc, 
        tbl_order.cus_ref, 
        tbl_order.cus_date_ref, 
        tbl_order.po_name, 
        tbl_order.order_by, 
        tbl_order.ship_cond, 
        tbl_order.pay_term, 
        tbl_order.deli_date_req, 
        tbl_master_time.time_value as deli_time_req, 
        tbl_order.description, 
        tbl_order.sh_cus_date_ref, 
        tbl_order.status_deli, 
        tbl_order.status_block, 
        tbl_order.status_sd_process, 
        tbl_order.status_check, tbl_order.sd_doc_reject, tbl_order.cus_group, 
        tbl_order.hana_created, tbl_order.hana_time, tbl_order.created_by, 
        tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt,
        tbl_order.auto_order,
        tbl_petrol.ptrl_address,
        tbl_petrol.ptrl_zip_code,
        tbl_order.master_order_id, tbl_order.consignment_no
      FROM public.tbl_order 
      LEFT JOIN tbl_order_type ON tbl_order.order_type = tbl_order_type.ord_type_code
      LEFT JOIN tbl_petrol ON tbl_order.ship_to = tbl_petrol.ptrl_number
      LEFT JOIN tbl_petrol_group ON tbl_petrol_group.ptrl_group_code = tbl_petrol.ptrl_group_code
      LEFT JOIN tbl_master_time ON tbl_order.deli_time_req = tbl_master_time.time_code
      WHERE tbl_order.consignment_no = $1 
        AND tbl_order.order_status = 0
        AND tbl_order.rm_dt IS NULL 
    `;

    // ถ้าเป็น Child (2) ให้เห็นแค่ออเดอร์หลัก (1) และตัวเอง
    if (requesterRole == 2) {
      listScript += ` AND (tbl_order.master_order_id = 1 OR tbl_order.id = ${order_id})`;
    }

    listScript += ` ORDER BY tbl_order.master_order_id ASC, tbl_order.id ASC`;

    const listRes = await pgConn.getWithParams(dbPrefix + lic_code, listScript, [consignment_no], config.connectionString());

    console.log(`DEBUG getLinkedOrderList Data (Count: ${listRes.data.length}):`, listRes.data);

    // ======= 4. ดึงข้อมูล Items และสต็อกสำหรับแต่ละออเดอร์ =======
    let validOrders = [];
    let invalidOrders = [];

    for (let i = 0; i < listRes.data.length; i++) {
      let order = listRes.data[i];
      // --- ใช้ SQL เดียวกันทั้ง Master และ Child เพื่อให้โชว์ทุกถังของปั๊ม ---
      let itemScript = `
        (
          SELECT DISTINCT ON (tbl_order_item.ptrl_tank_code)
            tbl_order_item.id, 
            '${order.id}' as order_no, 
            tbl_order_item.item_no,
            tbl_order_item.ptrl_tank_code,
            COALESCE(tbl_petrol_tank.tnk_number, '0') as tank_number,
            COALESCE(auto_tank.tnk_capacity::text, tbl_petrol_tank.tnk_capacity::text) as tank_capacity,
            COALESCE(auto_tank.tnk_deadstock::text, tbl_petrol_tank.tnk_deadstock::text) as un_pump,
            tbl_item.itm_desc, tbl_item.itm_material_number,
            COALESCE(tbl_order_item.item_qty, 0) as item_qty,
            tbl_order_item.remark,
            COALESCE(auto_tank.current_stock, 0) as tank_start,
            COALESCE(auto_tank.yesterday_stock, 0) as tank_end,
            COALESCE(auto_sales.sale_previous, 0) as day_sales,
            (COALESCE(auto_sales.sale_previous, 0) + COALESCE(auto_tank.tnk_deadstock, tbl_petrol_tank.tnk_deadstock, 0)) as min_stock,
            (SELECT dpo_desc FROM tbl_depot WHERE dpo_code = (SELECT dpo_code FROM tbl_petrol_depot WHERE ptrl_code = '${order.ptrl_code}' AND rm_dt IS NULL LIMIT 1)) as dpo_desc
          FROM tbl_order_item
          LEFT JOIN tbl_item ON tbl_order_item.item_no = tbl_item.itm_code
          LEFT JOIN tbl_petrol_tank ON tbl_order_item.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code
          LEFT JOIN tbl_petrol ON tbl_petrol_tank.ptrl_code = tbl_petrol.ptrl_code
          LEFT JOIN (
              SELECT ptrl_code, tank_code,
                  MAX(tnk_capacity) as tnk_capacity, MAX(tnk_deadstock) as tnk_deadstock,
                  MAX(CASE WHEN stock_at::date = '${moment(order.ist_dt).format('YYYY-MM-DD')}'::date - INTERVAL '1 day' THEN stock END) as current_stock,
                  MAX(CASE WHEN stock_at::date = '${moment(order.ist_dt).format('YYYY-MM-DD')}'::date - INTERVAL '2 day' THEN stock END) as yesterday_stock
              FROM tbl_automatics_tanks_information GROUP BY ptrl_code, tank_code
          ) auto_tank ON tbl_petrol.ptrl_code = auto_tank.ptrl_code AND tbl_petrol_tank.ptrl_tank_code = auto_tank.tank_code
          LEFT JOIN (
              SELECT ptrl_code, tank_code, MAX(sale_previous) as sale_previous,
              MAX(case when sale_at_previous::date = '${moment(order.ist_dt).format('YYYY-MM-DD')}'::date - INTERVAL '1 day' THEN sale_previous END),
              MAX(case when sale_at_previous::date = '${moment(order.ist_dt).format('YYYY-MM-DD')}'::date - INTERVAL '2 day' THEN sale_previous END)
              FROM tbl_automatics_sales_previous_information
              GROUP BY ptrl_code, tank_code
          ) auto_sales ON tbl_petrol.ptrl_code = auto_sales.ptrl_code AND tbl_petrol_tank.ptrl_tank_code = auto_sales.tank_code
          WHERE tbl_order_item.order_no = '${order.id}' AND tbl_order_item.rm_dt IS NULL
          ORDER BY tbl_order_item.ptrl_tank_code, tbl_order_item.id DESC
        )
        UNION ALL
        (
          SELECT 
            NULL as id, 
            '${order.id}' as order_no, 
            tpt.itm_code as item_no,
            tpt.ptrl_tank_code,
            tpt.tnk_number as tank_number,
            COALESCE(auto_tank.tnk_capacity::text, tpt.tnk_capacity::text) as tank_capacity,
            COALESCE(auto_tank.tnk_deadstock::text, tpt.tnk_deadstock::text) as un_pump,
            itm.itm_desc, itm.itm_material_number,
            0 as item_qty,
            NULL as remark,
            COALESCE(auto_tank.current_stock, 0) as tank_start,
            COALESCE(auto_tank.yesterday_stock, 0) as tank_end,
            COALESCE(auto_sales.sale_previous, 0) as day_sales,
            (COALESCE(auto_sales.sale_previous, 0) + COALESCE(auto_tank.tnk_deadstock, tpt.tnk_deadstock, 0)) as min_stock,
            (SELECT dpo_desc FROM tbl_depot WHERE dpo_code = (SELECT dpo_code FROM tbl_petrol_depot WHERE ptrl_code = '${order.ptrl_code}' AND rm_dt IS NULL LIMIT 1)) as dpo_desc
          FROM tbl_petrol_tank tpt
          LEFT JOIN tbl_item itm ON tpt.itm_code = itm.itm_code
          LEFT JOIN tbl_petrol p ON tpt.ptrl_code = p.ptrl_code
          LEFT JOIN (
              SELECT ptrl_code, tank_code,
                  MAX(tnk_capacity) as tnk_capacity, MAX(tnk_deadstock) as tnk_deadstock,
                  MAX(CASE WHEN stock_at::date = '${moment(order.ist_dt).format('YYYY-MM-DD')}'::date - INTERVAL '1 day' THEN stock END) as current_stock,
                  MAX(CASE WHEN stock_at::date = '${moment(order.ist_dt).format('YYYY-MM-DD')}'::date - INTERVAL '2 day' THEN stock END) as yesterday_stock
              FROM tbl_automatics_tanks_information GROUP BY ptrl_code, tank_code
          ) auto_tank ON p.ptrl_code = auto_tank.ptrl_code AND tpt.ptrl_tank_code = auto_tank.tank_code
          LEFT JOIN (
              SELECT ptrl_code, tank_code, MAX(sale_previous) as sale_previous,
              MAX(case when sale_at_previous::date = '${moment(order.ist_dt).format('YYYY-MM-DD')}'::date - INTERVAL '1 day' THEN sale_previous END),
              MAX(case when sale_at_previous::date = '${moment(order.ist_dt).format('YYYY-MM-DD')}'::date - INTERVAL '2 day' THEN sale_previous END)
              FROM tbl_automatics_sales_previous_information
              GROUP BY ptrl_code, tank_code
          ) auto_sales ON p.ptrl_code = auto_sales.ptrl_code AND tpt.ptrl_tank_code = auto_sales.tank_code
          WHERE tpt.ptrl_code = '${order.ptrl_code}' 
            AND tpt.ptrl_tank_code NOT IN (SELECT ptrl_tank_code FROM tbl_order_item WHERE order_no = '${order.id}' AND rm_dt IS NULL AND ptrl_tank_code IS NOT NULL)
        )
        ORDER BY tank_number ASC
      `;

      let itemResult = await pgConn.get(dbPrefix + lic_code, itemScript, config.connectionString());

      // Check data availability
      let hasData = false;
      if (itemResult.data && itemResult.data.length > 0) {
        hasData = itemResult.data.some(item => parseFloat(item.tank_start) > 0 || parseFloat(item.day_sales) > 0);
      }

      order.items = itemResult.code ? [] : itemResult.data;
      if (hasData) {
        validOrders.push(order);
      } else {
        invalidOrders.push(order);
      }
    }

    // ======= 5. แยกชุดข้อมูลเป็น Master และ Children (แสดงทั้งหมดตามเดิม) =======
    const master_order = listRes.data.find(item => item.master_order_id == 1) || null;
    const child_orders = listRes.data.filter(item => item.master_order_id != 1);

    // ชุดข้อมูลสำหรับ Invalid
    const master_order_invalid = invalidOrders.find(item => item.master_order_id == 1) || null;
    const child_orders_invalid = invalidOrders.filter(item => item.master_order_id != 1);

    // ตรวจสอบกรณีเป็นปั๊มลูกแต่หาปั๊มหลักไม่เจอ
    if (requesterRole == 2 && !master_order) {
      return sendResponse(res, 'error', '-3', 'ไม่พบข้อมูลออเดอร์หลักที่พ่วงอยู่ กรุณาติดต่อผู้ดูแลระบบ', []);
    }

    let finalData = {
      master_order,
      child_orders,

    };
    let invalidData = {
      message: "ข้อมูลออเดอร์ที่ไม่มีข้อมูล Stock และ daysales",
      data: {
        master_order: master_order_invalid,
        child_orders: child_orders_invalid
      }
    }

    return res.json({
      status: 'success',
      invalid_code: '0',
      message: "ดึงข้อมูลออเดอร์พ่วงสำเร็จ",
      data: finalData,
      invalidData: invalidData,
      response_time: moment().format('YYYY-MM-DD HH:mm:ss'),
    });

  } catch (err) {
    console.error(err);
    return sendResponse(res, 'error', '-4', 'เกิดข้อผิดพลาดภายในระบบในการดึงข้อมูลออเดอร์พ่วง', []);
  }
};


exports.getChildOrderInformation = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    // =========================================================================
    // รับค่า Request Parameters และกำหนดค่าเริ่มต้น
    // =========================================================================
    let lic_code = req.header("lic_code");
    let {
      order_id,
      order_no,
      start_date,
      end_date,
      order_type,
      order_status,
      auto_order,
      status_deli,
      ptrl_number,
      ptrl_group_code,
      search,
      page_index,
      page_limit,
      action, is_consignment,
    } = req.body[0] || {};

    // กำหนด Default Values ให้กับตัวแปรสำคัญที่ไม่ได้ส่งมา
    page_index = page_index === undefined ? 1 : page_index;
    page_limit = page_limit === undefined ? 10 : page_limit;
    auto_order = auto_order === undefined ? "ALL" : auto_order;
    status_deli = status_deli === undefined ? "ALL" : status_deli;
    ptrl_number = ptrl_number === undefined ? "ALL" : ptrl_number;
    ptrl_group_code = ptrl_group_code === undefined ? "ALL" : ptrl_group_code;
    is_consignment = is_consignment === undefined ? "N" : is_consignment;

    // =========================================================================
    // (ตรวจสอบความครบถ้วนของข้อมูลสำคัญ)
    // =========================================================================
    if (
      ptrl_number === undefined ||
      start_date === undefined ||
      end_date === undefined ||
      order_type === undefined ||
      order_status === undefined ||
      search === undefined ||
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

    let original_start_date = start_date;
    let original_end_date = end_date;

    if (start_date.length === 10) start_date += " 00:00:00";
    if (end_date.length === 10) end_date += " 23:59:59";

    // =========================================================================
    // สร้าง Dynamic WHERE Clause สำหรับ Query หลัก (ดึงข้อมูล Order)
    // =========================================================================
    let conditions = ["tbl_order.rm_dt IS NULL", "tbl_order.order_flag = '1'"];

    // ======== N = ไม่แสดงข้อมูลออเดอร์ที่ยังไม่ถูกพ่วง , Y = แสดงข้อมูลออเดอร์ที่ถูกพ่วง  ========
    if (is_consignment.toString().toUpperCase() === "N") {
      conditions.push("tbl_order.consignment_no IS NULL");
    } else if (is_consignment.toString().toUpperCase() === "Y") {
      conditions.push("tbl_order.consignment_no IS NOT NULL");
    }

    if (order_id.toString().toUpperCase() !== "ALL")
      conditions.push(`tbl_order.id = '${order_id}'`);

    if (order_no.toString().toUpperCase() !== "ALL")
      conditions.push(`tbl_order.order_no = '${order_no}'`);
    if (status_deli.toString().toUpperCase() !== "ALL")
      conditions.push(`tbl_order.status_deli = '${status_deli}'`);
    if (order_type.toString().toUpperCase() !== "ALL")
      conditions.push(`tbl_order.order_type = '${order_type}'`);
    if (auto_order.toString().toUpperCase() !== "ALL")
      conditions.push(`tbl_order.auto_order = '${auto_order}'`);
    if (order_status.toString().toUpperCase() !== "ALL")
      conditions.push(`tbl_order.order_status = '${order_status}'`);

    if (
      original_start_date.toString().toUpperCase() !== "ALL" &&
      original_end_date.toString().toUpperCase() !== "ALL" &&
      original_start_date !== "" &&
      original_end_date !== ""
    ) {
      conditions.push(
        `tbl_order.ist_dt >= '${start_date}' AND tbl_order.ist_dt <= '${end_date}'`,
      );
    }

    // รองรับ ptrl_number ทั้งแบบ String และ Array
    if (Array.isArray(ptrl_number) && ptrl_number.length > 0) {
      const sites = ptrl_number.map((s) => `'${s}'`).join(",");
      conditions.push(`tbl_order.ship_to IN (${sites})`);
    } else if (
      ptrl_number !== undefined &&
      ptrl_number.toString().toUpperCase() !== "ALL"
    ) {
      conditions.push(`tbl_order.ship_to = '${ptrl_number}'`);
    }

    if (
      ptrl_group_code !== undefined &&
      ptrl_group_code.toString().toUpperCase() !== "ALL"
    ) {
      conditions.push(`tbl_petrol.ptrl_group_code = '${ptrl_group_code}'`);
    }

    // =========================================================================
    // กรองข้อมูลตามสิทธิ์การเข้าถึง (Role Authorization)
    // =========================================================================
    let act_val = action[0].value.toString().toUpperCase();
    let act_id = action[0].id;

    if (act_val === "GROUP") {
      // สิทธิ์ GROUP (เช่น Planner/CS): มองเห็นเฉพาะ Order ของปั๊มที่อยู่ในความดูแลของตัวเอง
      conditions.push(
        `tbl_petrol.ptrl_group_code IN (SELECT ptrl_group_code FROM tbl_employee_petrol_group WHERE emp_code = '${act_id}' AND emp_pgrp_flag = 1)`,
      );
      conditions.push(`tbl_petrol.ptrl_flag = '1'`);
    } else if (act_val !== "ALL") {
      // สิทธิ์พนักงานทั่วไป: มองเห็นเฉพาะ Order ที่ตัวเองเป็นคนสร้าง
      conditions.push(`tbl_order.ship_to IN (SELECT ptrl_number FROM tbl_petrol WHERE ptrl_code IN (SELECT ptrl_code FROM tbl_employee WHERE emp_code = '${act_id}' AND emp_flag = '1'))`);
    }

    if (search !== "") {
      conditions.push(`(
                tbl_order.order_no LIKE '%${search}%' 
                OR tbl_order.sh_cus_ref LIKE '%${search}%' 
                OR tbl_order.cus_ref LIKE '%${search}%' 
                OR tbl_order.po_name LIKE '%${search}%' 
                OR tbl_order.description LIKE '%${search}%'
            )`);
    }

    let whereClause = "WHERE " + conditions.join(" AND ");

    // =========================================================================
    // SQL Query หลักสำหรับดึงข้อมูลออเดอร์ (พร้อม JOIN ข้อมูลที่เกี่ยวข้อง)
    // =========================================================================
    // *มีการ Sub-query tbl_sum_item เพื่อหาผลรวมจำนวนสินค้า (total_qty) ของแต่ละ order_no
    let baseSelectQuery = `
            SELECT 
                tbl_order.id, tbl_order.order_no, tbl_order.sh_cus_ref as aos_order_no, tbl_order.order_type, tbl_order.order_group, 
                tbl_order_type.ord_type_desc, tbl_petrol_group.ptrl_group_desc, tbl_order.order_status::TEXT,
                tbl_order.chanel, tbl_order.division, tbl_order.sold_to, tbl_order.ship_to, tbl_petrol.ptrl_code,
                tbl_petrol.ptrl_desc, tbl_order.cus_ref, tbl_order.cus_date_ref, tbl_order.po_name, tbl_order.order_by, 
                tbl_order.ship_cond, tbl_order.pay_term, tbl_order.deli_date_req as request_date, tbl_master_time.time_value as RequestTime, 
                tbl_order.description, tbl_order.sh_cus_date_ref, tbl_order.status_deli, tbl_order.status_block, tbl_order.status_sd_process, 
                tbl_order.status_check, tbl_order.sd_doc_reject, tbl_order.cus_group, 
                tbl_order.hana_created, tbl_order.hana_time, tbl_order.created_by, 
                tbl_order.ist_dt, tbl_order.mdf_dt, tbl_order.rm_dt, tbl_order.auto_order,
                COALESCE(tbl_sum_item.total_qty, 0) as total_item_qty,
                tbl_employee.emp_name
            FROM tbl_order  
            LEFT JOIN tbl_order_type ON tbl_order.order_type = tbl_order_type.ord_type_code
            LEFT JOIN tbl_petrol_group ON tbl_petrol_group.ptrl_group_code = tbl_order.order_group
            LEFT JOIN tbl_petrol ON tbl_order.ship_to = tbl_petrol.ptrl_number
            LEFT JOIN tbl_master_time ON tbl_order.deli_time_req = tbl_master_time.time_code
            LEFT JOIN tbl_employee ON tbl_order.created_by_tms = tbl_employee.emp_code
            LEFT JOIN (
                SELECT 
                    TRIM(CAST(order_no AS TEXT)) as order_no_text, 
                    SUM(NULLIF(TRIM(CAST(item_qty AS TEXT)), '')::numeric) as total_qty 
                FROM tbl_order_item 
                WHERE rm_dt IS NULL 
                GROUP BY TRIM(CAST(order_no AS TEXT))
            ) tbl_sum_item ON TRIM(CAST(tbl_order.id AS TEXT)) = tbl_sum_item.order_no_text
        `;

    let dataScript = `
            ${baseSelectQuery}
            ${whereClause}
            ORDER BY tbl_order.ist_dt DESC 
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
        // =========================================================================
        // 4. ดึงข้อมูลรายการสินค้า (Items) และสต็อกน้ำมันของแต่ละออเดอร์ (จากตาราง Automatics)
        // =========================================================================
        let validOrders = [];
        let invalidOrders = [];
        for (let i = 0; i < tbl_temporary.data.length; i++) {
          let order = tbl_temporary.data[i];
          let itemScript = `
           SELECT DISTINCT ON (tbl_order_item.ptrl_tank_code)
              tbl_order_item.id, 
              '${order.id}' as order_no, 
              tbl_order_item.item_no,
              tbl_order_item.ptrl_tank_code,
              COALESCE(tbl_petrol_tank.tnk_number, '0') as tank_number,
              COALESCE(auto_tank.tnk_capacity::text, tbl_petrol_tank.tnk_capacity::text) as tank_capacity,
              COALESCE(auto_tank.tnk_deadstock::text, tbl_petrol_tank.tnk_deadstock::text) as un_pump,
              tbl_item.itm_desc, tbl_item.itm_material_number,
              COALESCE(tbl_order_item.item_qty, 0) as item_qty,
              tbl_order_item.remark,
              COALESCE(auto_tank.current_stock, 0) as tank_start,
              COALESCE(auto_tank.yesterday_stock, 0) as tank_end,
              COALESCE(auto_sales.sale_previous, 0) as day_sales,
              (COALESCE(auto_sales.sale_previous, 0) + COALESCE(auto_tank.tnk_deadstock, tbl_petrol_tank.tnk_deadstock, 0)) as min_stock,
              (SELECT dpo_desc FROM tbl_depot WHERE dpo_code = (SELECT dpo_code FROM tbl_petrol_depot WHERE ptrl_code = '${order.ptrl_code}' AND rm_dt IS NULL LIMIT 1)) as dpo_desc
            FROM tbl_order_item
            LEFT JOIN tbl_item ON tbl_order_item.item_no = tbl_item.itm_code
            LEFT JOIN tbl_petrol_tank ON tbl_order_item.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code
            LEFT JOIN tbl_petrol ON tbl_petrol_tank.ptrl_code = tbl_petrol.ptrl_code
            LEFT JOIN (
                SELECT ptrl_code, tank_code,
                    MAX(tnk_capacity) as tnk_capacity, MAX(tnk_deadstock) as tnk_deadstock,
                    MAX(CASE WHEN stock_at::date = '${moment(order.ist_dt).format('YYYY-MM-DD')}'::date - INTERVAL '1 day' THEN stock END) as current_stock,
                    MAX(CASE WHEN stock_at::date = '${moment(order.ist_dt).format('YYYY-MM-DD')}'::date - INTERVAL '2 day' THEN stock END) as yesterday_stock
                FROM tbl_automatics_tanks_information GROUP BY ptrl_code, tank_code
            ) auto_tank ON tbl_petrol.ptrl_code = auto_tank.ptrl_code AND tbl_petrol_tank.ptrl_tank_code = auto_tank.tank_code
            LEFT JOIN (
                SELECT ptrl_code, tank_code, MAX(sale_previous) as sale_previous,
                MAX(case when sale_at_previous::date = '${moment(order.ist_dt).format('YYYY-MM-DD')}'::date - INTERVAL '1 day' THEN sale_previous END),
                MAX(case when sale_at_previous::date = '${moment(order.ist_dt).format('YYYY-MM-DD')}'::date - INTERVAL '2 day' THEN sale_previous END)
                FROM tbl_automatics_sales_previous_information
                GROUP BY ptrl_code, tank_code
            ) auto_sales ON tbl_petrol.ptrl_code = auto_sales.ptrl_code AND tbl_petrol_tank.ptrl_tank_code = auto_sales.tank_code
            WHERE tbl_order_item.order_no = '${order.id}' AND tbl_order_item.rm_dt IS NULL
            ORDER BY tbl_order_item.ptrl_tank_code, tbl_order_item.id DESC
          `;

          let itemResult = await pgConn.get(dbPrefix + lic_code, itemScript, config.connectionString());

          // ======== ตรวจสอบว่ามีข้อมูล Stock หรือยอดขายหรือไม่ ========
          let hasData = false;
          if (itemResult.data && itemResult.data.length > 0) {
            hasData = itemResult.data.some(item => parseFloat(item.tank_start) > 0 || parseFloat(item.day_sales) > 0);
          }

          if (hasData) {
            order.items = itemResult.code ? [] : itemResult.data;
            validOrders.push(order);
          } else {
            order.items = itemResult.code ? [] : itemResult.data;
            invalidOrders.push(order);
          }
        }

        // ใช้เฉพาะข้อมูลที่ Valid
        let finalValidData = validOrders;
        let finalInvalidData = invalidOrders;

        // =========================================================================
        // นับจำนวน Record ทั้งหมด (สำหรับทำ Total Pages ในระบบ Pagination)
        // =========================================================================
        let countScript = `
                    SELECT 
                        CEIL((CEIL(SUM(rows_total)) / ${page_limit})) as page_total, 
                        SUM(rows_total) as rows_total  
                    FROM (
                        SELECT 1 as rows_total FROM tbl_order 
                        LEFT JOIN tbl_petrol ON tbl_order.ship_to = tbl_petrol.ptrl_number
                        ${whereClause}
                        ORDER BY tbl_order.ist_dt DESC 
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

        // ส่ง Response แยกเป็น 2 ชุด (Valid และ Invalid)
        let response = [
          {
            status: "success",
            invalid_code: "0",
            message: "ข้อมูลออเดอร์ที่มีข้อมูล Stock และ daysales ครบถ้วน",
            data: finalValidData,
            invalid_data: {
              message: "ข้อมูลออเดอร์ที่ไม่มีข้อมูล Stock และ daysales",
              data: finalInvalidData
            },
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



