const config = require("../../configuration/connection");
const pgConn = require("../../library/pgConnection");
const moment = require("moment");
const xglobal = require("../../middleware/global");

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
//Success
exports.getPetrolVehicleTypeInformation = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let { veh_type_code, ptrl_code, action, page_index, page_limit } =
      req.body[0];
    page_index = page_index || 1;
    page_limit = page_limit || 10;

    if (page_index > 0) {
      page_index -= 1;
    }
    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      veh_type_code == undefined ||
      ptrl_code == undefined ||
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
      let script = ``;
      if (veh_type_code.toString().toUpperCase() != "ALL") {
        script = `select
                ptrl_vehicle_type_code,
                tbl_petrol.ptrl_code,
                ptrl_number,
                ptrl_desc,
                ptrl_short_desc,
                tbl_petrol.ptrl_group_code,
                ptrl_group_desc,
                tbl_petrol_vehicle_type.veh_type_code,
                tbl_vehicle_type.veh_type_desc,
                tbl_petrol.off_code,
                off_desc,
                tbl_petrol_vehicle_type.ist_dt,
                tbl_petrol_vehicle_type.mdf_dt,
                tbl_petrol_vehicle_type.rm_dt 
                from tbl_petrol
                left join tbl_office on tbl_petrol.off_code = tbl_office.off_code
                left join tbl_petrol_vehicle_type on tbl_petrol.ptrl_code = tbl_petrol_vehicle_type.ptrl_code 
                left join tbl_vehicle_type on tbl_petrol_vehicle_type.veh_type_code = tbl_vehicle_type.veh_type_code 
                left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                where tbl_petrol_vehicle_type.ptrl_vehicle_type_flag = '1' and ptrl_vehicle_type_code is not null 
                and tbl_petrol_vehicle_type.veh_type_code = '${veh_type_code}' and tbl_petrol_vehicle_type.ptrl_vehicle_type_flag = '1' and tbl_vehicle_type.veh_type_flag = '1' `;
      } else {
        script = `select
                ptrl_vehicle_type_code,
                tbl_petrol.ptrl_code,
                ptrl_number,
                ptrl_desc,
                ptrl_short_desc,
                tbl_petrol.ptrl_group_code,
                ptrl_group_desc,
                tbl_petrol_vehicle_type.veh_type_code,
                tbl_vehicle_type.veh_type_desc,
                tbl_petrol.off_code,
                off_desc,
                tbl_petrol_vehicle_type.ist_dt,
                tbl_petrol_vehicle_type.mdf_dt,
                tbl_petrol_vehicle_type.rm_dt 
                from tbl_petrol
                left join tbl_office on tbl_petrol.off_code = tbl_office.off_code
                left join tbl_petrol_vehicle_type on tbl_petrol.ptrl_code = tbl_petrol_vehicle_type.ptrl_code 
                left join tbl_vehicle_type on tbl_petrol_vehicle_type.veh_type_code = tbl_vehicle_type.veh_type_code 
                left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                where tbl_petrol_vehicle_type.ptrl_vehicle_type_flag = '1' and ptrl_vehicle_type_code is not null  and tbl_vehicle_type.veh_type_flag = '1'  `;
      }

      if (ptrl_code.toString().toUpperCase() != "ALL") {
        script += ` and tbl_petrol.ptrl_code = '${ptrl_code}' `;
      }

      script += `  order by tbl_petrol_vehicle_type.ist_dt desc`;
      script += ` limit ${page_limit} offset ${page_index * page_limit}`;

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
          let script = ``;
          if (veh_type_code.toString().toUpperCase() != "ALL") {
            script = `select
                        ceil(count(ptrl_vehicle_type_code)::numeric / ${page_limit}) as page_total,
                        count(*) as rows_total
                        from tbl_petrol
                        left join tbl_office on tbl_petrol.off_code = tbl_office.off_code
                        left join tbl_petrol_vehicle_type on tbl_petrol.ptrl_code = tbl_petrol_vehicle_type.ptrl_code 
                        left join tbl_vehicle_type on tbl_petrol_vehicle_type.veh_type_code = tbl_vehicle_type.veh_type_code 
                        left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                        where tbl_petrol_vehicle_type.ptrl_vehicle_type_flag = '1' and ptrl_vehicle_type_code is not null 
                        and tbl_petrol_vehicle_type.veh_type_code = '${veh_type_code}' `;
          } else {
            script = `select
                        ceil(count(ptrl_vehicle_type_code)::numeric / ${page_limit}) as page_total,
                        count(*) as rows_total
                        from tbl_petrol
                        left join tbl_office on tbl_petrol.off_code = tbl_office.off_code
                        left join tbl_petrol_vehicle_type on tbl_petrol.ptrl_code = tbl_petrol_vehicle_type.ptrl_code 
                        left join tbl_vehicle_type on tbl_petrol_vehicle_type.veh_type_code = tbl_vehicle_type.veh_type_code 
                        left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                        where tbl_petrol_vehicle_type.ptrl_vehicle_type_flag = '1' and ptrl_vehicle_type_code is not null `;
          }

          if (ptrl_code.toString().toUpperCase() != "ALL") {
            script += ` and tbl_petrol.ptrl_code = '${ptrl_code}' `;
          }

          let tbl_temporary_total = await pgConn.get(
            dbPrefix + lic_code,
            script,
            config.connectionString(),
          );
          if (!tbl_temporary_total.code) {
            page_total = parseInt(tbl_temporary_total.data[0].page_total);
            rows_total = parseInt(tbl_temporary_total.data[0].rows_total);
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
          "ดึงข้อมูลประเภทรถที่ได้รับอนุญาตเข้าปั้ม",
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
    await xglobal.action_logs(
      lic_code,
      action[0].id,
      "ดึงข้อมูลประเภทรถที่ได้รับอนุญาตเข้าปั้ม",
      JSON.stringify(req.body[0]),
      "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      action[0].value,
    );
    return;
  });
};

//Success
exports.removePetrolVehicleType = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let { ptrl_vehicle_type_code, action } = req.body[0];
    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      ptrl_vehicle_type_code == undefined ||
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
      script = `update tbl_petrol_vehicle_type set ptrl_vehicle_type_flag = '0', rm_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}' where ptrl_vehicle_type_code = '${ptrl_vehicle_type_code}';`;

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
          "ลบข้อมูลประเภทรถที่ได้รับอนุญาตเข้าปั้ม",
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
          "ลบข้อมูลประเภทรถที่ได้รับอนุญาตเข้าปั้ม",
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
    await xglobal.action_logs(
      lic_code,
      action[0].id,
      "ลบข้อมูลประเภทรถที่ได้รับอนุญาตเข้าปั้ม",
      JSON.stringify(req.body[0]),
      "ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      action[0].value,
    );
    return;
  });
};

//Success
exports.setPetrolVehicleTypeInformation = async (req, res, next) => {
  return (async () => {
    //debugger
    let lic_code = req.header("lic_code");
    let { ptrl_vehicle_type_code } = req.query;
    let { ptrl_code, veh_type_code, action } = req.body[0];

    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      ptrl_vehicle_type_code == undefined ||
      ptrl_code == undefined ||
      veh_type_code == undefined ||
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
    } else {
      let script = ``;
      script = `update tbl_petrol_vehicle_type set
            ptrl_code = '${ptrl_code}', 
            veh_type_code = '${veh_type_code}',
            mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}' 
            where ptrl_vehicle_type_code = '${ptrl_vehicle_type_code}';`;

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
          "แก้ไขข้อมูลประเภทรถที่ได้รับอนุญาตเข้าปั้ม",
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
          "แก้ไขข้อมูลประเภทรถที่ได้รับอนุญาตเข้าปั้ม",
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
      "แก้ไขข้อมูลประเภทรถที่ได้รับอนุญาตเข้าปั้ม",
      JSON.stringify(req.body[0]),
      "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      action[0].value,
    );
    return;
  });
};

//Success
exports.addPetrolVehicleTypeInformation = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let { petrol_vehicle_type_info, action } = req.body[0];

    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      !Array.isArray(petrol_vehicle_type_info) ||
      petrol_vehicle_type_info.length === 0 ||
      action == undefined ||
      lic_code == undefined
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
      let successItems = [];
      let duplicateItems = [];
      let isError = false;

      for (let info of petrol_vehicle_type_info) {
        let { ptrl_code, veh_type_code } = info;

        if (!ptrl_code || !veh_type_code) continue;

        let scriptCheck = `select ptrl_vehicle_type_code from tbl_petrol_vehicle_type 
            where ptrl_vehicle_type_flag = '1' and ptrl_code = '${ptrl_code}' and veh_type_code = '${veh_type_code}';`;
        let tbl_temporary0 = await pgConn.get(
          dbPrefix + lic_code,
          scriptCheck,
          config.connectionString(),
        );

        if (!tbl_temporary0.code) {
          if (tbl_temporary0.data.length > 0) {
            duplicateItems.push({
              ptrl_code,
              veh_type_code,
              message: "ข้อมูลซ้ำ",
            });
            continue;
          }
        }

        let ptrl_vehicle_type_code =
          "pvty-" +
          moment().format("x") +
          "-" +
          Math.floor(Math.random() * 1000);
        let scriptInsert = `insert into tbl_petrol_vehicle_type 
            (ptrl_vehicle_type_code, ptrl_code, veh_type_code, ptrl_vehicle_type_flag, ist_dt) values 
            ('${ptrl_vehicle_type_code}', '${ptrl_code}', '${veh_type_code}', '1', '${moment().format("YYYY-MM-DD HH:mm:ss")}');`;

        let tbl_temporary = await pgConn.execute(
          dbPrefix + lic_code,
          scriptInsert,
          config.connectionString(),
        );
        if (!tbl_temporary.code) {
          successItems.push({
            ptrl_vehicle_type_code,
            ptrl_code,
            veh_type_code,
          });
        } else {
          isError = true;
          break;
        }
      }

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
          "เพิ่มข้อมูลประเภทรถที่ได้รับอนุญาตเข้าปั้ม",
          JSON.stringify(req.body[0]),
          "ไม่สามารถบันทึกข้อมูลบางส่วนได้",
          action[0].value,
        );
        return;
      }

      let response = [
        {
          status: "success",
          invalid_code: "0",
          message:
            duplicateItems.length > 0
              ? "บันทึกข้อมูลสำเร็จ (มีข้อมูลซ้ำบางส่วน)"
              : "บันทึกข้อมูลสำเร็จ",
          data: {
            success: successItems,
            duplicates: duplicateItems,
          },
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];

      res.status(200).send(response);
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "เพิ่มข้อมูลประเภทรถที่ได้รับอนุญาตเข้าปั้ม",
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
        "เพิ่มข้อมูลประเภทรถที่ได้รับอนุญาตเข้าปั้ม",
        JSON.stringify(req.body[0]),
        "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        _act.value,
      );
    }
    return;
  });
};
