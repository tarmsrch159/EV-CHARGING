const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
//Success
exports.getDepotWorkedDateInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        let { wrk_date_code, dpo_code, page_index, page_limit, action } = req.body[0];

        page_index = page_index || 1;
        page_limit = page_limit || 10;


        if (page_index > 0) {
            page_index -= 1;
        }

        //เช็คเฉพาะส่วนที่สำคัญ
        if (wrk_date_code == undefined || dpo_code == undefined || lic_code == undefined || action == undefined) {
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
                dpo_worked_date_code,
                tbl_depot.dpo_code,
                dpo_number,
                dpo_desc,
                dpo_short_desc,
                tbl_depot.dpo_group_code,
                dpo_group_desc,
                tbl_depot_worked_date.wrk_date_code,
                case when wrk_date_code = '0' then 'SUN'
                when wrk_date_code = '1' then 'MON'
                when wrk_date_code = '2' then 'TUE'
                when wrk_date_code = '3' then 'WED'
                when wrk_date_code = '4' then 'THU'
                when wrk_date_code = '5' then 'FRI'
                else 'SAT' end as wrk_date_desc,
                dpo_open_time, 
                dpo_close_time, 
                tbl_depot.off_code,
                off_desc,
                tbl_depot_worked_date.ist_dt,
                tbl_depot_worked_date.mdf_dt,
                tbl_depot_worked_date.rm_dt,
                tbl_depot_worked_date.wrk_seq
                from tbl_depot
                left join tbl_office on tbl_depot.off_code = tbl_office.off_code
                left join tbl_depot_worked_date on tbl_depot.dpo_code = tbl_depot_worked_date.dpo_code 
                left join tbl_depot_group on tbl_depot.dpo_group_code = tbl_depot_group.dpo_group_code 
                where tbl_depot_worked_date.dpo_worked_date_flag = '1' and dpo_worked_date_code is not null 
                and tbl_depot_worked_date.wrk_date_code = '${wrk_date_code}' `;
            }
            else {
                script = `select
                dpo_worked_date_code,
                tbl_depot.dpo_code,
                dpo_number,
                dpo_desc,
                dpo_short_desc,
                tbl_depot.dpo_group_code,
                dpo_group_desc,
                tbl_depot_worked_date.wrk_date_code,
                case when wrk_date_code = '0' then 'SUN'
                when wrk_date_code = '1' then 'MON'
                when wrk_date_code = '2' then 'TUE'
                when wrk_date_code = '3' then 'WED'
                when wrk_date_code = '4' then 'THU'
                when wrk_date_code = '5' then 'FRI'
                else 'SAT' end as wrk_date_desc,
                dpo_open_time, 
                dpo_close_time, 
                tbl_depot.off_code,
                off_desc,
                tbl_depot_worked_date.ist_dt,
                tbl_depot_worked_date.mdf_dt,
                tbl_depot_worked_date.rm_dt,
                tbl_depot_worked_date.wrk_seq
                from tbl_depot
                left join tbl_office on tbl_depot.off_code = tbl_office.off_code
                left join tbl_depot_worked_date on tbl_depot.dpo_code = tbl_depot_worked_date.dpo_code 
                left join tbl_depot_group on tbl_depot.dpo_group_code = tbl_depot_group.dpo_group_code 
                where tbl_depot_worked_date.dpo_worked_date_flag = '1' and dpo_worked_date_code is not null 
                and dpo_worked_date_code is not null `;
            }

            if (dpo_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_depot.dpo_code = '${dpo_code}' `
            }

            script += `  order by tbl_depot_worked_date.wrk_date_code, tbl_depot_worked_date.wrk_seq asc`
            script += ` offset (${page_index}*${page_limit}) limit ${page_limit};`
            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));
                    let page_total = 0;
                    let rows_total = 0;
                    let script = ``
                    if (wrk_date_code.toString().toUpperCase() != 'ALL') {
                        script = `select ceil((ceil(count(dpo_worked_date_code)) / ${page_limit})) as page_total, (count(dpo_worked_date_code)) as rows_total 
                    from tbl_depot
                    left join tbl_depot_worked_date on tbl_depot.dpo_code = tbl_depot_worked_date.dpo_code 
                    left join tbl_depot_group on tbl_depot.dpo_group_code = tbl_depot_group.dpo_group_code 
                    where tbl_depot_worked_date.dpo_worked_date_flag = '1' and dpo_worked_date_code is not null 
                    and tbl_depot_worked_date.wrk_date_code = '${wrk_date_code}'`;
                    }
                    else {
                        script = `select ceil((ceil(count(dpo_worked_date_code)) / ${page_limit})) as page_total, (count(dpo_worked_date_code)) as rows_total 
                    from tbl_depot
                    left join tbl_depot_worked_date on tbl_depot.dpo_code = tbl_depot_worked_date.dpo_code 
                    left join tbl_depot_group on tbl_depot.dpo_group_code = tbl_depot_group.dpo_group_code 
                    where tbl_depot_worked_date.dpo_worked_date_flag = '1' and dpo_worked_date_code is not null 
                    and dpo_worked_date_code is not null `;
                    }

                    if (dpo_code.toString().toUpperCase() != 'ALL') {
                        script += ` and tbl_depot.dpo_code = '${dpo_code}' `
                    }

                    script += `;`
                    let tbl_temporary_total = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
                    if (!tbl_temporary_total.code) {
                        page_total = parseInt(tbl_temporary_total.data[0].page_total);
                        rows_total = parseInt(tbl_temporary_total.data[0].rows_total);
                    }
                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: tbl_temporary.data,
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss'),
                        total_row: rows_total,
                        page_total: page_total
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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลวันที่คลังน้ำมันเปิดทำการ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลวันที่คลังน้ำมันเปิดทำการ', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.removeDepotWorkedDate = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { dpo_worked_date_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (dpo_worked_date_code == undefined || lic_code == undefined || action == undefined) {
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
            for (let i = 0; i < dpo_worked_date_code.length; i++) {
                workId.push({ dpo_worked_date_code: dpo_worked_date_code[i] });
                valuesArr.push(`('${dpo_worked_date_code[i]}')`);
            }

            let script = `update tbl_depot_worked_date set dpo_worked_date_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' where dpo_worked_date_code in (${valuesArr.join(', ')});`

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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลวันที่คลังน้ำมันเปิดทำการ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลวันที่คลังน้ำมันเปิดทำการ', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลวันที่คลังน้ำมันเปิดทำการ', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.setDepotWorkedDateInformation = async (req, res, next) => {

    return (async () => {
        //debugger
        let lic_code = req.header('lic_code');
        let { dpo_worked_date_code } = req.query;
        let {
            dpo_open_time,
            dpo_close_time,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (dpo_worked_date_code == undefined || dpo_open_time == undefined || dpo_close_time == undefined || action == undefined) {
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
            script = `update tbl_depot_worked_date set
            dpo_open_time = '${dpo_open_time}',
            dpo_close_time = '${dpo_close_time}',
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where dpo_worked_date_code = '${dpo_worked_date_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลวันที่คลังน้ำมันเปิดทำการ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลวันที่คลังน้ำมันเปิดทำการ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลวันที่คลังน้ำมันเปิดทำการ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

//Success
exports.addDepotWorkedDateInformation = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let {
            dpo_code,
            wrk_date_code,
            wrk_time,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (dpo_code == undefined || wrk_date_code == undefined || wrk_time == undefined || action == undefined || lic_code == undefined) {
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
            script = `select COUNT(dpo_worked_date_code) as count from tbl_depot_worked_date 
            where dpo_worked_date_flag = '1' and dpo_code = '${dpo_code}' and wrk_date_code = '${wrk_date_code}';`
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
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลวันที่คลังน้ำมันเปิดทำการ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลถึงจำกัดสูงสุดแล้ว (4 รายการ)', action[0].value);
                    return;
                }
            }

            const countItem = tbl_temporary0.data[0].count;
            const newItem = wrk_time.length;

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
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลวันที่คลังน้ำมันเปิดทำการ', JSON.stringify(req.body[0]), `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลที่สามารถบันทึกได้มีเหลือ (${maxItem} รายการ)`, action[0].value);
                return;
            }

            let now = moment().format('YYYY-MM-DD HH:mm:ss');
            let valuesArr = [];

            function uniqueCode(suffix) {
                let timestamp = moment().format('x');
                let suffixStr = suffix.toString();
                let shortenedTimestamp = timestamp.substring(0, timestamp.length - suffixStr.length);
                return 'dwrk-' + shortenedTimestamp + suffixStr;
            }

            let workId = [];
            for (let i = 0; i < wrk_time.length; i++) {
                let dpo_worked_date_code = uniqueCode(i);
                workId.push({ dpo_worked_date_code: dpo_worked_date_code });
                valuesArr.push(`('${dpo_worked_date_code}', '${dpo_code}', '${wrk_date_code}', '${wrk_time[i].dpo_open_time}', '${wrk_time[i].dpo_close_time}', '1', '${now}', '${wrk_time[i].seq}')`);
            }

            script = `insert into tbl_depot_worked_date 
            (dpo_worked_date_code, dpo_code, wrk_date_code, dpo_open_time, dpo_close_time, dpo_worked_date_flag, ist_dt, wrk_seq) values 
            ${valuesArr.join(', ')};`

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
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลวันที่คลังน้ำมันเปิดทำการ', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลวันที่คลังน้ำมันเปิดทำการ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลวันที่คลังน้ำมันเปิดทำการ', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}
