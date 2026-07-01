const config = require("../../configuration/connection");
const pgConn = require("../../library/pgConnection");
const moment = require("moment");
const xglobal = require("../../middleware/global");

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
//Success
exports.getPetrolDepotInformation = async (req, res, next) => {
    var xresult = [];

    return (async () => {
        let lic_code = req.header("lic_code");
        let { dpo_code, ptrl_code, action, page_index, page_limit } = req.body[0];
        page_index = page_index || 1;
        page_limit = page_limit || 10;

        if (page_index > 0) {
            page_index -= 1;
        }
        //เช็คเฉพาะส่วนที่สำคัญ
        if (
            dpo_code == undefined ||
            ptrl_code == undefined ||
            lic_code == undefined ||
            action == undefined
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
        } else {
            let script = ``;
            if (dpo_code.toString().toUpperCase() != "ALL") {
                script = `select
                ptrl_depot_code,
                case when ptrl_depot_status is null then '' else ptrl_depot_status end as ptrl_depot_status,
                tbl_petrol.ptrl_code,
                ptrl_number,
                ptrl_desc,
                ptrl_short_desc,
                tbl_petrol.ptrl_group_code,
                ptrl_group_desc,
                tbl_petrol_depot.dpo_code,
                tbl_depot.dpo_number,
                tbl_depot.dpo_desc,
                tbl_depot.dpo_short_desc,
                tbl_depot_group.dpo_group_code,
                tbl_depot_group.dpo_group_desc,
                tbl_petrol.off_code,
                off_desc,
                tbl_petrol_depot.ist_dt,
                tbl_petrol_depot.mdf_dt,
                tbl_petrol_depot.rm_dt,
                tbl_depot.dpo_loading_minute 
                from tbl_petrol
                left join tbl_office on tbl_petrol.off_code = tbl_office.off_code
                left join tbl_petrol_depot on tbl_petrol.ptrl_code = tbl_petrol_depot.ptrl_code 
                left join tbl_depot on tbl_petrol_depot.dpo_code = tbl_depot.dpo_code 
                left join tbl_depot_group on tbl_depot.dpo_group_code = tbl_depot_group.dpo_group_code 
                left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                where tbl_petrol_depot.ptrl_depot_flag = '1' and ptrl_depot_code is not null 
                and tbl_petrol_depot.dpo_code = '${dpo_code}' `;
            } else {
                script = `select
                ptrl_depot_code,
                case when ptrl_depot_status is null then '' else ptrl_depot_status end as ptrl_depot_status,
                tbl_petrol.ptrl_code,
                ptrl_number,
                ptrl_desc,
                ptrl_short_desc,
                tbl_petrol.ptrl_group_code,
                ptrl_group_desc,
                tbl_petrol_depot.dpo_code,
                tbl_depot.dpo_number,
                tbl_depot.dpo_desc,
                tbl_depot.dpo_short_desc,
                tbl_depot_group.dpo_group_code,
                tbl_depot_group.dpo_group_desc,
                tbl_petrol.off_code,
                off_desc,
                tbl_petrol_depot.ist_dt,
                tbl_petrol_depot.mdf_dt,
                tbl_petrol_depot.rm_dt,
                tbl_depot.dpo_loading_minute  
                from tbl_petrol
                left join tbl_office on tbl_petrol.off_code = tbl_office.off_code
                left join tbl_petrol_depot on tbl_petrol.ptrl_code = tbl_petrol_depot.ptrl_code 
                left join tbl_depot on tbl_petrol_depot.dpo_code = tbl_depot.dpo_code 
                left join tbl_depot_group on tbl_depot.dpo_group_code = tbl_depot_group.dpo_group_code 
                left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                where tbl_petrol_depot.ptrl_depot_flag = '1' and ptrl_depot_code is not null `;
            }

            if (ptrl_code.toString().toUpperCase() != "ALL") {
                script += ` and tbl_petrol.ptrl_code = '${ptrl_code}' `;
            }

            script += `  order by tbl_petrol_depot.ist_dt desc`;
            script += ` limit ${page_limit} offset ${page_index * page_limit}`;

            let tbl_temporary = await pgConn.get(
                dbPrefix + lic_code,
                script,
                config.connectionString()
            );
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(
                        JSON.stringify(tbl_temporary.data).replace(/\:null/gi, ':""')
                    );
                    let page_total = 0;
                    let rows_total = 0;
                    let script = ``;
                    if (ptrl_code.toString().toUpperCase() != "ALL") {
                        script = `select
                        ceil((ceil(count(ptrl_depot_code)) / ${page_limit})) as page_total,
                        count(*) as rows_total
                        from tbl_petrol
                        left join tbl_office on tbl_petrol.off_code = tbl_office.off_code
                        left join tbl_petrol_depot on tbl_petrol.ptrl_code = tbl_petrol_depot.ptrl_code 
                        left join tbl_depot on tbl_petrol_depot.dpo_code = tbl_depot.dpo_code 
                        left join tbl_depot_group on tbl_depot.dpo_group_code = tbl_depot_group.dpo_group_code 
                        left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                        where tbl_petrol_depot.ptrl_depot_flag = '1' and ptrl_depot_code is not null 
                        and tbl_petrol.ptrl_code = '${ptrl_code}' `;
                    }
                    else {
                        script = `select
                        ceil((ceil(count(ptrl_depot_code)) / ${page_limit})) as page_total,
                        count(*) as rows_total
                        from tbl_petrol
                        left join tbl_office on tbl_petrol.off_code = tbl_office.off_code
                        left join tbl_petrol_depot on tbl_petrol.ptrl_code = tbl_petrol_depot.ptrl_code 
                        left join tbl_depot on tbl_petrol_depot.dpo_code = tbl_depot.dpo_code 
                        left join tbl_depot_group on tbl_depot.dpo_group_code = tbl_depot_group.dpo_group_code 
                        left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code 
                        where tbl_petrol_depot.ptrl_depot_flag = '1' and ptrl_depot_code is not null `;
                    }

                    let tbl_temporary_total = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
                    if (!tbl_temporary_total.code) {
                        page_total = parseInt(tbl_temporary_total.data[0].page_total);
                        rows_total = parseInt(tbl_temporary_total.data[0].rows_total);
                    }
                    let response = [
                        {
                            status: "success",
                            invalid_code: "0",
                            message: "",
                            data: tbl_temporary.data,
                            page_total: page_total,
                            rows_total: rows_total,
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
                    "ดึงข้อมูลคลังสินค้าปั้ม",
                    JSON.stringify(req.body[0]),
                    "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
                    action[0].value
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
                message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                data: xresult,
                response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
            },
        ];
        res.status(200).send(response);
        await xglobal.action_logs(
            lic_code,
            action[0].id,
            "ดึงข้อมูลคลังสินค้าปั้ม",
            JSON.stringify(req.body[0]),
            "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
            action[0].value
        );
        return;
    });
};

//Success
exports.removePetrolDepot = async (req, res, next) => {
    return (async () => {
        let lic_code = req.header("lic_code");
        let { ptrl_depot_code, action } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (
            ptrl_depot_code == undefined ||
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
            script = `update tbl_petrol_depot set ptrl_depot_flag = '0', rm_dt = '${moment().format(
                "YYYY-MM-DD HH:mm:ss"
            )}' where ptrl_depot_code = '${ptrl_depot_code}';`;

            let tbl_temporary = await pgConn.execute(
                dbPrefix + lic_code,
                script,
                config.connectionString()
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
                    "ลบข้อมูลคลังสินค้าปั้ม",
                    JSON.stringify(req.body[0]),
                    "success",
                    action[0].value
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
                    "ลบข้อมูลคลังสินค้าปั้ม",
                    JSON.stringify(req.body[0]),
                    "ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
                    action[0].value
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
            "ลบข้อมูลคลังสินค้าปั้ม",
            JSON.stringify(req.body[0]),
            "ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
            action[0].value
        );
        return;
    });
};

//Success
exports.setPetrolDepotInformation = async (req, res, next) => {
    return (async () => {
        //debugger
        let lic_code = req.header("lic_code");
        let { ptrl_depot_code } = req.query;
        let { ptrl_code, dpo_code, ptrl_depot_status, action } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (
            ptrl_depot_code == undefined ||
            ptrl_code == undefined ||
            dpo_code == undefined ||
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
            if (ptrl_depot_status == undefined) {
                ptrl_depot_status = "";
            }

            let script = ``;
            script = `update tbl_petrol_depot set
            ptrl_code = '${ptrl_code}', 
            dpo_code = '${dpo_code}',
            ptrl_depot_status = '${ptrl_depot_status}',
            mdf_dt = '${moment().format("YYYY-MM-DD HH:mm:ss")}' 
            where ptrl_depot_code = '${ptrl_depot_code}';`;

            let tbl_temporary = await pgConn.execute(
                dbPrefix + lic_code,
                script,
                config.connectionString()
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
                    "แก้ไขข้อมูลคลังสินค้าปั้ม",
                    JSON.stringify(req.body[0]),
                    "success",
                    action[0].value
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
                    "แก้ไขข้อมูลคลังสินค้าปั้ม",
                    JSON.stringify(req.body[0]),
                    "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
                    action[0].value
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
            "แก้ไขข้อมูลคลังสินค้าปั้ม",
            JSON.stringify(req.body[0]),
            "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
            action[0].value
        );
        return;
    });
};

//Success
exports.addPetrolDepotInformation = async (req, res, next) => {
    return (async () => {
        debugger;
        let lic_code = req.header("lic_code");
        let { ptrl_code, dpo_code, ptrl_depot_status, action } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (
            ptrl_code == undefined ||
            dpo_code == undefined ||
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
            let script = ``;

            if (ptrl_depot_status == undefined) {
                ptrl_depot_status = "";
            }

            script = `select ptrl_depot_code from tbl_petrol_depot where ptrl_depot_flag = '1' and ptrl_code = '${ptrl_code}' and dpo_code = '${dpo_code}';`;
            let tbl_temporary0 = await pgConn.get(
                dbPrefix + lic_code,
                script,
                config.connectionString()
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
                        "เพิ่มข้อมูลคลังสินค้าปั้ม",
                        JSON.stringify(req.body[0]),
                        "ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลซ้ำ",
                        action[0].value
                    );
                    return;
                }
            }

            let ptrl_depot_code = "pdpo-" + moment().format("x");
            script = `insert into tbl_petrol_depot 
            (ptrl_depot_code, ptrl_code, dpo_code, ptrl_depot_flag, ist_dt, ptrl_depot_status) values 
            ('${ptrl_depot_code}', '${ptrl_code}', '${dpo_code}', '1', '${moment().format(
                "YYYY-MM-DD HH:mm:ss"
            )}', '${ptrl_depot_status}');`;

            let tbl_temporary = await pgConn.execute(
                dbPrefix + lic_code,
                script,
                config.connectionString()
            );
            if (!tbl_temporary.code) {
                //debugger
                let response = [
                    {
                        status: "success",
                        invalid_code: "0",
                        message: "",
                        data: [
                            {
                                ptrl_depot_code: ptrl_depot_code,
                            },
                        ],
                        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                    },
                ];

                res.status(200).send(response);
                await xglobal.action_logs(
                    lic_code,
                    action[0].id,
                    "เพิ่มข้อมูลคลังสินค้าปั้ม",
                    JSON.stringify(req.body[0]),
                    "success",
                    action[0].value
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
                    "เพิ่มข้อมูลคลังสินค้าปั้ม",
                    JSON.stringify(req.body[0]),
                    "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
                    action[0].value
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
            "เพิ่มข้อมูลคลังสินค้าปั้ม",
            JSON.stringify(req.body[0]),
            "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
            action[0].value
        );
        return;
    });
};


// ========= Success =========
exports.getPetrolDepotByPetrols = async (req, res, next) => {
    var xresult = [];

    return (async () => {
        let lic_code = req.header("lic_code");
        let { ptrl_code, action } = req.body[0];

        //เช็คเฉพาะส่วนที่สำคัญ
        if (
            ptrl_code == undefined ||
            lic_code == undefined ||
            action == undefined
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
        } else {
            let ptrlCodeArr = Array.isArray(ptrl_code) ? ptrl_code : [ptrl_code];
            if (ptrlCodeArr.length === 0) {
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
                return;
            }

            let ptrlCodeIn = ptrlCodeArr
                .map((c) => `'${c.replace(/'/g, "''")}'`)
                .join(", ");

            let script = `select 
                     distinct 
                        td.dpo_code,
                        td.dpo_number,
                        td.dpo_desc,
                        td.dpo_short_desc
                    from tbl_petrol_depot tpd
                    left join tbl_depot td on tpd.dpo_code = td.dpo_code
                    where tpd.ptrl_code in (${ptrlCodeIn}) and tpd.ptrl_depot_flag = '1'
                    order by td.dpo_desc asc;`;

            let tbl_temporary = await pgConn.get(
                dbPrefix + lic_code,
                script,
                config.connectionString(),
            );

            if (!tbl_temporary.code) {
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
                        status: "error",
                        invalid_code: "-3",
                        message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                        data: [],
                        response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                    },
                ];
                res.status(200).send(response);
                return;
            }
        }
    })().catch(async (err) => {
        console.log(err);
        let response = [
            {
                status: "error",
                invalid_code: "-4",
                message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                data: [],
                response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
            },
        ];
        res.status(200).send(response);
        return;
    });
};
