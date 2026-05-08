const config = require("../../configuration/connection");
const pgConn = require("../../library/pgConnection");
const moment = require("moment");
const xglobal = require("../../middleware/global");

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
exports.getPetrolInformation = async (req, res, next) => {
  var xresult = [];
  let lic_code = req.header("lic_code");
  let payload = req.body?.[0] || {};

  try {
    let {
      ptrl_code,
      off_code,
      ptrl_group_code,
      search,
      page_index,
      page_limit,
      action,
      auto_order,
      ptrl_sales_group,
      ptrl_sales_type,
    } = payload;

    const finalSalesGroupArray = ptrl_sales_group;
    const finalSalesTypeArray = ptrl_sales_type;

    // ======== กำหนดค่าเริ่มต้น ========
    page_index = page_index === undefined ? 1 : page_index;
    page_limit = page_limit === undefined || page_limit === "" ? 10 : page_limit;
    off_code = off_code === undefined || off_code === "" ? "ALL" : off_code;
    auto_order =
      auto_order === undefined || auto_order === "" ? "ALL" : auto_order;

    // ======== ตรวจสอบพารามิเตอร์ที่จำเป็น ========
    if (
      ptrl_code === undefined ||
      off_code === undefined ||
      ptrl_group_code === undefined ||
      lic_code === undefined ||
      search === undefined ||
      action === undefined ||
      auto_order === undefined
    ) {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message:
            "ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
          data: xresult,
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          page_total: 0,
          rows_total: 0,
        },
      ];

      res.status(200).send(response);
      return;
    }

    if (page_index > 0) {
      page_index -= 1;
    }

    // ======== สร้างเงื่อนไข WHERE (Dynamic Conditions) ========
    let conditions = ["tbl_petrol.ptrl_flag = '1'"];

    if (ptrl_code.toString().toUpperCase() !== "ALL") {
      conditions.push(`tbl_petrol.ptrl_code = '${ptrl_code}'`);
    }

    if (auto_order.toString().toUpperCase() !== "ALL") {
      conditions.push(`tbl_petrol.auto_order = ${auto_order}`);
    }

    if (ptrl_group_code.toString().toUpperCase() !== "ALL") {
      conditions.push(`tbl_petrol.ptrl_group_code = '${ptrl_group_code}'`);
    }

    // if (off_code.toString().toUpperCase() !== "ALL") {
    //   conditions.push(`tbl_petrol.off_code = '${off_code}'`);
    // }

    // กรองเพิ่มเติมตาม array sales_org
    if (ptrl_sales_group && Array.isArray(ptrl_sales_group) && ptrl_sales_group.length > 0) {
      const salesOrg = ptrl_sales_group.map(val => `'${String(val).replace(/'/g, "''")}'`).join(", ");
      conditions.push(`tbl_petrol.ptrl_sales_group IN (${salesOrg})`);
    }

    // กรองเพิ่มเติมตาม array order_type (รองรับทั้ง ord_type_code และ sales_order_type)
    if (ptrl_sales_type && Array.isArray(ptrl_sales_type) && ptrl_sales_type.length > 0) {
      const orderTypes = ptrl_sales_type.map(val => `'${String(val).replace(/'/g, "''")}'`).join(", ");
      conditions.push(`(
        tbl_petrol.ptrl_sales_type IN (${orderTypes})
        OR tbl_petrol.ptrl_sales_type IN (SELECT ord_type_code FROM tbl_order_type WHERE sales_order_type IN (${orderTypes}))
      )`);
    }



    // ดัก undefined ให้ Action
    let act_val = action?.[0]?.value?.toString().toUpperCase() || "ALL";
    let act_id = action?.[0]?.id || "";

    // จัดการเงื่อนไขตามสิทธิ์การเข้าถึง
    if (act_val !== "ALL") {
      if (act_val === "GROUP") {
        // กรองตาม Petrol Group (ถ้าไม่ได้ระบุกลุ่มไว้ ให้เห็นตามสิทธิ์พื้นที่)
        conditions.push(`(
          NOT EXISTS (SELECT 1 FROM tbl_employee_petrol_group WHERE emp_code = '${act_id}' AND emp_pgrp_flag = 1)
          OR tbl_petrol.ptrl_group_code IN (SELECT ptrl_group_code FROM tbl_employee_petrol_group WHERE emp_code = '${act_id}' AND emp_pgrp_flag = 1)
        )`);

        // กรองตาม Order Type (ZOR1, ZOR2)
        conditions.push(`(
          NOT EXISTS (SELECT 1 FROM tbl_employee_order_type WHERE emp_code = '${act_id}' AND emp_otyp_flag = 1)
          OR tbl_petrol.ptrl_sales_type IN (
            SELECT t2.ord_type_code 
            FROM tbl_employee_order_type t1 
            JOIN tbl_order_type t2 ON t1.ord_type_code = t2.ord_type_code 
            WHERE t1.emp_code = '${act_id}' AND t1.emp_otyp_flag = 1
          )
        )`);

        // กรองตาม Sales Org (1000, 1900)
        conditions.push(`(
          NOT EXISTS (SELECT 1 FROM tbl_employee_sales_org WHERE emp_code = '${act_id}' AND emp_sorg_flag = 1)
          OR tbl_petrol.ptrl_sales_group IN (SELECT sales_org_code FROM tbl_employee_sales_org WHERE emp_code = '${act_id}' AND emp_sorg_flag = 1)
        )`);
      } else {
        conditions.push(
          `tbl_petrol.ptrl_code IN (SELECT ptrl_code FROM tbl_employee WHERE emp_code = '${act_id}' AND emp_flag = '1')`,
        );
      }
    }

    if (search !== "") {
      conditions.push(`(
                tbl_petrol.ptrl_number LIKE '%${search}%' 
                OR tbl_petrol.ptrl_sitecode LIKE '%${search}%' 
               OR tbl_petrol.ptrl_desc ILIKE '%${search}%'
                OR tbl_petrol.ptrl_short_desc LIKE '%${search}%' 
                OR tbl_petrol.ptrl_address LIKE '%${search}%' 
                OR tbl_petrol.ptrl_zip_code LIKE '%${search}%'
            )`);
    }

    let paginationClause = "";
    if (page_limit.toString().toUpperCase() !== "ALL") {
      let limit = parseInt(page_limit);
      paginationClause = `LIMIT ${limit} OFFSET (${page_index} * ${limit})`;
    }

    let whereClause = "WHERE " + conditions.join(" AND ");

    // ======== SQL สำหรับดึงข้อมูล ========
    let baseSelectQuery = `
            SELECT ptrl_code, ptrl_number, ptrl_sitecode, ptrl_desc, ptrl_short_desc, ptrl_address, ptrl_zip_code, ptrl_country_code,
            ptrl_unloading_minute, ptrl_expenses_per_km, ptrl_area, ptrl_option_pump, ptrl_option_mrge_orders, ptrl_lat, ptrl_lon,
            tbl_petrol.off_code, off_desc, tbl_petrol.ptrl_group_code, ptrl_group_desc,
            ptrl_flag, ptrl_remark, ptrl_sales_group, tbl_order_type.sales_order_type as ptrl_sales_type, auto_order, 
            tbl_petrol.prov_code, tbl_petrol.amph_code, tbl_petrol.tamb_code, 
            tbl_province.prov_desc, tbl_amphure.amph_desc, tbl_tambon.tamb_desc, tbl_petrol.coverage_days, tbl_petrol.waiting_days, tbl_petrol.stock_provious_days,
            tbl_petrol.ptrl_sales_type as ptrl_sales_type_code
            FROM tbl_petrol 
            LEFT JOIN tbl_order_type ON tbl_petrol.ptrl_sales_type = tbl_order_type.ord_type_code
            LEFT JOIN tbl_office ON tbl_petrol.off_code = tbl_office.off_code 
            LEFT JOIN tbl_petrol_group ON tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
            LEFT JOIN tbl_province ON tbl_petrol.prov_code = tbl_province.prov_code 
            LEFT JOIN tbl_amphure ON tbl_petrol.amph_code = tbl_amphure.amph_code 
            LEFT JOIN tbl_tambon ON tbl_petrol.tamb_code = tbl_tambon.tamb_code 
        `;

    let dataScript = `
            ${baseSelectQuery}
            ${whereClause}
            ORDER BY tbl_petrol.ist_dt DESC 
            ${paginationClause};
        `;


    let tbl_temporary = await pgConn.get(
      dbPrefix + lic_code,
      dataScript,
      config.connectionString(),
    );
    if (!tbl_temporary.code) {
      if (tbl_temporary.data.length > 0) {
        tbl_temporary.data = JSON.parse(
          JSON.stringify(tbl_temporary.data).replace(/\:null/gi, '\:""'),
        );

        let page_total = 0;
        let rows_total = 0;

        // ======== นับจำนวนแถวทั้งหมด ========
        let countScript = `
                    
                `;

        if (page_limit.toString().toUpperCase() === "ALL") {
          countScript = `
                        SELECT 
                            1 as page_total, 
                            COUNT(tbl_petrol.ptrl_code) as rows_total 
                        FROM tbl_petrol 
                        ${whereClause};
                    `;
        } else {
          countScript = `
                        SELECT 
                            CEIL(COUNT(tbl_petrol.ptrl_code)::float / ${parseInt(page_limit)}) as page_total, 
                            COUNT(tbl_petrol.ptrl_code) as rows_total 
                        FROM tbl_petrol 
                        LEFT JOIN tbl_office ON tbl_petrol.off_code = tbl_office.off_code 
                        LEFT JOIN tbl_petrol_group ON tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                        ${whereClause};
                    `;
        }

        let tbl_temporary0 = await pgConn.get(
          dbPrefix + lic_code,
          countScript,
          config.connectionString(),
        );

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
            page_total: 0,
            rows_total: 0,
          },
        ];

        res.status(200).send(response);
        return;
      }
    } else {
      let act_id = action?.[0]?.id || "";
      let act_val = action?.[0]?.value || "";
      let response = [
        {
          status: "error",
          invalid_code: "-3",
          message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
          data: xresult,
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          page_total: 0,
          rows_total: 0,
        },
      ];

      res.status(200).send(response);
      await xglobal.action_logs(
        lic_code,
        act_id,
        "ดึงข้อมูลปั้ม",
        JSON.stringify(payload),
        "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        act_val,
      );
      return;
    }
  } catch (err) {
    console.error(err);
    let act_id = payload.action?.[0]?.id || "";
    let act_val = payload.action?.[0]?.value || "";

    let response = [
      {
        status: "error",
        invalid_code: "-4",
        message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        page_total: 0,
        rows_total: 0,
      },
    ];

    res.status(200).send(response);

    if (lic_code && act_id) {
      await xglobal.action_logs(
        lic_code,
        act_id,
        "ดึงข้อมูลปั้ม",
        JSON.stringify(payload),
        "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        act_val,
      );
    }
    return;
  }
};

exports.getPetrolInformationFilter = async (req, res, next) => {
  var xresult = [];
  let lic_code = req.header("lic_code");
  let payload = req.body?.[0] || {};

  try {
    let {
      ptrl_code,
      ptrl_group_code,
      search,
      page_index,
      page_limit,
      action,
      auto_order,
      ptrl_sales_group,
      ptrl_sales_type,
    } = payload;

    // ======== กำหนดค่าเริ่มต้น ========
    page_index = page_index === undefined ? 1 : page_index;
    page_limit = page_limit === undefined ? 10 : page_limit;

    // ======== ตรวจสอบพารามิเตอร์ที่จำเป็น ========
    if (
      ptrl_code === undefined ||
      ptrl_group_code === undefined ||
      lic_code === undefined ||
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
          page_total: 0,
          rows_total: 0,
        },
      ];

      res.status(200).send(response);
      return;
    }

    if (page_index > 0) {
      page_index -= 1;
    }

    // ======== สร้างเงื่อนไข WHERE (Dynamic Conditions) ========
    let conditions = ["tbl_petrol.ptrl_flag = '1'"];

    if (ptrl_code.toString().toUpperCase() !== "ALL") {
      conditions.push(`tbl_petrol.ptrl_code = '${ptrl_code}'`);
    }

    if (auto_order !== undefined && auto_order !== "") {
      conditions.push(`tbl_petrol.auto_order = ${auto_order}`);
    }

    if (
      ptrl_group_code.toString().toUpperCase() !== "ALL" &&
      ptrl_group_code !== ""
    ) {
      conditions.push(`tbl_petrol.ptrl_group_code = '${ptrl_group_code}'`);
    }

    // กรองเพิ่มเติมตาม array sales_org
    if (ptrl_sales_group && Array.isArray(ptrl_sales_group) && ptrl_sales_group.length > 0) {
      const salesOrg = ptrl_sales_group.map(val => `'${String(val).replace(/'/g, "''")}'`).join(", ");
      conditions.push(`tbl_petrol.ptrl_sales_group IN (${salesOrg})`);
    }

    // กรองเพิ่มเติมตาม array order_type (รองรับทั้ง ord_type_code และ sales_order_type)
    if (ptrl_sales_type && Array.isArray(ptrl_sales_type) && ptrl_sales_type.length > 0) {
      const orderTypes = ptrl_sales_type.map(val => `'${String(val).replace(/'/g, "''")}'`).join(", ");
      conditions.push(`(
        tbl_petrol.ptrl_sales_type IN (${orderTypes})
        OR tbl_petrol.ptrl_sales_type IN (SELECT ord_type_code FROM tbl_order_type WHERE sales_order_type IN (${orderTypes}))
      )`);
    }
    // ดัก undefined ให้ Action
    let act_val = action?.[0]?.value?.toString().toUpperCase() || "ALL";
    let act_id = action?.[0]?.id || "";

    // จัดการเงื่อนไขตามสิทธิ์การเข้าถึง
    if (act_val !== "ALL") {
      if (act_val === "GROUP") {
        // กรองตาม Petrol Group (ถ้าไม่ได้ระบุกลุ่มไว้ ให้เห็นตามสิทธิ์พื้นที่)
        conditions.push(`(
          NOT EXISTS (SELECT 1 FROM tbl_employee_petrol_group WHERE emp_code = '${act_id}' AND emp_pgrp_flag = 1)
          OR tbl_petrol.ptrl_group_code IN (SELECT ptrl_group_code FROM tbl_employee_petrol_group WHERE emp_code = '${act_id}' AND emp_pgrp_flag = 1)
        )`);

        // กรองตาม Order Type (ZOR1, ZOR2)
        conditions.push(`(
          NOT EXISTS (SELECT 1 FROM tbl_employee_order_type WHERE emp_code = '${act_id}' AND emp_otyp_flag = 1)
          OR tbl_petrol.ptrl_sales_type IN (
            SELECT t2.ord_type_code 
            FROM tbl_employee_order_type t1 
            JOIN tbl_order_type t2 ON t1.ord_type_code = t2.ord_type_code 
            WHERE t1.emp_code = '${act_id}' AND t1.emp_otyp_flag = 1
          )
        )`);

        // กรองตาม Sales Org (1000, 1900)
        conditions.push(`(
          NOT EXISTS (SELECT 1 FROM tbl_employee_sales_org WHERE emp_code = '${act_id}' AND emp_sorg_flag = 1)
          OR tbl_petrol.ptrl_sales_group IN (SELECT sales_org_code FROM tbl_employee_sales_org WHERE emp_code = '${act_id}' AND emp_sorg_flag = 1)
        )`);
      } else {
        conditions.push(
          `tbl_petrol.ptrl_code IN (SELECT ptrl_code FROM tbl_employee WHERE emp_code = '${act_id}' AND emp_flag = '1')`,
        );
      }
    }

    if (search !== "") {
      conditions.push(`(
                tbl_petrol.ptrl_number LIKE '%${search}%' 
                OR tbl_petrol.ptrl_sitecode LIKE '%${search}%' 
                OR tbl_petrol_group.ptrl_group_desc LIKE '%${search}%' 
                OR tbl_petrol.ptrl_desc LIKE '%${search}%' 
                OR tbl_petrol.ptrl_short_desc LIKE '%${search}%' 
                OR tbl_petrol.ptrl_address LIKE '%${search}%' 
                OR tbl_petrol.ptrl_zip_code LIKE '%${search}%'
            )`);
    }

    let whereClause = "WHERE " + conditions.join(" AND ");

    // ======== SQL สำหรับดึงข้อมูล ========
    let baseSelectQuery = `
            SELECT 
                tbl_petrol_group.ptrl_group_code, 
                tbl_petrol_group.ptrl_group_desc,
                tbl_petrol.ptrl_code, 
                tbl_petrol.ptrl_number, 
                tbl_petrol.ptrl_sitecode, 
                tbl_petrol.ptrl_desc, 
                tbl_petrol.ptrl_short_desc
            FROM tbl_petrol 
            LEFT JOIN tbl_petrol_group ON tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
        `;

    let paginationClause = "";
    if (page_limit.toString().trim().toUpperCase() === "ALL") {
      paginationClause = "";
    } else {
      let offset = parseInt(page_index) * parseInt(page_limit);
      paginationClause = `LIMIT ${page_limit} OFFSET ${offset}`;
    }

    let dataScript = `
            ${baseSelectQuery}
            ${whereClause}
            ORDER BY tbl_petrol.ist_dt DESC 
            ${paginationClause};
        `;

    let tbl_temporary = await pgConn.get(
      dbPrefix + lic_code,
      dataScript,
      config.connectionString(),
    );
    if (!tbl_temporary.code) {
      if (tbl_temporary.data.length > 0) {
        tbl_temporary.data = JSON.parse(
          JSON.stringify(tbl_temporary.data).replace(/\:null/gi, '\:""'),
        );

        let page_total = 0;
        let rows_total = 0;

        // ======== นับจำนวนแถวทั้งหมด ========
        let pageLimitForCount = page_limit.toString().trim().toUpperCase() === "ALL" ? "COUNT(tbl_petrol.ptrl_code)" : parseInt(page_limit);
        let countScript = `
                    SELECT 
                        CEIL(COUNT(DISTINCT tbl_petrol.ptrl_code)::float / ${pageLimitForCount}) as page_total, 
                        COUNT(DISTINCT tbl_petrol.ptrl_code) as rows_total 
                    FROM tbl_petrol 
                    LEFT JOIN tbl_petrol_group ON tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                    ${whereClause};
                `;

        let tbl_temporary0 = await pgConn.get(
          dbPrefix + lic_code,
          countScript,
          config.connectionString(),
        );

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
            page_total: 0,
            rows_total: 0,
          },
        ];

        res.status(200).send(response);
        return;
      }
    } else {
      let act_id = action?.[0]?.id || "";
      let act_val = action?.[0]?.value || "";
      let response = [
        {
          status: "error",
          invalid_code: "-3",
          message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
          data: xresult,
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          page_total: 0,
          rows_total: 0,
        },
      ];

      res.status(200).send(response);
      await xglobal.action_logs(
        lic_code,
        act_id,
        "ดึงข้อมูลปั้ม",
        JSON.stringify(payload),
        "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        act_val,
      );
      return;
    }
  } catch (err) {
    console.error(err);
    let act_id = payload.action?.[0]?.id || "";
    let act_val = payload.action?.[0]?.value || "";

    let response = [
      {
        status: "error",
        invalid_code: "-4",
        message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        page_total: 0,
        rows_total: 0,
      },
    ];

    res.status(200).send(response);

    if (lic_code && act_id) {
      await xglobal.action_logs(
        lic_code,
        act_id,
        "ดึงข้อมูลปั้ม",
        JSON.stringify(payload),
        "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        act_val,
      );
    }
    return;
  }
};
exports.removePetrol = async (req, res, next) => {
  let lic_code = req.header("lic_code");
  let payload = req.body?.[0] || {};

  try {
    let { ptrl_code, action } = payload;
    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      ptrl_code == undefined ||
      lic_code == undefined ||
      action == undefined
    ) {
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
    } else {
      let script = ``;
      script = `update tbl_petrol set ptrl_flag = '0', rm_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}' 
            where ptrl_code = '${ptrl_code}';`;

      let tbl_temporary = await pgConn.execute(
        dbPrefix + lic_code,
        script,
        config.connectionString(),
      );
      if (!tbl_temporary.code) {
        //debugger
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
        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "ลบข้อมูลปั้ม",
          JSON.stringify(payload),
          "ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
          action[0].value,
        );
        return;
      }
    }
  } catch (err) {
    console.log(err);
    let action = payload?.action || [];
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
    if (lic_code && action[0]) {
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "ลบข้อมูลปั้ม",
        JSON.stringify(payload),
        "ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        action[0].value,
      );
    }
    return;
  }
};

exports.setPetrolInformation = async (req, res, next) => {
  let lic_code = req.header("lic_code");
  let { ptrl_code } = req.query;
  let payload = req.body?.[0] || {};

  try {
    let {
      ptrl_number,
      ptrl_sitecode,
      ptrl_desc,
      ptrl_short_desc,
      ptrl_address,
      ptrl_zip_code,
      ptrl_country_code,
      ptrl_unloading_minute,
      ptrl_expenses_per_km,
      ptrl_area,
      ptrl_option_pump,
      ptrl_option_mrge_orders,
      ptrl_lat,
      ptrl_lon,
      off_code,
      ptrl_group_code,
      ptrl_remark,
      action,
      ptrl_sales_group,
      ptrl_sales_type,
      auto_order,
      prov_code,
      amph_code,
      tamb_code,
      coverage_days,
      waiting_days,
      stock_provious_days
    } = payload;

    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      ptrl_code == undefined ||
      ptrl_number == undefined ||
      ptrl_sitecode == undefined ||
      ptrl_desc == undefined ||
      ptrl_short_desc == undefined ||
      ptrl_address == undefined ||
      ptrl_zip_code == undefined ||
      ptrl_country_code == undefined ||
      ptrl_unloading_minute == undefined ||
      ptrl_expenses_per_km == undefined ||
      ptrl_area == undefined ||
      ptrl_option_pump == undefined ||
      ptrl_option_mrge_orders == undefined ||
      ptrl_lat == undefined ||
      ptrl_lon == undefined ||
      off_code == undefined ||
      ptrl_group_code == undefined ||
      ptrl_sales_group == undefined ||
      ptrl_sales_type == undefined ||
      action == undefined ||
      auto_order == undefined ||
      prov_code == undefined ||
      amph_code == undefined ||
      tamb_code == undefined
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
    } else {
      if (ptrl_remark == undefined) {
        ptrl_remark = "";
      }

      // Lookup internal code for order_type (SAP code -> Internal code)
      let checkOrderType = await pgConn.get(dbPrefix + lic_code, `SELECT ord_type_code FROM tbl_order_type WHERE sales_order_type = '${ptrl_sales_type}' OR ord_type_code = '${ptrl_sales_type}' LIMIT 1`, config.connectionString());
      if (!checkOrderType.code && checkOrderType.data.length > 0) {
        ptrl_sales_type = checkOrderType.data[0].ord_type_code;
      }

      let script = ``;
      script = `update tbl_petrol set
                ptrl_number = '${ptrl_number}',
                ptrl_sitecode = '${ptrl_sitecode}',
                ptrl_desc = '${ptrl_desc}',
                ptrl_short_desc = '${ptrl_short_desc}',
                ptrl_address = '${ptrl_address}',
                ptrl_zip_code = '${ptrl_zip_code}',
                ptrl_country_code = '${ptrl_country_code}',
                ptrl_unloading_minute = ${ptrl_unloading_minute},
                ptrl_expenses_per_km = ${ptrl_expenses_per_km},
                ptrl_area = ${ptrl_area},
                ptrl_option_pump = '${ptrl_option_pump}',
                ptrl_option_mrge_orders = '${ptrl_option_mrge_orders}',
                ptrl_lat = '${ptrl_lat}',
                ptrl_lon = '${ptrl_lon}',
                off_code = '${off_code}',
                ptrl_group_code = '${ptrl_group_code}',
                mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}',
                ptrl_remark = '${ptrl_remark}',
                ptrl_sales_group = '${ptrl_sales_group}',
                ptrl_sales_type = '${ptrl_sales_type}',
                auto_order = '${auto_order}',
                prov_code = '${prov_code}',
                amph_code = '${amph_code}',
                tamb_code = '${tamb_code}',
                coverage_days = ${coverage_days},
                waiting_days = ${waiting_days},
                stock_provious_days = ${stock_provious_days}
            where ptrl_code = '${ptrl_code}';`;

      script = script.replace(/'NULL'/gi, "NULL");

      let tbl_temporary = await pgConn.execute(
        dbPrefix + lic_code,
        script,
        config.connectionString(),
      );
      if (!tbl_temporary.code) {
        // ===== อัปเดตข้อมูล order_type และ order_group ของออเดอร์ที่ยังค้างอยู่ (order_status = '0') ให้ตรงตามประเภทปั๊มใหม่ =====
        let updatePendingOrdersScript = `
            UPDATE tbl_order 
            SET 
                order_type = '${ptrl_sales_type}',
                order_group = '${ptrl_sales_group}',
                mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}'
            WHERE ship_to = '${ptrl_number}' 
            AND order_status = '0' 
            AND order_flag = '1' 
            AND rm_dt IS NULL
        `;
        await pgConn.execute(
          dbPrefix + lic_code,
          updatePendingOrdersScript,
          config.connectionString()
        );

        //debugger
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
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "แก้ไขข้อมูลปั้ม",
          JSON.stringify(payload),
          "success",
          action[0].value,
        );
        return;
      } else {
        let response = [
          {
            status: "error",
            invalid_code: "-3",
            message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "แก้ไขข้อมูลปั้ม",
          JSON.stringify(payload),
          "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
          action[0].value,
        );
        return;
      }
    }
  } catch (err) {
    console.log(err);
    let action = payload?.action || [];
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
    if (lic_code && action[0]) {
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "แก้ไขข้อมูลปั้ม",
        JSON.stringify(payload),
        "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        action[0].value,
      );
    }
    return;
  }
};

exports.addPetrolInformation = async (req, res, next) => {
  let lic_code = req.header("lic_code");
  let payload = req.body?.[0] || {};

  try {
    let {
      ptrl_number,
      ptrl_sitecode,
      ptrl_desc,
      ptrl_short_desc,
      ptrl_address,
      ptrl_zip_code,
      ptrl_country_code,
      ptrl_unloading_minute,
      ptrl_expenses_per_km,
      ptrl_area,
      ptrl_option_pump,
      ptrl_option_mrge_orders,
      ptrl_lat,
      ptrl_lon,
      off_code,
      ptrl_group_code,
      ptrl_remark,
      action,
      ptrl_sales_group,
      ptrl_sales_type,
      auto_order,
      prov_code,
      amph_code,
      tamb_code,
      waiting_days,
      coverage_days,
      stock_provious_days
    } = payload;

    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      ptrl_number == undefined ||
      ptrl_sitecode == undefined ||
      ptrl_desc == undefined ||
      ptrl_short_desc == undefined ||
      ptrl_address == undefined ||
      ptrl_zip_code == undefined ||
      ptrl_country_code == undefined ||
      ptrl_unloading_minute == undefined ||
      ptrl_expenses_per_km == undefined ||
      ptrl_area == undefined ||
      ptrl_option_pump == undefined ||
      ptrl_option_mrge_orders == undefined ||
      ptrl_lat == undefined ||
      ptrl_lon == undefined ||
      off_code == undefined ||
      ptrl_group_code == undefined ||
      action == undefined ||
      ptrl_sales_group == undefined ||
      ptrl_sales_type == undefined ||
      auto_order == undefined ||
      prov_code == undefined ||
      amph_code == undefined ||
      tamb_code == undefined
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
    } else {
      if (ptrl_remark == undefined) {
        ptrl_remark = "";
      }

      let script = ``;
      script = `select ptrl_code from tbl_petrol where (ptrl_desc = '${ptrl_desc}' or ptrl_short_desc = '${ptrl_short_desc}' or ptrl_number = '${ptrl_number}' or ptrl_sitecode = '${ptrl_sitecode}') and ptrl_flag = '1';`;
      let tbl_temporary0 = await pgConn.get(
        dbPrefix + lic_code,
        script,
        config.connectionString(),
      );
      if (!tbl_temporary0.code) {
        if (tbl_temporary0.data.length > 0) {
          let response = [
            {
              status: "error",
              invalid_code: "-4",
              message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลปั้มซ้ำ`,
              data: [],
              response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
            },
          ];

          res.status(200).send(response);
          await xglobal.action_logs(
            lic_code,
            action[0].id,
            "เพิ่มข้อมูลปั้ม",
            JSON.stringify(payload),
            "ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลปั้มซ้ำ",
            action[0].value,
          );
          return;
        }
      }

      let ptrl_code =
        "petr-" +
        moment().format("YYYYMMDDHHmmss") +
        Math.floor(Math.random() * 1000);
      script = `insert into tbl_petrol 
            (ptrl_code, ptrl_number, ptrl_sitecode, ptrl_desc, ptrl_short_desc, ptrl_address, ptrl_zip_code, ptrl_country_code, ptrl_unloading_minute,
            ptrl_expenses_per_km, ptrl_area, ptrl_option_pump, ptrl_option_mrge_orders,
            ptrl_lat, ptrl_lon, off_code, ptrl_group_code, ptrl_flag, ist_dt, ptrl_remark, ptrl_sales_group, ptrl_sales_type, auto_order, prov_code, amph_code, tamb_code, waiting_days, coverage_days, stock_provious_days) 
            values 
            ('${ptrl_code}', '${ptrl_number}', '${ptrl_sitecode}', '${ptrl_desc}', '${ptrl_short_desc}', '${ptrl_address}', '${ptrl_zip_code}', 
            '${ptrl_country_code}', ${ptrl_unloading_minute}, ${ptrl_expenses_per_km}, 
            ${ptrl_area}, '${ptrl_option_pump}', '${ptrl_option_mrge_orders}', ${ptrl_lat}, ${ptrl_lon}, '${off_code}', '${ptrl_group_code}',
            '1', '${moment().format("YYYY-MM-DD HH:mm:ss")}', '${ptrl_remark}', '${ptrl_sales_group}', '${ptrl_sales_type}', '${auto_order}', '${prov_code}', '${amph_code}', '${tamb_code}', '${waiting_days}', '${coverage_days}', '${stock_provious_days}');`;

      script = script.replace(/'NULL'/gi, "NULL");
      let tbl_temporary = await pgConn.execute(
        dbPrefix + lic_code,
        script,
        config.connectionString(),
      );
      if (!tbl_temporary.code) {
        //debugger
        let response = [
          {
            status: "success",
            invalid_code: "0",
            message: "",
            data: [
              {
                ptrl_code: ptrl_code,
              },
            ],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];

        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "เพิ่มข้อมูลปั้ม",
          JSON.stringify(payload),
          "success",
          action[0].value,
        );
        return;
      } else {
        let response = [
          {
            status: "error",
            invalid_code: "-3",
            message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "เพิ่มข้อมูลปั้ม",
          JSON.stringify(payload),
          "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
          action[0].value,
        );
        return;
      }
    }
  } catch (err) {
    console.log(err);
    let action = payload?.action || [];
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
    if (lic_code && action[0]) {
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "เพิ่มข้อมูลปั้ม",
        JSON.stringify(payload),
        "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        action[0].value,
      );
    }
    return;
  }
};
