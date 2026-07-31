const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
exports.getExpensesOfJobInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { job_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (job_code == undefined || lic_code == undefined || action == undefined) {
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
            script = `select sum(expenses) as expenses, expenses_desc
            from 
            ((select (case when ptrl_expenses_per_litter is null then 0 else ptrl_expenses_per_litter end)  
            * case when tbl_order.item_quantity is null then 0 else tbl_order.item_quantity end as expenses,
            'ค่าใช้จ่ายต่อลิตร' as expenses_desc
            from tbl_order 
            left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code
            left join tbl_petrol on tbl_petrol.ptrl_code = tbl_order_petrol.ptrl_code 
            where tbl_order.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}'))

            union 

            (select (case when ptrl_expenses_per_km is null then 0 else ptrl_expenses_per_km end)  
            * case when tbl_order.distance is null then 0 else tbl_order.distance end as expenses,
            'ค่าใช้จ่ายต่อกิโล' as expenses_desc
            from tbl_order 
            left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code
            left join tbl_petrol on tbl_petrol.ptrl_code = tbl_order_petrol.ptrl_code 
            where tbl_order.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}'))

            union 

            (select tbl_petrol_expenses.ptrl_expenses as expenses, tbl_petrol_expenses.ptrl_expenses_desc as expenses_desc
            from tbl_order 
            left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code
            left join tbl_petrol on tbl_petrol.ptrl_code = tbl_order_petrol.ptrl_code 
            left join tbl_petrol_expenses on tbl_petrol.ptrl_code = tbl_petrol_expenses.ptrl_code 
            where tbl_order.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}'))) xtblmaster

            where xtblmaster.expenses is not null
            group by expenses_desc
            order by expenses_desc asc`;

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
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }]
        res.status(200).send(response);
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลรถและหางลาก', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}
