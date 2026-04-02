const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
exports.getPositionInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        let { div_code, dep_code, pos_code, action, page_index, page_limit } = req.body[0];
        page_index == undefined ? page_index = 1 : page_index;
        page_limit == undefined ? page_limit = 10 : page_limit;

        if (page_index > 0) {
            page_index -= 1;
        }

        //เช็คเฉพาะส่วนที่สำคัญ
        if (div_code == undefined || dep_code == undefined || pos_code == undefined || lic_code == undefined || action == undefined) {
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

            if (div_code.toString().toUpperCase() == 'ALL' || dep_code.toString().toUpperCase() == 'ALL') {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง div_code, dep_code ไม่รองรับ ALL',
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลตำแหน่ง', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง div_code, dep_code ไม่รองรับ ALL', action[0].value);
                return;
            }

            let script = ``;
            if (pos_code.toString().toUpperCase() != 'ALL') {
                script = `select tbl_division.div_code, tbl_division.div_desc, tbl_department.dep_code, tbl_department.dep_desc, 
                tbl_position.pos_code, tbl_position.pos_desc, tbl_position.pos_flag, 
                case when tbl_position.pos_salary is null then 0 else tbl_position.pos_salary end as pos_salary, 
                case when tbl_position.pos_allowance is null then 0 else tbl_position.pos_allowance end as pos_allowance, 
                case when tbl_position.pos_hour_working is null then 0 else tbl_position.pos_hour_working end as pos_hour_working, 
                case when tbl_position.pos_hour_overtimes is null then 0 else tbl_position.pos_hour_overtimes end as pos_hour_overtimes,
                tbl_position.ist_dt, tbl_position.mdf_dt, tbl_position.rm_dt
                from tbl_position
                left join tbl_department on tbl_position.div_code = tbl_department.div_code
                and tbl_position.dep_code = tbl_department.dep_code
                and tbl_department.dep_flag = '1'
                left join tbl_division on tbl_department.div_code = tbl_division.div_code
                and tbl_division.div_flag = '1'
                where tbl_position.pos_flag = '1' and tbl_position.div_code = '${div_code}' and tbl_position.dep_code = '${dep_code}' 
                and tbl_position.pos_code = '${pos_code}'
                `;
            }
            else {
                script = `select tbl_division.div_code, tbl_division.div_desc, tbl_department.dep_code, tbl_department.dep_desc, 
                tbl_position.pos_code, tbl_position.pos_desc, tbl_position.pos_flag, 
                case when tbl_position.pos_salary is null then 0 else tbl_position.pos_salary end as pos_salary, 
                case when tbl_position.pos_allowance is null then 0 else tbl_position.pos_allowance end as pos_allowance, 
                case when tbl_position.pos_hour_working is null then 0 else tbl_position.pos_hour_working end as pos_hour_working, 
                case when tbl_position.pos_hour_overtimes is null then 0 else tbl_position.pos_hour_overtimes end as pos_hour_overtimes,
                tbl_position.ist_dt, tbl_position.mdf_dt, tbl_position.rm_dt
                from tbl_position
                left join tbl_department on tbl_position.div_code = tbl_department.div_code
                and tbl_position.dep_code = tbl_department.dep_code
                and tbl_department.dep_flag = '1'
                left join tbl_division on tbl_department.div_code = tbl_division.div_code
                and tbl_division.div_flag = '1'
                where tbl_position.pos_flag = '1' and tbl_position.div_code = '${div_code}' and tbl_position.dep_code = '${dep_code}' 
               `;
            }

            script += ` order by tbl_position.ist_dt desc`
            script += ` limit ${page_limit} offset ${page_index * page_limit}`;
            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));
                    let page_total = 0;
                    let rows_total = 0;

                    if (pos_code.toString().toUpperCase() != 'ALL') {
                        script = `select 
                        count(*) as rows_total,
                        ceil((ceil(count(*)) / ${page_limit})) as page_total
                        from tbl_position
                        left join tbl_department on tbl_position.div_code = tbl_department.div_code
                        and tbl_position.dep_code = tbl_department.dep_code
                        and tbl_department.dep_flag = '1'
                        left join tbl_division on tbl_department.div_code = tbl_division.div_code
                        and tbl_division.div_flag = '1'
                        where tbl_position.pos_flag = '1' and tbl_position.div_code = '${div_code}' and tbl_position.dep_code = '${dep_code}' 
                        and tbl_position.pos_code = '${pos_code}'
                       `;
                    }
                    else {
                        script = `select 
                        count(*) as rows_total,
                        ceil((ceil(count(*)) / ${page_limit})) as page_total
                        from tbl_position
                        left join tbl_department on tbl_position.div_code = tbl_department.div_code
                        and tbl_position.dep_code = tbl_department.dep_code
                        and tbl_department.dep_flag = '1'
                        left join tbl_division on tbl_department.div_code = tbl_division.div_code
                        and tbl_division.div_flag = '1'
                        where tbl_position.pos_flag = '1' and tbl_position.div_code = '${div_code}' and tbl_position.dep_code = '${dep_code}' 
                        `;
                    }

                    let tbl_temporary_count = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
                    if (!tbl_temporary_count.code) {
                        if (tbl_temporary_count.data.length > 0) {
                            rows_total = parseInt(tbl_temporary_count.data[0].rows_total);
                            page_total = parseInt(tbl_temporary_count.data[0].page_total);
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
                        page_total: 0,
                        rows_total: 0,
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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลตำแหน่ง', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลตำแหน่ง', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.removePosition = async (req, res, next) => {

    return (async () => {

        let lic_code = req.header('lic_code');
        let { pos_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (pos_code == undefined || lic_code == undefined || action == undefined) {
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

            let script = ``;
            script = `update tbl_position set pos_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' where pos_code = '${pos_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลตำแหน่ง', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลตำแหน่ง', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลตำแหน่ง', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.setPositionInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let { pos_code } = req.query;
        let {
            pos_desc,
            pos_salary,
            pos_allowance,
            pos_hour_working,
            pos_hour_overtimes,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (pos_code == undefined || pos_desc == undefined || pos_salary == undefined || pos_allowance == undefined
            || pos_hour_working == undefined || pos_hour_overtimes == undefined || action == undefined) {
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
            script = `update tbl_position set
            pos_desc = '${pos_desc}',
            pos_salary = ${pos_salary},
            pos_allowance = ${pos_allowance},
            pos_hour_working = ${pos_hour_working},
            pos_hour_overtimes = ${pos_hour_overtimes},
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where pos_code = '${pos_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลตำแหน่ง', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลตำแหน่ง', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลตำแหน่ง', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.addPositionInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            div_code,
            dep_code,
            pos_desc,
            pos_salary,
            pos_allowance,
            pos_hour_working,
            pos_hour_overtimes,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (div_code == undefined || dep_code == undefined || pos_desc == undefined || action == undefined) {
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
            script = `select pos_code from tbl_position where pos_desc = '${pos_desc}' and pos_flag = '1';`
            let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary0.code) {
                if (tbl_temporary0.data.length > 0) {
                    let response = [{
                        status: 'error',
                        invalid_code: '-4',
                        message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ`,
                        data: [],
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลตำแหน่ง', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ', action[0].value);
                    return;
                }
            }

            let pos_code = 'pos-' + moment().format('x');
            script = `insert into tbl_position (div_code, dep_code, pos_code, pos_desc, 
            pos_salary, pos_allowance, pos_hour_working, pos_hour_overtimes, pos_flag, ist_dt) values  
            ('${div_code}', '${dep_code}','${pos_code}', '${pos_desc}', ${pos_salary}, ${pos_allowance}, 
            ${pos_hour_working}, ${pos_hour_overtimes},'1', '${moment().format('YYYY-MM-DD HH:mm:ss')}');`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [{
                        pos_code: pos_code
                    }],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลตำแหน่ง', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลตำแหน่ง', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลตำแหน่ง', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}
