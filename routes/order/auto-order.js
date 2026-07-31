const config = require("../../configuration/connection");
const pgConn = require("../../library/pgConnection");
const moment = require("moment");
const axios = require("axios");
const { sapApiClient } = require("./sap-api-config");
const xglobal = require("../../middleware/global");
const dbPrefix = config.dbPrefix();

// =========== ดึงข้อมูล Stock ของ Auto Order ===========
exports.getStockAutoOrderInformation = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    // =========================================================================
    // รับค่า Request Parameters และกำหนดค่าเริ่มต้น
    // =========================================================================
    let lic_code = req.header("lic_code");
    let {
      sh_cus_ref,
      action,
    } = req.body[0] || {};


    // =========================================================================
    // (ตรวจสอบความครบถ้วนของข้อมูลสำคัญ)
    // =========================================================================
    if (
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

    let getDateTimeOrder = `select o.ist_dt, p.ptrl_code from tbl_order o left join tbl_petrol p on o.ship_to = p.ptrl_number where o.sh_cus_ref = '${sh_cus_ref}' and o.order_flag = '1' limit 1 `
    let getDateTimeOrderResult = await pgConn.get(
      dbPrefix + lic_code,
      getDateTimeOrder,
      config.connectionString(),
    );

    let ist_dt = "";
    let ptrl_code = "";
    if (!getDateTimeOrderResult.code) {
      if (getDateTimeOrderResult.data.length > 0) {
        ist_dt = getDateTimeOrderResult.data[0].ist_dt;
        ptrl_code = getDateTimeOrderResult.data[0].ptrl_code;
      }
    }
    // =========================================================
    // สร้าง Dynamic WHERE Clause สำหรับ Query หลัก (ดึงข้อมูล Stock)
    // =========================================================
    let conditions = [];
    sh_cus_ref = sh_cus_ref || "ALL";

    if (ptrl_code) {
      conditions.push(`ati.ptrl_code = '${ptrl_code}'`);
    } else if (sh_cus_ref.toString().toUpperCase() !== "ALL") {
      conditions.push(`ati.sh_cus_ref = '${sh_cus_ref}'`);
    }

    let orderDate = ist_dt ? moment(ist_dt).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD");
    conditions.push(`ati.stock_at::date = '${orderDate}'::date`);

    let whereClause = "";
    if (conditions.length > 0) {
      whereClause = "WHERE " + conditions.join(" AND ");
    }

    // =========================================================================
    // SQL Query หลักสำหรับดึงข้อมูลออเดอร์ (พร้อม JOIN ข้อมูลที่เกี่ยวข้อง)
    // =========================================================================
    let baseSelectQuery = `
            SELECT 
              distinct
                ati.sh_cus_ref,
                tbl_petrol.ptrl_code,
                tbl_petrol.ptrl_desc,
                tbl_item.itm_code,
                tbl_item.itm_desc,
                tbl_petrol_tank.tnk_number,
                ati.stock::numeric(10,2) as stock,
                ati.fill_volume::numeric(10,2) as fill_volume,
                ati.fill_volume_after::numeric(10,2) as fill_volume_after,
                ati.fill_volume_actual::numeric(10,2) as fill_volume_actual,
                ati.tnk_capacity,
                ati.tnk_target,
                ati.tnk_deadstock,
                ati.tnk_safety_factor,
                tbl_vehicle_type.veh_type_desc,
                ati.ist_dt
            FROM tbl_automatics_tanks_information ati
            LEFT JOIN tbl_petrol ON ati.ptrl_code = tbl_petrol.ptrl_code
            LEFT JOIN tbl_item ON ati.itm_code = tbl_item.itm_code
            LEFT JOIN tbl_vehicle_type ON ati.veh_type_code = tbl_vehicle_type.veh_type_code
            LEFT JOIN tbl_petrol_tank ON ati.tank_code = tbl_petrol_tank.ptrl_tank_code
        `;

    let dataScript = `
            ${baseSelectQuery}
            ${whereClause}
            ORDER BY tbl_petrol_tank.tnk_number ASC;
        `;
    console.log(dataScript)

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

// =========== ดึงข้อมูลรายละเอียดของ Sales Auto Order ตาม ID ที่ระบุ ========
exports.getSalesAutoOrderInformation = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    // =========================================================================
    // รับค่า Request Parameters และกำหนดค่าเริ่มต้น
    // =========================================================================
    let lic_code = req.header("lic_code");
    let {
      sh_cus_ref,
      action,
    } = req.body[0] || {};


    // =========================================================================
    // (ตรวจสอบความครบถ้วนของข้อมูลสำคัญ)
    // =========================================================================
    if (
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



    let getDateTimeOrder = `select o.ist_dt, p.ptrl_code from tbl_order o left join tbl_petrol p on o.ship_to = p.ptrl_number where o.sh_cus_ref = '${sh_cus_ref}' and o.order_flag = '1' limit 1 `
    let getDateTimeOrderResult = await pgConn.get(
      dbPrefix + lic_code,
      getDateTimeOrder,
      config.connectionString(),
    );

    let ist_dt = "";
    let ptrl_code = "";
    if (!getDateTimeOrderResult.code) {
      if (getDateTimeOrderResult.data.length > 0) {
        ist_dt = getDateTimeOrderResult.data[0].ist_dt;
        ptrl_code = getDateTimeOrderResult.data[0].ptrl_code;
      }
    }

    // =========================================================
    // สร้าง Dynamic WHERE Clause สำหรับ Query หลัก (ดึงข้อมูล Stock)
    // =========================================================
    let conditions = [];
    sh_cus_ref = sh_cus_ref || "ALL";

    if (ptrl_code) {
      conditions.push(`sub_ats.ptrl_code = '${ptrl_code}'`);
    } else if (sh_cus_ref.toString().toUpperCase() !== "ALL") {
      conditions.push(`sub_ats.sh_cus_ref = '${sh_cus_ref}'`);
    }

    let orderDate = ist_dt ? moment(ist_dt).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD");
    conditions.push(`sub_ats.sale_at_previous::date = '${orderDate}'::date`);

    let whereClause = "";
    if (conditions.length > 0) {
      whereClause = "WHERE " + conditions.join(" AND ");
    }

    // base query
    // =========================================================================
    // sql query (แก้ไขแบบเด็ดขาด: ยุบยอดขายด้วย DISTINCT ON ใน subquery ก่อนทำการ join)
    // =========================================================================
    let baseSelectQuery = `
            select 
                sub_ats.sh_cus_ref,
                tbl_petrol.ptrl_code,
                tbl_petrol.ptrl_desc,
                tbl_item.itm_code,
                tbl_item.itm_desc,
                tbl_petrol_tank.tnk_number,
                sub_ats.sale_previous,
                sub_ats.sale_at_previous,
                sub_ats.sale_previous1,
                sub_ats.sale_at_previous1,
                sub_ats.sale_previous2,
                sub_ats.sale_at_previous2,
                sub_ats.sale_previous3,
                sub_ats.sale_at_previous3,
                sub_ats.sale_previous4,
                sub_ats.sale_at_previous4,
                sub_ats.sale_previous5,
                sub_ats.sale_at_previous5,
                sub_ats.sale_previous6,
                sub_ats.sale_at_previous6,
                sub_ats.sale_previous7,
                sub_ats.sale_at_previous7,
                sub_ats.sale_previous8,
                sub_ats.sale_at_previous8,
                sub_ats.sale_previous9,
                sub_ats.sale_at_previous9,
                sub_ats.sale_previous10,
                sub_ats.sale_at_previous10,
                sub_ats.sale_previous11,
                sub_ats.sale_at_previous11,
                sub_ats.sale_previous12,
                sub_ats.sale_at_previous12,
                sub_ats.sale_previous13,
                sub_ats.sale_at_previous13,
                sub_ats.sale_previous14,
                sub_ats.sale_at_previous14
            from (
                select distinct on (ptrl_code, tank_code, sale_at_previous::date)
                    sh_cus_ref,
                    ptrl_code,
                    itm_code,
                    tank_code,
                    sale_previous,
                    sale_at_previous,
                    sale_previous1,
                    sale_at_previous1,
                    sale_previous2,
                    sale_at_previous2,
                    sale_previous3,
                    sale_at_previous3,
                    sale_previous4,
                    sale_at_previous4,
                    sale_previous5,
                    sale_at_previous5,
                    sale_previous6,
                    sale_at_previous6,
                    sale_previous7,
                    sale_at_previous7,
                    sale_previous8,
                    sale_at_previous8,
                    sale_previous9,
                    sale_at_previous9,
                    sale_previous10,
                    sale_at_previous10,
                    sale_previous11,
                    sale_at_previous11,
                    sale_previous12,
                    sale_at_previous12,
                    sale_previous13,
                    sale_at_previous13,
                    sale_previous14,
                    sale_at_previous14
                from tbl_automatics_sales_previous_information
                order by ptrl_code, tank_code, sale_at_previous::date, ist_dt desc
            ) sub_ats
            left join tbl_petrol on sub_ats.ptrl_code = tbl_petrol.ptrl_code
            left join tbl_item on sub_ats.itm_code = tbl_item.itm_code
            left join tbl_petrol_tank on sub_ats.tank_code = tbl_petrol_tank.ptrl_tank_code
        `;

    let dataScript = `
            ${baseSelectQuery}
            ${whereClause} 
            order by tbl_petrol_tank.tnk_number asc;
        `;

    console.log(dataScript)

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

