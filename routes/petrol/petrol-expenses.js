const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
//Success
exports.getPetrolExpensesInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        let { ptrl_expenses_code, ptrl_code, page_index, page_limit, action } = req.body[0];
        page_index = page_index || 1;
        page_limit = page_limit || 10;

        if (page_index > 0) {
            page_index -= 1;
        }
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_expenses_code == undefined || lic_code == undefined || ptrl_code == undefined || action == undefined) {
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
            if (ptrl_expenses_code.toString().toUpperCase() != 'ALL') {
                script = `select ptrl_expenses_code,
                tbl_petrol.ptrl_code,
                tbl_petrol.ptrl_desc,
                tbl_petrol.ptrl_short_desc,
                ptrl_expenses_desc,
                ptrl_expenses,
                ptrl_expenses_flag,
                tbl_petrol_expenses.ist_dt,
                tbl_petrol_expenses.mdf_dt,
                tbl_petrol_expenses.rm_dt 

                from tbl_petrol
                left join tbl_petrol_expenses on tbl_petrol.ptrl_code = tbl_petrol_expenses.ptrl_code 
                where tbl_petrol_expenses.ptrl_expenses_flag = '1' and tbl_petrol_expenses.ptrl_expenses_code is not null 
                and tbl_petrol_expenses.ptrl_expenses_code = '${ptrl_expenses_code}' `;
            }
            else {
                script = `select ptrl_expenses_code,
                tbl_petrol.ptrl_code,
                tbl_petrol.ptrl_desc,
                tbl_petrol.ptrl_short_desc,
                ptrl_expenses_desc,
                ptrl_expenses,
                ptrl_expenses_flag,
                tbl_petrol_expenses.ist_dt,
                tbl_petrol_expenses.mdf_dt,
                tbl_petrol_expenses.rm_dt 

                from tbl_petrol
                left join tbl_petrol_expenses on tbl_petrol.ptrl_code = tbl_petrol_expenses.ptrl_code 
                where tbl_petrol_expenses.ptrl_expenses_flag = '1' and tbl_petrol_expenses.ptrl_expenses_code is not null `;
            }

            if (ptrl_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_petrol_expenses.ptrl_code = '${ptrl_code}' `
            }

            script += ` order by tbl_petrol_expenses.ist_dt desc `
            script += ` limit ${page_limit} offset ${page_index * page_limit}`;
            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));
                    let page_total = 0;
                    let rows_total = 0;
                    let script = ``
                    if (ptrl_expenses_code.toString().toUpperCase() != 'ALL') {
                        script = `select 
                        ceil((ceil(count(ptrl_expenses_code)) / ${page_limit})) as page_total,
                        count(ptrl_expenses_code) as rows_total 
                        from tbl_petrol
                        left join tbl_petrol_expenses on tbl_petrol.ptrl_code = tbl_petrol_expenses.ptrl_code 
                        where tbl_petrol_expenses.ptrl_expenses_flag = '1' and tbl_petrol_expenses.ptrl_expenses_code is not null 
                        and tbl_petrol_expenses.ptrl_expenses_code = '${ptrl_expenses_code}' `;
                    }
                    else {
                        script = `select 
                        ceil((ceil(count(ptrl_expenses_code)) / ${page_limit})) as page_total,
                        count(ptrl_expenses_code) as rows_total 
                        from tbl_petrol
                        left join tbl_petrol_expenses on tbl_petrol.ptrl_code = tbl_petrol_expenses.ptrl_code 
                        where tbl_petrol_expenses.ptrl_expenses_flag = '1' and tbl_petrol_expenses.ptrl_expenses_code is not null `;
                    }

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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลค่าใช้จ่ายปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลค่าใช้จ่ายปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.removePetrolExpenses = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { ptrl_expenses_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_expenses_code == undefined || lic_code == undefined || action == undefined) {
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
            script = `update tbl_petrol_expenses set ptrl_expenses_flag = '0', rm_dt = '${moment().format('YYYY - MM - DD HH: mm:ss')}' where ptrl_expenses_code = '${ptrl_expenses_code}'; `

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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลค่าใช้จ่ายปั้ม', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลค่าใช้จ่ายปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลค่าใช้จ่ายปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.setPetrolExpensesInformation = async (req, res, next) => {

    return (async () => {
        //debugger
        let lic_code = req.header('lic_code');
        let { ptrl_expenses_code } = req.query;
        let {
            ptrl_code,
            ptrl_expenses_desc,
            ptrl_expenses,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_expenses_code == undefined || ptrl_code == undefined || ptrl_expenses_desc == undefined
            || ptrl_expenses == undefined || action == undefined) {
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
            script = `update tbl_petrol_expenses set
                    ptrl_expenses = ${ptrl_expenses},
                    ptrl_expenses_desc = '${ptrl_expenses_desc}',
                        ptrl_code = '${ptrl_code}',
                        mdf_dt = '${moment().format('YYYY - MM - DD HH: mm:ss')}' 
            where ptrl_expenses_code = '${ptrl_expenses_code}'; `

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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลค่าใช้จ่ายปั้ม', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลค่าใช้จ่ายปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลค่าใช้จ่ายปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

//Success
exports.addPetrolExpensesInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            ptrl_code,
            ptrl_expenses_desc,
            ptrl_expenses,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_code == undefined || ptrl_expenses_desc == undefined
            || ptrl_expenses == undefined || action == undefined || lic_code == undefined) {
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
            script = `select ptrl_expenses_code from tbl_petrol_expenses where(ptrl_expenses_desc = '${ptrl_expenses_desc}') and tbl_petrol_expenses.ptrl_code = '${ptrl_code}' and ptrl_expenses_flag = '1'; `
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
                    await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลค่าใช้จ่ายปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ', action[0].value);
                    return;
                }
            }

            let ptrl_expenses_code = 'pexp-' + moment().format('x');
            script = `insert into tbl_petrol_expenses
                        (ptrl_expenses_code, ptrl_expenses_desc, ptrl_code, ptrl_expenses, ptrl_expenses_flag, ist_dt) values
                            ('${ptrl_expenses_code}', '${ptrl_expenses_desc}', '${ptrl_code}', ${ptrl_expenses}, '1', '${moment().format('YYYY - MM - DD HH: mm: ss')}'); `

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: [{
                        ptrl_expenses_code: ptrl_expenses_code
                    }],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลค่าใช้จ่ายปั้ม', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลค่าใช้จ่ายปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลค่าใช้จ่ายปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}
