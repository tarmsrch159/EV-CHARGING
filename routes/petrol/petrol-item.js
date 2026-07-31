const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
//Success
exports.getPetrolItemInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        let { itm_code, ptrl_code, action, page_index, page_limit } = req.body[0];


        //เช็คเฉพาะส่วนที่สำคัญ
        if (itm_code == undefined || ptrl_code == undefined || lic_code == undefined || action == undefined) {
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
            if (page_index > 0) {
                page_index -= 1;
            }
            let limit = page_limit || 100;
            let offset = page_index * limit;

            let wh = '';
            if (itm_code.toString().toUpperCase() != 'ALL') {
                wh += ` AND tbpi.itm_code = '${itm_code}' `;
            }
            if (ptrl_code.toString().toUpperCase() != 'ALL') {
                wh += ` AND tbpi.ptrl_code = '${ptrl_code}' `;
            }

            let script = `select
                    tbpi.ptrl_item_code,
                    tbpi.ptrl_code,
                    tbi.itm_code,
                    tbi.itm_desc,
                    tbi.itm_short_desc,
                    tbi.itm_type_code,
                    tit.itm_type_desc,
                    tbi.itm_unit_code,
                    tui.itm_unit_desc,
                    tbi.itm_icon,
                    tbi.itm_image,
                    tbi.itm_material_number,
                    tbpi.itm_merge,
                    tbpi.ist_dt,
                    tbpi.mdf_dt,
                    tbpi.rm_dt
                FROM tbl_petrol_item tbpi
                LEFT JOIN tbl_item tbi on tbpi.itm_code = tbi.itm_code
                LEFT JOIN tbl_item_type tit on tbi.itm_type_code = tit.itm_type_code 
                LEFT JOIN tbl_item_unit tui on tbi.itm_unit_code = tui.itm_unit_code 
                WHERE tbpi.ptrl_item_flag = '1' ${wh}
            `;
            let pageLimit = `order by tbpi.ist_dt desc limit ${limit} offset ${offset}`;

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script + pageLimit, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                    let page_total = 0;
                    let rows_total = 0;
                    let script_count = `select count(tbpi.ptrl_item_code) as total
                        FROM tbl_petrol_item tbpi
                        LEFT JOIN tbl_item tbi on tbpi.itm_code = tbi.itm_code
                        WHERE tbpi.ptrl_item_flag = '1' ${wh}`;
                    let tbl_temporary_count = await pgConn.get(dbPrefix + lic_code, script_count, config.connectionString());
                    if (!tbl_temporary_count.code) {
                        rows_total = tbl_temporary_count.data[0].total;
                        page_total = Math.ceil(rows_total / limit);
                    }

                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        page_total: (page_total <= 0 ? 1 : page_total),
                        rows_total: parseInt(rows_total),
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
                        data: [],
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
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลสินค้าปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลสินค้าปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.removePetrolItem = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { ptrl_item_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_item_code == undefined || lic_code == undefined || action == undefined) {
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

            let valuesArr = [];
            for (let i = 0; i < ptrl_item_code.length; i++) {
                valuesArr.push(`'${ptrl_item_code[i]}'`);
            }

            let script = `update tbl_petrol_item 
                set ptrl_item_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
                where ptrl_item_code in (${valuesArr.join(',')});
            `;

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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลสินค้าปั้ม', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลสินค้าปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลสินค้าปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.setPetrolItemInformation = async (req, res, next) => {

    return (async () => {
        //debugger
        let lic_code = req.header('lic_code');
        let { ptrl_item_code } = req.query;
        let {
            ptrl_code,
            itm_code,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_item_code == undefined || ptrl_code == undefined || itm_code == undefined || action == undefined) {
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
            script = `update tbl_petrol_item set
                ptrl_code = '${ptrl_code}', 
                itm_code = '${itm_code}',
                mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where ptrl_item_code = '${ptrl_item_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลสินค้าปั้ม', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลสินค้าปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลสินค้าปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

//Success
exports.addPetrolItemInformation = async (req, res, next) => {

    return (async () => {
        debugger
        let lic_code = req.header('lic_code');
        let {
            ptrl_code,
            itm_code,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_code == undefined || itm_code == undefined || action == undefined || lic_code == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return;
        }

        let now = moment().format('YYYY-MM-DD HH:mm:ss');
        let valuesArr = [];

        function uniqueCode(suffix) {
            let timestamp = moment().format('x');
            let suffixStr = suffix.toString();
            let shortenedTimestamp = timestamp.substring(0, timestamp.length - suffixStr.length);
            return 'pitm-' + shortenedTimestamp + suffixStr;
        }

        for (let i = 0; i < itm_code.length; i++) {
            let ptrl_item_code = uniqueCode(i);
            valuesArr.push(`('${ptrl_item_code}', '${ptrl_code}', '${itm_code[i]}', '1', '${now}')`);
        }

        let script = `
            insert into tbl_petrol_item 
            (ptrl_item_code, ptrl_code, itm_code, ptrl_item_flag, ist_dt) 
            values ${valuesArr.join(',')}
            ON CONFLICT (ptrl_code, itm_code) 
            DO UPDATE SET 
                ptrl_item_flag = '1',
                mdf_dt = '${now}',
                rm_dt = null;
        `;

        let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
        if (!tbl_temporary.code) {
            let response = [{
                status: 'success',
                invalid_code: '0',
                message: 'บันทึกข้อมูลสำเร็จ (รายการที่ซ้ำจะถูกข้ามอัตโนมัติ)',
                data: [],
                response_time: now
            }];

            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลสินค้าปั้ม', JSON.stringify(req.body[0]), 'success', action[0].value);
        } else {
            let response = [{
                status: 'error',
                invalid_code: '-3',
                message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลสินค้าปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return;
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลสินค้าปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.mergePetrolItem = async (req, res, next) => {
    var xresult = [];

    return (async () => {
        let method = req.method;
        let mergeStatus = 0;
        if (method === 'PUT') {
            mergeStatus = 1;
        } else if (method === 'DELETE') {
            mergeStatus = 0;
        }

        let lic_code = req.header('lic_code');
        let { ptrl_item_code, ptrl_code, action } = req.body[0];

        if (ptrl_item_code == undefined || ptrl_code == undefined || lic_code == undefined || action == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return;
        }

        let valuesArr = [];
        for (let i = 0; i < ptrl_item_code.length; i++) {
            valuesArr.push(`'${ptrl_item_code[i]}'`);
        }

        let script = `update tbl_petrol_item 
            set itm_merge = '${mergeStatus}', mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where ptrl_item_code in (${valuesArr.join(',')});
        `;

        let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
        if (!tbl_temporary.code) {
            let response = [{
                status: 'success',
                invalid_code: '0',
                message: 'บันทึกข้อมูลสำเร็จ',
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];

            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลสินค้าปั้ม', JSON.stringify(req.body[0]), 'success', action[0].value);
        } else {
            let response = [{
                status: 'error',
                invalid_code: '-3',
                message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                data: [],
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลสินค้าปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลสินค้าปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
    });
}

exports.getMergePetrolItem = async (req, res, next) => {

    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        let { ptrl_code, action, page_index, page_limit } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_code == undefined || lic_code == undefined || action == undefined) {
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
            if (page_index > 0) {
                page_index -= 1;
            }
            let limit = page_limit || 100;
            let offset = page_index * limit;

            let wh = '';
            if (ptrl_code.toString().toUpperCase() != 'ALL') {
                wh += ` AND tbpi.ptrl_code = '${ptrl_code}' `;
            }

            let script = `select
                    tbpi.ptrl_item_code,
                    tbpi.ptrl_code,
                    tbi.itm_code,
                    tbi.itm_desc,
                    tbi.itm_short_desc,
                    tbi.itm_type_code,
                    tbi.itm_unit_code,
                    tbi.itm_icon,
                    tbi.itm_image,
                    tbi.itm_material_number
                FROM tbl_petrol_item tbpi
                LEFT JOIN tbl_item tbi on tbpi.itm_code = tbi.itm_code
                WHERE tbpi.ptrl_item_flag = '1' AND tbpi.itm_merge = '1' ${wh}
            `;
            let pageLimit = `order by tbi.itm_desc asc limit ${limit} offset ${offset}`;


            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script + pageLimit, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                    let page_total = 0;
                    let rows_total = 0;
                    let script_count = `select count(tbpi.ptrl_item_code) as total
                        FROM tbl_petrol_item tbpi
                        LEFT JOIN tbl_item tbi on tbpi.itm_code = tbi.itm_code
                        WHERE tbpi.ptrl_item_flag = '1' AND tbpi.itm_merge = '1' ${wh}`;
                    let tbl_temporary_count = await pgConn.get(dbPrefix + lic_code, script_count, config.connectionString());
                    if (!tbl_temporary_count.code) {
                        rows_total = tbl_temporary_count.data[0].total;
                        page_total = Math.ceil(rows_total / limit);
                    }

                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        page_total: (page_total <= 0 ? 1 : page_total),
                        rows_total: parseInt(rows_total),
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
                        data: [],
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
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลสินค้าปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลสินค้าปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}