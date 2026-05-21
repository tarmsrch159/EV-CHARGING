const config = require("../../configuration/connection");
const pgConn = require("../../library/pgConnection");
const moment = require("moment");
const xglobal = require("../../middleware/global");

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
//Success
exports.getPetrolGroupInformation = async (req, res, next) => {
    var xresult = [];

    return (async () => {
        let lic_code = req.header("lic_code");
        let { ptrl_group_code, off_code, action, ptrl_group_sales_org, ptrl_group_order_type, prov_code } = req.body[0] || {};

        // เช็คเฉพาะส่วนที่สำคัญ
        if (
            ptrl_group_code === undefined ||
            lic_code === undefined ||
            off_code === undefined ||
            action === undefined
        ) {
            let response = [
                {
                    status: "error",
                    invalid_code: "-1",
                    message:
                        "ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
                    data: xresult,
                    response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                },
            ];

            res.status(200).send(response);
            return;
        }

        // =========================================================================
        // สร้าง Dynamic WHERE Clause
        // =========================================================================
        let conditions = ["tbl_petrol_group.ptrl_group_flag = '1'"];

        if (ptrl_group_code.toString().toUpperCase() !== "ALL") {
            conditions.push(
                `tbl_petrol_group.ptrl_group_code = '${ptrl_group_code}'`,
            );
        }

        // if (off_code.toString().toUpperCase() !== "ALL") {
        //     conditions.push(`tbl_petrol_group.off_code = '${off_code}'`);
        // }

        // กรองเพิ่มเติมตาม array ptrl_group_sales_org
        if (ptrl_group_sales_org && Array.isArray(ptrl_group_sales_org) && ptrl_group_sales_org.length > 0) {
            const salesOrg = ptrl_group_sales_org.map(val => `'${String(val).replace(/'/g, "''")}'`).join(", ");
            conditions.push(`tbl_petrol_group.ptrl_group_sales_org IN (${salesOrg})`);
        }

        // กรองเพิ่มเติมตาม array ptrl_group_order_type (รองรับทั้ง ord_type_code และ sales_order_type)
        if (ptrl_group_order_type && Array.isArray(ptrl_group_order_type) && ptrl_group_order_type.length > 0) {
            const orderTypes = ptrl_group_order_type.map(val => `'${String(val).replace(/'/g, "''")}'`).join(", ");
            conditions.push(`(
                tbl_petrol_group.ptrl_group_order_type IN (${orderTypes})
                OR tbl_petrol_group.ptrl_group_order_type IN (SELECT ord_type_code FROM tbl_order_type WHERE sales_order_type IN (${orderTypes}))
            )`);
        }

        // กรองตาม prov_code ถ้ามีการส่งมา (ถ้าจังหวัดไม่ได้ผูกกับโซนเลย ให้ return ทุกโซน)
        if (prov_code && prov_code.toString().toUpperCase() !== "ALL") {
            conditions.push(`(
                EXISTS (
                    SELECT 1 FROM tbl_petrol_group_address pga 
                    WHERE pga.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                    AND pga.prov_code = '${prov_code}'
                    AND pga.flag = '1'
                )
                OR NOT EXISTS (
                    SELECT 1 FROM tbl_petrol_group_address pga 
                    WHERE pga.prov_code = '${prov_code}'
                    AND pga.flag = '1'
                )
            )`);
        }


        // =========================================================================
        // กรองข้อมูลตามสิทธิ์การเข้าถึง (Role Authorization)
        // =========================================================================
        let act_val = action[0]?.value?.toString().toUpperCase() || "ALL";
        let act_id = action[0]?.id || "";

        if (act_val === "GROUP") {
            // กรองตาม Petrol Group 
            conditions.push(`(
                NOT EXISTS (SELECT 1 FROM tbl_employee_petrol_group WHERE emp_code = '${act_id}' AND emp_pgrp_flag = 1)
                OR tbl_petrol_group.ptrl_group_code IN (SELECT ptrl_group_code FROM tbl_employee_petrol_group WHERE emp_code = '${act_id}' AND emp_pgrp_flag = 1)
            )`);

            // กรองตาม Order Type (ZOR1, ZOR2)
            conditions.push(`(
                NOT EXISTS (SELECT 1 FROM tbl_employee_order_type WHERE emp_code = '${act_id}' AND emp_otyp_flag = 1)
                OR tbl_petrol_group.ptrl_group_order_type IN (
                    SELECT t2.ord_type_code 
                    FROM tbl_employee_order_type t1 
                    JOIN tbl_order_type t2 ON t1.ord_type_code = t2.ord_type_code 
                    WHERE t1.emp_code = '${act_id}' AND t1.emp_otyp_flag = 1
                )
            )`);

            // กรองตาม Sales Org (1000, 1900)
            conditions.push(`(
                NOT EXISTS (SELECT 1 FROM tbl_employee_sales_org WHERE emp_code = '${act_id}' AND emp_sorg_flag = 1)
                OR tbl_petrol_group.ptrl_group_sales_org IN (SELECT sales_org_code FROM tbl_employee_sales_org WHERE emp_code = '${act_id}' AND emp_sorg_flag = 1)
            )`);
        }

        let whereClause = "WHERE " + conditions.join(" AND ");

        // =========================================================================
        // SQL Query หลัก
        // =========================================================================
        let script = `
            SELECT ptrl_group_code, ptrl_group_desc, ptrl_group_short_desc, ptrl_group_flag, 
            tbl_petrol_group.ist_dt, tbl_petrol_group.mdf_dt, tbl_petrol_group.rm_dt, 
            tbl_petrol_group.off_code, tbl_office.off_desc,
            tbl_order_type.sales_order_type, tbl_petrol_group.ptrl_group_sales_org,
            tbl_petrol_group.ptrl_group_order_type,
            (SELECT COUNT(*) FROM tbl_petrol WHERE tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code AND tbl_petrol.ptrl_flag = '1') as ptrl_count
            FROM tbl_petrol_group 
            LEFT JOIN tbl_office ON tbl_petrol_group.off_code = tbl_office.off_code
            LEFT JOIN tbl_order_type ON tbl_petrol_group.ptrl_group_order_type = tbl_order_type.ord_type_code
            ${whereClause}
            ORDER BY tbl_petrol_group.ist_dt DESC;
        `;


        let tbl_temporary = await pgConn.get(
            dbPrefix + lic_code,
            script,
            config.connectionString(),
        );

        if (!tbl_temporary.code) {
            if (tbl_temporary.data.length > 0) {
                tbl_temporary.data = JSON.parse(
                    JSON.stringify(tbl_temporary.data).replace(/\:null/gi, '\:""'),
                );


                // ดึงข้อมูลที่อยู่และประเภทรถของแต่ละกลุ่มปั้ม
                for (let i = 0; i < tbl_temporary.data.length; i++) {
                    let groupCode = tbl_temporary.data[i].ptrl_group_code;

                    // ดึงที่อยู่ พร้อมชื่อ จังหวัด อำเภอ ตำบล
                    let addrScript = `select 
                        tbl_petrol_group_address.ptrl_group_addr_code,
                        tbl_petrol_group_address.prov_code, tbl_province.prov_desc,
                        tbl_petrol_group_address.amph_code, tbl_amphure.amph_desc,
                        tbl_petrol_group_address.tamb_code, tbl_tambon.tamb_desc
                        from tbl_petrol_group_address
                        left join tbl_province on tbl_petrol_group_address.prov_code = tbl_province.prov_code
                        left join tbl_amphure on tbl_petrol_group_address.amph_code = tbl_amphure.amph_code
                        left join tbl_tambon on tbl_petrol_group_address.tamb_code = tbl_tambon.tamb_code
                        where tbl_petrol_group_address.ptrl_group_code = '${groupCode}' and tbl_petrol_group_address.flag = '1';`;
                    let addrResult = await pgConn.get(
                        dbPrefix + lic_code,
                        addrScript,
                        config.connectionString(),
                    );
                    if (!addrResult.code && addrResult.data.length > 0) {
                        tbl_temporary.data[i].address = JSON.parse(
                            JSON.stringify(addrResult.data).replace(/\:null/gi, '\:""'),
                        );
                    } else {
                        tbl_temporary.data[i].address = [];
                    }

                    // ดึงประเภทรถ พร้อมชื่อประเภทรถ
                    let vehScript = `select 
                        tbl_petrol_group_veh.ptrl_group_veh_code,
                        tbl_petrol_group_veh.veh_type_code, tbl_vehicle_type.veh_type_desc
                        from tbl_petrol_group_veh
                        left join tbl_vehicle_type on tbl_petrol_group_veh.veh_type_code = tbl_vehicle_type.veh_type_code
                        where tbl_petrol_group_veh.ptrl_group_code = '${groupCode}' and tbl_petrol_group_veh.flag = '1';`;
                    let vehResult = await pgConn.get(
                        dbPrefix + lic_code,
                        vehScript,
                        config.connectionString(),
                    );
                    if (!vehResult.code && vehResult.data.length > 0) {
                        tbl_temporary.data[i].veh_type = JSON.parse(
                            JSON.stringify(vehResult.data).replace(/\:null/gi, '\:""'),
                        );
                    } else {
                        tbl_temporary.data[i].veh_type = [];
                    }
                }

                let response = [
                    {
                        status: "success",
                        invalid_code: "0",
                        message: "",
                        data: tbl_temporary.data,
                        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                    },
                ];

                res.status(200).send(response);
                return;
            } else {
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
            let response = [
                {
                    status: "error",
                    invalid_code: "-3",
                    message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: xresult,
                    response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                },
            ];
            res.status(200).send(response);
            await xglobal.action_logs(
                lic_code,
                action[0].id,
                "ดึงข้อมูลกลุ่มปั้ม",
                JSON.stringify(req.body[0]),
                "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
                action[0].value,
            );
            return;
        }
    })().catch(async (err) => {
        console.log(err);
        let response = [
            {
                status: "error",
                invalid_code: "-4",
                message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                data: xresult,
                response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
            },
        ];
        res.status(200).send(response);

        let act_id = req.body[0]?.action?.[0]?.id || "";
        let act_val = req.body[0]?.action?.[0]?.value || "";
        if (act_id) {
            await xglobal.action_logs(
                lic_code,
                act_id,
                "ดึงข้อมูลกลุ่มปั้ม",
                JSON.stringify(req.body[0]),
                "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
                act_val,
            );
        }
        return;
    });
};

exports.getPetrolGroupInformationFilter = async (req, res, next) => {
    var xresult = [];

    return (async () => {
        let lic_code = req.header("lic_code");
        let { ptrl_group_code, action, ptrl_group_sales_org, ptrl_group_order_type, prov_code } = req.body[0] || {};

        // เช็คเฉพาะส่วนที่สำคัญ
        if (
            ptrl_group_code === undefined ||
            lic_code === undefined ||
            action === undefined
        ) {
            let response = [
                {
                    status: "error",
                    invalid_code: "-1",
                    message:
                        "ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
                    data: xresult,
                    response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                },
            ];

            res.status(200).send(response);
            return;
        }

        // =========================================================================
        // สร้าง Dynamic WHERE Clause
        // =========================================================================
        let conditions = ["tbl_petrol_group.ptrl_group_flag = '1'"];

        if (ptrl_group_code.toString().toUpperCase() !== "ALL") {
            conditions.push(
                `tbl_petrol_group.ptrl_group_code = '${ptrl_group_code}'`,
            );
        }

        // กรองเพิ่มเติมตาม array ptrl_group_sales_org
        if (ptrl_group_sales_org && Array.isArray(ptrl_group_sales_org) && ptrl_group_sales_org.length > 0) {
            const salesOrg = ptrl_group_sales_org.map(val => `'${String(val).replace(/'/g, "''")}'`).join(", ");
            conditions.push(`tbl_petrol_group.ptrl_group_sales_org IN (${salesOrg})`);
        }

        // กรองเพิ่มเติมตาม array ptrl_group_order_type (รองรับทั้ง ord_type_code และ sales_order_type)
        if (ptrl_group_order_type && Array.isArray(ptrl_group_order_type) && ptrl_group_order_type.length > 0) {
            const orderTypes = ptrl_group_order_type.map(val => `'${String(val).replace(/'/g, "''")}'`).join(", ");
            conditions.push(`(
                tbl_petrol_group.ptrl_group_order_type IN (${orderTypes})
                OR tbl_petrol_group.ptrl_group_order_type IN (SELECT ord_type_code FROM tbl_order_type WHERE sales_order_type IN (${orderTypes}))
            )`);
        }

        // กรองตาม prov_code ถ้ามีการส่งมา (ถ้าจังหวัดไม่ได้ผูกกับโซนเลย ให้ return ทุกโซน)
        if (prov_code && prov_code.toString().toUpperCase() !== "ALL") {
            conditions.push(`(
                EXISTS (
                    SELECT 1 FROM tbl_petrol_group_address pga 
                    WHERE pga.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                    AND pga.prov_code = '${prov_code}'
                    AND pga.flag = '1'
                )
                OR NOT EXISTS (
                    SELECT 1 FROM tbl_petrol_group_address pga 
                    WHERE pga.prov_code = '${prov_code}'
                    AND pga.flag = '1'
                )
            )`);
        }

        // =========================================================================
        // กรองข้อมูลตามสิทธิ์การเข้าถึง (Role Authorization)
        // =========================================================================
        let act_val = action[0]?.value?.toString().toUpperCase() || "ALL";
        let act_id = action[0]?.id || "";

        if (act_val === "GROUP") {
            // กรองตาม Petrol Group 
            conditions.push(`(
                NOT EXISTS (SELECT 1 FROM tbl_employee_petrol_group WHERE emp_code = '${act_id}' AND emp_pgrp_flag = 1)
                OR tbl_petrol_group.ptrl_group_code IN (SELECT ptrl_group_code FROM tbl_employee_petrol_group WHERE emp_code = '${act_id}' AND emp_pgrp_flag = 1)
            )`);

            // กรองตาม Order Type (ZOR1, ZOR2)
            conditions.push(`(
                NOT EXISTS (SELECT 1 FROM tbl_employee_order_type WHERE emp_code = '${act_id}' AND emp_otyp_flag = 1)
                OR tbl_petrol_group.ptrl_group_order_type IN (
                    SELECT t2.ord_type_code 
                    FROM tbl_employee_order_type t1 
                    JOIN tbl_order_type t2 ON t1.ord_type_code = t2.ord_type_code 
                    WHERE t1.emp_code = '${act_id}' AND t1.emp_otyp_flag = 1
                )
            )`);

            // กรองตาม Sales Org (1000, 1900)
            conditions.push(`(
                NOT EXISTS (SELECT 1 FROM tbl_employee_sales_org WHERE emp_code = '${act_id}' AND emp_sorg_flag = 1)
                OR tbl_petrol_group.ptrl_group_sales_org IN (SELECT sales_org_code FROM tbl_employee_sales_org WHERE emp_code = '${act_id}' AND emp_sorg_flag = 1)
            )`);
        }

        let whereClause = "WHERE " + conditions.join(" AND ");

        // =========================================================================
        // SQL Query หลัก
        // =========================================================================
        let script = `
            SELECT 
                tbl_petrol_group.ptrl_group_code, 
                tbl_petrol_group.ptrl_group_desc, 
                tbl_petrol_group.ptrl_group_short_desc,
                tbl_petrol_group.ptrl_group_sales_org,
                tbl_petrol_group.ptrl_group_order_type,
                tbl_petrol_group.ptrl_group_order_type,
                ot.sales_order_type
            FROM tbl_petrol_group 
            LEFT JOIN tbl_order_type ot ON tbl_petrol_group.ptrl_group_order_type = ot.ord_type_code
            ${whereClause}
            ORDER BY tbl_petrol_group.ist_dt DESC;
        `;

        console.log("DEBUG SCRIPT:", script);

        let tbl_temporary = await pgConn.get(
            dbPrefix + lic_code,
            script,
            config.connectionString(),
        );

        if (!tbl_temporary.code) {
            if (tbl_temporary.data.length > 0) {
                tbl_temporary.data = JSON.parse(
                    JSON.stringify(tbl_temporary.data).replace(/\:null/gi, '\:""'),
                );

                let response = [
                    {
                        status: "success",
                        invalid_code: "0",
                        message: "",
                        data: tbl_temporary.data,
                        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                    },
                ];

                res.status(200).send(response);
                return;
            } else {
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
            let response = [
                {
                    status: "error",
                    invalid_code: "-3",
                    message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: xresult,
                    response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                },
            ];
            res.status(200).send(response);
            await xglobal.action_logs(
                lic_code,
                action[0].id,
                "ดึงข้อมูลกลุ่มปั้ม",
                JSON.stringify(req.body[0]),
                "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
                action[0].value,
            );
            return;
        }
    })().catch(async (err) => {
        console.log(err);
        let response = [
            {
                status: "error",
                invalid_code: "-4",
                message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                data: xresult,
                response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
            },
        ];
        res.status(200).send(response);

        let act_id = req.body[0]?.action?.[0]?.id || "";
        let act_val = req.body[0]?.action?.[0]?.value || "";
        if (act_id) {
            await xglobal.action_logs(
                lic_code,
                act_id,
                "ดึงข้อมูลกลุ่มปั้ม",
                JSON.stringify(req.body[0]),
                "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
                act_val,
            );
        }
        return;
    });
};

//Success
exports.removePetrolGroup = async (req, res, next) => {
    return (async () => {
        let lic_code = req.header("lic_code");
        let { ptrl_group_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (
            ptrl_group_code == undefined ||
            lic_code == undefined ||
            action == undefined
        ) {
            let response = [
                {
                    status: "error",
                    invalid_code: "-1",
                    message: "ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
                    data: [],
                    response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                },
            ];

            res.status(200).send(response);
            return;
        } else {
            let script = ``;
            script = `update tbl_petrol_group set ptrl_group_flag = '0', rm_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}' where ptrl_group_code = '${ptrl_group_code}';`;

            let tbl_temporary = await pgConn.execute(
                dbPrefix + lic_code,
                script,
                config.connectionString(),
            );
            if (!tbl_temporary.code) {
                //debugger
                let response = [
                    {
                        status: "success",
                        invalid_code: "0",
                        message: "",
                        data: [],
                        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                    },
                ];

                res.status(200).send(response);
                await xglobal.action_logs(
                    lic_code,
                    action[0].id,
                    "ลบข้อมูลกลุ่มปั้ม",
                    JSON.stringify(req.body[0]),
                    "success",
                    action[0].value,
                );
                return;
            } else {
                let response = [
                    {
                        status: "error",
                        invalid_code: "-3",
                        message: `ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                        data: [],
                        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                    },
                ];
                res.status(200).send(response);
                await xglobal.action_logs(
                    lic_code,
                    action[0].id,
                    "ลบข้อมูลกลุ่มปั้ม",
                    JSON.stringify(req.body[0]),
                    "ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
                    action[0].value,
                );
                return;
            }
        }
    })().catch(async (err) => {
        console.log(err);
        let response = [
            {
                status: "error",
                invalid_code: "-4",
                message: `ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                data: [],
                response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
            },
        ];
        res.status(200).send(response);
        await xglobal.action_logs(
            lic_code,
            action[0].id,
            "ลบข้อมูลกลุ่มปั้ม",
            JSON.stringify(req.body[0]),
            "ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
            action[0].value,
        );
        return;
    });
};

//Success
exports.setPetrolGroupInformation = async (req, res, next) => {
    return (async () => {
        //debugger
        let lic_code = req.header("lic_code");
        let { ptrl_group_code } = req.query;
        let {
            ptrl_group_desc,
            ptrl_group_short_desc,
            off_code,
            address,
            veh_type,
            ptrl_group_sales_org,
            ptrl_group_order_type,
            action,
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (
            ptrl_group_code == undefined ||
            ptrl_group_desc == undefined ||
            off_code == undefined ||
            action == undefined
        ) {
            let response = [
                {
                    status: "error",
                    invalid_code: "-1",
                    message:
                        "ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
                    data: [],
                    response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                },
            ];

            res.status(200).send(response);
            return;
        } else {
            // Validation: Ensure address structure is complete
            if (address != undefined && Array.isArray(address) && address.length > 0) {
                for (const prov of address) {
                    const districts = prov.districts || prov.district;
                    if (!prov.prov_code || !districts || !Array.isArray(districts) || districts.length === 0) {
                        let response = [
                            {
                                status: "error",
                                invalid_code: "-1",
                                message: "กรุณากรอกข้อมูล จังหวัด อำเภอ และ ตำบล ให้ครบถ้วน",
                                data: [],
                                response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                            },
                        ];
                        res.status(200).send(response);
                        return;
                    }

                    for (const dist of districts) {
                        const subdistricts = dist.subdistricts || dist.subdistrict || dist.tamb_code;
                        if (!dist.amph_code || !subdistricts || (Array.isArray(subdistricts) && subdistricts.length === 0)) {
                            let response = [
                                {
                                    status: "error",
                                    invalid_code: "-1",
                                    message: "กรุณากรอกข้อมูล จังหวัด อำเภอ และ ตำบล ให้ครบถ้วน",
                                    data: [],
                                    response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                                },
                            ];
                            res.status(200).send(response);
                            return;
                        }
                    }
                }
            } else {
                let response = [
                    {
                        status: "error",
                        invalid_code: "-1",
                        message: "กรุณากรอกข้อมูล จังหวัด อำเภอ และ ตำบล ให้ครบถ้วน",
                        data: [],
                        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                    },
                ];
                res.status(200).send(response);
                return;
            }

            let script = ``;
            script = `update tbl_petrol_group set
            ptrl_group_desc = '${ptrl_group_desc}', 
            ptrl_group_short_desc = '${ptrl_group_short_desc}',
            off_code = '${off_code}', 
            ptrl_group_sales_org = '${ptrl_group_sales_org}',
            ptrl_group_order_type = '${ptrl_group_order_type}',
            mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}' 
            where ptrl_group_code = '${ptrl_group_code}';`;

            let tbl_temporary = await pgConn.execute(
                dbPrefix + lic_code,
                script,
                config.connectionString(),
            );
            if (!tbl_temporary.code) {
                // --- อัพเดทที่อยู่ ปั้ม ---
                if (address != undefined && Array.isArray(address)) {
                    // ลบแล้ว insert ไปใหม่
                    let scriptDeaddr = `delete from tbl_petrol_group_address where ptrl_group_code = '${ptrl_group_code}';`;
                    await pgConn.execute(
                        dbPrefix + lic_code,
                        scriptDeaddr,
                        config.connectionString(),
                    );

                    for (const prov of address) {
                        const prov_code = prov.prov_code;
                        const districts = prov.districts || prov.district;

                        if (districts != undefined) {
                            const distArr = Array.isArray(districts)
                                ? districts
                                : [districts];
                            for (const dist of distArr) {
                                const amph_code = dist.amph_code;
                                const subdistricts =
                                    dist.subdistricts || dist.subdistrict || dist.tamb_code;

                                if (subdistricts != undefined) {
                                    const tambArr = Array.isArray(subdistricts)
                                        ? subdistricts
                                        : [subdistricts];
                                    for (const tamb_code of tambArr) {
                                        if (prov_code && amph_code && tamb_code) {
                                            const ptrl_group_addr_code =
                                                "pgac-" +
                                                moment().format("x") +
                                                "-" +
                                                Math.floor(Math.random() * 1000);
                                            const addrScript = `insert into tbl_petrol_group_address 
                                          (ptrl_group_addr_code, ptrl_group_code, prov_code, amph_code, tamb_code, ist_dt, off_code, flag) values 
                                          ('${ptrl_group_addr_code}', '${ptrl_group_code}', '${prov_code}', '${amph_code}', '${tamb_code}', '${moment().format("YYYY-MM-DD HH:mm:ss")}', '${off_code}', '1');`;
                                            await pgConn.execute(
                                                dbPrefix + lic_code,
                                                addrScript,
                                                config.connectionString(),
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // --- อัพเดทประเภทรถ ---
                if (veh_type != undefined && Array.isArray(veh_type)) {
                    // ลบแล้ว insert ไปใหม่
                    let scriptDeveh = `delete from tbl_petrol_group_veh where ptrl_group_code = '${ptrl_group_code}';`;
                    await pgConn.execute(
                        dbPrefix + lic_code,
                        scriptDeveh,
                        config.connectionString(),
                    );

                    for (const vCode of veh_type) {
                        const ptrl_group_veh_code =
                            "pgvc-" +
                            moment().format("x") +
                            "-" +
                            Math.floor(Math.random() * 1000);
                        const vehScript = `insert into tbl_petrol_group_veh 
                        (ptrl_group_veh_code, ptrl_group_code, veh_type_code, flag, ist_dt, off_code) values 
                        ('${ptrl_group_veh_code}', '${ptrl_group_code}', '${vCode}', '1', '${moment().format("YYYY-MM-DD HH:mm:ss")}', '${off_code}');`;
                        await pgConn.execute(
                            dbPrefix + lic_code,
                            vehScript,
                            config.connectionString(),
                        );
                    }
                }

                //debugger
                let response = [
                    {
                        status: "success",
                        invalid_code: "0",
                        message: "",
                        data: [],
                        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                    },
                ];

                res.status(200).send(response);
                await xglobal.action_logs(
                    lic_code,
                    action[0].id,
                    "แก้ไขข้อมูลกลุ่มปั้ม",
                    JSON.stringify(req.body[0]),
                    "success",
                    action[0].value,
                );
                return;
            } else {
                let response = [
                    {
                        status: "error",
                        invalid_code: "-3",
                        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                        data: [],
                        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                    },
                ];
                res.status(200).send(response);
                await xglobal.action_logs(
                    lic_code,
                    action[0].id,
                    "แก้ไขข้อมูลกลุ่มปั้ม",
                    JSON.stringify(req.body[0]),
                    "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
                    action[0].value,
                );
                return;
            }
        }
    })().catch(async (err) => {
        console.log(err);
        let response = [
            {
                status: "error",
                invalid_code: "-4",
                message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                data: [],
                response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
            },
        ];
        res.status(200).send(response);
        await xglobal.action_logs(
            lic_code,
            action[0].id,
            "แก้ไขข้อมูลกลุ่มปั้ม",
            JSON.stringify(req.body[0]),
            "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
            action[0].value,
        );
        return;
    });
};

//Success
exports.addPetrolGroupInformation = async (req, res, next) => {
    return (async () => {
        debugger;
        let lic_code = req.header("lic_code");
        let {
            ptrl_group_desc,
            ptrl_group_short_desc,
            off_code,
            address,
            veh_type,
            ptrl_group_sales_org,
            ptrl_group_order_type,
            action,
        } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (
            ptrl_group_desc == undefined ||
            off_code == undefined ||
            action == undefined ||
            lic_code == undefined
        ) {
            let response = [
                {
                    status: "error",
                    invalid_code: "-1",
                    message:
                        "ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
                    data: [],
                    response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                },
            ];

            res.status(200).send(response);
            return;
        } else {
            // Validation: Ensure address structure is complete
            if (address != undefined && Array.isArray(address) && address.length > 0) {
                for (const prov of address) {
                    const districts = prov.districts || prov.district;
                    if (!prov.prov_code || !districts || !Array.isArray(districts) || districts.length === 0) {
                        let response = [
                            {
                                status: "error",
                                invalid_code: "-1",
                                message: "กรุณากรอกข้อมูล จังหวัด อำเภอ และ ตำบล ให้ครบถ้วน",
                                data: [],
                                response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                            },
                        ];
                        res.status(200).send(response);
                        return;
                    }

                    for (const dist of districts) {
                        const subdistricts = dist.subdistricts || dist.subdistrict || dist.tamb_code;
                        if (!dist.amph_code || !subdistricts || (Array.isArray(subdistricts) && subdistricts.length === 0)) {
                            let response = [
                                {
                                    status: "error",
                                    invalid_code: "-1",
                                    message: "กรุณากรอกข้อมูล จังหวัด อำเภอ และ ตำบล ให้ครบถ้วน",
                                    data: [],
                                    response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                                },
                            ];
                            res.status(200).send(response);
                            return;
                        }
                    }
                }
            } else {
                let response = [
                    {
                        status: "error",
                        invalid_code: "-1",
                        message: "กรุณากรอกข้อมูล จังหวัด อำเภอ และ ตำบล ให้ครบถ้วน",
                        data: [],
                        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                    },
                ];
                res.status(200).send(response);
                return;
            }

            let script = ``;
            script = `select ptrl_group_code from tbl_petrol_group 
                where (ptrl_group_desc = '${ptrl_group_desc}' 
                    or ptrl_group_short_desc = '${ptrl_group_short_desc}') 
                    and ptrl_group_flag = '1' 
                    and ptrl_group_sales_org = '${ptrl_group_sales_org}' 
                    and ptrl_group_order_type = '${ptrl_group_order_type}';
            `;
            let tbl_temporary0 = await pgConn.get(
                dbPrefix + lic_code,
                script,
                config.connectionString(),
            );
            if (!tbl_temporary0.code) {
                if (tbl_temporary0.data.length > 0) {
                    let response = [
                        {
                            status: "error",
                            invalid_code: "-4",
                            message: `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ`,
                            data: [],
                            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                        },
                    ];

                    res.status(200).send(response);
                    await xglobal.action_logs(
                        lic_code,
                        action[0].id,
                        "เพิ่มข้อมูลกลุ่มปั้ม",
                        JSON.stringify(req.body[0]),
                        "ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ",
                        action[0].value,
                    );
                    return;
                }
            }

            let ptrl_group_code = "pgrd-" + moment().format("x");
            script = `insert into tbl_petrol_group 
            (ptrl_group_code, ptrl_group_desc, ptrl_group_short_desc, ptrl_group_flag, ist_dt, off_code, ptrl_group_sales_org, ptrl_group_order_type) values 
            ('${ptrl_group_code}', '${ptrl_group_desc}', '${ptrl_group_short_desc}', '1', '${moment().format("YYYY-MM-DD HH:mm:ss")}', '${off_code}', '${ptrl_group_sales_org}', '${ptrl_group_order_type}');`;

            let tbl_temporary = await pgConn.execute(
                dbPrefix + lic_code,
                script,
                config.connectionString(),
            );
            if (!tbl_temporary.code) {
                // --- เพิ่มที่อยู่ ปั้ม ---
                if (address != undefined && Array.isArray(address)) {
                    for (const prov of address) {
                        const prov_code = prov.prov_code;
                        const districts = prov.districts || prov.district;

                        if (districts != undefined) {
                            const distArr = Array.isArray(districts)
                                ? districts
                                : [districts];
                            for (const dist of distArr) {
                                const amph_code = dist.amph_code;
                                const subdistricts =
                                    dist.subdistricts || dist.subdistrict || dist.tamb_code;

                                if (subdistricts != undefined) {
                                    const tambArr = Array.isArray(subdistricts)
                                        ? subdistricts
                                        : [subdistricts];
                                    for (const tamb_code of tambArr) {
                                        if (prov_code && amph_code && tamb_code) {
                                            const ptrl_group_addr_code =
                                                "pgac-" +
                                                moment().format("x") +
                                                "-" +
                                                Math.floor(Math.random() * 1000);
                                            const addrScript = `insert into tbl_petrol_group_address 
                                          (ptrl_group_addr_code, ptrl_group_code, prov_code, amph_code, tamb_code, ist_dt, off_code, flag) values 
                                          ('${ptrl_group_addr_code}', '${ptrl_group_code}', '${prov_code}', '${amph_code}', '${tamb_code}', '${moment().format("YYYY-MM-DD HH:mm:ss")}', '${off_code}', '1');`;
                                            await pgConn.execute(
                                                dbPrefix + lic_code,
                                                addrScript,
                                                config.connectionString(),
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // --- เพิ่มประเภทรถ ---
                let inserted_vehicles = [];
                if (veh_type != undefined && Array.isArray(veh_type)) {
                    for (const vCode of veh_type) {
                        const ptrl_group_veh_code =
                            "pgvc-" +
                            moment().format("x") +
                            "-" +
                            Math.floor(Math.random() * 1000);
                        const vehScript = `insert into tbl_petrol_group_veh 
                        (ptrl_group_veh_code, ptrl_group_code, veh_type_code, flag, ist_dt, off_code) values 
                        ('${ptrl_group_veh_code}', '${ptrl_group_code}', '${vCode}', '1', '${moment().format("YYYY-MM-DD HH:mm:ss")}', '${off_code}');`;
                        await pgConn.execute(
                            dbPrefix + lic_code,
                            vehScript,
                            config.connectionString(),
                        );
                        inserted_vehicles.push({
                            ptrl_group_veh_code,
                            veh_type_code: vCode,
                        });
                    }
                }

                //debugger
                let response = [
                    {
                        status: "success",
                        invalid_code: "0",
                        message: "",
                        data: [
                            {
                                ptrl_group_code: ptrl_group_code,
                                inserted_vehicles: inserted_vehicles,
                            },
                        ],
                        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                    },
                ];

                res.status(200).send(response);
                await xglobal.action_logs(
                    lic_code,
                    action[0].id,
                    "เพิ่มข้อมูลกลุ่มปั้ม",
                    JSON.stringify(req.body[0]),
                    "success",
                    action[0].value,
                );
                return;
            } else {
                let response = [
                    {
                        status: "error",
                        invalid_code: "-3",
                        message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                        data: [],
                        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                    },
                ];
                res.status(200).send(response);
                await xglobal.action_logs(
                    lic_code,
                    action[0].id,
                    "เพิ่มข้อมูลกลุ่มปั้ม",
                    JSON.stringify(req.body[0]),
                    "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
                    action[0].value,
                );
                return;
            }
        }
    })().catch(async (err) => {
        console.log(err);
        let response = [
            {
                status: "error",
                invalid_code: "-4",
                message: `ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                data: [],
                response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
            },
        ];
        res.status(200).send(response);
        await xglobal.action_logs(
            lic_code,
            action[0].id,
            "เพิ่มข้อมูลกลุ่มปั้ม",
            JSON.stringify(req.body[0]),
            "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
            action[0].value,
        );
        return;
    });
};
