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
    let { ptrl_merge_group_code, action, search, page_index, page_limit } = req.body[0];

    const page = parseInt(page_index) || 1;
    const limit = parseInt(page_limit) || 10;
    const offset = (page > 0 ? page - 1 : 0) * limit;

    // เช็คเฉพาะส่วนที่สำคัญ
    if (
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
      "d.merge_job_group_details_flag = 1",
      "di.flag = 1",
      "p.ptrl_flag = '1'",
      "depot.dpo_flag = '1'",
      "ti.itm_flag = '1'"
    ];

    if (ptrl_merge_group_code && ptrl_merge_group_code !== "ALL") conditions.push(`g.ptrl_merge_group_code = '${ptrl_merge_group_code.replace(/'/g, "''")}'`)

    if (search) {
      conditions.push(`(ptrl_merge_group_desc like '%${search.replace(/'/g, "''")}%' or ptrl_merge_group_code like '%${search.replace(/'/g, "''")}%')`);
    }

    let where_clause = "where " + conditions.join(" and ");

    let script = `select 
    distinct g.ptrl_merge_group_code, 
    g.ptrl_merge_group_desc, 
    coalesce(
        jsonb_agg(
            jsonb_build_object(
                'ptrl_desc', p.ptrl_desc,
                'dpo_desc', depot.dpo_desc,
                'itm_desc', ti.itm_desc
            )
        ) FILTER (WHERE p.ptrl_code IS NOT NULL), 
        '[]'::jsonb
    ) AS data
    from tbl_petrol_merge_job_group g
    left join tbl_petrol_merge_job_details d on g.ptrl_merge_group_code = d.ptrl_merge_group_code 
    left join tbl_petrol_merge_job_depot_item di on g.ptrl_merge_group_code = di.ptrl_merge_group_code 
    left join tbl_petrol p on d.ptrl_code = p.ptrl_code 
    left join tbl_item ti on di.itm_code = ti.itm_code 
    left join tbl_depot depot on di.dpo_code  = depot.dpo_code 
    ${where_clause}
    group by 
      g.ptrl_merge_group_code, 
      g.ptrl_merge_group_desc
    order by g.ptrl_merge_group_desc asc 
    limit ${limit} offset ${offset};`;
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
                COUNT(DISTINCT g.ptrl_merge_group_code) as rows_total,
                CEIL(COUNT(g.ptrl_merge_group_code)::float / ${limit}) as page_total
            from tbl_petrol_merge_job_group g
            left join tbl_petrol_merge_job_details d on g.ptrl_merge_group_code = d.ptrl_merge_group_code 
            left join tbl_petrol_merge_job_depot_item di on g.ptrl_merge_group_code = di.ptrl_merge_group_code 
            left join tbl_petrol p on d.ptrl_code = p.ptrl_code 
            left join tbl_item ti on di.itm_code = ti.itm_code 
            left join tbl_depot depot on di.dpo_code  = depot.dpo_code 
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
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];
      res.status(200).send(response);
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
    return;
  });
};

// ========= Success =========
exports.removePetrolMergeJob = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let { ptrl_merge_group_code, ptrl_merge_job_code, action } = req.body[0];
    let group_code = ptrl_merge_group_code || ptrl_merge_job_code;

    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      group_code == undefined ||
      lic_code == undefined ||
      !Array.isArray(action) ||
      action.length === 0
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

      let groupCodeArr = Array.isArray(group_code) ? group_code : [group_code];
      let groupCodeIn = groupCodeArr.map((c) => `'${c.replace(/'/g, "''")}'`).join(", ");

      // ตรวจสอบว่ามีออเดอร์ในกลุ่มนี้กำลังดำเนินการพ่วงจัดส่งอยู่หรือไม่
      let checkActiveOrdersScript = `
        SELECT o.id, o.order_no 
        FROM tbl_order o
        JOIN tbl_petrol p ON o.ship_to = p.ptrl_number
        JOIN tbl_petrol_merge_job_details d ON p.ptrl_code = d.ptrl_code
        WHERE d.ptrl_merge_group_code IN (${groupCodeIn})
          AND d.merge_job_group_details_flag = 1
          AND o.order_flag = '1'
          AND o.order_status = 0
          AND o.consignment_no IS NOT NULL
        LIMIT 1;
      `;
      let activeCheckResult = await pgConn.get(
        dbPrefix + lic_code,
        checkActiveOrdersScript,
        config.connectionString()
      );

      if (!activeCheckResult.code && activeCheckResult.data.length > 0) {
        let response = [
          {
            status: "error",
            invalid_code: "-5",
            message: "ไม่สามารถลบกลุ่มพ่วงได้ เนื่องจากมีออเดอร์ในกลุ่มกำลังดำเนินการพ่วงจัดส่งอยู่",
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
        res.status(200).send(response);

        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "ลบข้อมูลกลุ่มปั๊มที่พ่วงงานกันได้",
          JSON.stringify(req.body[0]),
          "ไม่สามารถลบกลุ่มพ่วงได้ เนื่องจากมีออเดอร์ในกลุ่มกำลังดำเนินการพ่วงจัดส่งอยู่",
          action[0].value,
        );
        return;
      }

      const transaction = await pgConn.executeTransaction(dbPrefix + lic_code, async (client) => {
        let script = `update tbl_petrol_merge_job_group set merge_job_group_flag = 0, rm_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}' where ptrl_merge_group_code in (${groupCodeIn});`;
        await pgConn.executeWithClient(
          client,
          script
        );

        let scriptRemovePetrolMerge = `update tbl_petrol_merge_job_details set merge_job_group_details_flag = 0, rm_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}' where ptrl_merge_group_code in (${groupCodeIn});`;
        await pgConn.executeWithClient(
          client,
          scriptRemovePetrolMerge
        );

        let scriptRemoveDepotItemMerge = `update tbl_petrol_merge_job_depot_item set flag = 0, rm_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}' where ptrl_merge_group_code in (${groupCodeIn});`;
        await pgConn.executeWithClient(
          client,
          scriptRemoveDepotItemMerge
        );





      }, config.connectionString())


      if (transaction.code) {
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "ลบข้อมูลกลุ่มปั๊มที่พ่วงงานกันได้",
          JSON.stringify(req.body[0]),
          transaction.message,
          action[0].value,
        );
        return sendResponse(
          res,
          "error",
          "-3",
          `ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
        );
      }

      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "ลบข้อมูลกลุ่มปั๊มที่พ่วงงานกันได้",
        JSON.stringify(req.body[0]),
        "success",
        action[0].value,
      );

      return xglobal.sendResponse(res, "success", "0", "ลบข้อมูลสำเร็จ");
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

// ========= Success =========
exports.setPetrolMergeJobInformation = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let { ptrl_merge_group_code } = req.query;
    let { ptrl_merge_group_desc, ptrl_code, depot_item, action } = req.body[0];
    let group_code = ptrl_merge_group_code || req.query.ptrl_merge_group_code || req.query.ptrl_merge_job_code;

    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      group_code == undefined ||
      ptrl_merge_group_desc == undefined ||
      !Array.isArray(action) ||
      action.length === 0 ||
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
      // validate ปั๊ม
      let uniquePtrlCodes = [];
      if (Array.isArray(ptrl_code)) {
        uniquePtrlCodes = [...new Set(ptrl_code.filter(c => c))];
      }

      let uniqueDpoCodes = [];
      let uniqueItmCodes = [];
      if (Array.isArray(depot_item)) {
        uniqueDpoCodes = [...new Set(depot_item.map(di => di.dpo_code).filter(c => c))];
        let allItmCodes = [];
        for (let di of depot_item) {
          if (Array.isArray(di.itm_code)) {
            allItmCodes.push(...di.itm_code.filter(c => c));
          }
        }
        uniqueItmCodes = [...new Set(allItmCodes)];
      }

      if (uniquePtrlCodes.length === 0 || uniqueDpoCodes.length === 0 || uniqueItmCodes.length === 0) {
        let response = [
          {
            status: "error",
            invalid_code: "-1",
            message: "ไม่สามารถบันทึกข้อมูล, กรุณาระบุปั๊มน้ำมัน คลังน้ำมัน และชนิดน้ำมันให้ครบถ้วนและถูกต้อง",
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
        res.status(200).send(response);
        return;
      }

      // validate ปั๊มน้ำมัน
      let ptrlIn = uniquePtrlCodes.map(c => `'${c.replace(/'/g, "''")}'`).join(", ");
      let checkPtrlScript = `SELECT COUNT(*) AS total FROM tbl_petrol WHERE ptrl_code IN (${ptrlIn}) AND ptrl_flag = '1'`;
      let ptrlCheckRes = await pgConn.get(dbPrefix + lic_code, checkPtrlScript, config.connectionString());
      if (ptrlCheckRes.code || parseInt(ptrlCheckRes.data[0].total) !== uniquePtrlCodes.length) {
        let response = [
          {
            status: "error",
            invalid_code: "-6",
            message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากพบรหัสปั๊มน้ำมันที่ไม่ถูกต้องหรือไม่พร้อมใช้งานในระบบ ${ptrlIn}`,
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
        res.status(200).send(response);
        return;
      }

      // validate คลังน้ำมัน
      let dpoIn = uniqueDpoCodes.map(c => `'${c.replace(/'/g, "''")}'`).join(", ");
      let checkDpoScript = `SELECT COUNT(*) AS total FROM tbl_depot WHERE dpo_code IN (${dpoIn}) AND dpo_flag = '1'`;
      let dpoCheckRes = await pgConn.get(dbPrefix + lic_code, checkDpoScript, config.connectionString());
      if (dpoCheckRes.code || parseInt(dpoCheckRes.data[0].total) !== uniqueDpoCodes.length) {
        let response = [
          {
            status: "error",
            invalid_code: "-7",
            message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากพบรหัสคลังน้ำมันที่ไม่ถูกต้องหรือไม่พร้อมใช้งานในระบบ ${dpoIn}`,
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
        res.status(200).send(response);
        return;
      }

      // validate น้ำมัน
      let itmIn = uniqueItmCodes.map(c => `'${c.replace(/'/g, "''")}'`).join(", ");
      let checkItmScript = `SELECT COUNT(*) AS total FROM tbl_item WHERE itm_code IN (${itmIn}) AND itm_flag = '1'`;
      let itmCheckRes = await pgConn.get(dbPrefix + lic_code, checkItmScript, config.connectionString());
      if (itmCheckRes.code || parseInt(itmCheckRes.data[0].total) !== uniqueItmCodes.length) {
        let response = [
          {
            status: "error",
            invalid_code: "-8",
            message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากพบรหัสผลิตภัณฑ์น้ำมันที่ไม่ถูกต้องหรือไม่พร้อมใช้งานในระบบ ${itmIn}`,
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
        res.status(200).send(response);
        return;
      }

      // duplicate ชื่อกลุ่ม
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

      let now_dt = moment().format("YYYY-MM-DD HH:mm:ss");

      // ใช้ Transaction ในการรัน
      let transactionResult = await pgConn.executeTransaction(
        dbPrefix + lic_code,
        async (client) => {
          // อัปเดตชื่อกลุ่ม
          let updateScript = `update tbl_petrol_merge_job_group 
                              set ptrl_merge_group_desc = '${ptrl_merge_group_desc.replace(/'/g, "''")}',
                                  mdf_dt = '${now_dt}' 
                              where ptrl_merge_group_code = '${group_code}' and merge_job_group_flag = 1;`;
          await pgConn.executeWithClient(client, updateScript);

          // ลบรายละเอียดปั๊มเดิม
          let deleteDetailsScript = `delete from tbl_petrol_merge_job_details where ptrl_merge_group_code = '${group_code}'`;
          await pgConn.executeWithClient(client, deleteDetailsScript);

          // ลบคลังน้ำมัน กับ น้ำมัน
          let deleteDepotItemScript = `delete from tbl_petrol_merge_job_depot_item where ptrl_merge_group_code = '${group_code}'`;
          await pgConn.executeWithClient(client, deleteDepotItemScript);

          // บันทึกปั๊มน้ำมันชุดใหม่ (ถ้ามี)
          if (Array.isArray(ptrl_code)) {
            for (let ptrlCodeMap of ptrl_code) {
              let insertDetailsScript = `insert into tbl_petrol_merge_job_details (ptrl_merge_group_code, ptrl_code, ist_dt, merge_job_group_details_flag) 
                                         values ('${group_code}', '${ptrlCodeMap}', '${now_dt}', 1)`;
              await pgConn.executeWithClient(client, insertDetailsScript);
            }
          }

          // บันทึกคลังน้ำมันและชนิดน้ำมันชุดใหม่ 
          if (Array.isArray(depot_item)) {
            for (let di of depot_item) {
              let dpo_code = di.dpo_code;
              if (Array.isArray(di.itm_code)) {
                for (let itmCodeMap of di.itm_code) {
                  let insertDepotItemScript = `insert into tbl_petrol_merge_job_depot_item (ptrl_merge_group_code, dpo_code, itm_code, ist_dt, flag) 
                                               values ('${group_code}', '${dpo_code}', '${itmCodeMap}', '${now_dt}', 1)`;
                  await pgConn.executeWithClient(client, insertDepotItemScript);
                }
              }
            }
          }
          return true;
        },
        config.connectionString()
      );

      if (transactionResult.code) {
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "แก้ไขข้อมูลปั้มที่สามารถพ่วงกันได้",
          JSON.stringify(req.body[0]),
          "ไม่สามารถบันทึกข้อมูล: " + transactionResult.message,
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

// ========= Success =========
exports.addPetrolMergeJobGroupInformation = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let { ptrl_merge_group_desc, ptrl_code, depot_item, action } = req.body[0];

    // เช็คเฉพาะส่วนที่สำคัญ
    if (!ptrl_merge_group_desc || !Array.isArray(action) || action.length === 0 || !lic_code) {
      let response = [
        {
          status: "error",
          invalid_code: "-1",
          message: "ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
      ];

      res.status(200).send(response);
      return;
    } else {
      // 1. ตรวจสอบเงื่อนไขกลุ่มว่างเปล่า (Empty Group Check)
      let uniquePtrlCodes = [];
      if (Array.isArray(ptrl_code)) {
        uniquePtrlCodes = [...new Set(ptrl_code.filter(c => c))];
      }

      let uniqueDpoCodes = [];
      let uniqueItmCodes = [];
      if (Array.isArray(depot_item)) {
        uniqueDpoCodes = [...new Set(depot_item.map(di => di.dpo_code).filter(c => c))];
        let allItmCodes = [];
        for (let di of depot_item) {
          if (Array.isArray(di.itm_code)) {
            allItmCodes.push(...di.itm_code.filter(c => c));
          }
        }
        uniqueItmCodes = [...new Set(allItmCodes)];
      }

      if (uniquePtrlCodes.length === 0 || uniqueDpoCodes.length === 0 || uniqueItmCodes.length === 0) {
        let response = [
          {
            status: "error",
            invalid_code: "-1",
            message: "ไม่สามารถบันทึกข้อมูล, กรุณาระบุปั๊มน้ำมัน คลังน้ำมัน และชนิดน้ำมันให้ครบถ้วนและถูกต้อง",
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
        res.status(200).send(response);
        return;
      }

      // validate ปั๊ม
      let ptrlIn = uniquePtrlCodes.map(c => `'${c.replace(/'/g, "''")}'`).join(", ");
      let checkPtrlScript = `SELECT COUNT(*) AS total FROM tbl_petrol WHERE ptrl_code IN (${ptrlIn}) AND ptrl_flag = '1'`;
      let ptrlCheckRes = await pgConn.get(dbPrefix + lic_code, checkPtrlScript, config.connectionString());
      if (ptrlCheckRes.code || parseInt(ptrlCheckRes.data[0].total) !== uniquePtrlCodes.length) {
        let response = [
          {
            status: "error",
            invalid_code: "-6",
            message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากพบรหัสปั๊มน้ำมันที่ไม่ถูกต้องหรือไม่พร้อมใช้งานในระบบ ${ptrlIn}`,
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
        res.status(200).send(response);
        return;
      }

      // validate คลัง
      let dpoIn = uniqueDpoCodes.map(c => `'${c.replace(/'/g, "''")}'`).join(", ");
      let checkDpoScript = `SELECT COUNT(*) AS total FROM tbl_depot WHERE dpo_code IN (${dpoIn}) AND dpo_flag = '1'`;
      let dpoCheckRes = await pgConn.get(dbPrefix + lic_code, checkDpoScript, config.connectionString());
      if (dpoCheckRes.code || parseInt(dpoCheckRes.data[0].total) !== uniqueDpoCodes.length) {
        let response = [
          {
            status: "error",
            invalid_code: "-7",
            message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากพบรหัสคลังน้ำมันที่ไม่ถูกต้องหรือไม่พร้อมใช้งานในระบบ ${dpoIn}`,
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
        res.status(200).send(response);
        return;
      }

      // validate น้ำมัน
      let itmIn = uniqueItmCodes.map(c => `'${c.replace(/'/g, "''")}'`).join(", ");
      let checkItmScript = `SELECT COUNT(*) AS total FROM tbl_item WHERE itm_code IN (${itmIn}) AND itm_flag = '1'`;
      let itmCheckRes = await pgConn.get(dbPrefix + lic_code, checkItmScript, config.connectionString());
      if (itmCheckRes.code || parseInt(itmCheckRes.data[0].total) !== uniqueItmCodes.length) {
        let response = [
          {
            status: "error",
            invalid_code: "-8",
            message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากพบรหัสผลิตภัณฑ์น้ำมันที่ไม่ถูกต้องหรือไม่พร้อมใช้งานในระบบ ${itmIn}`,
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
        res.status(200).send(response);
        return;
      }

      // ตรวจสอบชื่อกลุ่มซ้ำ
      let check_script = `select ptrl_merge_group_desc FROM tbl_petrol_merge_job_group 
                          where ptrl_merge_group_desc = '${ptrl_merge_group_desc.replace(/'/g, "''")}' 
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
          "เพิ่มข้อมูลปั้มที่สามารถพ่วงกันได้",
          JSON.stringify(req.body[0]),
          "ไม่สามารถบันทึกข้อมูล, เนื่องจากมีข้อมูลกลุ่มนี้อยู่แล้ว",
          action[0].value,
        );
        return;
      }

      let ptrlMergeGroupCode = `ptmg-${moment().format("YYYYMMDDHHmmss")}${Math.floor(Math.random() * 1000)}`;
      let now_dt = moment().format("YYYY-MM-DD HH:mm:ss");

      let transactionResult = await pgConn.executeTransaction(
        dbPrefix + lic_code,
        async (client) => {
          // เพิ่มข้อมูลกลุ่ม
          let insertGroupScript = `insert into tbl_petrol_merge_job_group (ptrl_merge_group_code, ptrl_merge_group_desc, ist_dt, merge_job_group_flag) 
                                   values ('${ptrlMergeGroupCode}', '${ptrl_merge_group_desc.replace(/'/g, "''")}', '${now_dt}', 1)`;
          await pgConn.executeWithClient(client, insertGroupScript);

          // เพิ่มข้อมูลรายละเอียดปั๊มน้ำมัน
          if (Array.isArray(ptrl_code) && ptrl_code.length > 0) {
            for (let ptrlCodeMap of ptrl_code) {
              let insertDetailsScript = `insert into tbl_petrol_merge_job_details (ptrl_merge_group_code, ptrl_code, ist_dt, merge_job_group_details_flag) 
                                         values ('${ptrlMergeGroupCode}', '${ptrlCodeMap}', '${now_dt}', 1)`;
              await pgConn.executeWithClient(client, insertDetailsScript);
            }
          }

          // เพิ่มข้อมูลคู่คลังน้ำมันและชนิดน้ำมัน
          if (Array.isArray(depot_item) && depot_item.length > 0) {
            for (let di of depot_item) {
              let dpo_code = di.dpo_code;
              if (Array.isArray(di.itm_code)) {
                for (let itmCodeMap of di.itm_code) {
                  let insertDepotItemScript = `insert into tbl_petrol_merge_job_depot_item (ptrl_merge_group_code, dpo_code, itm_code, ist_dt, flag) 
                                               values ('${ptrlMergeGroupCode}', '${dpo_code}', '${itmCodeMap}', '${now_dt}', 1)`;
                  await pgConn.executeWithClient(client, insertDepotItemScript);
                }
              }
            }
          }
          return true;
        },
        config.connectionString(),
      );

      if (transactionResult.code) {
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "เพิ่มข้อมูลปั้มที่สามารถพ่วงกันได้",
          JSON.stringify(req.body[0]),
          "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ: " + transactionResult.message,
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

exports.addPetrolMergeJobGroupWithPetrol = exports.addPetrolMergeJobGroupInformation;


// ========= Success =========
exports.getPetrolMergeJobDetails = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let { ptrl_code, action, page_index, page_limit } = req.body[0];
    const page = parseInt(page_index) || 1;
    const limit = parseInt(page_limit) || 10;
    const offset = (page > 0 ? page - 1 : 0) * limit;

    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      ptrl_code == undefined ||
      lic_code == undefined ||
      !Array.isArray(action) ||
      action.length === 0
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
      let escaped_ptrl_code = ptrl_code.replace(/'/g, "''");

      let script = `select distinct 
                      p.ptrl_code,
                      p.ptrl_number,
                      p.ptrl_desc,
                      p.ptrl_short_desc,
                      d.ptrl_merge_group_code,
                      g.ptrl_merge_group_desc
                    from tbl_petrol_merge_job_details d
                    join tbl_petrol p on d.ptrl_code = p.ptrl_code
                    join tbl_petrol_merge_job_group g on d.ptrl_merge_group_code = g.ptrl_merge_group_code
                    where d.ptrl_merge_group_code in (
                        select ptrl_merge_group_code 
                        from tbl_petrol_merge_job_details 
                        where ptrl_code = '${escaped_ptrl_code}' 
                          and merge_job_group_details_flag = 1
                    ) 
                    and d.merge_job_group_details_flag = 1
                    and g.merge_job_group_flag = 1
                    and p.ptrl_flag = '1'
                    and p.ptrl_code <> '${escaped_ptrl_code}'
                    limit ${limit} offset ${offset};;`;

      let tbl_temporary = await pgConn.get(
        dbPrefix + lic_code,
        script,
        config.connectionString(),
      );

      if (!tbl_temporary.code) {
        // paging
        if (tbl_temporary.data.length > 0) {
          const data = JSON.parse(
            JSON.stringify(tbl_temporary.data).replace(/\:null/gi, '\:""'),
          );

          const countScript = `
            SELECT 
                COUNT(DISTINCT p.ptrl_code) as rows_total,
                CEIL(COUNT(p.ptrl_code)::float / ${limit}) as page_total
            from tbl_petrol_merge_job_details d
            join tbl_petrol p on d.ptrl_code = p.ptrl_code
            join tbl_petrol_merge_job_group g on d.ptrl_merge_group_code = g.ptrl_merge_group_code
            where d.ptrl_merge_group_code in (
                        select ptrl_merge_group_code 
                        from tbl_petrol_merge_job_details 
                        where ptrl_code = '${escaped_ptrl_code}' 
                          and merge_job_group_details_flag = 1
                    ) 
                    and d.merge_job_group_details_flag = 1
                    and g.merge_job_group_flag = 1
                    and p.ptrl_flag = '1'
                    and p.ptrl_code <> '${escaped_ptrl_code}';
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
        }
        else {
          let response = [
            {
              status: "success",
              invalid_code: "0",
              message: "ไม่พบข้อมูลปั๊มพ่วง",
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
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
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
        message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
        data: [],
        response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
      },
    ];
    res.status(200).send(response);
    return;
  });
};