const config = require("../../configuration/connection");
const pgConn = require("../../library/pgConnection");
const moment = require("moment");
const xglobal = require("../../middleware/global");

const dbPrefix = config.dbPrefix();

// ========= Success =========
exports.getPetrolMergeJoGroup = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let { ptrl_code, action, search, page_index, page_limit } = req.body[0];

    const page = parseInt(page_index) || 1;
    const limit = parseInt(page_limit) || 10;
    const offset = (page > 0 ? page - 1 : 0) * limit;

    // เช็คเฉพาะส่วนที่สำคัญ
    if (
      ptrl_code === undefined ||
      lic_code === undefined ||
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

    let conditions = [
      "g.merge_job_group_flag = 1",
      "p.ptrl_flag = '1'"
    ];

    if (ptrl_code.toString().toUpperCase() !== "ALL") {
      conditions.push(`g.ptrl_code = '${ptrl_code}'`);
    }

    if (search) {
      conditions.push(`(g.ptrl_merge_group_desc like '%${search}%' or p.ptrl_desc like '%${search}%' or p.ptrl_number like '%${search}%')`);
    }

    let where_clause = "where " + conditions.join(" and ");

    let script = `
    select 
    min(g.merge_group_code) as merge_group_code, 
    g.ptrl_merge_group_code, 
    g.ptrl_merge_group_desc, 
    g.merge_job_group_flag, 
    min(g.ist_dt) as ist_dt,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'ptrl_code', p.ptrl_code,
          'ptrl_number', p.ptrl_number,
          'ptrl_desc', p.ptrl_desc
        )
      ) filter (where p.ptrl_code is not null), 
      '[]'::jsonb
    ) as ptrl_data
  from tbl_petrol_merge_job_group g 
  left join tbl_petrol p on g.ptrl_code = p.ptrl_code 
  ${where_clause} 
  group by 
    g.ptrl_merge_group_code, 
    g.ptrl_merge_group_desc, 
    g.merge_job_group_flag
  order by g.ptrl_merge_group_desc asc;`;

    let tbl_temporary = await pgConn.get(
      dbPrefix + lic_code,
      script,
      config.connectionString(),
    );

    if (!tbl_temporary.code) {
      if (tbl_temporary.data.length > 0) {
        // แปลง null เป็น string ว่าง
        const data = JSON.parse(
          JSON.stringify(tbl_temporary.data).replace(/\:null/gi, '\:""'),
        );

        const countScript = `
            SELECT 
                COUNT(g.merge_group_code) as rows_total,
                CEIL(COUNT(g.merge_group_code)::float / ${page_limit}) as page_total
            from tbl_petrol_merge_job_group g 
            left join tbl_petrol p on g.ptrl_code = p.ptrl_code 
            ${where_clause};
        `;
        const tbl_temporary_count = await pgConn.get(
          dbPrefix + lic_code,
          countScript,
          config.connectionString(),
        );

        let page_total = 1,
          rows_total = 0;
        if (!tbl_temporary_count.code && tbl_temporary_count.data.length > 0) {
          rows_total = parseInt(tbl_temporary_count.data[0].rows_total);
          page_total = parseInt(tbl_temporary_count.data[0].page_total);
        }


        let response = [
          {
            status: "success",
            invalid_code: "0",
            message: "",
            data: data,
            rows_total: rows_total,
            page_total: page_total <= 0 ? 1 : page_total,
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
            message: "ไม่พบข้อมูลกลุ่มปั๊มพ่วง",
            data: [],
            rows_total: 0,
            page_total: 0,
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
        "ดึงข้อมูลกลุ่มปั๊มพ่วง",
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
    const _lic = req.header("lic_code");
    const _act = req.body?.[0]?.action?.[0] || {};
    if (_lic && _act.id) {
      await xglobal.action_logs(
        _lic,
        _act.id,
        "ดึงข้อมูลกลุ่มปั๊มพ่วง",
        JSON.stringify(req.body?.[0] || {}),
        "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        _act.value,
      );
    }
    return;
  });
};

//Success
exports.removePetrolMergeJob = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let { ptrl_merge_group_code, ptrl_merge_job_code, action } = req.body[0];
    let group_code = ptrl_merge_group_code || ptrl_merge_job_code;

    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      group_code == undefined ||
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
      let groupCodeArr = Array.isArray(group_code)
        ? group_code
        : [group_code];
      let groupCodeIn = groupCodeArr
        .map((c) => `'${c}'`)
        .join(", ");
      let script = `update tbl_petrol_merge_job_group set merge_job_group_flag = 0, rm_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}' where ptrl_merge_group_code in (${groupCodeIn});`;

      let tbl_temporary = await pgConn.execute(
        dbPrefix + lic_code,
        script,
        config.connectionString(),
      );
      if (!tbl_temporary.code) {
        let response = [
          {
            status: "success",
            invalid_code: "0",
            message: "ลบข้อมูลสำเร็จ",
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];

        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "ลบข้อมูลกลุ่มปั้มที่พ่วงงานกันได้",
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
          "ลบข้อมูลกลุ่มปั้มที่พ่วงงานกันได้",
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
        "ลบข้อมูลกลุ่มปั้มที่พ่วงงานกันได้",
        JSON.stringify(req.body?.[0] || {}),
        "ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        _act.value,
      );
    }
    return;
  });
};

//Success
exports.setPetrolMergeJobInformation = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let { ptrl_merge_group_code, ptrl_merge_group_desc, ptrl_code, action } = req.body[0];
    let group_code = ptrl_merge_group_code || req.query.ptrl_merge_group_code || req.query.ptrl_merge_job_code;

    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      group_code == undefined ||
      ptrl_merge_group_desc == undefined ||
      !Array.isArray(ptrl_code) ||
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
      // ตรวจสอบชื่อกลุ่มซ้ำ (Duplicate Check) ยกเว้นกลุ่มปัจจุบันที่กำลังแก้ไข
      let check_script = `select ptrl_merge_group_desc from tbl_petrol_merge_job_group 
                          where ptrl_merge_group_desc = '${ptrl_merge_group_desc.replace(/'/g, "''")}' 
                          and ptrl_merge_group_code != '${group_code}' 
                          and merge_job_group_flag = 1;`;

      let check_tbl_temporary = await pgConn.get(
        dbPrefix + lic_code,
        check_script,
        config.connectionString(),
      );

      if (check_tbl_temporary.code || check_tbl_temporary.data.length > 0) {
        let response = [
          {
            status: "error",
            invalid_code: "-3",
            message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากมีข้อมูลกลุ่มนี้อยู่แล้ว`,
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "แก้ไขข้อมูลปั้มที่สามารถพ่วงกันได้",
          JSON.stringify(req.body[0]),
          "ไม่สามารถบันทึกข้อมูล, เนื่องจากมีข้อมูลกลุ่มนี้อยู่แล้ว",
          action[0].value,
        );
        return;
      }

      // Soft delete ข้อมูลเดิมในกลุ่มนี้ก่อน
      let delete_script = `update tbl_petrol_merge_job_group set merge_job_group_flag = 0, rm_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}' 
                           where ptrl_merge_group_code = '${group_code}' and merge_job_group_flag = 1;`;

      let delete_tbl_temporary = await pgConn.execute(
        dbPrefix + lic_code,
        delete_script,
        config.connectionString(),
      );

      if (delete_tbl_temporary.code) {
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
          "แก้ไขข้อมูลปั้มที่สามารถพ่วงกันได้",
          JSON.stringify(req.body[0]),
          "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
          action[0].value,
        );
        return;
      }

      // บันทึกข้อมูลปั๊มใหม่เข้ามาในกลุ่มเดิม
      if (Array.isArray(ptrl_code) && ptrl_code.length > 0) {
        for (let ptrlCode of ptrl_code) {
          let mergeGroupCode = `mgc-${moment().format("YYYYMMDDHHmmss")}${Math.floor(Math.random() * 1000)}`;
          let script = `insert into tbl_petrol_merge_job_group (merge_group_code,ptrl_merge_group_code,ptrl_code,ptrl_merge_group_desc,ist_dt) 
                            values ('${mergeGroupCode}', '${group_code}', '${ptrlCode}', '${ptrl_merge_group_desc}', '${moment().format("YYYY-MM-DD HH:mm:ss")}')`;
          let tbl_temporary = await pgConn.execute(
            dbPrefix + lic_code,
            script,
            config.connectionString(),
          );
          if (tbl_temporary.code) {
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
              "แก้ไขข้อมูลปั้มที่สามารถพ่วงกันได้",
              JSON.stringify(req.body[0]),
              "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
              action[0].value,
            );
            return;
          }
        }
      }

      let response = [
        {
          status: "success",
          invalid_code: "0",
          message: "แก้ไขข้อมูลสำเร็จ",
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];

      res.status(200).send(response);
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "แก้ไขข้อมูลปั้มที่สามารถพ่วงกันได้",
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
        "แก้ไขข้อมูลปั้มที่สามารถพ่วงกันได้",
        JSON.stringify(req.body?.[0] || {}),
        "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        _act.value,
      );
    }
    return;
  });
};

//Success
exports.addPetrolMergeJobGroupInformation = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let { ptrl_merge_group_desc, ptrl_code, action } = req.body[0];

    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      !ptrl_merge_group_desc ||
      !Array.isArray(ptrl_code) ||
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
      // ตรวจสอบชื่อกลุ่มซ้ำ (Duplicate Check)
      let check_script = `SELECT ptrl_merge_group_desc FROM tbl_petrol_merge_job_group 
                          WHERE ptrl_merge_group_desc = '${ptrl_merge_group_desc.replace(/'/g, "''")}' 
                          AND merge_job_group_flag = 1;`;

      let check_tbl_temporary = await pgConn.get(
        dbPrefix + lic_code,
        check_script,
        config.connectionString(),
      );

      if (check_tbl_temporary.code || check_tbl_temporary.data.length > 0) {
        let response = [
          {
            status: "error",
            invalid_code: "-3",
            message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากมีข้อมูลกลุ่มนี้อยู่แล้ว`,
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "เพิ่มข้อมูลปั้มที่สามารถพ่วงกันได้",
          JSON.stringify(req.body[0]),
          "ไม่สามารถบันทึกข้อมูล, เนื่องจากมีข้อมูลกลุ่มนี้อยู่แล้ว",
          action[0].value,
        );
        return;
      }

      let insertedData = [];
      let isError = false;

      let ptrlMergeGroupCode = `ptmg-${moment().format("YYYYMMDDHHmmss")}${Math.floor(Math.random() * 1000)}`;

      if (Array.isArray(ptrl_code) && ptrl_code.length > 0) {
        for (let ptrlCode of ptrl_code) {
          let mergeGroupCode = `mgc-${moment().format("YYYYMMDDHHmmss")}${Math.floor(Math.random() * 1000)}`;
          let script = `insert into tbl_petrol_merge_job_group (merge_group_code,ptrl_merge_group_code,ptrl_code,ptrl_merge_group_desc,ist_dt) 
                            values ('${mergeGroupCode}', '${ptrlMergeGroupCode}', '${ptrlCode}', '${ptrl_merge_group_desc}', '${moment().format("YYYY-MM-DD HH:mm:ss")}')`;
          let tbl_temporary = await pgConn.execute(
            dbPrefix + lic_code,
            script,
            config.connectionString(),
          );
          if (tbl_temporary.code) {
            await xglobal.action_logs(
              lic_code,
              action[0].id,
              "เพิ่มข้อมูลปั้มที่สามารถพ่วงกันได้",
              JSON.stringify(req.body[0]),
              "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
              action[0].value,
            );
            return xglobal.sendResponse(
              res,
              "error",
              "-3",
              "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
              [],
            );
          }
        }
      }
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "เพิ่มข้อมูลปั้มที่สามารถพ่วงกันได้",
        JSON.stringify(req.body[0]),
        "success",
        action[0].value,
      );
      return xglobal.sendResponse(
        res,
        "success",
        "0",
        "เพิ่มข้อมูลปั้มที่สามารถพ่วงกันได้สำเร็จ",
        [],
      );
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
        "เพิ่มข้อมูลปั้มที่สามารถพ่วงกันได้",
        JSON.stringify(req.body?.[0] || {}),
        "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        _act.value,
      );
    }
    return;
  });
};
