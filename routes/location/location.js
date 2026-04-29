const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xbase64 = new require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
exports.getProvinceInformation = async (req, res, next) => {

    var xresult = [];

    try {

        let lic_code = req.header('lic_code');
        let { prov_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (prov_code == undefined || lic_code == undefined || action == undefined) {
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
            if (prov_code.toString().toUpperCase() != 'ALL') {
                script = `select prov_code, prov_desc, prov_desc_en, prov_flag ist_dt, mdf_dt, rm_dt
                from tbl_province where prov_flag = '1' and prov_code = '${prov_code}' order by prov_desc asc`;
            }
            else {
                script = `select prov_code, prov_desc, prov_desc_en, prov_flag ist_dt, mdf_dt, rm_dt
                from tbl_province where prov_flag = '1' order by prov_desc asc`;
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
            }
        }

    } catch (error) {

        console.log(error);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: xresult,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }]
        res.status(200).send(response);
    }

}

exports.getAmphureInformation = async (req, res, next) => {

    var xresult = [];


    try {

        let lic_code = req.header('lic_code');
        let { prov_code, amph_code, action, page_index, page_limit } = req.body[0];
        page_index = page_index === undefined ? 1 : page_index;
        page_limit = page_limit === undefined ? 30 : page_limit;
        if (page_index > 0) page_index -= 1;

        //เช็คเฉพาะส่วนที่สำคัญ
        if (prov_code == undefined || amph_code == undefined || lic_code == undefined || action == undefined) {
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
            if (prov_code.toString().toUpperCase() == 'ALL') {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง prov_code ไม่รองรับ ALL',
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                return;
            }

            if (amph_code.toString().toUpperCase() != 'ALL') {
                script = `select tbl_amphure.prov_code, tbl_province.prov_desc, tbl_province.prov_desc_en, tbl_amphure.amph_flag, 
                tbl_amphure.amph_code, tbl_amphure.amph_desc, tbl_amphure.amph_desc_en,tbl_amphure.ist_dt, tbl_amphure.mdf_dt, 
                tbl_amphure.rm_dt
                from tbl_amphure 
                left join tbl_province on tbl_amphure.prov_code = tbl_province.prov_code
                where amph_flag = '1' and tbl_amphure.prov_code = '${prov_code}' and tbl_amphure.amph_code = '${amph_code}'
                order by amph_desc asc
                offset (${page_index} * ${page_limit}) limit ${page_limit}
                `;
            }
            else {
                script = `select tbl_amphure.prov_code, tbl_province.prov_desc, tbl_province.prov_desc_en, tbl_amphure.amph_flag, 
                tbl_amphure.amph_code, tbl_amphure.amph_desc, tbl_amphure.amph_desc_en,tbl_amphure.ist_dt, tbl_amphure.mdf_dt, 
                tbl_amphure.rm_dt
                from tbl_amphure 
                left join tbl_province on tbl_amphure.prov_code = tbl_province.prov_code
                where amph_flag = '1' and tbl_amphure.prov_code = '${prov_code}' 
                order by amph_desc asc
                offset (${page_index} * ${page_limit}) limit ${page_limit}
                `;
            }
            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                    let page_total = 0;
                    let rows_total = 0;

                    let countScript = ``;

                    if (amph_code.toString().toUpperCase() != 'ALL') {
                        countScript = `SELECT 
                        CEIL((CEIL(SUM(rows_total)) / ${page_limit})) as page_total, 
                        SUM(rows_total) as rows_total  
                    FROM (
                        SELECT 1 as rows_total FROM tbl_amphure 
                        LEFT JOIN tbl_province ON tbl_amphure.prov_code = tbl_province.prov_code
                        WHERE amph_flag = '1' and tbl_amphure.prov_code = '${prov_code}' and tbl_amphure.amph_code = '${amph_code}'
                        ORDER BY amph_desc asc
                    ) xtbl_master;`;
                    }
                    else {
                        countScript = `SELECT 
                        CEIL((CEIL(SUM(rows_total)) / ${page_limit})) as page_total, 
                        SUM(rows_total) as rows_total  
                    FROM (
                        SELECT 1 as rows_total FROM tbl_amphure 
                        LEFT JOIN tbl_province ON tbl_amphure.prov_code = tbl_province.prov_code
                        where amph_flag = '1' and tbl_amphure.prov_code = '${prov_code}' 
                        ORDER BY amph_desc asc
                    ) xtbl_master;`;
                    }

                    let tbl_temporary0 = await pgConn.get(
                        dbPrefix + lic_code,
                        countScript,
                        config.connectionString(),
                    );

                    if (!tbl_temporary0.code && tbl_temporary0.data.length > 0) {
                        page_total = tbl_temporary0.data[0].page_total;
                        rows_total = tbl_temporary0.data[0].rows_total;
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
            }
        }

    } catch (error) {

        console.log(error);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: xresult,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }]
        res.status(200).send(response);
    }

}

exports.getTambonInformation = async (req, res, next) => {

    var xresult = [];


    try {

        let lic_code = req.header('lic_code');
        let { prov_code, amph_code, tamb_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (prov_code == undefined || amph_code == undefined || tamb_code == undefined || lic_code == undefined || action == undefined) {
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
            if (prov_code.toString().toUpperCase() == 'ALL') {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง prov_code ไม่รองรับ ALL',
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                return;
            }

            if (amph_code.toString().toUpperCase() == 'ALL') {

                let response = [{
                    status: 'error',
                    invalid_code: '-1',
                    message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง amph_code ไม่รองรับ ALL',
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                return;
            }

            if (tamb_code.toString().toUpperCase() != 'ALL') {
                script = `select tbl_amphure.prov_code, tbl_province.prov_desc, tbl_province.prov_desc_en, 
                tbl_amphure.amph_code, tbl_amphure.amph_desc, tbl_amphure.amph_desc_en,
                tbl_tambon.tamb_code, tbl_tambon.tamb_desc, tbl_tambon.tamb_desc_en, tbl_tambon.tamb_flag,tbl_tambon.ist_dt, tbl_tambon.mdf_dt, 
                tbl_tambon.rm_dt
                from tbl_tambon
                left join tbl_amphure on tbl_tambon.amph_code = tbl_amphure.amph_code
                left join tbl_province on tbl_amphure.prov_code = tbl_province.prov_code
                where tamb_flag = '1' and tbl_amphure.prov_code = '${prov_code}' and tbl_amphure.amph_code = '${amph_code}' and tbl_tambon.tamb_code = '${tamb_code}' 
                order by tamb_desc asc`;
            }
            else {
                script = `select tbl_amphure.prov_code, tbl_province.prov_desc, tbl_province.prov_desc_en, 
                tbl_amphure.amph_code, tbl_amphure.amph_desc, tbl_amphure.amph_desc_en,
                tbl_tambon.tamb_code, tbl_tambon.tamb_desc, tbl_tambon.tamb_desc_en, tbl_tambon.tamb_flag,tbl_tambon.ist_dt, tbl_tambon.mdf_dt, 
                tbl_tambon.rm_dt
                from tbl_tambon
                left join tbl_amphure on tbl_tambon.amph_code = tbl_amphure.amph_code
                left join tbl_province on tbl_amphure.prov_code = tbl_province.prov_code
                where tamb_flag = '1' and tbl_amphure.prov_code = '${prov_code}' and tbl_amphure.amph_code = '${amph_code}'  
                order by tamb_desc asc`;
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
            }
        }

    } catch (error) {

        console.log(error);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: xresult,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }]
        res.status(200).send(response);
    }

}