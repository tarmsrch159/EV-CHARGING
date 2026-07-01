const config = require("../../configuration/connection");
const pgConn = require("../../library/pgConnection");
const moment = require("moment");
const xglobal = require("../../middleware/global");

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
exports.getDepotInformation = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let {
      dpo_code,
      off_code,
      dpo_group_code,
      search,
      page_index,
      page_limit,
      action,
    } = req.body[0];
    page_index == undefined ? (page_index = 1) : page_index;
    page_limit == undefined ? (page_limit = 10) : page_limit;
    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      dpo_code == undefined ||
      off_code == undefined ||
      dpo_group_code == undefined ||
      lic_code == undefined ||
      search == undefined ||
      action == undefined
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
    } else {
      let script = ``;
      if (page_index > 0) {
        page_index -= 1;
      }


      // const managerScript = `select ptrl_code from tbl_employee where emp_code = '${action[0].id}'`;
      // let managerData = await pgConn.get(
      //   dbPrefix + lic_code,
      //   managerScript,
      //   config.connectionString(),
      // );

      // const codeIn = (managerData.data?.[0]?.ptrl_code || "")
      //   .replace(/[\[\]'"\s]/g, "")
      //   .split(",")
      //   .filter(Boolean);
      // // เช็คค่า null ของ manager
      // let act_val = action[0]?.value?.toString().toUpperCase() || "ALL";
      // if (act_val === "MANAGER") {
      //   if (codeIn.length === 0) {
      //     let response = [
      //       {
      //         status: "success",
      //         invalid_code: "0",
      //         message: "",
      //         data: [],
      //         response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
      //         page_total: 0,
      //         rows_total: 0,
      //       },
      //     ];
      //     res.status(200).send(response);
      //     return;
      //   }
      // }

      // let managerCodeIn = `(${codeIn.map((item) => `'${item}'`).join(", ")})`;
      // console.log(managerCodeIn)

      if (dpo_code.toString().toUpperCase() != "ALL") {
        script = `select 
       distinct tbl_depot.dpo_code, dpo_number, dpo_desc, dpo_short_desc, dpo_address, dpo_zip_code, dpo_country_code,
                dpo_loading_minute, dpo_expenses_per_km, dpo_area, dpo_lat, dpo_lon,
                tbl_depot.off_code, tbl_depot.dpo_group_code, dpo_group_desc, tbl_depot.ist_dt, tbl_depot.mdf_dt, tbl_depot.rm_dt, tbl_depot.prov_code, 
                tbl_depot.amph_code, tbl_depot.tamb_code, tbl_province.prov_desc, tbl_amphure.amph_desc, tbl_tambon.tamb_desc, dpo_flag,
                tbl_depot.dpo_sales_org, tbl_order_type.ord_type_desc, tbl_order_type.sales_order_type
                from tbl_depot 
                left join tbl_order_type on tbl_depot.dpo_order_type = tbl_order_type.ord_type_code
                left join tbl_depot_group on tbl_depot.dpo_group_code = tbl_depot_group.dpo_group_code 
                left join tbl_province on tbl_depot.prov_code = tbl_province.prov_code 
                left join tbl_amphure on tbl_depot.amph_code = tbl_amphure.amph_code 
                left join tbl_tambon on tbl_depot.tamb_code = tbl_tambon.tamb_code 
                left join tbl_petrol_depot dp on tbl_depot.dpo_code = dp.dpo_code
                where dpo_flag = '1' and tbl_depot.dpo_code = '${dpo_code}'`;
      } else {
        script = `select 
        distinct tbl_depot.dpo_code, dpo_number, dpo_desc, dpo_short_desc, dpo_address, dpo_zip_code, dpo_country_code,
                dpo_loading_minute, dpo_expenses_per_km, dpo_area, dpo_lat, dpo_lon,
                tbl_depot.off_code, tbl_depot.dpo_group_code, dpo_group_desc, tbl_depot.ist_dt, tbl_depot.mdf_dt, tbl_depot.rm_dt, tbl_depot.prov_code, 
                tbl_depot.amph_code, tbl_depot.tamb_code, tbl_province.prov_desc, tbl_amphure.amph_desc, tbl_tambon.tamb_desc, dpo_flag,
                tbl_depot.dpo_sales_org, tbl_order_type.ord_type_desc, tbl_order_type.sales_order_type
                from tbl_depot 
                left join tbl_order_type on tbl_depot.dpo_order_type = tbl_order_type.ord_type_code
                left join tbl_depot_group on tbl_depot.dpo_group_code = tbl_depot_group.dpo_group_code 
                left join tbl_province on tbl_depot.prov_code = tbl_province.prov_code 
                left join tbl_amphure on tbl_depot.amph_code = tbl_amphure.amph_code 
                left join tbl_tambon on tbl_depot.tamb_code = tbl_tambon.tamb_code 
                left join tbl_petrol_depot dp on tbl_depot.dpo_code = dp.dpo_code
                where dpo_flag = '1'`;
      }

      if (
        dpo_group_code.toString().toUpperCase() != "ALL" &&
        dpo_group_code.toString().toUpperCase() != ""
      ) {
        script += ` and tbl_depot.dpo_group_code = '${dpo_group_code}'`;
      }


      if (search != "") {
        script += ` and (dpo_number like '%${search}%' 
                or dpo_desc like UPPER('%${search}%')
                or dpo_short_desc like '%${search}%' 
                or dpo_address like '%${search}%')`;
      }

      // =========================================================================
      // กรองข้อมูลตามสิทธิ์การเข้าถึง (Role Authorization)
      // =========================================================================
      // act_val = action[0]?.value?.toString().toUpperCase() || "ALL";
      // let act_id = action[0]?.id || "";
      // if (act_val === "GROUP") {
      //   // กรองตาม Order Type (ZOR1, ZOR2)
      //   script += ` and (
      //           NOT EXISTS (SELECT 1 FROM tbl_employee_order_type WHERE emp_code = '${act_id}' AND emp_otyp_flag = 1)
      //           OR tbl_depot.dpo_order_type IN (
      //               SELECT t2.ord_type_code 
      //               FROM tbl_employee_order_type t1 
      //               JOIN tbl_order_type t2 ON t1.ord_type_code = t2.ord_type_code 
      //               WHERE t1.emp_code = '${act_id}' AND t1.emp_otyp_flag = 1
      //           )
      //       )`;

      //   // กรองตาม Sales Org (1000, 1900)
      //   script += ` and (NOT EXISTS (SELECT 1 FROM tbl_employee_sales_org WHERE emp_code = '${act_id}' AND emp_sorg_flag = 1)
      //           OR tbl_depot.dpo_sales_org IN (SELECT sales_org_code FROM tbl_employee_sales_org WHERE emp_code = '${act_id}' AND emp_sorg_flag = 1)
      //       )`;
      // } else 

      // if (act_val === "MANAGER") {
      //   script += ` and dp.ptrl_code in ${managerCodeIn}`;
      // }



      script += ` order by ist_dt desc `;
      script += ` offset (${page_index}*${page_limit}) limit ${page_limit};`;

      let tbl_temporary = await pgConn.get(
        dbPrefix + lic_code,
        script,
        config.connectionString(),
      );

      if (!tbl_temporary.code) {
        //debugger
        if (tbl_temporary.data.length > 0) {
          tbl_temporary.data = JSON.parse(
            JSON.stringify(tbl_temporary.data).replace(/\:null/gi, '\:""'),
          );

          let page_total = 0;
          let rows_total = 0;
          script = ``;
          if (dpo_code.toString().toUpperCase() != "ALL") {
            script = `select ceil((ceil(count(distinct tbl_depot.dpo_code)) / ${page_limit})) as page_total, (count(distinct tbl_depot.dpo_code)) as rows_total 
                        from tbl_depot 
                        left join tbl_order_type on tbl_depot.dpo_order_type = tbl_order_type.ord_type_code
                        left join tbl_depot_group on tbl_depot.dpo_group_code = tbl_depot_group.dpo_group_code 
                        left join tbl_province on tbl_depot.prov_code = tbl_province.prov_code 
                        left join tbl_amphure on tbl_depot.amph_code = tbl_amphure.amph_code 
                        left join tbl_tambon on tbl_depot.tamb_code = tbl_tambon.tamb_code 
                left join tbl_petrol_depot dp on tbl_depot.dpo_code = dp.dpo_code
                        where dpo_flag = '1' and tbl_depot.dpo_code = '${dpo_code}' `;
          } else {
            script = `select ceil((ceil(count(distinct tbl_depot.dpo_code)) / ${page_limit})) as page_total, (count(distinct tbl_depot.dpo_code)) as rows_total 
                        from tbl_depot 
                        left join tbl_depot_group on tbl_depot.dpo_group_code = tbl_depot_group.dpo_group_code 
                        left join tbl_order_type on tbl_depot.dpo_order_type = tbl_order_type.ord_type_code
                        left join tbl_province on tbl_depot.prov_code = tbl_province.prov_code 
                        left join tbl_amphure on tbl_depot.amph_code = tbl_amphure.amph_code 
                        left join tbl_tambon on tbl_depot.tamb_code = tbl_tambon.tamb_code 
                        left join tbl_petrol_depot dp on tbl_depot.dpo_code = dp.dpo_code
                        where dpo_flag = '1'`;
          }

          if (
            dpo_group_code.toString().toUpperCase() != "ALL" &&
            dpo_group_code.toString().toUpperCase() != ""
          ) {
            script += ` and tbl_depot.dpo_group_code = '${dpo_group_code}'`;
          }

          // if (
          //   off_code.toString().toUpperCase() != "ALL" &&
          //   off_code.toString().toUpperCase() != ""
          // ) {
          //   script += ` and tbl_depot.off_code = '${off_code}'`;
          // }

          if (search != "") {
            script += ` and (dpo_number like '%${search}%' 
                        or dpo_group_desc like '%${search}%' 
                        or dpo_desc like '%${search}%' 
                        or dpo_short_desc like '%${search}%' 
                        or dpo_address like '%${search}%' 
                        or dpo_city like '%${search}%' 
                        or dpo_zip_code like '%${search}%')`;
          }


          // =========================================================================
          // กรองข้อมูลตามสิทธิ์การเข้าถึง (Role Authorization)
          // =========================================================================
          // act_val = action[0]?.value?.toString().toUpperCase() || "ALL";
          // let act_id = action[0]?.id || "";
          // if (act_val === "GROUP") {
          //   // กรองตาม Order Type (ZOR1, ZOR2)
          //   script += ` and (
          //       NOT EXISTS (SELECT 1 FROM tbl_employee_order_type WHERE emp_code = '${act_id}' AND emp_otyp_flag = 1)
          //       OR tbl_depot.dpo_order_type IN (
          //           SELECT t2.ord_type_code 
          //           FROM tbl_employee_order_type t1 
          //           JOIN tbl_order_type t2 ON t1.ord_type_code = t2.ord_type_code 
          //           WHERE t1.emp_code = '${act_id}' AND t1.emp_otyp_flag = 1
          //       )
          //   )`;

          //   // กรองตาม Sales Org (1000, 1900)
          //   script += ` and (NOT EXISTS (SELECT 1 FROM tbl_employee_sales_org WHERE emp_code = '${act_id}' AND emp_sorg_flag = 1)
          //       OR tbl_depot.dpo_sales_org IN (SELECT sales_org_code FROM tbl_employee_sales_org WHERE emp_code = '${act_id}' AND emp_sorg_flag = 1)
          //   )`;
          // } else 

          // if (act_val === "MANAGER") {
          //   script += ` and dp.ptrl_code in ${managerCodeIn}`;
          // }
          let tbl_temporary0 = await pgConn.get(
            dbPrefix + lic_code,
            script,
            config.connectionString(),
          );

          console.log(tbl_temporary0)

          if (!tbl_temporary0.code) {
            if (tbl_temporary0.data.length > 0) {
              page_total = parseInt(tbl_temporary0.data[0].page_total);
              rows_total = parseInt(tbl_temporary0.data[0].rows_total);
            }
          }

          const formattedData = tbl_temporary.data.map((item) => {
            const {
              prov_code,
              prov_desc,
              amph_code,
              amph_desc,
              tamb_code,
              tamb_desc,
              ...rest
            } = item;

            return {
              ...rest,
              location: {
                province: { code: prov_code, name: prov_desc },
                amphure: { code: amph_code, name: amph_desc },
                tambon: { code: tamb_code, name: tamb_desc },
              },
            };
          });

          let response = [
            {
              status: "success",
              invalid_code: "0",
              message: "",
              data: formattedData,
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
          action[0].id,
          "ดึงข้อมูลคลังน้ำมัน",
          JSON.stringify(req.body[0]),
          "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
          action[0].value,
        );
        return;
      }
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
        page_total: 0,
        rows_total: 0,
      },
    ];
    res.status(200).send(response);
    await xglobal.action_logs(
      lic_code,
      action[0].id,
      "ดึงข้อมูลคลังน้ำมัน",
      JSON.stringify(req.body[0]),
      "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      action[0].value,
    );
    return;
  });
};

exports.removeDepot = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let { dpo_code, action } = req.body[0];
    //เช็คเฉพาะส่วนที่สำคัญ
    if (dpo_code == undefined || lic_code == undefined || action == undefined) {
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
      script = `update tbl_depot set dpo_flag = '0', rm_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}' 
            where dpo_code = '${dpo_code}';`;

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
          "ลบข้อมูลคลังน้ำมัน",
          JSON.stringify(req.body[0]),
          "ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
          action[0].value,
        );
        return;
      }
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
    await xglobal.action_logs(
      lic_code,
      action[0].id,
      "ลบข้อมูลคลังน้ำมัน",
      JSON.stringify(req.body[0]),
      "ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      action[0].value,
    );
    return;
  });
};

exports.setDepotInformation = async (req, res, next) => {
  return (async () => {
    debugger;
    let lic_code = req.header("lic_code");
    let { dpo_code } = req.query;
    let {
      dpo_number,
      dpo_desc,
      dpo_short_desc,
      dpo_address,
      dpo_zip_code,
      dpo_city,
      dpo_country_code,
      dpo_loading_minute,
      dpo_expenses_per_km,
      dpo_area,
      dpo_lat,
      dpo_lon,
      off_code,
      dpo_group_code,
      prov_code,
      amph_code,
      tamb_code,
      dpo_sales_org,
      dpo_order_type,
      action,
    } = req.body[0];

    //เช็คพารามิเตอร์ที่จำเป็น
    let missing = [];
    if (dpo_code == undefined) missing.push("dpo_code");
    if (dpo_number == undefined) missing.push("dpo_number");
    if (dpo_desc == undefined) missing.push("dpo_desc");
    if (dpo_lat == undefined) missing.push("dpo_lat");
    if (dpo_lon == undefined) missing.push("dpo_lon");
    if (off_code == undefined) missing.push("off_code");
    if (dpo_group_code == undefined) missing.push("dpo_group_code");
    if (prov_code == undefined) missing.push("prov_code");
    if (amph_code == undefined) missing.push("amph_code");
    if (tamb_code == undefined) missing.push("tamb_code");
    if (action == undefined) missing.push("action");

    if (missing.length > 0) {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(", ")})`,
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      return res.status(200).send(response);
    } else {
      dpo_loading_minute =
        dpo_loading_minute === "" ||
          dpo_loading_minute === undefined ||
          dpo_loading_minute === null
          ? "NULL"
          : dpo_loading_minute;
      dpo_expenses_per_km =
        dpo_expenses_per_km === "" ||
          dpo_expenses_per_km === undefined ||
          dpo_expenses_per_km === null
          ? 0
          : dpo_expenses_per_km;
      dpo_area =
        dpo_area === "" || dpo_area === undefined || dpo_area === null
          ? 0
          : dpo_area;
      dpo_sales_org =
        dpo_sales_org === "" ||
          dpo_sales_org === undefined ||
          dpo_sales_org === null
          ? "NULL"
          : dpo_sales_org;
      dpo_order_type =
        dpo_order_type === "" ||
          dpo_order_type === undefined ||
          dpo_order_type === null
          ? "NULL"
          : dpo_order_type;
      dpo_short_desc = dpo_short_desc || "";
      dpo_address = dpo_address || "";
      dpo_zip_code = dpo_zip_code || "";
      dpo_city = dpo_city || "";
      dpo_country_code = dpo_country_code || "";

      let script = ``;
      script = `update tbl_depot set
            dpo_number = '${dpo_number}',
            dpo_desc = '${dpo_desc}',
            dpo_short_desc = '${dpo_short_desc}',
            dpo_address = '${dpo_address}',
            dpo_zip_code = '${dpo_zip_code}',
            dpo_city = '${dpo_city}',
            dpo_country_code = '${dpo_country_code}',
            dpo_loading_minute = ${dpo_loading_minute},
            dpo_expenses_per_km = ${dpo_expenses_per_km},
            dpo_area = ${dpo_area},
            dpo_lat = '${dpo_lat}',
            dpo_lon = '${dpo_lon}',
            off_code = '${off_code}',
            dpo_group_code = '${dpo_group_code}',
            prov_code = '${prov_code}',
            amph_code = '${amph_code}',
            tamb_code = '${tamb_code}',
            dpo_sales_org = '${dpo_sales_org}',
            dpo_order_type = '${dpo_order_type}',
            mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}'
            where dpo_code = '${dpo_code}';`;

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
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];

        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "แก้ไขข้อมูลคลังน้ำมัน",
          JSON.stringify(req.body[0]),
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
          "แก้ไขข้อมูลคลังน้ำมัน",
          JSON.stringify(req.body[0]),
          "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
          action[0].value,
        );
        return;
      }
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
    await xglobal.action_logs(
      lic_code,
      action[0].id,
      "แก้ไขข้อมูลคลังน้ำมัน",
      JSON.stringify(req.body[0]),
      "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      action[0].value,
    );
    return;
  });
};

exports.addDepotInformation = async (req, res, next) => {
  return (async () => {
    debugger;
    let lic_code = req.header("lic_code");
    let {
      dpo_number,
      dpo_desc,
      dpo_short_desc,
      dpo_address,
      dpo_zip_code,
      dpo_country_code,
      dpo_loading_minute,
      dpo_expenses_per_km,
      dpo_area,
      dpo_lat,
      dpo_lon,
      off_code,
      dpo_group_code,
      prov_code,
      amph_code,
      tamb_code,
      dpo_sales_org,
      dpo_order_type,
      dpo_city,
      action,
    } = req.body[0];

    //เช็คพารามิเตอร์ที่จำเป็น
    let missing = [];
    if (dpo_number == undefined) missing.push("dpo_number");
    if (dpo_desc == undefined) missing.push("dpo_desc");
    if (dpo_lat == undefined) missing.push("dpo_lat");
    if (dpo_lon == undefined) missing.push("dpo_lon");
    if (off_code == undefined) missing.push("off_code");
    if (dpo_group_code == undefined) missing.push("dpo_group_code");
    if (prov_code == undefined) missing.push("prov_code");
    if (amph_code == undefined) missing.push("amph_code");
    if (tamb_code == undefined) missing.push("tamb_code");
    if (action == undefined) missing.push("action");

    if (missing.length > 0) {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(", ")})`,
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      return res.status(200).send(response);
    } else {
      dpo_loading_minute =
        dpo_loading_minute === "" ||
          dpo_loading_minute === undefined ||
          dpo_loading_minute === null
          ? "NULL"
          : dpo_loading_minute;
      dpo_expenses_per_km =
        dpo_expenses_per_km === "" ||
          dpo_expenses_per_km === undefined ||
          dpo_expenses_per_km === null
          ? 0
          : dpo_expenses_per_km;
      dpo_area =
        dpo_area === "" || dpo_area === undefined || dpo_area === null
          ? 0
          : dpo_area;
      dpo_sales_org =
        dpo_sales_org === "" ||
          dpo_sales_org === undefined ||
          dpo_sales_org === null
          ? "NULL"
          : dpo_sales_org;
      dpo_order_type =
        dpo_order_type === "" ||
          dpo_order_type === undefined ||
          dpo_order_type === null
          ? "NULL"
          : dpo_order_type;
      dpo_short_desc = dpo_short_desc || "";
      dpo_address = dpo_address || "";
      dpo_zip_code = dpo_zip_code || "";
      dpo_city = dpo_city || "";
      dpo_country_code = dpo_country_code || "";

      let script = ``;
      script = `select dpo_code from tbl_depot where (dpo_desc = '${dpo_desc}' or dpo_number = '${dpo_number}') and dpo_flag = '1';`;
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
              message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลคลังน้ำมันซ้ำ`,
              data: [],
              response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
            },
          ];

          res.status(200).send(response);
          await xglobal.action_logs(
            lic_code,
            action[0].id,
            "เพิ่มข้อมูลคลังน้ำมัน",
            JSON.stringify(req.body[0]),
            "ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลคลังน้ำมันซ้ำ",
            action[0].value,
          );
          return;
        }
      }

      let dpo_code = "dpo-" + moment().format("x");
      script = `insert into tbl_depot 
            (dpo_code, dpo_number, dpo_desc, dpo_short_desc, dpo_address, dpo_zip_code, dpo_country_code, dpo_loading_minute,
            dpo_expenses_per_km, dpo_area, dpo_lat, dpo_lon, off_code, dpo_group_code, prov_code, amph_code, tamb_code, dpo_flag, ist_dt, dpo_sales_org, dpo_order_type, dpo_city) 
            values 
            ('${dpo_code}', '${dpo_number}', '${dpo_desc}', '${dpo_short_desc}', '${dpo_address}', '${dpo_zip_code}', 
            '${dpo_country_code}', ${dpo_loading_minute}, ${dpo_expenses_per_km}, 
            ${dpo_area}, ${dpo_lat}, ${dpo_lon}, '${off_code}', '${dpo_group_code}',
            '${prov_code}', '${amph_code}', '${tamb_code}', '1', '${moment().format("YYYY-MM-DD HH:mm:ss")}', '${dpo_sales_org}', '${dpo_order_type}', '${dpo_city}');`;

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
                dpo_code: dpo_code,
              },
            ],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];

        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "เพิ่มข้อมูลคลังน้ำมัน",
          JSON.stringify(req.body[0]),
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
          "เพิ่มข้อมูลคลังน้ำมัน",
          JSON.stringify(req.body[0]),
          "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
          action[0].value,
        );
        return;
      }
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
    await xglobal.action_logs(
      lic_code,
      action[0].id,
      "เพิ่มข้อมูลคลังน้ำมัน",
      JSON.stringify(req.body[0]),
      "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      action[0].value,
    );
    return;
  });
};
