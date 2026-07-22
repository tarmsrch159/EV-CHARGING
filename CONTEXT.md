# EV Charging Reservation System Backend — Context สำหรับ AI Agent

> **บทบาท AI Agent:** ให้สวม Role เป็น **Senior Node.js Backend Developer** ที่มีความเชี่ยวชาญด้าน Express, PostgreSQL, EV Charging Management Systems และการจัดการข้อมูลเชิงสัมพันธ์ (RDBMS) เสมอ เมื่อเขียนโค้ดใหม่ ให้ยึดตาม Pattern ที่ระบุในเอกสารนี้อย่างเคร่งครัด

---

## 1. ภาพรวมระบบ (Project Overview)

**EV Charging Reservation System** — ระบบบริหารจัดการการจองคิวชาร์จรถยนต์ไฟฟ้า, การจัดการสถานีชาร์จ, การคำนวณโควตาไฟฟ้าประจำเดือนสำหรับผู้ใช้งาน, และการติดตามบันทึกธุรกรรมการชาร์จแบบ Real-time

**Business Flow หลัก:**

1. **จองคิวชาร์จไฟ (Reservation Booking):**
   - ผู้ใช้งาน (`tbl_users`) จองคิวใช้บริการชาร์จไฟล่วงหน้าโดยเลือกวันเวลา หัวชาร์จคิวว่าง (`tbl_ev_connector`) และระบุรถยนต์ไฟฟ้าที่จะนำมาใช้ชาร์จ (`tbl_vehicle`)
   - ระบบจะทำความสอดคล้องกับสเปคไฟฟ้าของรถยนต์จาก (`tbl_vehicle_ev_spec`) และข้อมูลหัวชาร์จ เช่น ประเภทหัวชาร์จที่รถรองรับ (`supported_connectors`)
2. **เริ่มการชาร์จจริง (Start Charging Session):**
   - เมื่อเข้าใช้บริการจริง บันทึกเวลาเริ่มต้นจริง (`actual_start_time`) ในตารางจอง และปรับสถานะหัวชาร์จให้เป็นไม่ว่าง (เช่น กำลังชาร์จ)
   - ระหว่างการชาร์จ ระบบจะคอยบันทึกสถานะการชาร์จเป็นระยะลงใน log (`tbl_ev_charging_transaction_log`) เช่น ค่า SOC %, กำลังไฟปัจจุบัน (kW), แรงดันไฟ (V), กระแสไฟ (A) และปริมาณพลังงานที่ใช้ไป (kWh) สะสม
3. **เสร็จสิ้นการชาร์จ (End Charging Session):**
   - บันทึกเวลาเสร็จสิ้นจริง (`actual_end_time`) ปรับปรุงพลังงานชาร์จทั้งหมด (`energy_delivered_kwh`)
   - ระบบคำนวณปริมาณพลังงานไฟฟ้าที่หักออกจากโควตาพนักงาน (`used_quota_kwh` ใน `tbl_user_charging_quota`) หากพลังงานที่ชาร์จจริงเกินกว่าโควตาที่เหลือ จะคำนวณพลังงานส่วนเกิน (`excess_energy_charged_kwh`) และคูณด้วยอัตราค่าบริการไฟฟ้าส่วนเกิน (`excess_rate_thb_kwh`) ออกมาเป็นค่าชาร์จส่วนเกิน (`charging_cost_thb`)
   - คำนวณระยะเวลาการจอดแช่หลังจากชาร์จเต็ม (Idle Duration) ถ้าหากจอดแช่เกินเวลาที่เหมาะสม ระบบจะคำนวณค่าปรับจอดแช่ตามอัตรานาทีละ (`idle_fee_rate_thb_min`) บันทึกเป็นค่าปรับจอดแช่ (`idle_fee_thb`)
   - บันทึกผลรวมค่าบริการทั้งหมด (`total_cost_thb`) ลงในแถวการจอง (`tbl_ev_reservation`)
4. **บันทึกกิจกรรมและสิทธิ์ (Logs & Authorization):**
   - บันทึกประวัติการทำรายการทุกอย่างผ่าน `tbl_action_logs`
   - ตรวจสอบสิทธิ์การเข้าถึงระบบผ่านตาราง `tbl_authority` ร่วมกับกลุ่มและบัญชีผู้ใช้งาน

**Domain Objects หลัก:**

- **User & Quota** — ผู้ใช้งานและโควตาไฟฟ้าชาร์จรายเดือน
- **Station** — สถานีชาร์จ (พิกัด ละติจูด/ลองจิจูด, เวลาเปิด-ปิด)
- **Charger & Connector** — ตู้ชาร์จ และหัวชาร์จประเภทต่าง ๆ (เช่น AC Type 2, DC CCS2)
- **Vehicle & EV Spec** — ข้อมูลรถยนต์และสเปคไฟฟ้า (แบตเตอรี่, กำลังไฟที่รับได้สูงสุด, ชนิดหัวชาร์จที่รองรับเป็น JSONB)
- **Reservation** — รายการจองคิว ค่านับปริมาณพลังงาน และการคำนวณมูลค่าค่าใช้จ่าย
- **Charging Transaction Log** — ล็อกประวัติการทำงานและสถานะกำลังไฟฟ้าขณะชาร์จ

---

## 2. Tech Stack

| หมวด         | เทคโนโลยี                                                     |
| ------------ | ------------------------------------------------------------- |
| Runtime      | Node.js                                                       |
| Framework    | Express 4.x                                                   |
| Database     | PostgreSQL (ผ่าน `pg` Pool)                                   |
| ORM/Query    | Raw SQL (ไม่มี ORM — เขียน SQL ตรง ปลอดภัยด้วย Parameterized) |
| Date/Time    | `moment.js` — format `'YYYY-MM-DD HH:mm:ss'` เสมอ             |
| Auth         | Basic Auth (Header: `Authorization`)                          |
| File Upload  | `multer`                                                      |
| HTTP Client  | `axios`                                                       |
| Logger       | `morgan`                                                      |
| Excel Export | `exceljs`                                                     |
| Email        | `nodemailer`                                                  |
| Scheduler    | `node-cron`                                                   |
| View Engine  | `pug` (ระบบส่วนใหญ่เป็น API)                                  |

**คำสั่งรัน:**

```bash
npm run dev   # Development (nodemon)
npm start     # Production
npm test      # Mocha + Supertest
```

---

## 3. โครงสร้าง Directory

```
ev-charging/
├── app.js                      # Entry point: Register routes, Middleware, Auth, Cron
├── bin/www                     # HTTP server bootstrap (PORT=9100)
├── configuration/
│   └── connection.js           # Connection string, Auth tokens, DB prefix, prod flag
├── library/
│   └── pgConnection.js         # ฟังก์ชัน Query DB ทั้งหมด (get, execute, executeTransaction, ...)
├── middleware/
│   ├── global.js               # sendResponse, action_logs, utility functions
│   └── restrict.js             # Authorization middleware
├── routes/
│   ├── auth/                   # สิทธิ์การเข้าสู่ระบบ
│   ├── users/                  # ข้อมูลผู้ใช้และสิทธิ์การใช้งาน + การจัดการโควตาผู้ใช้
│   ├── station/                # สถานีบริการชาร์จไฟ (EV Station)
│   ├── charger/                # เครื่องชาร์จและหัวชาร์จ (EV Charger & EV Connector)
│   ├── vehicle/                # ข้อมูลรถยนต์ ยี่ห้อ รุ่น และข้อกำหนดไฟฟ้า (EV Spec)
│   ├── reservation/            # การจองคิวชาร์จ การเริ่ม-เสร็จสิ้น และการคำนวณราคา
│   ├── transaction-log/        # ล็อกประวัติการทำงานชาร์จ Real-time
│   └── utility/                # ฟังก์ชันช่วยเหลือทั่วไป
├── public/
│   └── files/                  # ไฟล์รูปที่อัปโหลด
├── schema/                     # DB Schema (SQL scripts)
└── test/                       # Unit Test
```

**รูปแบบไฟล์ใน Route:**

- `index.js` — ลงทะเบียน HTTP Method กับ Handler function
- `[module-name].js` — ตัว Handler function จริง (Business Logic)

---

## 4. Database Schema (ภาพรวม)

### 4.1 ตารางระบบ (EV Charging Schema)

#### `tbl_action_logs` (Log การบันทึกกิจกรรมและคำสั่งต่างๆ ในระบบ)

- `action_log_code` (varchar(50) NOT NULL, PK) — รหัสล็อกกิจกรรม (`xlog-{timestamp_ms}`)
- `action_code` (varchar(50) NOT NULL, PK) — รหัสพนักงานที่สั่งทำรายการ
- `action_desc` (varchar(200) NOT NULL) — รายละเอียดหัวข้อกิจกรรม
- `action_body` (text NULL) — Request Body หรือ Payload
- `action_result` (varchar(200) NULL) — ผลการกระทำ เช่น 'success' หรือ error message
- `off_code` (varchar(50) NOT NULL) — รหัสสำนักงาน
- `ist_dt` (timestamp NOT NULL) — วันที่สร้างข้อมูล
- `mdf_dt` (timestamp NULL) — วันที่แก้ไขล่าสุด
- `rm_dt` (timestamp NULL) — วันที่ลบ (Soft Delete)

#### `tbl_authority` (สิทธิ์การใช้งานในระบบ)

- `authority_code` (varchar(255) NOT NULL, PK)
- `authority_name` (varchar(100) NULL)
- `create_by` (varchar(255) NULL)
- `modified_by` (varchar(255) NULL)
- `ist_dt` (timestamp NOT NULL)
- `mdf_dt` (timestamp NULL)
- `rm_dt` (timestamp NULL)
- `trash` (bool DEFAULT false)
- `authority_flag` (int4 DEFAULT 1)
- `authority_no` (bigserial NOT NULL) — ลำดับสิทธิ์ (Role Number)

#### `tbl_users` (บัญชีผู้ใช้งานระบบ)

- `user_code` (varchar(100) NOT NULL, PK)
- `user_name` (varchar(50) NULL)
- `user_password` (varchar(100) NULL)
- `user_authority` (int4 NULL) — อ้างอิงสิทธิ์ (`tbl_authority.authority_no`)
- `emp_code` (varchar(100) NULL)
- `name` (varchar(100) NULL)
- `lastname` (varchar(255) NULL)
- `photo` (varchar(200) NULL)
- `email` (varchar(100) NULL)
- `mobile` (varchar(13) NULL)
- `gender` (varchar(1) NULL)
- `id_card` (varchar(50) NULL)
- `default_lang` (varchar(4) DEFAULT 'th')
- `user_flag` (int2 DEFAULT 0)
- `ist_dt` (timestamp DEFAULT now())
- `mdf_dt` (timestamp NULL)
- `rm_dt` (timestamp NULL)

#### `tbl_user_charging_quota` (ตารางโควตาไฟฟ้าชาร์จประจำตัวผู้ใช้)

- `user_code` (varchar(100) NOT NULL, PK) — อ้างอิงจาก `tbl_users.user_code`
- `monthly_quota_kwh` (numeric(6, 2) DEFAULT 50.00 NOT NULL) — โควตาฟรีรายเดือน (kWh)
- `used_quota_kwh` (numeric(6, 2) DEFAULT 0.00 NOT NULL) — ปริมาณที่ใช้ไปแล้วในเดือนนี้ (kWh)
- `excess_rate_thb_kwh` (numeric(5, 2) DEFAULT 6.50 NOT NULL) — อัตราค่าไฟส่วนเกิน (บาท/kWh)
- `idle_fee_rate_thb_min` (numeric(5, 2) DEFAULT 1.00 NOT NULL) — อัตราค่าปรับจอดแช่ (บาท/นาที)
- `quota_reset_date` (date NOT NULL) — วันที่จะรีเซ็ตโควตาใหม่
- `ist_dt` (timestamp DEFAULT now() NOT NULL)
- `mdf_dt` (timestamp NULL)

#### `tbl_ev_station` (สถานีบริการชาร์จรถยนต์ไฟฟ้า)

- `ev_station_code` (varchar(100) NOT NULL, PK)
- `station_name_th` (varchar(255) NOT NULL)
- `station_name_en` (varchar(255) NULL)
- `location_description` (varchar(500) NULL)
- `latitude` (numeric(11, 8) NULL)
- `longitude` (numeric(11, 8) NULL)
- `opening_time` (time NULL)
- `closing_time` (time NULL)
- `ist_dt` (timestamp DEFAULT now() NOT NULL)
- `mdf_dt` (timestamp NULL)
- `rm_dt` (timestamp NULL)
- `station_flag` (int4 DEFAULT 1)

#### `tbl_ev_charger` (ตู้ชาร์จไฟในสถานี)

- `ev_station_code` (varchar(100) NOT NULL) — FK อ้างอิงไปยัง `tbl_ev_station.ev_station_code`
- `charger_code` (varchar(100) NOT NULL, PK)
- `connector_code` (varchar(100) NOT NULL) — FK อ้างอิงไปยัง `tbl_ev_connector.connector_code`
- `charger_name` (varchar(100) NOT NULL)
- `max_total_power_kw` (numeric(6, 2) NOT NULL) — กำลังไฟฟ้ารวมสูงสุดของตู้ชาร์จ
- `charger_status` (int2 DEFAULT 1) — สถานะการทำงานของตู้
- `charger_flag` (int4 DEFAULT 1)
- `ist_dt` (timestamp DEFAULT now() NOT NULL)
- `mdf_dt` (timestamp NULL)
- `rm_dt` (timestamp NULL)

#### `tbl_ev_connector` (หัวจ่ายชาร์จไฟฟ้าประจำเครื่องชาร์จ)

- `connector_code` (varchar(100) NOT NULL, PK)
- `charger_code` (varchar(100) NOT NULL) — รหัสตู้ชาร์จ
- `connector_name` (varchar(50) NOT NULL) — เช่น 'Connector 1', 'AC-Plug'
- `connector_type` (varchar(50) NOT NULL) — ชนิดหัวชาร์จ เช่น 'Type 2', 'CCS2', 'CHAdeMO'
- `power_type` (varchar(10) NOT NULL) — ชนิดพลังงาน: 'AC' หรือ 'DC'
- `max_connector_power_kw` (numeric(6, 2) NOT NULL) — จ่ายกำลังไฟสูงสุดได้กี่ kW
- `connector_status` (int2 DEFAULT 1) — สถานะหัวชาร์จ (1 = ว่าง/พร้อมใช้งาน, 2 = กำลังชาร์จ, 3 = ชำรุด/งดบริการ)
- `ist_dt` (timestamp DEFAULT now() NOT NULL)
- `mdf_dt` (timestamp NULL)
- `rm_dt` (timestamp NULL)
- `connector_flag` (int4 DEFAULT 1)

#### `tbl_vehicle_brand` (ยี่ห้อรถยนต์)

- `brand_code` (varchar(255) NOT NULL, PK)
- `brand_name` (varchar(255) NULL)
- `brand_flag` (int4 DEFAULT 1)
- `ist_dt` (timestamp NOT NULL)
- `mdf_dt` (timestamp NULL)
- `rm_dt` (timestamp NULL)

#### `tbl_vehicle_model` (รุ่นรถยนต์)

- `brand_code` (varchar(255) NULL) — FK อ้างอิงไปยัง `tbl_vehicle_brand.brand_code`
- `model_code` (varchar(255) NOT NULL, PK)
- `model_name` (varchar(255) NULL)
- `model_flag` (int4 DEFAULT 1)
- `ist_dt` (timestamp NOT NULL)
- `mdf_dt` (timestamp NULL)
- `rm_dt` (timestamp NULL)

#### `tbl_vehicle_type` (ประเภทรถยนต์และขีดจำกัด)

- `veh_type_code` (varchar(255) NOT NULL, PK)
- `veh_type_name` (varchar(255) NULL) — ชื่อประเภท เช่น รถเก๋ง, รถกระบะ, รถตู้
- `width` / `height` / `length` (numeric(10,2) NULL)
- `min_dimention` / `max_dimention` (numeric(10,2) NULL)
- `min_percent_dimention` (numeric(5,2) NULL)
- `min_weight` / `max_weight` / `over_weight` (numeric(10,2) NULL)
- `speed_limit` (numeric(8,2) NULL) — จำกัดความเร็ว (กม./ชม.)
- `box_limit` / `passenger_limit` (int4 NULL)
- `create_by` / `modified_by` (int4 NULL)
- `ist_dt` (timestamp NOT NULL)
- `mdf_dt` (timestamp NULL)
- `rm_dt` (timestamp NULL)
- `trash` (bool DEFAULT false)
- `veh_type_flag` (int4 DEFAULT 1)

#### `tbl_vehicle` (ข้อมูลยานพาหนะของระบบ)

- `vehicle_code` (varchar(255) NOT NULL, PK)
- `vehicle_name` (varchar(100) NULL)
- `vehicle_license` (varchar(20) NULL) — ทะเบียนรถ
- `vehicle_flag` (int4 DEFAULT 1)
- `vehicle_status` (int2 DEFAULT 1)
- `model_code` (varchar(100) NULL) — อ้างอิงรหัสรุ่น (`tbl_vehicle_model.model_code`)
- `ist_dt` (timestamp NOT NULL)
- `mdf_dt` (timestamp NULL)
- `rm_dt` (timestamp NULL)

#### `tbl_vehicle_ev_spec` (ข้อกำหนดไฟฟ้าสำหรับรถ EV)

- `vehicle_code` (varchar(255) NOT NULL, PK) — FK อ้างอิงไปยัง `tbl_vehicle.vehicle_code`
- `battery_capacity_kwh` (numeric(6, 2) NOT NULL) — ขนาดแบตเตอรี่ (kWh)
- `max_ac_charge_rate_kw` (numeric(5, 2) NULL) — อัตราชาร์จ AC สูงสุดที่รองรับ
- `max_dc_charge_rate_kw` (numeric(5, 2) NULL) — อัตราชาร์จ DC สูงสุดที่รองรับ
- `supported_connectors` (jsonb NOT NULL) — หัวชาร์จที่รองรับในรูป Array (เช่น `["Type 2", "CCS2"]`)
- `ist_dt` (timestamp DEFAULT now() NOT NULL)
- `mdf_dt` (timestamp NULL)

#### `tbl_ev_reservation` (รายการจองและการใช้บริการชาร์จไฟ)

- `reservation_code` (varchar(100) NOT NULL, PK) — รหัสคิวการจอง (`RES-YYYYMMDDHHmmss-rand`)
- `user_code` (varchar(100) NOT NULL) — ผู้ใช้งานที่ทำการจอง
- `vehicle_code` (varchar(255) NOT NULL) — รถยนต์ที่จะนำมาเข้าชาร์จ
- `connector_code` (varchar(100) NOT NULL) — FK อ้างอิงไปยัง `tbl_ev_connector.connector_code`
- `scheduled_start_time` (timestamp NOT NULL) — เวลาที่เริ่มจองคิวชาร์จ
- `scheduled_end_time` (timestamp NOT NULL) — เวลาสิ้นสุดตามการจองคิวชาร์จ
- `actual_start_time` (timestamp NULL) — เวลาที่เริ่มชาร์จไฟฟ้าจริง
- `actual_end_time` (timestamp NULL) — เวลาที่ชาร์จเสร็จและนำรถออกจริง
- `energy_delivered_kwh` (numeric(6, 2) DEFAULT 0.00 NULL) — ปริมาณไฟฟ้าที่ชาร์จได้สะสมจริง
- `quota_used_kwh` (numeric(6, 2) DEFAULT 0.00 NULL) — ปริมาณโควตาที่ถูกหักไป (kWh)
- `excess_energy_charged_kwh` (numeric(6, 2) DEFAULT 0.00 NULL) — ปริมาณไฟฟ้าชาร์จส่วนเกินโควตา
- `charging_cost_thb` (numeric(8, 2) DEFAULT 0.00 NULL) — ค่าไฟฟ้าส่วนเกินโควตา (บาท)
- `idle_duration_min` (int4 DEFAULT 0 NULL) — ระยะเวลาการจอดแช่หลังชาร์จเต็ม (นาที)
- `idle_fee_thb` (numeric(8, 2) DEFAULT 0.00 NULL) — มูลค่าค่าปรับจอดแช่ (บาท)
- `total_cost_thb` (numeric(8, 2) DEFAULT 0.00 NULL) — มูลค่าค่าใช้จ่ายรวมการชาร์จครั้งนี้ (บาท)
- `reservation_status` (int2 DEFAULT 0 NOT NULL) — สถานะการจอง (0 = จองแล้วรอเข้าใช้, 1 = กำลังชาร์จ, 2 = ชาร์จเสร็จสิ้น, 3 = ยกเลิก, 4 = No Show/เลยเวลาจอง)
- `ist_dt` (timestamp DEFAULT now() NOT NULL)
- `mdf_dt` (timestamp NULL)
- `rm_dt` (timestamp NULL)
- `reservation_flag` (int4 DEFAULT 1)

#### `tbl_ev_charging_transaction_log` (ล็อกรายละเอียดขณะทำการชาร์จในเซสชัน)

- `transaction_log_code` (varchar(100) NOT NULL, PK) — รหัสล็อก
- `reservation_code` (varchar(100) NOT NULL) — FK อ้างอิงไปยัง `tbl_ev_reservation.reservation_code`
- `log_time` (timestamp DEFAULT now() NOT NULL) — เวลาที่บันทึกข้อมูล
- `soc_percent` (int4 NOT NULL) — สถานะประจุไฟฟ้าแบตเตอรี่ (State of Charge %)
- `charging_power_kw` (numeric(5, 2) NOT NULL) — กำลังไฟฟ้าที่ปล่อยชาร์จ ณ ขณะนั้น (kW)
- `current_voltage` (numeric(6, 2) NULL) — แรงดันไฟฟ้า ณ ปัจจุบัน (V)
- `current_ampere` (numeric(6, 2) NULL) — กระแสไฟฟ้า ณ ปัจจุบัน (A)
- `energy_delivered_kwh` (numeric(6, 2) NOT NULL) — พลังงานสะสมที่จ่ายไปแล้วถึงจุดนี้ (kWh)
- `accumulated_cost_thb` (numeric(8, 2) DEFAULT 0.00 NOT NULL) — ราคาสะสมที่ใช้คำนวณจนถึงจุดนี้

---

### 4.2 Convention ของ Column ในตาราง

| Column     | ความหมาย                                         |
| ---------- | ------------------------------------------------ |
| `ist_dt`   | วันที่สร้างข้อมูล (INSERT datetime)              |
| `mdf_dt`   | วันที่แก้ไขล่าสุด (MODIFY datetime)              |
| `rm_dt`    | วันที่ลบ (REMOVE datetime) — NULL หมายถึง Active |
| `xxx_flag` | สถานะ Active: `1` = ใช้งาน, `0` = ปิดใช้งาน      |

### 4.3 Soft Delete Pattern

ระบบ **ไม่ลบข้อมูลจริง** (No Hard Delete) ทุกการ "ลบ" คือการ Soft Delete:

```sql
-- Soft Delete Pattern
UPDATE tbl_xyz SET xyz_flag = 0, rm_dt = 'YYYY-MM-DD HH:mm:ss' WHERE xyz_code = '...';
-- หรือ
UPDATE tbl_xyz SET rm_dt = 'YYYY-MM-DD HH:mm:ss' WHERE xyz_code = '...';
```

เงื่อนไข WHERE สำหรับข้อมูล Active เสมอ:

```sql
WHERE tbl_xyz.rm_dt IS NULL AND tbl_xyz.xyz_flag = 1
```

---

## 5. Pattern การ Import ที่ต้องใช้ทุกไฟล์

```javascript
const config = require("../../configuration/connection");
const pgConn = require("../../library/pgConnection");
const moment = require("moment");
const xglobal = require("../../middleware/global");
const sendResponse = xglobal.sendResponse;

const dbPrefix = config.dbPrefix(); // ปัจจุบัน return 'tms_'
```

---

## 6. Pattern การเขียน Service Function (สำคัญมาก — ต้องทำตามทุกครั้ง)

ทุก Service Function ต้องใช้ **`async/await` + `try/catch`** และมีโครงสร้างตามมาตรฐานดังนี้:

### 6.1 Pattern: GET (ดึงข้อมูล พร้อม Pagination)

```javascript
// =========================================================================
// API ดึงข้อมูล XYZ (Get XYZ Information)
// =========================================================================
exports.getXyzInformation = async (req, res, next) => {
  try {
    // ---- รับพารามิเตอร์และกำหนดค่าเริ่มต้น ----
    const lic_code = req.header("lic_code");
    let {
      xyz_code = "ALL",
      action,
      page_index = 1,
      page_limit = 10,
    } = req.body[0] || {};

    // ---- ตรวจสอบพารามิเตอร์ที่จำเป็น ----
    const missing = [];
    if (lic_code === undefined) missing.push("lic_code");
    if (action === undefined) missing.push("action");

    if (missing.length > 0) {
      return sendResponse(
        res,
        "error",
        "-1",
        `ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(", ")})`,
      );
    }

    // ---- คำนวณ Offset สำหรับ Pagination ----
    const offset = page_index > 0 ? page_index - 1 : 0;

    // ---- สร้างเงื่อนไข WHERE แบบ Dynamic ----
    const conditions = ["tbl_xyz.rm_dt IS NULL", "tbl_xyz.xyz_flag = 1"];

    if (String(xyz_code).toUpperCase() !== "ALL") {
      conditions.push(`tbl_xyz.xyz_code = '${xyz_code}'`);
    }

    const whereClause = "WHERE " + conditions.join(" AND ");

    // ---- SQL ดึงข้อมูล ----
    const dataScript = `
            SELECT 
                tbl_xyz.xyz_code,
                tbl_xyz.xyz_name,
                tbl_xyz.ist_dt
            FROM tbl_xyz
            ${whereClause}
            ORDER BY tbl_xyz.ist_dt DESC
            OFFSET (${offset} * ${page_limit}) LIMIT ${page_limit};
        `;

    const tbl_temporary = await pgConn.get(
      dbPrefix + lic_code,
      dataScript,
      config.connectionString(),
    );

    if (tbl_temporary.code) {
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "ดึงข้อมูล XYZ",
        JSON.stringify(req.body[0]),
        "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        action[0].value,
      );
      return sendResponse(
        res,
        "error",
        "-3",
        "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      );
    }

    if (tbl_temporary.data.length === 0) {
      return sendResponse(res, "success", "0", "ไม่พบข้อมูล", [], {
        page_total: 0,
        rows_total: 0,
      });
    }

    // ---- แปลง null เป็น "" ----
    const data = JSON.parse(
      JSON.stringify(tbl_temporary.data).replace(/\:null/gi, '\:""'),
    );

    // ---- SQL นับจำนวนแถว (สำหรับ Pagination) ----
    const countScript = `
            SELECT 
                COUNT(xyz_code) as rows_total,
                CEIL(COUNT(xyz_code)::float / ${page_limit}) as page_total
            FROM tbl_xyz
            ${whereClause};
        `;
    const tbl_temporary_count = await pgConn.get(
      dbPrefix + lic_code,
      countScript,
      config.connectionString(),
    );

    let page_total = 1,
      rows_total = 0;
    if (!tbl_temporary_count.code && tbl_temporary_count.data.length > 0) {
      rows_total = parseInt(tbl_temporary_count.data[0].rows_total);
      page_total = Math.max(
        1,
        parseInt(tbl_temporary_count.data[0].page_total),
      );
    }

    return sendResponse(res, "success", "0", "", data, {
      page_total,
      rows_total,
    });
  } catch (err) {
    console.error(err);
    const lic_code = req.header("lic_code");
    const action = req.body?.[0]?.action;
    if (lic_code && action) {
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "ดึงข้อมูล XYZ",
        JSON.stringify(req.body[0]),
        "เกิดข้อผิดพลาดภายในระบบ",
        action[0].value,
      );
    }
    return sendResponse(res, "error", "-4", "เกิดข้อผิดพลาดภายในระบบ");
  }
};
```

### 6.2 Pattern: ADD (เพิ่มข้อมูล + Transaction)

```javascript
// =========================================================================
// API เพิ่มข้อมูล XYZ (Add XYZ Information)
// =========================================================================
exports.addXyzInformation = async (req, res, next) => {
  try {
    const lic_code = req.header("lic_code");
    const { xyz_name, action } = req.body[0] || {};

    // ---- ตรวจสอบพารามิเตอร์ ----
    const missing = [];
    if (xyz_name === undefined) missing.push("xyz_name");
    if (action === undefined) missing.push("action");

    if (missing.length > 0) {
      return sendResponse(
        res,
        "error",
        "-1",
        `ไม่สามารถบันทึกข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(", ")})`,
      );
    }

    // ---- สร้าง Primary Key แบบ Custom ----
    const xyz_code =
      "XYZ-" +
      moment().format("YYYYMMDDHHmmss") +
      Math.floor(Math.random() * 1000);

    // ---- ดำเนินการผ่าน Transaction ----
    const transactionResult = await pgConn.executeTransaction(
      dbPrefix + lic_code,
      async (client) => {
        // ---- เช็คข้อมูลซ้ำก่อน INSERT ----
        const checkScript = `SELECT xyz_code FROM tbl_xyz WHERE xyz_name = $1 AND xyz_flag = 1 AND rm_dt IS NULL LIMIT 1;`;
        const tbl_check = await pgConn.executeWithClient(client, checkScript, [
          xyz_name,
        ]);
        if (!tbl_check.code && tbl_check.data.length > 0) {
          throw new Error(`ข้อมูล '${xyz_name}' มีอยู่ในระบบแล้ว`);
        }

        // ---- INSERT Main Record ----
        const script = `
                INSERT INTO tbl_xyz (xyz_code, xyz_name, ist_dt, xyz_flag)
                VALUES ($1, $2, $3, 1);
            `;
        const params = [
          xyz_code,
          xyz_name,
          moment().format("YYYY-MM-DD HH:mm:ss"),
        ];
        const res_insert = await pgConn.executeWithClient(
          client,
          script,
          params,
        );
        if (res_insert.code) throw new Error("ไม่สามารถบันทึกข้อมูลได้");

        return { xyz_code };
      },
      config.connectionString(),
    );

    if (transactionResult.code) {
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "เพิ่มข้อมูล XYZ",
        JSON.stringify(req.body[0]),
        transactionResult.message,
        action[0].value,
      );
      return sendResponse(
        res,
        "error",
        "-3",
        `ไม่สามารถบันทึกข้อมูล, เนื่องจาก: ${transactionResult.message}`,
      );
    }

    await xglobal.action_logs(
      lic_code,
      action[0].id,
      "เพิ่มข้อมูล XYZ",
      JSON.stringify(req.body[0]),
      "success",
      action[0].value,
    );
    return sendResponse(res, "success", "0", "บันทึกข้อมูลสำเร็จ", [
      transactionResult.data,
    ]);
  } catch (err) {
    console.error("System Error:", err);
    return sendResponse(res, "error", "-4", "เกิดข้อผิดพลาดภายในระบบ");
  }
};
```

### 6.3 Pattern: UPDATE (แก้ไขข้อมูล)

```javascript
// =========================================================================
// API แก้ไขข้อมูล XYZ (Set XYZ Information)
// =========================================================================
exports.setXyzInformation = async (req, res, next) => {
  try {
    const lic_code = req.header("lic_code");
    const { xyz_code } = req.query; // <-- Primary Key มาจาก query string
    const { xyz_name, action } = req.body[0] || {};

    const missing = [];
    if (!xyz_code) missing.push("xyz_code");
    if (!xyz_name) missing.push("xyz_name");
    if (!action) missing.push("action");

    if (missing.length > 0) {
      return sendResponse(
        res,
        "error",
        "-1",
        `ไม่สามารถแก้ไขข้อมูลได้ (ขาดพารามิเตอร์: ${missing.join(", ")})`,
      );
    }

    const script = `
            UPDATE tbl_xyz SET
                xyz_name = $1,
                mdf_dt = $2::timestamp
            WHERE xyz_code = $3;
        `;
    const params = [xyz_name, moment().format("YYYY-MM-DD HH:mm:ss"), xyz_code];

    const tbl_temporary = await pgConn.execute2params(
      dbPrefix + lic_code,
      script,
      params,
      config.connectionString(),
    );

    if (tbl_temporary.code) {
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "แก้ไขข้อมูล XYZ",
        JSON.stringify(req.body[0]),
        "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        action[0].value,
      );
      return sendResponse(
        res,
        "error",
        "-3",
        "ไม่สามารถบันทึกข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      );
    }

    await xglobal.action_logs(
      lic_code,
      action[0].id,
      "แก้ไขข้อมูล XYZ",
      JSON.stringify(req.body[0]),
      "success",
      action[0].value,
    );
    return sendResponse(res, "success", "0", "บันทึกข้อมูลสำเร็จ");
  } catch (err) {
    console.error(err);
    const lic_code = req.header("lic_code");
    const action = req.body?.[0]?.action;
    if (lic_code && action) {
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "แก้ไขข้อมูล XYZ",
        JSON.stringify(req.body[0]),
        "เกิดข้อผิดพลาดภายในระบบ",
        action[0].value,
      );
    }
    return sendResponse(res, "error", "-4", "เกิดข้อผิดพลาดภายในระบบ");
  }
};
```

### 6.4 Pattern: DELETE (Soft Delete)

```javascript
// =========================================================================
// API ลบข้อมูล XYZ (Remove XYZ)
// =========================================================================
exports.removeXyz = async (req, res, next) => {
  try {
    const lic_code = req.header("lic_code");
    const { xyz_code, action } = req.body[0] || {};

    const missing = [];
    if (xyz_code === undefined) missing.push("xyz_code");
    if (lic_code === undefined) missing.push("lic_code");
    if (action === undefined) missing.push("action");

    if (missing.length > 0) {
      return sendResponse(
        res,
        "error",
        "-1",
        `ไม่สามารถลบข้อมูล, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง (ขาด: ${missing.join(", ")})`,
      );
    }

    // ---- รองรับลบหลายรายการพร้อมกัน ----
    const xyz_codeArr = Array.isArray(xyz_code) ? xyz_code : [xyz_code];
    const placeholders = xyz_codeArr.map((_, i) => `$${i + 2}`).join(", ");

    const script = `UPDATE tbl_xyz SET xyz_flag = 0, rm_dt = $1::timestamp WHERE xyz_code IN (${placeholders});`;
    const params = [moment().format("YYYY-MM-DD HH:mm:ss"), ...xyz_codeArr];

    const tbl_temporary = await pgConn.execute2params(
      dbPrefix + lic_code,
      script,
      params,
      config.connectionString(),
    );

    if (tbl_temporary.code) {
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "ลบข้อมูล XYZ",
        JSON.stringify(req.body[0]),
        "ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
        action[0].value,
      );
      return sendResponse(
        res,
        "error",
        "-3",
        "ไม่สามารถลบข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
      );
    }

    await xglobal.action_logs(
      lic_code,
      action[0].id,
      "ลบข้อมูล XYZ",
      JSON.stringify(req.body[0]),
      "success",
      action[0].value,
    );
    return sendResponse(res, "success", "0", "ลบข้อมูลสำเร็จ");
  } catch (err) {
    console.error(err);
    const lic_code = req.header("lic_code");
    const action = req.body?.[0]?.action;
    if (lic_code && action) {
      await xglobal.action_logs(
        lic_code,
        action[0].id,
        "ลบข้อมูล XYZ",
        JSON.stringify(req.body[0]),
        "เกิดข้อผิดพลาดภายในระบบ",
        action[0].value,
      );
    }
    return sendResponse(res, "error", "-4", "เกิดข้อผิดพลาดภายในระบบ");
  }
};
```

---

## 7. Error Code Convention

| Code | ความหมาย                                       |
| ---- | ---------------------------------------------- |
| `-1` | พารามิเตอร์ขาด / ไม่ถูกต้อง (Validation Error) |
| `-2` | ไม่พบข้อมูลในระบบ (Not Found)                  |
| `-3` | Database Error (Query ล้มเหลว)                 |
| `-4` | System Error (Uncaught Exception ใน catch)     |
| `0`  | Success                                        |

---

## 8. sendResponse — รูปแบบ Response มาตรฐาน

ใช้ `sendResponse` จาก `xglobal` เสมอ ห้ามสร้าง Response Object เอง:

```javascript
// Signature
sendResponse(res, status, invalid_code, message, data?, extra?)

// ตัวอย่าง
return sendResponse(res, 'success', '0', 'บันทึกข้อมูลสำเร็จ');
return sendResponse(res, 'success', '0', '', data, { page_total, rows_total });
return sendResponse(res, 'error', '-1', 'พารามิเตอร์ไม่ครบ');
return sendResponse(res, 'error', '-3', `ไม่สามารถบันทึกข้อมูล, เนื่องจาก: ${transactionResult.message}`);
```

Response JSON ที่ได้จะอยู่ในรูปแบบ Array:

```json
[{
    "status": "success",
    "invalid_code": "0",
    "message": "",
    "data": [...],
    "page_total": 5,
    "rows_total": 42,
    "response_time": "2026-07-07 08:00:00"
}]
```

**Implementation ของ sendResponse:**

```javascript
exports.sendResponse = (
  res,
  status,
  invalid_code,
  message,
  data = [],
  extras = {},
) => {
  return res.status(200).send([
    {
      status,
      invalid_code,
      message,
      data,
      ...extras,
      response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
    },
  ]);
};
```

---

## 9. pgConnection — ฟังก์ชัน Query DB

### `pgConn.get(dbname, script, connectionString)` — SELECT

- ใช้สำหรับ: ดึงข้อมูล
- Return: `{ code: false, data: [...rows] }` หรือ `{ code: true, message: '...' }`

### `pgConn.getWithParams(dbname, script, params, connectionString)` — SELECT (Parameterized)

- ใช้สำหรับ: ดึงข้อมูลด้วย parameterized querying ปลอดภัยขึ้น

### `pgConn.execute(dbname, script, connectionString)` — INSERT/UPDATE/DELETE (ไม่มี params)

### `pgConn.execute2params(dbname, script, params, connectionString)` — INSERT/UPDATE/DELETE (มี params)

- ใช้สำหรับ: ปฏิบัติการแก้ไของค์ประกอบข้อมูลแบบมี parameter $1, $2
- **สำคัญ:** ใน backend นี้ ต้องส่ง `dbname` เป็นพารามิเตอร์แรก

### `pgConn.executeTransaction(dbname, callback, connectionString)` — Transaction

- ใช้เมื่อ: ต้องการความสอดคล้องข้อมูล เช่น จองตู้ชาร์จ หักโควตา และสร้างประวัติพร้อมกัน
- callback รับ `client` → ใช้ `pgConn.executeWithClient(client, script, params)` ภายใน

---

## 10. กฎ SQL ที่ต้องปฏิบัติ

### 10.1 Primary Key Generation

```javascript
// Pattern มาตรฐาน: PREFIX-YYYYMMDDHHmmss + random 3 หลัก
const new_code =
  "RES-" + moment().format("YYYYMMDDHHmmss") + Math.floor(Math.random() * 1000);
```

### 10.2 Timestamp

```javascript
// ใช้ moment เสมอ
moment().format("YYYY-MM-DD HH:mm:ss")
// ใน SQL ให้ใช้ ::timestamp cast เมื่อเป็น parameterized
`mdf_dt = $1::timestamp`;
```

### 10.3 Parameterized Query (ป้องกัน SQL Injection)

```javascript
// ✅ ถูกต้อง — ใช้ $1, $2 กับ execute2params หรือ executeWithClient
const script = `INSERT INTO tbl_xyz (code, name, ist_dt) VALUES ($1, $2, $3);`;
const params = [code, name, moment().format("YYYY-MM-DD HH:mm:ss")];
await pgConn.execute2params(
  dbPrefix + lic_code,
  script,
  params,
  config.connectionString(),
);
```

### 10.4 NULL Handling

```javascript
// หลังดึงข้อมูล — แปลง null เป็น "" เสมอ
const data = JSON.parse(
  JSON.stringify(tbl_temporary.data).replace(/\:null/gi, '\:""'),
);
```

### 10.5 JSON Operators (สำหรับ EV Specs)

ในการ Query ข้อมูล JSONB ของหัวชาร์จที่รองรับใน `tbl_vehicle_ev_spec`:

```sql
SELECT * FROM tbl_vehicle_ev_spec WHERE supported_connectors @> $1::jsonb;
```

---

## 11. Route Index Pattern (index.js)

```javascript
const express = require("express");
const router = express.Router();
const reservation = require("./reservation");

router.post("/information", reservation.getReservationInformation);
router.put("/information", reservation.addReservation);
router.patch("/information", reservation.setReservation);
router.delete("/information", reservation.removeReservation);

module.exports = router;
```

---

## 12. Action Log (Audit Trail)

**ต้องบันทึก `action_logs` ทุกครั้งที่มีการ Write data หรือมี Error สำคัญ:**

```javascript
await xglobal.action_logs(
  lic_code,
  action[0].id,
  "จองคิวเครื่องชาร์จรถ EV",
  JSON.stringify(req.body[0]),
  "success",
  action[0].value,
);
```

---

## 13. Environment Variables

```env
PORT=9100
IS_PROD=false
DB_PREFIX=tms_
DB_DATABASE_SIT=tms_aos01
DB_DATABASE_PROD=tms_aos_qa
```

---

## 14. กฎที่ห้ามทำ

1. **ห้าม Hard Delete** — ใช้ Soft Delete (`flag = 0, rm_dt = now()`) เท่านั้น
2. **ห้ามสร้าง Response Object เอง** — ใช้ `sendResponse()` เสมอ
3. **ห้ามลืม `return`** ก่อน `sendResponse` ทุกครั้ง เพื่อป้องกัน "headers already sent"
4. **ห้ามใช้ Timestamp แบบ JavaScript** (`new Date()`) — ให้ใช้ `moment().format('YYYY-MM-DD HH:mm:ss')` เสมอ
5. **ห้ามลืมส่ง `dbname` ให้ `execute2params`** — ต้องส่ง `dbPrefix + lic_code` เป็นพารามิเตอร์แรกเสมอ
