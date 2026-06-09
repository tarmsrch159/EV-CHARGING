const config = require("../../configuration/connection");
const pgConn = require("../../library/pgConnection");
const moment = require("moment");
const axios = require("axios");
const { sapApiClient } = require("./sap-api-config");
const xglobal = require("../../middleware/global");
const dbPrefix = config.dbPrefix();
const sendResponse = xglobal.sendResponse;

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
            var xdate = moment().add(-1, 'days').format('YYYY-MM-DD');
            // var xdate = moment().add('days', -1).format('YYYY-MM-DD');
            var xscript = `select distinct shipto_no, ptr.ptrl_code, ptr.ptrl_sitecode, ptr.ptrl_number, ptr.stock_provious_days, 
            case when ptr.waiting_days is null then 2 else waiting_days :: integer + 1 end as waiting_days, ptr.coverage_days, auto.automatic_code 
            from tbl_order_eodtank eod
            inner join tbl_petrol ptr on eod.shipto_no = ptr.ptrl_sitecode  
            left join tbl_automatics_orders auto on ptr.ptrl_code = auto.ptrl_code 
            and auto.ist_dt >= '${xdate} 00:00:00.000' and auto.ist_dt <= '${xdate} 23:59:59.000' 
            where date_at >= '${xdate} 00:00:00.000' and date_at <= '${xdate} 23:59:59.000' 
            and ptr.auto_order = '1' and auto."result" = 'complete.' and ptr.ptrl_code = '${ptrl_code}' 
            order by shipto_no asc;`

            let tbl_temporary1 = await pgConn.get(
                dbPrefix + lic_code,
                xscript,
                config.connectionString(),
            );

            if (!tbl_temporary1.code) {

                if (tbl_temporary1.data.length == 0) {
                    xdate = moment().add(-2, 'days').format('YYYY-MM-DD');
                    // xdate = moment().add('days', -2).format('YYYY-MM-DD');

                    xscript = `select distinct shipto_no, ptr.ptrl_code, ptr.ptrl_sitecode, ptr.ptrl_number, ptr.stock_provious_days, 
                    case when ptr.waiting_days is null then 2 else waiting_days :: integer + 1 end as waiting_days, ptr.coverage_days, auto.automatic_code 
                    from tbl_order_eodtank eod
                    inner join tbl_petrol ptr on eod.shipto_no = ptr.ptrl_sitecode  
                    left join tbl_automatics_orders auto on ptr.ptrl_code = auto.ptrl_code 
                    and auto.ist_dt >= '${xdate} 00:00:00.000' and auto.ist_dt <= '${xdate} 23:59:59.000' 
                    where date_at >= '${xdate} 00:00:00.000' and date_at <= '${xdate} 23:59:59.000' and auto."result" = 'complete.' and ptr.ptrl_code = '${ptrl_code}' 
                    order by shipto_no asc;`

                    tbl_temporary1 = await pgConn.get(
                        dbPrefix + lic_code,
                        xscript,
                        config.connectionString(),
                    );

                    if (tbl_temporary1.code) {
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
                if (tbl_temporary1.data.length > 0) {
                    xscript = `select automatic_code, ptrl_code, tank_code, itm_code, stock, stock_at, ist_dt, mdf_dt, 
                    case when fill_volume is null then 0 else fill_volume end as fill_volume, fill_volume_after, tnk_capacity, tnk_target, tnk_deadstock, tnk_safety_factor 
                    from tbl_automatics_tanks_information where ptrl_code = '${ptrl_code}'  
                    and stock_at >= '${xdate} 00:00:00.000' and stock_at <= '${xdate} 23:59:59.000';`

                    let tbl_temporary2 = await pgConn.get(
                        dbPrefix + lic_code,
                        xscript,
                        config.connectionString(),
                    );

                    debugger
                    if (!tbl_temporary2.code) {
                        if (tbl_temporary2.data.length > 0) {
                            for (let xi = 0; xi <= tbl_temporary2.data.length - 1; xi++) {
                                var coverage_days = tbl_temporary1.data[0].coverage_days;
                                var xtnk_safety_factor = 0.85;
                                var xstock = 0.0;
                                var xtargetstock = 0.0;
                                var xtargetorder = 0.0;
                                var xunpumplevel = parseInt(tbl_temporary2.data[xi].tnk_deadstock);
                                var xtnk_capacity = parseFloat(tbl_temporary2.data[xi].tnk_capacity);
                                var xtnk_target_config = parseFloat(tbl_temporary2.data[xi].tnk_target);
                                var xdaysale = 0.0;
                                var xneedqty = 0.0;

                                xscript = `select case when sum(item_qty) is null then 0 else sum(item_qty) end as qty from tbl_order 
                                left join tbl_order_item on tbl_order.id = tbl_order_item.order_no 
                                where ship_to = (select ptrl_number from tbl_petrol where ptrl_code = '${ptrl_code}') 
                                and item_no = '${tbl_temporary2.data[xi].itm_code}' 
                                and ptrl_tank_code = '${tbl_temporary2.data[xi].tank_code}' and order_status in ('10','1','3');`

                                let tbl_temporary3 = await pgConn.get(
                                    dbPrefix + lic_code,
                                    xscript,
                                    config.connectionString(),
                                );

                                if (!tbl_temporary3.code) {
                                    if (tbl_temporary3.data.length > 0) {
                                        tbl_temporary2.data[xi].stock = parseFloat(tbl_temporary2.data[xi].stock) + parseFloat(tbl_temporary3.data[0].qty);
                                    }
                                }

                                try {
                                    xtnk_safety_factor = tnk_safety_factor / 100;
                                } catch (err) { }

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
                                where salepr.ptrl_code = '${ptrl_code}' and salepr.tank_code = '${tbl_temporary2.data[xi].tank_code}' 
                                and sale_at_previous = '${xdate}') xtable`

                                let tbl_temporary4 = await pgConn.get(
                                    dbPrefix + lic_code,
                                    xscript,
                                    config.connectionString(),
                                );

                                if (!tbl_temporary4.code) {
                                    if (tbl_temporary4.data.length > 0) {
                                        if (parseFloat(tbl_temporary4.data[0].daysales) <= 0.0) {
                                            xdaysale = parseFloat(tbl_temporary4.data[0].sale_previous);
                                        }
                                        else {
                                            xdaysale = parseFloat(tbl_temporary4.data[0].daysales);
                                        }
                                    }
                                }

                                if (xdaysale > 0) {
                                    try {
                                        xstock = tbl_temporary2.data[xi].stock;
                                        xtargetstock = (xdaysale * coverage_days) + xunpumplevel;
                                        xneedqty = Math.max(0, xtargetstock - xstock);
                                        xtargetorder = (xdaysale) + xunpumplevel;
                                    }
                                    catch (ex) {
                                        debugger
                                    }

                                    if (xneedqty <= (xtnk_capacity - xstock)) {
                                        //ถ้า NeedQty น้อยกว่า Threshold → ไม่ต้องสั่ง และต้องตรวจ
                                        xresult.push({
                                            ptrl_code: ptrl_code,
                                            tank_code: tbl_temporary2.data[xi].tank_code,
                                            itm_code: tbl_temporary2.data[xi].itm_code,
                                            stock: xstock,
                                            daysale: xdaysale,
                                            target_stock: 0,
                                            need_qty: 0,
                                            reason: "Need Qty <= (Tank Capacity - Stock)."
                                        });
                                    }
                                    else {
                                        //create order
                                        if (xtargetorder > xtnk_target_config) {
                                            xtargetorder = xtnk_target_config;
                                        }

                                        xscript = `select level, veh_type_code, veh_type_desc, capacity_max, capacity_min
                                        from 
                                        ((select 0 as level,tpvt.veh_type_code, tvt.veh_type_desc ,tvt.capacity_max, tvt.capacity_min 
                                        from tbl_petrol_vehicle_type tpvt 
                                        left join tbl_vehicle_type tvt on tpvt.veh_type_code = tpvt.veh_type_code 
                                        where tpvt.ptrl_code = '${ptrl_code}'

                                        union

                                        select 1 as level,tvt.veh_type_code, tvt.veh_type_desc ,tvt.capacity_max, tvt.capacity_min 
                                        from tbl_vehicle_type tvt where capacity_min < ${xtargetorder}  
                                        and capacity_max >= ${xtargetorder}

                                        union

                                        select 2 as level,tvt.veh_type_code, tvt.veh_type_desc ,tvt.capacity_max, tvt.capacity_min 
                                        from tbl_vehicle_type tvt where tvt.veh_type_code in 
                                        (select veh_type_code from tbl_vehicle_type order by capacity_max desc limit 1))) xtable 
                                        order by xtable."level" asc`

                                        let tbl_temporary5 = await pgConn.get(
                                            dbPrefix + lic_code,
                                            xscript,
                                            config.connectionString(),
                                        );

                                        //debugger
                                        if (!tbl_temporary5.code) {
                                            if (tbl_temporary5.data.length > 0) {
                                                xtargetorder = parseFloat(tbl_temporary5.data[0].capacity_max);
                                            }
                                        }

                                        if (xneedqty > 100000) {
                                            xresult.push({
                                                ptrl_code: ptrl_code,
                                                tank_code: tbl_temporary2.data[xi].tank_code,
                                                itm_code: tbl_temporary2.data[xi].itm_code,
                                                stock: xstock,
                                                daysale: xdaysale,
                                                target_stock: xtargetorder,
                                                need_qty: 0,
                                                reason: "Need Qty is incorrect."
                                            });
                                        }
                                        else {
                                            xresult.push({
                                                ptrl_code: ptrl_code,
                                                tank_code: tbl_temporary2.data[xi].tank_code,
                                                itm_code: tbl_temporary2.data[xi].itm_code,
                                                stock: xstock,
                                                daysale: xdaysale,
                                                target_stock: xtargetorder,
                                                need_qty: xneedqty,
                                                reason: "done."
                                            });
                                        }
                                    }
                                } else {
                                    xresult.push({
                                        ptrl_code: ptrl_code,
                                        tank_code: tbl_temporary2.data[xi].tank_code,
                                        itm_code: tbl_temporary2.data[xi].itm_code,
                                        stock: xstock,
                                        daysale: xdaysale,
                                        target_stock: xtargetstock,
                                        need_qty: 0,
                                        reason: "Daysale is incorrect."
                                    });
                                }

                                if (xi == tbl_temporary2.data.length - 1) {
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
