const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
//Success
exports.getPetrolMergeJobInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        let { ptrl_code, ptrl_merge_code, action, page_index, page_limit } = req.body[0];

        let page = parseInt(page_index) || 1;
        let limit = parseInt(page_limit) || 10;
        let offset = (page - 1) * limit;
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_code == undefined || ptrl_merge_code == undefined || lic_code == undefined || action == undefined) {
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

            let script = `
                SELECT COUNT(*) OVER() AS total_record,
                tbl_petrol_merge_job.ptrl_merge_job_code,   
                tbl_petrol_merge_job.ptrl_merge_code,
                tbl_petrol_merge_job.ptrl_code,
                tbl_petrol.ptrl_number,
                tbl_petrol.ptrl_desc,
                tbl_petrol.ptrl_short_desc,
                tbl_petrol_group.ptrl_group_code,
                tbl_petrol_group.ptrl_group_desc,
                tbl_merge_petrol.ptrl_number as ptrl_merge_number,
                tbl_merge_petrol.ptrl_desc as ptrl_merge_desc,
                tbl_merge_petrol.ptrl_short_desc as ptrl_merge_short_desc,
                tbl_petrol.off_code,
                tbl_office.off_desc,
                tbl_petrol_merge_job.ist_dt,
                tbl_petrol_merge_job.mdf_dt,
                tbl_petrol_merge_job.rm_dt 
                FROM tbl_petrol_merge_job
                LEFT JOIN tbl_petrol ON tbl_petrol_merge_job.ptrl_code = tbl_petrol.ptrl_code
                LEFT JOIN tbl_office ON tbl_petrol.off_code = tbl_office.off_code
                LEFT JOIN tbl_petrol_group ON tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                LEFT JOIN tbl_petrol tbl_merge_petrol ON tbl_petrol_merge_job.ptrl_merge_code = tbl_merge_petrol.ptrl_code
                WHERE tbl_petrol_merge_job.petrol_merge_job_flag = '1' 
                AND tbl_petrol_merge_job.ptrl_merge_code IS NOT NULL 
                AND tbl_petrol.ptrl_flag = '1'
            `;

            if (ptrl_code.toString().toUpperCase() !== 'ALL') {
                script += ` AND tbl_petrol_merge_job.ptrl_code = '${ptrl_code}' `;
            }
            if (ptrl_merge_code.toString().toUpperCase() !== 'ALL') {
                script += ` AND tbl_petrol_merge_job.ptrl_merge_code IS NOT NULL 
                AND tbl_petrol_merge_job.ptrl_merge_code = '${ptrl_merge_code}' `;
            }

            script += ` order by tbl_petrol_merge_job.ist_dt desc `
            script += ` limit ${limit} offset ${offset};`

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));
                    let total_item = parseInt(tbl_temporary.data[0].total_record) || 0;
                    let total_page = Math.ceil(total_item / limit);
                    tbl_temporary.data.forEach(item => {
                        delete item.total_record;
                    });
                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: tbl_temporary.data,
                        rows_total: total_item,
                        page_total: total_page,
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
                        rows_total: 0,
                        page_total: 0,
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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลคลังสินค้าปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลคลังสินค้าปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

exports.getPetrolMergeJobDetails = async (req, res, next) => {
    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        let { ptrl_merge_job_code, action, page_index, page_limit } = req.body[0];

        const page = parseInt(page_index) || 1;
        const limit = parseInt(page_limit) || 10;
        const offset = (page - 1) * limit;
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_merge_job_code == undefined || lic_code == undefined || action == undefined) {
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
            if (ptrl_merge_job_code.toString().toUpperCase() != 'ALL') {
                script = `select
                tbl_petrol_merge_job_info.id,
                tbl_petrol_merge_job.ptrl_merge_job_code,
                tbl_petrol_merge_job.ptrl_code,
                tbl_ptrl.ptrl_number,
                tbl_ptrl.ptrl_desc,
                tbl_ptrl.ptrl_short_desc,
                tbl_petrol_merge_job.ptrl_merge_code,
                tbl_merge_ptrl.ptrl_number as ptrl_merge_number,
                tbl_merge_ptrl.ptrl_desc as ptrl_merge_desc,
                tbl_merge_ptrl.ptrl_short_desc as ptrl_merge_short_desc,
                tbl_petrol_merge_job_info.itm_code,
                tbl_item.itm_desc,
                tbl_petrol_merge_job_info.dpo_code,
                tbl_depot.dpo_desc,
                tbl_petrol_merge_job_info.ist_dt,
                tbl_petrol_merge_job_info.mdf_dt,
                tbl_petrol_merge_job_info.rm_dt 
                from tbl_petrol_merge_job_info
                left join tbl_depot on tbl_petrol_merge_job_info.dpo_code = tbl_depot.dpo_code and tbl_depot.dpo_flag = '1'
                left join tbl_item on tbl_petrol_merge_job_info.itm_code = tbl_item.itm_code and tbl_item.itm_flag = '1'    
                left join tbl_petrol_merge_job on tbl_petrol_merge_job_info.ptrl_merge_job_code = tbl_petrol_merge_job.ptrl_merge_job_code
                left join tbl_petrol tbl_ptrl on tbl_petrol_merge_job.ptrl_code = tbl_ptrl.ptrl_code -- Join 2 ตาราง tbl_petrol และ tbl_petrol_merge_job
                left join tbl_petrol tbl_merge_ptrl on tbl_petrol_merge_job.ptrl_merge_code = tbl_merge_ptrl.ptrl_code -- Join 2 ตาราง tbl_petrol และ tbl_petrol_merge_job
                where tbl_petrol_merge_job_info.ptrl_merge_job_code = '${ptrl_merge_job_code}' 
                AND tbl_petrol_merge_job_info.flag = '1'
                AND tbl_petrol_merge_job.petrol_merge_job_flag = '1'
                AND tbl_ptrl.ptrl_flag = '1'`;
            }
            else {
                script = `select 
                tbl_petrol_merge_job_info.id,
                tbl_petrol_merge_job.ptrl_merge_job_code,
                tbl_petrol_merge_job.ptrl_code,
                tbl_ptrl.ptrl_number,
                tbl_ptrl.ptrl_desc,
                tbl_ptrl.ptrl_short_desc,
                tbl_petrol_merge_job.ptrl_merge_code,
                tbl_merge_ptrl.ptrl_number as ptrl_merge_number,
                tbl_merge_ptrl.ptrl_desc as ptrl_merge_desc,
                tbl_merge_ptrl.ptrl_short_desc as ptrl_merge_short_desc,
                tbl_petrol_merge_job_info.itm_code,
                tbl_item.itm_desc,
                tbl_petrol_merge_job_info.dpo_code,
                tbl_depot.dpo_desc,
                tbl_petrol_merge_job_info.ist_dt,
                tbl_petrol_merge_job_info.mdf_dt,
                tbl_petrol_merge_job_info.rm_dt 
                from tbl_petrol_merge_job_info
                left join tbl_depot on tbl_petrol_merge_job_info.dpo_code = tbl_depot.dpo_code and tbl_depot.dpo_flag = '1'
                left join tbl_item on tbl_petrol_merge_job_info.itm_code = tbl_item.itm_code and tbl_item.itm_flag = '1'
                left join tbl_petrol_merge_job on tbl_petrol_merge_job_info.ptrl_merge_job_code = tbl_petrol_merge_job.ptrl_merge_job_code
                left join tbl_petrol tbl_ptrl on tbl_petrol_merge_job.ptrl_code = tbl_ptrl.ptrl_code -- Join 2 ตาราง tbl_petrol และ tbl_petrol_merge_job
                left join tbl_petrol tbl_merge_ptrl on tbl_petrol_merge_job.ptrl_merge_code = tbl_merge_ptrl.ptrl_code -- Join 2 ตาราง tbl_petrol และ tbl_petrol_merge_job
                where tbl_petrol_merge_job_info.flag = '1'
                AND tbl_petrol_merge_job.petrol_merge_job_flag = '1' 
                AND tbl_ptrl.ptrl_flag = '1'`;
            }

            script += ` 
            order by tbl_petrol_merge_job_info.ist_dt desc
            `
            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {

                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));
                    // ทำการ Grouping ข้อมูลฝั่ง Node.js 
                    let groupedData = Object.values(tbl_temporary.data.reduce((acc, curr) => {
                        // ใช้ ptrl_merge_job_code เป็นคีย์ในการจัดกลุ่มเพื่อไม่ให้ซ้ำ
                        let key = curr.ptrl_merge_job_code;

                        if (!acc[key]) {
                            acc[key] = {
                                ptrl_merge_job_code: curr.ptrl_merge_job_code,
                                ptrl_code: curr.ptrl_code,
                                ptrl_number: curr.ptrl_number,
                                ptrl_desc: curr.ptrl_desc,
                                ptrl_short_desc: curr.ptrl_short_desc,
                                ptrl_merge_code: curr.ptrl_merge_code,
                                ptrl_merge_number: curr.ptrl_merge_number,
                                ptrl_merge_desc: curr.ptrl_merge_desc,
                                ptrl_merge_short_desc: curr.ptrl_merge_short_desc,
                                ist_dt: curr.ist_dt,
                                mdf_dt: curr.mdf_dt,
                                rm_dt: curr.rm_dt,
                                data: [], // สำหรับเก็บ dpo_code และ itm_data
                            };
                        }

                        // เอา dpo_code และ itm_code จัดเข้ากลุ่มย่อย
                        // (ดักไว้ว่าถ้าเชื่อมไม่เจอ = ค่าว่าง ก็ไม่ต้อง push เข้าไป)
                        if (curr.dpo_code && curr.dpo_desc !== "") {
                            let dpo_idx = acc[key].data.findIndex(d => d.dpo_code === curr.dpo_code);
                            if (dpo_idx === -1) {
                                acc[key].data.push({
                                    dpo_code: curr.dpo_code,
                                    dpo_desc: curr.dpo_desc,
                                    earliest_ist_dt: curr.ist_dt, // เก็บ ist_dt เก่าสุดของ dpo_code นี้ไว้ใช้เรียงลำดับ (ตอนคลังนี้ถูกเพิ่มครั้งแรก)
                                    itm_data: []
                                });
                                dpo_idx = acc[key].data.length - 1;
                            } else {
                                // เปรียบเทียบเอา ist_dt ที่เก่าที่สุด
                                let existing = new Date(acc[key].data[dpo_idx].earliest_ist_dt);
                                let current = new Date(curr.ist_dt);
                                if (current < existing) {
                                    acc[key].data[dpo_idx].earliest_ist_dt = curr.ist_dt;
                                }
                            }

                            if (curr.itm_code && curr.itm_desc !== "") {
                                let itm_idx = acc[key].data[dpo_idx].itm_data.findIndex(i => i.itm_code === curr.itm_code);
                                if (itm_idx === -1) {
                                    acc[key].data[dpo_idx].itm_data.push({
                                        id: curr.id,
                                        itm_code: curr.itm_code,
                                        itm_desc: curr.itm_desc
                                    });
                                }
                            }
                        }

                        return acc;
                    }, {}));

                    // เรียง data (dpo_code) ให้คลังสินค้าที่ถูกเพิ่มล่าสุดอยู่บนสุด (ใช้ ist_dt ที่เก่าสุดของ dpo_code = ตอนที่คลังถูกเพิ่มครั้งแรก)
                    groupedData.forEach(group => {
                        group.data.sort((a, b) => new Date(b.earliest_ist_dt) - new Date(a.earliest_ist_dt));
                        // ลบ earliest_ist_dt ออกเพราะไม่ต้องส่งไป client
                        group.data.forEach(d => delete d.earliest_ist_dt);
                    });

                    let total_item = groupedData.length;
                    let total_page = Math.ceil(total_item / limit);
                    let paginatedData = groupedData.slice(offset, offset + limit);
                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: '',
                        data: paginatedData,
                        rows_total: total_item,
                        page_total: total_page,
                        response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                    }]

                    res.status(200).send(response);
                    return;
                } else {

                    let response = [{
                        status: 'success',
                        invalid_code: '0',
                        message: 'ไม่พบข้อมูล สินค้า และคลังสินค้า',
                        data: [],
                        rows_total: 0,
                        page_total: 0,
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
                await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลคลังสินค้าปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลคลังสินค้าปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

// ========= Success =========
exports.getPetrolMergeJobDetailsV2 = async (req, res, next) => {
    var xresult = [];

    return (async () => {

        let lic_code = req.header('lic_code');
        let { ptrl_code, action, search, page_index, page_limit } = req.body[0];

        const page = parseInt(page_index) || 1;
        const limit = parseInt(page_limit) || 10;
        const offset = (page > 0 ? page - 1 : 0) * limit;

        // เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_code === undefined || lic_code === undefined || action === undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }];
            res.status(200).send(response);
            return;
        }

        // =========================================================
        // 1. จัดการเงื่อนไข WHERE แบบรวมศูนย์ (Dynamic Conditions)
        // =========================================================
        let conditions = [
            "tbl_petrol_merge_job_info.flag = '1'",
            "tbl_petrol_merge_job.petrol_merge_job_flag = '1'",
            "tbl_ptrl.ptrl_flag = '1'"
        ];

        if (ptrl_code.toString().toUpperCase() !== 'ALL') {
            conditions.push(`tbl_petrol_merge_job.ptrl_code = '${ptrl_code}'`);
        }

        if (search) {
            conditions.push(`(
                tbl_petrol_merge_job_info.ptrl_merge_job_code LIKE '%${search}%' 
                OR tbl_ptrl.ptrl_desc LIKE '%${search}%' 
                OR tbl_ptrl.ptrl_number LIKE '%${search}%' 
                OR tbl_merge_ptrl.ptrl_desc LIKE '%${search}%' 
                OR tbl_merge_ptrl.ptrl_number LIKE '%${search}%' 
                OR tbl_item.itm_desc LIKE '%${search}%' 
                OR tbl_depot.dpo_desc LIKE '%${search}%'
            )`);
        }

        let whereClause = "WHERE " + conditions.join(" AND ");

        let baseJoins = `
            FROM tbl_petrol_merge_job_info
            LEFT JOIN tbl_depot ON tbl_petrol_merge_job_info.dpo_code = tbl_depot.dpo_code AND tbl_depot.dpo_flag = '1'
            LEFT JOIN tbl_item ON tbl_petrol_merge_job_info.itm_code = tbl_item.itm_code AND tbl_item.itm_flag = '1'    
            LEFT JOIN tbl_petrol_merge_job ON tbl_petrol_merge_job_info.ptrl_merge_job_code = tbl_petrol_merge_job.ptrl_merge_job_code
            LEFT JOIN tbl_petrol tbl_ptrl ON tbl_petrol_merge_job.ptrl_code = tbl_ptrl.ptrl_code
            LEFT JOIN tbl_petrol tbl_merge_ptrl ON tbl_petrol_merge_job.ptrl_merge_code = tbl_merge_ptrl.ptrl_code
        `;

        // =========================================================
        // 2. Query ดึงข้อมูลหลัก (แบบ Row by Row)
        // =========================================================
        let dataScript = `
            SELECT
                tbl_petrol_merge_job_info.id,
                tbl_petrol_merge_job.ptrl_merge_job_code,
                tbl_petrol_merge_job.ptrl_code,
                tbl_ptrl.ptrl_number,
                tbl_ptrl.ptrl_desc,
                tbl_ptrl.ptrl_short_desc,
                tbl_petrol_merge_job.ptrl_merge_code,
                tbl_merge_ptrl.ptrl_number as ptrl_merge_number,
                tbl_merge_ptrl.ptrl_desc as ptrl_merge_desc,
                tbl_merge_ptrl.ptrl_short_desc as ptrl_merge_short_desc,
                tbl_petrol_merge_job_info.itm_code,
                tbl_item.itm_desc,
                tbl_petrol_merge_job_info.dpo_code,
                tbl_depot.dpo_desc,
                tbl_petrol_merge_job_info.ist_dt,
                tbl_petrol_merge_job_info.mdf_dt,
                tbl_petrol_merge_job_info.rm_dt 
            ${baseJoins}
            ${whereClause}
            ORDER BY tbl_merge_ptrl.ptrl_desc ASC
            LIMIT ${limit} OFFSET ${offset};
        `;

        let tbl_temporary = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());

        if (!tbl_temporary.code) {
            if (tbl_temporary.data.length > 0) {
                // แปลง null เป็น string ว่าง
                let flatData = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                // =========================================================
                // 3. Query หาจำนวนแถวทั้งหมด (Count Rows)
                // =========================================================
                let countScript = `
                    SELECT 
                        CEIL((COUNT(tbl_petrol_merge_job_info.id)::numeric / ${limit})) as page_total, 
                        COUNT(tbl_petrol_merge_job_info.id) as rows_total
                    ${baseJoins}
                    ${whereClause};
                `;

                let tbl_temporary0 = await pgConn.get(dbPrefix + lic_code, countScript, config.connectionString());

                let page_total = 0;
                let rows_total = 0;

                if (!tbl_temporary0.code && tbl_temporary0.data.length > 0) {
                    page_total = parseInt(tbl_temporary0.data[0].page_total);
                    rows_total = parseInt(tbl_temporary0.data[0].rows_total);
                }

                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: '',
                    data: flatData, // คืนค่าข้อมูลแบบ Flat (Row by Row) โดยไม่ Group ซ้อนกัน
                    rows_total: rows_total,
                    page_total: (page_total <= 0 ? 1 : page_total),
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }];

                res.status(200).send(response);
                return;
            } else {
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: 'ไม่พบข้อมูล สินค้า และคลังสินค้า',
                    data: [],
                    rows_total: 0,
                    page_total: 0,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }];
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
            }];
            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลคลังสินค้าปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
            return;
        }

    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: 'error',
            invalid_code: '-4',
            message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: xresult,
            response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
        }];
        res.status(200).send(response);
        await xglobal.action_logs(lic_code, action[0].id, 'ดึงข้อมูลคลังสินค้าปั้ม', JSON.stringify(req.body[0]), 'ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}


//Success
exports.removePetrolMergeJob = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { ptrl_merge_job_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_merge_job_code == undefined || lic_code == undefined || action == undefined) {
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
            // ดัก ptrl_merge_job_code เป็น array
            let ptrl_merge_job_codeArr = Array.isArray(ptrl_merge_job_code) ? ptrl_merge_job_code : [ptrl_merge_job_code];
            let ptrl_merge_job_codeIn = ptrl_merge_job_codeArr.map(c => `'${c}'`).join(', ');
            script = `update tbl_petrol_merge_job set petrol_merge_job_flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where ptrl_merge_job_code in (${ptrl_merge_job_codeIn});`

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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลปั้มที่พ่วงงานกันได้', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลปั้มที่พ่วงงานกันได้', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลปั้มที่พ่วงงานกันได้', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.setPetrolMergeJobInformation = async (req, res, next) => {

    return (async () => {
        //debugger
        let lic_code = req.header('lic_code');
        let { ptrl_merge_job_code } = req.query;
        let {
            ptrl_code,
            ptrl_merge_code,
            action
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_merge_job_code == undefined || ptrl_code == undefined || ptrl_merge_code == undefined || action == undefined) {
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
            script = `update tbl_petrol_merge_job set
            ptrl_code = '${ptrl_code}', 
            ptrl_merge_code = '${ptrl_merge_code}',
            mdf_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where ptrl_merge_job_code = '${ptrl_merge_job_code}';`

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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลปั้มที่สามารถพ่วงกันได้', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลปั้มที่สามารถพ่วงกันได้', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'แก้ไขข้อมูลปั้มที่สามารถพ่วงกันได้', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });
}

//Success
exports.addPetrolMergeJobInformation = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { ptrl_code, ptrl_merge_code, action } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (!ptrl_code || !ptrl_merge_code || !Array.isArray(ptrl_merge_code) || !action || !lic_code) {
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

            let insertedData = [];
            let isError = false;

            if (Array.isArray(ptrl_merge_code) && ptrl_merge_code.length > 0) {
                if (typeof ptrl_merge_code[0] === 'object' && ptrl_merge_code[0].ptrl_code) {

                    // --- Loop 1: วนลูปตาม ptrl_merge_code ---
                    for (let i = 0; i < ptrl_merge_code.length; i++) {
                        let mergeObj = ptrl_merge_code[i];
                        let current_merge_code = mergeObj.ptrl_code;
                        let mergeData = mergeObj.data || [];

                        let ptrl_merge_job_code = '';

                        // Step 1: เช็ค Master Job ว่ามีอยู่แล้วหรือยัง
                        let scriptCheck = `
                            SELECT ptrl_merge_job_code 
                            FROM tbl_petrol_merge_job 
                            WHERE petrol_merge_job_flag = '1' 
                            AND ptrl_code = '${ptrl_code}' 
                            AND ptrl_merge_code = '${current_merge_code}';
                        `;
                        let tbl_check = await pgConn.get(dbPrefix + lic_code, scriptCheck, config.connectionString());

                        if (tbl_check && tbl_check.data && tbl_check.data.length > 0) {
                            // มีอยู่แล้ว → ดึง ptrl_merge_job_code เดิมมาใช้
                            ptrl_merge_job_code = tbl_check.data[0].ptrl_merge_job_code;

                            if (tbl_check.data.length > 1) {
                                let mcode = tbl_check.data.slice(1).map(item => `'${item.ptrl_merge_job_code}'`).join(',');
                                let scriptUpdate = `
                                    UPDATE tbl_petrol_merge_job 
                                    SET petrol_merge_job_flag = '0' 
                                    WHERE ptrl_merge_job_code IN (${mcode});
                                `;
                                let tbl_update = await pgConn.execute(dbPrefix + lic_code, scriptUpdate, config.connectionString());
                                if (tbl_update.code) {
                                    isError = true;
                                    break;
                                }
                            }

                        } else {
                            // สร้าง Master Job ใหม่
                            ptrl_merge_job_code = 'pmgr-' + moment().format('x') + Math.floor(Math.random() * 10000);
                            let scriptInsertJob = `
                                INSERT INTO tbl_petrol_merge_job 
                                (ptrl_merge_job_code, ptrl_code, ptrl_merge_code, petrol_merge_job_flag, ist_dt) 
                                VALUES 
                                ('${ptrl_merge_job_code}', '${ptrl_code}', '${current_merge_code}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}');
                            `;
                            let tbl_insertJob = await pgConn.execute(dbPrefix + lic_code, scriptInsertJob, config.connectionString());
                            if (tbl_insertJob.code) {
                                isError = true;
                                break;
                            }
                        }

                        // Step 2: วนลูป data เพื่อ Insert เข้า tbl_petrol_merge_job_info (เพิ่มใหม่ ไม่ลบของเก่า)
                        for (let j = 0; j < mergeData.length; j++) {
                            let currentData = mergeData[j];
                            let current_dpo_code = currentData.dpo_code;
                            if (!current_dpo_code) continue; // ข้าม data ที่ไม่มี dpo_code
                            let itmCodeArr = (currentData.itm_code || []).filter(item => item != null && item !== ''); //กรองค่าว่าง

                            if (itmCodeArr.length > 0) {
                                let valuesArr = [];
                                for (let k = 0; k < itmCodeArr.length; k++) {
                                    let current_itm_code = itmCodeArr[k];
                                    valuesArr.push(`('${ptrl_merge_job_code}', '${current_itm_code}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}', '${current_dpo_code}')`);
                                }

                                let scriptInsertInfo = `
                                    INSERT INTO tbl_petrol_merge_job_info 
                                    (ptrl_merge_job_code, itm_code, flag, ist_dt, dpo_code) 
                                    VALUES ${valuesArr.join(', ')}
                                    ON CONFLICT (ptrl_merge_job_code, itm_code, dpo_code) 
                                    DO UPDATE SET flag = '1', ist_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}', rm_dt = NULL;
                                `;

                                let tbl_insertInfo = await pgConn.execute(dbPrefix + lic_code, scriptInsertInfo, config.connectionString());

                                if (!tbl_insertInfo.code) {
                                    for (let k = 0; k < itmCodeArr.length; k++) {
                                        insertedData.push({ ptrl_merge_job_code: ptrl_merge_job_code, itm_code: itmCodeArr[k], dpo_code: current_dpo_code });
                                    }
                                } else {
                                    isError = true;
                                    break;
                                }
                            }
                        }
                        if (isError) break;
                    }
                }
            }

            // จัดการ Response เมื่อทำงานเสร็จ
            if (isError) {
                let response = [{
                    status: 'error',
                    invalid_code: '-3',
                    message: `ไม่สามารถบันทึกข้อมูลบางส่วนได้, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปั้มที่สามารถพ่วงกันได้', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูลบางส่วนได้', action[0].value);
                return;
            }

            // กรณีสำเร็จทั้งหมด
            let response = [{
                status: 'success',
                invalid_code: '0',
                message: `บันทึกข้อมูลสำเร็จ`,
                data: insertedData,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปั้มที่สามารถพ่วงกันได้', JSON.stringify(req.body[0]), 'success', action[0].value);
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
        const _lic = req.header('lic_code');
        const _act = req.body?.[0]?.action?.[0] || {};
        if (_lic && _act.id) {
            await xglobal.action_logs(_lic, _act.id, 'เพิ่มข้อมูลปั้มที่สามารถพ่วงกันได้', JSON.stringify(req.body?.[0] || {}), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', _act.value);
        }
        return;
    });

}


// exports.addPetrolMergeJobInformation = async (req, res, next) => {

//     return (async () => {
//         debugger
//         let lic_code = req.header('lic_code');
//         let {
//             ptrl_code,
//             ptrl_merge_code,
//             itm_code,
//             dpo_code,
//             action
//         } = req.body[0];

//         //เช็คเฉพาะส่วนที่สำคัญ
//         if (ptrl_code == undefined || ptrl_merge_code == undefined || action == undefined || lic_code == undefined) {
//             let response = [{
//                 status: 'error',
//                 invalid_code: '-1',
//                 message: 'ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
//                 data: [],
//                 response_time: moment().format('YYYY-MM-DD HH:mm:ss')
//             }]

//             res.status(200).send(response);
//             return;
//         } else {

//             let insertedData = [];
//             let isError = false;
//             let duplicateCount = 0;

//             if (Array.isArray(ptrl_merge_code) && ptrl_merge_code.length > 0) {
//                 // รองรับโครงสร้างใหม่ (มี data array ข้างใน)
//                 if (typeof ptrl_merge_code[0] === 'object' && ptrl_merge_code[0].ptrl_code) {
//                     for (let i = 0; i < ptrl_merge_code.length; i++) {
//                         let mergeObj = ptrl_merge_code[i];
//                         let current_merge_code = mergeObj.ptrl_code;
//                         let mergeData = mergeObj.data || [];

//                         let ptrl_merge_job_code = '';

//                         // Step 1: เช็คว่า ptrl_code + ptrl_merge_code มีอยู่ใน tbl_petrol_merge_job หรือยัง
//                         let scriptCheck = `select 
//                         ptrl_merge_job_code 
//                         from tbl_petrol_merge_job 
//                         where petrol_merge_job_flag = '1' 
//                         and ptrl_code = '${ptrl_code}' 
//                         and ptrl_merge_code = '${current_merge_code}';`
//                         let tbl_check = await pgConn.get(dbPrefix + lic_code, scriptCheck, config.connectionString());

//                         if (tbl_check.data.length > 0) {
//                             // มีอยู่แล้ว → ดึง ptrl_merge_job_code เดิมมาใช้
//                             ptrl_merge_job_code = tbl_check.data[0].ptrl_merge_job_code;
//                         } else {
//                             // ยังไม่มี → Insert ใหม่เข้า tbl_petrol_merge_job
//                             ptrl_merge_job_code = 'pmgr-' + moment().format('x') + Math.floor(Math.random() * 10000);

//                             let scriptInsertJob = `insert into tbl_petrol_merge_job 
//                             (ptrl_merge_job_code, ptrl_code, ptrl_merge_code, petrol_merge_job_flag, ist_dt) values 
//                             ('${ptrl_merge_job_code}', '${ptrl_code}', '${current_merge_code}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}');`
//                             let tbl_insertJob = await pgConn.execute(dbPrefix + lic_code, scriptInsertJob, config.connectionString());
//                             if (tbl_insertJob.code) {
//                                 isError = true;
//                                 break;
//                             }
//                         }

//                         // Step 2: วนลูป data เพื่อ insert เข้า tbl_petrol_merge_job_info
//                         for (let j = 0; j < mergeData.length; j++) {
//                             let currentData = mergeData[j];
//                             let current_dpo_code = currentData.dpo_code;
//                             let itmCodeArr = currentData.itm_code || [];

//                             // สร้าง values สำหรับ INSERT หลายแถวพร้อมกัน
//                             let valuesArr = [];
//                             for (let k = 0; k < itmCodeArr.length; k++) {
//                                 let current_itm_code = itmCodeArr[k];
//                                 valuesArr.push(`('${ptrl_merge_job_code}', '${current_itm_code}', '1', '${moment().format('YYYY-MM-DD HH:mm:ss')}', '${current_dpo_code}')`);
//                             }

//                             if (valuesArr.length > 0) {
//                                 // ใช้ ON CONFLICT DO NOTHING เพื่อ skip ข้อมูลซ้ำ
//                                 let scriptInsertInfo = `insert into tbl_petrol_merge_job_info 
//                                 (ptrl_merge_job_code, itm_code, flag, ist_dt, dpo_code) values 
//                                 ${valuesArr.join(', ')}
//                                 ON CONFLICT (ptrl_merge_job_code, itm_code, dpo_code) DO NOTHING;`

//                                 let tbl_insertInfo = await pgConn.execute(dbPrefix + lic_code, scriptInsertInfo, config.connectionString());

//                                 if (!tbl_insertInfo.code) {
//                                     // เก็บข้อมูลที่ insert สำเร็จ
//                                     for (let k = 0; k < itmCodeArr.length; k++) {
//                                         insertedData.push({ ptrl_merge_job_code: ptrl_merge_job_code, itm_code: itmCodeArr[k], dpo_code: current_dpo_code });
//                                     }
//                                 } else {
//                                     isError = true;
//                                     break;
//                                 }
//                             }
//                         }
//                         if (isError) break;
//                     }
//                 }
//             }


//             // จัดการ Response เมื่อลูปทำงานเสร็จ
//             if (isError) {
//                 let response = [{
//                     status: 'error',
//                     invalid_code: '-3',
//                     message: `ไม่สามารถบันทึกข้อมูลบางส่วนได้, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
//                     data: [],
//                     response_time: moment().format('YYYY-MM-DD HH:mm:ss')
//                 }]
//                 res.status(200).send(response);
//                 await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปั้มที่สามารถพ่วงกันได้', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
//                 return;
//             }

//             // เช็คว่าถ้าไม่มีการ Insert เลย และมีค่าซ้ำทั้งหมด
//             if (insertedData.length === 0 && duplicateCount > 0) {
//                 let response = [{
//                     status: 'error',
//                     invalid_code: '-4',
//                     message: `ไม่สามารถบันทึกข้อมูลได้ เนื่องจากข้อมูลที่ส่งมามีอยู่ในระบบแล้วทั้งหมด`,
//                     data: [],
//                     response_time: moment().format('YYYY-MM-DD HH:mm:ss')
//                 }]

//                 res.status(200).send(response);
//                 await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปั้มที่สามารถพ่วงกันได้', JSON.stringify(req.body[0]), 'ข้อมูลซ้ำทั้งหมด', action[0].value);
//                 return;
//             }

//             let successMessage = duplicateCount > 0
//                 ? `บันทึกสำเร็จ (ข้ามรายการที่มีอยู่แล้ว ${duplicateCount} รายการ)`
//                 : `บันทึกสำเร็จ`;


//             let response = [{
//                 status: 'success',
//                 invalid_code: '0',
//                 message: successMessage,
//                 data: insertedData,
//                 response_time: moment().format('YYYY-MM-DD HH:mm:ss')
//             }]

//             res.status(200).send(response);
//             await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปั้มที่สามารถพ่วงกันได้', JSON.stringify(req.body[0]), 'success', action[0].value);
//             return;
//         }

//     })().catch(async (err) => {
//         console.log(err);
//         let response = [{
//             status: 'error',
//             invalid_code: '-4',
//             message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
//             data: [],
//             response_time: moment().format('YYYY-MM-DD HH:mm:ss').toString()
//         }]
//         res.status(200).send(response);
//         await xglobal.action_logs(lic_code, action[0].id, 'เพิ่มข้อมูลปั้มที่สามารถพ่วงกันได้', JSON.stringify(req.body[0]), 'ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
//         return;
//     });

// }

//Success
exports.removePetrolMergeJobDetails = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { ptrl_merge_job_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_merge_job_code == undefined || lic_code == undefined || action == undefined) {
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
            // ดัก ptrl_merge_job_code เป็น array
            let ptrl_merge_job_codeArr = Array.isArray(ptrl_merge_job_code) ? ptrl_merge_job_code : [ptrl_merge_job_code];
            let ptrl_merge_job_codeIn = ptrl_merge_job_codeArr.map(c => `'${c}'`).join(', ');
            script = `update tbl_petrol_merge_job_info set flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where ptrl_merge_job_code in (${ptrl_merge_job_codeIn});`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: 'ลบข้อมูลปั้มที่พ่วงงานกันได้สำเร็จ',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลปั้มที่พ่วงงานกันได้', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลปั้มที่พ่วงงานกันได้', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลปั้มที่พ่วงงานกันได้', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.removePetrolMergeJobDetailsById = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { petrol_merge_job_id, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (petrol_merge_job_id == undefined || lic_code == undefined || action == undefined) {
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
            // ดัก petrol_merge_job_id เป็น array
            let petrol_merge_job_idArr = Array.isArray(petrol_merge_job_id) ? petrol_merge_job_id : [petrol_merge_job_id];
            let petrol_merge_job_idIn = petrol_merge_job_idArr.map(c => `'${c}'`).join(', ');
            script = `update tbl_petrol_merge_job_info set flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
            where id in (${petrol_merge_job_idIn});`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: 'ลบข้อมูลปั้มที่พ่วงงานกันได้สำเร็จ',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลปั้มที่พ่วงงานกันได้', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลปั้มที่พ่วงงานกันได้', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลปั้มที่พ่วงงานกันได้', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
        return;
    });

}

//Success
exports.removePetrolMergeJobDetailsByDpo = async (req, res, next) => {

    return (async () => {
        let lic_code = req.header('lic_code');
        let { ptrl_merge_job_code, dpo_code, action } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (ptrl_merge_job_code == undefined || dpo_code == undefined || lic_code == undefined || action == undefined) {
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
            let dpoCodes = Array.isArray(dpo_code) ? dpo_code : [dpo_code];
            let dpoCodesIn = dpoCodes.map(c => `'${c}'`).join(', ');
            let script = `UPDATE tbl_petrol_merge_job_info 
                SET flag = '0', rm_dt = '${moment().format('YYYY-MM-DD HH:mm:ss')}' 
                WHERE ptrl_merge_job_code = '${ptrl_merge_job_code}' AND dpo_code IN (${dpoCodesIn});`

            let tbl_temporary = await pgConn.execute(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                let response = [{
                    status: 'success',
                    invalid_code: '0',
                    message: 'ลบข้อมูลปั้มที่พ่วงงานกันได้สำเร็จ',
                    data: [],
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]

                res.status(200).send(response);
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลปั้มที่พ่วงงานกันได้', JSON.stringify(req.body[0]), 'success', action[0].value);
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
                await xglobal.action_logs(lic_code, action[0].id, 'ลบข้อมูลปั้มที่พ่วงงานกันได้', JSON.stringify(req.body[0]), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', action[0].value);
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
        const _lic = req.header('lic_code');
        const _act = req.body?.[0]?.action?.[0] || {};
        if (_lic && _act.id) {
            await xglobal.action_logs(_lic, _act.id, 'ลบข้อมูลปั้มที่พ่วงงานกันได้', JSON.stringify(req.body?.[0] || {}), 'ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', _act.value);
        }
        return;
    });

}
