const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = new require('../../middleware/global');

const dbPrefix = config.dbPrefix();

//example https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js

exports.getReportALSInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { start_date, end_date, ptrl_group_code, dpo_code, off_code } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (start_date == undefined || end_date == undefined || ptrl_group_code == undefined || dpo_code == undefined || off_code == undefined || lic_code == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return
        } else {

            let script = `select carrier_name, tms_transport_code, shipments_code, job_dt, shift, veh_number, veh_license_number, trip, count_drop, 
            gsap_order_number, gsap_shipments_number, transit_start_dt, transit_end_dt, transit_minute, distance, uom_km, 
            dpo_code, dpo_number, dpo_desc, dpo_address, ptrl_number, ptrl_desc, ptrl_address, ptrl_zip_code, 
            itm_material_number, itm_desc, sum(item_quantity) as item_quantity, uom_l, delivery, time_window, dseq, job_status, trip_type, item_weight, uom_kg, 
            ord_comment, loading_start_dt, loading_end_dt, ptrl_group_desc, ptrl_group_code, ptrl_tank_code, tnk_number, unloading_start_dt, unloading_end_dt,
            (select sum(xcomp.item_quantity * xitem.itm_weight_litr_per_kg) as total_weight
            from tbl_order_compartment xcomp 
            left join tbl_item xitem on xcomp.itm_code = xitem.itm_code
            left join tbl_job_order jor on xcomp.ord_code = jor.ord_code 
            where jor.job_code = xtable_master.job_code)

            from 
            (select 'PONGRAWE CO LTD' :: text as carrier_name, job_code, tms_transport_code, tbl_order.shipments_code, job_dt,
            case when substring(tbl_vehicle.veh_number,length(tbl_vehicle.veh_number),1) = 'N' then '2' else '1' end as shift, veh_number, veh_license_number, xmaster.trip,
            xmaster.unloading_count as count_drop, xmaster.gsap_order_number, xmaster.gsap_shipments_number, transit_start_dt, transit_end_dt, transit_minute, 
            xmaster.distance, 'KM' :: text as uom_km, xmaster.dpo_code ,dpo_number, 
            dpo_desc, tbl_depot.dpo_address, ptrl_number, ptrl_desc, tbl_petrol.ptrl_address, tbl_petrol.ptrl_zip_code, itm_material_number, tbl_item.itm_desc, tbl_order_compartment.item_quantity, 
            'L' :: text as uom_l, '-' :: text as delivery,concat(tbl_petrol_worked_date.ptrl_open_tiime,' - ',tbl_petrol_worked_date.ptrl_close_time) :: text as time_window , 
            ((select count(distinct ptrl_code) + 1 from tbl_order_petrol odp
            where to_char(odp.unloading_start_dt, 'YYYY-MM-DD HH24:MI:SS') > to_char(tbl_order_petrol.unloading_start_dt, 'YYYY-MM-DD 00:00:00') 
            and to_char(odp.unloading_start_dt, 'YYYY-MM-DD HH24:MI:SS') < to_char(tbl_order_petrol.unloading_start_dt, 'YYYY-MM-DD HH24:MI:SS')
            and odp.ord_code in (select ord_code from tbl_job_order where tbl_job_order.job_code = xmaster.job_code))) as dseq
            ,job_status, 'Road Delivery' :: text as trip_type, 
            tbl_order_compartment.item_quantity * tbl_item.itm_weight_litr_per_kg as item_weight,
            'KG' :: text as uom_kg, tbl_order.ord_comment, xmaster.loading_start_dt, xmaster.loading_end_dt, 
            ptrl_group_desc, tbl_petrol_group.ptrl_group_code, tbl_petrol_tank.ptrl_tank_code, tbl_petrol_tank.tnk_number,
            tbl_order_petrol.unloading_start_dt, tbl_order_petrol.unloading_end_dt, tbl_order_compartment.veh_compartment_code

            from 
            (select (select count(job_code) + 1 as trip from tbl_job jb
            where jb.veh_code = tbl_job.veh_code 
            and to_char(jb.transit_start_dt, 'YYYY-MM-DD HH24:MI:SS') > to_char(tbl_job.transit_start_dt, 'YYYY-MM-DD 00:00:00') 
            and to_char(jb.transit_start_dt, 'YYYY-MM-DD HH24:MI:SS') < to_char(tbl_job.transit_start_dt, 'YYYY-MM-DD HH24:MI:SS')) as trip,tbl_job.job_code,job_status,
            tbl_job_order.ord_code,tbl_job.veh_code,tms_transport_code,job_dt, transit_start_dt, transit_end_dt, transit_minute, tbl_job.unloading_count, tbl_job.distance, 
            tbl_job.gsap_order_number, tbl_job.gsap_shipments_number,
            (select distinct(dpo_code) from tbl_job_order x2joborder 
            left join tbl_order_depot x2depo on x2joborder.ord_code = x2depo.ord_code 
            where x2joborder.job_code = tbl_job.job_code limit 1) as dpo_code,
            (select min(loading_start_dt) from tbl_job_order x2joborder 
            left join tbl_order_depot x2depo on x2joborder.ord_code = x2depo.ord_code 
            where x2joborder.job_code = tbl_job.job_code limit 1) as loading_start_dt,
            (select max(loading_end_dt) from tbl_job_order x2joborder 
            left join tbl_order_depot x2depo on x2joborder.ord_code = x2depo.ord_code 
            where x2joborder.job_code = tbl_job.job_code limit 1) as loading_end_dt

            from tbl_job
            inner join tbl_job_order on tbl_job.job_code = tbl_job_order.job_code
            inner join tbl_order on tbl_job_order.ord_code = tbl_order.ord_code
            where job_dt >= '${start_date} 00:00:00' and job_dt <= '${end_date} 23:59:59' 
            and tbl_job.transporeon_status = 'A' and (tbl_job.job_status = '2' OR tbl_job.job_status = '4') and tbl_job.off_code = 'off-1747276087326'  
            and tbl_job.job_flag = '1' and tbl_order.ord_flag = '1') xmaster

            left join tbl_depot on xmaster.dpo_code = tbl_depot.dpo_code 
            ${dpo_code.toString().toUpperCase() != 'ALL' ? `and xmaster.dpo_code = '${dpo_code}'` : ''}

            left join tbl_order_petrol on xmaster.ord_code = tbl_order_petrol.ord_code
            and tbl_order_petrol.ord_petrol_flag = '1'
            left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
            and tbl_petrol.ptrl_flag = '1' 
            
            left join tbl_petrol_worked_date on tbl_petrol.ptrl_code = tbl_petrol_worked_date.ptrl_code 
            and tbl_petrol_worked_date.wrk_date_code = '0'
            and tbl_petrol_worked_date.ptrl_worked_date_flag = '1'

            left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code
            and tbl_petrol_group.ptrl_group_flag = '1'
            
            left join tbl_order_item on xmaster.ord_code = tbl_order_item.ord_code
            and tbl_order_item.ord_item_flag = '1'
            left join tbl_item on tbl_order_item.itm_code = tbl_item.itm_code
            and tbl_item.itm_flag = '1'

            left join tbl_order_compartment on tbl_order_item.ord_code = tbl_order_compartment.ord_code
            and tbl_order_item.itm_code = tbl_order_compartment.itm_code
            and tbl_order_item.ptrl_tank_code = tbl_order_compartment.ptrl_tank_code
            and tbl_order_compartment.ord_veh_compartment_flag = '1'

            left join tbl_petrol_tank on tbl_petrol.ptrl_code = tbl_petrol_tank.ptrl_code
            and tbl_order_compartment.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code
            and tbl_petrol_tank.ptrl_tank_flag = '1'

            left join tbl_vehicle on xmaster.veh_code = tbl_vehicle.veh_code

            left join tbl_order on xmaster.ord_code = tbl_order.ord_code
            and tbl_order.ord_flag = '1' 
            
            ${ptrl_group_code.toString().toUpperCase() != 'ALL' ? `where tbl_petrol.ptrl_group_code = '${ptrl_group_code}'` : ''}

            group by carrier_name, job_code, tms_transport_code, shipments_code, job_dt, shift, veh_number, veh_license_number, trip, count_drop, 
            xmaster.gsap_order_number, xmaster.gsap_shipments_number, transit_start_dt, transit_end_dt, transit_minute, xmaster.distance, 
            uom_km, xmaster.dpo_code, dpo_number, dpo_desc, tbl_depot.dpo_address, ptrl_number, ptrl_desc, tbl_petrol.ptrl_address, 
            tbl_petrol.ptrl_zip_code, itm_material_number, 
            tbl_item.itm_desc, tbl_order_compartment.item_quantity, uom_l, delivery, time_window, dseq, job_status, trip_type, item_weight, uom_kg, ord_comment, loading_start_dt, 
            loading_end_dt, ptrl_group_desc, tbl_petrol_group.ptrl_group_code, tbl_order_compartment.ptrl_tank_code, tbl_petrol_tank.ptrl_tank_code, tnk_number, unloading_start_dt, 
            unloading_end_dt, tbl_order_compartment.veh_compartment_code) xtable_master 
            group by 
			carrier_name,tms_transport_code,shipments_code,job_dt,shift,veh_number,veh_license_number,trip,count_drop,gsap_order_number,gsap_shipments_number,transit_start_dt,transit_end_dt,transit_minute,distance,uom_km,dpo_code,dpo_number,dpo_desc,dpo_address,ptrl_number,ptrl_desc,ptrl_address,ptrl_zip_code,itm_material_number,itm_desc,item_quantity,uom_l,delivery,time_window,dseq,job_status,trip_type,item_weight,uom_kg,ord_comment,loading_start_dt,loading_end_dt,ptrl_group_desc,ptrl_group_code,ptrl_tank_code,tnk_number,unloading_start_dt,unloading_end_dt,total_weight 
            order by tms_transport_code, trip, dseq`

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
                    await xglobal.action_logs(lic_code, tbl_temporary.data[0].emp_code, 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'success', tbl_temporary.data[0].off_code);
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
                    message: `ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
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
        await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
        return;
    });
}

exports.getReportALSInformationV2 = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { start_date, end_date, ptrl_group_code, dpo_code, veh_group_code, off_code } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (start_date == undefined || end_date == undefined || ptrl_group_code == undefined || dpo_code == undefined || off_code == undefined || lic_code == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return
        } else {

            if (veh_group_code == undefined) {
                veh_group_code = 'ALL';
            }

            let script = `select carrier_name, tms_transport_code, shipments_code, job_dt, shift, veh_number, veh_license_number, trip, count_drop, 
            gsap_order_number, gsap_shipments_number, transit_start_dt, transit_end_dt, transit_minute, distance, uom_km, 
            dpo_code, dpo_number, dpo_desc, dpo_address, ptrl_number, ptrl_desc, ptrl_address, ptrl_zip_code, 
            itm_material_number, itm_desc, sum(item_quantity) as item_quantity, uom_l, delivery, time_window, dseq, job_status, trip_type, item_weight, uom_kg, 
            ord_comment, loading_start_dt, loading_end_dt, ptrl_group_desc, ptrl_group_code, ptrl_tank_code, tnk_number, unloading_start_dt, unloading_end_dt,
            (select sum(xcomp.item_quantity * xitem.itm_weight_litr_per_kg) as total_weight
            from tbl_order_compartment xcomp 
            left join tbl_item xitem on xcomp.itm_code = xitem.itm_code
            left join tbl_job_order jor on xcomp.ord_code = jor.ord_code 
            where jor.job_code = xtable_master.job_code)

            from 
            (select 'PONGRAWE CO LTD' :: text as carrier_name, job_code, tms_transport_code, tbl_order.shipments_code, job_dt,
            case when substring(tbl_vehicle.veh_number,length(tbl_vehicle.veh_number),1) = 'N' then '2' else '1' end as shift, veh_number, veh_license_number, xmaster.trip,
            xmaster.unloading_count as count_drop, xmaster.gsap_order_number, xmaster.gsap_shipments_number, transit_start_dt, transit_end_dt, transit_minute, 
            xmaster.distance, 'KM' :: text as uom_km, xmaster.dpo_code ,dpo_number, 
            dpo_desc, tbl_depot.dpo_address, ptrl_number, ptrl_desc, tbl_petrol.ptrl_address, tbl_petrol.ptrl_zip_code, itm_material_number, tbl_item.itm_desc, tbl_order_compartment.item_quantity, 
            'L' :: text as uom_l, '-' :: text as delivery,concat(tbl_petrol_worked_date.ptrl_open_tiime,' - ',tbl_petrol_worked_date.ptrl_close_time) :: text as time_window , 
            ((select count(distinct ptrl_code) + 1 from tbl_order_petrol odp
            where to_char(odp.unloading_start_dt, 'YYYY-MM-DD HH24:MI:SS') > to_char(tbl_order_petrol.unloading_start_dt, 'YYYY-MM-DD 00:00:00') 
            and to_char(odp.unloading_start_dt, 'YYYY-MM-DD HH24:MI:SS') < to_char(tbl_order_petrol.unloading_start_dt, 'YYYY-MM-DD HH24:MI:SS')
            and odp.ord_code in (select ord_code from tbl_job_order where tbl_job_order.job_code = xmaster.job_code))) as dseq
            ,job_status, 'Road Delivery' :: text as trip_type, 
            tbl_order_compartment.item_quantity * tbl_item.itm_weight_litr_per_kg as item_weight,
            'KG' :: text as uom_kg, tbl_order.ord_comment, xmaster.loading_start_dt, xmaster.loading_end_dt, 
            ptrl_group_desc, tbl_petrol_group.ptrl_group_code, tbl_petrol_tank.ptrl_tank_code, tbl_petrol_tank.tnk_number,
            tbl_order_petrol.unloading_start_dt, tbl_order_petrol.unloading_end_dt, tbl_order_compartment.veh_compartment_code

            from 
            (select (select count(job_code) + 1 as trip from tbl_job jb
            where jb.veh_code = tbl_job.veh_code 
            and to_char(jb.transit_start_dt, 'YYYY-MM-DD HH24:MI:SS') > to_char(tbl_job.transit_start_dt, 'YYYY-MM-DD 00:00:00') 
            and to_char(jb.transit_start_dt, 'YYYY-MM-DD HH24:MI:SS') < to_char(tbl_job.transit_start_dt, 'YYYY-MM-DD HH24:MI:SS')) as trip,tbl_job.job_code,job_status,
            tbl_job_order.ord_code,tbl_job.veh_code,tms_transport_code,job_dt, transit_start_dt, transit_end_dt, transit_minute, tbl_job.unloading_count, tbl_job.distance, 
            tbl_job.gsap_order_number, tbl_job.gsap_shipments_number,
            (select distinct(dpo_code) from tbl_job_order x2joborder 
            left join tbl_order_depot x2depo on x2joborder.ord_code = x2depo.ord_code 
            where x2joborder.job_code = tbl_job.job_code limit 1) as dpo_code,
            (select min(loading_start_dt) from tbl_job_order x2joborder 
            left join tbl_order_depot x2depo on x2joborder.ord_code = x2depo.ord_code 
            where x2joborder.job_code = tbl_job.job_code limit 1) as loading_start_dt,
            (select max(loading_end_dt) from tbl_job_order x2joborder 
            left join tbl_order_depot x2depo on x2joborder.ord_code = x2depo.ord_code 
            where x2joborder.job_code = tbl_job.job_code limit 1) as loading_end_dt

            from tbl_job
            inner join tbl_job_order on tbl_job.job_code = tbl_job_order.job_code
            inner join tbl_order on tbl_job_order.ord_code = tbl_order.ord_code
            where job_dt >= '${start_date} 00:00:00' and job_dt <= '${end_date} 23:59:59' 
            and tbl_job.transporeon_status = 'A' and (tbl_job.job_status = '2' OR tbl_job.job_status = '4') and tbl_job.off_code = 'off-1747276087326'  
            and tbl_job.job_flag = '1' and tbl_order.ord_flag = '1') xmaster

            left join tbl_depot on xmaster.dpo_code = tbl_depot.dpo_code 
            ${dpo_code.toString().toUpperCase() != 'ALL' ? `and xmaster.dpo_code = '${dpo_code}'` : ''}

            left join tbl_order_petrol on xmaster.ord_code = tbl_order_petrol.ord_code
            and tbl_order_petrol.ord_petrol_flag = '1'
            left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
            and tbl_petrol.ptrl_flag = '1' 
            
            left join tbl_petrol_worked_date on tbl_petrol.ptrl_code = tbl_petrol_worked_date.ptrl_code 
            and tbl_petrol_worked_date.wrk_date_code = '0'
            and tbl_petrol_worked_date.ptrl_worked_date_flag = '1'

            left join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code
            and tbl_petrol_group.ptrl_group_flag = '1'
            
            left join tbl_order_item on xmaster.ord_code = tbl_order_item.ord_code
            and tbl_order_item.ord_item_flag = '1'
            left join tbl_item on tbl_order_item.itm_code = tbl_item.itm_code
            and tbl_item.itm_flag = '1'

            left join tbl_order_compartment on tbl_order_item.ord_code = tbl_order_compartment.ord_code
            and tbl_order_item.itm_code = tbl_order_compartment.itm_code
            and tbl_order_item.ptrl_tank_code = tbl_order_compartment.ptrl_tank_code
            and tbl_order_compartment.ord_veh_compartment_flag = '1'

            left join tbl_petrol_tank on tbl_petrol.ptrl_code = tbl_petrol_tank.ptrl_code
            and tbl_order_compartment.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code
            and tbl_petrol_tank.ptrl_tank_flag = '1'

            left join tbl_vehicle on xmaster.veh_code = tbl_vehicle.veh_code

            left join tbl_order on xmaster.ord_code = tbl_order.ord_code
            and tbl_order.ord_flag = '1' 
            
            ${ptrl_group_code.toString().toUpperCase() != 'ALL' ? `where tbl_petrol.ptrl_group_code = '${ptrl_group_code}' 
            ${(veh_group_code.toString().toUpperCase() != 'ALL' ? `and tbl_vehicle.veh_group_code = '${veh_group_code}'` : '')}`
                    : (veh_group_code.toString().toUpperCase() != 'ALL' ? `where tbl_vehicle.veh_group_code = '${veh_group_code}'` : '')}

            group by carrier_name, job_code, tms_transport_code, shipments_code, job_dt, shift, veh_number, veh_license_number, trip, count_drop, 
            xmaster.gsap_order_number, xmaster.gsap_shipments_number, transit_start_dt, transit_end_dt, transit_minute, xmaster.distance, 
            uom_km, xmaster.dpo_code, dpo_number, dpo_desc, tbl_depot.dpo_address, ptrl_number, ptrl_desc, tbl_petrol.ptrl_address, 
            tbl_petrol.ptrl_zip_code, itm_material_number, 
            tbl_item.itm_desc, tbl_order_compartment.item_quantity, uom_l, delivery, time_window, dseq, job_status, trip_type, item_weight, uom_kg, ord_comment, loading_start_dt, 
            loading_end_dt, ptrl_group_desc, tbl_petrol_group.ptrl_group_code, tbl_order_compartment.ptrl_tank_code, tbl_petrol_tank.ptrl_tank_code, tnk_number, unloading_start_dt, 
            unloading_end_dt, tbl_order_compartment.veh_compartment_code) xtable_master 
            group by 
			carrier_name,tms_transport_code,shipments_code,job_dt,shift,veh_number,veh_license_number,trip,count_drop,gsap_order_number,gsap_shipments_number,transit_start_dt,transit_end_dt,transit_minute,distance,uom_km,dpo_code,dpo_number,dpo_desc,dpo_address,ptrl_number,ptrl_desc,ptrl_address,ptrl_zip_code,itm_material_number,itm_desc,item_quantity,uom_l,delivery,time_window,dseq,job_status,trip_type,item_weight,uom_kg,ord_comment,loading_start_dt,loading_end_dt,ptrl_group_desc,ptrl_group_code,ptrl_tank_code,tnk_number,unloading_start_dt,unloading_end_dt,total_weight 
            order by tms_transport_code, trip, dseq`

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
                    await xglobal.action_logs(lic_code, tbl_temporary.data[0].emp_code, 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'success', tbl_temporary.data[0].off_code);
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
                    message: `ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
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
        await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
        return;
    });
}


exports.getReportTripForUploadInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { start_date, end_date, ptrl_group_code, off_code } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (start_date == undefined || end_date == undefined || ptrl_group_code == undefined || off_code == undefined || lic_code == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return
        } else {

            let script = ``;
            if (ptrl_group_code.toString().toUpperCase() != 'ALL') {
                script = `select 'V-00004' as shell_code, trip, dseq, ptrl_number, tms_transport_code, gsap_shipments_number, ptrl_number, dpo_number, veh_number,
                sum(item_quantity) as item_quantity

                from 
                (select 'PONGRAWE CO LTD' :: text as carrier_name, job_code, tms_transport_code, tbl_order.shipments_code, job_dt,
                case when substring(tbl_vehicle.veh_number,0,4) = 'PRV' then '1' else  '2' end as shift, veh_number, veh_license_number, xmaster.trip,
                xmaster.unloading_count as count_drop, xmaster.gsap_order_number, xmaster.gsap_shipments_number, transit_start_dt, transit_end_dt, transit_minute, 
                xmaster.distance, 'KM' :: text as uom_km, tbl_order_depot.dpo_code ,dpo_number, 
                dpo_desc, tbl_depot.dpo_address, ptrl_number, ptrl_desc, tbl_petrol.ptrl_address, tbl_petrol.ptrl_zip_code, itm_material_number, tbl_item.itm_desc, tbl_order_compartment.item_quantity, 
                'L' :: text as uom_l, '-' :: text as delivery,concat(tbl_petrol_worked_date.ptrl_open_tiime,' - ',tbl_petrol_worked_date.ptrl_close_time) :: text as time_window , 
                ((select count(distinct ptrl_code) + 1 from tbl_order_petrol odp
                where to_char(odp.unloading_start_dt, 'YYYY-MM-DD HH24:MI:SS') > to_char(tbl_order_petrol.unloading_start_dt, 'YYYY-MM-DD 00:00:00') 
                and to_char(odp.unloading_start_dt, 'YYYY-MM-DD HH24:MI:SS') < to_char(tbl_order_petrol.unloading_start_dt, 'YYYY-MM-DD HH24:MI:SS')
                and odp.ord_code in (select ord_code from tbl_job_order where tbl_job_order.job_code = xmaster.job_code))) as dseq
                ,job_status, 'Road Delivery' :: text as trip_type, 
                tbl_order_compartment.item_quantity * tbl_item.itm_weight_litr_per_kg as item_weight,
                'KG' :: text as uom_kg, tbl_order.ord_comment, tbl_order_depot.loading_start_dt, tbl_order_depot.loading_end_dt, 
                ptrl_group_desc, tbl_petrol_group.ptrl_group_code, tbl_petrol_tank.ptrl_tank_code, tbl_petrol_tank.tnk_number,
                tbl_order_petrol.unloading_start_dt, tbl_order_petrol.unloading_end_dt, tbl_order_compartment.veh_compartment_code

                from 
                (select (select count(job_code) + 1 as trip from tbl_job jb
                where jb.veh_code = tbl_job.veh_code 
                and to_char(jb.transit_start_dt, 'YYYY-MM-DD HH24:MI:SS') > to_char(tbl_job.transit_start_dt, 'YYYY-MM-DD 00:00:00') 
                and to_char(jb.transit_start_dt, 'YYYY-MM-DD HH24:MI:SS') < to_char(tbl_job.transit_start_dt, 'YYYY-MM-DD HH24:MI:SS')) as trip,tbl_job.job_code,job_status,
                tbl_job_order.ord_code,tbl_job.veh_code,tms_transport_code,job_dt, transit_start_dt, transit_end_dt, transit_minute, tbl_job.unloading_count, tbl_job.distance, 
                tbl_job.gsap_order_number, tbl_job.gsap_shipments_number
                from tbl_job
                inner join tbl_job_order on tbl_job.job_code = tbl_job_order.job_code
                inner join tbl_order on tbl_job_order.ord_code = tbl_order.ord_code
                where job_dt >= '${start_date} 00:00:00' and job_dt <= '${end_date} 23:59:59' 
                and tbl_job.transporeon_status = 'A' and tbl_job.off_code = '${off_code}'  
                and tbl_job.job_flag = '1' and tbl_order.ord_flag = '1') xmaster

                inner join tbl_order_depot on xmaster.ord_code = tbl_order_depot.ord_code
                and tbl_order_depot.ord_depot_flag = '1'
                inner join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code 

                inner join tbl_order_petrol on xmaster.ord_code = tbl_order_petrol.ord_code
                and tbl_order_petrol.ord_petrol_flag = '1'
                inner join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
                and tbl_petrol.ptrl_flag = '1' and tbl_petrol.ptrl_group_code = '${ptrl_group_code}'

                inner join tbl_petrol_worked_date on tbl_petrol.ptrl_code = tbl_petrol_worked_date.ptrl_code 
                and tbl_petrol_worked_date.wrk_date_code = '0'
                and tbl_petrol_worked_date.ptrl_worked_date_flag = '1'

                inner join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code
                and tbl_petrol_group.ptrl_group_flag = '1'

                inner join tbl_order_item on xmaster.ord_code = tbl_order_item.ord_code
                and tbl_order_item.ord_item_flag = '1'
                inner join tbl_item on tbl_order_item.itm_code = tbl_item.itm_code
                and tbl_item.itm_flag = '1'

                inner join tbl_order_compartment on tbl_order_item.ord_code = tbl_order_compartment.ord_code
                and tbl_order_item.itm_code = tbl_order_compartment.itm_code
                and tbl_order_item.ptrl_tank_code = tbl_order_compartment.ptrl_tank_code
                and tbl_order_compartment.ord_veh_compartment_flag = '1'

                inner join tbl_petrol_tank on tbl_petrol.ptrl_code = tbl_petrol_tank.ptrl_code
                and tbl_order_compartment.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code
                and tbl_petrol_tank.ptrl_tank_flag = '1'

                inner join tbl_vehicle on xmaster.veh_code = tbl_vehicle.veh_code

                inner join tbl_order on xmaster.ord_code = tbl_order.ord_code
                and tbl_order.ord_flag = '1' 
                group by carrier_name, job_code, tms_transport_code, shipments_code, job_dt, shift, veh_number, veh_license_number, trip, count_drop, 
                xmaster.gsap_order_number, xmaster.gsap_shipments_number, transit_start_dt, transit_end_dt, transit_minute, xmaster.distance, 
                uom_km, tbl_order_depot.dpo_code, dpo_number, dpo_desc, tbl_depot.dpo_address, ptrl_number, ptrl_desc, tbl_petrol.ptrl_address, 
                tbl_petrol.ptrl_zip_code, itm_material_number, 
                tbl_item.itm_desc, tbl_order_compartment.item_quantity, uom_l, delivery, time_window, dseq, job_status, trip_type, item_weight, uom_kg, ord_comment, loading_start_dt, 
                loading_end_dt, ptrl_group_desc, tbl_petrol_group.ptrl_group_code, tbl_order_compartment.ptrl_tank_code, tbl_petrol_tank.ptrl_tank_code, tnk_number, 
                unloading_start_dt, unloading_end_dt, tbl_order_compartment.veh_compartment_code) xtable_master

                group by trip, dseq, ptrl_number, tms_transport_code, gsap_shipments_number, ptrl_number, dpo_number, veh_number
                order by tms_transport_code, trip, dseq`;
            }
            else {
                script = `select 'V-00004' as shell_code, trip, dseq, ptrl_number, tms_transport_code, gsap_shipments_number, ptrl_number, dpo_number, veh_number,
                sum(item_quantity) as item_quantity

                from 
                (select 'PONGRAWE CO LTD' :: text as carrier_name, job_code, tms_transport_code, tbl_order.shipments_code, job_dt,
                case when substring(tbl_vehicle.veh_number,0,4) = 'PRV' then '1' else  '2' end as shift, veh_number, veh_license_number, xmaster.trip,
                xmaster.unloading_count as count_drop, xmaster.gsap_order_number, xmaster.gsap_shipments_number, transit_start_dt, transit_end_dt, transit_minute, 
                xmaster.distance, 'KM' :: text as uom_km, tbl_order_depot.dpo_code ,dpo_number, 
                dpo_desc, tbl_depot.dpo_address, ptrl_number, ptrl_desc, tbl_petrol.ptrl_address, tbl_petrol.ptrl_zip_code, itm_material_number, tbl_item.itm_desc, tbl_order_compartment.item_quantity, 
                'L' :: text as uom_l, '-' :: text as delivery,concat(tbl_petrol_worked_date.ptrl_open_tiime,' - ',tbl_petrol_worked_date.ptrl_close_time) :: text as time_window , 
                ((select count(distinct ptrl_code) + 1 from tbl_order_petrol odp
                where to_char(odp.unloading_start_dt, 'YYYY-MM-DD HH24:MI:SS') > to_char(tbl_order_petrol.unloading_start_dt, 'YYYY-MM-DD 00:00:00') 
                and to_char(odp.unloading_start_dt, 'YYYY-MM-DD HH24:MI:SS') < to_char(tbl_order_petrol.unloading_start_dt, 'YYYY-MM-DD HH24:MI:SS')
                and odp.ord_code in (select ord_code from tbl_job_order where tbl_job_order.job_code = xmaster.job_code))) as dseq
                ,job_status, 'Road Delivery' :: text as trip_type, 
                tbl_order_compartment.item_quantity * tbl_item.itm_weight_litr_per_kg as item_weight,
                'KG' :: text as uom_kg, tbl_order.ord_comment, tbl_order_depot.loading_start_dt, tbl_order_depot.loading_end_dt, 
                ptrl_group_desc, tbl_petrol_group.ptrl_group_code, tbl_petrol_tank.ptrl_tank_code, tbl_petrol_tank.tnk_number,
                tbl_order_petrol.unloading_start_dt, tbl_order_petrol.unloading_end_dt, tbl_order_compartment.veh_compartment_code

                from 
                (select (select count(job_code) + 1 as trip from tbl_job jb
                where jb.veh_code = tbl_job.veh_code 
                and to_char(jb.transit_start_dt, 'YYYY-MM-DD HH24:MI:SS') > to_char(tbl_job.transit_start_dt, 'YYYY-MM-DD 00:00:00') 
                and to_char(jb.transit_start_dt, 'YYYY-MM-DD HH24:MI:SS') < to_char(tbl_job.transit_start_dt, 'YYYY-MM-DD HH24:MI:SS')) as trip,tbl_job.job_code,job_status,
                tbl_job_order.ord_code,tbl_job.veh_code,tms_transport_code,job_dt, transit_start_dt, transit_end_dt, transit_minute, tbl_job.unloading_count, tbl_job.distance, 
                tbl_job.gsap_order_number, tbl_job.gsap_shipments_number
                from tbl_job
                inner join tbl_job_order on tbl_job.job_code = tbl_job_order.job_code
                inner join tbl_order on tbl_job_order.ord_code = tbl_order.ord_code
                where job_dt >= '${start_date} 00:00:00' and job_dt <= '${end_date} 23:59:59' 
                and tbl_job.transporeon_status = 'A' and tbl_job.off_code = '${off_code}'  
                and tbl_job.job_flag = '1' and tbl_order.ord_flag = '1') xmaster

                inner join tbl_order_depot on xmaster.ord_code = tbl_order_depot.ord_code
                and tbl_order_depot.ord_depot_flag = '1'
                inner join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code 

                inner join tbl_order_petrol on xmaster.ord_code = tbl_order_petrol.ord_code
                and tbl_order_petrol.ord_petrol_flag = '1'
                inner join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
                and tbl_petrol.ptrl_flag = '1' 

                inner join tbl_petrol_worked_date on tbl_petrol.ptrl_code = tbl_petrol_worked_date.ptrl_code 
                and tbl_petrol_worked_date.wrk_date_code = '0'
                and tbl_petrol_worked_date.ptrl_worked_date_flag = '1'

                inner join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code
                and tbl_petrol_group.ptrl_group_flag = '1'

                inner join tbl_order_item on xmaster.ord_code = tbl_order_item.ord_code
                and tbl_order_item.ord_item_flag = '1'
                inner join tbl_item on tbl_order_item.itm_code = tbl_item.itm_code
                and tbl_item.itm_flag = '1'

                inner join tbl_order_compartment on tbl_order_item.ord_code = tbl_order_compartment.ord_code
                and tbl_order_item.itm_code = tbl_order_compartment.itm_code
                and tbl_order_item.ptrl_tank_code = tbl_order_compartment.ptrl_tank_code
                and tbl_order_compartment.ord_veh_compartment_flag = '1'

                inner join tbl_petrol_tank on tbl_petrol.ptrl_code = tbl_petrol_tank.ptrl_code
                and tbl_order_compartment.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code
                and tbl_petrol_tank.ptrl_tank_flag = '1'

                inner join tbl_vehicle on xmaster.veh_code = tbl_vehicle.veh_code

                inner join tbl_order on xmaster.ord_code = tbl_order.ord_code
                and tbl_order.ord_flag = '1' 
                group by carrier_name, job_code, tms_transport_code, shipments_code, job_dt, shift, veh_number, veh_license_number, trip, count_drop, 
                xmaster.gsap_order_number, xmaster.gsap_shipments_number, transit_start_dt, transit_end_dt, transit_minute, xmaster.distance, 
                uom_km, tbl_order_depot.dpo_code, dpo_number, dpo_desc, tbl_depot.dpo_address, ptrl_number, ptrl_desc, tbl_petrol.ptrl_address, 
                tbl_petrol.ptrl_zip_code, itm_material_number, 
                tbl_item.itm_desc, tbl_order_compartment.item_quantity, uom_l, delivery, time_window, dseq, job_status, trip_type, item_weight, uom_kg, ord_comment, loading_start_dt, 
                loading_end_dt, ptrl_group_desc, tbl_petrol_group.ptrl_group_code, tbl_order_compartment.ptrl_tank_code, tbl_petrol_tank.ptrl_tank_code, tnk_number, 
                unloading_start_dt, unloading_end_dt, tbl_order_compartment.veh_compartment_code) xtable_master

                group by trip, dseq, ptrl_number, tms_transport_code, gsap_shipments_number, ptrl_number, dpo_number, veh_number
                order by tms_transport_code, trip, dseq`;
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
                    await xglobal.action_logs(lic_code, tbl_temporary.data[0].emp_code, 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'success', tbl_temporary.data[0].off_code);
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
                    message: `ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
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
        await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
        return;
    });
}

exports.getReportTripForUploadInformationV2 = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { start_date, end_date, ptrl_group_code, veh_group_code, off_code } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (start_date == undefined || end_date == undefined || ptrl_group_code == undefined || off_code == undefined || lic_code == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return
        } else {

            if (veh_group_code == undefined) {
                veh_group_code = '';
            }

            let script = ``;
            if (ptrl_group_code.toString().toUpperCase() != 'ALL') {
                script = `select 'V-00004' as shell_code, trip, dseq, ptrl_number, tms_transport_code, shipments_code, gsap_shipments_number, ptrl_number, dpo_number, veh_number,
                sum(item_quantity) as item_quantity

                from 
                (select 'PONGRAWE CO LTD' :: text as carrier_name, job_code, tms_transport_code, tbl_order.shipments_code, job_dt,
                case when substring(tbl_vehicle.veh_number,0,4) = 'PRV' then '1' else  '2' end as shift, substring(tbl_vehicle.veh_number,0,7) as veh_number, veh_license_number, xmaster.trip,
                xmaster.unloading_count as count_drop, xmaster.gsap_order_number, xmaster.gsap_shipments_number, transit_start_dt, transit_end_dt, transit_minute, 
                xmaster.distance, 'KM' :: text as uom_km, tbl_order_depot.dpo_code ,dpo_number, 
                dpo_desc, tbl_depot.dpo_address, ptrl_number, ptrl_desc, tbl_petrol.ptrl_address, tbl_petrol.ptrl_zip_code, itm_material_number, tbl_item.itm_desc, tbl_order_compartment.item_quantity, 
                'L' :: text as uom_l, '-' :: text as delivery,concat(tbl_petrol_worked_date.ptrl_open_tiime,' - ',tbl_petrol_worked_date.ptrl_close_time) :: text as time_window , 
                ((select count(distinct ptrl_code) + 1 from tbl_order_petrol odp
                where to_char(odp.unloading_start_dt, 'YYYY-MM-DD HH24:MI:SS') > to_char(tbl_order_petrol.unloading_start_dt, 'YYYY-MM-DD 00:00:00') 
                and to_char(odp.unloading_start_dt, 'YYYY-MM-DD HH24:MI:SS') < to_char(tbl_order_petrol.unloading_start_dt, 'YYYY-MM-DD HH24:MI:SS')
                and odp.ord_code in (select ord_code from tbl_job_order where tbl_job_order.job_code = xmaster.job_code))) as dseq
                ,job_status, 'Road Delivery' :: text as trip_type, 
                tbl_order_compartment.item_quantity * tbl_item.itm_weight_litr_per_kg as item_weight,
                'KG' :: text as uom_kg, tbl_order.ord_comment, tbl_order_depot.loading_start_dt, tbl_order_depot.loading_end_dt, 
                ptrl_group_desc, tbl_petrol_group.ptrl_group_code, tbl_petrol_tank.ptrl_tank_code, tbl_petrol_tank.tnk_number,
                tbl_order_petrol.unloading_start_dt, tbl_order_petrol.unloading_end_dt, tbl_order_compartment.veh_compartment_code

                from 
                (select (select count(job_code) + 1 as trip from tbl_job jb
                where jb.veh_code = tbl_job.veh_code 
                and to_char(jb.transit_start_dt, 'YYYY-MM-DD HH24:MI:SS') > to_char(tbl_job.transit_start_dt, 'YYYY-MM-DD 00:00:00') 
                and to_char(jb.transit_start_dt, 'YYYY-MM-DD HH24:MI:SS') < to_char(tbl_job.transit_start_dt, 'YYYY-MM-DD HH24:MI:SS')) as trip,tbl_job.job_code,job_status,
                tbl_job_order.ord_code,tbl_job.veh_code,tms_transport_code,job_dt, transit_start_dt, transit_end_dt, transit_minute, tbl_job.unloading_count, tbl_job.distance, 
                tbl_job.gsap_order_number, tbl_job.gsap_shipments_number
                from tbl_job
                inner join tbl_job_order on tbl_job.job_code = tbl_job_order.job_code
                inner join tbl_order on tbl_job_order.ord_code = tbl_order.ord_code
                where job_dt >= '${start_date} 00:00:00' and job_dt <= '${end_date} 23:59:59' 
                and tbl_job.transporeon_status = 'A' and tbl_job.off_code = '${off_code}'  
                and tbl_job.job_flag = '1' and tbl_order.ord_flag = '1') xmaster

                inner join tbl_order_depot on xmaster.ord_code = tbl_order_depot.ord_code
                and tbl_order_depot.ord_depot_flag = '1'
                inner join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code 

                inner join tbl_order_petrol on xmaster.ord_code = tbl_order_petrol.ord_code
                and tbl_order_petrol.ord_petrol_flag = '1'
                inner join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
                and tbl_petrol.ptrl_flag = '1' and tbl_petrol.ptrl_group_code = '${ptrl_group_code}'

                inner join tbl_petrol_worked_date on tbl_petrol.ptrl_code = tbl_petrol_worked_date.ptrl_code 
                and tbl_petrol_worked_date.wrk_date_code = '0'
                and tbl_petrol_worked_date.ptrl_worked_date_flag = '1'

                inner join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code
                and tbl_petrol_group.ptrl_group_flag = '1'

                inner join tbl_order_item on xmaster.ord_code = tbl_order_item.ord_code
                and tbl_order_item.ord_item_flag = '1'
                inner join tbl_item on tbl_order_item.itm_code = tbl_item.itm_code
                and tbl_item.itm_flag = '1'

                inner join tbl_order_compartment on tbl_order_item.ord_code = tbl_order_compartment.ord_code
                and tbl_order_item.itm_code = tbl_order_compartment.itm_code
                and tbl_order_item.ptrl_tank_code = tbl_order_compartment.ptrl_tank_code
                and tbl_order_compartment.ord_veh_compartment_flag = '1'

                inner join tbl_petrol_tank on tbl_petrol.ptrl_code = tbl_petrol_tank.ptrl_code
                and tbl_order_compartment.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code
                and tbl_petrol_tank.ptrl_tank_flag = '1'

                inner join tbl_vehicle on xmaster.veh_code = tbl_vehicle.veh_code

                inner join tbl_order on xmaster.ord_code = tbl_order.ord_code
                and tbl_order.ord_flag = '1' 

                ${veh_group_code.toString().toUpperCase() != 'ALL' ? `where tbl_vehicle.veh_group_code = '${veh_group_code}'` : ''}

                group by carrier_name, job_code, tms_transport_code, shipments_code, job_dt, shift, veh_number, veh_license_number, trip, count_drop, 
                xmaster.gsap_order_number, xmaster.gsap_shipments_number, transit_start_dt, transit_end_dt, transit_minute, xmaster.distance, 
                uom_km, tbl_order_depot.dpo_code, dpo_number, dpo_desc, tbl_depot.dpo_address, ptrl_number, ptrl_desc, tbl_petrol.ptrl_address, 
                tbl_petrol.ptrl_zip_code, itm_material_number, 
                tbl_item.itm_desc, tbl_order_compartment.item_quantity, uom_l, delivery, time_window, dseq, job_status, trip_type, item_weight, uom_kg, ord_comment, loading_start_dt, 
                loading_end_dt, ptrl_group_desc, tbl_petrol_group.ptrl_group_code, tbl_order_compartment.ptrl_tank_code, tbl_petrol_tank.ptrl_tank_code, tnk_number, 
                unloading_start_dt, unloading_end_dt, tbl_order_compartment.veh_compartment_code) xtable_master

                group by trip, dseq, ptrl_number, tms_transport_code, shipments_code, gsap_shipments_number, ptrl_number, dpo_number, veh_number
                order by tms_transport_code, trip, dseq`;
            }
            else {
                script = `select 'V-00004' as shell_code, trip, dseq, ptrl_number, tms_transport_code, shipments_code, gsap_shipments_number, ptrl_number, dpo_number, veh_number,
                sum(item_quantity) as item_quantity

                from 
                (select 'PONGRAWE CO LTD' :: text as carrier_name, job_code, tms_transport_code, tbl_order.shipments_code, job_dt,
                case when substring(tbl_vehicle.veh_number,0,4) = 'PRV' then '1' else  '2' end as shift, substring(tbl_vehicle.veh_number,0,7) as veh_number, veh_license_number, xmaster.trip,
                xmaster.unloading_count as count_drop, xmaster.gsap_order_number, xmaster.gsap_shipments_number, transit_start_dt, transit_end_dt, transit_minute, 
                xmaster.distance, 'KM' :: text as uom_km, tbl_order_depot.dpo_code ,dpo_number, 
                dpo_desc, tbl_depot.dpo_address, ptrl_number, ptrl_desc, tbl_petrol.ptrl_address, tbl_petrol.ptrl_zip_code, itm_material_number, tbl_item.itm_desc, tbl_order_compartment.item_quantity, 
                'L' :: text as uom_l, '-' :: text as delivery,concat(tbl_petrol_worked_date.ptrl_open_tiime,' - ',tbl_petrol_worked_date.ptrl_close_time) :: text as time_window , 
                ((select count(distinct ptrl_code) + 1 from tbl_order_petrol odp
                where to_char(odp.unloading_start_dt, 'YYYY-MM-DD HH24:MI:SS') > to_char(tbl_order_petrol.unloading_start_dt, 'YYYY-MM-DD 00:00:00') 
                and to_char(odp.unloading_start_dt, 'YYYY-MM-DD HH24:MI:SS') < to_char(tbl_order_petrol.unloading_start_dt, 'YYYY-MM-DD HH24:MI:SS')
                and odp.ord_code in (select ord_code from tbl_job_order where tbl_job_order.job_code = xmaster.job_code))) as dseq
                ,job_status, 'Road Delivery' :: text as trip_type, 
                tbl_order_compartment.item_quantity * tbl_item.itm_weight_litr_per_kg as item_weight,
                'KG' :: text as uom_kg, tbl_order.ord_comment, tbl_order_depot.loading_start_dt, tbl_order_depot.loading_end_dt, 
                ptrl_group_desc, tbl_petrol_group.ptrl_group_code, tbl_petrol_tank.ptrl_tank_code, tbl_petrol_tank.tnk_number,
                tbl_order_petrol.unloading_start_dt, tbl_order_petrol.unloading_end_dt, tbl_order_compartment.veh_compartment_code

                from 
                (select (select count(job_code) + 1 as trip from tbl_job jb
                where jb.veh_code = tbl_job.veh_code 
                and to_char(jb.transit_start_dt, 'YYYY-MM-DD HH24:MI:SS') > to_char(tbl_job.transit_start_dt, 'YYYY-MM-DD 00:00:00') 
                and to_char(jb.transit_start_dt, 'YYYY-MM-DD HH24:MI:SS') < to_char(tbl_job.transit_start_dt, 'YYYY-MM-DD HH24:MI:SS')) as trip,tbl_job.job_code,job_status,
                tbl_job_order.ord_code,tbl_job.veh_code,tms_transport_code,job_dt, transit_start_dt, transit_end_dt, transit_minute, tbl_job.unloading_count, tbl_job.distance, 
                tbl_job.gsap_order_number, tbl_job.gsap_shipments_number
                from tbl_job
                inner join tbl_job_order on tbl_job.job_code = tbl_job_order.job_code
                inner join tbl_order on tbl_job_order.ord_code = tbl_order.ord_code
                where job_dt >= '${start_date} 00:00:00' and job_dt <= '${end_date} 23:59:59' 
                and tbl_job.transporeon_status = 'A' and tbl_job.off_code = '${off_code}'  
                and tbl_job.job_flag = '1' and tbl_order.ord_flag = '1') xmaster

                inner join tbl_order_depot on xmaster.ord_code = tbl_order_depot.ord_code
                and tbl_order_depot.ord_depot_flag = '1'
                inner join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code 

                inner join tbl_order_petrol on xmaster.ord_code = tbl_order_petrol.ord_code
                and tbl_order_petrol.ord_petrol_flag = '1'
                inner join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
                and tbl_petrol.ptrl_flag = '1' 

                inner join tbl_petrol_worked_date on tbl_petrol.ptrl_code = tbl_petrol_worked_date.ptrl_code 
                and tbl_petrol_worked_date.wrk_date_code = '0'
                and tbl_petrol_worked_date.ptrl_worked_date_flag = '1'

                inner join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code
                and tbl_petrol_group.ptrl_group_flag = '1'

                inner join tbl_order_item on xmaster.ord_code = tbl_order_item.ord_code
                and tbl_order_item.ord_item_flag = '1'
                inner join tbl_item on tbl_order_item.itm_code = tbl_item.itm_code
                and tbl_item.itm_flag = '1'

                inner join tbl_order_compartment on tbl_order_item.ord_code = tbl_order_compartment.ord_code
                and tbl_order_item.itm_code = tbl_order_compartment.itm_code
                and tbl_order_item.ptrl_tank_code = tbl_order_compartment.ptrl_tank_code
                and tbl_order_compartment.ord_veh_compartment_flag = '1'

                inner join tbl_petrol_tank on tbl_petrol.ptrl_code = tbl_petrol_tank.ptrl_code
                and tbl_order_compartment.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code
                and tbl_petrol_tank.ptrl_tank_flag = '1'

                inner join tbl_vehicle on xmaster.veh_code = tbl_vehicle.veh_code

                inner join tbl_order on xmaster.ord_code = tbl_order.ord_code
                and tbl_order.ord_flag = '1' 

                ${veh_group_code.toString().toUpperCase() != 'ALL' ? `where tbl_vehicle.veh_group_code = '${veh_group_code}'` : ''}
                
                group by carrier_name, job_code, tms_transport_code, shipments_code, job_dt, shift, veh_number, veh_license_number, trip, count_drop, 
                xmaster.gsap_order_number, xmaster.gsap_shipments_number, transit_start_dt, transit_end_dt, transit_minute, xmaster.distance, 
                uom_km, tbl_order_depot.dpo_code, dpo_number, dpo_desc, tbl_depot.dpo_address, ptrl_number, ptrl_desc, tbl_petrol.ptrl_address, 
                tbl_petrol.ptrl_zip_code, itm_material_number, 
                tbl_item.itm_desc, tbl_order_compartment.item_quantity, uom_l, delivery, time_window, dseq, job_status, trip_type, item_weight, uom_kg, ord_comment, loading_start_dt, 
                loading_end_dt, ptrl_group_desc, tbl_petrol_group.ptrl_group_code, tbl_order_compartment.ptrl_tank_code, tbl_petrol_tank.ptrl_tank_code, tnk_number, 
                unloading_start_dt, unloading_end_dt, tbl_order_compartment.veh_compartment_code) xtable_master

                group by trip, dseq, ptrl_number, tms_transport_code, shipments_code, gsap_shipments_number, ptrl_number, dpo_number, veh_number
                order by tms_transport_code, trip, dseq`;
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
                    await xglobal.action_logs(lic_code, tbl_temporary.data[0].emp_code, 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'success', tbl_temporary.data[0].off_code);
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
                    message: `ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
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
        await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
        return;
    });
}

exports.getReportTripInformation = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { start_date, end_date, veh_group_code, dpo_code, off_code } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (start_date == undefined || end_date == undefined || veh_group_code == undefined || dpo_code == undefined || off_code == undefined || lic_code == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return
        } else {

            let script = `select veh_group_code ,veh_group_desc, shell_desc, gsap_shipments_number, shipments_code, tms_transport_code, transit_start_dt, transit_end_dt, transit_minute, loading_dt, total_date, trip, row_number() over (partition by gsap_shipments_number order by shipments_code) as dseq,total_driver, unloading_count, distance, ptrl_number, ptrl_desc, dpo_code, dpo_number, dpo_desc, job_comment, veh_number, veh_license_number, dver_name, dver_surname, item_quantity, 
            item_desc1, item_quantity1, item_desc2, item_quantity2, item_desc3, item_quantity3, item_desc4, item_quantity4, item_desc5, item_quantity5, item_desc6, item_quantity6

            from 
            (select tbl_vehicle.veh_group_code, case when tbl_vehicle_group.veh_group_desc is null then '-' else tbl_vehicle_group.veh_group_desc end as veh_group_desc, 
            'บริษัท เชลล์แห่งประเทศไทย จำกัด' as shell_desc, tbl_job.gsap_shipments_number, tbl_order.shipments_code, tbl_job.tms_transport_code, 
            tbl_job.transit_start_dt, tbl_job.transit_end_dt, tbl_job.transit_minute, 
            (select max(xdepot.loading_start_dt) as loading_start_dt from tbl_order_depot xdepot where xdepot.ord_code in 
            (select ord_code from tbl_job_order xjob where xjob.job_code = tbl_job.job_code)) as loading_dt,1 as total_date, 1 as trip, 1 as dseq, 1 as total_driver,
            tbl_job.unloading_count,tbl_job.distance, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, tbl_order_depot.dpo_code ,tbl_depot.dpo_number, tbl_depot.dpo_desc,
            case when tbl_job.job_comment is null or tbl_job.job_comment = '' then tbl_order.ord_comment else tbl_job.job_comment end as job_comment,
            tbl_vehicle.veh_number, tbl_vehicle.veh_license_number, tbl_driver.dver_name, tbl_driver.dver_surname, sum(tbl_order_item.item_quantity) as item_quantity,
            (select x2item.itm_desc from tbl_order_item xitem_order left join tbl_item x2item on xitem_order.itm_code = x2item.itm_code where xitem_order.ord_code = tbl_order.ord_code offset 0 limit 1) as item_desc1,
            (select case when xitem_order.item_quantity is null then 0 else xitem_order.item_quantity end as item_quantity from tbl_order_item xitem_order left join tbl_item x2item on xitem_order.itm_code = x2item.itm_code where xitem_order.ord_code = tbl_order.ord_code offset 0 limit 1)  as item_quantity1,

            (select x2item.itm_desc from tbl_order_item xitem_order left join tbl_item x2item on xitem_order.itm_code = x2item.itm_code where xitem_order.ord_code = tbl_order.ord_code offset 1 limit 1) as item_desc2,
            (select case when xitem_order.item_quantity is null then 0 else xitem_order.item_quantity end as item_quantity from tbl_order_item xitem_order left join tbl_item x2item on xitem_order.itm_code = x2item.itm_code where xitem_order.ord_code = tbl_order.ord_code offset 1 limit 1)  as item_quantity2,

            (select x2item.itm_desc from tbl_order_item xitem_order left join tbl_item x2item on xitem_order.itm_code = x2item.itm_code where xitem_order.ord_code = tbl_order.ord_code offset 2 limit 1) as item_desc3,
            (select case when xitem_order.item_quantity is null then 0 else xitem_order.item_quantity end as item_quantity from tbl_order_item xitem_order left join tbl_item x2item on xitem_order.itm_code = x2item.itm_code where xitem_order.ord_code = tbl_order.ord_code offset 2 limit 1)  as item_quantity3,

            (select x2item.itm_desc from tbl_order_item xitem_order left join tbl_item x2item on xitem_order.itm_code = x2item.itm_code where xitem_order.ord_code = tbl_order.ord_code offset 3 limit 1) as item_desc4,
            (select case when xitem_order.item_quantity is null then 0 else xitem_order.item_quantity end as item_quantity from tbl_order_item xitem_order left join tbl_item x2item on xitem_order.itm_code = x2item.itm_code where xitem_order.ord_code = tbl_order.ord_code offset 3 limit 1)  as item_quantity4,

            (select x2item.itm_desc from tbl_order_item xitem_order left join tbl_item x2item on xitem_order.itm_code = x2item.itm_code where xitem_order.ord_code = tbl_order.ord_code offset 4 limit 1) as item_desc5,
            (select case when xitem_order.item_quantity is null then 0 else xitem_order.item_quantity end as item_quantity from tbl_order_item xitem_order left join tbl_item x2item on xitem_order.itm_code = x2item.itm_code where xitem_order.ord_code = tbl_order.ord_code offset 4 limit 1)  as item_quantity5,

            (select x2item.itm_desc from tbl_order_item xitem_order left join tbl_item x2item on xitem_order.itm_code = x2item.itm_code where xitem_order.ord_code = tbl_order.ord_code offset 5 limit 1) as item_desc6,
            (select case when xitem_order.item_quantity is null then 0 else xitem_order.item_quantity end as item_quantity from tbl_order_item xitem_order left join tbl_item x2item on xitem_order.itm_code = x2item.itm_code where xitem_order.ord_code = tbl_order.ord_code offset 5 limit 1)  as item_quantity6 

            from tbl_job 
            left join tbl_job_order on tbl_job.job_code = tbl_job_order.job_code
            left join tbl_order on tbl_job_order.ord_code = tbl_order.ord_code
            left join tbl_vehicle on tbl_job.veh_code = tbl_vehicle.veh_code
            left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code
            left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
            left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code
            left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code
            left join tbl_driver on tbl_job.dver_code = tbl_driver.dver_code
            left join tbl_order_item on tbl_order_petrol.ord_code = tbl_order_item.ord_code 
            left join tbl_vehicle_group on tbl_vehicle.veh_group_code = tbl_vehicle_group.veh_group_code
            and tbl_order_petrol.itm_code = tbl_order_item.itm_code
            and tbl_order_petrol.ptrl_tank_code = tbl_order_item.ptrl_tank_code

            where job_dt >= '${start_date} 00:00:00' and job_dt <= '${end_date} 23:59:59' 
            and tbl_job.transporeon_status = 'A' and tbl_job.off_code = '${off_code}' 
            group by tbl_vehicle.veh_group_code ,tbl_vehicle_group.veh_group_desc, tbl_job.gsap_shipments_number, tbl_order.shipments_code, tbl_job.tms_transport_code, 
            tbl_job.transit_start_dt, tbl_job.transit_end_dt, tbl_job.transit_minute, 
            loading_dt,total_date,trip,dseq,total_driver,
            tbl_job.unloading_count,tbl_job.distance, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, tbl_order_depot.dpo_code ,tbl_depot.dpo_number, tbl_depot.dpo_desc,
            tbl_job.job_comment,tbl_order_petrol.unloading_start_dt,
            tbl_vehicle.veh_number, tbl_vehicle.veh_license_number, tbl_driver.dver_name, tbl_driver.dver_surname, tbl_job.item_quantity 
            order by tbl_job.tms_transport_code asc, tbl_order_petrol.unloading_start_dt) tbl_master 
            where dpo_code is not null `;

            if (veh_group_code.toString().toUpperCase() != 'ALL') {
                script += ` and veh_group_code = '${veh_group_code}' `
            }

            if (dpo_code.toString().toUpperCase() != 'ALL') {
                script += ` and dpo_code = '${dpo_code}' `
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
                    await xglobal.action_logs(lic_code, tbl_temporary.data[0].emp_code, 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'success', tbl_temporary.data[0].off_code);
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
                    message: `ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
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
        await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
        return;
    });
}

exports.getReportTaskPlan = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { start_date, end_date, veh_group_code, dpo_code, off_code } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (start_date == undefined || end_date == undefined || veh_group_code == undefined || dpo_code == undefined || off_code == undefined || lic_code == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return
        } else {

            let script = `select trip_sequence, job_code, veh_group_code, veh_group_desc, veh_number, veh_license_number, job_dt, tms_transport_code, 
            transit_minute, distance, dpo_code, dpo_number, dpo_desc, dpo_address, sum(item_quantity) as item_quantity, routes, veh_loading_minute, veh_unloading_minute 

            from 
            (select trip_sequence, job_code,
            tbl_vehicle.veh_group_code, tbl_vehicle_group.veh_group_desc, veh_number, veh_license_number, job_dt, tms_transport_code, 
            transit_minute, xmaster.distance, tbl_order_depot.dpo_code ,dpo_number, dpo_desc, tbl_depot.dpo_address, 
            tbl_order_compartment.item_quantity ,'' :: text as routes, tbl_order_compartment.ptrl_tank_code,
            tbl_vehicle_type.loading_minute as veh_loading_minute, tbl_vehicle_type.unloading_minute as veh_unloading_minute,
            tbl_order_compartment.veh_compartment_code 

            from 
            (select (select count(job_code) + 1 as trip from tbl_job jb
            where jb.veh_code = tbl_job.veh_code 
            and to_char(jb.transit_start_dt, 'YYYY-MM-DD HH24:MI:SS') > to_char(tbl_job.transit_start_dt, 'YYYY-MM-DD 00:00:00') 
            and to_char(jb.transit_start_dt, 'YYYY-MM-DD HH24:MI:SS') < to_char(tbl_job.transit_start_dt, 'YYYY-MM-DD HH24:MI:SS')) as trip_sequence,tbl_job.job_code,job_status,
            tbl_job_order.ord_code,tbl_job.veh_code,tms_transport_code,job_dt, transit_start_dt, transit_end_dt, transit_minute, tbl_job.unloading_count, tbl_job.distance, 
            tbl_job.gsap_order_number, tbl_job.gsap_shipments_number
            from tbl_job
            inner join tbl_job_order on tbl_job.job_code = tbl_job_order.job_code
            inner join tbl_order on tbl_job_order.ord_code = tbl_order.ord_code
            where job_dt >= '${start_date} 00:00:00' and job_dt <= '${end_date} 23:59:59' 
            and tbl_job.transporeon_status = 'A' and job_status in ('2','4') and tbl_job.veh_code is not null and tbl_job.off_code = '${off_code}'  
            and tbl_job.job_flag = '1' and tbl_order.ord_flag = '1') xmaster

            inner join tbl_order_depot on xmaster.ord_code = tbl_order_depot.ord_code
            and tbl_order_depot.ord_depot_flag = '1'
            inner join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code 

            inner join tbl_order_item on xmaster.ord_code = tbl_order_item.ord_code
            and tbl_order_item.ord_item_flag = '1'
            inner join tbl_item on tbl_order_item.itm_code = tbl_item.itm_code
            and tbl_item.itm_flag = '1'

            inner join tbl_order_compartment on tbl_order_item.ord_code = tbl_order_compartment.ord_code
            and tbl_order_item.itm_code = tbl_order_compartment.itm_code
            and tbl_order_item.ptrl_tank_code = tbl_order_compartment.ptrl_tank_code
            and tbl_order_compartment.ord_veh_compartment_flag = '1'

            inner join tbl_vehicle on xmaster.veh_code = tbl_vehicle.veh_code
            inner join tbl_vehicle_group on tbl_vehicle.veh_group_code = tbl_vehicle_group.veh_group_code
            inner join tbl_vehicle_type on tbl_vehicle.veh_type_code = tbl_vehicle_type.veh_type_code 
            where tbl_order_depot.dpo_code is not null `

            if (veh_group_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_vehicle.veh_group_code = '${veh_group_code}' `
            }

            if (dpo_code.toString().toUpperCase() != 'ALL') {
                script += ` and tbl_order_depot.dpo_code = '${dpo_code}' `
            }

            script += `group by trip_sequence, job_code,
            tbl_vehicle.veh_group_code, tbl_vehicle_group.veh_group_desc, veh_number, veh_license_number, job_dt, tms_transport_code, 
            transit_minute, xmaster.distance, tbl_order_depot.dpo_code ,dpo_number, dpo_desc, tbl_depot.dpo_address, 
            tbl_order_compartment.item_quantity, tbl_order_compartment.ptrl_tank_code, tbl_vehicle_type.loading_minute, 
            tbl_vehicle_type.loading_minute, unloading_minute, tbl_order_compartment.veh_compartment_code) xtable_master 

            group by trip_sequence, job_code, veh_group_code, veh_group_desc, veh_number, veh_license_number, job_dt, tms_transport_code, 
            transit_minute, distance, dpo_code, dpo_number, dpo_desc, dpo_address, routes, veh_loading_minute, veh_unloading_minute`

            let tbl_temporary = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
            if (!tbl_temporary.code) {
                //debugger
                if (tbl_temporary.data.length > 0) {
                    tbl_temporary.data = JSON.parse(JSON.stringify(tbl_temporary.data).replace(/\:null/gi, "\:\"\""));

                    for (var xxr = 0; xxr <= tbl_temporary.data.length - 1; xxr++) {
                        script = `select order_number, location_type_code, location_type_desc, location_code, location_number, location_desc, location_address, location_zip_code, location_country_code, location_lat, location_lon, location_city,
                        location_minute, min(start_dt) as start_dt, max(end_dt) as end_dt, location_distance, itm_code, itm_desc, itm_material_number, item_quantity, ptrl_tank_code

                        from 
                        (select '' as order_number,0 as seq,'start' :: text AS location_type_code, 'เวลาเริ่มงาน' :: text as location_type_desc ,'' as location_code,'' as location_number, '' as location_desc, 
                        '' as location_address,
                        '' as location_zip_code,
                        '' as location_country_code,
                        0.0 as location_lat,
                        0.0 as location_lon,
                        '' as location_city,
                        0 as location_minute, tbl_job.transit_start_dt as start_dt, tbl_job.transit_start_dt as end_dt, 
                        0.0 as location_distance,
                        '' as itm_code, 0 as item_quantity, '' as itm_material_number, '' as itm_desc,'' as ptrl_tank_code, '' as veh_compartment_code

                        from tbl_job
                        where tbl_job.job_code = '${tbl_temporary.data[xxr].job_code}'

                        union

                        select '' as order_number,1 as seq,'to' :: text AS location_type_code, 'ถึงคลัง' :: text as location_type_desc ,'' as location_code,'' as location_number, '' as location_desc, 
                        '' as location_address,
                        '' as location_zip_code,
                        '' as location_country_code,
                        0.0 as location_lat,
                        0.0 as location_lon,
                        '' as location_city,
                        0 as location_minute,(select min(loading_start_dt) - interval '1 minute' from tbl_order_depot
                        where tbl_order_depot.ord_code in (select ord_code from tbl_job_order where tbl_job_order.job_code = '${tbl_temporary.data[xxr].job_code}') ) as start_dt, 
                        (select min(loading_start_dt) - interval '1 minute' from tbl_order_depot
                        where tbl_order_depot.ord_code in (select ord_code from tbl_job_order where tbl_job_order.job_code = '${tbl_temporary.data[xxr].job_code}') ) as end_dt, 
                        0.0 as location_distance,
                        '' as itm_code, 0 as item_quantity, '' as itm_material_number, '' as itm_desc, '' as ptrl_tank_code, '' as veh_compartment_code

                        from tbl_job
                        where tbl_job.job_code = '${tbl_temporary.data[xxr].job_code}'

                        union

                        select tbl_order_depot.ord_code as order_number,2 as seq,'depot' :: text AS location_type_code, 'เข้าเติมที่คลัง' :: text as location_type_desc ,tbl_order_depot.dpo_code as location_code, tbl_depot.dpo_number as location_number, tbl_depot.dpo_desc as location_desc, 
                        case when tbl_order_depot.dpo_address is null then tbl_depot.dpo_address else tbl_order_depot.dpo_address end as location_address,
                        case when tbl_order_depot.dpo_zip_code is null then tbl_depot.dpo_zip_code else tbl_order_depot.dpo_zip_code end as location_zip_code,
                        case when tbl_order_depot.dpo_country_code is null then tbl_depot.dpo_country_code else tbl_order_depot.dpo_country_code end as location_country_code,
                        case when tbl_order_depot.dpo_lat is null then tbl_depot.dpo_lat else tbl_order_depot.dpo_lat end as location_lat,
                        case when tbl_order_depot.dpo_lon is null then tbl_depot.dpo_lon else tbl_order_depot.dpo_lon end as location_lon,
                        case when tbl_order_depot.dpo_city is null then tbl_depot.dpo_city else tbl_order_depot.dpo_city end as location_city,
                        (tbl_depot.dpo_loading_minute + ${tbl_temporary.data[xxr].veh_loading_minute}) as location_minute, tbl_order_depot.loading_start_dt as start_dt, tbl_order_depot.loading_end_dt as end_dt, 
                        case when tbl_order_depot.distance is null then 0.0 else tbl_order_depot.distance end as location_distance,
                        tbl_order_item.itm_code, tbl_order_compartment.item_quantity, tbl_item.itm_material_number, case when tbl_order_item.itm_desc is null then tbl_item.itm_desc else tbl_order_item.itm_desc end as itm_desc,
                        tbl_order_compartment.ptrl_tank_code, tbl_order_compartment.veh_compartment_code

                        from tbl_order
                        left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code
                        left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code
                        left join tbl_order_item on tbl_order.ord_code = tbl_order_item.ord_code
                        left join tbl_item on tbl_order_item.itm_code = tbl_item.itm_code
                        left join tbl_order_compartment on tbl_order_item.ord_code = tbl_order_compartment.ord_code
                        and tbl_order_item.itm_code = tbl_order_compartment.itm_code 
                        and tbl_order_item.ptrl_tank_code = tbl_order_compartment.ptrl_tank_code 
                        where tbl_order.ord_code in (select ord_code from tbl_job_order where tbl_job_order.job_code = '${tbl_temporary.data[xxr].job_code}') and tbl_order.ord_flag = '1' and tbl_order_depot.ord_depot_flag = '1'

                        union

                        select '' as order_number,3 as seq,'next' :: text AS location_type_code, 'เดินทาง' :: text as location_type_desc ,'' as location_code,'' as location_number, '' as location_desc, 
                        '' as location_address,
                        '' as location_zip_code,
                        '' as location_country_code,
                        0.0 as location_lat,
                        0.0 as location_lon,
                        '' as location_city,
                        0 as location_minute,(select max(loading_start_dt) + interval '1 minute' from tbl_order_depot
                        where tbl_order_depot.ord_code in (select ord_code from tbl_job_order where tbl_job_order.job_code = '${tbl_temporary.data[xxr].job_code}') ) as start_dt, 
                        (select max(loading_start_dt) + interval '1 minute' from tbl_order_depot
                        where tbl_order_depot.ord_code in (select ord_code from tbl_job_order where tbl_job_order.job_code = '${tbl_temporary.data[xxr].job_code}') ) as end_dt, 
                        0.0 as location_distance,
                        '' as itm_code, 0 as item_quantity, '' as itm_material_number, '' as itm_desc, '' as ptrl_tank_code, '' as veh_compartment_code

                        from tbl_job
                        where tbl_job.job_code = '${tbl_temporary.data[xxr].job_code}'

                        union

                        select '' as order_number,4 as seq,'to' :: text AS location_type_code, 'ถึงลูกค้า' :: text as location_type_desc ,'' as location_code,'' as location_number, '' as location_desc, 
                        '' as location_address,
                        '' as location_zip_code,
                        '' as location_country_code,
                        0.0 as location_lat,
                        0.0 as location_lon,
                        '' as location_city,
                        0 as location_minute,(select min(unloading_start_dt) - interval '1 minute' from tbl_order_petrol
                        where tbl_order_petrol.ord_code in (select ord_code from tbl_job_order where tbl_job_order.job_code = '${tbl_temporary.data[xxr].job_code}') ) as start_dt, 
                        (select min(unloading_start_dt) - interval '1 minute' from tbl_order_petrol
                        where tbl_order_petrol.ord_code in (select ord_code from tbl_job_order where tbl_job_order.job_code = '${tbl_temporary.data[xxr].job_code}') ) as end_dt, 
                        0.0 as location_distance,
                        '' as itm_code, 0 as item_quantity, '' as itm_material_number, '' as itm_desc, '' as ptrl_tank_code, '' as veh_compartment_code

                        from tbl_job
                        where tbl_job.job_code = '${tbl_temporary.data[xxr].job_code}'

                        union

                        select tbl_order_petrol.ord_code as order_number,5 as seq,'petrol' AS location_type_code, 'ลงน้ำมันที่ลูกค้า' as location_type_desc, tbl_order_petrol.ptrl_code as location_code, tbl_petrol.ptrl_number as location_number, tbl_petrol.ptrl_desc as location_desc, 
                        case when tbl_order_petrol.ptrl_address is null then tbl_petrol.ptrl_address else tbl_order_petrol.ptrl_address end as location_address,
                        case when tbl_order_petrol.ptrl_zip_code is null then tbl_petrol.ptrl_zip_code else tbl_order_petrol.ptrl_zip_code end as location_zip_code,
                        case when tbl_order_petrol.ptrl_country_code is null then tbl_petrol.ptrl_country_code else tbl_order_petrol.ptrl_country_code end as location_country_code,
                        case when tbl_order_petrol.ptrl_lat is null then tbl_petrol.ptrl_lat else tbl_order_petrol.ptrl_lat end as location_lat,
                        case when tbl_order_petrol.ptrl_lon is null then tbl_petrol.ptrl_lon else tbl_order_petrol.ptrl_lon end as location_lon,
                        case when tbl_order_petrol.ptrl_city is null then tbl_petrol.ptrl_city else tbl_order_petrol.ptrl_city end as location_city,
                        (tbl_petrol.ptrl_unloading_minute + ${tbl_temporary.data[xxr].veh_unloading_minute}) as location_minute, tbl_order_petrol.unloading_start_dt as start_dt, tbl_order_petrol.unloading_end_dt as end_dt,
                        case when tbl_order_petrol.distance is null then 0.0 else tbl_order_petrol.distance end as location_distance,
                        tbl_order_item.itm_code, tbl_order_compartment.item_quantity, tbl_item.itm_material_number, case when tbl_order_item.itm_desc is null then tbl_item.itm_desc else tbl_order_item.itm_desc end as itm_desc,
                        tbl_order_compartment.ptrl_tank_code, tbl_order_compartment.veh_compartment_code 

                        from tbl_order
                        left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code
                        left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
                        left join tbl_order_item on tbl_order.ord_code = tbl_order_item.ord_code
                        and tbl_order_item.ptrl_tank_code = tbl_order_petrol.ptrl_tank_code
                        left join tbl_item on tbl_order_item.itm_code = tbl_item.itm_code
                        left join tbl_order_compartment on tbl_order_item.ord_code = tbl_order_compartment.ord_code
                        and tbl_order_item.itm_code = tbl_order_compartment.itm_code 
                        and tbl_order_item.ptrl_tank_code = tbl_order_compartment.ptrl_tank_code 

                        where tbl_order.ord_code in (select ord_code from tbl_job_order where tbl_job_order.job_code = '${tbl_temporary.data[xxr].job_code}') and tbl_order.ord_flag = '1' and tbl_order_petrol.ord_petrol_flag = '1'

                        union

                        select '' as order_number,6 as seq,'back' :: text AS location_type_code, 'เดินทาง' :: text as location_type_desc ,'' as location_code,'' as location_number, '' as location_desc, 
                        '' as location_address,
                        '' as location_zip_code,
                        '' as location_country_code,
                        0.0 as location_lat,
                        0.0 as location_lon,
                        '' as location_city,
                        0 as location_minute,(select max(unloading_end_dt) + interval '0 minute' from tbl_order_petrol
                        where tbl_order_petrol.ord_code in (select ord_code from tbl_job_order where tbl_job_order.job_code = '${tbl_temporary.data[xxr].job_code}') ) as start_dt, 
                        (select max(unloading_end_dt) + interval '0 minute' from tbl_order_petrol
                        where tbl_order_petrol.ord_code in (select ord_code from tbl_job_order where tbl_job_order.job_code = '${tbl_temporary.data[xxr].job_code}') ) as end_dt, 
                        0.0 as location_distance,
                        '' as itm_code, 0 as item_quantity, '' as itm_material_number, '' as itm_desc, '' as ptrl_tank_code, '' as veh_compartment_code

                        from tbl_job
                        where tbl_job.job_code = '${tbl_temporary.data[xxr].job_code}'

                        union

                        select '' as order_number,7 as seq, 'parking' AS location_type_code, 'ถึงลานจอด' as location_type_desc ,tbl_job.pkg_code as location_code, tbl_depot.dpo_number as location_number, tbl_depot.dpo_desc as location_desc, 
                        tbl_depot.dpo_address as location_address,
                        tbl_depot.dpo_zip_code as location_zip_code,
                        tbl_depot.dpo_country_code as location_country_code,
                        tbl_depot.dpo_lat as location_lat,
                        tbl_depot.dpo_lon as location_lon,
                        tbl_depot.dpo_city as location_city,
                        0 as location_minute,
                        transit_end_dt as start_dt,tbl_job.transit_end_dt as end_dt, 0.0 as location_distance,
                        '' as itm_code, 0 as item_quantity, '' as itm_material_number, '' as itm_desc, '' as ptrl_tank_code, '' as veh_compartment_code

                        from tbl_job
                        left join tbl_depot on tbl_job.pkg_code = tbl_depot.dpo_code
                        where tbl_job.job_code = '${tbl_temporary.data[xxr].job_code}'

                        ) tbl_master

                        group by
                        order_number, seq, location_type_code, location_type_desc, location_code, location_number, location_desc, location_address, location_zip_code, location_country_code, location_lat, location_lon, location_city,
                        location_minute, location_distance, itm_code, itm_desc, itm_material_number, item_quantity, ptrl_tank_code, veh_compartment_code
                        order by seq, start_dt asc`

                        let tbl_temporary2 = await pgConn.get(dbPrefix + lic_code, script, config.connectionString());
                        if (!tbl_temporary2.code) {
                            tbl_temporary.data[xxr].routes = tbl_temporary2.data;
                        }

                        if (xxr == tbl_temporary.data.length - 1) {
                            let response = [{
                                status: 'success',
                                invalid_code: '0',
                                message: '',
                                data: tbl_temporary.data,
                                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                            }]

                            res.status(200).send(response);
                            await xglobal.action_logs(lic_code, tbl_temporary.data[0].emp_code, 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'success', tbl_temporary.data[0].off_code);
                            return;
                        }
                    }

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
                    message: `ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
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
        await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
        return;
    });
}

exports.getPresendPostsend = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { start_date, end_date, veh_group_code, ptrl_group_code, transporeon_status, off_code } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (start_date == undefined || end_date == undefined || veh_group_code == undefined || ptrl_group_code == undefined || off_code == undefined || lic_code == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return
        } else {

            if (transporeon_status == undefined) {
                transporeon_status = 'A';
            }

            script = `select dpo_code, dpo_number, dpo_desc, dpo_short_desc, dpo_address, dpo_zip_code, dpo_country_code, dpo_lat, dpo_lon, dpo_city, 
            dpo_loading_minute, ord_code, itm_code, itm_desc, itm_short_desc, itm_image, itm_material_number, itm_type_code, itm_type_desc, 
            itm_unit_code, itm_unit_desc, itm_unit_short_desc, sum(item_quantity) as item_quantity, ptrl_code, ptrl_number, ptrl_desc, ptrl_short_desc, 
            ptrl_address, ptrl_zip_code, ptrl_country_code, ptrl_lat, ptrl_lon, ptrl_city, ptrl_unloading_minute, ptrl_tank_code, tnk_number, job_code, job_status, 
            transporeon_status, job_comment, tms_transport_code, shipments_code, unloading_start_dt, deadlock_dt, tnk_capacity, tnk_target, tnk_deadstock, 
            expected_quantity, book_stock, book_stock_dt, average_daily_sales, veh_group_desc, ptrl_group_desc, ptrl_number

            from 
            (select xmaster.ord_code, tbl_depot.dpo_short_desc, tbl_depot.dpo_zip_code, tbl_depot.dpo_country_code,
            tbl_depot.dpo_lat, tbl_depot.dpo_lon, tbl_depot.dpo_city, tbl_depot.dpo_loading_minute, tbl_item.itm_code, tbl_item.itm_short_desc, 
            tbl_item.itm_image, tbl_item.itm_type_code, itm_type_desc, 
            tbl_item.itm_unit_code, tbl_item_unit.itm_unit_desc, tbl_item_unit.itm_unit_short_desc, tbl_petrol.ptrl_code,
            tbl_petrol.ptrl_short_desc, tbl_petrol.ptrl_country_code, tbl_petrol.ptrl_lat, tbl_petrol.ptrl_lon, 
            tbl_petrol.ptrl_city, tbl_petrol.ptrl_unloading_minute,tbl_order_item.item_quantity as expected_quantity
            ,tbl_vehicle_group.veh_group_desc,'PONGRAWE CO LTD' :: text as carrier_name, job_code, tms_transport_code, tbl_order.shipments_code, job_dt,
            case when substring(tbl_vehicle.veh_number,length(tbl_vehicle.veh_number),1) = 'N' then '2' else '1' end as shift, veh_number, veh_license_number, xmaster.trip,
            xmaster.unloading_count as count_drop, xmaster.gsap_order_number, xmaster.gsap_shipments_number, transit_start_dt, transit_end_dt, transit_minute, 
            xmaster.distance, 'KM' :: text as uom_km, tbl_depot.dpo_code ,dpo_number, 
            dpo_desc, tbl_depot.dpo_address, ptrl_number, ptrl_desc, tbl_petrol.ptrl_address, tbl_petrol.ptrl_zip_code, itm_material_number, 
            tbl_item.itm_desc, 'L' :: text as uom_l, '-' :: text as delivery,concat(tbl_petrol_worked_date.ptrl_open_tiime,' - ',tbl_petrol_worked_date.ptrl_close_time) :: text as time_window , 
            ((select count(distinct ptrl_code) + 1 from tbl_order_petrol odp
            where to_char(odp.unloading_start_dt, 'YYYY-MM-DD HH24:MI:SS') > to_char(tbl_order_petrol.unloading_start_dt, 'YYYY-MM-DD 00:00:00') 
            and to_char(odp.unloading_start_dt, 'YYYY-MM-DD HH24:MI:SS') < to_char(tbl_order_petrol.unloading_start_dt, 'YYYY-MM-DD HH24:MI:SS')
            and odp.ord_code in (select ord_code from tbl_job_order where tbl_job_order.job_code = xmaster.job_code))) as dseq
            ,job_status, 'Road Delivery' :: text as trip_type,'KG' :: text as uom_kg, tbl_order.ord_comment, tbl_order_depot.loading_start_dt, tbl_order_depot.loading_end_dt, 
            ptrl_group_desc, tbl_petrol_group.ptrl_group_code, tbl_order_compartment.ptrl_tank_code, tbl_petrol_tank.tnk_number,
            tbl_order_petrol.unloading_start_dt, tbl_order_petrol.unloading_end_dt, tbl_order_compartment.veh_compartment_code, xmaster.transporeon_status, xmaster.job_comment,
            max(tbl_order_petrol.deadlock_dt) as deadlock_dt, max(tbl_order_petrol.book_stock) as book_stock, max(tbl_order_petrol.book_stock_dt) as book_stock_dt, 
            max(tbl_order_petrol.average_daily_sales) as average_daily_sales, tbl_petrol_tank.tnk_capacity, tbl_petrol_tank.tnk_target, tbl_petrol_tank.tnk_deadstock,
            tbl_order_compartment.item_quantity  
            from 
            (select (select count(job_code) + 1 as trip from tbl_job jb
            where jb.veh_code = tbl_job.veh_code 
            and to_char(jb.transit_start_dt, 'YYYY-MM-DD HH24:MI:SS') > to_char(tbl_job.transit_start_dt, 'YYYY-MM-DD 00:00:00') 
            and to_char(jb.transit_start_dt, 'YYYY-MM-DD HH24:MI:SS') < to_char(tbl_job.transit_start_dt, 'YYYY-MM-DD HH24:MI:SS')) as trip,tbl_job.job_code,job_status,
            tbl_job_order.ord_code,tbl_job.veh_code,tms_transport_code,job_dt, transit_start_dt, transit_end_dt, transit_minute, tbl_job.unloading_count, tbl_job.distance, 
            tbl_job.gsap_order_number, tbl_job.gsap_shipments_number, tbl_job.ist_dt, tbl_job.mdf_dt, tbl_job.rm_dt, tbl_job.transporeon_status, tbl_job.job_comment  
            from tbl_job
            inner join tbl_job_order on tbl_job.job_code = tbl_job_order.job_code
            inner join tbl_order on tbl_job_order.ord_code = tbl_order.ord_code

            where job_dt >= '${start_date} 00:00:00' and job_dt <= '${end_date} 23:59:59' 
            ${(transporeon_status.toString().toUpperCase() != 'ALL' ? `and tbl_job.transporeon_status = '${transporeon_status}'` : '')}
            and tbl_job.job_flag = '1' and tbl_order.ord_flag = '1') xmaster

            inner join tbl_order_depot on xmaster.ord_code = tbl_order_depot.ord_code
            and tbl_order_depot.ord_depot_flag = '1'
            inner join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code 

            inner join tbl_order_petrol on xmaster.ord_code = tbl_order_petrol.ord_code
            and tbl_order_petrol.ord_petrol_flag = '1'
            inner join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
            and tbl_petrol.ptrl_flag = '1'

            inner join tbl_petrol_worked_date on tbl_petrol.ptrl_code = tbl_petrol_worked_date.ptrl_code 
            and tbl_petrol_worked_date.wrk_date_code = '0'
            and tbl_petrol_worked_date.ptrl_worked_date_flag = '1'

            inner join tbl_petrol_group on tbl_petrol.ptrl_group_code = tbl_petrol_group.ptrl_group_code
            and tbl_petrol_group.ptrl_group_flag = '1' 
            ${(ptrl_group_code.toString().toUpperCase() != 'ALL' ? `and tbl_petrol.ptrl_group_code = '${ptrl_group_code}'` : '')} 
            
            inner join tbl_order_item on xmaster.ord_code = tbl_order_item.ord_code
            and tbl_order_item.ord_item_flag = '1'
            inner join tbl_item on tbl_order_item.itm_code = tbl_item.itm_code
            and tbl_item.itm_flag = '1'
            inner join tbl_item_type on tbl_item.itm_type_code = tbl_item_type.itm_type_code
            inner join tbl_item_unit on tbl_item.itm_unit_code = tbl_item_unit.itm_unit_code

            inner join tbl_order_compartment on tbl_order_item.ord_code = tbl_order_compartment.ord_code
            and tbl_order_item.itm_code = tbl_order_compartment.itm_code
            and tbl_order_item.ptrl_tank_code = tbl_order_compartment.ptrl_tank_code
            and tbl_order_compartment.ord_veh_compartment_flag = '1'

            inner join tbl_petrol_tank on tbl_petrol.ptrl_code = tbl_petrol_tank.ptrl_code
            and tbl_order_compartment.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code
            and tbl_petrol_tank.ptrl_tank_flag = '1'

            inner join tbl_vehicle on xmaster.veh_code = tbl_vehicle.veh_code
            inner join tbl_vehicle_group on tbl_vehicle.veh_group_code = tbl_vehicle_group.veh_group_code
            ${(veh_group_code.toString().toUpperCase() != 'ALL' ? `and tbl_vehicle.veh_group_code = '${veh_group_code}'` : '')} 

            inner join tbl_order on xmaster.ord_code = tbl_order.ord_code
            and tbl_order.ord_flag = '1' 

            group by 
            xmaster.ord_code, tbl_depot.dpo_code, tbl_depot.dpo_number, tbl_depot.dpo_desc, tbl_depot.dpo_address, tbl_depot.dpo_short_desc, 
            tbl_depot.dpo_zip_code, tbl_depot.dpo_country_code, tbl_depot.dpo_lat, tbl_depot.dpo_lon, tbl_depot.dpo_city, dpo_loading_minute, 
            tbl_item.itm_code, 
            tbl_item.itm_short_desc, itm_image, tbl_item.itm_type_code, itm_type_desc, tbl_item.itm_unit_code, itm_unit_desc, itm_unit_short_desc, 
            tbl_petrol.ptrl_code, ptrl_short_desc, tbl_petrol.ptrl_country_code, tbl_petrol.ptrl_lat, tbl_petrol.ptrl_lon, tbl_petrol.ptrl_city, 
            tbl_petrol.ptrl_unloading_minute, expected_quantity, 
            veh_group_desc, carrier_name, job_code, tms_transport_code, shipments_code, job_dt, shift, veh_number, veh_license_number, 
            trip, count_drop, xmaster.gsap_order_number, xmaster.gsap_shipments_number, transit_start_dt, transit_end_dt, transit_minute, xmaster.distance, uom_km, 
            ptrl_number, ptrl_desc, tbl_petrol.ptrl_address, tbl_petrol.ptrl_zip_code, tbl_item.itm_material_number, tbl_item.itm_desc, 
            tbl_order_item.item_quantity, uom_l, delivery, time_window, dseq, job_status, trip_type, uom_kg, ord_comment, loading_start_dt, 
            loading_end_dt, ptrl_group_desc, tbl_petrol.ptrl_group_code, tbl_order_compartment.ptrl_tank_code, tnk_number, unloading_start_dt, unloading_end_dt, xmaster.transporeon_status, xmaster.job_comment,
            tbl_petrol_group.ptrl_group_code, tbl_order_compartment.ptrl_tank_code, tbl_petrol_tank.tnk_number,
            tbl_order_petrol.unloading_start_dt, tbl_order_petrol.unloading_end_dt, tbl_order_compartment.veh_compartment_code, 
            tbl_petrol_tank.tnk_capacity, tbl_petrol_tank.tnk_target, tbl_petrol_tank.tnk_deadstock, tbl_order_compartment.item_quantity

            )

            xtable_master 
            group by 
            trip, dseq,
            dpo_code, dpo_number, dpo_desc, dpo_short_desc, dpo_address, dpo_zip_code, dpo_country_code, dpo_lat, dpo_lon, dpo_city, 
            dpo_loading_minute, ord_code, itm_code, itm_desc, itm_short_desc, itm_image, itm_material_number, itm_type_code, itm_type_desc, 
            itm_unit_code, itm_unit_desc, itm_unit_short_desc, ptrl_code, ptrl_number, ptrl_desc, ptrl_short_desc, 
            ptrl_address, ptrl_zip_code, ptrl_country_code, ptrl_lat, ptrl_lon, ptrl_city, ptrl_unloading_minute, ptrl_tank_code, tnk_number, job_code, job_status, 
            transporeon_status, job_comment, tms_transport_code, shipments_code, unloading_start_dt, deadlock_dt, tnk_capacity, tnk_target, tnk_deadstock, 
            expected_quantity, book_stock, book_stock_dt, average_daily_sales, veh_group_desc, ptrl_group_desc, ptrl_number
            order by tms_transport_code, trip, dseq`

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
                    await xglobal.action_logs(lic_code, tbl_temporary.data[0].emp_code, 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'success', tbl_temporary.data[0].off_code);
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
                    message: `ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
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
        await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
        return;
    });
}

exports.getDischarge = async (req, res, next) => {

    debugger
    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { start_date, end_date, veh_group_code, ptrl_group_code, off_code } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (start_date == undefined || end_date == undefined || veh_group_code == undefined || ptrl_group_code == undefined || off_code == undefined || lic_code == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return
        } else {

            script = `select tms_transport_code, gsap_shipments_number, gsap_order_number, discharged,case when max(delivery_flag) != '1' then 'true' else 'fales' end as redirect, 
            veh_number, veh_license_number, itm_material_number, itm_desc, itm_short_desc, itm_unit_code, item_quantity, veh_compartment_number, 
            ptrl_number, ptrl_desc, unloading_start_dt, unloading_end_dt, tnk_number 
            from (select tbl_job.job_code, tbl_job.tms_transport_code, tbl_job.gsap_shipments_number, tbl_job.gsap_order_number,
            'true' :: varchar(4) as discharged, tbl_vehicle.veh_code, tbl_vehicle.veh_number, tbl_vehicle.veh_license_number,
            tbl_order_close.ord_code, tbl_order_close.itm_code, tbl_item.itm_material_number, 
            case when tbl_order_item.itm_desc is null then tbl_item.itm_desc else tbl_order_item.itm_desc end as itm_desc, 
            case when tbl_order_item.itm_short_desc is null then tbl_item.itm_short_desc else tbl_order_item.itm_short_desc end as itm_short_desc, 
            tbl_order_close.itm_unit_code, 
            tbl_order_close.item_quantity, 
            tbl_order_close.ord_close_flag, 
            tbl_order_close.ist_dt, tbl_order_close.mdf_dt, tbl_order_close.rm_dt, tbl_order_close.veh_compartment_code,
            tbl_vehicle_compartment.veh_compartment_number, tbl_order_close.ptrl_code, tbl_petrol.ptrl_number,
            tbl_petrol.ptrl_desc, min(tbl_order_petrol.unloading_start_dt) as unloading_start_dt, 
            max(tbl_order_petrol.unloading_end_dt) as unloading_end_dt, tbl_order_close.ptrl_tank_code,
            tbl_petrol_tank.tnk_number, tbl_order_close.delivery_flag

            from tbl_order_close 
            left join tbl_job_order on tbl_order_close.ord_code = tbl_job_order.ord_code
            left join tbl_job on tbl_job_order.job_code = tbl_job.job_code 
            left join tbl_vehicle on tbl_job.veh_code = tbl_vehicle.veh_code 
            left join tbl_petrol on tbl_order_close.ptrl_code = tbl_petrol.ptrl_code             
            left join tbl_order_item on tbl_order_close.ord_code = tbl_order_item.ord_code
            and tbl_order_close.itm_code = tbl_order_item.itm_code 
            left join tbl_item on tbl_order_close.itm_code = tbl_item.itm_code
            left join tbl_order_petrol on tbl_order_close.ord_code = tbl_order_petrol.ord_code
            and tbl_order_close.ptrl_code = tbl_order_petrol.ptrl_code 
            and tbl_order_close.ptrl_tank_code = tbl_order_petrol.ptrl_tank_code 
            left join tbl_petrol_tank on tbl_petrol_tank.ptrl_code = tbl_petrol.ptrl_code 
            and tbl_order_close.ptrl_tank_code = tbl_petrol_tank.ptrl_tank_code 
            left join tbl_vehicle_compartment on tbl_vehicle.veh_code = tbl_vehicle_compartment.veh_code
            and tbl_order_close.veh_compartment_code = tbl_vehicle_compartment.veh_compartment_code

            where tbl_job.job_flag = '1' and tbl_job.job_status = '4' and job_dt >= '${start_date} 00:00:00' and job_dt <= '${end_date} 23:59:59' 
            ${(veh_group_code.toString().toUpperCase() != 'ALL' ? `and tbl_vehicle.veh_group_code = '${veh_group_code}'` : '')} 
            ${(ptrl_group_code.toString().toUpperCase() != 'ALL' ? `and tbl_petrol.ptrl_group_code = '${ptrl_group_code}'` : '')} 

            group by tbl_job.job_code, tbl_job.tms_transport_code, tbl_job.gsap_shipments_number, tbl_job.gsap_order_number,
            tbl_vehicle.veh_code, tbl_vehicle.veh_number, tbl_vehicle.veh_license_number, tbl_order_close.ord_code, 
            tbl_order_close.itm_code, tbl_order_item.itm_desc, tbl_item.itm_desc, tbl_order_item.itm_short_desc, tbl_item.itm_short_desc, 
            tbl_order_item.pos_number, tbl_order_close.itm_unit_code, tbl_order_close.item_quantity, tbl_order_close.ord_close_flag, 
            tbl_order_close.ist_dt, tbl_order_close.mdf_dt, tbl_order_close.rm_dt, tbl_order_close.veh_compartment_code,
            tbl_vehicle_compartment.veh_compartment_number, tbl_order_close.ptrl_code, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, 
            tbl_order_close.ptrl_tank_code, tbl_petrol_tank.tnk_number, tbl_order_close.delivery_flag, tbl_item.itm_material_number) tbl_master

            group by tms_transport_code, gsap_shipments_number, gsap_order_number, discharged, veh_number, veh_license_number, itm_material_number, 
            itm_desc, itm_short_desc, itm_unit_code, item_quantity, veh_compartment_number, ptrl_number, ptrl_desc, unloading_start_dt, 
            unloading_end_dt, tnk_number
            order by tms_transport_code, unloading_start_dt, veh_compartment_number asc `

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
                    await xglobal.action_logs(lic_code, tbl_temporary.data[0].emp_code, 'ดึงรายงาน Discharge', JSON.stringify(req.body[0]), 'success', tbl_temporary.data[0].off_code);
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
                    message: `ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
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
        await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
        return;
    });
}

exports.getReportTripInformationV2 = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header('lic_code');
        let { start_date, end_date, veh_group_code, dpo_code, off_code } = req.body[0];
        //เช็คเฉพาะส่วนที่สำคัญ
        if (start_date == undefined || end_date == undefined || veh_group_code == undefined || dpo_code == undefined || off_code == undefined || lic_code == undefined) {
            let response = [{
                status: 'error',
                invalid_code: '-1',
                message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
                data: xresult,
                response_time: moment().format('YYYY-MM-DD HH:mm:ss')
            }]

            res.status(200).send(response);
            return
        } else {

            let script = `select veh_group_code ,veh_group_desc, shell_desc, gsap_shipments_number, shipments_code, tms_transport_code, transit_start_dt, transit_end_dt, transit_minute, loading_dt, total_date, trip, row_number() over (partition by gsap_shipments_number order by shipments_code) as dseq,total_driver, unloading_count, distance, ptrl_number, ptrl_desc, dpo_code, dpo_number, dpo_desc, job_comment, veh_number, veh_license_number, dver_name, dver_surname, item_quantity, 
            item_desc1, item_quantity1, item_desc2, item_quantity2, item_desc3, item_quantity3, item_desc4, item_quantity4, item_desc5, item_quantity5, item_desc6, item_quantity6

            from 
            (select tbl_vehicle.veh_group_code, case when tbl_vehicle_group.veh_group_desc is null then '-' else tbl_vehicle_group.veh_group_desc end as veh_group_desc, 
            'บริษัท เชลล์แห่งประเทศไทย จำกัด' as shell_desc, tbl_job.gsap_shipments_number, tbl_order.shipments_code, tbl_job.tms_transport_code, 
            tbl_job.transit_start_dt, tbl_job.transit_end_dt, tbl_job.transit_minute, 
            (select max(xdepot.loading_start_dt) as loading_start_dt from tbl_order_depot xdepot where xdepot.ord_code in 
            (select ord_code from tbl_job_order xjob where xjob.job_code = tbl_job.job_code)) as loading_dt,1 as total_date, 1 as trip, 1 as dseq, 1 as total_driver,
            tbl_job.unloading_count,tbl_job.distance, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, tbl_order_depot.dpo_code ,tbl_depot.dpo_number, tbl_depot.dpo_desc,
            case when tbl_job.job_comment is null or tbl_job.job_comment = '' then tbl_order.ord_comment else tbl_job.job_comment end as job_comment,
            tbl_vehicle.veh_number, tbl_vehicle.veh_license_number, tbl_driver.dver_name, tbl_driver.dver_surname, sum(tbl_order_item.item_quantity) as item_quantity,
            (select x2item.itm_desc from tbl_order_item xitem_order left join tbl_item x2item on xitem_order.itm_code = x2item.itm_code where xitem_order.ord_code = tbl_order.ord_code offset 0 limit 1) as item_desc1,
            (select case when xitem_order.item_quantity is null then 0 else xitem_order.item_quantity end as item_quantity from tbl_order_item xitem_order left join tbl_item x2item on xitem_order.itm_code = x2item.itm_code where xitem_order.ord_code = tbl_order.ord_code offset 0 limit 1)  as item_quantity1,

            (select x2item.itm_desc from tbl_order_item xitem_order left join tbl_item x2item on xitem_order.itm_code = x2item.itm_code where xitem_order.ord_code = tbl_order.ord_code offset 1 limit 1) as item_desc2,
            (select case when xitem_order.item_quantity is null then 0 else xitem_order.item_quantity end as item_quantity from tbl_order_item xitem_order left join tbl_item x2item on xitem_order.itm_code = x2item.itm_code where xitem_order.ord_code = tbl_order.ord_code offset 1 limit 1)  as item_quantity2,

            (select x2item.itm_desc from tbl_order_item xitem_order left join tbl_item x2item on xitem_order.itm_code = x2item.itm_code where xitem_order.ord_code = tbl_order.ord_code offset 2 limit 1) as item_desc3,
            (select case when xitem_order.item_quantity is null then 0 else xitem_order.item_quantity end as item_quantity from tbl_order_item xitem_order left join tbl_item x2item on xitem_order.itm_code = x2item.itm_code where xitem_order.ord_code = tbl_order.ord_code offset 2 limit 1)  as item_quantity3,

            (select x2item.itm_desc from tbl_order_item xitem_order left join tbl_item x2item on xitem_order.itm_code = x2item.itm_code where xitem_order.ord_code = tbl_order.ord_code offset 3 limit 1) as item_desc4,
            (select case when xitem_order.item_quantity is null then 0 else xitem_order.item_quantity end as item_quantity from tbl_order_item xitem_order left join tbl_item x2item on xitem_order.itm_code = x2item.itm_code where xitem_order.ord_code = tbl_order.ord_code offset 3 limit 1)  as item_quantity4,

            (select x2item.itm_desc from tbl_order_item xitem_order left join tbl_item x2item on xitem_order.itm_code = x2item.itm_code where xitem_order.ord_code = tbl_order.ord_code offset 4 limit 1) as item_desc5,
            (select case when xitem_order.item_quantity is null then 0 else xitem_order.item_quantity end as item_quantity from tbl_order_item xitem_order left join tbl_item x2item on xitem_order.itm_code = x2item.itm_code where xitem_order.ord_code = tbl_order.ord_code offset 4 limit 1)  as item_quantity5,

            (select x2item.itm_desc from tbl_order_item xitem_order left join tbl_item x2item on xitem_order.itm_code = x2item.itm_code where xitem_order.ord_code = tbl_order.ord_code offset 5 limit 1) as item_desc6,
            (select case when xitem_order.item_quantity is null then 0 else xitem_order.item_quantity end as item_quantity from tbl_order_item xitem_order left join tbl_item x2item on xitem_order.itm_code = x2item.itm_code where xitem_order.ord_code = tbl_order.ord_code offset 5 limit 1)  as item_quantity6 

            from tbl_job 
            left join tbl_job_order on tbl_job.job_code = tbl_job_order.job_code
            left join tbl_order on tbl_job_order.ord_code = tbl_order.ord_code
            left join tbl_vehicle on tbl_job.veh_code = tbl_vehicle.veh_code
            left join tbl_order_petrol on tbl_order.ord_code = tbl_order_petrol.ord_code
            left join tbl_petrol on tbl_order_petrol.ptrl_code = tbl_petrol.ptrl_code
            left join tbl_order_depot on tbl_order.ord_code = tbl_order_depot.ord_code
            left join tbl_depot on tbl_order_depot.dpo_code = tbl_depot.dpo_code
            left join tbl_driver on tbl_job.dver_code = tbl_driver.dver_code
            left join tbl_order_item on tbl_order_petrol.ord_code = tbl_order_item.ord_code 
            left join tbl_vehicle_group on tbl_vehicle.veh_group_code = tbl_vehicle_group.veh_group_code
            and tbl_order_petrol.itm_code = tbl_order_item.itm_code
            and tbl_order_petrol.ptrl_tank_code = tbl_order_item.ptrl_tank_code

            where job_dt >= '${start_date} 00:00:00' and job_dt <= '${end_date} 23:59:59' 
            and tbl_job.transporeon_status = 'A' and tbl_job.off_code = '${off_code}' 
            group by tbl_vehicle.veh_group_code ,tbl_vehicle_group.veh_group_desc, tbl_job.gsap_shipments_number, tbl_order.shipments_code, tbl_job.tms_transport_code, 
            tbl_job.transit_start_dt, tbl_job.transit_end_dt, tbl_job.transit_minute, 
            loading_dt,total_date,trip,dseq,total_driver,
            tbl_job.unloading_count,tbl_job.distance, tbl_petrol.ptrl_number, tbl_petrol.ptrl_desc, tbl_order_depot.dpo_code ,tbl_depot.dpo_number, tbl_depot.dpo_desc,
            tbl_job.job_comment,tbl_order_petrol.unloading_start_dt,
            tbl_vehicle.veh_number, tbl_vehicle.veh_license_number, tbl_driver.dver_name, tbl_driver.dver_surname, tbl_job.item_quantity 
            order by tbl_job.tms_transport_code asc, tbl_order_petrol.unloading_start_dt) tbl_master 
            where dpo_code is not null `;

            if (veh_group_code.toString().toUpperCase() != 'ALL') {
                script += ` and veh_group_code = '${veh_group_code}' `
            }

            if (dpo_code.toString().toUpperCase() != 'ALL') {
                script += ` and dpo_code = '${dpo_code}' `
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
                    await xglobal.action_logs(lic_code, tbl_temporary.data[0].emp_code, 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'success', tbl_temporary.data[0].off_code);
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
                    message: `ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
                    data: xresult,
                    response_time: moment().format('YYYY-MM-DD HH:mm:ss')
                }]
                res.status(200).send(response);
                await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
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
        await xglobal.action_logs(lic_code, '', 'เข้าสู่ระบบ', JSON.stringify(req.body[0]), 'ไม่สามารถเข้าสู่ระบบ, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ', '');
        return;
    });
}