const config = require("../../configuration/connection");
const pgConn = require("../../library/pgConnection");
const moment = require("moment");
const xglobal = require("../../middleware/global");

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
exports.getDriverOfJobInformation = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let { job_code, dver_group_code, off_code, filter, action } = req.body[0];
    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      job_code == undefined ||
      off_code == undefined ||
      filter == undefined ||
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
    } else {
      if (dver_group_code == undefined) {
        dver_group_code = "ALL";
      }

      let script = ``;

      if (dver_group_code.toString().toUpperCase() == "ALL") {
        script = `select 
        dver_code, dver_username, dver_userpassword, dver_ref_code, dver_image_profile, dver_name, dver_surname, 
        dver_mobile_number, dver_email, dver_div_code, dver_dep_code, dver_pos_code, dver_group_code, dver_gender, 
        dver_role_code, dver_personal_number, application_mobile_version, dver_flag, ist_dt, mdf_dt, rm_dt, off_code, job_currently, 
        unavailable, '1' as checked, '' as dver_resson
        from 
        (select dver_code, dver_username, dver_userpassword, dver_ref_code, dver_image_profile, dver_name, dver_surname, 
        dver_mobile_number, dver_email, dver_div_code, dver_dep_code, dver_pos_code, dver_group_code, dver_gender, 
        dver_role_code, dver_personal_number, application_mobile_version, dver_flag, ist_dt, mdf_dt, rm_dt, off_code,

        (select count(job_code) from tbl_job where TO_CHAR(job_dt, 'YYYY-MM-DD') = 
        (select TO_CHAR(job_dt, 'YYYY-MM-DD') from tbl_job where job_code = '${job_code}')
        and tbl_job.dver_code = tbl_driver.dver_code) as job_currently,

        (select case when count(tbl_driver_leave.dver_leave_code) is null or count(tbl_driver_leave.dver_leave_code) = 0 then 0 else 1 end 
        from tbl_driver_leave 
        where TO_CHAR(tbl_driver_leave.dver_leave_date, 'YYYY-MM-DD') 
        = (select TO_CHAR(job_dt, 'YYYY-MM-DD') from tbl_job where job_code = '${job_code}') 
        and tbl_driver_leave.dver_code = tbl_driver.dver_code) as unavailable
        from tbl_driver
        where off_code = '${off_code}'
        order by tbl_driver.dver_name asc , tbl_driver.dver_surname asc) xtblmaster`;
      } else {
        script = `select 
        dver_code, dver_username, dver_userpassword, dver_ref_code, dver_image_profile, dver_name, dver_surname, 
        dver_mobile_number, dver_email, dver_div_code, dver_dep_code, dver_pos_code, dver_group_code, dver_gender, 
        dver_role_code, dver_personal_number, application_mobile_version, dver_flag, ist_dt, mdf_dt, rm_dt, off_code, job_currently, 
        unavailable, '1' as checked, '' as dver_resson
        from 
        (select dver_code, dver_username, dver_userpassword, dver_ref_code, dver_image_profile, dver_name, dver_surname, 
        dver_mobile_number, dver_email, dver_div_code, dver_dep_code, dver_pos_code, dver_group_code, dver_gender, 
        dver_role_code, dver_personal_number, application_mobile_version, dver_flag, ist_dt, mdf_dt, rm_dt, off_code,

        (select count(job_code) from tbl_job where TO_CHAR(job_dt, 'YYYY-MM-DD') = 
        (select TO_CHAR(job_dt, 'YYYY-MM-DD') from tbl_job where job_code = '${job_code}')
        and tbl_job.dver_code = tbl_driver.dver_code) as job_currently,

        (select case when count(tbl_driver_leave.dver_leave_code) is null or count(tbl_driver_leave.dver_leave_code) = 0 then 0 else 1 end 
        from tbl_driver_leave 
        where TO_CHAR(tbl_driver_leave.dver_leave_date, 'YYYY-MM-DD') 
        = (select TO_CHAR(job_dt, 'YYYY-MM-DD') from tbl_job where job_code = '${job_code}') 
        and tbl_driver_leave.dver_code = tbl_driver.dver_code) as unavailable
        from tbl_driver
        where off_code = '${off_code}' and dver_group_code = '${dver_group_code}' 
        order by tbl_driver.dver_name asc , tbl_driver.dver_surname asc) xtblmaster`;
      }

      let tbl_temporary = await pgConn.get(
        dbPrefix + lic_code,
        script,
        config.connectionString()
      );
      if (!tbl_temporary.code) {
        //debugger
        if (tbl_temporary.data.length > 0) {
          tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, ':""'));

          xresult = [];
          for (var xdver = 0; xdver <= tbl_temporary.data.length - 1; xdver++) {
            //debugger
            if (tbl_temporary.data[xdver].unavailable == "1") {
              tbl_temporary.data[xdver].checked = "0";
              tbl_temporary.data[xdver].dver_resson = "พนักงานลาในวันจัดส่ง";
            } else if (tbl_temporary.data[xdver].job_currently > 3) {
              tbl_temporary.data[xdver].checked = "1";
              tbl_temporary.data[xdver].dver_resson =
                "พนักงานมีงานในวันจัดส่งแล้ว";
            }

            if (xdver == tbl_temporary.data.length - 1) {
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
            }
          }
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
          "ดึงข้อมูลรถและหางลาก",
          JSON.stringify(req.body[0]),
          "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
          action[0].value
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
      "ดึงข้อมูลรถและหางลาก",
      JSON.stringify(req.body[0]),
      "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      action[0].value
    );
    return;
  });
};
