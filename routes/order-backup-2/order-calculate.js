const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

exports.getFuelFilltoCompartment = async (req, res, next) => {

   let lic_code = req.header('lic_code');
   let { ord_code, veh_code, action } = req.body[0];
   //เช็คเฉพาะส่วนที่สำคัญ
   if (ord_code == undefined || veh_code == undefined || lic_code == undefined || action == undefined) {
      let response = [{
         status: 'error',
         invalid_code: '-1',
         message: 'ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง',
         data: xresult,
         response_time: moment().format('YYYY-MM-DD HH:mm:ss')
      }]

      res.status(200).send(response);
   }

   try {
      let scriptOrd = `
         select t0.ord_code ,
            t0.item_quantity as total_fuel ,
            t1.item_quantity ,
            t2.itm_short_desc as fuel_name
         from tbl_order t0
         left join tbl_order_item t1
            on t0.ord_code = t1.ord_code
         left join tbl_item t2
            on t1.itm_code = t2.itm_code
         where t1.ord_code = '${ord_code}'
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
                     ord_code: currentItem.ord_code,
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
               ord_code: ord_code, // หรือหาจาก allocationsDetails[0].ord_code ถ้ามั่นใจว่ามี
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
               ord_code: ord_code, // หรือหาจาก allocationsDetails[0].ord_code ถ้ามั่นใจว่ามี
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
