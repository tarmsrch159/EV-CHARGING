const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix();

// API ดึงข้อมูลการจองชาร์จ (Get Reservations)
exports.getReservationInformation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        let {
            reservation_code = "ALL",
            user_code = "ALL",
            search = "",
            page_index = 1,
            page_limit = 10,
            action
        } = req.body[0] || {};

        if (!lic_code || !action) {
            return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');
        }

        const offset = page_index > 0 ? page_index - 1 : 0;
        const conditions = ["r.rm_dt IS NULL", "r.reservation_flag = 1"];

        if (String(reservation_code).toUpperCase() !== "ALL") {
            conditions.push(`r.reservation_code = '${reservation_code}'`);
        }
        if (String(user_code).toUpperCase() !== "ALL") {
            conditions.push(`r.user_code = '${user_code}'`);
        }

        if (search && search.trim() !== "") {
            const sLower = search.trim().toLowerCase();
            conditions.push(`(
                LOWER(r.reservation_code) LIKE '%${sLower}%' OR
                LOWER(u.name) LIKE '%${sLower}%' OR
                LOWER(u.lastname) LIKE '%${sLower}%' OR
                LOWER(v.vehicle_license) LIKE '%${sLower}%' OR
                LOWER(st.station_name_th) LIKE '%${sLower}%'
            )`);
        }

        const whereClause = "WHERE " + conditions.join(" AND ");

        const dataScript = `
            SELECT 
                r.reservation_code,
                r.user_code,
                r.vehicle_code,
                r.connector_code,
                TO_CHAR(r.scheduled_start_time, 'YYYY-MM-DD HH24:MI:SS') as scheduled_start_time,
                TO_CHAR(r.scheduled_end_time, 'YYYY-MM-DD HH24:MI:SS') as scheduled_end_time,
                TO_CHAR(r.actual_start_time, 'YYYY-MM-DD HH24:MI:SS') as actual_start_time,
                TO_CHAR(r.actual_end_time, 'YYYY-MM-DD HH24:MI:SS') as actual_end_time,
                r.energy_delivered_kwh,
                r.quota_used_kwh,
                r.excess_energy_charged_kwh,
                r.charging_cost_thb,
                r.idle_duration_min,
                r.idle_fee_thb,
                r.total_cost_thb,
                r.reservation_status,
                r.ist_dt,
                u.name as user_name,
                u.lastname as user_lastname,
                u.email as user_email,
                v.vehicle_name,
                v.vehicle_license,
                cn.connector_name,
                cn.connector_type,
                cn.power_type,
                ch.charger_name,
                st.station_name_th,
                st.station_name_en
            FROM tbl_ev_reservation r
            LEFT JOIN tbl_users u ON r.user_code = u.user_code
            LEFT JOIN tbl_vehicle v ON r.vehicle_code = v.vehicle_code
            LEFT JOIN tbl_ev_connector cn ON r.connector_code = cn.connector_code
            LEFT JOIN tbl_ev_charger ch ON cn.charger_code = ch.charger_code
            LEFT JOIN tbl_ev_station st ON ch.ev_station_code = st.ev_station_code
            ${whereClause}
            ORDER BY r.scheduled_start_time DESC
            OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};
        `;

        const result = await pgConn.get(dbPrefix + lic_code, dataScript, config.connectionString());
        if (result.code) return sendResponse(res, 'error', '-3', "ไม่สามารถดึงข้อมูลการจองได้");

        if (result.data.length === 0) {
            return sendResponse(res, 'success', '0', "ไม่พบข้อมูล", [], { page_total: 0, rows_total: 0 });
        }

        const data = JSON.parse(JSON.stringify(result.data).replace(/\:null/gi, '\:""'));

        const countScript = `SELECT COUNT(r.reservation_code) as rows_total, CEIL(COUNT(r.reservation_code)::float / ${page_limit}) as page_total FROM tbl_ev_reservation r LEFT JOIN tbl_users u ON r.user_code = u.user_code ${whereClause};`;
        const countResult = await pgConn.get(dbPrefix + lic_code, countScript, config.connectionString());
        let page_total = 1, rows_total = 0;
        if (!countResult.code && countResult.data.length > 0) {
            rows_total = parseInt(countResult.data[0].rows_total);
            page_total = Math.max(1, parseInt(countResult.data[0].page_total));
        }

        return sendResponse(res, 'success', '0', "", data, { page_total, rows_total });
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

// API บันทึกการจองชาร์จ (Add Reservation)
exports.addReservation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const {
            user_code,
            vehicle_code,
            connector_code,
            scheduled_start_time,
            scheduled_end_time,
            action
        } = req.body[0] || {};

        if (!lic_code || !user_code || !vehicle_code || !connector_code || !scheduled_start_time || !scheduled_end_time || !action) {
            return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');
        }

        const newResCode = "res-" + moment().format("YYYYMMDDHHmmss") + Math.floor(Math.random() * 100);
        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        // 1. ตรวจสอบสเปครถยนต์และหัวจ่ายชาร์จ
        const connScript = `SELECT connector_type FROM tbl_ev_connector WHERE connector_code = $1 AND rm_dt IS NULL LIMIT 1;`;
        const connRes = await pgConn.getWithParams(dbPrefix + lic_code, connScript, [connector_code], config.connectionString());
        if (connRes.code || connRes.data.length === 0) return sendResponse(res, 'error', '-2', 'ไม่พบหัวชาร์จที่เลือกในระบบ');
        const connectorType = connRes.data[0].connector_type;

        const specScript = `SELECT supported_connectors FROM tbl_vehicle_ev_spec WHERE vehicle_code = $1 LIMIT 1;`;
        const specRes = await pgConn.getWithParams(dbPrefix + lic_code, specScript, [vehicle_code], config.connectionString());
        if (specRes.code || specRes.data.length === 0) return sendResponse(res, 'error', '-2', 'ไม่พบข้อมูลสเปคไฟฟ้าของรถยนต์ในระบบ');
        
        let supportedConnectors = [];
        try {
            supportedConnectors = typeof specRes.data[0].supported_connectors === 'string' 
                ? JSON.parse(specRes.data[0].supported_connectors) 
                : specRes.data[0].supported_connectors;
        } catch (e) {
            supportedConnectors = specRes.data[0].supported_connectors;
        }

        if (!Array.isArray(supportedConnectors) || !supportedConnectors.includes(connectorType)) {
            return sendResponse(res, 'error', '-1', `รถยนต์คันดังกล่าวไม่รองรับหัวชาร์จประเภท '${connectorType}'`);
        }

        // 2. ตรวจสอบตารางการจองทับซ้อน
        const overlapScript = `
            SELECT reservation_code 
            FROM tbl_ev_reservation 
            WHERE connector_code = $1 
              AND reservation_status IN (0, 1) 
              AND rm_dt IS NULL 
              AND NOT (scheduled_end_time <= $2::timestamp OR scheduled_start_time >= $3::timestamp)
            LIMIT 1;
        `;
        const overlapRes = await pgConn.getWithParams(dbPrefix + lic_code, overlapScript, [connector_code, scheduled_start_time, scheduled_end_time], config.connectionString());
        if (overlapRes.code) return sendResponse(res, 'error', '-3', 'เกิดข้อผิดพลาดในการตรวจสอบคิวการจอง');
        if (overlapRes.data.length > 0) {
            return sendResponse(res, 'error', '-1', 'หัวชาร์จนี้ถูกจองคิวใช้บริการแล้วในช่วงเวลาดังกล่าว');
        }

        // 3. บันทึกข้อมูลการจอง
        const script = `
            INSERT INTO tbl_ev_reservation (
                reservation_code, user_code, vehicle_code, connector_code,
                scheduled_start_time, scheduled_end_time, reservation_status, ist_dt, reservation_flag
            ) VALUES ($1, $2, $3, $4, $5::timestamp, $6::timestamp, 0, $7, 1);
        `;
        const params = [newResCode, user_code, vehicle_code, connector_code, scheduled_start_time, scheduled_end_time, nowStr];

        const result = await pgConn.execute2params(dbPrefix + lic_code, script, params, config.connectionString());
        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, "จองหัวชาร์จ", JSON.stringify(req.body[0]), result.message, action[0].value);
            return sendResponse(res, 'error', '-3', "ไม่สามารถบันทึกข้อมูลการจองคิวชาร์จได้");
        }

        await xglobal.action_logs(lic_code, action[0].id, "จองหัวชาร์จ", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "จองคิวหัวชาร์จสำเร็จ", [{ reservation_code: newResCode }]);
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

// API แก้ไขข้อมูลการจอง (Update Reservation)
exports.setReservation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { reservation_code } = req.query;
        const {
            scheduled_start_time,
            scheduled_end_time,
            reservation_status,
            reservation_flag,
            action
        } = req.body[0] || {};

        if (!lic_code || !reservation_code || !action) {
            return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');
        }

        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");
        let updateFields = [];
        let params = [];
        let index = 1;

        if (scheduled_start_time !== undefined) { updateFields.push(`scheduled_start_time = $${index++}::timestamp`); params.push(scheduled_start_time); }
        if (scheduled_end_time !== undefined) { updateFields.push(`scheduled_end_time = $${index++}::timestamp`); params.push(scheduled_end_time); }
        if (reservation_status !== undefined) { updateFields.push(`reservation_status = $${index++}`); params.push(reservation_status); }
        if (reservation_flag !== undefined) { updateFields.push(`reservation_flag = $${index++}`); params.push(reservation_flag); }

        if (updateFields.length === 0) return sendResponse(res, 'error', '-1', "ไม่มีข้อมูลแก้ไข");
        updateFields.push(`mdf_dt = $${index++}::timestamp`); params.push(nowStr);
        params.push(reservation_code);

        const script = `UPDATE tbl_ev_reservation SET ${updateFields.join(", ")} WHERE reservation_code = $${index};`;
        const result = await pgConn.execute2params(dbPrefix + lic_code, script, params, config.connectionString());
        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, "แก้ไขการจองชาร์จ", JSON.stringify(req.body[0]), result.message, action[0].value);
            return sendResponse(res, 'error', '-3', "ไม่สามารถแก้ไขการจองคิวชาร์จได้");
        }

        await xglobal.action_logs(lic_code, action[0].id, "แก้ไขการจองชาร์จ", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "แก้ไขสำเร็จ");
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

// API ยกเลิก/ลบการจองชาร์จ (Remove Reservation - Soft Delete)
exports.removeReservation = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { reservation_code, action } = req.body[0] || {};
        if (!lic_code || !reservation_code || !action) {
            return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');
        }

        const codes = Array.isArray(reservation_code) ? reservation_code : [reservation_code];
        const placeholders = codes.map((_, i) => `$${i + 2}`).join(", ");
        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        const script = `UPDATE tbl_ev_reservation SET reservation_flag = 0, reservation_status = 3, rm_dt = $1::timestamp WHERE reservation_code IN (${placeholders});`;
        const result = await pgConn.execute2params(dbPrefix + lic_code, script, [nowStr, ...codes], config.connectionString());
        if (result.code) {
            await xglobal.action_logs(lic_code, action[0].id, "ยกเลิกคิวการจอง", JSON.stringify(req.body[0]), result.message, action[0].value);
            return sendResponse(res, 'error', '-3', "ไม่สามารถยกเลิกการจองได้");
        }

        await xglobal.action_logs(lic_code, action[0].id, "ยกเลิกคิวการจอง", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "ยกเลิกการจองคิวสำเร็จ");
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

// API เริ่มต้นเซสชันชาร์จไฟจริง (Start Charging Session)
exports.startCharging = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { reservation_code, action } = req.body[0] || {};

        if (!lic_code || !reservation_code || !action) {
            return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');
        }

        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        // 1. ตรวจสอบการจองว่ามีอยู่จริงและอยู่ในสถานะรอเข้าใช้บริการ (status 0)
        const getScript = `SELECT connector_code, reservation_status FROM tbl_ev_reservation WHERE reservation_code = $1 AND rm_dt IS NULL LIMIT 1;`;
        const getRes = await pgConn.getWithParams(dbPrefix + lic_code, getScript, [reservation_code], config.connectionString());
        if (getRes.code || getRes.data.length === 0) return sendResponse(res, 'error', '-2', 'ไม่พบคิวการจองนี้');
        
        const { connector_code, reservation_status } = getRes.data[0];
        if (reservation_status !== 0) return sendResponse(res, 'error', '-1', 'คิวการจองนี้ไม่ได้อยู่ในสถานะรอการชาร์จ');

        // 2. ดำเนินการอัปเดตผ่าน Transaction
        const transactionResult = await pgConn.executeTransaction(
            dbPrefix + lic_code,
            async (client) => {
                // อัปเดตตารางจองเป็นสถานะ 1 (กำลังชาร์จ) และลงเวลาจริงเริ่มชาร์จ
                const updateResScript = `
                    UPDATE tbl_ev_reservation 
                    SET actual_start_time = $1::timestamp, reservation_status = 1, mdf_dt = $1::timestamp
                    WHERE reservation_code = $2;
                `;
                const resRes = await pgConn.executeWithClient(client, updateResScript, [nowStr, reservation_code]);
                if (resRes.code) throw new Error("ไม่สามารถเริ่มคำสั่งชาร์จในตารางการจองได้");

                // ปรับปรุงสถานะหัวชาร์จใน tbl_ev_connector เป็น 2 (กำลังชาร์จ)
                const updateConnScript = `
                    UPDATE tbl_ev_connector 
                    SET connector_status = 2, mdf_dt = $1::timestamp
                    WHERE connector_code = $2;
                `;
                const resConn = await pgConn.executeWithClient(client, updateConnScript, [nowStr, connector_code]);
                if (resConn.code) throw new Error("ไม่สามารถปรับสถานะหัวจ่ายชาร์จได้");

                return { reservation_code };
            },
            config.connectionString()
        );

        if (transactionResult.code) {
            await xglobal.action_logs(lic_code, action[0].id, "เริ่มชาร์จไฟฟ้า", JSON.stringify(req.body[0]), transactionResult.message, action[0].value);
            return sendResponse(res, 'error', '-3', `ไม่สามารถสั่งเริ่มชาร์จไฟฟ้าได้: ${transactionResult.message}`);
        }

        await xglobal.action_logs(lic_code, action[0].id, "เริ่มชาร์จไฟฟ้า", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "เริ่มต้นชาร์จไฟฟ้าสำเร็จ");
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};

// API เสร็จสิ้นการชาร์จไฟจริง (End Charging Session + Quota/Cost Calculation)
exports.endCharging = async (req, res, next) => {
    try {
        const lic_code = req.header('lic_code');
        const { reservation_code, energy_delivered_kwh, action } = req.body[0] || {};

        if (!lic_code || !reservation_code || energy_delivered_kwh === undefined || !action) {
            return sendResponse(res, 'error', '-1', 'ข้อมูลพารามิเตอร์ไม่ถูกต้อง');
        }

        const nowStr = moment().format("YYYY-MM-DD HH:mm:ss");

        // 1. ดึงรายละเอียดข้อมูลจอง
        const getScript = `
            SELECT 
                user_code, 
                connector_code, 
                reservation_status, 
                TO_CHAR(scheduled_end_time, 'YYYY-MM-DD HH24:MI:SS') as scheduled_end_time 
            FROM tbl_ev_reservation 
            WHERE reservation_code = $1 AND rm_dt IS NULL LIMIT 1;
        `;
        const getRes = await pgConn.getWithParams(dbPrefix + lic_code, getScript, [reservation_code], config.connectionString());
        if (getRes.code || getRes.data.length === 0) return sendResponse(res, 'error', '-2', 'ไม่พบคิวการจองนี้');
        
        const { user_code, connector_code, reservation_status, scheduled_end_time } = getRes.data[0];
        if (reservation_status !== 1) return sendResponse(res, 'error', '-1', 'คิวการจองนี้ไม่ได้อยู่ในสถานะกำลังชาร์จ');

        // 2. ดึงรายละเอียดโควตาผู้ใช้งาน
        const quotaScript = `
            SELECT 
                monthly_quota_kwh, 
                used_quota_kwh, 
                excess_rate_thb_kwh, 
                idle_fee_rate_thb_min 
            FROM tbl_user_charging_quota 
            WHERE user_code = $1 LIMIT 1;
        `;
        const quotaRes = await pgConn.getWithParams(dbPrefix + lic_code, quotaScript, [user_code], config.connectionString());
        if (quotaRes.code || quotaRes.data.length === 0) {
            return sendResponse(res, 'error', '-2', 'ไม่พบข้อมูลโควตาการชาร์จของผู้ใช้ในระบบ');
        }

        const { monthly_quota_kwh, used_quota_kwh, excess_rate_thb_kwh, idle_fee_rate_thb_min } = quotaRes.data[0];

        // 3. การคำนวณโควตาและพลังงานส่วนเกิน
        const monthly = parseFloat(monthly_quota_kwh);
        const used = parseFloat(used_quota_kwh);
        const rate = parseFloat(excess_rate_thb_kwh);
        const idleRate = parseFloat(idle_fee_rate_thb_min);
        const energy = parseFloat(energy_delivered_kwh);

        const remaining = Math.max(0, monthly - used);
        let quota_used = 0.00;
        let excess_energy = 0.00;

        if (energy <= remaining) {
            quota_used = energy;
            excess_energy = 0.00;
        } else {
            quota_used = remaining;
            excess_energy = energy - remaining;
        }

        const chargingCost = excess_energy * rate;

        // 4. การคำนวณการจอดแช่ (Idle Duration & Fee)
        let idleDuration = 0;
        if (moment(nowStr).isAfter(moment(scheduled_end_time))) {
            idleDuration = moment(nowStr).diff(moment(scheduled_end_time), 'minutes');
        }
        const idleFee = idleDuration * idleRate;
        const totalCost = chargingCost + idleFee;

        // 5. ดำเนินการ Transaction อัปเดตข้อมูลทั้งหมดลงฐานข้อมูล
        const transactionResult = await pgConn.executeTransaction(
            dbPrefix + lic_code,
            async (client) => {
                // บันทึกสรุปรายละเอียดธุรกรรมการชาร์จใน tbl_ev_reservation
                const updateResScript = `
                    UPDATE tbl_ev_reservation 
                    SET 
                        actual_end_time = $1::timestamp,
                        energy_delivered_kwh = $2,
                        quota_used_kwh = $3,
                        excess_energy_charged_kwh = $4,
                        charging_cost_thb = $5,
                        idle_duration_min = $6,
                        idle_fee_thb = $7,
                        total_cost_thb = $8,
                        reservation_status = 2,
                        mdf_dt = $1::timestamp
                    WHERE reservation_code = $9;
                `;
                const resRes = await pgConn.executeWithClient(client, updateResScript, [
                    nowStr, energy, quota_used, excess_energy, chargingCost, idleDuration, idleFee, totalCost, reservation_code
                ]);
                if (resRes.code) throw new Error("ไม่สามารถอัปเดตข้อมูลรายละเอียดการชาร์จลู่จองได้");

                // เพิ่มยอดโควตาที่ใช้สะสมลงในตารางโควตาผู้ใช้งาน
                const updateQuotaScript = `
                    UPDATE tbl_user_charging_quota 
                    SET 
                        used_quota_kwh = used_quota_kwh + $1,
                        mdf_dt = $2::timestamp
                    WHERE user_code = $3;
                `;
                const resQuota = await pgConn.executeWithClient(client, updateQuotaScript, [
                    quota_used, nowStr, user_code
                ]);
                if (resQuota.code) throw new Error("ไม่สามารถอัปเดตโควตาที่ใช้สะสมของผู้ใช้งานได้");

                // ปรับปรุงสถานะหัวชาร์จใน tbl_ev_connector เป็น 1 (ว่างพร้อมใช้งาน)
                const updateConnScript = `
                    UPDATE tbl_ev_connector 
                    SET connector_status = 1, mdf_dt = $1::timestamp
                    WHERE connector_code = $2;
                `;
                const resConn = await pgConn.executeWithClient(client, updateConnScript, [nowStr, connector_code]);
                if (resConn.code) throw new Error("ไม่สามารถปรับปรุงสถานะของหัวชาร์จได้");

                return { 
                    reservation_code, 
                    energy_delivered_kwh: energy,
                    quota_used_kwh: quota_used,
                    excess_energy_charged_kwh: excess_energy,
                    charging_cost_thb: chargingCost,
                    idle_duration_min: idleDuration,
                    idle_fee_thb: idleFee,
                    total_cost_thb: totalCost
                };
            },
            config.connectionString()
        );

        if (transactionResult.code) {
            await xglobal.action_logs(lic_code, action[0].id, "เสร็จสิ้นชาร์จไฟฟ้า", JSON.stringify(req.body[0]), transactionResult.message, action[0].value);
            return sendResponse(res, 'error', '-3', `ไม่สามารถปิดคำสั่งเสร็จสิ้นการชาร์จไฟฟ้าได้: ${transactionResult.message}`);
        }

        await xglobal.action_logs(lic_code, action[0].id, "เสร็จสิ้นชาร์จไฟฟ้า", JSON.stringify(req.body[0]), "success", action[0].value);
        return sendResponse(res, 'success', '0', "เสร็จสิ้นการชาร์จและประมวลผลค่าบริการสำเร็จ", [transactionResult.data]);
    } catch (err) {
        console.error(err);
        return sendResponse(res, 'error', '-4', "เกิดข้อผิดพลาดภายในระบบ");
    }
};
