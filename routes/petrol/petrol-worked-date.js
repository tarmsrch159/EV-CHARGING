const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
//Success
exports.getPetrolWorkedDateInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        let { wrk_date_code, ptrl_code, action, page_index, page_limit } = req.body[0];
        page_index = page_index == undefined ? 1 : page_index;
        page_limit = page_limit == undefined ? 10 : page_limit;

        if (page_index > 0) {
            page_index -= 1;
        }

        //เช็คเฉพาะส่วนที่สำคัญ
        if (wrk_date_code == undefined || ptrl_code == undefined || lic_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return;
        } else {

            let script = ``;
            if (wrk_date_code.toString().toUpperCase() != 'ALL') {
                script = `select
                    ptrl_worked_date_code,
                    tbl_petrol.ptrl_code,
                    ptrl_number,
                    ptrl_desc,
                    ptrl_short_desc,
                    tbl_petrol.ptrl_group_code,
                    ptrl_group_desc,
                    tbl_petrol_worked_date.wrk_date_code,
                    case when wrk_date_code = '0' then 'SUN'
                    when wrk_date_code = '1' then 'MON'
                    when wrk_date_code = '2' then 'TUE'
                    when wrk_date_code = '3' then 'WED'
                    when wrk_date_code = '4' then 'THU'
                    when wrk_date_code = '5' then 'FRI'
                    else 'SAT' end as wrk_date_desc,
                    ptrl_open_time,
                    ptrl_close_time,
                    tbl_petrol.off_code,
                    off_desc,
                    tbl_petrol_worked_date.ist_dt,
                    tbl_petrol_worked_date.mdf_dt,
                    tbl_petrol_worked_date.rm_dt,
                    tbl_petrol_worked_date.wrk_seq 
                from tbl_petrol
                left join tbl_office on tbl_petrol.off_code = tbl_office.off_code
                left join tbl_petrol_worked_date on tbl_petrol.ptrl_code = tbl_petrol_worked_date.ptrl_code 
                left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                where tbl_petrol_worked_date.ptrl_worked_date_flag = '1' and ptrl_worked_date_code is not null 
                and tbl_petrol_worked_date.wrk_date_code = '${wrk_date_code}' `;
            }
            else {
                script = `select
                    ptrl_worked_date_code,
                    tbl_petrol.ptrl_code,
                    ptrl_number,
                    ptrl_desc,
                    ptrl_short_desc,
                    tbl_petrol.ptrl_group_code,
                    ptrl_group_desc,
                    tbl_petrol_worked_date.wrk_date_code,
                    case when wrk_date_code = '0' then 'SUN'
                    when wrk_date_code = '1' then 'MON'
                    when wrk_date_code = '2' then 'TUE'
                    when wrk_date_code = '3' then 'WED'
                    when wrk_date_code = '4' then 'THU'
                    when wrk_date_code = '5' then 'FRI'
                    else 'SAT' end as wrk_date_desc,
                    ptrl_open_time,
                    ptrl_close_time,
                    tbl_petrol.off_code,
                    off_desc,
                    tbl_petrol_worked_date.ist_dt,
                    tbl_petrol_worked_date.mdf_dt,
                    tbl_petrol_worked_date.rm_dt,
                    tbl_petrol_worked_date.wrk_seq
                from tbl_petrol
                left join tbl_office on tbl_petrol.off_code = tbl_office.off_code
                left join tbl_petrol_worked_date on tbl_petrol.ptrl_code = tbl_petrol_worked_date.ptrl_code 
                left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                where tbl_petrol_worked_date.ptrl_worked_date_flag = '1' and ptrl_worked_date_code is not null 
                and ptrl_worked_date_code is not null `;
            }

            if (ptrl_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_petrol.ptrl_code = '${ptrl_code}' `
            }

            script += `  order by tbl_petrol_worked_date.wrk_date_code, tbl_petrol_worked_date.wrk_seq asc`
            script += ` offset (${page_index}*${page_limit}) limit ${page_limit};`

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));
                    let page_total = 0;
                    let rows_total = 0;

                    let script = ``;
                    if (wrk_date_code.toString().toUpperCase() != 'ALL') {
                        script = `select
                    ceil((ceil(count(wrk_date_code)) / ${page_limit})) as page_total, 
                    (count(wrk_date_code)) as rows_total 
                    from tbl_petrol
                    left join tbl_office on tbl_petrol.off_code = tbl_office.off_code
                    left join tbl_petrol_worked_date on tbl_petrol.ptrl_code = tbl_petrol_worked_date.ptrl_code 
                    left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                    where tbl_petrol_worked_date.ptrl_worked_date_flag = '1' and ptrl_worked_date_code is not null 
                    and tbl_petrol_worked_date.wrk_date_code = '${wrk_date_code}' `;
                    }
                    else {
                        script = `select
                    ceil((ceil(count(wrk_date_code)) / ${page_limit})) as page_total, 
                    (count(wrk_date_code)) as rows_total 
                    from tbl_petrol
                    left join tbl_office on tbl_petrol.off_code = tbl_office.off_code
                    left join tbl_petrol_worked_date on tbl_petrol.ptrl_code = tbl_petrol_worked_date.ptrl_code 
                    left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                    where tbl_petrol_worked_date.ptrl_worked_date_flag = '1' and ptrl_worked_date_code is not null 
                    and ptrl_worked_date_code is not null `;
                    }

                    if (ptrl_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_petrol.ptrl_code = '${ptrl_code}' `
                    }

                    let tbl_temporary2 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
                    if (!tbl_temporary2.code) {
                        if (tbl_temporary2.data.length > 0) {
                            page_total = parseInt(tbl_temporary2.data[0].page_total);
                            rows_total = parseInt(tbl_temporary2.data[0].rows_total);
                        }
                    }

                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: tbl_temporary.data,
                        page_total: page_total,
                        rows_total: rows_total,
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลวันที่ปั้มเปิดทำการ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลวันที่ปั้มเปิดทำการ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.removePetrolWorkedDate = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { ptrl_worked_date_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_worked_date_code == undefined || lic_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return;
        } else {

            let workId = [];
            let valuesArr = [];
            for (let i = 0; i < ptrl_worked_date_code.length; i++) {
                workId.push({ ptrl_worked_date_code: ptrl_worked_date_code[i] });
                valuesArr.push(`('${ptrl_worked_date_code[i]}')`);
            }

            let script = `update tbl_petrol_worked_date set ptrl_worked_date_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' where ptrl_worked_date_code in (${valuesArr.join(',')})`;

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: workId,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลวันที่ปั้มเปิดทำการ', JSON.stringify(req.body[0]), 'success', action[0].value);
                return;
            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลวันที่ปั้มเปิดทำการ', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                return;
            }
        }

    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }]
        res.status(200).send(response);
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลวันที่ปั้มเปิดทำการ', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.setPetrolWorkedDateInformation = async (req, res, next) => {

    return (async () => {
        //debugger
        let lic_code = req.header('lic_code');
        let { ptrl_worked_date_code } = req.query;
        let {
            ptrl_open_time,
            ptrl_close_time,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_worked_date_code == undefined || ptrl_open_time == undefined || ptrl_close_time == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return;
        } else {

            let script = ``;
            script = `update tbl_petrol_worked_date set
            ptrl_open_time = '${ptrl_open_time}',
            ptrl_close_time = '${ptrl_close_time}',
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where ptrl_worked_date_code = '${ptrl_worked_date_code}';`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลวันที่ปั้มเปิดทำการ', JSON.stringify(req.body[0]), 'success', action[0].value);
                return;
            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลวันที่ปั้มเปิดทำการ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                return;
            }
        }

    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }]
        res.status(200).send(response);
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลวันที่ปั้มเปิดทำการ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

//Success
exports.addPetrolWorkedDateInformation = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let {
            ptrl_code,
            wrk_date_code,
            wrk_time,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_code == undefined || wrk_date_code == undefined || wrk_time == undefined || action == undefined || lic_code == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return;
        } else {

            let script = ``;
            script = `select COUNT(ptrl_worked_date_code) AS count from tbl_petrol_worked_date 
            where ptrl_worked_date_flag = '1' and ptrl_code = '${ptrl_code}' and wrk_date_code = '${wrk_date_code}';`
            let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary0.code) {
                if (tbl_temporary0.data[0].count > 4) {
                    let response = [{
                        status: 'error',
                        invalid_code: '-4',
                        message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลถึงจำกัดสูงสุดแล้ว (4 รายการ)`,
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลวันที่ปั้มเปิดทำการ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลถึงจำกัดสูงสุดแล้ว (4 รายการ)', action[0].value);
                    return;
                }
            }

            const countItem = tbl_temporary0.data[0].count;
            const newItem = wrk_time.length;

            // console.log((4 - countItem), ' < 1 ||', newItem, '>', (4 - countItem));
            if ((4 - countItem) < 1 || newItem > (4 - countItem)) {
                const maxItem = parseInt(4 - countItem);
                let response = [{
                    status: 'error',
                    invalid_code: '-4',
                    message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลที่สามารถบันทึกได้มีเหลือ (${maxItem} รายการ)`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลวันที่ปั้มเปิดทำการ', JSON.stringify(req.body[0]), `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลที่สามารถบันทึกได้มีเหลือ (${maxItem} รายการ)`, action[0].value);
                return;
            }

            // let ptrl_worked_date_code = 'pwrk-' + moment().format('x');
            let now = moment().format('YYYY-MM-DD HH:mm:ss');
            let valuesArr = [];

            function uniqueCode(suffix) {
                let timestamp = moment().format('x');
                let suffixStr = suffix.toString();
                let shortenedTimestamp = timestamp.substring(0, timestamp.length - suffixStr.length);
                return 'pwrk-' + shortenedTimestamp + suffixStr;
            }

            let workId = [];
            for (let i = 0; i < wrk_time.length; i++) {
                let ptrl_worked_date_code = uniqueCode(i);
                workId.push({ ptrl_worked_date_code: ptrl_worked_date_code });
                valuesArr.push(`('${ptrl_worked_date_code}', '${ptrl_code}', '${wrk_date_code}', '${wrk_time[i].ptrl_open_time}', '${wrk_time[i].ptrl_close_time}', '1', '${now}', '${wrk_time[i].seq}')`);
            }


            script = `insert into tbl_petrol_worked_date 
            (ptrl_worked_date_code, ptrl_code, wrk_date_code, ptrl_open_time, ptrl_close_time, ptrl_worked_date_flag, ist_dt, wrk_seq) values 
            ${valuesArr.join(',')}`;

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: workId,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลวันที่ปั้มเปิดทำการ', JSON.stringify(req.body[0]), 'success', action[0].value);
                return;
            } else {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลวันที่ปั้มเปิดทำการ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
                return;
            }
        }

    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }]
        res.status(200).send(response);
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลวันที่ปั้มเปิดทำการ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}
