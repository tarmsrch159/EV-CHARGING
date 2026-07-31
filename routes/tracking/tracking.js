const config = require("../../configuration/connection");
const pgConn = require("../../library/pgConnection");
const moment = require("moment");
const xglobal = require("../../middleware/global");
const xaxios = require("axios");

const dbPrefix = config.dbPrefix();

xaxios.interceptors.request.use((config) => {
  config.timeout = 180000; // Wait for 5 seconds before timing out
  return config;
});

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
exports.getHistoryInformation = async (req, res, next) => {
  var xresult = [];

  return (async () => {
    let lic_code = req.header("lic_code");
    let { veh_blackbox_number, transit_start_dt, transit_end_dt, action } =
      req.body[0];
    //เช็คเฉพาะส่วนที่สำคัญ
    if (
      veh_blackbox_number == undefined ||
      transit_start_dt == undefined ||
      lic_code == undefined ||
      transit_end_dt == undefined ||
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
      let data = JSON.stringify({
        api_token_key:
          "CVR5KZLU2N8L77JEP4XB23SVYBR6GAMHNUED9FPQ8TKWF6TSQJ19D4WCGYAX3MHZ",
        start_period: moment(transit_start_dt).format("YYYY-MM-DD HH:mm:ss"),
        end_period: moment(transit_end_dt).format("YYYY-MM-DD HH:mm:ss"),
        gps_id: veh_blackbox_number,
      });

      let axios_config = {
        method: "post",
        maxBodyLength: Infinity,
        url: "https://gps.dtc.co.th:8099/getHistory",
        headers: {
          "Content-Type": "application/json",
        },
        data: data,
      };

      await xaxios
        .request(axios_config)
        .then(async (response) => {
          var result = response.data;
          if (result.status == 200) {
            if (result.data.length > 0) {
              debugger;
              xresult = [];
              for (var g = 0; g <= result.data.length - 1; g++) {
                xresult.push({
                  veh_blackbox_number: veh_blackbox_number,
                  status_code: result.data[g].status_code,
                  status_th: result.data[g].status_name_th,
                  status_en: result.data[g].status_name_en,
                  lat: parseFloat(result.data[g].lat),
                  lon: parseFloat(result.data[g].lon),
                  station_name: result.data[g].station_name,
                  sub_district_th: result.data[g].sub_district_th,
                  sub_district_en: result.data[g].sub_district_en,
                  district_th: result.data[g].district_th,
                  district_en: result.data[g].district_en,
                  province_th: result.data[g].province_th,
                  province_en: result.data[g].province_en,
                  gps_speed: parseInt(result.data[g].gps_speed),
                  time: result.data[g].time,
                  heading: result.data[g].heading
                });

                if (g == result.data.length - 1) {
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
              }
            } else {
              console.log(
                moment().format("YYYY-MM-DD HH:mm:ss.SSS"),
                "can not get gps information empty information."
              );
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
            console.log(
              moment().format("YYYY-MM-DD HH:mm:ss.SSS"),
              "can not get gps information status error."
            );
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
        })
        .catch((error) => {
          console.log(
            moment().format("YYYY-MM-DD HH:mm:ss.SSS"),
            "can not get gps information.",
            error
          );
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
        });
    }
  })().catch(async (err) => {
    console.log(err);
    let response = [
      {
        status: "error",
        invalid_code: "-4",
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
      "ดึงข้อมูลสินค้า",
      JSON.stringify(req.body[0]),
      "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      action[0].value
    );
    return;
  });
};
