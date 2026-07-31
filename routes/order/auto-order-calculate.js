const config = require("../../configuration/connection");
const pgConn = require("../../library/pgConnection");
const moment = require("moment");
const axios = require("axios");
const { sapApiClient } = require("./sap-api-config");
const xglobal = require("../../middleware/global");
const dbPrefix = config.dbPrefix();
const sendResponse = xglobal.sendResponse;

function allocateFuelDownOnly(compartments, products) {
    const productNames = products.map(item => item.product);

    const productMap = products.reduce((acc, item) => {
        acc[item.product] = item.liter;
        return acc;
    }, {});

    const productMetaMap = products.reduce((acc, item) => {
        acc[item.product] = {
            ref1: item.ref1 ?? null,
            ref2: item.ref2 ?? null,
        };
        return acc;
    }, {});

    const best = {
        score: Infinity,
        allocation: null,
        adjustedProducts: null,
    };

    function calcScore(adjusted) {
        let score = 0;
        for (const name of productNames) {
            const requested = productMap[name];
            const actual = adjusted[name] || 0;
            score += requested - actual; // down_only => actual ต้องไม่เกิน requested
        }
        return score;
    }

    function backtrack(index, currentAllocation, adjusted) {
        if (index === compartments.length) {
            const score = calcScore(adjusted);

            if (score < best.score) {
                best.score = score;
                best.allocation = JSON.parse(JSON.stringify(currentAllocation));
                best.adjustedProducts = { ...adjusted };
            }
            return;
        }

        const compartment = compartments[index];

        // ไม่ใช้ช่องนี้
        currentAllocation.push({
            compartment_no: compartment.compartment_no,
            product: null,
            liter: 0,
        });
        backtrack(index + 1, currentAllocation, adjusted);
        currentAllocation.pop();

        // ใช้ช่องนี้กับ product
        for (const productName of productNames) {
            for (const qty of compartment.options) {
                const nextTotal = (adjusted[productName] || 0) + qty;

                // down_only => ห้ามเกิน target
                if (nextTotal > productMap[productName]) continue;

                currentAllocation.push({
                    compartment_no: compartment.compartment_no,
                    product: productName,
                    liter: qty,
                });

                adjusted[productName] = nextTotal;

                backtrack(index + 1, currentAllocation, adjusted);

                adjusted[productName] -= qty;
                currentAllocation.pop();
            }
        }
    }

    const initAdjusted = {};
    for (const name of productNames) {
        initAdjusted[name] = 0;
    }

    backtrack(0, [], initAdjusted);

    if (!best.allocation) {
        return {
            success: false,
            score: null,
            result: [],
            unused_compartments: [],
        };
    }

    const result = products.map(item => {
        const productName = item.product;
        const requestedLiter = item.liter;
        const adjustedLiter = best.adjustedProducts[productName] || 0;
        const meta = productMetaMap[productName] || {};

        return {
            product: productName,
            ref1: meta.ref1,
            ref2: meta.ref2,
            requested_liter: requestedLiter,
            adjusted_liter: adjustedLiter,
            diff_liter: adjustedLiter - requestedLiter,
            compartments: best.allocation
                .filter(x => x.product === productName)
                .map(x => ({
                    compartment_no: x.compartment_no,
                    liter: x.liter,
                })),
        };
    });

    const unusedCompartments = best.allocation
        .filter(x => x.product === null)
        .map(x => ({
            compartment_no: x.compartment_no,
            liter: 0,
        }));

    return {
        success: true,
        score: best.score,
        unused_compartments: unusedCompartments,
        result,
    };
}

exports.getAutoCalculateOrderInformation = async (req, res, next) => {
    var xresult = [];

    return (async () => {
        let lic_code = req.header("lic_code");
        let {
            ptrl_code,
            action
        } = req.body[0] || {};
        if (ptrl_code == undefined || action == undefined) {
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
        else {
            var xdatabase = dbPrefix + lic_code;
            var xdate = moment().add('days', -1).format('YYYY-MM-DD');
            xscript = `select distinct shipto_no, ptr.ptrl_code, ptr.ptrl_sitecode, ptr.ptrl_number, ptr.stock_provious_days, 
            case when ptr.waiting_days is null then 2 else waiting_days :: integer + 1 end as waiting_days, ptr.coverage_days, auto.automatic_code 
            from tbl_order_eodtank eod
            inner join tbl_petrol ptr on eod.shipto_no = ptr.ptrl_sitecode  
            left join tbl_automatics_orders auto on ptr.ptrl_code = auto.ptrl_code 
            and auto.ist_dt >= '${xdate} 00:00:00.000' and auto.ist_dt <= '${xdate} 23:59:59.000' 
            where date_at >= '${xdate} 00:00:00.000' and date_at <= '${xdate} 23:59:59.000' 
            and (auto.automatic_code is null or auto."result" = '') and ptr.ptrl_code = '${ptrl_code}' 
            order by shipto_no asc;`

            let db_temporary = await pgConn.get(
                xdatabase,
                xscript,
                config.connectionString(),
            );

            if (!db_temporary.code) {

                if (db_temporary.data.length == 0) {
                    xdate = moment().add('days', -2).format('YYYY-MM-DD');

                    var xscript = `select distinct shipto_no, ptr.ptrl_code, ptr.ptrl_sitecode, ptr.ptrl_number, ptr.stock_provious_days, 
                    case when ptr.waiting_days is null then 2 else waiting_days :: integer + 1 end as waiting_days, ptr.coverage_days, auto.automatic_code 
                    from tbl_order_eodtank eod
                    inner join tbl_petrol ptr on eod.shipto_no = ptr.ptrl_sitecode  
                    left join tbl_automatics_orders auto on ptr.ptrl_code = auto.ptrl_code 
                    and auto.ist_dt >= '${xdate} 00:00:00.000' and auto.ist_dt <= '${xdate} 23:59:59.000' 
                    where date_at >= '${xdate} 00:00:00.000' and date_at <= '${xdate} 23:59:59.000' 
                    and (auto.automatic_code is null or auto."result" = '') and ptr.ptrl_code = '${ptrl_code}' 
                    order by shipto_no asc;`

                    db_temporary = await pgConn.get(
                        dbPrefix + lic_code,
                        xscript,
                        config.connectionString(),
                    );

                    if (db_temporary.code) {
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
                        return;
                    }
                }

                //เช็กว่าเคยประมวลผล auto แล้วหรือยัง
                if (db_temporary.data.length > 0) {
                    const xrunstock = true;
                    const xrunsaleprovious = true;
                    const xrunfillmanualorder = true;
                    const xrunautoorder = true;
                    const xruncalculateorder = true;
                    const xruncreateorder = true;

                    //check stock. and fill volume
                    if (xrunstock) {
                        for (var xdb = 0; xdb <= db_temporary.data.length - 1; xdb++) {
                            var shipto_no = db_temporary.data[xdb].shipto_no;
                            console.log("calculate stock:", shipto_no, xdb, '/', db_temporary.data.length - 1, moment().format('YYYY-MM-DD HH:mm:ss'));

                            xscript = `select ptr.ptrl_code, ptank.ptrl_tank_code , ptr.ptrl_number, eod.tank_no as eod_tnk_number, ptank.tnk_number, 
                            case when eod.tank_end = 0 then eod.tank_start else eod.tank_end end as stock, itm.itm_code, itm.itm_desc,
                            ptank.tnk_capacity, ptank.tnk_target, ptank.tnk_deadstock, ptank.tnk_safety_factor  
                            from tbl_order_eodtank eod 
                            inner join tbl_petrol ptr on eod.shipto_no  = ptr.ptrl_sitecode 
                            inner join tbl_petrol_tank ptank on ptr.ptrl_code = ptank.ptrl_code 
                            inner join tbl_item itm on ptank.itm_code = itm.itm_code 
                            and eod.tank_no = ptank.tnk_number 
                            where date_at >= '${xdate} 00:00:00.000' 
                            and date_at <= '${xdate} 23:59:59.000' and eod.shipto_no = '${shipto_no}'
                            and ptank.ptrl_tank_flag = '1'
                            order by eod.tank_no asc;`

                            let db_temporary2 = await pgConn.get(xdatabase, xscript, config.connectionString());
                            if (db_temporary2.data.length > 0) {
                                for (var xdb2 = 0; xdb2 <= db_temporary2.data.length - 1; xdb2++) {
                                    ptrl_code = db_temporary2.data[xdb2].ptrl_code;
                                    var automatic_code = 'auto-' + moment().format('x');
                                    var tank_code = db_temporary2.data[xdb2].ptrl_tank_code;
                                    var itm_code = db_temporary2.data[xdb2].itm_code;
                                    var stock = db_temporary2.data[xdb2].stock;
                                    var stock_at = xdate;
                                    var ist_dt = moment().format('YYYY-MM-DD HH:mm:ss');
                                    var tnk_capacity = db_temporary2.data[xdb2].tnk_capacity;
                                    var tnk_target = db_temporary2.data[xdb2].tnk_target;
                                    var tnk_deadstock = db_temporary2.data[xdb2].tnk_deadstock;
                                    var tnk_safety_factor = db_temporary2.data[xdb2].tnk_safety_factor;

                                    //insert to tank order information
                                    if (xdb2 == 0) {
                                        //clear table
                                        xscript = `delete from tbl_automatics_tanks_information where ptrl_code = '${ptrl_code}' 
                                        and stock_at >= '${xdate} 00:00:00.000' and stock_at <= '${xdate} 23:59:59.000';`;
                                        await pgConn.execute(xdatabase, xscript, config.connectionString());
                                    }

                                    xscript = `insert into tbl_automatics_tanks_information 
                                    (automatic_code, ptrl_code, tank_code, itm_code, stock, stock_at, ist_dt, tnk_capacity, tnk_target, tnk_deadstock, tnk_safety_factor) values 
                                    ('${automatic_code}', '${ptrl_code}', '${tank_code}', '${itm_code}', ${stock}, '${stock_at}', '${ist_dt}', 
                                    ${tnk_capacity}, ${tnk_target}, ${tnk_deadstock}, ${tnk_safety_factor});`

                                    let db_temporary3 = await pgConn.execute(xdatabase, xscript, config.connectionString());
                                    console.log("tbl_automatics_tanks_information:", shipto_no, ':', !db_temporary3.code, xdb, '/', db_temporary.data.length - 1, moment().format('YYYY-MM-DD HH:mm:ss'));
                                }
                            }
                        }
                    }

                    //check sale of days * 1
                    if (xrunsaleprovious) {
                        //petrol
                        for (var xsale = 0; xsale <= db_temporary.data.length - 1; xsale++) {
                            var shipto_no = db_temporary.data[xsale].shipto_no;
                            var xdate_previous = [];
                            var xdate_temporary = '';

                            for (var xbsxx = 0; xbsxx <= parseInt(db_temporary.data[xsale].waiting_days) - 1; xbsxx++) {
                                var xdaterunning = moment(xdate).add('days', (xbsxx + 1)).format('YYYY-MM-DD');

                                if (xbsxx == 0) {
                                    for (var xprevious = 0; xprevious <= (8 - 1); xprevious++) {
                                        if (xprevious != 0) {
                                            //debugger
                                            var xreduce = (xprevious * 7 * -1)
                                            xdate_temporary = moment(xdaterunning).add('days', xreduce).format('YYYY-MM-DD');
                                        }
                                        else {
                                            if (xbsxx == 0) {
                                                xdate_temporary = moment(xdate).format('YYYY-MM-DD');
                                            }
                                            else {
                                                xdate_temporary = moment(xdaterunning).format('YYYY-MM-DD');
                                            }
                                        }

                                        xdate_previous.push(xdate_temporary);
                                    }
                                }
                                else {
                                    for (var xprevious = 0; xprevious <= (7 - 1); xprevious++) {
                                        if (xprevious != 0) {
                                            //debugger
                                            var xreduce = (xprevious * 7 * -1)
                                            xdate_temporary = moment(xdaterunning).add('days', xreduce).format('YYYY-MM-DD');
                                        }
                                        else {
                                            xdate_temporary = moment(xdaterunning).format('YYYY-MM-DD');
                                        }

                                        xdate_previous.push(xdate_temporary);
                                    }
                                }
                            }

                            var temporary_tank = '';
                            var automatic_code = 'auto-' + moment().format('x');
                            for (var xdatesale2 = 0; xdatesale2 <= xdate_previous.length - 1; xdatesale2++) {
                                console.log("calculate sale provious:", shipto_no, xsale, '/', db_temporary.data.length - 1, moment(xdate_previous[xdatesale2]).format('YYYY-MM-DD HH:mm:ss'));
                                //delete information.
                                temporary_tank = '';
                                if (xdatesale2 == 0) {
                                    xscript = `delete from tbl_automatics_sales_previous_information 
                                    where sale_at_previous = '${xdate_previous[xdatesale2]}' 
                                    and ptrl_code in (select ptrl_code from tbl_petrol where ptrl_sitecode  = '${shipto_no}');`;
                                    await pgConn.execute(xdatabase, xscript, config.connectionString());
                                }

                                xscript = `select ptr.ptrl_code, eod.shipto_no, eod.tank_no, ptank.tnk_number, eod.meter_start, eod.meter_end, 
                                ptank.ptrl_tank_code, ptank.itm_code  
                                from tbl_order_eodmeter eod 
                                inner join tbl_petrol ptr on eod.shipto_no = ptr.ptrl_sitecode  
                                left join tbl_petrol_tank ptank on ptr.ptrl_code = ptank.ptrl_code 
                                and eod.tank_no = ptank.tnk_number
                                where buy_date >= '${xdate_previous[xdatesale2]} 00:00:00.000' 
                                and buy_date <= '${xdate_previous[xdatesale2]} 23:59:59.000' and ptank.ptrl_tank_flag = '1' and eod.shipto_no = '${shipto_no}' 
                                order by eod.tank_no, eod.ist_dt asc;`

                                let db_saleprovious = await pgConn.get(xdatabase, xscript, config.connectionString());
                                if (!db_saleprovious.code) {
                                    if (db_saleprovious.data.length > 0) {
                                        //calculate sale daily
                                        var xliter = 0;
                                        var xtempliter = 0;
                                        var tank_code = '';
                                        var itm_code = '';
                                        for (var xvalue = 0; xvalue <= db_saleprovious.data.length - 1; xvalue++) {
                                            console.log('shipto_no:', shipto_no, 'temporary_tank:', temporary_tank);

                                            if (temporary_tank != db_saleprovious.data[xvalue].tnk_number) {
                                                if (temporary_tank == '') {
                                                    ptrl_code = db_saleprovious.data[xvalue].ptrl_code;
                                                    tank_code = db_saleprovious.data[xvalue].ptrl_tank_code;
                                                    itm_code = db_saleprovious.data[xvalue].itm_code;
                                                    temporary_tank = db_saleprovious.data[xvalue].tnk_number;
                                                    xliter = 0;
                                                    xtempliter = 0;

                                                    if (db_saleprovious.data[xvalue].meter_start > db_saleprovious.data[xvalue].meter_end) {
                                                        try {
                                                            xtempliter = parseFloat(db_saleprovious.data[xvalue].meter_end);
                                                            xliter += xtempliter;
                                                        }
                                                        catch (ex) { }
                                                    }
                                                    else {
                                                        try {
                                                            xtempliter = parseFloat(db_saleprovious.data[xvalue].meter_end) - parseFloat(db_saleprovious.data[xvalue].meter_start);
                                                            xliter += xtempliter;
                                                        }
                                                        catch (ex) { }
                                                    }
                                                }
                                                else {
                                                    // insert before information.
                                                    var sale_previous = xliter;
                                                    var sale_at_previous = xdate_previous[xdatesale2];
                                                    var ist_dt = moment().format('YYYY-MM-DD HH:mm:ss');

                                                    switch (xdatesale2) {
                                                        case 0:
                                                            xscript = `insert into tbl_automatics_sales_previous_information 
                                                            (automatic_code, ptrl_code, tank_code, itm_code, sale_previous, sale_at_previous, ist_dt) values 
                                                            ('${automatic_code}', '${ptrl_code}', '${tank_code}', '${itm_code}', ${sale_previous}, '${sale_at_previous}', '${ist_dt}');`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 1:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous1 = ${sale_previous}, sale_at_previous1 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 2:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous2 = ${sale_previous}, sale_at_previous2 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 3:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous3 = ${sale_previous}, sale_at_previous3 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 4:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous4 = ${sale_previous}, sale_at_previous4 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 5:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous5 = ${sale_previous}, sale_at_previous5 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 6:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous6 = ${sale_previous}, sale_at_previous6 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 7:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous7 = ${sale_previous}, sale_at_previous7 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 8:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous8 = ${sale_previous}, sale_at_previous8 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 9:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous9 = ${sale_previous}, sale_at_previous9 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 10:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous10 = ${sale_previous}, sale_at_previous10 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 11:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous11 = ${sale_previous}, sale_at_previous11 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 12:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous12 = ${sale_previous}, sale_at_previous12 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 13:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous13 = ${sale_previous}, sale_at_previous13 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 14:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous14 = ${sale_previous}, sale_at_previous14 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                    }

                                                    //clear information and add new information
                                                    ptrl_code = db_saleprovious.data[xvalue].ptrl_code;
                                                    tank_code = db_saleprovious.data[xvalue].ptrl_tank_code;
                                                    itm_code = db_saleprovious.data[xvalue].itm_code;
                                                    temporary_tank = db_saleprovious.data[xvalue].tnk_number;
                                                    xliter = 0;
                                                    xtempliter = 0;

                                                    if (db_saleprovious.data[xvalue].meter_start > db_saleprovious.data[xvalue].meter_end) {
                                                        try {
                                                            xtempliter = parseFloat(db_saleprovious.data[xvalue].meter_end);
                                                            xliter += xtempliter;
                                                        }
                                                        catch (ex) { }
                                                    }
                                                    else {
                                                        try {
                                                            xtempliter = parseFloat(db_saleprovious.data[xvalue].meter_end) - parseFloat(db_saleprovious.data[xvalue].meter_start);
                                                            xliter += xtempliter;
                                                        }
                                                        catch (ex) { }
                                                    }

                                                    if (xvalue == db_saleprovious.data.length - 1) {
                                                        sale_previous = xliter;
                                                        switch (xdatesale2) {
                                                            case 0:
                                                                xscript = `insert into tbl_automatics_sales_previous_information 
                                                                (automatic_code, ptrl_code, tank_code, itm_code, sale_previous, sale_at_previous, ist_dt) values 
                                                                ('${automatic_code}', '${ptrl_code}', '${tank_code}', '${itm_code}', ${sale_previous}, '${sale_at_previous}', '${ist_dt}');`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 1:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous1 = ${sale_previous}, sale_at_previous1 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 2:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous2 = ${sale_previous}, sale_at_previous2 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 3:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous3 = ${sale_previous}, sale_at_previous3 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 4:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous4 = ${sale_previous}, sale_at_previous4 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 5:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous5 = ${sale_previous}, sale_at_previous5 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 6:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous6 = ${sale_previous}, sale_at_previous6 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 7:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous7 = ${sale_previous}, sale_at_previous7 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 8:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous8 = ${sale_previous}, sale_at_previous8 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 9:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous9 = ${sale_previous}, sale_at_previous9 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 10:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous10 = ${sale_previous}, sale_at_previous10 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 11:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous11 = ${sale_previous}, sale_at_previous11 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 12:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous12 = ${sale_previous}, sale_at_previous12 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 13:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous13 = ${sale_previous}, sale_at_previous13 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 14:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous14 = ${sale_previous}, sale_at_previous14 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                        }
                                                    }
                                                }

                                            }
                                            else {
                                                if (db_saleprovious.data[xvalue].meter_start > db_saleprovious.data[xvalue].meter_end) {
                                                    try {
                                                        xtempliter = parseFloat(db_saleprovious.data[xvalue].meter_end);
                                                        xliter += xtempliter;
                                                    }
                                                    catch (ex) { }
                                                }
                                                else {
                                                    try {
                                                        xtempliter = parseFloat(db_saleprovious.data[xvalue].meter_end) - parseFloat(db_saleprovious.data[xvalue].meter_start);
                                                        xliter += xtempliter;
                                                    }
                                                    catch (ex) { }
                                                }

                                                if (xvalue == db_saleprovious.data.length - 1) {
                                                    sale_previous = xliter;
                                                    switch (xdatesale2) {
                                                        case 0:
                                                            xscript = `insert into tbl_automatics_sales_previous_information 
                                                            (automatic_code, ptrl_code, tank_code, itm_code, sale_previous, sale_at_previous, ist_dt) values 
                                                            ('${automatic_code}', '${ptrl_code}', '${tank_code}', '${itm_code}', ${sale_previous}, '${sale_at_previous}', '${ist_dt}');`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 1:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous1 = ${sale_previous}, sale_at_previous1 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 2:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous2 = ${sale_previous}, sale_at_previous2 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 3:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous3 = ${sale_previous}, sale_at_previous3 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 4:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous4 = ${sale_previous}, sale_at_previous4 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 5:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous5 = ${sale_previous}, sale_at_previous5 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 6:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous6 = ${sale_previous}, sale_at_previous6 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 7:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous7 = ${sale_previous}, sale_at_previous7 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 8:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous8 = ${sale_previous}, sale_at_previous8 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 9:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous9 = ${sale_previous}, sale_at_previous9 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 10:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous10 = ${sale_previous}, sale_at_previous10 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 11:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous11 = ${sale_previous}, sale_at_previous11 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 12:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous12 = ${sale_previous}, sale_at_previous12 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 13:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous13 = ${sale_previous}, sale_at_previous13 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 14:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous14 = ${sale_previous}, sale_at_previous14 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }


                        }
                    }

                    //find auto order. (need Qty)
                    if (xrunautoorder) {
                        for (var xautoorder = 0; xautoorder <= db_temporary.data.length - 1; xautoorder++) {
                            var shipto_no = db_temporary.data[xautoorder].shipto_no;
                            var coverage_days = db_temporary.data[xautoorder].coverage_days;
                            console.log("calculate auto order:", shipto_no, xautoorder, '/', db_temporary.data.length - 1, moment().format('YYYY-MM-DD HH:mm:ss'));

                            xscript = `select automatic_code, ptrl_code, tank_code, itm_code, stock, stock_at, ist_dt, mdf_dt, 
                            case when fill_volume is null then 0 else fill_volume end as fill_volume, fill_volume_after, tnk_capacity, tnk_target, tnk_deadstock, (tnk_safety_factor / 100) as tnk_safety_factor 
                            from tbl_automatics_tanks_information where ptrl_code in (select ptrl_code from tbl_petrol where ptrl_sitecode  = '${shipto_no}')  
                            and stock_at >= '${xdate} 00:00:00.000' and stock_at <= '${xdate} 23:59:59.000';`;
                            let db_autoorder1 = await pgConn.get(xdatabase, xscript, config.connectionString());

                            if (!db_autoorder1.code) {
                                for (var xcreate = 0; xcreate <= db_autoorder1.data.length - 1; xcreate++) {
                                    ptrl_code = db_autoorder1.data[xcreate].ptrl_code;
                                    var automatic_code = db_autoorder1.data[xcreate].automatic_code;
                                    var tank_code = db_autoorder1.data[xcreate].tank_code;
                                    var xstock = 0.0;
                                    var xtargetstock = 0.0;
                                    var xtargetorder = 0.0;
                                    var xunpumplevel = parseInt(db_autoorder1.data[xcreate].tnk_deadstock);
                                    var xtnk_safety_factor = parseFloat(db_autoorder1.data[xcreate].tnk_safety_factor);
                                    var xtnk_capacity = parseFloat(db_autoorder1.data[xcreate].tnk_capacity);
                                    var xtnk_target_config = parseFloat(db_autoorder1.data[xcreate].tnk_target);
                                    var xdaysale = 0.0;
                                    var xneedqty = 0.0;

                                    xscript = `select automatic_code, ptrl_code, tank_code, itm_code,
                                    ((sale_previous1 + sale_previous2 + sale_previous3 + sale_previous4 + sale_previous5 + sale_previous6 + sale_previous7 +
                                    sale_previous8 + sale_previous9 + sale_previous10 + sale_previous11 + sale_previous12 + sale_previous13 + sale_previous14) 
                                    / (sale_average1 + sale_average2 + sale_average3 + sale_average4 + sale_average5 + sale_average6 + sale_average7 + 
                                    sale_average8 + sale_average9 + sale_average10 + sale_average11 + sale_average12 + sale_average13 + sale_average14)) * ${xtnk_safety_factor}
                                    as daysales, case when sale_previous is null then 0 else sale_previous end as sale_previous 

                                    from 
                                    (select automatic_code, ptrl_code, tank_code,
                                    itm_code, sale_previous, sale_at_previous, 
                                    case when sale_previous1 is null then 0 else sale_previous1 end as sale_previous1,
                                    case when sale_previous2 is null then 0 else sale_previous2 end as sale_previous2,
                                    case when sale_previous3 is null then 0 else sale_previous3 end as sale_previous3,
                                    case when sale_previous4 is null then 0 else sale_previous4 end as sale_previous4,
                                    case when sale_previous5 is null then 0 else sale_previous5 end as sale_previous5,
                                    case when sale_previous6 is null then 0 else sale_previous6 end as sale_previous6,
                                    case when sale_previous7 is null then 0 else sale_previous7 end as sale_previous7,
                                    case when sale_previous8 is null then 0 else sale_previous8 end as sale_previous8,
                                    case when sale_previous9 is null then 0 else sale_previous9 end as sale_previous9,
                                    case when sale_previous10 is null then 0 else sale_previous10 end as sale_previous10,
                                    case when sale_previous11 is null then 0 else sale_previous11 end as sale_previous11,
                                    case when sale_previous12 is null then 0 else sale_previous12 end as sale_previous12,
                                    case when sale_previous13 is null then 0 else sale_previous13 end as sale_previous13,
                                    case when sale_previous14 is null then 0 else sale_previous14 end as sale_previous14,
                                    case when sale_previous1 is null then 0 else 1 end as sale_average1,
                                    case when sale_previous2 is null then 0 else 1 end as sale_average2,
                                    case when sale_previous3 is null then 0 else 1 end as sale_average3,
                                    case when sale_previous4 is null then 0 else 1 end as sale_average4,
                                    case when sale_previous5 is null then 0 else 1 end as sale_average5,
                                    case when sale_previous6 is null then 0 else 1 end as sale_average6,
                                    case when sale_previous7 is null then 0 else 1 end as sale_average7,
                                    case when sale_previous8 is null then 0 else 1 end as sale_average8,
                                    case when sale_previous9 is null then 0 else 1 end as sale_average9,
                                    case when sale_previous10 is null then 0 else 1 end as sale_average10,
                                    case when sale_previous11 is null then 0 else 1 end as sale_average11,
                                    case when sale_previous12 is null then 0 else 1 end as sale_average12, 
                                    case when sale_previous13 is null then 0 else 1 end as sale_average13,
                                    case when sale_previous14 is null then 0 else 1 end as sale_average14 
                                    from tbl_automatics_sales_previous_information salepr
                                    where salepr.ptrl_code = '${ptrl_code}' and salepr.tank_code = '${tank_code}' 
                                    and sale_at_previous = '${xdate}') xtable`

                                    let db_autoorder2 = await pgConn.get(xdatabase, xscript, config.connectionString());
                                    if (!db_autoorder2.code) {
                                        if (db_autoorder2.data.length > 0) {
                                            if (parseFloat(db_autoorder2.data[0].daysales) <= 0.0) {
                                                xdaysale = parseFloat(db_autoorder2.data[0].sale_previous);
                                            }
                                            else {
                                                xdaysale = parseFloat(db_autoorder2.data[0].daysales);
                                            }
                                        }
                                    }

                                    if (xdaysale > 0) {
                                        try {
                                            xstock = parseFloat(db_autoorder1.data[xcreate].stock) + parseFloat(db_autoorder1.data[xcreate].fill_volume);
                                            xtargetstock = (xdaysale * coverage_days) + xunpumplevel;
                                            xneedqty = Math.max(0, xtargetstock - xstock);
                                            xtargetorder = (xdaysale) + xunpumplevel;
                                        }
                                        catch (ex) {
                                            debugger
                                        }

                                        if (xneedqty <= (xtnk_capacity - xstock)) {
                                            //ถ้า NeedQty น้อยกว่า Threshold → ไม่ต้องสั่ง และต้องตรวจ
                                            //insert result and targetstock
                                            xscript = `update tbl_automatics_tanks_information set fill_volume_after = ${xneedqty},
                                            tnk_target = ${xtargetorder}, 
                                            result = 'Need Qty <= (Tank Capacity - Stock)' 
                                            where automatic_code = '${automatic_code}' 
                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                        }
                                        else {
                                            //create order
                                            if (xtargetorder > xtnk_target_config) {
                                                xtargetorder = xtnk_target_config;
                                            }

                                            if (xneedqty > 100000) {
                                                xscript = `update tbl_automatics_tanks_information set fill_volume_after = ${xtargetorder},
                                                tnk_target = ${xtargetorder}, 
                                                result = 'Need Qty is incorrect' 
                                                where automatic_code = '${automatic_code}' 
                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                            }
                                            else {
                                                xscript = `update tbl_automatics_tanks_information set fill_volume_after = ${xtargetorder},
                                                tnk_target = ${xtargetorder}, 
                                                result = 'correct' 
                                                where automatic_code = '${automatic_code}' 
                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                            }
                                        }
                                    } else {
                                        //save logs for report
                                        xscript = `update tbl_automatics_tanks_information set fill_volume_after = 0,
                                        tnk_target = 0, 
                                        result = 'DaySales is empty' 
                                        where automatic_code = '${automatic_code}' 
                                        and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                        await pgConn.execute(xdatabase, xscript, config.connectionString());
                                    }
                                }
                            }

                        }
                    }

                    //calculate auto order. correct
                    if (xruncalculateorder) {
                        xscript = `select tati.ptrl_code, sum(tati.fill_volume_after) as fill_volume_after, tati.result 
                        from tbl_automatics_tanks_information tati  
                        where stock_at >= '${xdate} 00:00:00.000' 
                        and stock_at <= '${xdate} 23:59:59.000' and tati.ptrl_code = '${ptrl_code}' 
                        and tati.result = 'correct' group by tati.ptrl_code, result 
                        order by tati.ptrl_code asc`

                        let db_createorder1 = await pgConn.get(xdatabase, xscript, config.connectionString());
                        if (!db_createorder1.code) {
                            if (db_createorder1.data.length > 0) {
                                for (var xcorder = 0; xcorder <= db_createorder1.data.length - 1; xcorder++) {
                                    var veh_type_code = '';
                                    //get vehicle type
                                    xscript = `select 0 as level,tpvt.veh_type_code, tvt.veh_type_desc ,tvt.capacity_max, tvt.capacity_min, tpvt.ptrl_vehicle_type_flag
                                    from tbl_petrol_vehicle_type tpvt 
                                    inner join tbl_vehicle_type tvt on tpvt.veh_type_code = tvt.veh_type_code 
                                    where tpvt.ptrl_code = '${db_createorder1.data[xcorder].ptrl_code}' and tpvt.ptrl_vehicle_type_flag = '1' and tvt.veh_type_flag = '1'`;

                                    let xpassed = false;
                                    let db_createorder2 = await pgConn.get(xdatabase, xscript, config.connectionString());
                                    if (!db_createorder2.code) {

                                        if (db_createorder2.data.length == 0) {
                                            xscript = `select level, veh_type_code, veh_type_desc, capacity_max, capacity_min
                                            from 
                                            ((select 0 as level,tpvt.veh_type_code, tvt.veh_type_desc ,tvt.capacity_max, tvt.capacity_min 
                                            from tbl_petrol_vehicle_type tpvt 
                                            left join tbl_vehicle_type tvt on tpvt.veh_type_code = tpvt.veh_type_code 
                                            where tpvt.ptrl_code = '${db_createorder1.data[xcorder].ptrl_code}'

                                            union

                                            select 1 as level,tvt.veh_type_code, tvt.veh_type_desc ,tvt.capacity_max, tvt.capacity_min 
                                            from tbl_vehicle_type tvt where capacity_min < ${db_createorder1.data[xcorder].fill_volume_after}  
                                            and capacity_max >= ${db_createorder1.data[xcorder].fill_volume_after}

                                            union

                                            select 2 as level,tvt.veh_type_code, tvt.veh_type_desc ,tvt.capacity_max, tvt.capacity_min 
                                            from tbl_vehicle_type tvt where tvt.veh_type_code in 
                                            (select veh_type_code from tbl_vehicle_type order by capacity_max desc limit 1))) xtable 
                                            order by xtable."level" asc`

                                            db_createorder2 = await pgConn.get(xdatabase, xscript, config.connectionString());
                                        }

                                        if (db_createorder2.data.length > 0) {
                                            for (var xpass = 0; xpass <= db_createorder2.data.length - 1; xpass++) {
                                                var veh_type_code = db_createorder2.data[xpass].veh_type_code;

                                                if (xpassed == false) {
                                                    xscript = `select tvt.veh_type_code, tvt.veh_type_desc, tvt.veh_qty, tvt.capacity_min, tvt.capacity_max,
                                                    compartment_no, compartment_total, vect_compartment_level_id, veh_compartment_type_level_number, veh_compartment_type_level,
                                                    '' as automatic_code ,'' as ptrl_code, '' as tank_code, '' as itm_code 
                                                    from tbl_vehicle_type tvt
                                                    left join tbl_vehicle_type_compartment tvtim on tvt.veh_type_code = tvtim.veh_type_code 
                                                    left join tbl_vehicle_type_compartment_level tvtlev on tvtim.id = tvtlev.compartment_item_id  
                                                    where tvt.veh_type_code = '${veh_type_code}' and tvtlev.veh_compartment_type_level_flag = '1'
                                                    order by tvtim.compartment_no asc, tvtlev.veh_compartment_type_level_number asc`

                                                    let db_createorder3 = await pgConn.get(xdatabase, xscript, config.connectionString());

                                                    if (!db_createorder3.code) {
                                                        if (db_createorder3.data.length > 0) {
                                                            //get information for create order.
                                                            xscript = `select tati.automatic_code ,tati.ptrl_code, tati.tank_code, tati.itm_code, tati.fill_volume_after, tati.result 
                                                            from tbl_automatics_tanks_information tati  
                                                            where stock_at >= '${xdate} 00:00:00.000' 
                                                            and stock_at <= '${xdate} 23:59:59.000' 
                                                            and tati.result = 'correct' and tati.ptrl_code = '${db_createorder1.data[xcorder].ptrl_code}'
                                                            group by tati.automatic_code, tati.ptrl_code, tati.tank_code, tati.itm_code, tati.fill_volume_after, tati.result 
                                                            order by tati.ptrl_code asc`

                                                            let db_createorder4 = await pgConn.get(xdatabase, xscript, config.connectionString());

                                                            if (!db_createorder4.code) {
                                                                if (db_createorder4.data.length > 0) {

                                                                    var compartments = [];
                                                                    var xcompartment_no = '';
                                                                    var xlevel = [];
                                                                    for (var xcomp = 0; xcomp <= db_createorder3.data.length - 1; xcomp++) {
                                                                        if (xcompartment_no != db_createorder3.data[xcomp].compartment_no) {
                                                                            if (xcompartment_no == '') {
                                                                                xlevel = [];
                                                                                xcompartment_no = db_createorder3.data[xcomp].compartment_no;
                                                                                xlevel.push(db_createorder3.data[xcomp].veh_compartment_type_level);
                                                                            }
                                                                            else {
                                                                                compartments.push({
                                                                                    compartment_no: xcompartment_no,
                                                                                    options: xlevel
                                                                                })

                                                                                xlevel = [];
                                                                                xcompartment_no = db_createorder3.data[xcomp].compartment_no;
                                                                                xlevel.push(db_createorder3.data[xcomp].veh_compartment_type_level);

                                                                                if (xcomp == db_createorder3.data.length - 1) {
                                                                                    compartments.push({
                                                                                        compartment_no: xcompartment_no,
                                                                                        options: xlevel
                                                                                    });

                                                                                    xlevel = [];
                                                                                }
                                                                            }
                                                                        }
                                                                        else {
                                                                            xlevel.push(db_createorder3.data[xcomp].veh_compartment_type_level);

                                                                            if (xcomp == db_createorder3.data.length - 1) {
                                                                                compartments.push({
                                                                                    compartment_no: xcompartment_no,
                                                                                    options: xlevel
                                                                                });

                                                                                xlevel = [];
                                                                            }
                                                                        }
                                                                    }

                                                                    console.log(JSON.stringify(compartments));
                                                                    //debugger
                                                                    var products = [];
                                                                    for (var xprod = 0; xprod <= db_createorder4.data.length - 1; xprod++) {
                                                                        products.push(
                                                                            {
                                                                                product: db_createorder4.data[xprod].tank_code,
                                                                                liter: db_createorder4.data[xprod].fill_volume_after,
                                                                                ref1: db_createorder4.data[xprod].automatic_code,
                                                                                ref2: db_createorder4.data[xprod].ptrl_code
                                                                            })
                                                                    }

                                                                    //debugger
                                                                    var xresult = await allocateFuelDownOnly(compartments, products);
                                                                    console.log(xresult);

                                                                    if (xresult.success) {
                                                                        if (xresult.result.length > 0) {
                                                                            for (var xss = 0; xss <= xresult.result.length - 1; xss++) {
                                                                                //update fill_volume_actual
                                                                                if (xresult.result[xss].compartments.length > 0) {
                                                                                    xpassed = true;
                                                                                    xscript = `update tbl_automatics_tanks_information 
                                                                                    set fill_volume_actual = ${xresult.result[xss].adjusted_liter},
                                                                                    veh_type_code = '${veh_type_code}',
                                                                                    result = 'wait create order.' 
                                                                                    where automatic_code = '${xresult.result[xss].ref1}' 
                                                                                    and ptrl_code = '${xresult.result[xss].ref2}' 
                                                                                    and tank_code = '${xresult.result[xss].product}';`

                                                                                    console.log('update fill_volume_actual, veh_type_code,', xresult.result[xss].ref1, ',', xresult.result[xss].ref2);
                                                                                    var db_createorder5 = await pgConn.execute(xdatabase, xscript, config.connectionString());

                                                                                    if (!db_createorder5.code) {
                                                                                        if (xresult.result[xss].compartments.length > 0) {
                                                                                            for (var xcc = 0; xcc <= xresult.result[xss].compartments.length - 1; xcc++) {
                                                                                                xscript = `insert into tbl_automatics_compartment_information 
                                                                                                (automatic_code, compartment_no, tank_code, fill_volume_actual, ist_dt) 
                                                                                                values 
                                                                                                ('${xresult.result[xss].ref1}', '${xresult.result[xss].compartments[xcc].compartment_no}', 
                                                                                                '${xresult.result[xss].product}', ${xresult.result[xss].compartments[xcc].liter}, '${moment().format('YYYY-MM-DD HH:mm:ss')}');`

                                                                                                var db_createorder6 = await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                                                console.log('insert compartment,', xresult.result[xss].ref1, ',', xresult.result[xss].ref2, ',', xresult.result[xss].compartments[xcc].compartment_no);
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                }
                                                                                else {
                                                                                    //debugger
                                                                                    if (xresult.result[xss].adjusted_liter <= 0 && xresult.result[xss].requested_liter > 0) {
                                                                                        console.log('wait next time for get new veh_type_code,', xresult.result[xss].ref1, ',', xresult.result[xss].ref2);
                                                                                    }
                                                                                    else {
                                                                                        xscript = `update tbl_automatics_tanks_information 
                                                                                        set result = 'Need Qty = 0' 
                                                                                        where automatic_code = '${xresult.result[xss].ref1}' 
                                                                                        and ptrl_code = '${xresult.result[xss].ref2}' 
                                                                                        and tank_code = '${xresult.result[xss].product}';`

                                                                                        console.log('Need Qty = 0,', xresult.result[xss].ref1, ',', xresult.result[xss].ref2);
                                                                                        var db_createorder7 = await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                                    }

                                                                                }
                                                                            }
                                                                        }
                                                                        else {
                                                                            //update not success
                                                                            debugger
                                                                        }
                                                                    }
                                                                    else {
                                                                        debugger
                                                                    }
                                                                }
                                                            }
                                                            else {
                                                                debugger
                                                            }
                                                        }
                                                    }
                                                }
                                            }

                                            if (xpassed == false) {
                                                debugger
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (xruncreateorder) {
                        xscript = `select distinct tati.ptrl_code, tati.result 
                        from tbl_automatics_tanks_information tati  
                        where stock_at >= '${xdate} 00:00:00.000' 
                        and stock_at <= '${xdate} 23:59:59.000' 
                        and tati.result is not null and tati.ptrl_code = '${ptrl_code}' 
                        group by tati.ptrl_code, result order by tati.ptrl_code asc`

                        let db_createorderxx1 = await pgConn.get(xdatabase, xscript, config.connectionString());
                        if (!db_createorderxx1.code) {
                            if (db_createorderxx1.data.length > 0) {
                                for (var xcdorder = 0; xcdorder <= db_createorderxx1.data.length - 1; xcdorder++) {
                                    var sold_to = '';
                                    var ship_to = '';
                                    var cus_ref = '';
                                    var cus_date_ref = xdate;
                                    var deli_date_req = '';
                                    var deli_time_req = '';
                                    var deli_plant = '';
                                    var order_type = '';
                                    var order_group = '';
                                    var sh_cus_ref = '';

                                    xscript = `select tp.ptrl_number, tp.ptrl_lat, tp.ptrl_lon, tp.ptrl_sales_type, tp.ptrl_sales_group, 
                                    case when tp.waiting_days is null then 2 else waiting_days :: integer + 1 end as waiting_days,
                                    case when tpd.dpo_code is null then '' else tpd.dpo_code end as dpo_code, tpd.ptrl_depot_status  
                                    from tbl_petrol tp 
                                    left join tbl_petrol_depot tpd on tp.ptrl_code = tpd.ptrl_code 
                                    where tp.ptrl_code = '${db_createorderxx1.data[xcdorder].ptrl_code}' 
                                    order by ptrl_depot_status asc;`;
                                    let db_createorderxx2 = await pgConn.get(xdatabase, xscript, config.connectionString());

                                    if (!db_createorderxx2.code) {
                                        if (db_createorderxx2.data.length > 0) {
                                            sold_to = db_createorderxx2.data[0].ptrl_number;
                                            ship_to = db_createorderxx2.data[0].ptrl_number;
                                            cus_ref = db_createorderxx2.data[0].ptrl_number;
                                            order_type = db_createorderxx2.data[0].ptrl_sales_type;
                                            order_group = db_createorderxx2.data[0].ptrl_sales_group;
                                            deli_date_req = moment(xdate).add('days', parseInt(db_createorderxx2.data[0].waiting_days)).format('YYYY-MM-DD');

                                            if (db_createorderxx2.data[0].dpo_code != '') {
                                                deli_plant = db_createorderxx2.data[0].dpo_code;
                                            }

                                            xscript = `select case when LPAD((max(replace(sh_cus_ref,'AOS${moment(xdate).format('YYYYMMDD')}','')) :: integer + 1) :: text, 4, '0') is null then '0001' else 
                                            LPAD((max(replace(sh_cus_ref,'AOS${moment(xdate).format('YYYYMMDD')}','')) :: integer + 1) :: text, 4, '0') end as xmax from tbl_order where sh_cus_ref like 'AOS${moment(xdate).format('YYYYMMDD')}%'`
                                            let db_createorderxx3 = await pgConn.get(xdatabase, xscript, config.connectionString());

                                            if (!db_createorderxx3.code) {
                                                if (db_createorderxx3.data.length > 0) {
                                                    sh_cus_ref = 'AOS' + moment(xdate).format('YYYYMMDD') + db_createorderxx3.data[0].xmax;

                                                    xscript = `select case when tmst.time_code is null then 'Z01' else tmst.time_code end as time_code,
                                                    tpwd.ptrl_open_time, tpwd.ptrl_close_time
                                                    from tbl_petrol_worked_date tpwd 
                                                    left join tbl_master_time tmst on tpwd.ptrl_open_time = to_char(tmst.time_value, 'HH24:MI')
                                                    where tpwd.ptrl_code = '${db_createorderxx1.data[xcdorder].ptrl_code}'
                                                    and tpwd.wrk_date_code  = '${moment(deli_date_req).days()}' and tpwd.ptrl_worked_date_flag = '1';`

                                                    db_createorderxx3 = await pgConn.get(xdatabase, xscript, config.connectionString());
                                                    //deli_time_req
                                                    if (!db_createorderxx3.code) {
                                                        if (db_createorderxx3.data.length > 0) {
                                                            deli_time_req = db_createorderxx3.data[0].time_code;
                                                        }
                                                        else {
                                                            deli_time_req = 'Z01';
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    if (deli_plant != '' && sh_cus_ref != '') {
                                        xscript = `select tati.automatic_code ,tati.ptrl_code ,tati.ptrl_code, tati.tank_code, tati.itm_code, tati.fill_volume_actual,  tati.result 
                                        from tbl_automatics_tanks_information tati  
                                        where stock_at >= '${xdate} 00:00:00.000' 
                                        and stock_at <= '${xdate} 23:59:59.000' 
                                        and tati.result = 'wait create order.' and tati.ptrl_code = '${db_createorderxx1.data[xcdorder].ptrl_code}'`
                                        var db_createorderxx5 = await pgConn.get(xdatabase, xscript, config.connectionString());

                                        if (!db_createorderxx5.code) {
                                            var xresult = [];
                                            for (var xrds = 0; xrds <= db_createorderxx5.data.length - 1; xrds++) {

                                                xscript = `update tbl_automatics_tanks_information set result = 'create order complete.',
                                                    sh_cus_ref = '${sh_cus_ref}' 
                                                    where automatic_code =  '${db_createorderxx5.data[xrds].automatic_code}';`
                                                var db_createorderxx7 = await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                console.log('update tbl_automatics_tanks_information,', db_createorderxx5.data[xrds].automatic_code, !db_createorderxx7.code);

                                                xscript = `update tbl_automatics_sales_previous_information 
                                                    set sh_cus_ref = '${sh_cus_ref}' 
                                                    where ptrl_code = '${db_createorderxx5.data[xrds].ptrl_code}' 
                                                    and tank_code = '${db_createorderxx5.data[xrds].tank_code}' 
                                                    and itm_code = '${db_createorderxx5.data[xrds].itm_code}' 
                                                    and sale_at_previous = '${xdate} 00:00:00.000';`
                                                var db_createorderxx8 = await pgConn.execute(xdatabase, xscript, config.connectionString());

                                                xresult.push({
                                                    ptrl_code: ptrl_code,
                                                    tank_code: db_createorderxx5.data[xrds].tank_code,
                                                    itm_code: db_createorderxx5.data[xrds].itm_code,
                                                    stock: db_createorderxx5.data[xrds].fill_volume_actual,
                                                    daysale: db_createorderxx5.data[xrds].fill_volume_actual,
                                                    target_stock: db_createorderxx5.data[xrds].fill_volume_actual,
                                                    need_qty: db_createorderxx5.data[xrds].fill_volume_actual,
                                                    reason: ""
                                                });

                                                if (xrds == db_createorderxx5.data.length - 1) {
                                                    var automatic_code = 'auto-' + moment().format('x');
                                                    //insert to table auto order.
                                                    xscript = `insert into tbl_automatics_orders 
                                                            (automatic_code, ptrl_code, ist_dt, result, automatic_status) values 
                                                            ('${automatic_code}', '${db_createorderxx1.data[xcdorder].ptrl_code}', 
                                                            '${moment(xdate).format('YYYY-MM-DD 00:00:00')}', 'complete.', '1')`

                                                    var db_createorderxx9 = await pgConn.execute(xdatabase, xscript, config.connectionString());
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
                                            }
                                        }
                                    }
                                    else {
                                        //update no config depo.
                                    }

                                }
                            }
                            else {
                                if (xruncreateorder) {
                                    xscript = `select distinct tati.ptrl_code, tati.result 
                                    from tbl_automatics_tanks_information tati  
                                    where stock_at >= '${xdate} 00:00:00.000' 
                                    and stock_at <= '${xdate} 23:59:59.000' 
                                    and tati.result = 'create order complete.' and tati.ptrl_code = '${ptrl_code}'
                                    group by tati.ptrl_code, result order by tati.ptrl_code asc`

                                    let db_createorderxx1 = await pgConn.get(xdatabase, xscript, config.connectionString());
                                    if (!db_createorderxx1.code) {
                                        if (db_createorderxx1.data.length > 0) {
                                            xscript = `select tati.automatic_code ,tati.ptrl_code ,tati.ptrl_code, tati.tank_code, tati.itm_code, tati.fill_volume_actual,  tati.result 
                                            from tbl_automatics_tanks_information tati  
                                            where stock_at >= '${xdate} 00:00:00.000' 
                                            and stock_at <= '${xdate} 23:59:59.000' 
                                            and tati.result = 'create order complete.' and tati.ptrl_code = '${ptrl_code}'`
                                            var db_createorderxx5 = await pgConn.get(xdatabase, xscript, config.connectionString());

                                            if (!db_createorderxx5.code) {
                                                var xresult = [];
                                                for (var xrds = 0; xrds <= db_createorderxx5.data.length - 1; xrds++) {
                                                    xresult.push({
                                                        ptrl_code: ptrl_code,
                                                        tank_code: db_createorderxx5.data[xrds].tank_code,
                                                        itm_code: db_createorderxx5.data[xrds].itm_code,
                                                        stock: db_createorderxx5.data[xrds].fill_volume_actual,
                                                        daysale: db_createorderxx5.data[xrds].fill_volume_actual,
                                                        target_stock: db_createorderxx5.data[xrds].fill_volume_actual,
                                                        need_qty: db_createorderxx5.data[xrds].fill_volume_actual,
                                                        reason: ""
                                                    });

                                                    if (xrds == db_createorderxx5.data.length - 1) {
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
                                                }
                                            }
                                        }
                                        else {
                                            xscript = `select tbl_petrol.ptrl_code ,tbl_petrol_tank.ptrl_tank_code, tbl_petrol_tank.itm_code ,coverage_days, tnk_capacity, tnk_target, tnk_deadstock, tnk_safety_factor 
                                            from tbl_petrol left join tbl_petrol_tank on tbl_petrol.ptrl_code = tbl_petrol_tank.ptrl_code 
                                            where tbl_petrol.ptrl_code = '${ptrl_code}';`

                                            let tbl_temporary5 = await pgConn.get(
                                                dbPrefix + lic_code,
                                                xscript,
                                                config.connectionString(),
                                            );

                                            if (!tbl_temporary5.code) {
                                                xresult = [];
                                                for (let xi2 = 0; xi2 <= tbl_temporary5.data.length - 1; xi2++) {
                                                    xresult.push({
                                                        ptrl_code: ptrl_code,
                                                        tank_code: tbl_temporary5.data[xi2].ptrl_tank_code,
                                                        itm_code: tbl_temporary5.data[xi2].itm_code,
                                                        stock: 0,
                                                        daysale: 0,
                                                        target_stock: 0,
                                                        need_qty: 0,
                                                        reason: "Stock is incorrect."
                                                    });

                                                    if (xi2 == tbl_temporary5.data.length - 1) {
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
                                                }
                                            }
                                            else {
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
                                                return
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                else {
                    var xruncreateorder = true;
                    xdate = moment().add('days', -1).format('YYYY-MM-DD');

                    if (xruncreateorder) {
                        xscript = `select distinct tati.ptrl_code, tati.result 
                        from tbl_automatics_tanks_information tati  
                        where stock_at >= '${xdate} 00:00:00.000' 
                        and stock_at <= '${xdate} 23:59:59.000' 
                        and tati.result = 'create order complete.' and tati.ptrl_code = '${ptrl_code}'
                        group by tati.ptrl_code, result order by tati.ptrl_code asc`

                        let db_createorderxx1 = await pgConn.get(xdatabase, xscript, config.connectionString());
                        if (!db_createorderxx1.code) {
                            if (db_createorderxx1.data.length > 0) {
                                xscript = `select tati.automatic_code ,tati.ptrl_code ,tati.ptrl_code, tati.tank_code, tati.itm_code, tati.fill_volume_actual,  tati.result 
                                from tbl_automatics_tanks_information tati  
                                where stock_at >= '${xdate} 00:00:00.000' 
                                and stock_at <= '${xdate} 23:59:59.000' 
                                and tati.result = 'create order complete.' and tati.ptrl_code = '${ptrl_code}'`
                                var db_createorderxx5 = await pgConn.get(xdatabase, xscript, config.connectionString());

                                if (!db_createorderxx5.code) {
                                    var xresult = [];
                                    for (var xrds = 0; xrds <= db_createorderxx5.data.length - 1; xrds++) {
                                        xresult.push({
                                            ptrl_code: ptrl_code,
                                            tank_code: db_createorderxx5.data[xrds].tank_code,
                                            itm_code: db_createorderxx5.data[xrds].itm_code,
                                            stock: db_createorderxx5.data[xrds].fill_volume_actual,
                                            daysale: db_createorderxx5.data[xrds].fill_volume_actual,
                                            target_stock: db_createorderxx5.data[xrds].fill_volume_actual,
                                            need_qty: db_createorderxx5.data[xrds].fill_volume_actual,
                                            reason: ""
                                        });

                                        if (xrds == db_createorderxx5.data.length - 1) {
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
                                    }
                                }
                            }
                            else {
                                xscript = `select tbl_petrol.ptrl_code ,tbl_petrol_tank.ptrl_tank_code, tbl_petrol_tank.itm_code ,coverage_days, tnk_capacity, tnk_target, tnk_deadstock, tnk_safety_factor 
                                from tbl_petrol left join tbl_petrol_tank on tbl_petrol.ptrl_code = tbl_petrol_tank.ptrl_code 
                                where tbl_petrol.ptrl_code = '${ptrl_code}';`

                                let tbl_temporary5 = await pgConn.get(
                                    dbPrefix + lic_code,
                                    xscript,
                                    config.connectionString(),
                                );

                                if (!tbl_temporary5.code) {
                                    xresult = [];
                                    for (let xi2 = 0; xi2 <= tbl_temporary5.data.length - 1; xi2++) {
                                        xresult.push({
                                            ptrl_code: ptrl_code,
                                            tank_code: tbl_temporary5.data[xi2].ptrl_tank_code,
                                            itm_code: tbl_temporary5.data[xi2].itm_code,
                                            stock: 0,
                                            daysale: 0,
                                            target_stock: 0,
                                            need_qty: 0,
                                            reason: "Stock is incorrect."
                                        });

                                        if (xi2 == tbl_temporary5.data.length - 1) {
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
                                    }
                                }
                                else {
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
                                    return
                                }
                            }
                        }
                    }
                }
            }
            else {
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
                return
            }
        }

    })().catch(async (err) => {
        console.error('getAutoCalculateOrderInformation', err);
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
    });
};

exports.getAutoCalculateOrderInformationV2 = async (req, res, next) => {
    var xresult = [];

    return (async () => {
        let lic_code = req.header("lic_code");
        let {
            ptrl_code,
            action
        } = req.body[0] || {};
        if (ptrl_code == undefined || action == undefined) {
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
        else {
            var veh_type_code = '';
            var xdatabase = dbPrefix + lic_code;
            var xdate = moment().add('days', -1).format('YYYY-MM-DD');
            xscript = `select distinct shipto_no, ptr.ptrl_code, ptr.ptrl_sitecode, ptr.ptrl_number, ptr.stock_provious_days, 
            case when ptr.waiting_days is null then 2 else waiting_days :: integer + 1 end as waiting_days, ptr.coverage_days 
            from tbl_order_eodtank eod
            inner join tbl_petrol ptr on eod.shipto_no = ptr.ptrl_sitecode  
            where date_at >= '${xdate} 00:00:00.000' and date_at <= '${xdate} 23:59:59.000' 
            and ptr.ptrl_code = '${ptrl_code}' 
            order by shipto_no asc limit 1;`

            let db_temporary = await pgConn.get(
                xdatabase,
                xscript,
                config.connectionString(),
            );

            if (!db_temporary.code) {

                if (db_temporary.data.length == 0) {
                    xdate = moment().add('days', -2).format('YYYY-MM-DD');

                    var xscript = `select distinct shipto_no, ptr.ptrl_code, ptr.ptrl_sitecode, ptr.ptrl_number, ptr.stock_provious_days, 
                    case when ptr.waiting_days is null then 2 else waiting_days :: integer + 1 end as waiting_days, ptr.coverage_days 
                    from tbl_order_eodtank eod
                    inner join tbl_petrol ptr on eod.shipto_no = ptr.ptrl_sitecode  
                    where date_at >= '${xdate} 00:00:00.000' and date_at <= '${xdate} 23:59:59.000' 
                    and ptr.ptrl_code = '${ptrl_code}' 
                    order by shipto_no asc limit 1;`

                    db_temporary = await pgConn.get(
                        dbPrefix + lic_code,
                        xscript,
                        config.connectionString(),
                    );

                    if (db_temporary.code) {
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
                        return;
                    }
                }

                //เช็กส่วนของ Master
                if (db_temporary.data.length > 0) {
                    const xrunstock = true;
                    const xrunsaleprovious = true;
                    const xrunfillmanualorder = true;
                    const xrunautoorder = true;
                    const xruncalculateorder = true;
                    const xruncreateorder = true;

                    //check stock. and fill volume
                    if (xrunstock) {
                        for (var xdb = 0; xdb <= db_temporary.data.length - 1; xdb++) {
                            var shipto_no = db_temporary.data[xdb].shipto_no;
                            console.log("calculate stock:", shipto_no, xdb, '/', db_temporary.data.length - 1, moment().format('YYYY-MM-DD HH:mm:ss'));

                            xscript = `select ptr.ptrl_code, ptank.ptrl_tank_code , ptr.ptrl_number, eod.tank_no as eod_tnk_number, ptank.tnk_number, 
                            case when eod.tank_end = 0 then eod.tank_start else eod.tank_end end as stock, itm.itm_code, itm.itm_desc,
                            ptank.tnk_capacity, ptank.tnk_target, ptank.tnk_deadstock, ptank.tnk_safety_factor  
                            from tbl_order_eodtank eod 
                            inner join tbl_petrol ptr on eod.shipto_no  = ptr.ptrl_sitecode 
                            inner join tbl_petrol_tank ptank on ptr.ptrl_code = ptank.ptrl_code 
                            inner join tbl_item itm on ptank.itm_code = itm.itm_code 
                            and eod.tank_no = ptank.tnk_number 
                            where date_at >= '${xdate} 00:00:00.000' 
                            and date_at <= '${xdate} 23:59:59.000' and eod.shipto_no = '${shipto_no}' 
                            and eod.tank_start > 0 and eod.tank_end > 0 
                            and ptank.ptrl_tank_flag = '1'
                            order by eod.tank_no asc;`

                            let db_temporary2 = await pgConn.get(xdatabase, xscript, config.connectionString());
                            if (db_temporary2.data.length > 0) {
                                for (var xdb2 = 0; xdb2 <= db_temporary2.data.length - 1; xdb2++) {
                                    ptrl_code = db_temporary2.data[xdb2].ptrl_code;
                                    var automatic_code = 'auto-' + moment().format('x');
                                    var tank_code = db_temporary2.data[xdb2].ptrl_tank_code;
                                    var itm_code = db_temporary2.data[xdb2].itm_code;
                                    var stock = db_temporary2.data[xdb2].stock;
                                    var stock_at = xdate;
                                    var ist_dt = moment().format('YYYY-MM-DD HH:mm:ss');
                                    var tnk_capacity = db_temporary2.data[xdb2].tnk_capacity;
                                    var tnk_target = db_temporary2.data[xdb2].tnk_target;
                                    var tnk_deadstock = db_temporary2.data[xdb2].tnk_deadstock;
                                    var tnk_safety_factor = db_temporary2.data[xdb2].tnk_safety_factor;

                                    //insert to tank order information
                                    if (xdb2 == 0) {
                                        //clear table
                                        xscript = `delete from tbl_automatics_tanks_information where ptrl_code = '${ptrl_code}' 
                                        and stock_at >= '${xdate} 00:00:00.000' and stock_at <= '${xdate} 23:59:59.000';`;
                                        await pgConn.execute(xdatabase, xscript, config.connectionString());
                                    }

                                    xscript = `insert into tbl_automatics_tanks_information 
                                    (automatic_code, ptrl_code, tank_code, itm_code, stock, stock_at, ist_dt, tnk_capacity, tnk_target, tnk_deadstock, tnk_safety_factor) values 
                                    ('${automatic_code}', '${ptrl_code}', '${tank_code}', '${itm_code}', ${stock}, '${stock_at}', '${ist_dt}', 
                                    ${tnk_capacity}, ${tnk_target}, ${tnk_deadstock}, ${tnk_safety_factor});`

                                    let db_temporary3 = await pgConn.execute(xdatabase, xscript, config.connectionString());
                                    console.log("tbl_automatics_tanks_information:", shipto_no, ':', !db_temporary3.code, xdb, '/', db_temporary.data.length - 1, moment().format('YYYY-MM-DD HH:mm:ss'));
                                }
                            }
                        }
                    }

                    //check sale of days * 1
                    if (xrunsaleprovious) {
                        //petrol
                        for (var xsale = 0; xsale <= db_temporary.data.length - 1; xsale++) {
                            var shipto_no = db_temporary.data[xsale].shipto_no;
                            var xdate_previous = [];
                            var xdate_temporary = '';

                            for (var xbsxx = 0; xbsxx <= parseInt(db_temporary.data[xsale].waiting_days) - 1; xbsxx++) {
                                var xdaterunning = moment(xdate).add('days', (xbsxx + 1)).format('YYYY-MM-DD');

                                if (xbsxx == 0) {
                                    for (var xprevious = 0; xprevious <= (8 - 1); xprevious++) {
                                        if (xprevious != 0) {
                                            //debugger
                                            var xreduce = (xprevious * 7 * -1)
                                            xdate_temporary = moment(xdaterunning).add('days', xreduce).format('YYYY-MM-DD');
                                        }
                                        else {
                                            if (xbsxx == 0) {
                                                xdate_temporary = moment(xdate).format('YYYY-MM-DD');
                                            }
                                            else {
                                                xdate_temporary = moment(xdaterunning).format('YYYY-MM-DD');
                                            }
                                        }

                                        xdate_previous.push(xdate_temporary);
                                    }
                                }
                                else {
                                    for (var xprevious = 0; xprevious <= (7 - 1); xprevious++) {
                                        if (xprevious != 0) {
                                            //debugger
                                            var xreduce = (xprevious * 7 * -1)
                                            xdate_temporary = moment(xdaterunning).add('days', xreduce).format('YYYY-MM-DD');
                                        }
                                        else {
                                            xdate_temporary = moment(xdaterunning).format('YYYY-MM-DD');
                                        }

                                        xdate_previous.push(xdate_temporary);
                                    }
                                }
                            }

                            var temporary_tank = '';
                            var automatic_code = 'auto-' + moment().format('x');
                            for (var xdatesale2 = 0; xdatesale2 <= xdate_previous.length - 1; xdatesale2++) {
                                console.log("calculate sale provious:", shipto_no, xsale, '/', db_temporary.data.length - 1, moment(xdate_previous[xdatesale2]).format('YYYY-MM-DD HH:mm:ss'));
                                //delete information.
                                temporary_tank = '';
                                if (xdatesale2 == 0) {
                                    xscript = `delete from tbl_automatics_sales_previous_information 
                                    where sale_at_previous = '${xdate_previous[xdatesale2]}' 
                                    and ptrl_code in (select ptrl_code from tbl_petrol where ptrl_sitecode  = '${shipto_no}');`;
                                    await pgConn.execute(xdatabase, xscript, config.connectionString());
                                }

                                xscript = `select ptr.ptrl_code, eod.shipto_no, eod.tank_no, ptank.tnk_number, eod.meter_start, eod.meter_end, 
                                ptank.ptrl_tank_code, ptank.itm_code  
                                from tbl_order_eodmeter eod 
                                inner join tbl_petrol ptr on eod.shipto_no = ptr.ptrl_sitecode  
                                left join tbl_petrol_tank ptank on ptr.ptrl_code = ptank.ptrl_code 
                                and eod.tank_no = ptank.tnk_number
                                where buy_date >= '${xdate_previous[xdatesale2]} 00:00:00.000' 
                                and buy_date <= '${xdate_previous[xdatesale2]} 23:59:59.000' and ptank.ptrl_tank_flag = '1' and eod.shipto_no = '${shipto_no}' order by eod.tank_no, eod.ist_dt asc;`

                                let db_saleprovious = await pgConn.get(xdatabase, xscript, config.connectionString());
                                if (!db_saleprovious.code) {
                                    if (db_saleprovious.data.length > 0) {
                                        //calculate sale daily
                                        var xliter = 0;
                                        var xtempliter = 0;
                                        var tank_code = '';
                                        var itm_code = '';
                                        for (var xvalue = 0; xvalue <= db_saleprovious.data.length - 1; xvalue++) {
                                            console.log('shipto_no:', shipto_no, 'temporary_tank:', temporary_tank);

                                            if (temporary_tank != db_saleprovious.data[xvalue].tnk_number) {
                                                if (temporary_tank == '') {
                                                    ptrl_code = db_saleprovious.data[xvalue].ptrl_code;
                                                    tank_code = db_saleprovious.data[xvalue].ptrl_tank_code;
                                                    itm_code = db_saleprovious.data[xvalue].itm_code;
                                                    temporary_tank = db_saleprovious.data[xvalue].tnk_number;
                                                    xliter = 0;
                                                    xtempliter = 0;

                                                    if (db_saleprovious.data[xvalue].meter_start > db_saleprovious.data[xvalue].meter_end) {
                                                        try {
                                                            xtempliter = parseFloat(db_saleprovious.data[xvalue].meter_end);
                                                            xliter += xtempliter;
                                                        }
                                                        catch (ex) { }
                                                    }
                                                    else {
                                                        try {
                                                            xtempliter = parseFloat(db_saleprovious.data[xvalue].meter_end) - parseFloat(db_saleprovious.data[xvalue].meter_start);
                                                            xliter += xtempliter;
                                                        }
                                                        catch (ex) { }
                                                    }
                                                }
                                                else {
                                                    // insert before information.
                                                    var sale_previous = xliter;
                                                    var sale_at_previous = xdate_previous[xdatesale2];
                                                    var ist_dt = moment().format('YYYY-MM-DD HH:mm:ss');

                                                    switch (xdatesale2) {
                                                        case 0:
                                                            xscript = `insert into tbl_automatics_sales_previous_information 
                                                            (automatic_code, ptrl_code, tank_code, itm_code, sale_previous, sale_at_previous, ist_dt) values 
                                                            ('${automatic_code}', '${ptrl_code}', '${tank_code}', '${itm_code}', ${sale_previous}, '${sale_at_previous}', '${ist_dt}');`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 1:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous1 = ${sale_previous}, sale_at_previous1 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 2:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous2 = ${sale_previous}, sale_at_previous2 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 3:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous3 = ${sale_previous}, sale_at_previous3 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 4:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous4 = ${sale_previous}, sale_at_previous4 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 5:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous5 = ${sale_previous}, sale_at_previous5 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 6:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous6 = ${sale_previous}, sale_at_previous6 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 7:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous7 = ${sale_previous}, sale_at_previous7 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 8:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous8 = ${sale_previous}, sale_at_previous8 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 9:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous9 = ${sale_previous}, sale_at_previous9 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 10:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous10 = ${sale_previous}, sale_at_previous10 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 11:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous11 = ${sale_previous}, sale_at_previous11 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 12:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous12 = ${sale_previous}, sale_at_previous12 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 13:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous13 = ${sale_previous}, sale_at_previous13 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 14:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous14 = ${sale_previous}, sale_at_previous14 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                    }

                                                    //clear information and add new information
                                                    ptrl_code = db_saleprovious.data[xvalue].ptrl_code;
                                                    tank_code = db_saleprovious.data[xvalue].ptrl_tank_code;
                                                    itm_code = db_saleprovious.data[xvalue].itm_code;
                                                    temporary_tank = db_saleprovious.data[xvalue].tnk_number;
                                                    xliter = 0;
                                                    xtempliter = 0;

                                                    if (db_saleprovious.data[xvalue].meter_start > db_saleprovious.data[xvalue].meter_end) {
                                                        try {
                                                            xtempliter = parseFloat(db_saleprovious.data[xvalue].meter_end);
                                                            xliter += xtempliter;
                                                        }
                                                        catch (ex) { }
                                                    }
                                                    else {
                                                        try {
                                                            xtempliter = parseFloat(db_saleprovious.data[xvalue].meter_end) - parseFloat(db_saleprovious.data[xvalue].meter_start);
                                                            xliter += xtempliter;
                                                        }
                                                        catch (ex) { }
                                                    }

                                                    if (xvalue == db_saleprovious.data.length - 1) {
                                                        sale_previous = xliter;
                                                        switch (xdatesale2) {
                                                            case 0:
                                                                xscript = `insert into tbl_automatics_sales_previous_information 
                                                                (automatic_code, ptrl_code, tank_code, itm_code, sale_previous, sale_at_previous, ist_dt) values 
                                                                ('${automatic_code}', '${ptrl_code}', '${tank_code}', '${itm_code}', ${sale_previous}, '${sale_at_previous}', '${ist_dt}');`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 1:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous1 = ${sale_previous}, sale_at_previous1 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 2:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous2 = ${sale_previous}, sale_at_previous2 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 3:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous3 = ${sale_previous}, sale_at_previous3 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 4:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous4 = ${sale_previous}, sale_at_previous4 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 5:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous5 = ${sale_previous}, sale_at_previous5 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 6:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous6 = ${sale_previous}, sale_at_previous6 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 7:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous7 = ${sale_previous}, sale_at_previous7 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 8:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous8 = ${sale_previous}, sale_at_previous8 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 9:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous9 = ${sale_previous}, sale_at_previous9 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 10:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous10 = ${sale_previous}, sale_at_previous10 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 11:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous11 = ${sale_previous}, sale_at_previous11 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 12:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous12 = ${sale_previous}, sale_at_previous12 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 13:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous13 = ${sale_previous}, sale_at_previous13 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                            case 14:
                                                                xscript = `update tbl_automatics_sales_previous_information 
                                                                set sale_previous14 = ${sale_previous}, sale_at_previous14 = '${sale_at_previous}' 
                                                                where automatic_code = '${automatic_code}' 
                                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                break;
                                                        }
                                                    }
                                                }

                                            }
                                            else {
                                                if (db_saleprovious.data[xvalue].meter_start > db_saleprovious.data[xvalue].meter_end) {
                                                    try {
                                                        xtempliter = parseFloat(db_saleprovious.data[xvalue].meter_end);
                                                        xliter += xtempliter;
                                                    }
                                                    catch (ex) { }
                                                }
                                                else {
                                                    try {
                                                        xtempliter = parseFloat(db_saleprovious.data[xvalue].meter_end) - parseFloat(db_saleprovious.data[xvalue].meter_start);
                                                        xliter += xtempliter;
                                                    }
                                                    catch (ex) { }
                                                }

                                                if (xvalue == db_saleprovious.data.length - 1) {
                                                    sale_previous = xliter;
                                                    switch (xdatesale2) {
                                                        case 0:
                                                            xscript = `insert into tbl_automatics_sales_previous_information 
                                                            (automatic_code, ptrl_code, tank_code, itm_code, sale_previous, sale_at_previous, ist_dt) values 
                                                            ('${automatic_code}', '${ptrl_code}', '${tank_code}', '${itm_code}', ${sale_previous}, '${sale_at_previous}', '${ist_dt}');`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 1:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous1 = ${sale_previous}, sale_at_previous1 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 2:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous2 = ${sale_previous}, sale_at_previous2 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 3:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous3 = ${sale_previous}, sale_at_previous3 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 4:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous4 = ${sale_previous}, sale_at_previous4 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 5:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous5 = ${sale_previous}, sale_at_previous5 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 6:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous6 = ${sale_previous}, sale_at_previous6 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 7:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous7 = ${sale_previous}, sale_at_previous7 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 8:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous8 = ${sale_previous}, sale_at_previous8 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 9:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous9 = ${sale_previous}, sale_at_previous9 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 10:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous10 = ${sale_previous}, sale_at_previous10 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 11:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous11 = ${sale_previous}, sale_at_previous11 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 12:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous12 = ${sale_previous}, sale_at_previous12 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 13:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous13 = ${sale_previous}, sale_at_previous13 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                        case 14:
                                                            xscript = `update tbl_automatics_sales_previous_information 
                                                            set sale_previous14 = ${sale_previous}, sale_at_previous14 = '${sale_at_previous}' 
                                                            where automatic_code = '${automatic_code}' 
                                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                            break;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }


                        }
                    }

                    //find auto order. (need Qty)
                    if (xrunautoorder) {
                        for (var xautoorder = 0; xautoorder <= db_temporary.data.length - 1; xautoorder++) {
                            var shipto_no = db_temporary.data[xautoorder].shipto_no;
                            var coverage_days = db_temporary.data[xautoorder].coverage_days;
                            console.log("calculate auto order:", shipto_no, xautoorder, '/', db_temporary.data.length - 1, moment().format('YYYY-MM-DD HH:mm:ss'));

                            xscript = `select automatic_code, ptrl_code, tank_code, itm_code, stock, stock_at, ist_dt, mdf_dt, 
                            case when fill_volume is null then 0 else fill_volume end as fill_volume, fill_volume_after, tnk_capacity, tnk_target, tnk_deadstock, (tnk_safety_factor / 100) as tnk_safety_factor 
                            from tbl_automatics_tanks_information where ptrl_code in (select ptrl_code from tbl_petrol where ptrl_sitecode  = '${shipto_no}')  
                            and stock_at >= '${xdate} 00:00:00.000' and stock_at <= '${xdate} 23:59:59.000';`;
                            let db_autoorder1 = await pgConn.get(xdatabase, xscript, config.connectionString());

                            if (!db_autoorder1.code) {
                                for (var xcreate = 0; xcreate <= db_autoorder1.data.length - 1; xcreate++) {
                                    ptrl_code = db_autoorder1.data[xcreate].ptrl_code;
                                    var automatic_code = db_autoorder1.data[xcreate].automatic_code;
                                    var tank_code = db_autoorder1.data[xcreate].tank_code;
                                    var xstock = 0.0;
                                    var xtargetstock = 0.0;
                                    var xtargetorder = 0.0;
                                    var xunpumplevel = parseInt(db_autoorder1.data[xcreate].tnk_deadstock);
                                    var xtnk_safety_factor = parseFloat(db_autoorder1.data[xcreate].tnk_safety_factor);
                                    var xtnk_capacity = parseFloat(db_autoorder1.data[xcreate].tnk_capacity);
                                    var xtnk_target_config = parseFloat(db_autoorder1.data[xcreate].tnk_target);
                                    var xdaysale = 0.0;
                                    var xneedqty = 0.0;

                                    xscript = `select automatic_code, ptrl_code, tank_code, itm_code,
                                    ((sale_previous1 + sale_previous2 + sale_previous3 + sale_previous4 + sale_previous5 + sale_previous6 + sale_previous7 +
                                    sale_previous8 + sale_previous9 + sale_previous10 + sale_previous11 + sale_previous12 + sale_previous13 + sale_previous14) 
                                    / (sale_average1 + sale_average2 + sale_average3 + sale_average4 + sale_average5 + sale_average6 + sale_average7 + 
                                    sale_average8 + sale_average9 + sale_average10 + sale_average11 + sale_average12 + sale_average13 + sale_average14)) * ${xtnk_safety_factor}
                                    as daysales, case when sale_previous is null then 0 else sale_previous end as sale_previous 

                                    from 
                                    (select automatic_code, ptrl_code, tank_code,
                                    itm_code, sale_previous, sale_at_previous, 
                                    case when sale_previous1 is null then 0 else sale_previous1 end as sale_previous1,
                                    case when sale_previous2 is null then 0 else sale_previous2 end as sale_previous2,
                                    case when sale_previous3 is null then 0 else sale_previous3 end as sale_previous3,
                                    case when sale_previous4 is null then 0 else sale_previous4 end as sale_previous4,
                                    case when sale_previous5 is null then 0 else sale_previous5 end as sale_previous5,
                                    case when sale_previous6 is null then 0 else sale_previous6 end as sale_previous6,
                                    case when sale_previous7 is null then 0 else sale_previous7 end as sale_previous7,
                                    case when sale_previous8 is null then 0 else sale_previous8 end as sale_previous8,
                                    case when sale_previous9 is null then 0 else sale_previous9 end as sale_previous9,
                                    case when sale_previous10 is null then 0 else sale_previous10 end as sale_previous10,
                                    case when sale_previous11 is null then 0 else sale_previous11 end as sale_previous11,
                                    case when sale_previous12 is null then 0 else sale_previous12 end as sale_previous12,
                                    case when sale_previous13 is null then 0 else sale_previous13 end as sale_previous13,
                                    case when sale_previous14 is null then 0 else sale_previous14 end as sale_previous14,
                                    case when sale_previous1 is null then 0 else 1 end as sale_average1,
                                    case when sale_previous2 is null then 0 else 1 end as sale_average2,
                                    case when sale_previous3 is null then 0 else 1 end as sale_average3,
                                    case when sale_previous4 is null then 0 else 1 end as sale_average4,
                                    case when sale_previous5 is null then 0 else 1 end as sale_average5,
                                    case when sale_previous6 is null then 0 else 1 end as sale_average6,
                                    case when sale_previous7 is null then 0 else 1 end as sale_average7,
                                    case when sale_previous8 is null then 0 else 1 end as sale_average8,
                                    case when sale_previous9 is null then 0 else 1 end as sale_average9,
                                    case when sale_previous10 is null then 0 else 1 end as sale_average10,
                                    case when sale_previous11 is null then 0 else 1 end as sale_average11,
                                    case when sale_previous12 is null then 0 else 1 end as sale_average12, 
                                    case when sale_previous13 is null then 0 else 1 end as sale_average13,
                                    case when sale_previous14 is null then 0 else 1 end as sale_average14 
                                    from tbl_automatics_sales_previous_information salepr
                                    where salepr.ptrl_code = '${ptrl_code}' and salepr.tank_code = '${tank_code}' 
                                    and sale_at_previous = '${xdate}') xtable`

                                    let db_autoorder2 = await pgConn.get(xdatabase, xscript, config.connectionString());
                                    if (!db_autoorder2.code) {
                                        if (db_autoorder2.data.length > 0) {
                                            if (parseFloat(db_autoorder2.data[0].daysales) <= 0.0) {
                                                xdaysale = parseFloat(db_autoorder2.data[0].sale_previous);
                                            }
                                            else {
                                                xdaysale = parseFloat(db_autoorder2.data[0].daysales);
                                            }
                                        }
                                    }

                                    if (xdaysale > 0) {
                                        try {
                                            xstock = parseFloat(db_autoorder1.data[xcreate].stock) + parseFloat(db_autoorder1.data[xcreate].fill_volume);
                                            xtargetstock = (xdaysale * coverage_days) + xunpumplevel;
                                            xneedqty = Math.max(0, xtargetstock - xstock);
                                            xtargetorder = (xdaysale) + xunpumplevel;
                                        }
                                        catch (ex) {
                                            debugger
                                        }

                                        if (xneedqty <= (xtnk_capacity - xstock)) {
                                            //ถ้า NeedQty น้อยกว่า Threshold → ไม่ต้องสั่ง และต้องตรวจ
                                            //insert result and targetstock
                                            xscript = `update tbl_automatics_tanks_information set fill_volume_after = ${xneedqty},
                                            tnk_target = ${xtargetorder}, 
                                            result = 'Need Qty <= (Tank Capacity - Stock)' 
                                            where automatic_code = '${automatic_code}' 
                                            and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                            await pgConn.execute(xdatabase, xscript, config.connectionString());
                                        }
                                        else {
                                            //create order
                                            if (xtargetorder > xtnk_target_config) {
                                                xtargetorder = xtnk_target_config;
                                            }

                                            if (xneedqty > 100000) {
                                                xscript = `update tbl_automatics_tanks_information set fill_volume_after = ${xtargetorder},
                                                tnk_target = ${xtargetorder}, 
                                                result = 'Need Qty is incorrect' 
                                                where automatic_code = '${automatic_code}' 
                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                            }
                                            else {
                                                xscript = `update tbl_automatics_tanks_information set fill_volume_after = ${xtargetorder},
                                                tnk_target = ${xtargetorder}, 
                                                result = 'correct' 
                                                where automatic_code = '${automatic_code}' 
                                                and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                                await pgConn.execute(xdatabase, xscript, config.connectionString());
                                            }
                                        }
                                    } else {
                                        //save logs for report
                                        xscript = `update tbl_automatics_tanks_information set fill_volume_after = 0,
                                        tnk_target = 0, 
                                        result = 'DaySales is empty' 
                                        where automatic_code = '${automatic_code}' 
                                        and ptrl_code = '${ptrl_code}' and tank_code = '${tank_code}';`
                                        await pgConn.execute(xdatabase, xscript, config.connectionString());
                                    }
                                }
                            }

                        }
                    }

                    //calculate auto order. correct
                    if (xruncalculateorder) {
                        xscript = `select tati.ptrl_code, sum(tati.fill_volume_after) as fill_volume_after, tati.result 
                        from tbl_automatics_tanks_information tati  
                        where stock_at >= '${xdate} 00:00:00.000' 
                        and stock_at <= '${xdate} 23:59:59.000' and tati.ptrl_code = '${ptrl_code}' 
                        and tati.result = 'correct' group by tati.ptrl_code, result 
                        order by tati.ptrl_code asc`

                        let db_createorder1 = await pgConn.get(xdatabase, xscript, config.connectionString());
                        if (!db_createorder1.code) {
                            if (db_createorder1.data.length > 0) {
                                for (var xcorder = 0; xcorder <= db_createorder1.data.length - 1; xcorder++) {
                                    veh_type_code = '';
                                    //get vehicle type
                                    xscript = `select 0 as level,tpvt.veh_type_code, tvt.veh_type_desc ,tvt.capacity_max, tvt.capacity_min, tpvt.ptrl_vehicle_type_flag
                                    from tbl_petrol_vehicle_type tpvt 
                                    inner join tbl_vehicle_type tvt on tpvt.veh_type_code = tvt.veh_type_code 
                                    where tpvt.ptrl_code = '${db_createorder1.data[xcorder].ptrl_code}' and tpvt.ptrl_vehicle_type_flag = '1' and tvt.veh_type_flag = '1'`;

                                    let xpassed = false;
                                    let db_createorder2 = await pgConn.get(xdatabase, xscript, config.connectionString());
                                    if (!db_createorder2.code) {

                                        if (db_createorder2.data.length == 0) {
                                            xscript = `select level, veh_type_code, veh_type_desc, capacity_max, capacity_min
                                            from 
                                            ((select 0 as level,tpvt.veh_type_code, tvt.veh_type_desc ,tvt.capacity_max, tvt.capacity_min 
                                            from tbl_petrol_vehicle_type tpvt 
                                            left join tbl_vehicle_type tvt on tpvt.veh_type_code = tpvt.veh_type_code 
                                            where tpvt.ptrl_code = '${db_createorder1.data[xcorder].ptrl_code}'

                                            union

                                            select 1 as level,tvt.veh_type_code, tvt.veh_type_desc ,tvt.capacity_max, tvt.capacity_min 
                                            from tbl_vehicle_type tvt where capacity_min < ${db_createorder1.data[xcorder].fill_volume_after}  
                                            and capacity_max >= ${db_createorder1.data[xcorder].fill_volume_after}

                                            union

                                            select 2 as level,tvt.veh_type_code, tvt.veh_type_desc ,tvt.capacity_max, tvt.capacity_min 
                                            from tbl_vehicle_type tvt where tvt.veh_type_code in 
                                            (select veh_type_code from tbl_vehicle_type order by capacity_max desc limit 1))) xtable 
                                            order by xtable."level" asc`

                                            db_createorder2 = await pgConn.get(xdatabase, xscript, config.connectionString());
                                        }

                                        if (db_createorder2.data.length > 0) {
                                            for (var xpass = 0; xpass <= db_createorder2.data.length - 1; xpass++) {
                                                veh_type_code = db_createorder2.data[xpass].veh_type_code;

                                                if (xpassed == false) {
                                                    xscript = `select tvt.veh_type_code, tvt.veh_type_desc, tvt.veh_qty, tvt.capacity_min, tvt.capacity_max,
                                                    compartment_no, compartment_total, vect_compartment_level_id, veh_compartment_type_level_number, veh_compartment_type_level,
                                                    '' as automatic_code ,'' as ptrl_code, '' as tank_code, '' as itm_code 
                                                    from tbl_vehicle_type tvt
                                                    left join tbl_vehicle_type_compartment tvtim on tvt.veh_type_code = tvtim.veh_type_code 
                                                    left join tbl_vehicle_type_compartment_level tvtlev on tvtim.id = tvtlev.compartment_item_id  
                                                    where tvt.veh_type_code = '${veh_type_code}' and tvtlev.veh_compartment_type_level_flag = '1'
                                                    order by tvtim.compartment_no asc, tvtlev.veh_compartment_type_level_number asc`

                                                    let db_createorder3 = await pgConn.get(xdatabase, xscript, config.connectionString());

                                                    if (!db_createorder3.code) {
                                                        if (db_createorder3.data.length > 0) {
                                                            //get information for create order.
                                                            xscript = `select tati.automatic_code ,tati.ptrl_code, tati.tank_code, tati.itm_code, tati.fill_volume_after, tati.result 
                                                            from tbl_automatics_tanks_information tati  
                                                            where stock_at >= '${xdate} 00:00:00.000' 
                                                            and stock_at <= '${xdate} 23:59:59.000' 
                                                            and tati.result = 'correct' and tati.ptrl_code = '${db_createorder1.data[xcorder].ptrl_code}'
                                                            group by tati.automatic_code, tati.ptrl_code, tati.tank_code, tati.itm_code, tati.fill_volume_after, tati.result 
                                                            order by tati.ptrl_code asc`

                                                            let db_createorder4 = await pgConn.get(xdatabase, xscript, config.connectionString());

                                                            if (!db_createorder4.code) {
                                                                if (db_createorder4.data.length > 0) {

                                                                    var compartments = [];
                                                                    var xcompartment_no = '';
                                                                    var xlevel = [];
                                                                    for (var xcomp = 0; xcomp <= db_createorder3.data.length - 1; xcomp++) {
                                                                        if (xcompartment_no != db_createorder3.data[xcomp].compartment_no) {
                                                                            if (xcompartment_no == '') {
                                                                                xlevel = [];
                                                                                xcompartment_no = db_createorder3.data[xcomp].compartment_no;
                                                                                xlevel.push(db_createorder3.data[xcomp].veh_compartment_type_level);
                                                                            }
                                                                            else {
                                                                                compartments.push({
                                                                                    compartment_no: xcompartment_no,
                                                                                    options: xlevel
                                                                                })

                                                                                xlevel = [];
                                                                                xcompartment_no = db_createorder3.data[xcomp].compartment_no;
                                                                                xlevel.push(db_createorder3.data[xcomp].veh_compartment_type_level);

                                                                                if (xcomp == db_createorder3.data.length - 1) {
                                                                                    compartments.push({
                                                                                        compartment_no: xcompartment_no,
                                                                                        options: xlevel
                                                                                    });

                                                                                    xlevel = [];
                                                                                }
                                                                            }
                                                                        }
                                                                        else {
                                                                            xlevel.push(db_createorder3.data[xcomp].veh_compartment_type_level);

                                                                            if (xcomp == db_createorder3.data.length - 1) {
                                                                                compartments.push({
                                                                                    compartment_no: xcompartment_no,
                                                                                    options: xlevel
                                                                                });

                                                                                xlevel = [];
                                                                            }
                                                                        }
                                                                    }

                                                                    console.log(JSON.stringify(compartments));
                                                                    //debugger
                                                                    var products = [];
                                                                    for (var xprod = 0; xprod <= db_createorder4.data.length - 1; xprod++) {
                                                                        products.push(
                                                                            {
                                                                                product: db_createorder4.data[xprod].tank_code,
                                                                                liter: db_createorder4.data[xprod].fill_volume_after,
                                                                                ref1: db_createorder4.data[xprod].automatic_code,
                                                                                ref2: db_createorder4.data[xprod].ptrl_code
                                                                            })
                                                                    }

                                                                    //debugger
                                                                    var xresult = await allocateFuelDownOnly(compartments, products);
                                                                    console.log(xresult);

                                                                    if (xresult.success) {
                                                                        if (xresult.result.length > 0) {
                                                                            for (var xss = 0; xss <= xresult.result.length - 1; xss++) {
                                                                                //update fill_volume_actual
                                                                                if (xresult.result[xss].compartments.length > 0) {
                                                                                    xpassed = true;
                                                                                    xscript = `update tbl_automatics_tanks_information 
                                                                                    set fill_volume_actual = ${xresult.result[xss].adjusted_liter},
                                                                                    veh_type_code = '${veh_type_code}',
                                                                                    result = 'wait create order.' 
                                                                                    where automatic_code = '${xresult.result[xss].ref1}' 
                                                                                    and ptrl_code = '${xresult.result[xss].ref2}' 
                                                                                    and tank_code = '${xresult.result[xss].product}';`

                                                                                    console.log('update fill_volume_actual, veh_type_code,', xresult.result[xss].ref1, ',', xresult.result[xss].ref2);
                                                                                    var db_createorder5 = await pgConn.execute(xdatabase, xscript, config.connectionString());

                                                                                    if (!db_createorder5.code) {
                                                                                        if (xresult.result[xss].compartments.length > 0) {
                                                                                            for (var xcc = 0; xcc <= xresult.result[xss].compartments.length - 1; xcc++) {
                                                                                                xscript = `insert into tbl_automatics_compartment_information 
                                                                                                (automatic_code, compartment_no, tank_code, fill_volume_actual, ist_dt) 
                                                                                                values 
                                                                                                ('${xresult.result[xss].ref1}', '${xresult.result[xss].compartments[xcc].compartment_no}', 
                                                                                                '${xresult.result[xss].product}', ${xresult.result[xss].compartments[xcc].liter}, '${moment().format('YYYY-MM-DD HH:mm:ss')}');`

                                                                                                var db_createorder6 = await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                                                console.log('insert compartment,', xresult.result[xss].ref1, ',', xresult.result[xss].ref2, ',', xresult.result[xss].compartments[xcc].compartment_no);
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                }
                                                                                else {
                                                                                    //debugger
                                                                                    if (xresult.result[xss].adjusted_liter <= 0 && xresult.result[xss].requested_liter > 0) {
                                                                                        console.log('wait next time for get new veh_type_code,', xresult.result[xss].ref1, ',', xresult.result[xss].ref2);
                                                                                    }
                                                                                    else {
                                                                                        xscript = `update tbl_automatics_tanks_information 
                                                                                        set result = 'Need Qty = 0' 
                                                                                        where automatic_code = '${xresult.result[xss].ref1}' 
                                                                                        and ptrl_code = '${xresult.result[xss].ref2}' 
                                                                                        and tank_code = '${xresult.result[xss].product}';`

                                                                                        console.log('Need Qty = 0,', xresult.result[xss].ref1, ',', xresult.result[xss].ref2);
                                                                                        var db_createorder7 = await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                                                    }

                                                                                }
                                                                            }
                                                                        }
                                                                        else {
                                                                            //update not success
                                                                            debugger
                                                                        }
                                                                    }
                                                                    else {
                                                                        debugger
                                                                    }
                                                                }
                                                            }
                                                            else {
                                                                debugger
                                                            }
                                                        }
                                                    }
                                                }
                                            }

                                            if (xpassed == false) {
                                                debugger
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (xruncreateorder) {
                        xscript = `select distinct tati.ptrl_code, tati.result 
                        from tbl_automatics_tanks_information tati  
                        where stock_at >= '${xdate} 00:00:00.000' 
                        and stock_at <= '${xdate} 23:59:59.000' 
                        and tati.result is not null and tati.ptrl_code = '${ptrl_code}' 
                        group by tati.ptrl_code, result order by tati.ptrl_code asc limit 1;`

                        let db_createorderxx1 = await pgConn.get(xdatabase, xscript, config.connectionString());
                        if (!db_createorderxx1.code) {
                            if (db_createorderxx1.data.length > 0) {
                                for (var xcdorder = 0; xcdorder <= db_createorderxx1.data.length - 1; xcdorder++) {
                                    var sold_to = '';
                                    var ship_to = '';
                                    var cus_ref = '';
                                    var cus_date_ref = xdate;
                                    var deli_date_req = '';
                                    var deli_time_req = '';
                                    var deli_plant = '';
                                    var order_type = '';
                                    var order_group = '';
                                    var sh_cus_ref = '';

                                    xscript = `select tp.ptrl_number, tp.ptrl_lat, tp.ptrl_lon, tp.ptrl_sales_type, tp.ptrl_sales_group, 
                                    case when tp.waiting_days is null then 2 else waiting_days :: integer + 1 end as waiting_days,
                                    case when tpd.dpo_code is null then '' else tpd.dpo_code end as dpo_code, tpd.ptrl_depot_status  
                                    from tbl_petrol tp 
                                    left join tbl_petrol_depot tpd on tp.ptrl_code = tpd.ptrl_code 
                                    where tp.ptrl_code = '${ptrl_code}' 
                                    order by ptrl_depot_status asc;`;
                                    let db_createorderxx2 = await pgConn.get(xdatabase, xscript, config.connectionString());

                                    if (!db_createorderxx2.code) {
                                        if (db_createorderxx2.data.length > 0) {
                                            sold_to = db_createorderxx2.data[0].ptrl_number;
                                            ship_to = db_createorderxx2.data[0].ptrl_number;
                                            cus_ref = db_createorderxx2.data[0].ptrl_number;
                                            order_type = db_createorderxx2.data[0].ptrl_sales_type;
                                            order_group = db_createorderxx2.data[0].ptrl_sales_group;
                                            deli_date_req = moment(xdate).add('days', parseInt(db_createorderxx2.data[0].waiting_days)).format('YYYY-MM-DD');

                                            if (db_createorderxx2.data[0].dpo_code != '') {
                                                deli_plant = db_createorderxx2.data[0].dpo_code;
                                            }

                                            xscript = `select case when LPAD((max(replace(sh_cus_ref,'AOS${moment(xdate).format('YYYYMMDD')}','')) :: integer + 1) :: text, 4, '0') is null then '0001' else 
                                            LPAD((max(replace(sh_cus_ref,'AOS${moment(xdate).format('YYYYMMDD')}','')) :: integer + 1) :: text, 4, '0') end as xmax from tbl_order where sh_cus_ref like 'AOS${moment(xdate).format('YYYYMMDD')}%'`
                                            let db_createorderxx3 = await pgConn.get(xdatabase, xscript, config.connectionString());

                                            if (!db_createorderxx3.code) {
                                                if (db_createorderxx3.data.length > 0) {
                                                    sh_cus_ref = 'AOS' + moment(xdate).format('YYYYMMDD') + db_createorderxx3.data[0].xmax;

                                                    xscript = `select case when tmst.time_code is null then 'Z01' else tmst.time_code end as time_code,
                                                    tpwd.ptrl_open_time, tpwd.ptrl_close_time
                                                    from tbl_petrol_worked_date tpwd 
                                                    left join tbl_master_time tmst on tpwd.ptrl_open_time = to_char(tmst.time_value, 'HH24:MI')
                                                    where tpwd.ptrl_code = '${ptrl_code}'
                                                    and tpwd.wrk_date_code  = '${moment(deli_date_req).days()}' and tpwd.ptrl_worked_date_flag = '1';`

                                                    db_createorderxx3 = await pgConn.get(xdatabase, xscript, config.connectionString());
                                                    //deli_time_req
                                                    if (!db_createorderxx3.code) {
                                                        if (db_createorderxx3.data.length > 0) {
                                                            deli_time_req = db_createorderxx3.data[0].time_code;
                                                        }
                                                        else {
                                                            deli_time_req = 'Z01';
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    if (deli_plant != '' && sh_cus_ref != '') {
                                        xscript = `select tati.automatic_code ,tati.ptrl_code ,tati.ptrl_code, tati.tank_code, tati.itm_code, 
                                        case when tati.fill_volume_actual is null then 0 else tati.fill_volume_actual end as fill_volume_actual,  tati.result 
                                        from tbl_automatics_tanks_information tati  
                                        where stock_at >= '${xdate} 00:00:00.000' 
                                        and stock_at <= '${xdate} 23:59:59.000' 
                                        and tati.result is not null and tati.ptrl_code = '${ptrl_code}'`
                                        var db_createorderxx5 = await pgConn.get(xdatabase, xscript, config.connectionString());

                                        if (!db_createorderxx5.code) {
                                            var xresult = [];
                                            for (var xrds = 0; xrds <= db_createorderxx5.data.length - 1; xrds++) {

                                                xscript = `update tbl_automatics_tanks_information set result = 'create order complete.',
                                                sh_cus_ref = '${sh_cus_ref}' 
                                                where automatic_code =  '${db_createorderxx5.data[xrds].automatic_code}';`
                                                var db_createorderxx7 = await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                console.log('update tbl_automatics_tanks_information,', db_createorderxx5.data[xrds].automatic_code, !db_createorderxx7.code);

                                                xscript = `update tbl_automatics_sales_previous_information 
                                                set sh_cus_ref = '${sh_cus_ref}' 
                                                where ptrl_code = '${db_createorderxx5.data[xrds].ptrl_code}' 
                                                and tank_code = '${db_createorderxx5.data[xrds].tank_code}' 
                                                and itm_code = '${db_createorderxx5.data[xrds].itm_code}' 
                                                and sale_at_previous = '${xdate} 00:00:00.000';`
                                                var db_createorderxx8 = await pgConn.execute(xdatabase, xscript, config.connectionString());

                                                xresult.push({
                                                    ptrl_code: ptrl_code,
                                                    tank_code: db_createorderxx5.data[xrds].tank_code,
                                                    itm_code: db_createorderxx5.data[xrds].itm_code,
                                                    stock: db_createorderxx5.data[xrds].fill_volume_actual,
                                                    daysale: db_createorderxx5.data[xrds].fill_volume_actual,
                                                    target_stock: db_createorderxx5.data[xrds].fill_volume_actual,
                                                    need_qty: db_createorderxx5.data[xrds].fill_volume_actual,
                                                    reason: db_createorderxx5.data[xrds].result
                                                });

                                                if (xrds == db_createorderxx5.data.length - 1) {
                                                    var automatic_code = 'auto-' + moment().format('x');
                                                    //insert to table auto order.
                                                    xscript = `insert into tbl_automatics_orders 
                                                            (automatic_code, ptrl_code, ist_dt, result, automatic_status) values 
                                                            ('${automatic_code}', '${db_createorderxx1.data[xcdorder].ptrl_code}', 
                                                            '${moment(xdate).format('YYYY-MM-DD 00:00:00')}', 'complete-manual', '1')`

                                                    var db_createorderxx9 = await pgConn.execute(xdatabase, xscript, config.connectionString());
                                                    let response = [
                                                        {
                                                            status: "success",
                                                            invalid_code: "0",
                                                            message: "",
                                                            data: xresult,
                                                            veh_type_code: veh_type_code,
                                                            response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                                                        },
                                                    ];
                                                    res.status(200).send(response);
                                                    return;
                                                }
                                            }
                                        }
                                    }
                                    else {
                                        //update no config depo.
                                        let response = [
                                            {
                                                status: "error",
                                                invalid_code: "-4",
                                                message: `ไม่มีข้อมูลคลังน้ำมัน, กรุณาตรวจสอบ`,
                                                data: [],
                                                response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
                                            },
                                        ];
                                        res.status(200).send(response);
                                        return
                                    }

                                }
                            }
                            else {
                                if (xruncreateorder) {
                                    xscript = `select distinct tati.ptrl_code, tati.result 
                                    from tbl_automatics_tanks_information tati  
                                    where stock_at >= '${xdate} 00:00:00.000' 
                                    and stock_at <= '${xdate} 23:59:59.000' 
                                    and tati.result = 'create order complete.' and tati.ptrl_code = '${ptrl_code}'
                                    group by tati.ptrl_code, result order by tati.ptrl_code asc limit 1`

                                    let db_createorderxx1 = await pgConn.get(xdatabase, xscript, config.connectionString());
                                    if (!db_createorderxx1.code) {
                                        if (db_createorderxx1.data.length > 0) {
                                            xscript = `select tati.automatic_code ,tati.ptrl_code ,tati.ptrl_code, tati.tank_code, tati.itm_code, 
                                            case when tati.fill_volume_actual is null then 0 else tati.fill_volume_actual end as fill_volume_actual,  
                                            tati.result from tbl_automatics_tanks_information tati  
                                            where stock_at >= '${xdate} 00:00:00.000' 
                                            and stock_at <= '${xdate} 23:59:59.000' 
                                            and tati.result = 'create order complete.' and tati.ptrl_code = '${ptrl_code}'`
                                            var db_createorderxx5 = await pgConn.get(xdatabase, xscript, config.connectionString());

                                            if (!db_createorderxx5.code) {
                                                var xresult = [];
                                                for (var xrds = 0; xrds <= db_createorderxx5.data.length - 1; xrds++) {
                                                    xresult.push({
                                                        ptrl_code: ptrl_code,
                                                        tank_code: db_createorderxx5.data[xrds].tank_code,
                                                        itm_code: db_createorderxx5.data[xrds].itm_code,
                                                        stock: db_createorderxx5.data[xrds].fill_volume_actual,
                                                        daysale: db_createorderxx5.data[xrds].fill_volume_actual,
                                                        target_stock: db_createorderxx5.data[xrds].fill_volume_actual,
                                                        need_qty: db_createorderxx5.data[xrds].fill_volume_actual,
                                                        reason: db_createorderxx5.data[xrds].result
                                                    });

                                                    if (xrds == db_createorderxx5.data.length - 1) {
                                                        let response = [
                                                            {
                                                                status: "success",
                                                                invalid_code: "0",
                                                                message: "",
                                                                data: xresult,
                                                                veh_type_code: veh_type_code,
                                                                response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                                                            },
                                                        ];
                                                        res.status(200).send(response);
                                                        return;
                                                    }
                                                }
                                            }
                                        }
                                        else {
                                            xscript = `select tbl_petrol.ptrl_code ,tbl_petrol_tank.ptrl_tank_code, tbl_petrol_tank.itm_code ,coverage_days, tnk_capacity, tnk_target, tnk_deadstock, tnk_safety_factor 
                                            from tbl_petrol left join tbl_petrol_tank on tbl_petrol.ptrl_code = tbl_petrol_tank.ptrl_code 
                                            where tbl_petrol.ptrl_code = '${ptrl_code}';`

                                            let tbl_temporary5 = await pgConn.get(
                                                dbPrefix + lic_code,
                                                xscript,
                                                config.connectionString(),
                                            );

                                            if (!tbl_temporary5.code) {
                                                xresult = [];
                                                for (let xi2 = 0; xi2 <= tbl_temporary5.data.length - 1; xi2++) {
                                                    xresult.push({
                                                        ptrl_code: ptrl_code,
                                                        tank_code: tbl_temporary5.data[xi2].ptrl_tank_code,
                                                        itm_code: tbl_temporary5.data[xi2].itm_code,
                                                        stock: 0,
                                                        daysale: 0,
                                                        target_stock: 0,
                                                        need_qty: 0,
                                                        reason: "Stock is incorrect."
                                                    });

                                                    if (xi2 == tbl_temporary5.data.length - 1) {
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
                                                }
                                            }
                                            else {
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
                                                return
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                else {
                    let response = [
                        {
                            status: "error",
                            invalid_code: "-4",
                            message: `ไม่มีข้อมูล Stock กรุณาตรวจสอบ`,
                            data: xresult,
                            response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
                        },
                    ];
                    res.status(200).send(response);
                    return
                }
            }
            else {
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
                return
            }
        }

    })().catch(async (err) => {
        console.error('getAutoCalculateOrderInformation', err);
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
    });
};