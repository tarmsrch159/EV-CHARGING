const config = require("../../configuration/connection");
const pgConn = require("../../library/pgConnection");
const moment = require("moment");
const xglobal = require("../../middleware/global");

const dbPrefix = config.dbPrefix();


// ข้อมูล Master
exports.getMenuInformation = async (req, res, next) => {
  var xresult = [];
  return (async () => {
    let lic_code = req.header("lic_code");
    if (!req.body || req.body.length === 0) {
      return res.status(200).send([{
        status: "error",
        invalid_code: "-1",
        message: "ข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
    }

    let { menu_code, page_index, page_limit, action } = req.body[0];
    menu_code = menu_code == undefined ? "ALL" : menu_code;
    page_index = parseInt(page_index) || 1;
    page_limit = parseInt(page_limit) || 10;
    if (page_index > 0) page_index -= 1;

    if (lic_code == undefined || action == undefined) {
      return res.status(200).send([{
        status: "error",
        invalid_code: "-1",
        message: "ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
    }

    const database = dbPrefix + lic_code;

    let script = "";
    if (menu_code.toString().toUpperCase() !== "ALL") {
      script = `select menu_code, menu_group, menu_no, menu_desc, menu_parent_code, menu_order, menu_flag, ist_dt, mdf_dt, rm_dt 
                from tbl_menu where menu_flag = '1' and menu_code = '${menu_code}'`;
    } else {
      script = `select menu_code, menu_group, menu_no, menu_desc, menu_parent_code, menu_order, menu_flag, ist_dt, mdf_dt, rm_dt 
                from tbl_menu where menu_flag = '1'`;
    }

    script += ` order by menu_group asc, menu_order asc, menu_no asc`;
    script += ` limit ${page_limit} offset ${page_index * page_limit}`;

    let tbl_temporary = await pgConn.get(database, script, config.connectionString());
    if (!tbl_temporary.code) {
      if (tbl_temporary.data.length > 0) {
        tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/:null/gi, ":\"\""));
        let page_total = 0;
        let rows_total = 0;

        let countScript = "";
        if (menu_code.toString().toUpperCase() !== "ALL") {
          countScript = `select count(*) as rows_total, ceil(count(menu_code)::numeric / ${page_limit}) as page_total 
                         from tbl_menu where menu_flag = '1' and menu_code = '${menu_code}'`;
        } else {
          countScript = `select count(*) as rows_total, ceil(count(menu_code)::numeric / ${page_limit}) as page_total 
                         from tbl_menu where menu_flag = '1'`;
        }

        let tbl_temporary_count = await pgConn.get(database, countScript, config.connectionString());
        if (!tbl_temporary_count.code && tbl_temporary_count.data.length > 0) {
          page_total = parseInt(tbl_temporary_count.data[0].page_total) || 0;
          rows_total = parseInt(tbl_temporary_count.data[0].rows_total) || 0;
        }

        return res.status(200).send([{
          status: "success",
          invalid_code: "0",
          message: "",
          data: tbl_temporary.data,
          page_total: page_total,
          rows_total: rows_total,
          response_time: moment().format("YYYY-MM-DD HH:mm:ss")
        }]);
      } else {
        return res.status(200).send([{
          status: "success",
          invalid_code: "0",
          message: "",
          data: [],
          page_total: 0,
          rows_total: 0,
          response_time: moment().format("YYYY-MM-DD HH:mm:ss")
        }]);
      }
    } else {
      res.status(200).send([{
        status: "error",
        invalid_code: "-3",
        message: "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
      await xglobal.action_logs(lic_code, action[0].id, "ดึงข้อมูลเมนู", JSON.stringify(req.body[0]), "ไม่สามารถดึงข้อมูล", action[0].value);
    }
  })().catch(async (err) => {
    console.log(err);
    res.status(200).send([{
      status: "error",
      invalid_code: "-4",
      message: "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      data: xresult,
      response_time: moment().format("YYYY-MM-DD HH:mm:ss")
    }]);
  });
};

// เพิ่ม Master Menu
exports.addMenuInformation = async (req, res, next) => {
  var xresult = [];
  return (async () => {
    let lic_code = req.header("lic_code");
    if (!req.body || req.body.length === 0) {
      return res.status(200).send([{
        status: "error",
        invalid_code: "-1",
        message: "ข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
    }

    let { menu_group, menu_no, menu_desc, menu_parent_code, menu_order, action } = req.body[0];
    if (menu_group == undefined || menu_no == undefined || menu_desc == undefined || menu_order == undefined || lic_code == undefined || action == undefined) {
      return res.status(200).send([{
        status: "error",
        invalid_code: "-1",
        message: "ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
    }

    const database = dbPrefix + lic_code;

    // PK Format Fot Master Data
    const dateStr = moment().format("YYYYMMDD");
    const randStr = Math.floor(1000000 + Math.random() * 9000000).toString();
    const new_menu_code = `menu-${dateStr}${randStr}`;

    const parentCodeVal = menu_parent_code ? `'${menu_parent_code}'` : "NULL";

    let insertScript = `insert into tbl_menu (menu_code, menu_group, menu_no, menu_desc, menu_parent_code, menu_order, menu_flag, ist_dt) 
                        values ('${new_menu_code}', ${parseInt(menu_group)}, '${menu_no}', '${menu_desc}', ${parentCodeVal}, ${parseInt(menu_order)}, '1', '${moment().format("YYYY-MM-DD HH:mm:ss")}')`;

    let executeRes = await pgConn.execute(database, insertScript, config.connectionString());
    if (!executeRes.code) {
      res.status(200).send([{
        status: "success",
        invalid_code: "0",
        message: "บันทึกข้อมูลเมนูสำเร็จ",
        data: [{ menu_code: new_menu_code }],
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
      await xglobal.action_logs(lic_code, action[0].id, "เพิ่มข้อมูลเมนู", JSON.stringify(req.body[0]), "success", action[0].value);
    } else {
      res.status(200).send([{
        status: "error",
        invalid_code: "-3",
        message: "ไม่สามารถบันทึกข้อมูล, กรุณาลองใหม่อีกครั้ง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
      await xglobal.action_logs(lic_code, action[0].id, "เพิ่มข้อมูลเมนู", JSON.stringify(req.body[0]), "ไม่สามารถบันทึกข้อมูล", action[0].value);
    }
  })().catch(async (err) => {
    console.log(err);
    res.status(200).send([{
      status: "error",
      invalid_code: "-4",
      message: "ไม่สามารถบันทึกข้อมูล, กรุณาลองใหม่อีกครั้ง",
      data: xresult,
      response_time: moment().format("YYYY-MM-DD HH:mm:ss")
    }]);
  });
};

// แก้ไข master menu
exports.setMenuInformation = async (req, res, next) => {
  var xresult = [];
  return (async () => {
    let lic_code = req.header("lic_code");
    if (!req.body || req.body.length === 0) {
      return res.status(200).send([{
        status: "error",
        invalid_code: "-1",
        message: "ข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
    }

    let { menu_code, menu_group, menu_no, menu_desc, menu_parent_code, menu_order, menu_flag, action } = req.body[0];
    if (menu_code == undefined || menu_group == undefined || menu_no == undefined || menu_desc == undefined || menu_order == undefined || lic_code == undefined || action == undefined) {
      return res.status(200).send([{
        status: "error",
        invalid_code: "-1",
        message: "ไม่สามารถแก้ไขข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
    }

    const database = dbPrefix + lic_code;

    const parentCodeVal = menu_parent_code ? `'${menu_parent_code}'` : "NULL";
    const flagVal = menu_flag == undefined ? "1" : menu_flag;

    let updateScript = `update tbl_menu 
                        set menu_group = ${parseInt(menu_group)}, 
                            menu_no = '${menu_no}', 
                            menu_desc = '${menu_desc}', 
                            menu_parent_code = ${parentCodeVal}, 
                            menu_order = ${parseInt(menu_order)}, 
                            menu_flag = '${flagVal}', 
                            mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}'
                        where menu_code = '${menu_code}'`;

    let executeRes = await pgConn.execute(database, updateScript, config.connectionString());
    if (!executeRes.code) {
      res.status(200).send([{
        status: "success",
        invalid_code: "0",
        message: "แก้ไขข้อมูลเมนูสำเร็จ",
        data: [{ menu_code: menu_code }],
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
      await xglobal.action_logs(lic_code, action[0].id, "แก้ไขข้อมูลเมนู", JSON.stringify(req.body[0]), "success", action[0].value);
    } else {
      res.status(200).send([{
        status: "error",
        invalid_code: "-3",
        message: "ไม่สามารถแก้ไขข้อมูล, กรุณาลองใหม่อีกครั้ง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
      await xglobal.action_logs(lic_code, action[0].id, "แก้ไขข้อมูลเมนู", JSON.stringify(req.body[0]), "ไม่สามารถแก้ไขข้อมูล", action[0].value);
    }
  })().catch(async (err) => {
    console.log(err);
    res.status(200).send([{
      status: "error",
      invalid_code: "-4",
      message: "ไม่สามารถแก้ไขข้อมูล, กรุณาลองใหม่อีกครั้ง",
      data: xresult,
      response_time: moment().format("YYYY-MM-DD HH:mm:ss")
    }]);
  });
};

// ลบ master menu [Soft delete]
exports.removeMenu = async (req, res, next) => {
  var xresult = [];
  return (async () => {
    let lic_code = req.header("lic_code");
    if (!req.body || req.body.length === 0) {
      return res.status(200).send([{
        status: "error",
        invalid_code: "-1",
        message: "ข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
    }

    let { menu_code, action } = req.body[0];
    if (menu_code == undefined || lic_code == undefined || action == undefined) {
      return res.status(200).send([{
        status: "error",
        invalid_code: "-1",
        message: "ไม่สามารถลบข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
    }

    const database = dbPrefix + lic_code;


    let deleteScript = `update tbl_menu 
                        set menu_flag = '0', 
                            rm_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}'
                        where menu_code = '${menu_code}'`;

    let executeRes = await pgConn.execute(database, deleteScript, config.connectionString());
    if (!executeRes.code) {
      res.status(200).send([{
        status: "success",
        invalid_code: "0",
        message: "ลบข้อมูลเมนูสำเร็จ",
        data: [{ menu_code: menu_code }],
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
      await xglobal.action_logs(lic_code, action[0].id, "ลบข้อมูลเมนู", JSON.stringify(req.body[0]), "success", action[0].value);
    } else {
      res.status(200).send([{
        status: "error",
        invalid_code: "-3",
        message: "ไม่สามารถลบข้อมูล, กรุณาลองใหม่อีกครั้ง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
      await xglobal.action_logs(lic_code, action[0].id, "ลบข้อมูลเมนู", JSON.stringify(req.body[0]), "ไม่สามารถลบข้อมูล", action[0].value);
    }
  })().catch(async (err) => {
    console.log(err);
    res.status(200).send([{
      status: "error",
      invalid_code: "-4",
      message: "ไม่สามารถลบข้อมูล, กรุณาลองใหม่อีกครั้ง",
      data: xresult,
      response_time: moment().format("YYYY-MM-DD HH:mm:ss")
    }]);
  });
};

// ==========================================
// menu permission
// ==========================================

// ข้อมูล menu permission
exports.getMenuPermissionInformation = async (req, res, next) => {
  var xresult = [];
  return (async () => {
    let lic_code = req.header("lic_code");
    if (!req.body || req.body.length === 0) {
      return res.status(200).send([{
        status: "error",
        invalid_code: "-1",
        message: "ข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
    }

    let { emp_role_code, page_index, page_limit, action } = req.body[0];
    emp_role_code = emp_role_code == undefined ? "ALL" : emp_role_code;
    page_index = parseInt(page_index) || 1;
    page_limit = parseInt(page_limit) || 10;
    if (page_index > 0) page_index -= 1;

    if (lic_code == undefined || action == undefined) {
      return res.status(200).send([{
        status: "error",
        invalid_code: "-1",
        message: "ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
    }

    const database = dbPrefix + lic_code;

    let script = `select tmp.emp_role_code, ter.emp_role_desc, tmp.menu_code, tm.menu_desc, tm.menu_group, tm.menu_no, tmp.display, tmp.edit, tmp.create_perm, tmp.delete_perm, tmp.ist_dt, tmp.mdf_dt
                  from tbl_menu_permission tmp
                  inner join tbl_menu tm on tmp.menu_code = tm.menu_code
                  inner join tbl_employee_role ter on tmp.emp_role_code = ter.emp_role_code
                  where tm.menu_flag = '1' and tmp.rm_dt is null`;

    if (emp_role_code.toString().toUpperCase() !== "ALL") {
      script += ` and tmp.emp_role_code = '${emp_role_code}'`;
    }

    script += ` order by tmp.emp_role_code asc, tm.menu_group asc, tm.menu_order asc, tm.menu_no asc`;
    script += ` limit ${page_limit} offset ${page_index * page_limit}`;

    let tbl_temporary = await pgConn.get(database, script, config.connectionString());
    if (!tbl_temporary.code) {
      if (tbl_temporary.data.length > 0) {
        tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/:null/gi, ":\"\""));
        let page_total = 0;
        let rows_total = 0;

        let countScript = `select count(*) as rows_total, ceil(count(tmp.menu_code)::numeric / ${page_limit}) as page_total 
                           from tbl_menu_permission tmp
                           inner join tbl_menu tm on tmp.menu_code = tm.menu_code
                           where tm.menu_flag = '1' and tmp.rm_dt is null`;

        if (emp_role_code.toString().toUpperCase() !== "ALL") {
          countScript += ` and tmp.emp_role_code = '${emp_role_code}'`;
        }

        let tbl_temporary_count = await pgConn.get(database, countScript, config.connectionString());
        if (!tbl_temporary_count.code && tbl_temporary_count.data.length > 0) {
          page_total = parseInt(tbl_temporary_count.data[0].page_total) || 0;
          rows_total = parseInt(tbl_temporary_count.data[0].rows_total) || 0;
        }

        return res.status(200).send([{
          status: "success",
          invalid_code: "0",
          message: "",
          data: tbl_temporary.data,
          page_total: page_total,
          rows_total: rows_total,
          response_time: moment().format("YYYY-MM-DD HH:mm:ss")
        }]);
      } else {
        return res.status(200).send([{
          status: "success",
          invalid_code: "0",
          message: "",
          data: [],
          page_total: 0,
          rows_total: 0,
          response_time: moment().format("YYYY-MM-DD HH:mm:ss")
        }]);
      }
    } else {
      res.status(200).send([{
        status: "error",
        invalid_code: "-3",
        message: "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
      await xglobal.action_logs(lic_code, action[0].id, "ดึงข้อมูลสิทธิ์การใช้งานเมนู", JSON.stringify(req.body[0]), "ไม่สามารถดึงข้อมูล", action[0].value);
    }
  })().catch(async (err) => {
    console.log(err);
    res.status(200).send([{
      status: "error",
      invalid_code: "-4",
      message: "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      data: xresult,
      response_time: moment().format("YYYY-MM-DD HH:mm:ss")
    }]);
  });
};

// เพิ่ม menu permission
exports.addMenuPermissionInformation = async (req, res, next) => {
  var xresult = [];
  return (async () => {
    let lic_code = req.header("lic_code");
    if (!req.body || req.body.length === 0) {
      return res.status(200).send([{
        status: "error",
        invalid_code: "-1",
        message: "ข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
    }

    let { emp_role_code, menu_code, display, edit, create_perm, delete_perm, action } = req.body[0];
    if (emp_role_code == undefined || menu_code == undefined || display == undefined || edit == undefined || lic_code == undefined || action == undefined) {
      return res.status(200).send([{
        status: "error",
        invalid_code: "-1",
        message: "ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
    }

    const database = dbPrefix + lic_code;
    // เช็คว่าroleมี permission รึยัง
    let checkScript = `select emp_role_code, menu_code from tbl_menu_permission 
                       where emp_role_code = '${emp_role_code}' and menu_code = '${menu_code}'`;
    let checkRes = await pgConn.get(database, checkScript, config.connectionString());

    let executeScript = "";
    if (!checkRes.code && checkRes.data.length > 0) {
      executeScript = `update tbl_menu_permission 
                       set display = '${display || 0}', 
                           edit = '${edit || 0}', 
                           create_perm = '${create_perm || 0}',
                           delete_perm = '${delete_perm || 0}',
                           mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}',
                           rm_dt = null
                       where emp_role_code = '${emp_role_code}' and menu_code = '${menu_code}'`;
    } else {
      executeScript = `insert into tbl_menu_permission (emp_role_code, menu_code, display, edit, create_perm, delete_perm, ist_dt) 
                       values ('${emp_role_code}', '${menu_code}', '${display || 0}', '${edit || 0}','${create_perm || 0}', '${delete_perm || 0}', '${moment().format("YYYY-MM-DD HH:mm:ss")}')`;
    }

    let executeRes = await pgConn.execute(database, executeScript, config.connectionString());
    if (!executeRes.code) {
      res.status(200).send([{
        status: "success",
        invalid_code: "0",
        message: "บันทึกสิทธิ์การใช้งานเมนูสำเร็จ",
        data: [{ emp_role_code: emp_role_code, menu_code: menu_code }],
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
      await xglobal.action_logs(lic_code, action[0].id, "เพิ่ม/แก้ไขสิทธิ์การใช้งานเมนู", JSON.stringify(req.body[0]), "success", action[0].value);
    } else {
      res.status(200).send([{
        status: "error",
        invalid_code: "-3",
        message: "ไม่สามารถบันทึกข้อมูล, กรุณาลองใหม่อีกครั้ง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
      await xglobal.action_logs(lic_code, action[0].id, "เพิ่ม/แก้ไขสิทธิ์การใช้งานเมนู", JSON.stringify(req.body[0]), "ไม่สามารถบันทึกข้อมูล", action[0].value);
    }
  })().catch(async (err) => {
    console.log(err);
    res.status(200).send([{
      status: "error",
      invalid_code: "-4",
      message: "ไม่สามารถบันทึกข้อมูล, กรุณาลองใหม่อีกครั้ง",
      data: xresult,
      response_time: moment().format("YYYY-MM-DD HH:mm:ss")
    }]);
  });
};

// แก้ไข menu permission
exports.setMenuPermissionInformation = async (req, res, next) => {
  var xresult = [];
  return (async () => {
    let lic_code = req.header("lic_code");
    if (!req.body || req.body.length === 0) {
      return xglobal.sendResponse(res, "error", "-1", "ข้อมูลพารามิเตอร์ไม่ถูกต้อง");
    }

    const { menu, action } = req.body[0]
    const database = dbPrefix + lic_code;
    const items = Array.isArray(menu) ? menu : [menu];
    const updatedItems = [];
    let hasError = false;
    let errorMessage = "";

    // for loop update menu permission
    for (const item of items) {
      let { emp_role_code, menu_code, display, edit, create_perm, delete_perm } = item;

      if (emp_role_code == undefined || menu_code == undefined || display == undefined || edit == undefined || lic_code == undefined || action == undefined) {
        hasError = true;
        errorMessage = "ข้อมูลพารามิเตอร์ไม่ถูกต้อง";
        continue;
      }

      // convert edit and delete when there's editing menu 1.2 and 1.3 to -1
      let finalEdit = edit;
      let finalDelete = delete_perm;

      let menuCheckScript = `select menu_no from tbl_menu where menu_code = '${menu_code}'`;
      let menuCheckRes = await pgConn.get(database, menuCheckScript, config.connectionString());
      if (!menuCheckRes.code && menuCheckRes.data.length > 0) {
        let menuNo = menuCheckRes.data[0].menu_no;
        if (menuNo === '1.2' || menuNo === '1.3') {
          finalEdit = -1;
          finalDelete = -1;
        }
      }

      console.log(finalDelete)
      console.log(finalEdit)

      // update main menu permission
      let updateScript = `update tbl_menu_permission 
                          set display = '${display || 0}', 
                              edit = '${finalEdit}', 
                              create_perm = '${create_perm || 0}', 
                              delete_perm = '${finalDelete}', 
                              mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}',
                              rm_dt = null
                          where emp_role_code = '${emp_role_code}' and menu_code = '${menu_code}'`;
      console.log(updateScript)
      let executeRes = await pgConn.execute(database, updateScript, config.connectionString());
      if (!executeRes.code) {
        updatedItems.push({ emp_role_code, menu_code });
        await xglobal.action_logs(lic_code, action[0].id, "แก้ไขสิทธิ์การใช้งานเมนู", JSON.stringify(item), "success", action[0].value);

        // enable main menu then children menu are enabled
        if (display === 1 || display === '1') {
          // enable children menu || except 1.2 and 1.3 will go to -1 status
          let enableChildrenScript = `update tbl_menu_permission 
                                       set display = 1, 
                                           edit = case 
                                                    when menu_code in (select menu_code from tbl_menu where menu_no in ('1.2', '1.3')) then -1 
                                                    else 0
                                                  end, 
                                           create_perm = 0, 
                                           delete_perm = case 
                                                           when menu_code in (select menu_code from tbl_menu where menu_no in ('1.2', '1.3')) then -1 
                                                           else 0 
                                                         end, 
                                           mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}'
                                       where emp_role_code = '${emp_role_code}' 
                                         and menu_code in (
                                           select menu_code from tbl_menu where menu_parent_code = '${menu_code}'
                                         )`;
          await pgConn.execute(database, enableChildrenScript, config.connectionString());

          // enable main menu in ('4', '5')
          let enableParentScript = `update tbl_menu_permission 
                                     set display = 1, 
                                         edit = -1, 
                                         create_perm = -1, 
                                         delete_perm = -1, 
                                         mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}'
                                     where emp_role_code = '${emp_role_code}' 
                                       and menu_code in (
                                         select menu_parent_code from tbl_menu 
                                         where menu_code = '${menu_code}' 
                                           and menu_parent_code in (
                                             select menu_code from tbl_menu where menu_no in ('4', '5')
                                           )
                                       )`;
          await pgConn.execute(database, enableParentScript, config.connectionString());
        }

        // disable main menu then children menu are disabled
        if (display === 0 || display === '0') {

          let disableChildrenScript = `update tbl_menu_permission 
                                       set display = 0, 
                                           edit = case 
                                                    when menu_code in (select menu_code from tbl_menu where menu_no in ('1.2', '1.3')) then -1 
                                                    else 0 
                                                  end, 
                                           create_perm = 0, 
                                           delete_perm = case 
                                                           when menu_code in (select menu_code from tbl_menu where menu_no in ('1.2', '1.3')) then -1 
                                                           else 0
                                                         end, 
                                           mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}'
                                       where emp_role_code = '${emp_role_code}' 
                                         and menu_code in (
                                           select menu_code from tbl_menu where menu_parent_code = '${menu_code}'
                                         )`;
          await pgConn.execute(database, disableChildrenScript, config.connectionString());

          // disable main menu in ('4', '5')
          let disableParentScript = `update tbl_menu_permission 
                                     set display = 0, 
                                         edit = -1, 
                                         create_perm = -1, 
                                         delete_perm = -1, 
                                         mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}'
                                     where emp_role_code = '${emp_role_code}' 
                                       and menu_code in (
                                         select menu_parent_code from tbl_menu 
                                         where menu_code = '${menu_code}' 
                                           and menu_parent_code in (
                                             select menu_code from tbl_menu where menu_no in ('4', '5')
                                           )
                                       )`;
          await pgConn.execute(database, disableParentScript, config.connectionString());
        }

      } else {
        hasError = true;
        errorMessage = "ไม่สามารถแก้ไขข้อมูลได้ทั้งหมด, กรุณาลองใหม่อีกครั้ง";
      }
    }

    if (hasError && updatedItems.length === 0) {
      return xglobal.sendResponse(res, "error", "-3", errorMessage || "ไม่สามารถแก้ไขข้อมูล, กรุณาลองใหม่อีกครั้ง");
    }

    return xglobal.sendResponse(res, "success", "0", "แก้ไขสิทธิ์การใช้งานเมนูสำเร็จ", updatedItems);
  })().catch(async (err) => {
    console.log(err);
    return xglobal.sendResponse(res, "error", "-4", xresult, "ไม่สามารถแก้ไขข้อมูล, กรุณาลองใหม่อีกครั้ง");
  });
};




// ลบ menu permission [Soft delete]
exports.removeMenuPermission = async (req, res, next) => {
  var xresult = [];
  return (async () => {
    let lic_code = req.header("lic_code");
    if (!req.body || req.body.length === 0) {
      return res.status(200).send([{
        status: "error",
        invalid_code: "-1",
        message: "ข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
    }

    let { emp_role_code, menu_code, action } = req.body[0];
    if (emp_role_code == undefined || menu_code == undefined || lic_code == undefined || action == undefined) {
      return res.status(200).send([{
        status: "error",
        invalid_code: "-1",
        message: "ไม่สามารถลบข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
    }

    const database = dbPrefix + lic_code;

    let deleteScript = `update tbl_menu_permission 
                        set rm_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}'
                        where emp_role_code = '${emp_role_code}' and menu_code = '${menu_code}'`;

    let executeRes = await pgConn.execute(database, deleteScript, config.connectionString());
    if (!executeRes.code) {
      res.status(200).send([{
        status: "success",
        invalid_code: "0",
        message: "ลบสิทธิ์การใช้งานเมนูสำเร็จ",
        data: [{ emp_role_code: emp_role_code, menu_code: menu_code }],
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
      await xglobal.action_logs(lic_code, action[0].id, "ลบสิทธิ์การใช้งานเมนู", JSON.stringify(req.body[0]), "success", action[0].value);
    } else {
      res.status(200).send([{
        status: "error",
        invalid_code: "-3",
        message: "ไม่สามารถลบข้อมูล, กรุณาลองใหม่อีกครั้ง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
      await xglobal.action_logs(lic_code, action[0].id, "ลบสิทธิ์การใช้งานเมนู", JSON.stringify(req.body[0]), "ไม่สามารถลบข้อมูล", action[0].value);
    }
  })().catch(async (err) => {
    console.log(err);
    res.status(200).send([{
      status: "error",
      invalid_code: "-4",
      message: "ไม่สามารถลบข้อมูล, กรุณาลองใหม่อีกครั้ง",
      data: xresult,
      response_time: moment().format("YYYY-MM-DD HH:mm:ss")
    }]);
  });
};

// ดึงสิทธิ์ทั้งหมดของแต่ละ role ที่เลือกมาสำหรับให้หน้าบ้านเช็คเพื่อกำหนด permission ในการเข้าใช้งานหน้าเว็บ
exports.getMenuPermissionCheck = async (req, res, next) => {
  var xresult = [];
  return (async () => {
    let lic_code = req.header("lic_code");
    if (!req.body || req.body.length === 0) {
      return res.status(200).send([{
        status: "error",
        invalid_code: "-1",
        message: "ข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
    }

    let { emp_role_code, action } = req.body[0];
    if (emp_role_code == undefined || lic_code == undefined || action == undefined) {
      return res.status(200).send([{
        status: "error",
        invalid_code: "-1",
        message: "ไม่สามารถตรวจสอบสิทธิ์ได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
    }

    const database = dbPrefix + lic_code;
    let script = `select tm.menu_no, tm.menu_code, tm.menu_desc, tm.menu_group, tm.menu_parent_code, tmp.display, tmp.edit, tmp.create_perm, tmp.delete_perm, tmp.emp_role_code
                  from tbl_menu_permission tmp
                  inner join tbl_menu tm on tmp.menu_code = tm.menu_code
                  where tm.menu_flag = '1' and tmp.rm_dt is null`;

    if (emp_role_code.toString().toUpperCase() !== "ALL") {
      script += ` and tmp.emp_role_code = '${emp_role_code}'`;
    }
    script += ` order by tm.menu_group asc, tm.menu_order asc, tm.menu_no asc`;

    let tbl_temporary = await pgConn.get(database, script, config.connectionString());
    if (!tbl_temporary.code) {
      // group permission role
      const groupPermissions = (rows) => {
        const allItems = rows.map(row => ({
          menu_code: row.menu_code,
          menu_no: row.menu_no,
          menu_desc: row.menu_desc,
          menu_group: row.menu_group,
          menu_parent_code: row.menu_parent_code || null,
          display: row.display,
          edit: row.edit,
          create_perm: row.create_perm,
          delete_perm: row.delete_perm
        }));

        const parentMap = {};
        const parents = [];
        const children = [];

        // map parent code and children
        allItems.forEach(item => {
          if (!item.menu_parent_code) {
            item.children = [];
            parentMap[item.menu_code] = item;
            parents.push(item);
          } else {
            children.push(item);
          }
        });
        // map children code
        children.forEach(child => {
          const parent = parentMap[child.menu_parent_code];
          if (parent) {
            parent.children.push(child);
          } else {
            child.children = [];
            parents.push(child);
            parentMap[child.menu_code] = child;
          }
        });

        return parents;
      };

      let responseData;
      if (emp_role_code.toString().toUpperCase() === "ALL") {
        const roleGroups = {};
        tbl_temporary.data.forEach(row => {
          roleGroups[row.emp_role_code] = roleGroups[row.emp_role_code] || [];
          roleGroups[row.emp_role_code].push(row);
        });

        responseData = {};
        for (const role in roleGroups) {
          responseData[role] = groupPermissions(roleGroups[role]);
        }
      } else {
        responseData = groupPermissions(tbl_temporary.data);
      }

      return res.status(200).send([{
        status: "success",
        invalid_code: "0",
        message: "",
        emp_role_code: emp_role_code,
        data: responseData,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
    } else {
      res.status(200).send([{
        status: "error",
        invalid_code: "-3",
        message: "ไม่สามารถตรวจสอบสิทธิ์, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss")
      }]);
      await xglobal.action_logs(lic_code, action[0].id, "ตรวจสอบสิทธิ์การใช้งานเมนู", JSON.stringify(req.body[0]), "ไม่สามารถดึงข้อมูล", action[0].value);
    }
  })().catch(async (err) => {
    console.log(err);
    res.status(200).send([{
      status: "error",
      invalid_code: "-4",
      message: "ไม่สามารถตรวจสอบสิทธิ์, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      data: xresult,
      response_time: moment().format("YYYY-MM-DD HH:mm:ss")
    }]);
  });
};
