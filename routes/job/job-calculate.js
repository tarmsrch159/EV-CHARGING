const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

exports.verifyFuelFromJobToCompartment = async (req, res, next) => {

   let lic_code = req.header('lic_code');
   let { job_code, veh_code, action } = req.body[0];
   //เช็คเฉพาะส่วนที่สำคัญ
   if (job_code == undefined || veh_code == undefined || lic_code == undefined || action == undefined) {
      let response = [{
         status: 'error',
         invalid_code: '-1',
         message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
         data: [],
         response_time: moment().format('YYYY-MM-DD HH:mm:ss')
      }]

      res.status(200).send(response);
   }

   try {
      let scriptOrd = `
         select '${job_code}' as job_code,
            t0.item_quantity as total_fuel ,
            t1.item_quantity ,
            t2.itm_short_desc as fuel_name
         from tbl_order t0
         left join tbl_order_item t1
            on t0.ord_code = t1.ord_code
         left join tbl_item t2
            on t1.itm_code = t2.itm_code
         where t1.ord_code in (select ord_code from tbl_job_order where job_code = '${job_code}')
            and t1.ord_item_flag = '1'
         order by t1.item_quantity desc
      `;
      const orderItem = await pgConn.get(dbPrefix + lic_code, scriptOrd, config.connectionString());
      const orderItemRaw = orderItem.data;

      let scriptVeh = `
         select t0.veh_code ,
            t0.veh_maximum_capacity as capacity_fuel,
            t1.veh_compartment_number ,
            t2.veh_compartment_level_number ,
            t2.veh_compartment_level 
         from tbl_vehicle t0
         left join tbl_vehicle_compartment t1 
            on t0.veh_code = t1.veh_code
         left join tbl_vehicle_compartment_level t2
            on t1.veh_compartment_code = t2.veh_compartment_code
         where t1.veh_code = '${veh_code}'
            and t1.veh_compartment_flag = '1'
            and t2.veh_compartment_level_flag = '1'
         order by t2.veh_compartment_level desc
      `;
      const vehTank = await pgConn.get(dbPrefix + lic_code, scriptVeh, config.connectionString());
      const vehTanksRaw = vehTank.data;

      if (orderItemRaw.length == 0 || vehTanksRaw.length == 0) {
         const response = [{
            status: 'fail',
            invalid_code: '0',
            message: 'ไม่สามารถคำนวณน้ำมันได้ ข้อมูลสินค้า หรือรถไม่ถูกต้อง',
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
         }];
         res.status(200).send(response);

         return;
      }

      if (orderItemRaw[0].total_fuel > vehTanksRaw[0].capacity_fuel) {
         const response = [{
            status: 'fail',
            invalid_code: '0',
            message: 'จำนวนน้ำมันเกินความจุรถ',
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
         }];
         res.status(200).send(response);

         return;
      }

      // โครงสร้างข้อมูลสำหรับถังน้ำมัน
      // { 'compartment_number_1': { capacity: 20000, current_fill: 0, fuel_type: null, original_data: {...} }, ... }
      const vehTanksState = new Map();
      for (const tank of vehTanksRaw) {
         vehTanksState.set(tank.veh_compartment_number, {
            capacity: tank.veh_compartment_level,
            current_fill: 0,
            fuel_type: null, // null คือว่าง, 'gasoline', 'diesel'
            original_data: tank, // เก็บข้อมูลเดิมของถังไว้
            item_quantities_used: new Map()
         });
      }

      const allocationsDetails = [];
      for (const currentItem of orderItemRaw) {
         let remainingFuelFromItem = currentItem.item_quantity;
         const currentFuelName = currentItem.fuel_name;

         console.log(currentItem.fuel_name, currentItem.item_quantity);
         const sortedTanks = Array.from(vehTanksState.values());

         for (const tankState of sortedTanks) {
            if (remainingFuelFromItem <= 0) break;

            const compartmentNumber = tankState.original_data.veh_compartment_number;
            const canUseTank = tankState.capacity > tankState.current_fill && (tankState.fuel_type === null || tankState.fuel_type === currentFuelName);

            if (canUseTank) {
               const availableCapacityInTank = tankState.capacity - tankState.current_fill;
               const amountToFill = Math.min(remainingFuelFromItem, availableCapacityInTank);

               if (amountToFill > 0) {
                  tankState.current_fill += amountToFill;
                  tankState.fuel_type = currentFuelName;

                  // บันทึก original_item_quantity ที่ถูกใช้ไปกับถังนี้
                  tankState.item_quantities_used.set(currentItem.original_item_quantity, true);

                  allocationsDetails.push({
                     job_code: currentItem.job_code,
                     original_item_quantity: currentItem.item_quantity,
                     fuel_name: currentFuelName,
                     veh_code: tankState.original_data.veh_code,
                     veh_compartment_number: compartmentNumber,
                     veh_compartment_level_number: tankState.original_data.veh_compartment_level_number,
                     tank_capacity: tankState.capacity,
                     allocated_amount: amountToFill
                  });

                  remainingFuelFromItem -= amountToFill;
               }
               else {
                  debugger
               }
            }
         }

         if (remainingFuelFromItem > 0) {
            allocationsDetails.push({
               status: 'UNALLOCATED_FUEL_REMAINING',
               item_quantity_source: currentItem.item_quantity,
               fuel_name: currentFuelName,
               unallocated_amount: remainingFuelFromItem
            });
         }
      }

      // ---------- รวมผลลัพธ์ตาม Format ที่ต้องการ ----------
      const summarizedAllocations = [];
      for (const tankState of vehTanksState.values()) {
         if (tankState.current_fill > 0) { // เฉพาะถังที่มีการเติม
            const originalItemQuantities = Array.from(tankState.item_quantities_used.keys()).sort((a, b) => b - a); // เรียงจากมากไปน้อย

            const summaryEntry = {
               job_code: job_code, // หรือหาจาก allocationsDetails[0].ord_code ถ้ามั่นใจว่ามี
               fuel_name: tankState.fuel_type,
               veh_code: tankState.original_data.veh_code,
               veh_compartment_number: tankState.original_data.veh_compartment_number,
               veh_compartment_level_number: tankState.original_data.veh_compartment_level_number,
               tank_capacity: tankState.capacity,
               tank_fill: tankState.current_fill
            };

            // เพิ่ม original_item_quantity_1, _2, ... เข้าไปใน Object
            originalItemQuantities.forEach((qty, index) => {
               summaryEntry[`original_item_quantity_${index + 1}`] = qty;
            });

            summarizedAllocations.push(summaryEntry);
         } else {
            const summaryEntry = {
               job_code: job_code, // หรือหาจาก allocationsDetails[0].ord_code ถ้ามั่นใจว่ามี
               fuel_name: "N/A",
               veh_code: tankState.original_data.veh_code,
               veh_compartment_number: tankState.original_data.veh_compartment_number,
               veh_compartment_level_number: tankState.original_data.veh_compartment_level_number,
               tank_capacity: tankState.capacity,
               tank_fill: tankState.current_fill
            };
            summarizedAllocations.push(summaryEntry);
         }
      }

      // จัดการกับ unallocated items (ถ้ามี)
      const unallocatedItems = allocationsDetails.filter(item => item.status === 'UNALLOCATED_FUEL_REMAINING');


      const response = [{
         status: 'success',
         invalid_code: '0',
         message: '',
         data: summarizedAllocations,
         response_time: moment().format('YYYY-MM-DD HH:mm:ss')
      }];
      res.status(200).send(response);

   } catch (error) {
      console.log('error => ', error);
      const response = [{
         status: 'error',
         invalid_code: '-3',
         message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
         data: [],
         response_time: moment().format('YYYY-MM-DD HH:mm:ss')
      }];
      res.status(200).send(response);
   }
}

exports.verifyFuelFromJobToVehicle = async (req, res, next) => {

   try {

      let lic_code = req.header('lic_code');
      let { job_code, veh_code, action } = req.body[0];
      //เช็คเฉพาะส่วนที่สำคัญ
      if (job_code == undefined || veh_code == undefined || lic_code == undefined || action == undefined) {
         let response = [{
            status: 'error',
            invalid_code: '-1',
            message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
         }]

         res.status(200).send(response);
      }

      // const order_arr = body.ord_code; //รายการออเดอร์
      // const veh_code = body.veh_code; //รถ
      // หาความจุของรถ และจำนวนงานที่รับได้
      let sqlVeh = `
      select distinct 
      t1.veh_code ,
      t1.veh_maximum_compartment ,
      t1.veh_maximum_capacity ,
      t1.veh_maximum_distance ,
      t1.veh_maximum_jobs ,
      t2.veh_compartment_number ,
      sum(t3.veh_compartment_level) over(PARTITION BY t2.veh_compartment_number) as compartment_capacity
      from tbl_vehicle t1
      inner join tbl_vehicle_compartment t2
      on t1.veh_code = t2.veh_code 
      inner join tbl_vehicle_compartment_level t3
      on t2.veh_compartment_code = t3.veh_compartment_code 
      where t1.veh_code = '${veh_code}'
      and t3.veh_compartment_level_flag = '1'
      order by veh_compartment_number asc;
      `;
      const vehResult = await pgConn.get(dbPrefix + lic_code, sqlVeh, config.connectionString());
      const vehResultRaw = vehResult.data;

      // หาจำนวนน้ำมันของรายการออเดอร์ทั้งหมด
      // const orderCode = "'" + order_arr.join("','") + "'";
      let sqlSumfuel = `
      select t0.ord_code, t0.loading_count ,t2.itm_short_desc ,t1.item_quantity ,sum(t1.item_quantity) over() as total_fuel
      FROM tbl_order t0
      LEFT JOIN tbl_order_item t1 ON t0.ord_code = t1.ord_code
      LEFT JOIN tbl_item t2 ON t1.itm_code = t2.itm_code
      WHERE t1.ord_code IN (select tbl_job_order.ord_code
      FROM tbl_job_order 
      LEFT JOIN tbl_order on tbl_job_order.ord_code = tbl_order.ord_code
      WHERE job_code = '${job_code}' and tbl_order.ord_flag = '1')
      and t1.ord_item_flag = '1'
      AND t1.ord_item_flag = '1'
      group by 
      t0.ord_code ,
      t0.loading_count ,
      t2.itm_short_desc ,
      t1.item_quantity
      order by t0.ord_code asc
      `;
      const orderResult = await pgConn.get(dbPrefix + lic_code, sqlSumfuel, config.connectionString());
      const orderResultRaw = orderResult.data;
      const depot = orderResultRaw.some(item => item.loading_count > 1); //เช็คว่าออเดอร์ ขึ้นน้ำมันมีมากกว่า 1 คลังไหม


      // หาจำนวนน้ำรวม แยกตามประเภท ของออเดอร์ทั้งหมด
      const sqlFuelType = `
         with FuelType as (
            select distinct 
               t2.itm_short_desc as fuel_type,
               sum(t1.item_quantity) over(partition by t2.itm_short_desc) as sum_fuel
            FROM tbl_order t0
            LEFT JOIN tbl_order_item t1 ON t0.ord_code = t1.ord_code
            LEFT JOIN tbl_item t2 ON t1.itm_code = t2.itm_code
            WHERE t1.ord_code IN (select tbl_job_order.ord_code
            FROM tbl_job_order 
            LEFT JOIN tbl_order on tbl_job_order.ord_code = tbl_order.ord_code
            WHERE job_code = '${job_code}' and tbl_order.ord_flag = '1')
            and t1.ord_item_flag = '1'
               AND t1.ord_item_flag = '1'
         )
         select * from FuelType order by sum_fuel desc;
      `;
      const fuelResult = await pgConn.get(dbPrefix + lic_code, sqlFuelType, config.connectionString());
      const fuelResultRaw = fuelResult.data;

      // console.log('orderCode => ',orderCode);
      console.log('vehResultRaw => ', vehResultRaw);
      // console.log('orderResultRaw => ',orderResultRaw[0].total_fuel);
      // console.log('fuelResultRaw => ',fuelResultRaw);

      // ไม่พบช่องบรรจุน้ำมันของรถ
      if (vehResultRaw.length == 0) {
         const response = [{
            status: 'success',
            invalid_code: '0',
            message: `ไม่พบช่องบรรจุน้ำมัน ของรถที่เลือก`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
         }];
         res.status(200).send(response);

         return;
      }

      // ไม่มีจำนวนน้ำมันในรายการออร์เดอร์
      if (orderResultRaw.length == 0) {
         const response = [{
            status: 'success',
            invalid_code: '0',
            message: `ไม่มีจำนวนน้ำมันในรายการออร์เดอร์`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
         }];
         res.status(200).send(response);

         return;
      }

      // เช็คจำนวนคลัง
      if (depot) {
         const response = [{
            status: 'success',
            invalid_code: '0',
            message: `รายการออเดอร์กำหนดคลังน้ำมันมากกว่า 1 คลัง`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
         }];
         res.status(200).send(response);

         return;
      }

      if (vehResultRaw[0].veh_maximum_capacity <= orderResultRaw[0].total_fuel) {
         const response = [{
            status: 'success',
            invalid_code: '0',
            message: `รถมีความจุไม่เพียงพอ สำหรับจำนวนน้ำมันในออเดอร์`,
            data: [],
            response_time: moment().format('YYYY-MM-DD HH:mm:ss')
         }];
         res.status(200).send(response);

         return;
      }

      // เรียงน้ำมันจากมากไปน้อย
      fuelResultRaw.sort((a, b) => b.sum_fuel - a.sum_fuel);

      // เรียงช่องจากมากไปน้อย
      vehResultRaw.sort((a, b) => b.compartment_capacity - a.compartment_capacity);

      let mapping = [];
      let verify = true;

      const compartments = vehResultRaw.map((comp) => ({
         ...comp,
         usedBy: null // ค่าเริ่มต้นคือยังไม่มีการใช้งาน
      }));

      let xmsg = '';
      for (const fuel of fuelResultRaw) {
         let remaining = fuel.sum_fuel;
         const assignedCompartments = [];

         for (const comp of compartments) {
            if (comp.used) continue;

            assignedCompartments.push(comp.veh_compartment_number);
            remaining -= comp.compartment_capacity;
            comp.used = true;

            if (remaining <= 0) break;
         }

         if (remaining > 0) {
            verify = false;
            console.log(`ไม่สามารถจัดเก็บ ${fuel.fuel_type} ได้ - ขาดอีก ${remaining} ลิตร`);
            xmsg = `ไม่สามารถจัดเก็บ ${fuel.fuel_type} ได้ - ขาดอีก ${remaining} ลิตร`;
            break;
         } else {
            mapping.push({ fuel_type: fuel.fuel_type, compartments: assignedCompartments });
         }
      }

      let msg = '';
      let ckecked = true;
      if (verify) {
         ckecked = true;
         msg = 'รายการออเดอร์ที่เลือก สามารถบรรจุในรถคันนี้ได้';
         xmsg = msg;
         console.log("จัดเก็บได้ครบตามเงื่อนไข:\n");
         mapping.forEach((m) => {
            console.log(`• ${m.fuel_type} → ช่อง: ${m.compartments.join(", ")}`);
         });
      } else {
         ckecked = false;
         msg = 'ล้มเหลว: มีน้ำมันที่จัดไม่ลงช่อง';
         console.log("ล้มเหลว: มีน้ำมันที่จัดไม่ลงช่อง");
      }

      const response = [{
         status: 'success',
         invalid_code: '0',
         message: xmsg,
         data: ckecked ? [{
            job_code: job_code,
            veh_code: veh_code
         }] : [],
         response_time: moment().format('YYYY-MM-DD HH:mm:ss')
      }];
      res.status(200).send(response);

   } catch (error) {
      console.log('error => ', error);
      const response = [{
         status: 'error',
         invalid_code: '-3',
         message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
         data: [],
         response_time: moment().format('YYYY-MM-DD HH:mm:ss')
      }];
      res.status(200).send(response);
   }

}