const config = require("../../configuration/connection");
const pgConn = require("../../library/pgConnection");
const moment = require("moment");
const xglobal = require("../../middleware/global");
const xapikey = `1-qFLg-ltaUmdvGikk4MTxxTYLbNNtB5igcGRmVcJsc`;
const axios = require("axios");

const dbPrefix = config.dbPrefix();

axios.defaults.timeout = 60000; // Sets a global timeout of 5 seconds (60 econds)

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
exports.removeManageItem = async (req, res, next) => {

  return (async () => {

    let lic_code = req.header('lic_code');
    let { ord_code, itm_code, ptrl_tank_code, item_quantity, action } = req.body[0];
    //เช็คเฉพาะส่วนที่สำคัญ
    if (ord_code == undefined || itm_code == undefined || ptrl_tank_code == undefined || item_quantity == undefined || lic_code == undefined || action == undefined) {
      let response = [{
        status: 'error',
        invalid_code: '-1',
        message: 'ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
        data: [],
        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
      }]

      res.status(200).send(response);
    } else {

      let script = ``;


      if (ptrl_tank_code == '') {
        script = `delete from tbl_order_petrol where itm_code = '${itm_code}' 
      and ord_code = '${ord_code}' and (ptrl_tank_code = '${ptrl_tank_code}' or ptrl_tank_code is null)`
        await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
      }
      else {
        script = `delete from tbl_order_petrol where itm_code = '${itm_code}' 
      and ord_code = '${ord_code}' and ptrl_tank_code = '${ptrl_tank_code}'`
        await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
      }

      if (ptrl_tank_code == '') {
        script = `delete from tbl_order_item where itm_code = '${itm_code}' 
        and ord_code = '${ord_code}' and (ptrl_tank_code = '${ptrl_tank_code}' or ptrl_tank_code is null)`
        await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
      }
      else {
        script = `delete from tbl_order_item where itm_code = '${itm_code}' 
        and ord_code = '${ord_code}' and ptrl_tank_code = '${ptrl_tank_code}'`
        await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
      }

      if (ptrl_tank_code == '') {
        script = `delete from tbl_order_compartment where itm_code = '${itm_code}' 
        and ord_code = '${ord_code}' and (ptrl_tank_code = '${ptrl_tank_code}' or ptrl_tank_code is null)`
        await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
      }
      else {
        script = `delete from tbl_order_compartment where itm_code = '${itm_code}' 
        and ord_code = '${ord_code}' and ptrl_tank_code = '${ptrl_tank_code}'`
        await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
      }

      if (ptrl_tank_code == '') {
        script = `delete from tbl_order_close where itm_code = '${itm_code}' 
      and ord_code = '${ord_code}' and (ptrl_tank_code = '${ptrl_tank_code}' or ptrl_tank_code is null)`
        await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
      }
      else {
        script = `delete from tbl_order_close where itm_code = '${itm_code}' 
      and ord_code = '${ord_code}' and ptrl_tank_code = '${ptrl_tank_code}'`
        await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
      }


      script = `delete from tbl_order_depot where itm_code = '${itm_code}' 
      and ord_code = '${ord_code}' and item_quantity = ${item_quantity}`
      let tbl_order_depot = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
      if (!tbl_order_depot.code) {

        script = `update tbl_order 
        set item_count = (select count(itm_code) from tbl_order_item where ord_code = '${ord_code}' and ord_item_flag = '1'),
        item_quantity = (select sum(item_quantity) from tbl_order_item where ord_code = '${ord_code}' and ord_item_flag = '1'), 
        loading_count = (select count(distinct dpo_code) from tbl_order_depot where ord_code = '${ord_code}' and ord_depot_flag = '1'),
        unloading_count = (select count(distinct ptrl_code) from tbl_order_petrol where ord_code = '${ord_code}' and ord_petrol_flag = '1')
        where ord_code = '${ord_code}'`

        let tbl_order = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
        if (!tbl_order.code) {
          let response = [{
            status: 'success',
            invalid_code: '0',
            message: '',
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
          }]

          res.status(200).send(response);
          await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลสินค้า', JSON.stringify(req.body[0]), 'success', action[0].value);
          return;
        }
        else {
          let response = [{
            status: 'error',
            invalid_code: '-3',
            message: `ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
          }]
          res.status(200).send(response);
          await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลสินค้า', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
          return;
        }

      } else {
        let response = [{
          status: 'error',
          invalid_code: '-3',
          message: `ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
          data: [],
          response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }]
        res.status(200).send(response);
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลสินค้า', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
      }
    }

  })().catch(async (err) => {
    console.log(err);
    let response = [{
      status: 'error',
      invalid_code: '-4',
      message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
      data: [],
      response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
    }]
    res.status(200).send(response);
    await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลสินค้า', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
    return;
  });

}


exports.getVehicleForManageOrder = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let {
      veh_group_code,
      selectedDate,
      off_code,
      action
    } = req.body[0];
    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      veh_group_code == undefined ||
      selectedDate == undefined ||
      off_code == undefined ||
      lic_code == undefined ||
      action == undefined
    ) {
      let response = [{
        status: "error",
        invalid_code: "-1",
        message: "ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
      },];

      res.status(200).send(response);
    } else {
      let script = ``;
      script = `select
      veh_code, veh_number, veh_license_number, veh_license_province, veh_type_code, veh_type_desc, veh_status, veh_group_code, veh_blackbox_number,
      veh_brand, veh_model, veh_tank_material, veh_loading_system, veh_maximum_compartment, veh_capacity_in_compartment, veh_tare_weight,
      veh_gross_weight, veh_tank_width, veh_tank_length, veh_tank_height, veh_tank_capacity, veh_maximum_capacity, veh_discharge_sequence, veh_option_pump,
      veh_option_doeb, veh_option_m12, veh_option_ivms, veh_option_afdd, veh_registration_starting_date, veh_registration_expire_date, veh_registration_remark,
      veh_support_product, veh_sticker, veh_braking_system, veh_service_life, veh_flag, veh_image, veh_sub_license_number, veh_sub_license_province, veh_sub_brand,
      veh_sub_model, veh_sub_registration_starting_date, veh_sub_registration_expire_date, veh_sub_registration_remark, veh_sub_service_life, veh_sub_braking_system,
      veh_sub_image, ist_dt, mdf_dt, rm_dt, off_code, veh_support_climb_mountain, veh_maximum_distance, veh_minimum_distance, veh_maximum_jobs, veh_remark, veh_group_desc,
      veh_group_flag, off_code, off_desc, off_desc_en, off_number, off_address, off_tamb_code, off_amph_code, off_prov_code, off_latitude, off_longitude, off_area, off_flag,
      case when count_compartment <= 0 then '0' when count_compartment_level <= 0 then '0' else status_vehicle end as status_vehicle, case when count_compartment <= 0
      then 'ไม่พบข้อมูลช่องน้ำมัน' when count_compartment_level <= 0 then 'ไม่พบข้อมูลระดับน้ำมัน' else reason_vehicle end as reason_vehicle,
      veh_unavailable_status, veh_unavailable_type_desc, count_compartment, count_compartment_level, veh_start_dt, veh_end_dt

      from
      (select
      vh.veh_code, vh.veh_number, vh.veh_license_number, vh.veh_license_province, vh.veh_type_code, vht.veh_type_desc, vh.veh_status, vh.veh_group_code, veh_blackbox_number, veh_brand, veh_model, veh_tank_material,
      veh_loading_system, veh_maximum_compartment, veh_capacity_in_compartment, veh_tare_weight, veh_gross_weight, veh_tank_width, veh_tank_length,
      veh_tank_height, veh_tank_capacity, veh_maximum_capacity, veh_discharge_sequence, veh_option_pump, veh_option_doeb, veh_option_m12, veh_option_ivms,
      veh_option_afdd, veh_registration_starting_date, veh_registration_expire_date, veh_registration_remark, veh_support_product, veh_sticker, veh_braking_system,
      veh_service_life, veh_flag, veh_image, veh_sub_license_number, veh_sub_license_province, veh_sub_brand, veh_sub_model, veh_sub_registration_starting_date,
      veh_sub_registration_expire_date, veh_sub_registration_remark, veh_sub_service_life, veh_sub_braking_system, veh_sub_image,
      vh.ist_dt, vh.mdf_dt, vh.rm_dt, veh_support_climb_mountain, veh_maximum_distance, veh_minimum_distance, veh_maximum_jobs, veh_remark, veh_group_desc, veh_group_flag,
      vh.off_code, off_desc, off_desc_en, off_number, off_address, off_tamb_code, off_amph_code, off_prov_code, off_latitude, off_longitude, off_area,
      off_flag, COALESCE((
      SELECT veh_unavailable_code
      FROM tbl_vehicle_unavailable
      WHERE veh_code = vh.veh_code
      AND veh_unavailable_date = '${selectedDate}' and veh_unavailable_flag = '1' limit 1), '-') AS status_vehicle
      ,COALESCE((select  CONCAT('ไม่พร้อมรับงาน','') from tbl_vehicle_unavailable where veh_code = vh.veh_code
      and veh_unavailable_date = '${selectedDate}' and veh_unavailable_flag = '1' limit 1), 'พร้อมรับงาน')  as reason_vehicle
      , (select veh_unavailable_status from tbl_vehicle_unavailable where veh_code = vh.veh_code and veh_unavailable_date = '${selectedDate}' and veh_unavailable_flag = '1' limit 1) as veh_unavailable_status
      , (select veh_unavailable_type_desc from tbl_vehicle_unavailable vhu left join tbl_vehicle_unavailable_type vhut
      on vhu.veh_unavailable_type_code = vhut.veh_unavailable_type_code where vhu.veh_code = vh.veh_code and veh_unavailable_date = '${selectedDate}' and veh_unavailable_flag = '1' limit 1) as veh_unavailable_type_desc,
      count(tbl_vehicle_compartment.veh_compartment_code) as count_compartment, count(tbl_vehicle_compartment_level.veh_compartment_level_code) as count_compartment_level,
      case when vh.veh_start_dt is null then '07:00:00' else vh.veh_start_dt end as veh_start_dt,
      case when vh.veh_end_dt is null then '18:00:00' else vh.veh_end_dt end as veh_end_dt
      from  tbl_vehicle vh left join tbl_vehicle_group vg on vh.veh_group_code = vg.veh_group_code
      left join tbl_vehicle_compartment on vh.veh_code = tbl_vehicle_compartment.veh_code
      left join tbl_vehicle_compartment_level on tbl_vehicle_compartment.veh_compartment_code = tbl_vehicle_compartment_level.veh_compartment_code
      left join tbl_office o on vh.off_code = o.off_code 
      left join tbl_vehicle_type vht on vh.veh_type_code = vht.veh_type_code
      where  vh.veh_flag = '1'

      group by vh.veh_code, vh.veh_number, vh.veh_license_number, vh.veh_license_province, vh.veh_type_code, vht.veh_type_desc, vh.veh_status, vh.veh_group_code, veh_blackbox_number, veh_brand, veh_model, veh_tank_material,
      veh_loading_system, veh_maximum_compartment, veh_capacity_in_compartment, veh_tare_weight, veh_gross_weight, veh_tank_width, veh_tank_length,
      veh_tank_height, veh_tank_capacity, veh_maximum_capacity, veh_discharge_sequence, veh_option_pump, veh_option_doeb, veh_option_m12, veh_option_ivms,
      veh_option_afdd, veh_registration_starting_date, veh_registration_expire_date, veh_registration_remark, veh_support_product, veh_sticker, veh_braking_system,
      veh_service_life, veh_flag, veh_image, veh_sub_license_number, veh_sub_license_province, veh_sub_brand, veh_sub_model, veh_sub_registration_starting_date,
      veh_sub_registration_expire_date, veh_sub_registration_remark, veh_sub_service_life, veh_sub_braking_system, veh_sub_image,
      vh.ist_dt, vh.mdf_dt, vh.rm_dt, veh_support_climb_mountain, veh_maximum_distance, veh_minimum_distance, veh_maximum_jobs, veh_remark, veh_group_desc, veh_group_flag,
      vh.off_code, off_desc, off_desc_en, off_number, off_address, off_tamb_code, off_amph_code, off_prov_code, off_latitude, off_longitude, off_area, off_flag, veh_start_dt, veh_end_dt)
      tbl_master `;

      if (veh_group_code.toString().toUpperCase() != "ALL") {
        script += ` where tbl_master.veh_group_code = '${veh_group_code}'`;
      }

      script += ` order by tbl_master.veh_number asc`

      let tbl_temporary = await pgConn.get(
        dbPrefix + lic_code,
        script,
        config.connectionString(),
      );
      if (!tbl_temporary.code) {
        //debugger
        if (tbl_temporary.data.length > 0) {
          tbl_temporary.data = JSON.parse(
            JSON.stringify(tbl_temporary.data).replace(/\:null/gi, ':""'),
          );

          xresult = [];
          for (var xdver = 0; xdver <= tbl_temporary.data.length - 1; xdver++) {
            if (xdver == tbl_temporary.data.length - 1) {
              let response = [{
                status: "success",
                invalid_code: "0",
                message: "",
                data: tbl_temporary.data,
                response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
              },];

              res.status(200).send(response);
              return;
            }
          }
        } else {
          let response = [{
            status: "success",
            invalid_code: "0",
            message: "",
            data: xresult,
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },];

          res.status(200).send(response);
          return;
        }
      } else {
        let response = [{
          status: "error",
          invalid_code: "-3",
          message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
          data: xresult,
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },];
        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "ดึงข้อมูลรถและหางลาก",
          JSON.stringify(req.body[0]),
          "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
          action[0].value,
        );
        return;
      }
    }
  })().catch(async (err) => {
    console.log(err);
    let response = [{
      status: "error",
      invalid_code: "-4",
      message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
      data: xresult,
      response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
    },];
    res.status(200).send(response);
    await xglobal.action_logs(
      lic_code,
      action[0].id,
      "ดึงข้อมูลรถและหางลาก",
      JSON.stringify(req.body[0]),
      "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      action[0].value,
    );
    return;
  });
};

exports.getVehicleOfGroupForManageOrder = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let {
      veh_group_code,
      selectedDate,
      off_code,
      action
    } = req.body[0];
    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      veh_group_code == undefined ||
      selectedDate == undefined ||
      off_code == undefined ||
      lic_code == undefined ||
      action == undefined
    ) {
      let response = [{
        status: "error",
        invalid_code: "-1",
        message: "ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
      },];

      res.status(200).send(response);
    } else {
      let script = ``;
      script = `select
      veh_code, veh_number, veh_license_number, veh_license_province, veh_type_code, veh_type_desc, veh_status, veh_group_code, veh_blackbox_number,
      veh_brand, veh_model, veh_tank_material, veh_loading_system, veh_maximum_compartment, veh_capacity_in_compartment, veh_tare_weight,
      veh_gross_weight, veh_tank_width, veh_tank_length, veh_tank_height, veh_tank_capacity, veh_maximum_capacity, veh_discharge_sequence, veh_option_pump,
      veh_option_doeb, veh_option_m12, veh_option_ivms, veh_option_afdd, veh_registration_starting_date, veh_registration_expire_date, veh_registration_remark,
      veh_support_product, veh_sticker, veh_braking_system, veh_service_life, veh_flag, veh_image, veh_sub_license_number, veh_sub_license_province, veh_sub_brand,
      veh_sub_model, veh_sub_registration_starting_date, veh_sub_registration_expire_date, veh_sub_registration_remark, veh_sub_service_life, veh_sub_braking_system,
      veh_sub_image, ist_dt, mdf_dt, rm_dt, off_code, veh_support_climb_mountain, veh_maximum_distance, veh_minimum_distance, veh_maximum_jobs, veh_remark, veh_group_desc,
      veh_group_flag, off_code, off_desc, off_desc_en, off_number, off_address, off_tamb_code, off_amph_code, off_prov_code, off_latitude, off_longitude, off_area, off_flag,
      case when count_compartment <= 0 then '0' when count_compartment_level <= 0 then '0' else status_vehicle end as status_vehicle, case when count_compartment <= 0
      then 'ไม่พบข้อมูลช่องน้ำมัน' when count_compartment_level <= 0 then 'ไม่พบข้อมูลระดับน้ำมัน' else reason_vehicle end as reason_vehicle,
      veh_unavailable_status, veh_unavailable_type_desc, count_compartment, count_compartment_level, veh_start_dt, veh_end_dt

      from
      (select
      vh.veh_code, vh.veh_number, vh.veh_license_number, vh.veh_license_province, vh.veh_type_code, vht.veh_type_desc, vh.veh_status, vh.veh_group_code, veh_blackbox_number, veh_brand, veh_model, veh_tank_material,
      veh_loading_system, veh_maximum_compartment, veh_capacity_in_compartment, veh_tare_weight, veh_gross_weight, veh_tank_width, veh_tank_length,
      veh_tank_height, veh_tank_capacity, veh_maximum_capacity, veh_discharge_sequence, veh_option_pump, veh_option_doeb, veh_option_m12, veh_option_ivms,
      veh_option_afdd, veh_registration_starting_date, veh_registration_expire_date, veh_registration_remark, veh_support_product, veh_sticker, veh_braking_system,
      veh_service_life, veh_flag, veh_image, veh_sub_license_number, veh_sub_license_province, veh_sub_brand, veh_sub_model, veh_sub_registration_starting_date,
      veh_sub_registration_expire_date, veh_sub_registration_remark, veh_sub_service_life, veh_sub_braking_system, veh_sub_image,
      vh.ist_dt, vh.mdf_dt, vh.rm_dt, veh_support_climb_mountain, veh_maximum_distance, veh_minimum_distance, veh_maximum_jobs, veh_remark, veh_group_desc, veh_group_flag,
      vh.off_code, off_desc, off_desc_en, off_number, off_address, off_tamb_code, off_amph_code, off_prov_code, off_latitude, off_longitude, off_area,
      off_flag, COALESCE((
      SELECT veh_unavailable_code
      FROM tbl_vehicle_unavailable
      WHERE veh_code = vh.veh_code
      AND veh_unavailable_date = '${selectedDate}' and veh_unavailable_flag = '1' limit 1), '-') AS status_vehicle
      ,COALESCE((select  CONCAT('ไม่พร้อมรับงาน','') from tbl_vehicle_unavailable where veh_code = vh.veh_code
      and veh_unavailable_date = '${selectedDate}' and veh_unavailable_flag = '1' limit 1), 'พร้อมรับงาน')  as reason_vehicle
      , (select veh_unavailable_status from tbl_vehicle_unavailable where veh_code = vh.veh_code and veh_unavailable_date = '${selectedDate}' and veh_unavailable_flag = '1' limit 1) as veh_unavailable_status
      , (select veh_unavailable_type_desc from tbl_vehicle_unavailable vhu left join tbl_vehicle_unavailable_type vhut
      on vhu.veh_unavailable_type_code = vhut.veh_unavailable_type_code where vhu.veh_code = vh.veh_code and veh_unavailable_date = '${selectedDate}' and veh_unavailable_flag = '1' limit 1) as veh_unavailable_type_desc,
      count(tbl_vehicle_compartment.veh_compartment_code) as count_compartment, count(tbl_vehicle_compartment_level.veh_compartment_level_code) as count_compartment_level,
      case when vh.veh_start_dt is null then '07:00:00' else vh.veh_start_dt end as veh_start_dt,
      case when vh.veh_end_dt is null then '18:00:00' else vh.veh_end_dt end as veh_end_dt
      from  tbl_vehicle vh left join tbl_vehicle_group vg on vh.veh_group_code = vg.veh_group_code
      left join tbl_vehicle_compartment on vh.veh_code = tbl_vehicle_compartment.veh_code
      left join tbl_vehicle_compartment_level on tbl_vehicle_compartment.veh_compartment_code = tbl_vehicle_compartment_level.veh_compartment_code
      left join tbl_office o on vh.off_code = o.off_code
      left join tbl_vehicle_type vht on vh.veh_type_code = vht.veh_type_code
      where  vh.veh_flag = '1'

      group by vh.veh_code, vh.veh_number, vh.veh_license_number, vh.veh_license_province, vh.veh_type_code, vht.veh_type_desc, vh.veh_status, vh.veh_group_code, veh_blackbox_number, veh_brand, veh_model, veh_tank_material,
      veh_loading_system, veh_maximum_compartment, veh_capacity_in_compartment, veh_tare_weight, veh_gross_weight, veh_tank_width, veh_tank_length,
      veh_tank_height, veh_tank_capacity, veh_maximum_capacity, veh_discharge_sequence, veh_option_pump, veh_option_doeb, veh_option_m12, veh_option_ivms,
      veh_option_afdd, veh_registration_starting_date, veh_registration_expire_date, veh_registration_remark, veh_support_product, veh_sticker, veh_braking_system,
      veh_service_life, veh_flag, veh_image, veh_sub_license_number, veh_sub_license_province, veh_sub_brand, veh_sub_model, veh_sub_registration_starting_date,
      veh_sub_registration_expire_date, veh_sub_registration_remark, veh_sub_service_life, veh_sub_braking_system, veh_sub_image,
      vh.ist_dt, vh.mdf_dt, vh.rm_dt, veh_support_climb_mountain, veh_maximum_distance, veh_minimum_distance, veh_maximum_jobs, veh_remark, veh_group_desc, veh_group_flag,
      vh.off_code, off_desc, off_desc_en, off_number, off_address, off_tamb_code, off_amph_code, off_prov_code, off_latitude, off_longitude, off_area, off_flag, veh_start_dt, veh_end_dt)
      tbl_master `;


      //,'-',veh_unavailable_desc
      if (veh_group_code.length > 0) {
        script += ` where tbl_master.veh_group_code in (${veh_group_code
          .map((number) => `'${number}'`)
          .toString()})`;
      }

      script += ` order by tbl_master.veh_number asc`

      let tbl_temporary = await pgConn.get(
        dbPrefix + lic_code,
        script,
        config.connectionString(),
      );
      if (!tbl_temporary.code) {
        //debugger
        if (tbl_temporary.data.length > 0) {
          tbl_temporary.data = JSON.parse(
            JSON.stringify(tbl_temporary.data).replace(/\:null/gi, ':""'),
          );

          xresult = [];
          for (var xdver = 0; xdver <= tbl_temporary.data.length - 1; xdver++) {
            if (xdver == tbl_temporary.data.length - 1) {
              let response = [{
                status: "success",
                invalid_code: "0",
                message: "",
                data: tbl_temporary.data,
                response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
              },];

              res.status(200).send(response);
              return;
            }
          }
        } else {
          let response = [{
            status: "success",
            invalid_code: "0",
            message: "",
            data: xresult,
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },];

          res.status(200).send(response);
          return;
        }
      } else {
        let response = [{
          status: "error",
          invalid_code: "-3",
          message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
          data: xresult,
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },];
        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "ดึงข้อมูลรถและหางลาก",
          JSON.stringify(req.body[0]),
          "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
          action[0].value,
        );
        return;
      }
    }
  })().catch(async (err) => {
    console.log(err);
    let response = [{
      status: "error",
      invalid_code: "-4",
      message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
      data: xresult,
      response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
    },];
    res.status(200).send(response);
    await xglobal.action_logs(
      lic_code,
      action[0].id,
      "ดึงข้อมูลรถและหางลาก",
      JSON.stringify(req.body[0]),
      "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      action[0].value,
    );
    return;
  });
};

exports.addPlanforVehicleOrderManage = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let {
      veh_code,
      selectedDate,
      ord_code,
      off_code,
      action,
      totalItemCount,
      totalItemQuantity,
      veh_maximum_capacity,
      veh_maximum_compartment,
    } = req.body[0];
    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      veh_code == undefined ||
      selectedDate == undefined ||
      ord_code == undefined ||
      off_code == undefined ||
      lic_code == undefined ||
      action == undefined ||
      totalItemCount == undefined ||
      totalItemQuantity == undefined ||
      veh_maximum_capacity == undefined ||
      veh_maximum_compartment == undefined
    ) {
      let response = [{
        status: "error",
        invalid_code: "-1",
        message: "ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
      },];

      res.status(200).send(response);
    } else {
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "เริ่มกำหนดแผนงานอัตโนมัติ",
        JSON.stringify(req.body[0]),
        "on process",
        action[0].value,
      );

      let script = ``;
      let errors1 = ``;
      let errors2 = ``;
      let errors3 = ``;
      let errors4 = ``;
      let errors5 = ``;
      let errors6 = ``;
      let veh_start_dt = "08:00:00";
      var veh_loading_minute = 0;
      var veh_unloading_minute = 0;

      var xorder = ord_code;
      ord_code = [];

      for (var xrrr = 0; xrrr <= xorder.length - 1; xrrr++) {
        {
          if (ord_code.indexOf(xorder[xrrr]) == -1) {
            ord_code.push(xorder[xrrr]);
          }
        }
      }

      try {
        //check order with special product in order
        script = `select count(itm_code) as special_product from tbl_order_item 
        where ord_code in (${ord_code.map((number) => `'${number}'`).toString()}) and itm_code in (select itm_code from tbl_item 
        where tbl_item.itm_material_number in ('400018281','400019360','400003050','400003060','400003045'))`;

        let tbl_order_checked = await pgConn.get(
          dbPrefix + lic_code,
          script,
          config.connectionString(),
        );

        if (!tbl_order_checked.code) {
          if (tbl_order_checked.data.length > 0) {
            if (parseInt(tbl_order_checked.data[0].special_product) > 0) {
              errors6 = `เตือนให้ใช้รถที่มีการล้างแทงค์เนื่องจากเป็นสินค้าพิเศษ`;
            }
          }
        } else {
          errors6 = `ไม่สามารถตรวจสอบรถกับข้อมูล Order`;
        }
      } catch (ex) {
        errors6 = `ไม่สามารถตรวจสอบรถกับข้อมูล Order`;
      }

      try {
        //check order with order in track
        script = `select tbl_order.veh_code, tbl_vehicle.veh_number, shipments_code from tbl_order
        left join tbl_vehicle on tbl_order.veh_code = tbl_vehicle.veh_code
        where ord_code in (${ord_code.map((number) => `'${number}'`).toString()})
        and tbl_order.veh_code is not null and tbl_order.veh_code != '${veh_code}'`;

        let tbl_order_checked = await pgConn.get(
          dbPrefix + lic_code,
          script,
          config.connectionString(),
        );

        if (!tbl_order_checked.code) {
          if (tbl_order_checked.data.length > 0) {

            if (tbl_order_checked.data[0].veh_number != undefined) {
              errors3 = `Sale Order ${tbl_order_checked.data[0].shipments_code} สำหรับรถ ${tbl_order_checked.data[0].veh_number} เท่านั้น`;
              let response = [{
                status: "error",
                invalid_code: "-1",
                message: errors3,
                data: [],
                response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
              },];

              res.status(200).send(response);
              await xglobal.action_logs(
                lic_code,
                action[0].id,
                "ตรวจสอบข้อมูล Order",
                JSON.stringify(req.body[0]),
                errors3,
                action[0].value,
              );
              return;
            }

          }
        } else {
          errors3 = `ไม่สามารถตรวจสอบรถกับข้อมูล Order`;
        }
      } catch (ex) {
        errors3 = `ไม่สามารถตรวจสอบรถกับข้อมูล Order`;
      }

      try {
        //check petrol with track
        script = `select tbl_petrol_vehicle.veh_code, tbl_vehicle.veh_number, shipments_code, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc 
        from tbl_order
        left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code
        left join tbl_petrol_vehicle on tbl_order_petrol.ptrl_code = tbl_petrol_vehicle.ptrl_code
        left join tbl_vehicle on tbl_vehicle.veh_code =  tbl_petrol_vehicle.veh_code
        left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
        where tbl_order.ord_code in (${ord_code.map((number) => `'${number}'`).toString()}) 
        and tbl_petrol_vehicle.veh_code is not null and tbl_petrol_vehicle.ptrl_vehicle_flag = '1'`;

        let tbl_truck_checked = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
        if (!tbl_truck_checked.code) {
          if (tbl_truck_checked.data.length > 0) {
            //checked ว่ารถที่เลือกอยู่ในลิสไหม
            debugger
            if (tbl_truck_checked.data.filter((xxf) => xxf.veh_code == veh_code).length <= 0) {
              errors3 = `รถที่เลือกไม่อยู่ในลิส ที่สามารถเข้าไปยังปั้มได้`;
              let response = [{
                status: "error",
                invalid_code: "-1",
                message: errors3,
                data: [],
                response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
              },];

              res.status(200).send(response);
              await xglobal.action_logs(
                lic_code,
                action[0].id,
                "ตรวจสอบข้อมูล Order",
                JSON.stringify(req.body[0]),
                errors3,
                action[0].value,
              );
              return;
            }

          }
        }
      } catch (ex) {
        errors3 = `ไม่สามารถตรวจสอบรถกับข้อมูล Order`;
      }

      try {
        //check vehicle_type and order
        script = `select distinct(tbl_vehicle.veh_code) as veh_code
        from tbl_order_petrol
        left join tbl_petrol_vehicle_type on tbl_order_petrol.ptrl_code = tbl_petrol_vehicle_type.ptrl_code 
        left join tbl_vehicle on tbl_petrol_vehicle_type.veh_type_code = tbl_vehicle.veh_type_code 
        where tbl_petrol_vehicle_type.ptrl_vehicle_type_flag = '1' and ord_code in (${ord_code.map((number) => `'${number}'`).toString()}) `;

        let tbl_vehicle_type = await pgConn.get(
          dbPrefix + lic_code,
          script,
          config.connectionString(),
        );

        if (!tbl_vehicle_type.code) {
          if (tbl_vehicle_type.data.length > 0) {
            if (tbl_vehicle_type.data.filter((xxf) => xxf.veh_code == veh_code).length <= 0) {
              errors3 = `ข้อมูลประเภทของรถไม่สอดคล้องกับข้อมูลปั้มใน Order`;
              let response = [{
                status: "error",
                invalid_code: "-1",
                message: errors3,
                data: [],
                response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
              },];

              res.status(200).send(response);
              await xglobal.action_logs(
                lic_code,
                action[0].id,
                "ตรวจสอบข้อมูล Order",
                JSON.stringify(req.body[0]),
                "ข้อมูลประเภทของรถไม่สอดคล้องกับข้อมูลปั้มใน Order",
                action[0].value,
              );
              return;
            }
          }
        } else {
          errors3 = `ไม่สามารถตรวจสอบประเภทของรถกับข้อมูล Order`;
        }
      } catch (ex) { }

      try {
        //check vehicle item type, option pump, order mrge and order
        script = `select tbl_order.ord_code, tbl_order.shipments_code, ptrl_option_pump, ptrl_option_mrge_orders,
        tbl_item.itm_type_code, tbl_item_type.itm_type_desc, tbl_item_type.itm_type_veh_support
        from tbl_order
        left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code
        left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
        left join tbl_petrol_item on tbl_petrol.ptrl_code = tbl_petrol_item.ptrl_code
        left join tbl_order_item on tbl_order_petrol.ord_code = tbl_order_item.ord_code
        and tbl_order_petrol.itm_code = tbl_order_item.itm_code
        left join tbl_item on tbl_order_item.itm_code = tbl_item.itm_code
        left join tbl_item_type on tbl_item.itm_type_code = tbl_item_type.itm_type_code
        where tbl_order_petrol.ord_code in (${ord_code.map((number) => `'${number}'`).toString()})
        group by tbl_order.ord_code, tbl_order.shipments_code, ptrl_option_pump, ptrl_option_mrge_orders,
        tbl_item.itm_type_code, tbl_item_type.itm_type_desc, tbl_item_type.itm_type_veh_support;`;

        let tbl_checked = await pgConn.get(
          dbPrefix + lic_code,
          script,
          config.connectionString(),
        );

        script = `select veh_support_product, veh_option_pump, 
        case when tbl_vehicle_type.loading_minute is null then 0 else tbl_vehicle_type.loading_minute end as loading_minute, 
        case when tbl_vehicle_type.unloading_minute is null then 0 else tbl_vehicle_type.unloading_minute end as unloading_minute,
        case when veh_start_dt is null then '08:00:00' else veh_start_dt end as veh_start_dt
        from tbl_vehicle
        left join tbl_vehicle_type on tbl_vehicle.veh_type_code = tbl_vehicle_type.veh_type_code
        where veh_code = '${veh_code}';`;

        let tbl_vehicle = await pgConn.get(
          dbPrefix + lic_code,
          script,
          config.connectionString(),
        );

        if (!tbl_checked.code && !tbl_vehicle.code) {
          if (tbl_checked.data.length > 0 && tbl_vehicle.data.length > 0) {

            try {
              debugger;
              veh_loading_minute = parseInt(tbl_vehicle.data[0].loading_minute);
              veh_unloading_minute = parseInt(tbl_vehicle.data[0].unloading_minute);
              console.log('veh_loading_minute:', veh_loading_minute, 'veh_unloading_minute:', veh_unloading_minute);
            } catch (ex) {
              veh_loading_minute = 0;
              veh_unloading_minute = 0;
            }

            try {
              debugger;
              veh_start_dt = moment().format("YYYY-MM-DD " + tbl_vehicle.data[0].veh_start_dt);
              veh_start_dt = moment(veh_start_dt).format("HH:mm:ss");
            } catch (ex) {
              veh_start_dt = "08:00:00";
            }

            //checked order ที่ห้ามรวม Order
            if (
              tbl_checked.data.filter(
                (xxf) => xxf.ptrl_option_mrge_orders == "0",
              ).length > 0 &&
              tbl_checked.data.length > 1
            ) {
              errors3 = `ข้อมูล Order ${tbl_checked.data.filter(
                (xxf) => xxf.ptrl_option_mrge_orders == "0",
              )[0].shipments_code
                } ไม่รองรับการพ่วงงาน`;
              let response = [{
                status: "error",
                invalid_code: "-1",
                message: errors3,
                data: [],
                response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
              },];

              res.status(200).send(response);
              await xglobal.action_logs(
                lic_code,
                action[0].id,
                "ตรวจสอบข้อมูล Order",
                JSON.stringify(req.body[0]),
                errors3,
                action[0].value,
              );
              return;
            }
            //checked ประเภทน้ำมัน
            else if (
              tbl_checked.data.filter(
                (xxf) =>
                  xxf.itm_type_veh_support !=
                  tbl_vehicle.data[0].veh_support_product,
              ).length > 0
            ) {
              errors3 = `ข้อมูลรถไม่รองรับประเภทน้ำมัน ตามที่ Order กำหนด`;

              let response = [{
                status: "error",
                invalid_code: "-1",
                message: errors3,
                data: [],
                response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
              },];

              res.status(200).send(response);
              await xglobal.action_logs(
                lic_code,
                action[0].id,
                "ตรวจสอบข้อมูล Order",
                JSON.stringify(req.body[0]),
                errors3,
                action[0].value,
              );
              return;
            } else {
              if (tbl_vehicle.data[0].veh_option_pump == "0") {
                //checked ว่าปั้มต้องการ Pump ไหม
                if (
                  tbl_checked.data.filter((xxf) => xxf.ptrl_option_pump == "1")
                    .length > 0
                ) {
                  errors3 = `ข้อมูล Order ${tbl_checked.data.filter(
                    (xxf) => xxf.ptrl_option_pump == "1",
                  )[0].shipments_code
                    } ต้องการ Pump ในการลงน้ำมัน`;
                  let response = [{
                    status: "error",
                    invalid_code: "-1",
                    message: errors3,
                    data: [],
                    response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                  },];

                  res.status(200).send(response);
                  await xglobal.action_logs(
                    lic_code,
                    action[0].id,
                    "ตรวจสอบข้อมูล Order",
                    JSON.stringify(req.body[0]),
                    errors3,
                    action[0].value,
                  );
                  return;
                }
              }
            }

            debugger;
          } else {
            errors3 = `ไม่สามารถตรวจสอบประเภทของรถกับข้อมูล Order`;
          }
        } else {
          errors3 = `ไม่สามารถตรวจสอบประเภทของรถกับข้อมูล Order`;
        }
      } catch (ex) { }

      let job_code = "";
      // add job
      if (ord_code.length <= 0) {
        let response = [{
          status: "error",
          invalid_code: "-1",
          message: "ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง",
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },];

        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "กำหนดแผนงานอัตโนมัติ",
          JSON.stringify(req.body[0]),
          "ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง ord_code ไม่รองรับค่าว่าง",
          action[0].value,
        );
        return;
      }

      script = `select tbl_order.ord_code, shipments_code, case when ord_status != '1' then '-9' else 1 end as checked
      from tbl_order where tbl_order.ord_flag = '1' and tbl_order.ord_code in (${ord_code.map((number) => `'${number}'`).toString()}) `;

      script = script.replace(/'NULL'/gi, "NULL");
      let tbl_temporary = await pgConn.get(
        dbPrefix + lic_code,
        script,
        config.connectionString(),
      );
      if (!tbl_temporary.code) {
        //debugger
        var xresult = [];
        var xlist = [];
        if (tbl_temporary.data.length > 0) {
          debugger;
          if (tbl_temporary.data.length != ord_code.length) {
            let response = [{
              status: "error",
              invalid_code: "-3",
              message: `ไม่สามารถบันทึกข้อมูล, ข้อมูลบาง Order ไม่ถูกต้อง`,
              data: [],
              response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
            },];
            res.status(200).send(response);
            await xglobal.action_logs(
              lic_code,
              action[0].id,
              "สร้างใบงาน",
              JSON.stringify(req.body[0]),
              "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
              action[0].value,
            );
            return;
          }

          debugger;
          job_code = "job-" + moment().format("x");
          var tms_transport_code = moment().format("x").substring(0, 6);

          script = `select case when max(tms_transport_code) is null then '000010'
          else LPAD((replace(max(tms_transport_code),'','') :: integer + 1) :: text,6,'0') end as tms_transport_code
          from tbl_job`;

          let tbl_temporaryx0 = await pgConn.get(
            dbPrefix + lic_code,
            script,
            config.connectionString(),
          );

          if (!tbl_temporaryx0.code) {
            if (tbl_temporaryx0.data.length > 0) {
              tms_transport_code = tbl_temporaryx0.data[0].tms_transport_code;
            }
          }

          for (var xjob = 0; xjob <= tbl_temporary.data.length - 1; xjob++) {
            if (tbl_temporary.data[xjob].checked.toString() == "1") {
              var job_ord_code = "jord-" + moment().format("x");
              let ist_dt = moment().format("YYYY-MM-DD HH:mm:ss");

              script = `insert into tbl_job_order (job_ord_code, job_code, ord_code, ist_dt) values
             ('${job_ord_code}','${job_code}','${tbl_temporary.data[xjob].ord_code}', '${ist_dt}');`;

              let tbl_temporary0 = await pgConn.execute(
                dbPrefix + lic_code,
                script,
                config.connectionString(),
              );

              console.log(
                "insert tbl_job_order,",
                job_ord_code,
                ":",
                !tbl_temporary0.code,
              );

              if (!tbl_temporary0.code) {
                script = `update tbl_order set mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}', ord_status = '3'
                where ord_code = '${tbl_temporary.data[xjob].ord_code.toString()}';`;

                let tbl_temporary00 = await pgConn.execute(
                  dbPrefix + lic_code,
                  script,
                  config.connectionString(),
                );

                if (tbl_temporary00.code) {
                  var xreason = `บันทึกไม่สำเร็จ`;
                  if (
                    xlist.indexOf(tbl_temporary.data[xjob].shipments_code) == -1
                  ) {
                    xlist.push(tbl_temporary.data[xjob].shipments_code);
                    xresult.push({
                      shipments_code: tbl_temporary.data[xjob].shipments_code.toString(),
                      status: "error",
                      reason: xreason,
                    });
                  }
                }
              } else {
                var xreason = `บันทึกไม่สำเร็จ`;
                if (
                  xlist.indexOf(tbl_temporary.data[xjob].shipments_code) == -1
                ) {
                  xlist.push(tbl_temporary.data[xjob].shipments_code);
                  xresult.push({
                    shipments_code: tbl_temporary.data[xjob].shipments_code.toString(),
                    status: "error",
                    reason: xreason,
                  });
                }
              }
            } else {
              var xreason = `ไม่สำเร็จ`;

              switch (tbl_temporary.data[xjob].checked.toString()) {
                case "-9":
                  xreason = `ไม่สำเร็จ, Order ไม่พร้อมนำมาจัดงาน`;
                  break;
              }

              if (
                xlist.indexOf(tbl_temporary.data[xjob].shipments_code) == -1
              ) {
                xlist.push(tbl_temporary.data[xjob].shipments_code);
                xresult.push({
                  shipments_code: tbl_temporary.data[xjob].shipments_code.toString(),
                  status: "error",
                  reason: xreason,
                });
              }
            }

            if (xresult.length > 0) {
              let response = [{
                status: "success",
                invalid_code: "0",
                message: "3",
                data: xresult,
                response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
              },];

              res.status(200).send(response);
              await xglobal.action_logs(
                lic_code,
                action[0].id,
                "สร้างใบงาน",
                JSON.stringify(req.body[0]),
                "ไม่สำเร็จ",
                action[0].value,
              );
              // return;
              errors3 = `สร้างใบงาน ไม่สำเร็จ ไม่พบข้อมูล Order หรือ Order ยังไม่ได้ตรวจสอบ`;
              return;
            } else {
              if (xjob == tbl_temporary.data.length - 1) {
                //insert tbl_job
                let loading_count = 0;
                let unloading_count = 0;
                let item_count = 0;
                let item_quantity = 0;
                let distance = 0;
                let xtransit_master_dt = moment(selectedDate).format(
                  "YYYY-MM-DD " + veh_start_dt,
                );
                let transit_start_dt = moment(selectedDate).format(
                  "YYYY-MM-DD " + veh_start_dt,
                );
                let transit_end_dt = moment(transit_start_dt)
                  .add("minute", 0)
                  .format("YYYY-MM-DD HH:mm:ss");
                let transit_minute = 0;
                let ist_dt = moment().format("YYYY-MM-DD HH:mm:ss");
                let job_status = "1";
                let job_dt = moment().format("YYYY-MM-DD HH:mm:ss");

                try {
                  // select last time from last job
                  script = `select transit_end_dt from tbl_job where veh_code = '${veh_code}' and
                  transit_end_dt >= '${selectedDate} 00:00:00' and transit_end_dt <= '${selectedDate} 23:59:59' order by transit_end_dt asc`;

                  let tbl_temporary001 = await pgConn.get(
                    dbPrefix + lic_code,
                    script,
                    config.connectionString(),
                  );
                  if (!tbl_temporary001.code) {
                    if (tbl_temporary001.data.length > 0) {
                      debugger;
                      transit_start_dt = moment(tbl_temporary001.data[tbl_temporary001.data.length - 1].transit_end_dt).add("minutes", 0).format("YYYY-MM-DD HH:mm:ss");
                      xtransit_master_dt = transit_start_dt;
                    }
                  }
                } catch (ex) { }

                script = `insert into tbl_job
                (job_code, tms_transport_code, job_dt, job_status, off_code, job_flag, loading_count, unloading_count, item_count,
                item_quantity, distance, transit_start_dt, transit_end_dt, transit_minute, ist_dt) values
                ('${job_code}', '${tms_transport_code}', '${job_dt}', '${job_status}', '${off_code}', '1', ${loading_count}, ${unloading_count}, ${item_count},
                ${item_quantity}, ${distance}, '${transit_start_dt}', '${transit_end_dt}', ${transit_minute}, '${ist_dt}');`;

                let tbl_temporary000 = await pgConn.execute(
                  dbPrefix + lic_code,
                  script,
                  config.connectionString(),
                );

                if (!tbl_temporary000.code) {

                  //update pkg_code
                  script = `update tbl_job set pkg_code = (select dpo_code from tbl_order_depot 
                  where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}')
                  order by loading_start_dt asc limit 1) where job_code = '${job_code}'`
                  await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

                  //select route for update datetime for heremap
                  try {
                    script = `select location_type_code, location_type_desc, location_code, location_number, location_desc, location_address, location_zip_code, location_country_code, location_lat, location_lon, location_city,
                    location_minute, min(start_dt) as start_dt, max(end_dt) as end_dt, location_distance, location_req

                    from
                    (select 'depot' AS location_type_code, 'สถานที่โหลดน้ำมัน' as location_type_desc ,tbl_order_depot.dpo_code as location_code, tbl_depot.dpo_number as location_number, tbl_depot.dpo_desc as location_desc,
                    case when tbl_order_depot.dpo_address is null then tbl_depot.dpo_address else tbl_order_depot.dpo_address end as location_address,
                    case when tbl_order_depot.dpo_zip_code is null then tbl_depot.dpo_zip_code else tbl_order_depot.dpo_zip_code end as location_zip_code,
                    case when tbl_order_depot.dpo_country_code is null then tbl_depot.dpo_country_code else tbl_order_depot.dpo_country_code end as location_country_code,
                    case when tbl_order_depot.dpo_lat is null then tbl_depot.dpo_lat else tbl_order_depot.dpo_lat end as location_lat,
                    case when tbl_order_depot.dpo_lon is null then tbl_depot.dpo_lon else tbl_order_depot.dpo_lon end as location_lon,
                    case when tbl_order_depot.dpo_city is null then tbl_depot.dpo_city else tbl_order_depot.dpo_city end as location_city,
                    tbl_depot.dpo_loading_minute as location_minute, tbl_order_depot.loading_start_dt as start_dt, tbl_order_depot.loading_end_dt as end_dt, 0.0 as location_distance, 0 as location_req

                    from tbl_order
                    left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code
                    left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code
                    where tbl_order.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') and tbl_order.ord_flag = '1' and tbl_order_depot.ord_depot_flag = '1'

                    union

                    select 'petrol' AS location_type_code, 'สถานที่ลงน้ำมัน' as location_type_desc, tbl_order_petrol.ptrl_code as location_code, tbl_petrol.ptrl_number as location_number, tbl_petrol.ptrl_desc as location_desc,
                    case when tbl_order_petrol.ptrl_address is null then tbl_petrol.ptrl_address else tbl_order_petrol.ptrl_address end as location_address,
                    case when tbl_order_petrol.ptrl_zip_code is null then tbl_petrol.ptrl_zip_code else tbl_order_petrol.ptrl_zip_code end as location_zip_code,
                    case when tbl_order_petrol.ptrl_country_code is null then tbl_petrol.ptrl_country_code else tbl_order_petrol.ptrl_country_code end as location_country_code,
                    case when tbl_order_petrol.ptrl_lat is null then tbl_petrol.ptrl_lat else tbl_order_petrol.ptrl_lat end as location_lat,
                    case when tbl_order_petrol.ptrl_lon is null then tbl_petrol.ptrl_lon else tbl_order_petrol.ptrl_lon end as location_lon,
                    case when tbl_order_petrol.ptrl_city is null then tbl_petrol.ptrl_city else tbl_order_petrol.ptrl_city end as location_city,
                    tbl_petrol.ptrl_unloading_minute as location_minute, tbl_order_petrol.unloading_start_dt as start_dt, tbl_order_petrol.unloading_end_dt as end_dt, 0.0 as location_distance, 1 as location_req
                    from tbl_order
                    left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code
                    left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
                    where tbl_order.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') 
                    and tbl_order.ord_flag = '1' and tbl_order_petrol.ord_petrol_flag = '1'
                    
                    union

                    select 'yard' AS location_type_code, 'สถานที่จอดหลังจากขนส่ง' as location_type_desc ,tbl_job.pkg_code as location_code, tbl_depot.dpo_number as location_number, tbl_depot.dpo_desc as location_desc,
                    tbl_depot.dpo_address as location_address,
                    tbl_depot.dpo_zip_code as location_zip_code,
                    tbl_depot.dpo_country_code as location_country_code,
                    tbl_depot.dpo_lat as location_lat,
                    tbl_depot.dpo_lon as location_lon,
                    tbl_depot.dpo_city as location_city,
                    0 as location_minute,tbl_job.transit_end_dt as start_dt,tbl_job.transit_end_dt as end_dt, 0.0 as location_distance, 2 as location_req

                    from tbl_job
                    left join tbl_depot on tbl_job.pkg_code = tbl_depot.dpo_code
                    where tbl_job.job_code = '${job_code}') xtblmaster

                    group by
                    location_type_code, location_type_desc, location_code, location_number, location_desc, location_address, location_zip_code, location_country_code, location_lat, location_lon, location_city,
                    location_minute, location_distance, location_req
                    order by location_type_code,location_req asc `;

                    let tbl_route = await pgConn.get(
                      dbPrefix + lic_code,
                      script,
                      config.connectionString(),
                    );
                    debugger;
                    if (!tbl_route.code) {
                      if (tbl_route.data.length > 0) {
                        tbl_route.data = JSON.parse(JSON.stringify(tbl_route.data).replace(/\:null/gi, ':""'));

                        xresult = [];
                        var xlat = 0.0;
                        var xlon = 0.0;
                        var xurl = "";
                        var xtime = 0.0;
                        var xdistance = 0.0;
                        for (var xlocation = 0; xlocation <= tbl_route.data.length - 1; xlocation++) {
                          debugger;
                          var location_minute = 0;
                          try {
                            location_minute = parseInt(tbl_route.data[xlocation].location_minute);
                          } catch (ex) {
                            location_minute = 0;
                          }
                          if (xlocation == 0) {
                            xlat = parseFloat(tbl_route.data[xlocation].location_lat);
                            xlon = parseFloat(tbl_route.data[xlocation].location_lon);

                            if (tbl_route.data[xlocation].location_type_code == "depot") {
                              //update depot
                              if (transit_start_dt != undefined) {
                                script = `update tbl_order_depot
                                set loading_start_dt = '${moment(transit_start_dt).format("YYYY-MM-DD HH:mm:ss")}',
                                loading_end_dt = '${moment(transit_start_dt).add("minutes", (location_minute + veh_loading_minute)).format("YYYY-MM-DD HH:mm:ss")}'
                                where tbl_order_depot.dpo_code = '${tbl_route.data[xlocation].location_code}'
                                and tbl_order_depot.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}');`;

                                let tbl_temporary001 = await pgConn.execute(
                                  dbPrefix + lic_code,
                                  script,
                                  config.connectionString(),
                                );

                                console.log("update depot transit_start_dt,", moment(transit_start_dt).format("YYYY-MM-DD HH:mm:ss",),);
                                transit_end_dt = moment(transit_start_dt).add("minutes", location_minute + veh_loading_minute).format("YYYY-MM-DD HH:mm:ss");
                              }
                            }
                          } else {
                            //&departure=2025-07-23T08:00:00%2b07:00
                            xurl = `https://wps.hereapi.com/v8/findsequence2?start=start1;${xlat},${xlon}&departure=${moment(transit_end_dt).format("YYYY-MM-DDTHH:mm:ss")}%2b07:00&end=end1;${tbl_route.data[xlocation].location_lat},${tbl_route.data[xlocation].location_lon}&mode=shortest;truck&apiKey=${xapikey}`;
                            // xurl = `https://wps.hereapi.com/v8/findsequence2?start=start1;13.6842148142318,100.608699917788&departure=2025-07-23T08:00:00%2b07:00&end=end1;13.8153939583652,100.529045486755&mode=shortest;truck&apiKey=1-qFLg-ltaUmdvGikk4MTxxTYLbNNtB5igcGRmVcJsc`

                            xlat = parseFloat(tbl_route.data[xlocation].location_lat);
                            xlon = parseFloat(tbl_route.data[xlocation].location_lon);

                            let xconfig = {
                              method: "get",
                              maxBodyLength: Infinity,
                              url: xurl,
                              headers: {
                                "Content-Type": "application/json",
                              },
                            };

                            await axios
                              .request(xconfig)
                              .then(async (response) => {
                                debugger;
                                console.log(JSON.stringify(response.data));
                                //update ทุก drop ให้เวลาเดียวกัน
                                if (tbl_route.data[xlocation].location_type_code == "depot") {

                                  if (response.data.results.length > 0) {
                                    if (response.data.results[0].distance != undefined) {
                                      try {
                                        tbl_route.data[xlocation].location_distance = parseFloat(response.data.results[0].distance) / 1000;
                                        transit_start_dt = moment(transit_end_dt).add("seconds", parseFloat(response.data.results[0].time)).format("YYYY-MM-DD HH:mm:ss");
                                        transit_end_dt = moment(transit_start_dt).add("minutes", location_minute + veh_loading_minute).format("YYYY-MM-DD HH:mm:ss");
                                        xdistance += tbl_route.data[xlocation].location_distance;
                                        xtime += parseFloat(response.data.results[0].time) / 60;
                                      } catch (ex) { }
                                    }
                                  }

                                  //update depot
                                  if (transit_start_dt != undefined) {
                                    script = `update tbl_order_depot
                                    set loading_start_dt = '${moment(transit_start_dt).format("YYYY-MM-DD HH:mm:ss")}',loading_end_dt = '${moment(transit_end_dt).format("YYYY-MM-DD HH:mm:ss")}'
                                    where tbl_order_depot.dpo_code = '${tbl_route.data[xlocation].location_code}'
                                    and tbl_order_depot.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}');`;

                                    let tbl_temporary001 = await pgConn.execute(
                                      dbPrefix + lic_code,
                                      script,
                                      config.connectionString(),
                                    );

                                    console.log("update depot transit_start_dt,", moment(transit_start_dt).format("YYYY-MM-DD HH:mm:ss"),
                                    );
                                  }
                                } else {
                                  //update petrol
                                  debugger;
                                  if (response.data.results.length > 0) {
                                    if (response.data.results[0].distance != undefined) {
                                      try {
                                        tbl_route.data[xlocation].location_distance = parseFloat(response.data.results[0].distance) / 1000;
                                        transit_start_dt = moment(transit_end_dt).add("seconds", parseFloat(response.data.results[0].time)).format("YYYY-MM-DD HH:mm:ss");
                                        transit_end_dt = moment(transit_start_dt).add("minutes", location_minute + veh_unloading_minute).format("YYYY-MM-DD HH:mm:ss");
                                        xdistance += tbl_route.data[xlocation].location_distance;
                                        xtime += parseFloat(response.data.results[0].time) / 60;
                                      } catch (ex) { }
                                    }
                                  }

                                  if (transit_start_dt != undefined && transit_end_dt != undefined) {
                                    script = `update tbl_order_petrol
                                    set unloading_start_dt = '${moment(transit_start_dt).format("YYYY-MM-DD HH:mm:ss")}',
                                    unloading_end_dt = '${moment(transit_end_dt).format("YYYY-MM-DD HH:mm:ss")}'
                                    where tbl_order_petrol.ptrl_code = '${tbl_route.data[xlocation].location_code}'
                                    and tbl_order_petrol.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}');`;

                                    let tbl_temporary001 = await pgConn.execute(
                                      dbPrefix + lic_code,
                                      script,
                                      config.connectionString(),
                                    );

                                    console.log("update petrol transit_start_dt,", moment(transit_start_dt).format("YYYY-MM-DD HH:mm:ss"));
                                  }
                                }

                                if (xlocation == tbl_route.data.length - 1) {
                                  debugger;
                                  try {
                                    var a = moment(transit_end_dt); //now
                                    var b = moment(xtransit_master_dt);
                                    xtime = a.diff(b, "minutes");
                                    debugger;
                                  } catch (ex) {
                                    debugger;
                                  }

                                  script = `update tbl_job
                                  set item_count = (select count(distinct itm_code) from tbl_order_item where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') and ord_item_flag = '1'),
                                  item_quantity = (select sum(item_quantity) from tbl_order_item where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') and ord_item_flag = '1'),
                                  loading_count = (select count(distinct dpo_code) from tbl_order_depot where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') and ord_depot_flag = '1'),
                                  unloading_count = (select count(distinct ptrl_code) from tbl_order_petrol where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') and ord_petrol_flag = '1'),
                                  transit_start_dt = '${moment(xtransit_master_dt).format("YYYY-MM-DD HH:mm:ss")}',transit_end_dt = '${moment(transit_end_dt).format("YYYY-MM-DD HH:mm:ss")}',transit_minute = ${xtime},
                                  distance = ${xdistance} where job_code = '${job_code}'`;

                                  let tbl_temporary001 = await pgConn.execute(
                                    dbPrefix + lic_code,
                                    script,
                                    config.connectionString(),
                                  );
                                  if (!tbl_temporary001.code) {
                                    script = `select
                                    job_code, tms_transport_code, transport_code, tour_code, pull_code, number, document_reference,
                                    job_dt, job_status, job_comment, gsap_order_type_code, gsap_order_status, gsap_order_number,
                                    gsap_shipments_number, transporeon_status, off_code, job_flag, ist_dt, mdf_dt, rm_dt, loading_count,
                                    unloading_count, item_count, item_quantity, dver_code, veh_code, transporeon_result, transporeon_ist_dt, transporeon_mdf_dt,
                                    transporeon_rm_dt, distance, transit_start_dt, transit_end_dt, transit_minute
                                    from tbl_job where tbl_job.job_flag = '1' and tbl_job.job_code = '${job_code}'`;

                                    let tbl_temporaryJob = await pgConn.execute(
                                      dbPrefix + lic_code,
                                      script,
                                      config.connectionString(),
                                    );

                                    if (!tbl_temporaryJob.code) {
                                      let item = [];

                                      // calculate item for vehicle
                                      let scriptOrd = `select '${job_code}' as job_code,
                                      t0.item_quantity as total_fuel ,
                                      t1.item_quantity ,
                                      t2.itm_code as itm_code,
                                      t2.itm_unit_code as itm_unit_code,
                                      t1.ord_code as ord_code,
                                      t1.ptrl_tank_code,
                                      case when t0.veh_compartment_code is null then '' else 
                                      t0.veh_compartment_code end as veh_compartment_code
                                      from tbl_order t0
                                      left join tbl_order_item t1
                                      on t0.ord_code = t1.ord_code
                                      left join tbl_item t2
                                      on t1.itm_code = t2.itm_code
                                      left join tbl_order_petrol t3
                                      on t1.ord_code = t3.ord_code
                                      and t1.itm_code = t3.itm_code
                                      and t1.ptrl_tank_code = t3.ptrl_tank_code
                                      where t1.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}')
                                      and t1.ord_item_flag = '1'
                                      group by t0.item_quantity, t1.item_quantity, t2.itm_code, t2.itm_unit_code,
                                      t1.ord_code, t1.ptrl_tank_code, t0.veh_compartment_code
                                      order by t1.item_quantity desc`;

                                      const orderItem = await pgConn.get(
                                        dbPrefix + lic_code,
                                        scriptOrd,
                                        config.connectionString(),
                                      );
                                      const orderItemRaw = orderItem.data;

                                      let scriptVeh = `select t0.veh_code ,
                                      t0.veh_maximum_capacity as capacity_fuel,
                                      t1.veh_compartment_number ,
                                      t1.veh_compartment_code
                                      from tbl_vehicle t0
                                      left join tbl_vehicle_compartment t1
                                      on t0.veh_code = t1.veh_code
                                      where t1.veh_code = '${veh_code}'
                                      and t1.veh_compartment_flag = '1' 
                                      and veh_compartment_code not in 
                                      (select veh_compartment_code from tbl_order where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') 
                                      and veh_compartment_code is not null

                                      union 

                                      select veh_compartment_code from tbl_order where veh_code = '${veh_code}' and veh_compartment_code is not null 
                                      and ord_status in ('0','1','2','3') and ord_flag = '1')

                                      order by t1.veh_compartment_number asc`;
                                      const vehTank = await pgConn.get(
                                        dbPrefix + lic_code,
                                        scriptVeh,
                                        config.connectionString(),
                                      );
                                      const vehTanksRaw = vehTank.data;

                                      if (
                                        orderItemRaw.length == 0 ||
                                        vehTanksRaw.length == 0
                                      ) {
                                        const response = [{
                                          status: "fail",
                                          invalid_code: "0",
                                          job_code: job_code,
                                          cancel: true,
                                          message: "ไม่สามารถคำนวณน้ำมันได้ ข้อมูลสินค้า หรือรถไม่ถูกต้อง",
                                          data: [],
                                          response_time: moment().format(
                                            "YYYY-MM-DD HH:mm:ss",
                                          ),
                                        },];
                                        res.status(200).send(response);
                                        return;
                                      }

                                      if (orderItemRaw[0].total_fuel > vehTanksRaw[0].capacity_fuel) {
                                        //  return;
                                        errors5 = `จำนวนน้ำมันเกินความจุรถ`;
                                      }

                                      // add plan
                                      script = `update tbl_job set
                                      mdf_dt = '${moment().format(
                                        "YYYY-MM-DD HH:mm:ss",
                                      )}',
                                      job_status = '2',
                                      veh_code = '${veh_code}'
                                      where job_code = '${job_code}';`;

                                      script = script.replace(
                                        /'NULL'/gi,
                                        "NULL",
                                      );
                                      let tbl_temporary = await pgConn.execute(
                                        dbPrefix + lic_code,
                                        script,
                                        config.connectionString(),
                                      );
                                      if (!tbl_temporary.code) {
                                        script = `update tbl_order set
                                        mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}',ord_status = '2',veh_code = '${veh_code}' 
                                        where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}');`;

                                        let tbl_temporary0x =
                                          await pgConn.execute(
                                            dbPrefix + lic_code,
                                            script,
                                            config.connectionString(),
                                          );
                                        if (!tbl_temporary0x.code) {
                                          var xindex = 0;
                                          for (var xxi = 0; xxi <= orderItemRaw.length - 1; xxi++) {
                                            let ord_veh_compartment_code = "jvhc-" + moment().format("x");

                                            if (orderItemRaw[xxi].veh_compartment_code != '') {
                                              script = `insert into tbl_order_compartment (ord_veh_compartment_code, ord_code, itm_code, itm_unit_code, item_quantity,
                                              ord_veh_compartment_flag, ist_dt, mdf_dt, rm_dt, veh_compartment_code, ptrl_tank_code)
                                              values ('${ord_veh_compartment_code}', '${orderItemRaw[xxi].ord_code}', '${orderItemRaw[xxi].itm_code}', '${orderItemRaw[xxi].itm_unit_code}',
                                              ${orderItemRaw[xxi].item_quantity}, '1','${moment().format("YYYY-MM-DD HH:mm:ss")}', NULL, NULL, '${orderItemRaw[xxi].veh_compartment_code}', '${orderItemRaw[xxi].ptrl_tank_code}');`;

                                              debugger;
                                              let tbl_temporary01x = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                                            }
                                            else {

                                              if (xindex <= vehTanksRaw.length - 1) {
                                                script = `insert into tbl_order_compartment (ord_veh_compartment_code, ord_code, itm_code, itm_unit_code, item_quantity,
                                                ord_veh_compartment_flag, ist_dt, mdf_dt, rm_dt, veh_compartment_code, ptrl_tank_code)
                                                values ('${ord_veh_compartment_code}', '${orderItemRaw[xxi].ord_code}', '${orderItemRaw[xxi].itm_code}', '${orderItemRaw[xxi].itm_unit_code}',
                                                ${orderItemRaw[xxi].item_quantity}, '1','${moment().format("YYYY-MM-DD HH:mm:ss")}', NULL, NULL, '${vehTanksRaw[xindex].veh_compartment_code}', '${orderItemRaw[xxi].ptrl_tank_code}');`;
                                                xindex += 1;

                                                debugger;
                                                let tbl_temporary01x = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                                              }
                                              else {
                                                xindex = 0;
                                                script = `insert into tbl_order_compartment (ord_veh_compartment_code, ord_code, itm_code, itm_unit_code, item_quantity,
                                                ord_veh_compartment_flag, ist_dt, mdf_dt, rm_dt, veh_compartment_code, ptrl_tank_code)
                                                values ('${ord_veh_compartment_code}', '${orderItemRaw[xxi].ord_code}', '${orderItemRaw[xxi].itm_code}', '${orderItemRaw[xxi].itm_unit_code}',
                                                ${orderItemRaw[xxi].item_quantity}, '1','${moment().format("YYYY-MM-DD HH:mm:ss")}', NULL, NULL, '${vehTanksRaw[xindex].veh_compartment_code}', '${orderItemRaw[xxi].ptrl_tank_code}');`;
                                                xindex += 1;

                                                debugger;
                                                let tbl_temporary01x = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
                                              }
                                            }

                                            if (xxi == orderItemRaw.length - 1) {
                                              //debugger
                                              let response = [{
                                                status: "success",
                                                invalid_code: "0",
                                                message: "1",
                                                data: [],
                                                response_time: moment().format(
                                                  "YYYY-MM-DD HH:mm:ss",
                                                ),
                                              },];

                                              // res.status(200).send(response);
                                              await xglobal.action_logs(
                                                lic_code,
                                                action[0].id,
                                                "กำหนดแผนงานข้อมูล Job:addPlanforVehicleOrderManage",
                                                JSON.stringify(req.body[0]),
                                                "success",
                                                action[0].value,
                                              );
                                            }
                                          }
                                        } else {
                                          let response = [{
                                            status: "error",
                                            invalid_code: "-5",
                                            message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                            data: [],
                                            response_time: moment().format(
                                              "YYYY-MM-DD HH:mm:ss",
                                            ),
                                          },];
                                          script = `update tbl_job set mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}',
                                          job_status = '1',
                                          dver_code = NULL,
                                          veh_code = NULL,
                                          transporeon_status = 'N'
                                          where job_code = '${job_code}';`;

                                          script = script.replace(
                                            /'NULL'/gi,
                                            "NULL",
                                          );
                                          let tbl_temporary =
                                            await pgConn.execute(
                                              dbPrefix + lic_code,
                                              script,
                                              config.connectionString(),
                                            );
                                          // res.status(200).send(response);
                                          await xglobal.action_logs(
                                            lic_code,
                                            action[0].id,
                                            "กำหนดแผนงานข้อมูล Job:addPlanforVehicleOrderManage",
                                            JSON.stringify(req.body[0]),
                                            "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
                                            action[0].value,
                                          );
                                          // return;
                                          errors4 = `กำหนดแผนงานข้อมูล Job ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`;
                                        }
                                      } else {
                                        let response = [{
                                          status: "error",
                                          invalid_code: "-3",
                                          message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                          data: [],
                                          response_time: moment().format(
                                            "YYYY-MM-DD HH:mm:ss",
                                          ),
                                        },];
                                        // res.status(200).send(response);
                                        await xglobal.action_logs(
                                          lic_code,
                                          action[0].id,
                                          "กำหนดแผนงานข้อมูล Job:addPlanforVehicleOrderManage",
                                          JSON.stringify(req.body[0]),
                                          "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
                                          action[0].value,
                                        );
                                        // return;
                                        errors4 = `กำหนดแผนงานข้อมูล Job ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`;
                                      }

                                      // end add plan
                                    } else {
                                      let response = [{
                                        status: "error",
                                        invalid_code: "-3",
                                        message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                        data: xresult,
                                        response_time: moment().format(
                                          "YYYY-MM-DD HH:mm:ss",
                                        ),
                                      },];
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

                                    script = `  select count(job_code) as dver_code from tbl_job where job_code = '${job_code}' and dver_code is null `;
                                    let tbl_temporarycheck = await pgConn.get(
                                      dbPrefix + lic_code,
                                      script,
                                      config.connectionString(),
                                    );

                                    console.log(
                                      tbl_temporarycheck,
                                      "tbl_temporarycheck",
                                    );
                                    console.log(
                                      tbl_temporarycheck.data[0].dver_code,
                                      "tbl_temporarycheck[0]",
                                    );

                                    let errorcoment = [];
                                    if (errors1 != "") {
                                      errorcoment.push(errors1);
                                    }
                                    if (errors2 != "") {
                                      errorcoment.push(errors2);
                                    }
                                    if (errors3 != "") {
                                      errorcoment.push(errors3);
                                    }
                                    if (errors4 != "") {
                                      errorcoment.push(errors4);
                                    }
                                    if (errors5 != "") {
                                      errorcoment.push(errors5);
                                    }
                                    if (errors6 != "") {
                                      errorcoment.push(errors6);
                                    }
                                    if (
                                      Number(
                                        tbl_temporarycheck.data[0].dver_code,
                                      ) > 0
                                    ) {
                                      console.log("moreeee");

                                      errorcoment.push("ไม่มีคนขับรถ");
                                    }

                                    let jobCommentText = errorcoment.join(", ");

                                    if (
                                      errors1 != "" ||
                                      errors2 != "" ||
                                      errors3 != "" ||
                                      errors4 != "" ||
                                      errors5 != "" ||
                                      Number(
                                        tbl_temporarycheck.data[0].dver_code,
                                      ) > 0
                                    ) {
                                      script = `update tbl_job set
                                                                        mdf_dt = '${moment().format(
                                        "YYYY-MM-DD HH:mm:ss",
                                      )}',
                                                                        job_status = '-2',
                                                                        veh_code = '${veh_code}',
                                                                        job_comment = '${jobCommentText}'
                                                                        where job_code = '${job_code}';`;

                                      script = script.replace(
                                        /'NULL'/gi,
                                        "NULL",
                                      );
                                      let tbl_temporary = await pgConn.execute(
                                        dbPrefix + lic_code,
                                        script,
                                        config.connectionString(),
                                      );
                                    }

                                    let response = [{
                                      status: "success",
                                      invalid_code: "0",
                                      message: `สร้างแผนงานสำเร็จ`,
                                      data: {
                                        job_code: job_code,
                                      },
                                      response_time: moment().format(
                                        "YYYY-MM-DD HH:mm:ss",
                                      ),
                                    },];
                                    res.status(200).send(response);
                                    await xglobal.action_logs(
                                      lic_code,
                                      action[0].id,
                                      "สร้างแผนงานสำเร็จ",
                                      JSON.stringify(req.body[0]),
                                      "สำเร็จ",
                                      action[0].value,
                                    );
                                    return;
                                  } else {
                                    let response = [{
                                      status: "error",
                                      invalid_code: "-4",
                                      message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                                      data: [],
                                      response_time: moment().format(
                                        "YYYY-MM-DD HH:mm:ss",
                                      ),
                                    },];
                                    // res.status(200).send(response);
                                    await xglobal.action_logs(
                                      lic_code,
                                      action[0].id,
                                      "สร้างใบงาน",
                                      JSON.stringify(req.body[0]),
                                      "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
                                      action[0].value,
                                    );
                                    // return;
                                    errors3 = `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`;
                                  }
                                }
                              })
                              .catch((error) => {
                                console.log(error);
                              });
                          }
                        }
                      }
                    } else {
                      debugger;
                    }
                  } catch (ex) {
                    debugger;
                  }
                } else {
                  let response = [{
                    status: "error",
                    invalid_code: "-4",
                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                  },];
                  res.status(200).send(response);
                  await xglobal.action_logs(
                    lic_code,
                    action[0].id,
                    "สร้างใบงาน",
                    JSON.stringify(req.body[0]),
                    "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
                    action[0].value,
                  );
                  return;
                }
              }
            }
          }

          debugger;
        } else {
          var xresult = [];
          if (ord_code.length >= 0) {
            for (var ord = 0; ord <= ord_code.length - 1; ord++) {
              xresult.push({
                shipments_code: ord_code[ord].toString(),
                status: "error",
                reason: "ไม่พบข้อมูล Order หรือ Order ยังไม่ได้ตรวจสอบ",
              });

              if (ord == ord_code.length - 1) {
                let response = [{
                  status: "success",
                  invalid_code: "0",
                  message: "3",
                  data: xresult,
                  response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                },];

                // res.status(200).send(response);
                await xglobal.action_logs(
                  lic_code,
                  action[0].id,
                  "สร้างใบงาน",
                  JSON.stringify(req.body[0]),
                  "ไม่สำเร็จ",
                  action[0].value,
                );
                // return;
                errors3 = `สร้างใบงาน ไม่สำเร็จ ไม่พบข้อมูล Order หรือ Order ยังไม่ได้ตรวจสอบ`;
              }
            }
          } else {
            let response = [{
              status: "success",
              invalid_code: "0",
              message: "2",
              data: xresult,
              response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
            },];

            // res.status(200).send(response);
            await xglobal.action_logs(
              lic_code,
              action[0].id,
              "สร้างใบงาน",
              JSON.stringify(req.body[0]),
              "ไม่สำเร็จ",
              action[0].value,
            );
            // return;
            errors3 = `สร้างใบงาน ไม่สำเร็จ`;
          }
        }
      } else {
        let response = [{
          status: "error",
          invalid_code: "-3",
          message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },];
        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "สร้างใบงาน",
          JSON.stringify(req.body[0]),
          "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
          action[0].value,
        );
        return;
      }
    }
  })().catch(async (err) => {
    console.log(err);
    let response = [{
      status: "error",
      invalid_code: "-4",
      message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
      data: xresult,
      response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
    },];
    res.status(200).send(response);
    await xglobal.action_logs(
      lic_code,
      action[0].id,
      "ดึงข้อมูลรถและหางลาก",
      JSON.stringify(req.body[0]),
      "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      action[0].value,
    );
    return;
  });
};

exports.getJobInformationforVehicle = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let {
      start_date,
      end_date,
      job_status,
      off_code,
      action
    } = req.body[0];
    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      start_date == undefined ||
      end_date == undefined ||
      job_status == undefined ||
      action == undefined
    ) {
      let response = [{
        status: "error",
        invalid_code: "-1",
        message: "ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
      },];

      res.status(200).send(response);
    } else {
      let script = ``;

      if (start_date.length == 10) {
        // start_date = start_date + 'T00:00:00.000Z'
        start_date = start_date;
      }

      if (end_date.length == 10) {
        // end_date = end_date + 'T23:59:59.000Z'
        end_date = end_date;
      }

      script = `select
                job_code, tms_transport_code, transport_code, tour_code, pull_code, number, document_reference,
                job_dt, job_status, job_comment, gsap_order_type_code, gsap_order_status, gsap_order_number,
                gsap_shipments_number, transporeon_status, off_code, job_flag, ist_dt, mdf_dt, rm_dt, loading_count,
                unloading_count, item_count, item_quantity, dver_code, veh_code, transporeon_result, transporeon_ist_dt, transporeon_mdf_dt,
                transporeon_rm_dt, distance, transit_start_dt, transit_end_dt, transit_minute
                from tbl_job where tbl_job.job_flag = '1' and transit_start_dt::date = '${start_date}' `;

      if (off_code.toString().toUpperCase() != "ALL") {
        script += ` and tbl_job.off_code = '${off_code}' `;
      }

      if (job_status.toString().toUpperCase() != "ALL") {
        script += ` and tbl_job.job_status = '${job_status}' `;
      }

      script += ` order by tbl_job.tms_transport_code asc `;

      let tbl_temporary = await pgConn.get(
        dbPrefix + lic_code,
        script,
        config.connectionString(),
      );
      if (!tbl_temporary.code) {
        //debugger
        if (tbl_temporary.data.length > 0) {
          tbl_temporary.data = JSON.parse(
            JSON.stringify(tbl_temporary.data).replace(/\:null/gi, ':""'),
          );

          let response = [{
            status: "success",
            invalid_code: "0",
            message: "",
            data: tbl_temporary.data,
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },];

          res.status(200).send(response);
          return;
        } else {
          let response = [{
            status: "success",
            invalid_code: "0",
            message: "",
            data: xresult,
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },];

          res.status(200).send(response);
          return;
        }
      } else {
        let response = [{
          status: "error",
          invalid_code: "-3",
          message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
          data: xresult,
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },];
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
    }
  })().catch(async (err) => {
    console.log(err);
    let response = [{
      status: "error",
      invalid_code: "-4",
      message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
      data: xresult,
      response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
    },];
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
  });
};

exports.getOrderInJobInformationEdit = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let {
      job_code,
      action
    } = req.body[0];
    //เช็คเฉพาะส่วนที่สำคัญ
    if (job_code == undefined || action == undefined) {
      let response = [{
        status: "error",
        invalid_code: "-1",
        message: "ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
      },];

      res.status(200).send(response);
    } else {
      let script1 = `select tbl_job_order.ord_code
            from tbl_job_order
            left join tbl_order on tbl_job_order.ord_code = tbl_order.ord_code
            where job_code = '${job_code}' and tbl_order.ord_flag = '1'`;

      let dataresult = await pgConn.get(
        dbPrefix + lic_code,
        script1,
        config.connectionString(),
      );
      let ord_code_array = dataresult.data.map((item) => `'${item.ord_code}'`);
      let ord_code = ord_code_array.join(", ");

      let script = ``;
      script = `select tbl_order_item.ord_item_code, tbl_order_depot.dpo_code, tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_depot.dpo_short_desc,
      case when tbl_order_depot.dpo_address is null then tbl_depot.dpo_address else tbl_order_depot.dpo_address end as dpo_address,
      case when tbl_order_depot.dpo_zip_code is null then tbl_depot.dpo_zip_code else tbl_order_depot.dpo_zip_code end as dpo_zip_code,
      case when tbl_order_depot.dpo_country_code is null then tbl_depot.dpo_country_code else tbl_order_depot.dpo_country_code end as dpo_country_code,
      case when tbl_order_depot.dpo_lat is null then tbl_depot.dpo_lat else tbl_order_depot.dpo_lat end as dpo_lat,
      case when tbl_order_depot.dpo_lon is null then tbl_depot.dpo_lon else tbl_order_depot.dpo_lon end as dpo_lon,
      case when tbl_order_depot.dpo_city is null then tbl_depot.dpo_city else tbl_order_depot.dpo_city end as dpo_city,
      tbl_depot.dpo_loading_minute, tbl_order_item.ord_code,
      tbl_order_item.itm_code, tbl_item.itm_desc, tbl_item.itm_short_desc, tbl_item.itm_image, tbl_item.itm_material_number, tbl_item_type.itm_type_code,
      tbl_item_type.itm_type_desc, tbl_order_item.itm_unit_code, tbl_item_unit.itm_unit_desc, tbl_item_unit.itm_unit_short_desc,tbl_order_item.item_quantity,
      tbl_petrol.ptrl_code, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_short_desc,
      case when tbl_order_petrol.ptrl_address is null then tbl_petrol.ptrl_address else tbl_order_petrol.ptrl_address end as ptrl_address,
      case when tbl_order_petrol.ptrl_zip_code is null then tbl_petrol.ptrl_zip_code else tbl_order_petrol.ptrl_zip_code end as ptrl_zip_code,
      case when tbl_order_petrol.ptrl_country_code is null then tbl_petrol.ptrl_country_code else tbl_order_petrol.ptrl_country_code end as ptrl_country_code,
      case when tbl_order_petrol.ptrl_lat is null then tbl_petrol.ptrl_lat else tbl_order_petrol.ptrl_lat end as ptrl_lat,
      case when tbl_order_petrol.ptrl_lon is null then tbl_petrol.ptrl_lon else tbl_order_petrol.ptrl_lon end as ptrl_lon,
      case when tbl_order_petrol.ptrl_city is null then tbl_petrol.ptrl_city else tbl_order_petrol.ptrl_city end as ptrl_city,
      tbl_petrol.ptrl_unloading_minute, tbl_order_item.ist_dt, tbl_order_item.mdf_dt, tbl_order_item.rm_dt, tbl_order_item.ptrl_tank_code, tbl_petrol_tank.tnk_number,
      case when shipments_code_new is null then '' else shipments_code_new end as shipments_code_new,
      case when ord_code_new is null then '' else ord_code_new end as ord_code_new,
      case when itm_code_new is null then '' else itm_code_new end as itm_code_new,
      case when ptrl_tank_code_new is null then '' else ptrl_tank_code_new end as ptrl_tank_code_new 
      ,tbl_item.itm_weight_litr_per_kg
      from tbl_order_item
      left join tbl_item on tbl_order_item.itm_code = tbl_item.itm_code
      left join tbl_item_type on tbl_item.itm_type_code = tbl_item_type.itm_type_code
      left join tbl_item_unit on tbl_item.itm_unit_code = tbl_item_unit.itm_unit_code
      left join tbl_order_depot on tbl_order_item.ord_code = tbl_order_depot.ord_code
      left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code
      left join tbl_order_petrol on tbl_order_item.ord_code = tbl_order_petrol.ord_code
      and tbl_order_item.itm_code = tbl_order_petrol.itm_code
      and tbl_order_item.ptrl_tank_code = tbl_order_petrol.ptrl_tank_code
      left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
      left join tbl_petrol_tank on tbl_petrol.ptrl_code = tbl_petrol_tank.ptrl_code
      and tbl_petrol_tank.ptrl_tank_code = tbl_order_item.ptrl_tank_code
      left join tbl_order on tbl_order_item.ord_code = tbl_order.ord_code
      where tbl_order_item.ord_code IN (select ord_code from tbl_job_order where job_code = '${job_code}')

      group by
      tbl_order_item.ord_item_code, tbl_order_depot.dpo_code, tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_depot.dpo_short_desc, tbl_depot.dpo_address,
      tbl_order_depot.dpo_address,tbl_depot.dpo_zip_code,tbl_order_depot.dpo_zip_code,tbl_depot.dpo_country_code,tbl_order_depot.dpo_country_code,
      tbl_depot.dpo_lat, tbl_order_depot.dpo_lat, tbl_depot.dpo_lon, tbl_order_depot.dpo_lon, tbl_order_depot.dpo_city, tbl_depot.dpo_loading_minute, tbl_order_item.ord_code,
      tbl_order_item.itm_code, tbl_item.itm_desc, tbl_item.itm_short_desc, tbl_item.itm_image, tbl_item.itm_material_number, tbl_item_type.itm_type_code,
      tbl_item_type.itm_type_desc, tbl_order_item.itm_unit_code, tbl_item_unit.itm_unit_desc, tbl_item_unit.itm_unit_short_desc,tbl_order_item.item_quantity,
      tbl_petrol.ptrl_code, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_short_desc,
      tbl_petrol.ptrl_address, tbl_petrol.ptrl_zip_code,tbl_petrol.ptrl_country_code, tbl_petrol.ptrl_lat, tbl_petrol.ptrl_lon,
      tbl_order_petrol.ptrl_address, tbl_order_petrol.ptrl_zip_code,tbl_order_petrol.ptrl_country_code, tbl_order_petrol.ptrl_lat, tbl_order_petrol.ptrl_lon,
      tbl_order_petrol.ptrl_city, tbl_petrol.ptrl_unloading_minute, tbl_order_item.ist_dt, tbl_order_item.mdf_dt,
      tbl_order_item.rm_dt, tbl_depot.dpo_city, tbl_petrol.ptrl_city, tbl_order_item.ptrl_tank_code, tbl_petrol_tank.tnk_number,
      shipments_code_new, ord_code_new, itm_code_new, ptrl_tank_code_new ,tbl_item.itm_weight_litr_per_kg`;

      script += ` order by tbl_order_item.ord_item_code asc `;

      let tbl_temporary = await pgConn.get(
        dbPrefix + lic_code,
        script,
        config.connectionString(),
      );
      if (!tbl_temporary.code) {
        //debugger
        if (tbl_temporary.data.length > 0) {
          tbl_temporary.data = JSON.parse(
            JSON.stringify(tbl_temporary.data).replace(/\:null/gi, ':""'),
          );

          let response = [{
            status: "success",
            invalid_code: "0",
            message: "",
            ord_code: JSON.stringify(ord_code),
            data: tbl_temporary.data,
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },];

          res.status(200).send(response);
          return;
        } else {
          let response = [{
            status: "success",
            invalid_code: "0",
            message: "",
            ord_code: JSON.stringify(ord_code),
            data: xresult,
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },];

          res.status(200).send(response);
          return;
        }
      } else {
        let response = [{
          status: "error",
          invalid_code: "-3",
          message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
          data: xresult,
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },];
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
    }
  })().catch(async (err) => {
    console.log(err);
    let response = [{
      status: "error",
      invalid_code: "-4",
      message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
      data: xresult,
      response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
    },];
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
  });
};

exports.getCompartmentJobForEdit = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let {
      job_code,
      action
    } = req.body[0];
    //เช็คเฉพาะส่วนที่สำคัญ
    if (job_code == undefined || lic_code == undefined || action == undefined) {
      let response = [{
        status: "error",
        invalid_code: "-1",
        message: "ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
      },];

      res.status(200).send(response);
    } else {
      let script = ``;
      script = `select
      veh_code,veh_license_number,veh_license_province,ord_veh_compartment_code,ord_code,shipments_code,itm_code,itm_desc,itm_material_number,itm_unit_code,itm_unit_desc,item_quantity,
      ord_veh_compartment_flag,veh_compartment_code,veh_compartment_number,ptrl_code,ptrl_desc,ptrl_number, ptrl_tank_code, tnk_number,
      tnk_capacity, tnk_target, tnk_deadstock, book_stock, average_daily_sales, (tnk_target - book_stock) as tank_space,
      case when tnk_capacity > 0 then ((tnk_target - book_stock) * 100 / tnk_capacity) else 0 end as tank_full,
      case when average_daily_sales > 0 then (book_stock - tnk_deadstock) / average_daily_sales else 0 end as tank_stock_days, tnk_fixed

      from
      (select tbl_vehicle.veh_code, tbl_vehicle.veh_license_number, tbl_vehicle.veh_license_province, ord_veh_compartment_code,
      tbl_order_compartment.ord_code, tbl_order.shipments_code,
      tbl_order_compartment.itm_code, tbl_item.itm_desc, tbl_item.itm_material_number,
      tbl_order_compartment.itm_unit_code, tbl_item_unit.itm_unit_desc, tbl_order_compartment.item_quantity,
      ord_veh_compartment_flag, tbl_order_compartment.veh_compartment_code, tbl_vehicle_compartment.veh_compartment_number,
      tbl_order_petrol.ptrl_code, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_number, tbl_order_petrol.ptrl_tank_code, tbl_petrol_tank.tnk_number,
      case when tbl_petrol_tank.tnk_capacity is null then 0 else tbl_petrol_tank.tnk_capacity end as tnk_capacity,
      case when tbl_petrol_tank.tnk_target is null then 0 else tbl_petrol_tank.tnk_target end as tnk_target,
      case when tbl_petrol_tank.tnk_deadstock is null then 0 else tbl_petrol_tank.tnk_deadstock end as tnk_deadstock,
      case when tbl_order_petrol.book_stock is null then 0 else tbl_order_petrol.book_stock end as book_stock,
      case when tbl_order_petrol.average_daily_sales is null then 0 else tbl_order_petrol.average_daily_sales end as average_daily_sales,
      case when tbl_order.veh_compartment_code = tbl_order_compartment.veh_compartment_code then '1' else '0' end as tnk_fixed

      from tbl_job
      left join tbl_order_compartment on tbl_order_compartment.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}')
      left join tbl_order_petrol on tbl_order_petrol.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}')
      and tbl_order_compartment.itm_code = tbl_order_petrol.itm_code
      and tbl_order_compartment.ptrl_tank_code = tbl_order_petrol.ptrl_tank_code
      left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
      left join tbl_vehicle on tbl_job.veh_code = tbl_vehicle.veh_code
      left join tbl_vehicle_compartment on tbl_vehicle.veh_code = tbl_vehicle_compartment.veh_code
      and tbl_vehicle_compartment.veh_compartment_code = tbl_order_compartment.veh_compartment_code
      left join tbl_item on tbl_order_compartment.itm_code = tbl_item.itm_code
      left join tbl_item_unit on tbl_order_compartment.itm_unit_code = tbl_item_unit.itm_unit_code
      left join tbl_order on tbl_order_compartment.ord_code = tbl_order.ord_code
      left join tbl_petrol_tank on tbl_order_petrol.ptrl_code = tbl_petrol_tank.ptrl_code
      and tbl_order_petrol.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code
      where tbl_job.job_code = '${job_code}'  and tbl_item_unit.itm_unit_code IS NOT NULL) xtbl_master

      group by veh_code,veh_license_number,veh_license_province,ord_veh_compartment_code,
      ord_code,shipments_code,itm_code,itm_desc,itm_material_number,itm_unit_code,itm_unit_desc,item_quantity,
      ord_veh_compartment_flag,veh_compartment_code,veh_compartment_number,ptrl_code,ptrl_desc,ptrl_number, ptrl_tank_code, tnk_number,
      tnk_capacity, tnk_target, tnk_deadstock, book_stock, average_daily_sales, tnk_fixed`;

      let tbl_temporary = await pgConn.get(
        dbPrefix + lic_code,
        script,
        config.connectionString(),
      );
      if (!tbl_temporary.code) {
        //debugger
        let response = [{
          status: "success",
          invalid_code: "0",
          message: "",
          data: tbl_temporary.data,
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },];

        res.status(200).send(response);
        return;
      } else {
        let response = [{
          status: "error",
          invalid_code: "-3",
          message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
          data: xresult,
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },];
        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "ดึงข้อมูลรถและหางลาก",
          JSON.stringify(req.body[0]),
          "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
          action[0].value,
        );
        return;
      }
    }
  })().catch(async (err) => {
    console.log(err);
    let response = [{
      status: "error",
      invalid_code: "-4",
      message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
      data: xresult,
      response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
    },];
    res.status(200).send(response);
    await xglobal.action_logs(
      lic_code,
      action[0].id,
      "ดึงข้อมูลรถและหางลาก",
      JSON.stringify(req.body[0]),
      "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      action[0].value,
    );
    return;
  });
};

exports.getCompartmentJobForEditWithOrderinTruck = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let {
      job_code,
      action
    } = req.body[0];
    //เช็คเฉพาะส่วนที่สำคัญ
    if (job_code == undefined || lic_code == undefined || action == undefined) {
      let response = [{
        status: "error",
        invalid_code: "-1",
        message: "ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
      },];

      res.status(200).send(response);
    } else {
      let script = ``;
      script = ` select row_number() over (order by unloading_start_dt) as sequence,veh_code, veh_license_number, veh_license_province, ord_veh_compartment_code, ord_code, 
      shipments_code, itm_code, itm_desc, itm_material_number, itm_unit_code, itm_unit_desc, 
      item_quantity, ord_veh_compartment_flag, veh_compartment_code, veh_compartment_number, 
      ptrl_code, ptrl_desc, ptrl_number, ptrl_tank_code, tnk_number, tnk_capacity, tnk_target, 
      tnk_deadstock, book_stock, average_daily_sales, tank_space, tank_full, tank_stock_days, 
      tnk_fixed, job_status, job_comment, transporeon_status, tms_transport_code, dpo_number, 
      dpo_desc, deadlock_dt, unloading_start_dt,item_quantity as expected_quantity, book_stock_dt
      from 

      (select
      veh_code,veh_license_number,veh_license_province,ord_veh_compartment_code,ord_code,shipments_code,itm_code,itm_desc,itm_material_number,itm_unit_code,itm_unit_desc,item_quantity,
      ord_veh_compartment_flag,veh_compartment_code,veh_compartment_number,ptrl_code,ptrl_desc,ptrl_number, ptrl_tank_code, tnk_number,
      tnk_capacity, tnk_target, tnk_deadstock, book_stock, average_daily_sales, (tnk_target - book_stock) as tank_space,
      case when tnk_capacity > 0 then ((tnk_target - book_stock) * 100 / tnk_capacity) else 0 end as tank_full,
      case when average_daily_sales > 0 then (book_stock - tnk_deadstock) / average_daily_sales else 0 end as tank_stock_days, tnk_fixed,
      job_status, job_comment, transporeon_status, tms_transport_code, dpo_number, dpo_desc, deadlock_dt, unloading_start_dt, book_stock_dt

      from
      (select tbl_vehicle.veh_code, tbl_vehicle.veh_license_number, tbl_vehicle.veh_license_province, ord_veh_compartment_code,
      tbl_order_compartment.ord_code, tbl_order.shipments_code,
      tbl_order_compartment.itm_code, tbl_item.itm_desc, tbl_item.itm_material_number,
      tbl_order_compartment.itm_unit_code, tbl_item_unit.itm_unit_desc, tbl_order_compartment.item_quantity,
      ord_veh_compartment_flag, tbl_order_compartment.veh_compartment_code, tbl_vehicle_compartment.veh_compartment_number,
      tbl_order_petrol.ptrl_code, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_number, tbl_order_petrol.ptrl_tank_code, tbl_petrol_tank.tnk_number,
      case when tbl_petrol_tank.tnk_capacity is null then 0 else tbl_petrol_tank.tnk_capacity end as tnk_capacity,
      case when tbl_petrol_tank.tnk_target is null then 0 else tbl_petrol_tank.tnk_target end as tnk_target,
      case when tbl_petrol_tank.tnk_deadstock is null then 0 else tbl_petrol_tank.tnk_deadstock end as tnk_deadstock,
      case when tbl_order_petrol.book_stock is null then 0 else tbl_order_petrol.book_stock end as book_stock,
      case when tbl_order_petrol.average_daily_sales is null then 0 else tbl_order_petrol.average_daily_sales end as average_daily_sales,
      case when tbl_order.veh_compartment_code = tbl_order_compartment.veh_compartment_code then '1' else '0' end as tnk_fixed,
      tbl_job.job_status, tbl_job.job_comment, tbl_job.transporeon_status, tbl_job.tms_transport_code, tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_order_petrol.deadlock_dt,
      tbl_order_petrol.unloading_start_dt, tbl_order_petrol.book_stock_dt

      from tbl_job
      left join tbl_order_compartment on tbl_order_compartment.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}')
      left join tbl_order_petrol on tbl_order_petrol.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}')
      and tbl_order_compartment.itm_code = tbl_order_petrol.itm_code
      and tbl_order_compartment.ptrl_tank_code = tbl_order_petrol.ptrl_tank_code
      left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
      left join tbl_vehicle on tbl_job.veh_code = tbl_vehicle.veh_code
      left join tbl_vehicle_compartment on tbl_vehicle.veh_code = tbl_vehicle_compartment.veh_code
      and tbl_vehicle_compartment.veh_compartment_code = tbl_order_compartment.veh_compartment_code
      left join tbl_item on tbl_order_compartment.itm_code = tbl_item.itm_code
      left join tbl_item_unit on tbl_order_compartment.itm_unit_code = tbl_item_unit.itm_unit_code
      left join tbl_order on tbl_order_compartment.ord_code = tbl_order.ord_code
      left join tbl_petrol_tank on tbl_order_petrol.ptrl_code = tbl_petrol_tank.ptrl_code
      and tbl_order_petrol.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code
      left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code
      left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code 
      where tbl_job.job_code = '${job_code}'  and tbl_item_unit.itm_unit_code IS NOT NULL) xtbl_master

      group by veh_code,veh_license_number,veh_license_province,ord_veh_compartment_code,
      ord_code,shipments_code,itm_code,itm_desc,itm_material_number,itm_unit_code,itm_unit_desc,item_quantity,
      ord_veh_compartment_flag,veh_compartment_code,veh_compartment_number,ptrl_code,ptrl_desc,ptrl_number, ptrl_tank_code, tnk_number,
      tnk_capacity, tnk_target, tnk_deadstock, book_stock, average_daily_sales, tnk_fixed,
      job_status, job_comment, transporeon_status, tms_transport_code, dpo_number, dpo_desc, deadlock_dt, unloading_start_dt, book_stock_dt

      union 

      select
      veh_code,veh_license_number,veh_license_province,'' as ord_veh_compartment_code,ord_code,shipments_code,itm_code,itm_desc,itm_material_number,itm_unit_code,itm_unit_desc,item_quantity,
      '' as ord_veh_compartment_flag,veh_compartment_code,veh_compartment_number,ptrl_code,ptrl_desc,ptrl_number, ptrl_tank_code, tnk_number,
      tnk_capacity, tnk_target, tnk_deadstock, book_stock, average_daily_sales, (tnk_target - book_stock) as tank_space,
      case when tnk_capacity > 0 then ((tnk_target - book_stock) * 100 / tnk_capacity) else 0 end as tank_full,
      case when average_daily_sales > 0 then (book_stock - tnk_deadstock) / average_daily_sales else 0 end as tank_stock_days, tnk_fixed,
      job_status, job_comment, transporeon_status, tms_transport_code, dpo_number, dpo_desc, deadlock_dt, unloading_start_dt, book_stock_dt

      from
      (select tbl_vehicle.veh_code, tbl_vehicle.veh_license_number, tbl_vehicle.veh_license_province,
      tbl_order.ord_code, tbl_order.shipments_code,
      tbl_order_item.itm_code, tbl_item.itm_desc, tbl_item.itm_material_number,
      tbl_order_item.itm_unit_code, tbl_item_unit.itm_unit_desc, tbl_order_item.item_quantity,
      tbl_vehicle_compartment.veh_compartment_code, tbl_vehicle_compartment.veh_compartment_number,
      tbl_order_petrol.ptrl_code, tbl_petrol.ptrl_desc, tbl_petrol.ptrl_number, tbl_order_petrol.ptrl_tank_code, tbl_petrol_tank.tnk_number,
      case when tbl_petrol_tank.tnk_capacity is null then 0 else tbl_petrol_tank.tnk_capacity end as tnk_capacity,
      case when tbl_petrol_tank.tnk_target is null then 0 else tbl_petrol_tank.tnk_target end as tnk_target,
      case when tbl_petrol_tank.tnk_deadstock is null then 0 else tbl_petrol_tank.tnk_deadstock end as tnk_deadstock,
      case when tbl_order_petrol.book_stock is null then 0 else tbl_order_petrol.book_stock end as book_stock,
      case when tbl_order_petrol.average_daily_sales is null then 0 else tbl_order_petrol.average_daily_sales end as average_daily_sales,
      case when tbl_order.veh_compartment_code = tbl_vehicle_compartment.veh_compartment_code then '2' else '0' end as tnk_fixed,
      tbl_order.ord_status as job_status, tbl_order.ord_comment as job_comment, 'N' :: text as transporeon_status,
      '' :: text as tms_transport_code, tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_order_petrol.deadlock_dt, tbl_order_petrol.unloading_start_dt,
      tbl_order_petrol.book_stock_dt

      from tbl_order
      left join tbl_order_item on tbl_order.ord_code = tbl_order_item.ord_code
      left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code
      left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
      left join tbl_vehicle on tbl_order.veh_code = tbl_vehicle.veh_code
      left join tbl_vehicle_compartment on tbl_vehicle.veh_code = tbl_vehicle_compartment.veh_code
      left join tbl_item on tbl_order_item.itm_code = tbl_item.itm_code
      left join tbl_item_unit on tbl_order_item.itm_unit_code = tbl_item_unit.itm_unit_code
      left join tbl_petrol_tank on tbl_order_petrol.ptrl_code = tbl_petrol_tank.ptrl_code
      and tbl_order_petrol.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code
      left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code
      left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code

      where tbl_order.ord_code in (select ord_code from tbl_order where veh_code in (select veh_code from tbl_job where job_code = '${job_code}')
      and ord_status in ('0','1','2','3') and ord_flag = '1' 
      and ord_type_code = 'otyp-9999999999996'
      and ord_code not in (select ord_code from tbl_job_order where job_code = '${job_code}')) 

      and tbl_vehicle_compartment.veh_compartment_code in 

      (select veh_compartment_code from tbl_order where veh_code in (select veh_code from tbl_job where job_code = '${job_code}')
      and ord_status in ('0','1','2','3') and ord_flag = '1' 
      and ord_type_code = 'otyp-9999999999996'
      and ord_code not in (select ord_code from tbl_job_order where job_code = '${job_code}'))) xtbl_master

      group by veh_code,veh_license_number,veh_license_province,ord_veh_compartment_code,
      ord_code,shipments_code,itm_code,itm_desc,itm_material_number,itm_unit_code,itm_unit_desc,item_quantity,
      ord_veh_compartment_flag,veh_compartment_code,veh_compartment_number,ptrl_code,ptrl_desc,ptrl_number, ptrl_tank_code, tnk_number,
      tnk_capacity, tnk_target, tnk_deadstock, book_stock, average_daily_sales, tnk_fixed,
      job_status, job_comment, transporeon_status, tms_transport_code, shipments_code, dpo_number, dpo_desc, deadlock_dt, unloading_start_dt, book_stock_dt) xtbl_full_master

      order by unloading_start_dt asc`;

      let tbl_temporary = await pgConn.get(
        dbPrefix + lic_code,
        script,
        config.connectionString(),
      );
      if (!tbl_temporary.code) {
        //debugger
        tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

        let response = [{
          status: "success",
          invalid_code: "0",
          message: "",
          data: tbl_temporary.data,
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },];

        res.status(200).send(response);
        return;
      } else {
        let response = [{
          status: "error",
          invalid_code: "-3",
          message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
          data: xresult,
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },];
        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "ดึงข้อมูลรถและหางลาก",
          JSON.stringify(req.body[0]),
          "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
          action[0].value,
        );
        return;
      }
    }
  })().catch(async (err) => {
    console.log(err);
    let response = [{
      status: "error",
      invalid_code: "-4",
      message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
      data: xresult,
      response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
    },];
    res.status(200).send(response);
    await xglobal.action_logs(
      lic_code,
      action[0].id,
      "ดึงข้อมูลรถและหางลาก",
      JSON.stringify(req.body[0]),
      "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      action[0].value,
    );
    return;
  });
};

exports.updateVehicleForManageOrder = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let {
      item,
      job_code,
      dver_code,
      pkg_code,
      off_code,
      action
    } =
      req.body[0];
    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      item == undefined ||
      job_code == undefined ||
      dver_code == undefined ||
      off_code == undefined ||
      lic_code == undefined ||
      action == undefined
    ) {
      let response = [{
        status: "error",
        invalid_code: "-1",
        message: "ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
      },];

      res.status(200).send(response);
    } else {

      if (pkg_code == undefined) {
        pkg_code = '';
      }

      let script = ``;
      script = `update tbl_job set dver_code = '${dver_code}',pkg_code = '${pkg_code}',job_status = '2' ,job_comment = '' where job_code = '${job_code}'`;

      script = script.replace(/'NULL'/gi, "NULL");
      let tbl_temporary = await pgConn.execute(
        dbPrefix + lic_code,
        script,
        config.connectionString(),
      );

      //rechecked depot
      var dpo_code = '';
      var loading_start_dt = '';
      var loading_end_dt = ''

      script = `select dpo_code, loading_start_dt, loading_end_dt from tbl_order_depot 
      where ord_code in 
      (select ord_code from tbl_job_order where job_code = '${job_code}');`;

      let tbl_temporary_depot = await pgConn.get(
        dbPrefix + lic_code,
        script,
        config.connectionString(),
      );

      let xorder = [];
      let check = true;
      let fitem = item;
      let fitem2 = item;
      if (fitem.length > 0) {
        debugger;
        for (var xx = 0; xx <= fitem.length - 1; xx++) {
          script = `update tbl_order_item set
            item_quantity = '${fitem[xx].item_quantity}',
            ptrl_tank_code = '${fitem[xx].ptrl_tank_code}' 
            where ord_item_code = '${fitem[xx].ord_item_code}'
            and ord_code = '${fitem[xx].ord_code}' and itm_code = '${fitem[xx].itm_code}'`;

          script = script.replace(/'NULL'/gi, "NULL");
          let tbl_temporary = await pgConn.execute(
            dbPrefix + lic_code,
            script,
            config.connectionString(),
          );


          //update order 
          if (fitem[xx].tnk_fixed == '1') {
            script = `update tbl_order
              set shipments_code_new = '${fitem[xx].shipments_code_new}',
              ord_code_new = '${fitem[xx].ord_code_new}',
              itm_code_new = '${fitem[xx].itm_code_new}',
              ptrl_tank_code_new = '${fitem[xx].ptrl_tank_code_new}'
              where ord_code = '${fitem[xx].ord_code}'`;

            let tbl_temporary323 = await pgConn.execute(
              dbPrefix + lic_code,
              script,
              config.connectionString(),
            );
          }
        }

        if (fitem2.length > 0) {
          debugger;
          script = `delete from tbl_order_compartment where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}')`
          let tbl_temporary002 = await pgConn.execute(
            dbPrefix + lic_code,
            script,
            config.connectionString(),
          );

          for (var xx = 0; xx <= fitem2.length - 1; xx++) {

            debugger
            if (fitem2[xx].compartment_quantity.length > 0) {

              for (var xxi1 = 0; xxi1 <= fitem2[xx].compartment_quantity.length - 1; xxi1++) {
                let ord_veh_compartment_code = "jvhc-" + moment().format("x");

                script = `insert into tbl_order_compartment (ord_veh_compartment_code, ord_code, itm_code, itm_unit_code, item_quantity,
                ord_veh_compartment_flag, ist_dt, mdf_dt, rm_dt, veh_compartment_code, ptrl_tank_code)
                values ('${ord_veh_compartment_code}', '${fitem2[xx].ord_code}', '${fitem2[xx].itm_code}', '${fitem2[xx].itm_unit_code}',
                ${fitem2[xx].compartment_quantity[xxi1].item_quantity}, '1','${moment().format("YYYY-MM-DD HH:mm:ss")}', NULL, NULL, '${fitem2[xx].compartment_quantity[xxi1].veh_compartment_code}', '${fitem2[xx].ptrl_tank_code}');`;

                script = script.replace(/'NULL'/gi, "NULL");
                debugger
                let tbl_temporary2 = await pgConn.execute(
                  dbPrefix + lic_code,
                  script,
                  config.connectionString(),
                );
              }

            }

            if (xorder.indexOf(fitem2[xx].ord_code) == -1) {
              xorder.push(fitem2[xx].ord_code);
            }
          }

          //update master order
          if (xorder.length > 0) {
            for (var xor1 = 0; xor1 <= xorder.length - 1; xor1++) {
              script = `update tbl_order
              set item_count = (select count(itm_code) from tbl_order_item where ord_code = '${xorder[xor1]}' and ord_item_flag = '1'),
              item_quantity = (select sum(item_quantity) from tbl_order_item where ord_code = '${xorder[xor1]}' and ord_item_flag = '1'),
              loading_count = (select count(distinct dpo_code) from tbl_order_depot where ord_code = '${xorder[xor1]}' and ord_depot_flag = '1'),
              unloading_count = (select count(distinct ptrl_code) from tbl_order_petrol where ord_code = '${xorder[xor1]}' and ord_petrol_flag = '1')
              where ord_code = '${xorder[xor1]}'`;

              let tbl_temporary3 = await pgConn.execute(
                dbPrefix + lic_code,
                script,
                config.connectionString(),
              );

              if (xor1 == xorder.length - 1) {
                script = `update tbl_order set (veh_code, dver_code) =
                (select veh_code, dver_code from tbl_job where job_code = '${job_code}')
                where tbl_order.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}')`;

                let tbl_temporary4 = await pgConn.execute(
                  dbPrefix + lic_code,
                  script,
                  config.connectionString(),
                );
                var xtmp_status = await xglobal.postJob2TmpWithShipment(
                  lic_code,
                  job_code,
                  action
                );

                if (xtmp_status) {
                  // res.status(200).send(response);
                  await xglobal.action_logs(
                    lic_code,
                    action[0].id,
                    "กำหนดแผนงานข้อมูล Job:updateVehicleForManageOrder " + xtmp_status,
                    JSON.stringify(req.body[0]),
                    "success",
                    action[0].value,
                  );
                }
                else {
                  let response = [{
                    status: "error",
                    invalid_code: "-4",
                    message: `ข้อมูล Tank น้ำมันไม่ถูกต้อง, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                  },];

                  res.status(200).send(response);
                  return;
                }

              }
            }
          }

          let response = [{
            status: "success",
            invalid_code: "0",
            message: "",
            data: "",
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },];

          res.status(200).send(response);
          await xglobal.action_logs(
            lic_code,
            action[0].id,
            "แก้ไขข้อมูลจำนวนสินค้าและช่องน้ำมัน:updateVehicleForManageOrder",
            JSON.stringify(req.body[0]),
            "สำเร็จ",
            action[0].value,
          );
          return;
        }
      } else {
        let response = [{
          status: "error",
          invalid_code: "-4",
          message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
          data: [],
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },];

        res.status(200).send(response);
        await xglobal.action_logs(
          lic_code,
          action[0].id,
          "แก้ไขข้อมูลจำนวนสินค้าและช่องน้ำมัน",
          JSON.stringify(req.body[0]),
          "ไม่สำเร็จ",
          action[0].value,
        );
        return;
      }
    }
  })().catch(async (err) => {
    console.log(err);
    let response = [{
      status: "error",
      invalid_code: "-4",
      message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
      data: xresult,
      response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
    },];
    res.status(200).send(response);
    await xglobal.action_logs(
      lic_code,
      action[0].id,
      "แก้ไขข้อมูลจำนวนสินค้าและช่องน้ำมัน:updateVehicleForManageOrder",
      JSON.stringify(req.body[0]),
      "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      action[0].value,
    );
    return;
  });
};

exports.getDataWorkSheetJobCode = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let {
      job_code,
      off_code,
      action
    } = req.body[0];
    //เช็คเฉพาะส่วนที่สำคัญ
    if (job_code == undefined || action == undefined) {
      let response = [{
        status: "error",
        invalid_code: "-1",
        message: "ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
      },];

      res.status(200).send(response);
    } else {
      let script = ``;

      script = `select
      job_code, tms_transport_code, transport_code, tour_code, pull_code, number, document_reference,
      job_dt, job_status, job_comment, gsap_order_type_code, gsap_order_status, gsap_order_number,
      gsap_shipments_number, transporeon_status, off_code, job_flag, ist_dt, mdf_dt, rm_dt, loading_count,
      unloading_count, item_count, item_quantity, dver_code, veh_code, transporeon_result, transporeon_ist_dt, transporeon_mdf_dt,
      transporeon_rm_dt, distance, transit_start_dt, transit_end_dt, transit_minute, case when pkg_code is null then '' else pkg_code end as pkg_code 
      from tbl_job where tbl_job.job_flag = '1' and tbl_job.job_code = '${job_code}'`;

      let tbl_temporary = await pgConn.get(
        dbPrefix + lic_code,
        script,
        config.connectionString(),
      );
      if (!tbl_temporary.code) {
        //debugger
        if (tbl_temporary.data.length > 0) {
          let response = [{
            status: "success",
            invalid_code: "0",
            message: "",
            data: tbl_temporary.data,
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },];

          res.status(200).send(response);
          return;
        } else {
          let response = [{
            status: "success",
            invalid_code: "0",
            message: "",
            data: xresult,
            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
          },];

          res.status(200).send(response);
          return;
        }
      } else {
        let response = [{
          status: "error",
          invalid_code: "-3",
          message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
          data: xresult,
          response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
        },];
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
    }
  })().catch(async (err) => {
    console.log(err);
    let response = [{
      status: "error",
      invalid_code: "-4",
      message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
      data: xresult,
      response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
    },];
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
  });
};

exports.setRouteOfPlanInformation = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let {
      transit_start_dt,
      job_code,
      pkg_code,
      action
    } = req.body[0];
    //เช็คเฉพาะส่วนที่สำคัญ
    if (transit_start_dt == undefined || job_code == undefined || lic_code == undefined || action == undefined) {

      let response = [{
        status: "error",
        invalid_code: "-1",
        message: "ไม่สามารถบันทึกข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
        data: xresult,
        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
      },];

      res.status(200).send(response);
      return;
    } else {
      try {
        var script = ``;

        if (pkg_code == undefined) {
          pkg_code = '';

          script = `update tbl_job set pkg_code = (select dpo_code from tbl_order_depot 
          where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}')
          order by loading_start_dt asc limit 1) where job_code = '${job_code}'`
          await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
        }

        //get location code from vehicle type
        script = `select case when tbl_vehicle_type.unloading_minute is null then 0 else tbl_vehicle_type.unloading_minute end unloading_minute, 
        case when tbl_vehicle_type.loading_minute is null then 0 else tbl_vehicle_type.loading_minute end as loading_minute from tbl_vehicle_type 
        left join tbl_vehicle on tbl_vehicle_type.veh_type_code = tbl_vehicle.veh_type_code
        where tbl_vehicle.veh_code in (select veh_code from tbl_job where job_code = '${job_code}')`;
        let tbl_veh_minute = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

        var veh_unloading_minute = 0;
        var veh_loading_minute = 0;

        if (!tbl_veh_minute.code) {
          if (tbl_veh_minute.data.length > 0) {
            veh_unloading_minute = parseInt(tbl_veh_minute.data[0].unloading_minute)
            veh_loading_minute = parseInt(tbl_veh_minute.data[0].loading_minute)
          }
        }

        script = `select location_type_code, location_type_desc, location_code, location_number, location_desc, location_address, location_zip_code, location_country_code, location_lat, location_lon, location_city,
        location_minute, min(start_dt) as start_dt, max(end_dt) as end_dt, location_distance, location_req

        from
        (select 'depot' AS location_type_code, 'สถานที่โหลดน้ำมัน' as location_type_desc ,tbl_order_depot.dpo_code as location_code, tbl_depot.dpo_number as location_number, tbl_depot.dpo_desc as location_desc,
        case when tbl_order_depot.dpo_address is null then tbl_depot.dpo_address else tbl_order_depot.dpo_address end as location_address,
        case when tbl_order_depot.dpo_zip_code is null then tbl_depot.dpo_zip_code else tbl_order_depot.dpo_zip_code end as location_zip_code,
        case when tbl_order_depot.dpo_country_code is null then tbl_depot.dpo_country_code else tbl_order_depot.dpo_country_code end as location_country_code,
        case when tbl_order_depot.dpo_lat is null then tbl_depot.dpo_lat else tbl_order_depot.dpo_lat end as location_lat,
        case when tbl_order_depot.dpo_lon is null then tbl_depot.dpo_lon else tbl_order_depot.dpo_lon end as location_lon,
        case when tbl_order_depot.dpo_city is null then tbl_depot.dpo_city else tbl_order_depot.dpo_city end as location_city,
        tbl_depot.dpo_loading_minute as location_minute, tbl_order_depot.loading_start_dt as start_dt, tbl_order_depot.loading_end_dt as end_dt, 0.0 as location_distance, 0 as location_req

        from tbl_order
        left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code
        left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code
        where tbl_order.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') and tbl_order.ord_flag = '1' and tbl_order_depot.ord_depot_flag = '1'

        union

        select 'petrol' AS location_type_code, 'สถานที่ลงน้ำมัน' as location_type_desc, tbl_order_petrol.ptrl_code as location_code, tbl_petrol.ptrl_number as location_number, tbl_petrol.ptrl_desc as location_desc,
        case when tbl_order_petrol.ptrl_address is null then tbl_petrol.ptrl_address else tbl_order_petrol.ptrl_address end as location_address,
        case when tbl_order_petrol.ptrl_zip_code is null then tbl_petrol.ptrl_zip_code else tbl_order_petrol.ptrl_zip_code end as location_zip_code,
        case when tbl_order_petrol.ptrl_country_code is null then tbl_petrol.ptrl_country_code else tbl_order_petrol.ptrl_country_code end as location_country_code,
        case when tbl_order_petrol.ptrl_lat is null then tbl_petrol.ptrl_lat else tbl_order_petrol.ptrl_lat end as location_lat,
        case when tbl_order_petrol.ptrl_lon is null then tbl_petrol.ptrl_lon else tbl_order_petrol.ptrl_lon end as location_lon,
        case when tbl_order_petrol.ptrl_city is null then tbl_petrol.ptrl_city else tbl_order_petrol.ptrl_city end as location_city,
        tbl_petrol.ptrl_unloading_minute as location_minute, tbl_order_petrol.unloading_start_dt as start_dt, tbl_order_petrol.unloading_end_dt as end_dt, 0.0 as location_distance, 1 as location_req
        from tbl_order
        left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code
        left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
        where tbl_order.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') and tbl_order.ord_flag = '1' and tbl_order_petrol.ord_petrol_flag = '1'
        
        union

        select 'yard' AS location_type_code, 'สถานที่จอดหลังจากขนส่ง' as location_type_desc ,tbl_job.pkg_code as location_code, tbl_depot.dpo_number as location_number, tbl_depot.dpo_desc as location_desc,
        tbl_depot.dpo_address as location_address,
        tbl_depot.dpo_zip_code as location_zip_code,
        tbl_depot.dpo_country_code as location_country_code,
        tbl_depot.dpo_lat as location_lat,
        tbl_depot.dpo_lon as location_lon,
        tbl_depot.dpo_city as location_city,
        0 as location_minute,tbl_job.transit_end_dt as start_dt,tbl_job.transit_end_dt as end_dt, 0.0 as location_distance, 2 as location_req

        from tbl_job
        left join tbl_depot on tbl_job.pkg_code = tbl_depot.dpo_code
        where tbl_job.job_code = '${job_code}') xtblmaster

        group by
        location_type_code, location_type_desc, location_code, location_number, location_desc, location_address, location_zip_code, location_country_code, location_lat, location_lon, location_city,
        location_minute, location_distance, location_req
        order by location_type_code,location_req asc `;

        let tbl_route = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
        debugger;
        if (!tbl_route.code) {
          if (tbl_route.data.length > 0) {
            tbl_route.data = JSON.parse(JSON.stringify(tbl_route.data).replace(/\:null/gi, ':""'));

            xresult = [];
            var xlat = 0.0;
            var xlon = 0.0;
            var xurl = "";
            var xtransit_master_dt = transit_start_dt;
            var transit_end_dt = transit_start_dt;
            var xdistance = 0.0;
            var xtime = 0.0;
            for (var xlocation = 0; xlocation <= tbl_route.data.length - 1; xlocation++) {
              debugger;
              var location_minute = 0;
              try {
                location_minute = parseInt(tbl_route.data[xlocation].location_minute);
              } catch (ex) {
                location_minute = 0;
              }

              if (xlocation == 0) {
                xlat = parseFloat(tbl_route.data[xlocation].location_lat);
                xlon = parseFloat(tbl_route.data[xlocation].location_lon);

                if (tbl_route.data[xlocation].location_type_code == "depot") {
                  //update depot
                  if (transit_start_dt != undefined) {
                    script = `update tbl_order_depot set loading_start_dt = '${moment(transit_start_dt).format("YYYY-MM-DD HH:mm:ss")}',
                    loading_end_dt = '${moment(transit_start_dt).add("minutes", (location_minute + veh_loading_minute)).format("YYYY-MM-DD HH:mm:ss")}'
                    where tbl_order_depot.dpo_code = '${tbl_route.data[xlocation].location_code}' 
                    and tbl_order_depot.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}');`;

                    let tbl_temporary001 = await pgConn.execute(
                      dbPrefix + lic_code,
                      script,
                      config.connectionString(),
                    );

                    transit_end_dt = moment(transit_start_dt).add("minutes", (location_minute + veh_loading_minute)).format("YYYY-MM-DD HH:mm:ss");
                  }
                }
              } else {
                xurl = `https://wps.hereapi.com/v8/findsequence2?start=start1;${xlat},${xlon}&departure=${moment(transit_end_dt).format("YYYY-MM-DDTHH:mm:ss")}%2b07:00&end=end1;${tbl_route.data[xlocation].location_lat},${tbl_route.data[xlocation].location_lon}&mode=shortest;truck&apiKey=${xapikey}`;
                xlat = parseFloat(tbl_route.data[xlocation].location_lat);
                xlon = parseFloat(tbl_route.data[xlocation].location_lon);

                let xconfig = {
                  method: "get",
                  maxBodyLength: Infinity,
                  url: xurl,
                  headers: {
                    "Content-Type": "application/json",
                  },
                };

                await axios
                  .request(xconfig)
                  .then(async (response) => {
                    debugger;
                    console.log(JSON.stringify(response.data));

                    //update ทุก drop ให้เวลาเดียวกัน
                    if (tbl_route.data[xlocation].location_type_code == "depot") {

                      if (response.data.results.length > 0) {
                        if (response.data.results[0].distance != undefined) {
                          try {
                            tbl_route.data[xlocation].location_distance = parseFloat(response.data.results[0].distance) / 1000;
                            transit_start_dt = moment(transit_end_dt).add("seconds", parseFloat(response.data.results[0].time)).format("YYYY-MM-DD HH:mm:ss");
                            transit_end_dt = moment(transit_start_dt).add("minutes", location_minute + veh_loading_minute).format("YYYY-MM-DD HH:mm:ss");
                            xdistance += tbl_route.data[xlocation].location_distance;
                            xtime += parseFloat(response.data.results[0].time) / 60;
                          } catch (ex) { }
                        }
                      }

                      //update depot
                      if (transit_start_dt != undefined) {
                        script = `update tbl_order_depot 
                        set loading_start_dt = '${moment(transit_start_dt).format("YYYY-MM-DD HH:mm:ss")}',loading_end_dt = '${moment(transit_end_dt).format("YYYY-MM-DD HH:mm:ss")}' 
                        where tbl_order_depot.dpo_code = '${tbl_route.data[xlocation].location_code}'
                        and tbl_order_depot.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}');`;

                        let tbl_temporary001 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

                        if (pkg_code == '') {
                          pkg_code = tbl_route.data[xlocation].location_code;
                        }

                      }
                    } else {
                      //update petrol
                      if (response.data.results.length > 0) {
                        if (response.data.results[0].distance != undefined) {
                          try {
                            tbl_route.data[xlocation].location_distance = parseFloat(response.data.results[0].distance) / 1000;
                            transit_start_dt = moment(transit_end_dt).add("seconds", parseFloat(response.data.results[0].time)).format("YYYY-MM-DD HH:mm:ss");
                            transit_end_dt = moment(transit_start_dt).add("minutes", location_minute + veh_unloading_minute).format("YYYY-MM-DD HH:mm:ss");
                            xdistance += tbl_route.data[xlocation].location_distance;
                            xtime += parseFloat(response.data.results[0].time) / 60;
                          } catch (ex) { }
                        }
                      }
                      debugger;
                      if (transit_start_dt != undefined && transit_end_dt != undefined) {
                        script = `update tbl_order_petrol
                        set unloading_start_dt = '${moment(transit_start_dt).format("YYYY-MM-DD HH:mm:ss")}',
                        unloading_end_dt = '${moment(transit_end_dt).format("YYYY-MM-DD HH:mm:ss")}'
                        where tbl_order_petrol.ptrl_code = '${tbl_route.data[xlocation].location_code}'
                        and tbl_order_petrol.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}');`;

                        let tbl_temporary001 = await pgConn.execute(
                          dbPrefix + lic_code,
                          script,
                          config.connectionString(),
                        );

                        console.log("update petrol transit_start_dt,", moment(transit_start_dt).format("YYYY-MM-DD HH:mm:ss"));
                      }
                    }

                    if (xlocation == tbl_route.data.length - 1) {

                      try {
                        var a = moment(transit_end_dt); //now
                        var b = moment(xtransit_master_dt);
                        xtime = a.diff(b, "minutes");
                        debugger;
                      } catch (ex) {
                        debugger;
                      }

                      script = `update tbl_job
                      set item_count = (select count(distinct itm_code) from tbl_order_item where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') and ord_item_flag = '1'),
                      item_quantity = (select sum(item_quantity) from tbl_order_item where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') and ord_item_flag = '1'),
                      loading_count = (select count(distinct dpo_code) from tbl_order_depot where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') and ord_depot_flag = '1'),
                      unloading_count = (select count(distinct ptrl_code) from tbl_order_petrol where ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}') and ord_petrol_flag = '1'),
                      transit_start_dt = '${moment(xtransit_master_dt).format("YYYY-MM-DD HH:mm:ss")}',transit_end_dt = '${moment(transit_end_dt).format("YYYY-MM-DD HH:mm:ss")}',
                      transit_minute = ${xtime}, distance = ${xdistance} where job_code = '${job_code}'`;

                      let tbl_temporary001 = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());

                      if (!tbl_temporary001.code) {
                        let response = [{
                          status: "success",
                          invalid_code: "0",
                          message: "1",
                          data: [],
                          response_time: moment().format(
                            "YYYY-MM-DD HH:mm:ss",
                          ),
                        },];

                        res.status(200).send(response);
                        await xglobal.action_logs(
                          lic_code,
                          action[0].id,
                          "อัพเดทข้อมูลวันเวลาในการขนส่ง",
                          JSON.stringify(req.body[0]),
                          "success",
                          action[0].value,
                        );
                        return;
                      }
                    }
                  })
                  .catch((error) => {
                    console.log(error);
                  });
              }
            }
          }
        } else {
          debugger;
        }
      } catch (ex) {
        debugger;
      }
    }
  })().catch(async (err) => {
    console.log(err);
    let response = [{
      status: "error",
      invalid_code: "-4",
      message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
      data: xresult,
      response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
    },];
    res.status(200).send(response);
    await xglobal.action_logs(
      lic_code,
      action[0].id,
      "อัพเดทข้อมูลวันเวลาในการขนส่ง",
      JSON.stringify(req.body[0]),
      "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      action[0].value,
    );
    return;
  });
};




exports.getJobFromOrder = async (req, res, next) => {

  var xresult = [];

  return (async () => {
    let lic_code = req.header('lic_code');
    let { ord_code, off_code, action } = req.body[0];
    //เช็คเฉพาะส่วนที่สำคัญ
    if (ord_code == undefined || action == undefined) {
      let response = [{
        status: 'error',
        invalid_code: '-1',
        message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
        data: xresult,
        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
      }]

      res.status(200).send(response);
    } else {

      let script = ``;

      script = `select 
                tbl_job.job_code, tms_transport_code, transport_code, tour_code, pull_code, number, document_reference, 
                job_dt, job_status, job_comment, gsap_order_type_code, gsap_order_status, gsap_order_number, 
                gsap_shipments_number, transporeon_status, tbl_job.off_code, job_flag, tbl_job.ist_dt, tbl_job.mdf_dt, tbl_job.rm_dt, loading_count, 
                unloading_count, item_count, item_quantity, tbl_job.dver_code, tbl_job.veh_code, transporeon_result, transporeon_ist_dt, transporeon_mdf_dt, 
                transporeon_rm_dt, distance, transit_start_dt, transit_end_dt, transit_minute, tbl_driver.dver_name, tbl_driver.dver_surname,
                tbl_driver.dver_mobile_number ,tbl_driver.dver_image_profile, tbl_vehicle.veh_blackbox_number, 
                tbl_vehicle.veh_number, tbl_vehicle.veh_license_number, tbl_vehicle.veh_license_province,
                tbl_vehicle.veh_sub_license_number, tbl_vehicle.veh_sub_license_province, tbl_vehicle.veh_type_code, tbl_vehicle_type.veh_type_desc   
                from tbl_job 
                left join tbl_driver on tbl_job.dver_code  = tbl_driver.dver_code 
                left join tbl_vehicle on tbl_job.veh_code  = tbl_vehicle.veh_code 
                left join tbl_vehicle_type on tbl_vehicle.veh_type_code   = tbl_vehicle_type.veh_type_code 
                left join tbl_job_order on tbl_job_order.job_code = tbl_job.job_code
                where tbl_job.job_flag = '1' and tbl_job_order.ord_code = '${ord_code}'`;


      if (off_code.toString().toUpperCase() != 'ALL') {
        script += ` and tbl_job.off_code = '${off_code}' `
      }



      let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
      if (!tbl_temporary.code) {
        //debugger
        if (tbl_temporary.data.length > 0) {
          tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

          let response = [{
            status: 'success',
            invalid_code: '0',
            message: '',
            data: tbl_temporary.data,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss'),
          }]

          res.status(200).send(response);
          return;
        } else {
          let response = [{
            status: 'success',
            invalid_code: '0',
            message: '',
            data: xresult,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
          }]

          res.status(200).send(response);
          return;
        }
      } else {
        let response = [{
          status: 'error',
          invalid_code: '-3',
          message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
          data: xresult,
          response_time: moment().format('YYYY-MM-DD HH:mm:ss')
        }]
        res.status(200).send(response);
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
      }
    }
  })().catch(async (err) => {
    console.log(err);
    let response = [{
      status: 'error',
      invalid_code: '-4',
      message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
      data: xresult,
      response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
    }]
    res.status(200).send(response);
    await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูล Order', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
    return;
  });
}

exports.settimedataPlanInformation = async (req, res, next) => {
  try {
    const lic_code = req.header("lic_code");
    const bodyData = req.body; // datatimeDeliNumber array

    if (!bodyData || !Array.isArray(bodyData) || bodyData.length === 0 || !lic_code) {
      return res.status(200).send([{
        status: "error",
        invalid_code: "-1",
        message: "พารามิเตอร์ไม่ถูกต้อง",
        data: [],
        response_time: new Date().toString()
      }]);
    }


    let transit_end_dt = new Date(bodyData[0].start_dt); // start depot แถวแรก
    let xdistance = 0;

    for (let i = 0; i < bodyData.length; i++) {
      const row = bodyData[i];
      let location_minute = parseInt(row.location_minute) || 60;

      if (i === 0) {
        // แถวแรก depot
        row.start_dt = new Date(transit_end_dt).toString();
        row.end_dt = new Date(new Date(transit_end_dt).getTime() + location_minute * 60 * 1000).toString();
        row.location_distance = 0;
        transit_end_dt = new Date(row.end_dt);
      } else {
        const prev = bodyData[i - 1];

        // คำนวณระยะทางจาก prev → row ผ่าน HERE API
        const url = `https://router.hereapi.com/v8/routes?transportMode=car&origin=${prev.location_lat},${prev.location_lon}&destination=${row.location_lat},${row.location_lon}&return=summary&apiKey=${xapikey}`;

        let distance = 0;
        let timeInSeconds = 0;
        try {
          const response = await axios.get(url);
          if (response.data.routes.length > 0) {
            const section = response.data.routes[0].sections[0];
            distance = section.summary.length / 1000; // km
            timeInSeconds = section.summary.duration; // sec
          }
        } catch (err) {
          console.error("HERE API error:", err.message);
        }

        row.location_distance = Number(distance.toFixed(3));

        // gap_minute จาก API
        const gap_minute = timeInSeconds ? timeInSeconds / 60 : (distance / 40) * 60; // fallback speed 40 km/h

        // กำหนด start/end ของ row ปัจจุบัน
        row.start_dt = new Date(new Date(transit_end_dt).getTime() + gap_minute * 60 * 1000).toString();
        row.end_dt = new Date(new Date(row.start_dt).getTime() + location_minute * 60 * 1000).toString();

        xdistance += distance;
        transit_end_dt = new Date(row.end_dt);
      }
    }

    return res.status(200).send([{
      status: "success",
      invalid_code: "0",
      message: "คำนวณเส้นทางสำเร็จ",
      data: bodyData,
      total_distance: Number(xdistance.toFixed(3)),
      response_time: new Date().toString()
    }]);

  } catch (error) {
    console.error(error);
    return res.status(500).send([{
      status: "error",
      invalid_code: "-99",
      message: "เกิดข้อผิดพลาด",
      data: [],
      response_time: new Date().toString()
    }]);
  }
};