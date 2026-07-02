const config = require("../../configuration/connection");
const pgConn = require("../../library/pgConnection");
const moment = require("moment");
const xglobal = require("../../middleware/global");

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
//Success
exports.getDepotItemInformation = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let { itm_code, dpo_code, page_index, page_limit, action } = req.body[0];

    page_index = page_index || 1;
    page_limit = page_limit || 10;

    if (page_index > 0) {
      page_index -= 1;
    }

    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      itm_code == undefined ||
      dpo_code == undefined ||
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
      if (itm_code.toString().toUpperCase() != "ALL") {
        script = `select
                dpo_item_code,
                tbl_depot.dpo_code,
                dpo_number,
                dpo_desc,
                dpo_short_desc,
                tbl_depot.dpo_group_code,
                dpo_group_desc,
                tbl_depot_item.itm_code,
                itm_desc,
                itm_short_desc,
                tbl_item.itm_type_code,
                itm_type_desc,
                itm_unit_code,
                itm_unit_code,
                itm_icon,
                itm_image,
                itm_material_number,
                tbl_depot.off_code,
                off_desc,
                tbl_depot_item.ist_dt,
                tbl_depot_item.mdf_dt,
                tbl_depot_item.rm_dt 
                from tbl_depot
                left join tbl_office on tbl_depot.off_code = tbl_office.off_code
                left join tbl_depot_item on tbl_depot.dpo_code = tbl_depot_item.dpo_code 
                left join tbl_item on tbl_depot_item.itm_code = tbl_item.itm_code 
                left join tbl_item_type on tbl_item.itm_type_code = tbl_item_type.itm_type_code 
                left join tbl_depot_group on tbl_depot.dpo_group_code = tbl_depot_group.dpo_group_code 
                where tbl_depot_item.itm_code = '${itm_code}' and tbl_depot_item.dpo_item_flag = '1' and dpo_item_code is not null `;
      } else {
        script = `select
                dpo_item_code,
                tbl_depot.dpo_code,
                dpo_number,
                dpo_desc,
                dpo_short_desc,
                tbl_depot.dpo_group_code,
                dpo_group_desc,
                tbl_depot_item.itm_code,
                itm_desc,
                itm_short_desc,
                tbl_item.itm_type_code,
                itm_type_desc,
                itm_unit_code,
                itm_unit_code,
                itm_icon,
                itm_image,
                itm_material_number,
                tbl_depot.off_code,
                off_desc,
                tbl_depot_item.ist_dt,
                tbl_depot_item.mdf_dt,
                tbl_depot_item.rm_dt 
                from tbl_depot
                left join tbl_office on tbl_depot.off_code = tbl_office.off_code
                left join tbl_depot_item on tbl_depot.dpo_code = tbl_depot_item.dpo_code 
                left join tbl_item on tbl_depot_item.itm_code = tbl_item.itm_code 
                left join tbl_item_type on tbl_item.itm_type_code = tbl_item_type.itm_type_code 
                left join tbl_depot_group on tbl_depot.dpo_group_code = tbl_depot_group.dpo_group_code 
                where tbl_depot_item.dpo_item_flag = '1' and dpo_item_code is not null `;
      }

      if (dpo_code.toString().toUpperCase() != "ALL") {
        script += ` and tbl_depot.dpo_code = '${dpo_code}' `;
      }

      script += `  order by tbl_depot_item.ist_dt desc `;
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

          if (itm_code.toString().toUpperCase() != "ALL") {
            script = `select ceil((ceil(count(dpo_item_code)) / ${page_limit})) as page_total, (count(dpo_item_code)) as rows_total 
                        from tbl_depot
                        left join tbl_office on tbl_depot.off_code = tbl_office.off_code
                        left join tbl_depot_item on tbl_depot.dpo_code = tbl_depot_item.dpo_code 
                        left join tbl_item on tbl_depot_item.itm_code = tbl_item.itm_code 
                        left join tbl_item_type on tbl_item.itm_type_code = tbl_item_type.itm_type_code 
                        left join tbl_depot_group on tbl_depot.dpo_group_code = tbl_depot_group.dpo_group_code 
                        where tbl_depot_item.itm_code = '${itm_code}' and tbl_depot_item.dpo_item_flag = '1' and dpo_item_code is not null `;
          } else {
            script = `select ceil((ceil(count(dpo_item_code)) / ${page_limit})) as page_total, (count(dpo_item_code)) as rows_total 
                        from tbl_depot
                        left join tbl_office on tbl_depot.off_code = tbl_office.off_code
                        left join tbl_depot_item on tbl_depot.dpo_code = tbl_depot_item.dpo_code 
                        left join tbl_item on tbl_depot_item.itm_code = tbl_item.itm_code 
                        left join tbl_item_type on tbl_item.itm_type_code = tbl_item_type.itm_type_code 
                        left join tbl_depot_group on tbl_depot.dpo_group_code = tbl_depot_group.dpo_group_code 
                        where tbl_depot_item.dpo_item_flag = '1' and dpo_item_code is not null `;
          }

          if (dpo_code.toString().toUpperCase() != "ALL") {
            script += ` and tbl_depot.dpo_code = '${dpo_code}' `;
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
          "ดึงข้อมูลสินค้าคลังสินค้า",
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
      "ดึงข้อมูลสินค้าคลังสินค้า",
      JSON.stringify(req.body[0]),
      "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      action[0].value,
    );
    return;
  });
};

//Success
exports.removeDepotItem = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let { dpo_item_code, action } = req.body[0];
    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      dpo_item_code == undefined ||
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
      script = `update tbl_depot_item set dpo_item_flag = '0', rm_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}' where dpo_item_code = '${dpo_item_code}';`;

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
          "ลบข้อมูลสินค้าคลังสินค้า",
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
          "ลบข้อมูลสินค้าคลังสินค้า",
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
      "ลบข้อมูลสินค้าคลังสินค้า",
      JSON.stringify(req.body[0]),
      "ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      action[0].value,
    );
    return;
  });
};

//Success
exports.setDepotItemInformation = async (req, res, next) => {
  return (async () => {
    //debugger
    let lic_code = req.header("lic_code");
    let { dpo_item_code } = req.query;
    let { dpo_code, itm_code, action } = req.body[0];

    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      dpo_item_code == undefined ||
      dpo_code == undefined ||
      itm_code == undefined ||
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
      script = `update tbl_depot_item set
            dpo_code = '${dpo_code}', 
            itm_code = '${itm_code}',
            mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}' 
            where dpo_item_code = '${dpo_item_code}';`;

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
          "แก้ไขข้อมูลสินค้าคลังสินค้า",
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
          "แก้ไขข้อมูลสินค้าคลังสินค้า",
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
        "แก้ไขข้อมูลสินค้าคลังสินค้า",
        JSON.stringify(req.body[0]),
        "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        _act.value,
      );
    }
    return;
  });
};

//Success
exports.addDepotItemInformation = async (req, res, next) => {
  return (async () => {
    let lic_code = req.header("lic_code");
    let { depot_item_info, action } = req.body[0];

    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      !Array.isArray(depot_item_info) ||
      depot_item_info.length === 0 ||
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

      for (let info of depot_item_info) {
        let { dpo_code, itm_code } = info;

        if (!dpo_code || !itm_code) continue;

        let scriptCheck = `select dpo_item_code from tbl_depot_item where dpo_item_flag = '1' and dpo_code = '${dpo_code}' and itm_code = '${itm_code}';`;
        let tbl_check = await pgConn.get(
          dbPrefix + lic_code,
          scriptCheck,
          config.connectionString(),
        );

        if (!tbl_check.code) {
          if (tbl_check.data.length > 0) {
            duplicateItems.push({ dpo_code, itm_code, message: "ข้อมูลซ้ำ" });
            continue;
          }
        }

        let dpo_item_code = "ditm-" + moment().format("x");
        let scriptInsert = `insert into tbl_depot_item 
                (dpo_item_code, dpo_code, itm_code, dpo_item_flag, ist_dt) values 
                ('${dpo_item_code}', '${dpo_code}', '${itm_code}', '1', '${moment().format("YYYY-MM-DD HH:mm:ss")}');`;

        let tbl_insert = await pgConn.execute(
          dbPrefix + lic_code,
          scriptInsert,
          config.connectionString(),
        );
        if (!tbl_insert.code) {
          successItems.push({ dpo_item_code, dpo_code, itm_code });
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
          "เพิ่มข้อมูลสินค้าคลังสินค้า",
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
        "เพิ่มข้อมูลสินค้าคลังสินค้า",
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
        "เพิ่มข้อมูลสินค้าคลังสินค้า",
        JSON.stringify(req.body[0]),
        "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        _act.value,
      );
    }
    return;
  });
};


exports.getDuplicateItemInDepot = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let { itm_code, dpo_code, action } = req.body[0];

    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      itm_code == undefined ||
      dpo_code == undefined ||
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

      // ====== ตรวจสอบ Array itm_code ======
      let itmCodesArr = Array.isArray(itm_code) ? itm_code : [itm_code];
      // ====== ตรวจสอบว่ามีการเลือก น้ำมันหรือไม่ ======
      if (itmCodesArr.length === 0) {
        let response = [
          {
            status: "success",
            invalid_code: "0",
            message: "กรุณาเลือกรายการน้ำมัน",
            data: [],
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
        res.status(200).send(response);
        return;
      }

      // ====== แปลง Array itm_code เป็น String สำหรับ SQL Query ======
      let itmCodesIn = itmCodesArr.map(code => `'${code}'`).join(", ");

      // =========== Script เช็คน้ำมันว่าตัวไหนบ้างที่มีในคลัง ===========
      let script = `select
                tbl_item.itm_code,
                itm_desc,
                itm_short_desc,
                itm_material_number,
                tbl_depot_item.dpo_item_code
                from tbl_item
                left join tbl_depot_item on tbl_item.itm_code = tbl_depot_item.itm_code 
                    and tbl_depot_item.dpo_code = '${dpo_code}' 
                    and tbl_depot_item.dpo_item_flag = '1'
                where tbl_item.itm_code IN (${itmCodesIn})`;

      let tbl_temporary = await pgConn.get(
        dbPrefix + lic_code,
        script,
        config.connectionString(),
      );


      if (!tbl_temporary.code) {
        let missingItems = [];

        // =========== Loop หาน้ำมันที่ไม่มีในคลัง ===========
        for (let code of itmCodesArr) {
          // ============ เช็คน้ำมันว่าตัวไหนบ้างที่มีในคลัง ===========
          let foundInSystem = tbl_temporary.data.find(item => item.itm_code === code);

          // =========== ถ้าไม่พบข้อมูลในระบบ หรือไม่พบ dpo_item_code ให้ push น้ำมันที่ไม่มีในคลัง ===========
          if (!foundInSystem || !foundInSystem.dpo_item_code) {
            missingItems.push({
              itm_code: code,
              itm_desc: foundInSystem ? foundInSystem.itm_desc : "ไม่พบข้อมูลผลิตภัณฑ์ในระบบ"
            });
          }
        }

        if (missingItems.length > 0) {
          let response = [
            {
              status: "success",
              invalid_code: "1",
              message: "พบรายการน้ำมันที่ไม่มีข้อมูลในคลัง",
              data: missingItems,
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
              message: "รายการน้ำมันทั้งหมดมีข้อมูลอยู่ในคลังแล้ว สามารถดำเนินการต่อได้",
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
            data: xresult,
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ];
        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "ตรวจสอบข้อมูลสินค้าซ้ำในคลังสินค้า",
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
      "ตรวจสอบข้อมูลสินค้าซ้ำในคลังสินค้า",
      JSON.stringify(req.body[0]),
      "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      action[0].value,
    );
    return;
  });
};


// ========= Success =========
exports.getDepotItemByDepots = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let { dpo_code, action } = req.body[0];

    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      dpo_code == undefined ||
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
      let dpoCodeArr = Array.isArray(dpo_code) ? dpo_code : [dpo_code];
      if (dpoCodeArr.length === 0) {
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
      }

      let dpoCodeIn = dpoCodeArr
        .map((c) => `'${c.replace(/'/g, "''")}'`)
        .join(", ");

      let script = `select 
              distinct 
                    tdi.dpo_code,
                    tdi.itm_code,
                    ti.itm_desc,
                    ti.itm_material_number,
                    ti.itm_unit_code
                    from tbl_depot_item tdi
                    left join tbl_item ti on tdi.itm_code = ti.itm_code
                    where tdi.dpo_code in (${dpoCodeIn}) and tdi.dpo_item_flag = '1'
                    order by ti.itm_desc asc;`;

      let tbl_temporary = await pgConn.get(
        dbPrefix + lic_code,
        script,
        config.connectionString(),
      );

      if (!tbl_temporary.code) {
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

