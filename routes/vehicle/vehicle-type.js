const config = require("../../configuration/connection");
const pgConn = require("../../library/pgConnection");
const moment = require("moment");
const xglobal = require("../../middleware/global");

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
//Success
exports.getVehicleTypeInformationWithDetail = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let { veh_type_code, action, page_index, page_limit } = req.body[0];
    page_limit = page_limit == undefined ? 10 : page_limit;
    page_index = page_index == undefined ? 1 : page_index;

    if (page_index > 0) {
      page_index -= 1;
    }

    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      veh_type_code == undefined ||
      lic_code == undefined ||
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
        },
      ];

      res.status(200).send(response);
      return;
    } else {
      let script = `select 
                    v.veh_type_code, 
                    v.veh_type_desc, 
                    v.veh_type_flag, 
                    v.veh_qty,
                    v.veh_qty as veh_qty_remaining,
                    v.veh_unavailable, 
                    v.max_merg,
                    (v.veh_qty - v.veh_unavailable) as veh_available,
                    v.capacity_total,
                    v.capacity_max,
                    v.capacity_min,
                    v.compartment_qty,
                    v.ist_dt, 
                    v.mdf_dt, 
                    v.rm_dt,
                    case when v.unloading_minute is null then 0 else v.unloading_minute end as unloading_minute,
                    case when v.loading_minute is null then 0 else v.loading_minute end as loading_minute,
                    c.id as compartment_id,
                    c.compartment_no,
                    c.compartment_total,
                    c.compartment_max,
                    c.compartment_min,
                    cl.veh_compartment_level_type_code,
                    cl.veh_compartment_type_level_number,
                    cl.veh_compartment_type_level
                from tbl_vehicle_type v
                left join tbl_vehicle_type_compartment c on v.veh_type_code = c.veh_type_code and (c.flag = '1' or c.flag is null)
                left join tbl_vehicle_type_compartment_level cl on c.id = cl.compartment_item_id and cl.veh_compartment_type_level_flag = '1'
                where v.veh_type_flag = '1'`;

      if (veh_type_code.toString().toUpperCase() != "ALL") {
        script += ` and v.veh_type_code = '${veh_type_code}'`;
      }

      script += ` order by v.ist_dt desc, c.compartment_no asc, cl.veh_compartment_type_level_number asc`;
      script += ` limit ${page_limit} offset ${page_index * page_limit}`;
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
          let page_total = 0;
          let rows_total = 0;

          if (veh_type_code.toString().toUpperCase() != "ALL") {
            script = `select 
                        count(*) as rows_total,
                        ceil(count(v.veh_type_code) / ${page_limit}) as page_total
                        from tbl_vehicle_type v
                        left join tbl_vehicle_type_compartment c on v.veh_type_code = c.veh_type_code and (c.flag = '1' or c.flag is null)
                        where v.veh_type_flag = '1' and v.veh_type_code = '${veh_type_code}'`;
          } else {
            script = `select 
                        count(*) as rows_total,
                        ceil(count(v.veh_type_code) / ${page_limit}) as page_total
                        from tbl_vehicle_type v
                        left join tbl_vehicle_type_compartment c on v.veh_type_code = c.veh_type_code and (c.flag = '1' or c.flag is null)
                        where v.veh_type_flag = '1'`;
          }

          let tbl_temporary_count = await pgConn.get(
            dbPrefix + lic_code,
            script,
            config.connectionString(),
          );
          if (!tbl_temporary_count.code) {
            if (tbl_temporary_count.data.length > 0) {
              tbl_temporary_count.data = JSON.parse(
                JSON.stringify(tbl_temporary_count.data).replace(
                  /\:null/gi,
                  '\:""',
                ),
              );
              page_total = parseInt(tbl_temporary_count.data[0].page_total);
              rows_total = parseInt(tbl_temporary_count.data[0].rows_total);
            }
          }
          // จัดกลุ่มข้อมูล
          let groupedData = Object.values(
            tbl_temporary.data.reduce((acc, curr) => {
              let key = curr.veh_type_code;

              // ถ้ายังไม่มีกลุ่มรถนี้ ให้สร้าง object หลักขึ้นมา
              if (!acc[key]) {
                acc[key] = {
                  veh_type_code: curr.veh_type_code,
                  veh_type_desc: curr.veh_type_desc,
                  veh_type_flag: curr.veh_type_flag,
                  veh_qty: curr.veh_qty,
                  veh_qty_remaining: curr.veh_qty_remaining,
                  max_merg: curr.max_merg,
                  veh_unavailable: curr.veh_unavailable,
                  veh_available: curr.veh_available,
                  capacity_total: curr.capacity_total,
                  capacity_max: curr.capacity_max,
                  capacity_min: curr.capacity_min,
                  compartment_qty: curr.compartment_qty,
                  unloading_minute: curr.unloading_minute,
                  loading_minute: curr.loading_minute,
                  ist_dt: curr.ist_dt,
                  mdf_dt: curr.mdf_dt,
                  rm_dt: curr.rm_dt,
                  compartment_list: [],
                };
              }

              // ถ้ามีข้อมูลช่องรถ
              if (curr.compartment_no !== "" && curr.compartment_no !== null) {
                let currCompItem = acc[key].compartment_list.find(
                  (c) => c.compartment_no === curr.compartment_no,
                );
                if (!currCompItem) {
                  acc[key].compartment_list.push({
                    compartment_id: curr.compartment_id,
                    compartment_no: curr.compartment_no,
                    compartment_total: curr.compartment_total,
                    compartment_max: curr.compartment_max,
                    compartment_min: curr.compartment_min,
                    level_data: [],
                  });
                  currCompItem =
                    acc[key].compartment_list[
                    acc[key].compartment_list.length - 1
                    ];
                }

                if (
                  curr.veh_compartment_level_type_code !== "" &&
                  curr.veh_compartment_level_type_code !== null
                ) {
                  currCompItem.level_data.push({
                    level_code: curr.veh_compartment_level_type_code,
                    level_number: curr.veh_compartment_type_level_number,
                    level_capacity: curr.veh_compartment_type_level,
                  });
                }
              }

              return acc;
            }, {}),
          );

          let response = [
            {
              status: "success",
              invalid_code: "0",
              message: "",
              data: groupedData, // <--- เปลี่ยนให้ส่ง groupedData แทน tbl_temporary.data
              page_total: page_total < 1 ? 1 : page_total,
              rows_total: rows_total,
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
              page_total: 0,
              rows_total: 0,
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
          "ดึงข้อมูลประเภทรถ",
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
      },
    ];
    res.status(200).send(response);
    const _lic = req.header("lic_code");
    const _act = req.body?.[0]?.action?.[0] || {};
    if (_lic && _act.id) {
      await xglobal.action_logs(
        _lic,
        _act.id,
        "ดึงข้อมูลประเภทรถ",
        JSON.stringify(req.body?.[0] || {}),
        "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        _act.value,
      );
    }
    return;
  });
};

exports.getVehicleTypeCompartmentInformationWithDetail = async (
  req,
  res,
  next,
) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let { compartment_id, action, page_index, page_limit } = req.body[0];
    page_limit = page_limit == undefined ? 10 : page_limit;
    page_index = page_index == undefined ? 1 : page_index;

    if (page_index > 0) {
      page_index -= 1;
    }

    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      compartment_id == undefined ||
      lic_code == undefined ||
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
        },
      ];

      res.status(200).send(response);
      return;
    } else {
      let script = `select 
                    ci.id as compartment_id,
                    ci.compartment_no,
                    ci.compartment_total,
                    ci.compartment_max,
                    ci.compartment_min,
                    ci.ist_dt, 
                    ci.mdf_dt, 
                    ci.rm_dt,
                    cl.veh_compartment_level_type_code,
                    cl.veh_compartment_type_level_number,
                    cl.veh_compartment_type_level
                from tbl_vehicle_type_compartment ci
                left join tbl_vehicle_type_compartment_level cl on ci.id = cl.compartment_item_id and cl.veh_compartment_type_level_flag = '1'
                where ci.flag = '1'`;

      if (compartment_id.toString().toUpperCase() != "ALL") {
        script += ` and ci.id = '${compartment_id}'`;
      }

      script += ` order by GREATEST(ci.ist_dt, COALESCE(ci.mdf_dt, ci.ist_dt)) desc, GREATEST(cl.ist_dt, COALESCE(cl.mdf_dt, cl.ist_dt)) desc`;
      script += ` limit ${page_limit} offset ${page_index * page_limit}`;
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
          let page_total = 0;
          let rows_total = 0;

          if (compartment_id.toString().toUpperCase() != "ALL") {
            script = `select 
                        count(*) as rows_total,
                        ceil(count(ci.id) / ${page_limit}) as page_total
                        from tbl_vehicle_type_compartment ci
                        where ci.flag = '1' and ci.id = '${compartment_id}'`;
          } else {
            script = `select 
                        count(*) as rows_total,
                        ceil(count(ci.id) / ${page_limit}) as page_total
                        from tbl_vehicle_type_compartment ci
                        where ci.flag = '1'`;
          }

          let tbl_temporary_count = await pgConn.get(
            dbPrefix + lic_code,
            script,
            config.connectionString(),
          );
          if (!tbl_temporary_count.code) {
            if (tbl_temporary_count.data.length > 0) {
              tbl_temporary_count.data = JSON.parse(
                JSON.stringify(tbl_temporary_count.data).replace(
                  /\:null/gi,
                  '\:""',
                ),
              );
              page_total = parseInt(tbl_temporary_count.data[0].page_total);
              rows_total = parseInt(tbl_temporary_count.data[0].rows_total);
            }
          }

          // จัดกลุ่มข้อมูล
          let groupedData = Object.values(
            tbl_temporary.data.reduce((acc, curr) => {
              let key = curr.compartment_id;

              // ถ้ายังไม่มีกลุ่มรถนี้ ให้สร้าง object หลักขึ้นมา
              if (!acc[key]) {
                acc[key] = {
                  compartment_id: curr.compartment_id,
                  compartment_no: curr.compartment_no,
                  compartment_total: curr.compartment_total,
                  compartment_max: curr.compartment_max,
                  compartment_min: curr.compartment_min,
                  ist_dt: curr.ist_dt,
                  mdf_dt: curr.mdf_dt,
                  rm_dt: curr.rm_dt,
                  level_data: [],
                };
              }

              // ถ้ามีข้อมูลระดับความจุ
              if (
                curr.veh_compartment_level_type_code !== "" &&
                curr.veh_compartment_level_type_code !== null
              ) {
                acc[key].level_data.push({
                  level_code: curr.veh_compartment_level_type_code,
                  level_number: curr.veh_compartment_type_level_number,
                  level_capacity: curr.veh_compartment_type_level,
                });
              }

              return acc;
            }, {}),
          );

          let response = [
            {
              status: "success",
              invalid_code: "0",
              message: "",
              data: groupedData, // <--- return groupedData
              page_total: page_total,
              rows_total: rows_total,
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
              page_total: 0,
              rows_total: 0,
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
          "ดึงข้อมูลประเภทรถ",
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
      },
    ];
    res.status(200).send(response);
    const _lic = req.header("lic_code");
    const _act = req.body?.[0]?.action?.[0] || {};
    if (_lic && _act.id) {
      await xglobal.action_logs(
        _lic,
        _act.id,
        "ดึงข้อมูลประเภทรถ",
        JSON.stringify(req.body?.[0] || {}),
        "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        _act.value,
      );
    }
    return;
  });
};

exports.getVehicleTypeInformation = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let { veh_type_code, action, page_index, page_limit } = req.body[0];
    page_limit = page_limit == undefined ? 10 : page_limit;
    page_index = page_index == undefined ? 1 : page_index;

    if (page_index > 0) {
      page_index -= 1;
    }

    //เช็คเฉพาะส่วนที่สำคัญ
    //เช็คพารามิเตอร์ที่จำเป็น
    let missing = [];
    if (veh_type_code == undefined) missing.push('veh_type_code');
    if (lic_code == undefined) missing.push('lic_code');
    if (action == undefined) missing.push('action');

    if (missing.length > 0) {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message: `ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`,
          data: xresult,
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];

      res.status(200).send(response);
      return;
    } else {
      let script = `select 
                    v.veh_type_code, 
                    v.veh_type_desc, 
                    v.veh_type_flag, 
                    v.veh_qty,
                    v.veh_qty as veh_qty_remaining,
                    v.veh_unavailable, 
                    v.max_merg,
                    (v.veh_qty - v.veh_unavailable) as veh_available,
                    v.capacity_total,
                    v.capacity_max,
                    v.capacity_min,
                    v.compartment_qty,
                    v.veht_sales_org,
                    v.veht_order_type,
                    ot.ord_type_desc,
                    ot.sales_order_type,
                    v.ist_dt, 
                    v.mdf_dt, 
                    v.rm_dt,
                    case when v.unloading_minute is null then 0 else v.unloading_minute end as unloading_minute,
                    case when v.loading_minute is null then 0 else v.loading_minute end as loading_minute
                from tbl_vehicle_type v
                left join tbl_order_type ot on v.veht_order_type = ot.ord_type_code
                where v.veh_type_flag = '1'`;

      if (veh_type_code.toString().toUpperCase() != "ALL") {
        script += ` and v.veh_type_code = '${veh_type_code}'`;
      }


      // ดัก undefined ให้ Action
      let act_val = action?.[0]?.value?.toString().toUpperCase() || "ALL";
      let act_id = action?.[0]?.id || "";

      // จัดการเงื่อนไขตามสิทธิ์การเข้าถึง
      if (act_val !== "ALL") {
        if (act_val === "GROUP") {

          // กรองตาม Order Type (ZOR1, ZOR2)
          script += ` AND (
          NOT EXISTS (SELECT 1 FROM tbl_employee_order_type WHERE emp_code = '${act_id}' AND emp_otyp_flag = 1)
          OR v.veht_order_type IN (
            SELECT t2.ord_type_code 
            FROM tbl_employee_order_type t1 
            JOIN tbl_order_type t2 ON t1.ord_type_code = t2.ord_type_code 
            WHERE t1.emp_code = '${act_id}' AND t1.emp_otyp_flag = 1
          )
        )`;

          // กรองตาม Sales Org (เช่น 1000, 1900)
          script += ` AND (
          NOT EXISTS (SELECT 1 FROM tbl_employee_sales_org WHERE emp_code = '${act_id}' AND emp_sorg_flag = 1)
          OR v.veht_sales_org IN (SELECT sales_org_code FROM tbl_employee_sales_org WHERE emp_code = '${act_id}' AND emp_sorg_flag = 1)
        )`;
        }
      }

      script += ` order by v.ist_dt desc`;
      script += ` limit ${page_limit} offset ${page_index * page_limit}`;
      console.log(script)
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
          let page_total = 0;
          let rows_total = 0;

          if (veh_type_code.toString().toUpperCase() != "ALL") {
            script = `select 
                        count(*) as rows_total,
                        ceil(count(v.veh_type_code) / ${page_limit}) as page_total
                        from tbl_vehicle_type v
                        where v.veh_type_flag = '1' and v.veh_type_code = '${veh_type_code}'`;
          } else {
            script = `select 
                        count(*) as rows_total,
                        ceil(count(v.veh_type_code) / ${page_limit}) as page_total
                        from tbl_vehicle_type v
                        where v.veh_type_flag = '1'`;
          }

          let tbl_temporary_count = await pgConn.get(
            dbPrefix + lic_code,
            script,
            config.connectionString(),
          );
          if (!tbl_temporary_count.code) {
            if (tbl_temporary_count.data.length > 0) {
              tbl_temporary_count.data = JSON.parse(
                JSON.stringify(tbl_temporary_count.data).replace(
                  /\:null/gi,
                  '\:""',
                ),
              );
              page_total = parseInt(tbl_temporary_count.data[0].page_total);
              rows_total = parseInt(tbl_temporary_count.data[0].rows_total);
            }
          }

          let response = [
            {
              status: "success",
              invalid_code: "0",
              message: "",
              data: tbl_temporary.data,
              page_total: page_total,
              rows_total: rows_total,
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
              page_total: 0,
              rows_total: 0,
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
          "ดึงข้อมูลประเภทรถ",
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
      },
    ];
    res.status(200).send(response);
    const _lic = req.header("lic_code");
    const _act = req.body?.[0]?.action?.[0] || {};
    if (_lic && _act.id) {
      await xglobal.action_logs(
        _lic,
        _act.id,
        "ดึงข้อมูลประเภทรถ",
        JSON.stringify(req.body?.[0] || {}),
        "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        _act.value,
      );
    }
    return;
  });
};

exports.getCompartmentItem = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let { compartment_id, action, page_index, page_limit } = req.body[0];
    page_limit = page_limit == undefined ? 10 : page_limit;
    page_index = page_index == undefined ? 1 : page_index;

    if (page_index > 0) {
      page_index -= 1;
    }
    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      compartment_id == undefined ||
      lic_code == undefined ||
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
        },
      ];

      res.status(200).send(response);
      return;
    } else {
      let script = `select 
                    ci.id as compartment_id,
                    ci.compartment_no,
                    ci.compartment_total,
                    ci.compartment_max,
                    ci.compartment_min,
                    ci.ist_dt, 
                    ci.mdf_dt, 
                    ci.rm_dt
                from tbl_vehicle_type_compartment ci
                where ci.flag = '1'`;

      if (compartment_id.toString().toUpperCase() != "ALL") {
        script += ` and ci.id = '${compartment_id}'`;
      }

      script += ` order by GREATEST(ci.ist_dt, COALESCE(ci.mdf_dt, ci.ist_dt)) desc`;
      script += ` limit ${page_limit} offset ${page_index * page_limit}`;

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

          let page_total = 0;
          let rows_total = 0;

          let script_count = `select 
                    count(*) as rows_total,
                    ceil(count(ci.id) / ${page_limit}) as page_total
                    from tbl_vehicle_type_compartment ci
                    where ci.flag = '1'`;

          if (compartment_id.toString().toUpperCase() != "ALL") {
            script_count += ` and ci.id = '${compartment_id}'`;
          }

          let tbl_temporary_count = await pgConn.get(
            dbPrefix + lic_code,
            script_count,
            config.connectionString(),
          );
          if (!tbl_temporary_count.code) {
            if (tbl_temporary_count.data.length > 0) {
              tbl_temporary_count.data = JSON.parse(
                JSON.stringify(tbl_temporary_count.data).replace(
                  /\:null/gi,
                  '\:""',
                ),
              );
              page_total = parseInt(tbl_temporary_count.data[0].page_total);
              rows_total = parseInt(tbl_temporary_count.data[0].rows_total);
            }
          }

          let response = [
            {
              status: "success",
              invalid_code: "0",
              message: "",
              data: tbl_temporary.data,
              page_total: page_total,
              rows_total: rows_total,
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
              page_total: 0,
              rows_total: 0,
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
          "ดึงข้อมูลประเภทรถ",
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
      },
    ];
    res.status(200).send(response);
    const _lic = req.header("lic_code");
    const _act = req.body?.[0]?.action?.[0] || {};
    if (_lic && _act.id) {
      await xglobal.action_logs(
        _lic,
        _act.id,
        "ดึงข้อมูลประเภทรถ",
        JSON.stringify(req.body?.[0] || {}),
        "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        _act.value,
      );
    }
    return;
  });
};

exports.getCompartmentTypeLevelItem = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let { veh_compartment_level_type_code, action, page_index, page_limit } =
      req.body[0];
    page_limit = page_limit == undefined ? 10 : page_limit;
    page_index = page_index == undefined ? 1 : page_index;

    if (page_index > 0) {
      page_index -= 1;
    }
    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      veh_compartment_level_type_code == undefined ||
      lic_code == undefined ||
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
        },
      ];

      res.status(200).send(response);
      return;
    } else {
      let script = `select 
            cl.veh_compartment_level_type_code,
                    cl.compartment_item_id,
                    cl.veh_compartment_type_code,
                    cl.veh_compartment_type_level_number,
                    cl.veh_compartment_type_level,
                    cl.veh_compartment_type_level_flag,
                    cl.ist_dt, 
                    cl.mdf_dt, 
                    cl.rm_dt
                from tbl_vehicle_type_compartment_level cl
                where cl.veh_compartment_type_level_flag = '1'`;

      if (veh_compartment_level_type_code.toString().toUpperCase() != "ALL") {
        script += ` and cl.veh_compartment_level_type_code = '${veh_compartment_level_type_code}'`;
      }

      script += ` order by cl.ist_dt desc`;
      script += ` limit ${page_limit} offset ${page_index * page_limit}`;

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

          let page_total = 0;
          let rows_total = 0;

          let script_count = `select 
                    count(*) as rows_total,
                    ceil(count(cl.veh_compartment_level_type_code) / ${page_limit}) as page_total
                    from tbl_vehicle_type_compartment_level cl
                    where cl.veh_compartment_type_level_flag = '1'`;

          if (
            veh_compartment_level_type_code.toString().toUpperCase() != "ALL"
          ) {
            script_count += ` and cl.veh_compartment_level_type_code = '${veh_compartment_level_type_code}'`;
          }

          let tbl_temporary_count = await pgConn.get(
            dbPrefix + lic_code,
            script_count,
            config.connectionString(),
          );
          if (!tbl_temporary_count.code) {
            if (tbl_temporary_count.data.length > 0) {
              tbl_temporary_count.data = JSON.parse(
                JSON.stringify(tbl_temporary_count.data).replace(
                  /\:null/gi,
                  '\:""',
                ),
              );
              page_total = parseInt(tbl_temporary_count.data[0].page_total);
              rows_total = parseInt(tbl_temporary_count.data[0].rows_total);
            }
          }

          let response = [
            {
              status: "success",
              invalid_code: "0",
              message: "",
              data: tbl_temporary.data,
              page_total: page_total,
              rows_total: rows_total,
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
              page_total: 0,
              rows_total: 0,
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
          "ดึงข้อมูลประเภทรถ",
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
      },
    ];
    res.status(200).send(response);
    const _lic = req.header("lic_code");
    const _act = req.body?.[0]?.action?.[0] || {};
    if (_lic && _act.id) {
      await xglobal.action_logs(
        _lic,
        _act.id,
        "ดึงข้อมูลประเภทรถ",
        JSON.stringify(req.body?.[0] || {}),
        "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        _act.value,
      );
    }
    return;
  });
};

//Success
exports.addVehicleTypeInformation = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let {
      veh_type_desc,
      veh_qty,
      veh_unavailable,
      veh_type_flag,
      max_merg,
      capacity_total,
      capacity_max,
      capacity_min,
      compartment_qty,
      compartment_item,
      unloading_minute,
      loading_minute,
      veht_sales_org,
      veht_order_type,
      action,
    } = req.body[0];

    //เช็คพารามิเตอร์ที่จำเป็น
    let missing = [];
    if (!veh_type_desc) missing.push('veh_type_desc');
    if (compartment_item == undefined) missing.push('compartment_item');
    if (max_merg == undefined) missing.push('max_merg');
    if (capacity_total == undefined) missing.push('capacity_total');
    if (capacity_max == undefined) missing.push('capacity_max');
    if (capacity_min == undefined) missing.push('capacity_min');
    if (compartment_qty == undefined) missing.push('compartment_qty');
    if (unloading_minute == undefined) missing.push('unloading_minute');
    if (loading_minute == undefined) missing.push('loading_minute');
    if (!action) missing.push('action');
    if (!lic_code) missing.push('lic_code');

    if (missing.length > 0) {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`,
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];

      res.status(200).send(response);
      return;
    } else {
      let veh_type_code = "";
      let insertedCompartments = [];
      let isError = false;
      let vehTypeFlag =
        veh_type_flag == undefined ? "1" : String(veh_type_flag);
      let vehQty = veh_qty == undefined ? 1 : veh_qty;
      let vehUnavailable = veh_unavailable == undefined ? 0 : veh_unavailable;
      let maxMerge = max_merg == undefined ? 0 : max_merg;

      // เช็คว่า veh_type_desc มีอยู่ใน tbl_vehicle_type หรือยัง
      let scriptCheck = `SELECT veh_type_code FROM tbl_vehicle_type 
                WHERE veh_type_desc = '${veh_type_desc}';`;
      let tbl_check = await pgConn.get(
        dbPrefix + lic_code,
        scriptCheck,
        config.connectionString(),
      );

      if (tbl_check && tbl_check.data && tbl_check.data.length > 0) {
        // มีอยู่แล้ว → ดึง veh_type_code เดิมมาใช้
        veh_type_code = tbl_check.data[0].veh_type_code;

        // อัพเดทข้อมูล master record
        let scriptUpdate = `UPDATE tbl_vehicle_type SET
                    veh_type_desc = '${veh_type_desc}',
                    veh_qty = ${vehQty},
                    veh_unavailable = ${vehUnavailable},
                    veh_type_flag = '${vehTypeFlag}',
                    max_merg = ${maxMerge},
                    capacity_total = ${capacity_total},
                    capacity_max = ${capacity_max},
                    capacity_min = ${capacity_min},
                    compartment_qty = ${compartment_qty},
                    unloading_minute = ${unloading_minute},
                    loading_minute = ${loading_minute},
                    veht_sales_org = '${veht_sales_org}',
                    veht_order_type = '${veht_order_type}',
                    mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}' 
                    WHERE veh_type_code = '${veh_type_code}';`;
        let tbl_update = await pgConn.execute(
          dbPrefix + lic_code,
          scriptUpdate,
          config.connectionString(),
        );
        if (tbl_update.code) {
          isError = true;
        }
      } else {
        // ยังไม่มี vehicle type → Insert ใหม่เข้า tbl_vehicle_type
        let vehQty = veh_qty == undefined ? 1 : veh_qty;
        let vehUnavailable = veh_unavailable == undefined ? 0 : veh_unavailable;
        let maxMerge = max_merg == undefined ? 0 : max_merg;
        veh_type_code = "veht-" + moment().format("x");

        let scriptInsert = `INSERT INTO tbl_vehicle_type 
                    (veh_type_code, veh_type_desc, veh_qty, veh_unavailable, veh_type_flag, max_merg, capacity_total, capacity_max, capacity_min, compartment_qty, unloading_minute, loading_minute, ist_dt, veht_sales_org, veht_order_type) VALUES 
                    ('${veh_type_code}', '${veh_type_desc}', ${vehQty}, ${vehUnavailable}, '${vehTypeFlag}', ${maxMerge}, ${capacity_total}, ${capacity_max}, ${capacity_min}, ${compartment_qty}, ${unloading_minute}, ${loading_minute}, '${moment().format("YYYY-MM-DD HH:mm:ss")}', '${veht_sales_org}', '${veht_order_type}');`;
        let tbl_insert = await pgConn.execute(
          dbPrefix + lic_code,
          scriptInsert,
          config.connectionString(),
        );
        if (tbl_insert.code) {
          isError = true;
        }
      }

      let existingCompartments = [];
      // วนลูป compartment_item เพื่อ Insert เข้า tbl_vehicle_type_compartment
      if (
        !isError &&
        Array.isArray(compartment_item) &&
        compartment_item.length > 0
      ) {
        for (let i = 0; i < compartment_item.length; i++) {
          let item = compartment_item[i];
          let current_compartment_no = item.compartment_no || "";
          let current_compartment_total =
            item.compartment_total != undefined ? item.compartment_total : 0;
          let current_compartment_max =
            item.compartment_max != undefined ? item.compartment_max : 0;
          let current_compartment_min =
            item.compartment_min != undefined ? item.compartment_min : 0;
          let level_data = item.level_data || [];

          // เช็คว่า compartment_no นี้มีอยู่แล้วหรือยัง
          let scriptCheckExist = `SELECT id FROM tbl_vehicle_type_compartment 
                        WHERE veh_type_code = '${veh_type_code}' AND compartment_no = '${current_compartment_no}';`;

          let tbl_checkExist = await pgConn.get(
            dbPrefix + lic_code,
            scriptCheckExist,
            config.connectionString(),
          );

          //Push เข้า array สำหรับตัวซ้ำ
          if (
            tbl_checkExist &&
            tbl_checkExist.data &&
            tbl_checkExist.data.length > 0
          ) {
            existingCompartments.push({
              compartment_no: current_compartment_no,
              message: `ช่องน้ำมัน '${current_compartment_no}' มีอยู่แล้ว`,
            });
            continue;
          }

          //เพิ่มข้อมูลช่องน้ำมัน
          let scriptInsertItem = `INSERT INTO tbl_vehicle_type_compartment 
                        (veh_type_code, compartment_no, compartment_total, compartment_max, compartment_min, ist_dt) VALUES 
                        ('${veh_type_code}', '${current_compartment_no}', ${current_compartment_total}, ${current_compartment_max}, ${current_compartment_min}, '${moment().format("YYYY-MM-DD HH:mm:ss")}') RETURNING id;`;

          let tbl_insertItem = await pgConn.get(
            dbPrefix + lic_code,
            scriptInsertItem,
            config.connectionString(),
          );
          //เพิ่มข้อมูลระดับช่องน้ำมัน
          if (
            !tbl_insertItem.code &&
            tbl_insertItem.data &&
            tbl_insertItem.data.length > 0
          ) {
            let new_compartment_item_id = tbl_insertItem.data[0].id;
            let insertedLevels = [];

            //เพิ่มข้อมูลระดับช่องน้ำมัน
            if (Array.isArray(level_data) && level_data.length > 0) {
              for (let j = 0; j < level_data.length; j++) {
                let lvl = level_data[j];
                let veh_compartment_level_type_code = `veh-com-lev-${moment().format("x")}-${j}`;
                let scriptInsertLevel = `INSERT INTO tbl_vehicle_type_compartment_level 
                                    (compartment_item_id, veh_compartment_level_type_code, veh_compartment_type_code, veh_compartment_type_level_number, veh_compartment_type_level, veh_compartment_type_level_flag, ist_dt) VALUES 
                                    ('${new_compartment_item_id}', '${veh_compartment_level_type_code}', '${current_compartment_no}', '${lvl.level_number}', ${lvl.level_capacity}, '1', '${moment().format("YYYY-MM-DD HH:mm:ss")}');`;

                let tbl_insertLevel = await pgConn.execute(
                  dbPrefix + lic_code,
                  scriptInsertLevel,
                  config.connectionString(),
                );

                if (tbl_insertLevel.code) {
                  isError = true;
                  break;
                } else {
                  insertedLevels.push(lvl);
                }
              }
            }

            if (isError) break;
          } else {
            isError = true;
            break;
          }
        }
      }

      // จัดการ Response เมื่อทำงานเสร็จ
      if (isError) {
        let response = [
          {
            status: "error",
            invalid_code: "-3",
            message: `ไม่สามารถบันทึกข้อมูลบางส่วนได้, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "เพิ่มข้อมูลประเภทรถ",
          JSON.stringify(req.body[0]),
          "ไม่สามารถบันทึกข้อมูลบางส่วนได้",
          action[0].value,
        );
        return;
      }

      // กรณีสำเร็จทั้งหมด
      let response = [
        {
          status: "success",
          invalid_code: "0",
          message: `บันทึกข้อมูลสำเร็จ`,
          data: [
            {
              compartment_item_existing: existingCompartments,
            },
          ],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];

      res.status(200).send(response);
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "เพิ่มข้อมูลประเภทรถ",
        JSON.stringify(req.body[0]),
        "success",
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
        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
        data: [],
        response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
      },
    ];
    res.status(200).send(response);
    const _lic = req.header("lic_code");
    const _act = req.body?.[0]?.action?.[0] || {};
    if (_lic && _act.id) {
      await xglobal.action_logs(
        _lic,
        _act.id,
        "เพิ่มข้อมูลประเภทรถ",
        JSON.stringify(req.body?.[0] || {}),
        "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        _act.value,
      );
    }
    return;
  });
};

//Success
exports.addVehicleTypeCompartmentInformation = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let { veh_type_code, compartment_item, action } = req.body[0];

    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      !veh_type_code ||
      compartment_item == undefined ||
      !action ||
      !lic_code
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
    } else {
      let insertedCompartments = [];
      let existingCompartments = [];
      let isError = false;

      // เช็คว่า veh_type_code มีอยู่ใน tbl_vehicle_type หรือยัง
      let scriptCheck = `SELECT veh_type_code FROM tbl_vehicle_type 
                WHERE veh_type_code = '${veh_type_code}';`;
      let tbl_check = await pgConn.get(
        dbPrefix + lic_code,
        scriptCheck,
        config.connectionString(),
      );

      if (tbl_check && tbl_check.data && tbl_check.data.length > 0) {
        // มีอยู่แล้ว → ดึง veh_type_code เดิมมาใช้
        veh_type_code = tbl_check.data[0].veh_type_code;

        // เพิ่ม compartment_item เข้า tbl_vehicle_type_compartment
        for (let i = 0; i < compartment_item.length; i++) {
          let level_data = compartment_item[i].level_data || [];
          let current_compartment_no = compartment_item[i].compartment_no || "";

          // เช็คว่า compartment_no นี้มีอยู่แล้วหรือยัง
          let scriptCheckExist = `SELECT id FROM tbl_vehicle_type_compartment 
                        WHERE veh_type_code = '${veh_type_code}' AND compartment_no = '${current_compartment_no}';`;
          let tbl_checkExist = await pgConn.get(
            dbPrefix + lic_code,
            scriptCheckExist,
            config.connectionString(),
          );

          if (
            tbl_checkExist &&
            tbl_checkExist.data &&
            tbl_checkExist.data.length > 0
          ) {
            existingCompartments.push({
              compartment_no: current_compartment_no,
              message: `ช่องน้ำมัน '${current_compartment_no}' มีอยู่แล้ว`,
            });
            continue;
          }

          let scriptInsertItem = `INSERT INTO tbl_vehicle_type_compartment 
                        (veh_type_code, compartment_no, compartment_total, compartment_max, compartment_min, ist_dt) VALUES 
                        ('${veh_type_code}', '${current_compartment_no}', '${compartment_item[i].compartment_total}', '${compartment_item[i].compartment_max}', '${compartment_item[i].compartment_min}', '${moment().format("YYYY-MM-DD HH:mm:ss")}') RETURNING id;`;

          let tbl_insertItem = await pgConn.get(
            dbPrefix + lic_code,
            scriptInsertItem,
            config.connectionString(),
          );

          if (
            !tbl_insertItem.code &&
            tbl_insertItem.data &&
            tbl_insertItem.data.length > 0
          ) {
            let new_compartment_item_id = tbl_insertItem.data[0].id;

            insertedCompartments.push(compartment_item[i]);

            if (Array.isArray(level_data) && level_data.length > 0) {
              for (let j = 0; j < level_data.length; j++) {
                let lvl = level_data[j];
                let veh_compartment_level_type_code = `veh-com-lev-${moment().format("x")}-${j}`;
                let scriptInsertLevel = `INSERT INTO tbl_vehicle_type_compartment_level 
                                    (compartment_item_id, veh_compartment_level_type_code, veh_compartment_type_code, veh_compartment_type_level_number, veh_compartment_type_level, veh_compartment_type_level_flag, ist_dt) VALUES 
                                    ('${new_compartment_item_id}', '${veh_compartment_level_type_code}', '${current_compartment_no}', '${lvl.level_number}', ${lvl.level_capacity}, '1', '${moment().format("YYYY-MM-DD HH:mm:ss")}');`;

                let tbl_insertLevel = await pgConn.execute(
                  dbPrefix + lic_code,
                  scriptInsertLevel,
                  config.connectionString(),
                );

                if (tbl_insertLevel.code) {
                  isError = true;
                  break;
                }
              }
            }
          } else {
            isError = true;
            break;
          }
        }
      } // จัดการ Response เมื่อทำงานเสร็จ
      if (isError) {
        let response = [
          {
            status: "error",
            invalid_code: "-3",
            message: `ไม่สามารถบันทึกข้อมูลบางส่วนได้, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "เพิ่มข้อมูลประเภทรถ",
          JSON.stringify(req.body[0]),
          "ไม่สามารถบันทึกข้อมูลบางส่วนได้",
          action[0].value,
        );
        return;
      }

      // กรณีสำเร็จทั้งหมด
      let response = [
        {
          status: "success",
          invalid_code: "0",
          message: `บันทึกข้อมูลสำเร็จ`,
          data: [
            {
              compartment_item_existing: existingCompartments,
            },
          ],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];

      res.status(200).send(response);
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "เพิ่มข้อมูลประเภทรถ",
        JSON.stringify(req.body[0]),
        "success",
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
        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
        data: [],
        response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
      },
    ];
    res.status(200).send(response);
    const _lic = req.header("lic_code");
    const _act = req.body?.[0]?.action?.[0] || {};
    if (_lic && _act.id) {
      await xglobal.action_logs(
        _lic,
        _act.id,
        "เพิ่มข้อมูลประเภทรถ",
        JSON.stringify(req.body?.[0] || {}),
        "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        _act.value,
      );
    }
    return;
  });
};

//Success
exports.addVehicleTypeCompartmentLevelInformation = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let { compartment_id, level_data, action } = req.body[0];

    //เช็คเฉพาะส่วนที่สำคัญ
    if (!compartment_id || level_data == undefined || !action || !lic_code) {
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
    } else {
      let insertedCompartments = [];
      let isError = false;

      // เช็คว่า compartment_no มีอยู่ใน tbl_vehicle_type_compartment หรือยัง
      let scriptCheck = `SELECT compartment_no FROM tbl_vehicle_type_compartment 
                WHERE id = '${compartment_id}';`;
      let tbl_check = await pgConn.get(
        dbPrefix + lic_code,
        scriptCheck,
        config.connectionString(),
      );

      if (tbl_check && tbl_check.data && tbl_check.data.length > 0) {
        let current_compartment_no = tbl_check.data[0].compartment_no;

        if (Array.isArray(level_data) && level_data.length > 0) {
          for (let j = 0; j < level_data.length; j++) {
            let lvl = level_data[j];
            let veh_compartment_level_type_code = `veh-com-lev-${moment().format("x")}-${j}`;
            let scriptInsertLevel = `INSERT INTO tbl_vehicle_type_compartment_level 
                                    (compartment_item_id, veh_compartment_level_type_code, veh_compartment_type_code, veh_compartment_type_level_number, veh_compartment_type_level, veh_compartment_type_level_flag, ist_dt) VALUES 
                                    ('${compartment_id}', '${veh_compartment_level_type_code}', '${current_compartment_no}', '${lvl.level_number}', ${lvl.level_capacity}, '1', '${moment().format("YYYY-MM-DD HH:mm:ss")}');`;

            let tbl_insertLevel = await pgConn.execute(
              dbPrefix + lic_code,
              scriptInsertLevel,
              config.connectionString(),
            );

            if (tbl_insertLevel.code) {
              isError = true;
              break; // ออกจาก loop ย่อยถ้าพัง
            }
          }
        }
      }

      // จัดการ Response เมื่อทำงานเสร็จ
      if (isError) {
        let response = [
          {
            status: "error",
            invalid_code: "-3",
            message: `ไม่สามารถบันทึกข้อมูลบางส่วนได้, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "เพิ่มข้อมูลประเภทรถ",
          JSON.stringify(req.body[0]),
          "ไม่สามารถบันทึกข้อมูลบางส่วนได้",
          action[0].value,
        );
        return;
      }

      // กรณีสำเร็จทั้งหมด
      let response = [
        {
          status: "success",
          invalid_code: "0",
          message: `บันทึกข้อมูลสำเร็จ`,
          data: [
            {
              compartment_item: insertedCompartments,
            },
          ],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];

      res.status(200).send(response);
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "เพิ่มข้อมูลประเภทรถ",
        JSON.stringify(req.body[0]),
        "success",
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
        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
        data: [],
        response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
      },
    ];
    res.status(200).send(response);
    const _lic = req.header("lic_code");
    const _act = req.body?.[0]?.action?.[0] || {};
    if (_lic && _act.id) {
      await xglobal.action_logs(
        _lic,
        _act.id,
        "เพิ่มข้อมูลประเภทรถ",
        JSON.stringify(req.body?.[0] || {}),
        "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        _act.value,
      );
    }
    return;
  });
};

//Success
exports.setVehicleTypeInformation = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let { veh_type_code } = req.query;
    let {
      veh_type_desc,
      veh_qty,
      veh_unavailable,
      veh_type_flag,
      max_merg,
      capacity_total,
      capacity_max,
      capacity_min,
      compartment_qty,
      unloading_minute,
      loading_minute,
      compartment_item,
      veht_sales_org,
      veht_order_type,
      action,
    } = req.body[0];

    //เช็คพารามิเตอร์ที่จำเป็น
    let missing = [];
    if (!veh_type_code) missing.push('veh_type_code');
    if (!veh_type_desc) missing.push('veh_type_desc');
    if (max_merg == undefined) missing.push('max_merg');
    if (capacity_total == undefined) missing.push('capacity_total');
    if (capacity_max == undefined) missing.push('capacity_max');
    if (capacity_min == undefined) missing.push('capacity_min');
    if (compartment_qty == undefined) missing.push('compartment_qty');
    if (unloading_minute == undefined) missing.push('unloading_minute');
    if (loading_minute == undefined) missing.push('loading_minute');
    if (compartment_item == undefined) missing.push('compartment_item');
    if (!action) missing.push('action');
    if (!lic_code) missing.push('lic_code');

    if (missing.length > 0) {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(', ')})`,
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];

      res.status(200).send(response);
      return;
    } else {
      let insertedCompartments = [];
      let existingCompartments = [];
      let isError = false;
      let vehTypeFlag =
        veh_type_flag == undefined ? "1" : String(veh_type_flag);
      let vehQty = veh_qty == undefined ? 1 : veh_qty;
      let vehUnavailable = veh_unavailable == undefined ? 0 : veh_unavailable;
      let maxMerge = max_merg == undefined ? 0 : max_merg;

      let script = `UPDATE tbl_vehicle_type SET
                veh_type_desc = '${veh_type_desc}',
                veh_qty = ${vehQty},
                veh_unavailable = ${vehUnavailable},
                veh_type_flag = '${vehTypeFlag}',
                max_merg = ${maxMerge},
                capacity_total = ${capacity_total == undefined ? 0 : capacity_total},
                capacity_max = ${capacity_max == undefined ? 0 : capacity_max},
                capacity_min = ${capacity_min == undefined ? 0 : capacity_min},
                compartment_qty = ${compartment_qty == undefined ? 0 : compartment_qty},
                unloading_minute = ${unloading_minute == undefined ? 0 : unloading_minute},
                loading_minute = ${loading_minute == undefined ? 0 : loading_minute},
                veht_sales_org = '${veht_sales_org}',
                veht_order_type = '${veht_order_type}',
                mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}' 
                WHERE veh_type_code = '${veh_type_code}';`;

      let tbl_temporary = await pgConn.execute(
        dbPrefix + lic_code,
        script,
        config.connectionString(),
      );
      if (!tbl_temporary.code) {
        // ========== Delete and Insert Compartment Items (ตามคำสั่ง: ลบของเก่าแล้ว insert ของใหม่ มาแทน) ==========
        if (!isError) {
          // ลบ level เก่าออกก่อน
          let scriptDeleteLevel = `DELETE FROM tbl_vehicle_type_compartment_level WHERE compartment_item_id IN (SELECT id FROM tbl_vehicle_type_compartment WHERE veh_type_code = '${veh_type_code}');`;
          await pgConn.execute(
            dbPrefix + lic_code,
            scriptDeleteLevel,
            config.connectionString(),
          );

          // ลบ compartment เก่าออก
          let scriptDeleteCompartment = `DELETE FROM tbl_vehicle_type_compartment WHERE veh_type_code = '${veh_type_code}';`;
          await pgConn.execute(
            dbPrefix + lic_code,
            scriptDeleteCompartment,
            config.connectionString(),
          );

          // วนลูป compartment_item เพื่อ Insert ใหม่ทั้งหมด
          if (Array.isArray(compartment_item) && compartment_item.length > 0) {
            for (let i = 0; i < compartment_item.length; i++) {
              let item = compartment_item[i];
              let current_compartment_no = item.compartment_no || "";
              let current_compartment_total =
                item.compartment_total != undefined
                  ? item.compartment_total
                  : 0;
              let current_compartment_max =
                item.compartment_max != undefined ? item.compartment_max : 0;
              let current_compartment_min =
                item.compartment_min != undefined ? item.compartment_min : 0;
              let level_data = item.level_data || [];

              let scriptInsertItem = `INSERT INTO tbl_vehicle_type_compartment 
                              (veh_type_code, compartment_no, compartment_total, compartment_max, compartment_min, ist_dt) VALUES 
                              ('${veh_type_code}', '${current_compartment_no}', ${current_compartment_total}, ${current_compartment_max}, ${current_compartment_min}, '${moment().format("YYYY-MM-DD HH:mm:ss")}') RETURNING id;`;

              let tbl_insertItem = await pgConn.get(
                dbPrefix + lic_code,
                scriptInsertItem,
                config.connectionString(),
              );

              if (
                !tbl_insertItem.code &&
                tbl_insertItem.data &&
                tbl_insertItem.data.length > 0
              ) {
                let new_compartment_item_id = tbl_insertItem.data[0].id;
                let insertedLevels = [];

                if (Array.isArray(level_data) && level_data.length > 0) {
                  for (let j = 0; j < level_data.length; j++) {
                    let lvl = level_data[j];
                    let veh_compartment_level_type_code = `veh-com-lev-${moment().format("x")}-${j}`;
                    let scriptInsertLevel = `INSERT INTO tbl_vehicle_type_compartment_level 
                                          (compartment_item_id, veh_compartment_level_type_code, veh_compartment_type_code, veh_compartment_type_level_number, veh_compartment_type_level, veh_compartment_type_level_flag, ist_dt) VALUES 
                                          ('${new_compartment_item_id}', '${veh_compartment_level_type_code}', '${current_compartment_no}', '${lvl.level_number}', ${lvl.level_capacity}, '1', '${moment().format("YYYY-MM-DD HH:mm:ss")}');`;

                    let tbl_insertLevel = await pgConn.execute(
                      dbPrefix + lic_code,
                      scriptInsertLevel,
                      config.connectionString(),
                    );

                    if (tbl_insertLevel.code) {
                      isError = true;
                      break;
                    } else {
                      insertedLevels.push(lvl);
                    }
                  }
                }

                if (isError) break;

                insertedCompartments.push({
                  veh_type_code: veh_type_code,
                  compartment_no: current_compartment_no,
                  compartment_total: current_compartment_total,
                  compartment_max: current_compartment_max,
                  compartment_min: current_compartment_min,
                  level_data: insertedLevels,
                });
              } else {
                isError = true;
                break;
              }
            }
          }
        }

        let response = [
          {
            status: "success",
            invalid_code: "0",
            message: "",
            data: [
              {
                compartment_item_existing: existingCompartments,
              },
            ],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];

        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "แก้ไขข้อมูลประเภทรถ",
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
          "แก้ไขข้อมูลประเภทรถ",
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
    const _lic = req.header("lic_code");
    const _act = req.body?.[0]?.action?.[0] || {};
    if (_lic && _act.id) {
      await xglobal.action_logs(
        _lic,
        _act.id,
        "แก้ไขข้อมูลประเภทรถ",
        JSON.stringify(req.body?.[0] || {}),
        "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        _act.value,
      );
    }
    return;
  });
};

//Success
exports.removeVehicleType = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let { veh_type_code, action } = req.body[0];
    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      veh_type_code == undefined ||
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
      return;
    } else {
      let script = ``;
      script = `update tbl_vehicle_type set veh_type_flag = '0', rm_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}' where veh_type_code = '${veh_type_code}'; `;

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
          "ลบข้อมูลประเภทรถ",
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
            message: `ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "ลบข้อมูลประเภทรถ",
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
        message: `ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
        data: [],
        response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
      },
    ];
    res.status(200).send(response);
    const _lic = req.header("lic_code");
    const _act = req.body?.[0]?.action?.[0] || {};
    if (_lic && _act.id) {
      await xglobal.action_logs(
        _lic,
        _act.id,
        "ลบข้อมูลประเภทรถ",
        JSON.stringify(req.body?.[0] || {}),
        "ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        _act.value,
      );
    }
    return;
  });
};

//Success
exports.removeCompartmentItemById = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let { compartment_id, action } = req.body[0];
    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      compartment_id == undefined ||
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
      return;
    } else {
      let script = ``;
      // ดัก petrol_merge_job_id เป็น array
      let compartment_idArr = Array.isArray(compartment_id)
        ? compartment_id
        : [compartment_id];
      let compartment_idIn = compartment_idArr.map((c) => `'${c}'`).join(", ");
      script = `update tbl_vehicle_type_compartment set flag = '0', rm_dt = '${moment().format("YYYY - MM - DD HH: mm:ss")}' 
            where id in (${compartment_idIn}); `;

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
            message: "ลบข้อมูลช่องเก็บได้สำเร็จ",
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];

        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "ลบข้อมูลช่องเก็บได้",
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
            message: `ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "ลบข้อมูลช่องเก็บได้",
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
        message: `ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
        data: [],
        response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
      },
    ];
    res.status(200).send(response);
    const _lic = req.header("lic_code");
    const _act = req.body?.[0]?.action?.[0] || {};
    if (_lic && _act.id) {
      await xglobal.action_logs(
        _lic,
        _act.id,
        "ลบข้อมูลช่องเก็บได้",
        JSON.stringify(req.body?.[0] || {}),
        "ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        _act.value,
      );
    }
    return;
  });
};

//Success
exports.removeCompartmentLevelById = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let { veh_compartment_level_type_code, action } = req.body[0];
    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      veh_compartment_level_type_code == undefined ||
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
      return;
    } else {
      let script = ``;
      // ดัก petrol_merge_job_id เป็น array
      let level_idArr = Array.isArray(level_id) ? level_id : [level_id];
      let level_idIn = level_idArr.map((c) => `'${c}'`).join(", ");
      script = `update tbl_vehicle_type_compartment_level set veh_compartment_type_level_flag = '0', rm_dt = '${moment().format("YYYY - MM - DD HH: mm:ss")}' 
            where veh_compartment_level_type_code in (${level_idIn}); `;

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
            message: "ลบข้อมูลช่องเก็บได้สำเร็จ",
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];

        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "ลบข้อมูลช่องเก็บได้",
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
            message: `ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "ลบข้อมูลช่องเก็บได้",
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
        message: `ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
        data: [],
        response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
      },
    ];
    res.status(200).send(response);
    const _lic = req.header("lic_code");
    const _act = req.body?.[0]?.action?.[0] || {};
    if (_lic && _act.id) {
      await xglobal.action_logs(
        _lic,
        _act.id,
        "ลบข้อมูลช่องเก็บได้",
        JSON.stringify(req.body?.[0] || {}),
        "ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        _act.value,
      );
    }
    return;
  });
};
