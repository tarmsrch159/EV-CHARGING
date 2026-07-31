const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
exports.getTransporeonInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { tprn_code, pull_code, start_date, end_date, page_index, page_limit, action } = req.body[0];
        page_index == undefined ? page_index = 1 : page_index;
        page_limit == undefined ? page_limit = 10 : page_limit;
        //เช็คเฉพาะส่วนที่สำคัญ
        if (tprn_code == undefined || pull_code == undefined || start_date == undefined || end_date == undefined
            || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss'),
                page_total: 0,
                rows_total: 0
            }]

            res.status(200).send(response);
        } else {

            let script = ``;
            if (page_index > 0) {
                page_index -= 1;
            }

            if (tprn_code.toString().toUpperCase() != 'ALL') {
                script = `select tprn_code, pull_code, tprn_information, tprn_result, tprn_remark, ist_dt, mdf_dt, rm_dt, tprn_flag 
                from tbl_transporeon_order where tbl_transporeon_order.tprn_code = '${tprn_code}' 
                and ist_dt >= '${start_date} 00:00:00' and ist_dt <= '${end_date} 23:59:59'`;
            }
            else {
                script = `select tprn_code, pull_code, tprn_information, tprn_result, tprn_remark, ist_dt, mdf_dt, rm_dt, tprn_flag 
                from tbl_transporeon_order where ist_dt >= '${start_date} 00:00:00' and ist_dt <= '${end_date} 23:59:59'`;
            }

            if (pull_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_transporeon_order.pull_code = '${pull_code}'`
            }

            script += ` order by tbl_transporeon_order.ist_dt asc `
            script += ` offset (${page_index}*${page_limit}) limit ${page_limit};`

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                    let page_total = 0;
                    let rows_total = 0;
                    script = ``
                    if (tprn_code.toString().toUpperCase() != 'ALL') {
                        script = `select ceil((ceil(count(tprn_code)) / ${page_limit})) as page_total, (count(tprn_code)) as rows_total 
                        from tbl_transporeon_order where tbl_transporeon_order.tprn_code = '${tprn_code}' 
                        and ist_dt >= '${start_date} 00:00:00' and ist_dt <= '${end_date} 23:59:59'`;
                    }
                    else {
                        script = `select ceil((ceil(count(tprn_code)) / ${page_limit})) as page_total, (count(tprn_code)) as rows_total 
                        from tbl_transporeon_order where tbl_transporeon_order.tprn_code is not null  
                        and ist_dt >= '${start_date} 00:00:00' and ist_dt <= '${end_date} 23:59:59'`;
                    }

                    if (pull_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_transporeon_order.pull_code = '${pull_code}'`
                    }

                    let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());

                    if (!tbl_temporary0.code) {
                        if (tbl_temporary0.data.length > 0) {
                            page_total = parseInt(tbl_temporary0.data[0].page_total);
                            rows_total = parseInt(tbl_temporary0.data[0].rows_total);
                        }
                    }


                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: tbl_temporary.data,
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss'),
                        page_total: (page_total <= 0 ? 1 : page_total),
                        rows_total: rows_total
                    }]

                    res.status(200).send(response);
                    return;
                } else {
                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: xresult,
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss'),
                        page_total: 0,
                        rows_total: 0
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
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss'),
                    page_total: 0,
                    rows_total: 0
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString(),
            page_total: 0,
            rows_total: 0
        }]
        res.status(200).send(response);
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}
