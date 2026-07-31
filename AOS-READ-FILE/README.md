# AOS-READ-FILE

ระบบอ่านไฟล์ CSV จาก FTP/SFTP Server

---

## 📁 โครงสร้างโปรเจกต์

```
AOS-READ-FILE/
├── .env                          # Environment variables (DB + API)
├── db.js                         # Shared PostgreSQL connection pool
├── server.js                     # Express API server (port 5555)
├── package.json
├── workers/                      # Background workers
│   ├── ftp-worker.js             # ✨ Unified worker (Dynamic FTP/SFTP)
│   ├── ftp-worker-basic.js       # Worker สำหรับ Basic FTP (basic-ftp)
│   ├── ftp-worker-ssh.js         # Worker สำหรับ SFTP (ssh2-sftp-client)
│   ├── helpers/
│   │   ├── date-helper.js        # Helper: convertDateDMY()
│   │   └── file-processor.js     # Helper: processFilesInFolder()
│   └── parsers/
│       ├── omi-parser.js         # Parser: tbl_order_omi
│       ├── eodmeter-parser.js    # Parser: tbl_order_eodmeter
│       └── eodtank-parser.js     # Parser: tbl_order_eodtank
├── modules/                      # API modules (controller/service pattern)
│   └── connection-configs/
│       ├── connection-configs.controller.js
│       └── connection-configs.service.js
└── backup/                       # ไฟล์ backup เวอร์ชันเก่า
    └── ftp-worker-backup.js
```

---

## ⚙️ การตั้งค่า

### 1. ติดตั้ง Dependencies

```bash
npm install
```

### 2. ตั้งค่า `.env`

```env
# Database (PostgreSQL)
DB_USER=postgres
DB_HOST=203.150.210.25
DB_NAME=tms_aos01
DB_PASSWORD=your_password
DB_PORT=5432

# API Server
API_PORT=5555
```

### 3. ตั้งค่า Connection Configs ในฐานข้อมูล

Worker จะดึง config จากตาราง `tbl_connection_configs` โดยอัตโนมัติ:

| config_type | การเชื่อมต่อ | Library |
|---|---|---|
| `filezilla` | Basic FTP | `basic-ftp` |
| `sftp` | SFTP/SSH | `ssh2-sftp-client` |

เงื่อนไขการทำงาน: `config_flag = '1'` (เปิดใช้งาน)

สามารถเพิ่ม/แก้ไข config ผ่าน API ได้ (ดูหัวข้อ API ด้านล่าง)

---

## 🚀 การรันงาน

```bash
# รัน API Server
npm run api

# ✨ รัน Unified Worker (แนะนำ — รองรับทั้ง FTP และ SFTP อัตโนมัติ)
npm start

# รันแยกเฉพาะ FTP
npm run start:basic

# รันแยกเฉพาะ SFTP
npm run start:sftp
```

---

## 🔄 Dynamic Worker — วิธีทำงาน

`ftp-worker.js` เป็น **Unified Worker** ที่รวมการทำงานทั้ง FTP และ SFTP ไว้ในตัวเดียว:

```
DB: SELECT * FROM tbl_connection_configs WHERE config_flag = '1'
                        │
             ┌──────────┴──────────┐
             │                     │
   config_type = 'filezilla'   config_type = 'sftp'
             │                     │
      processFTP(config)     processSFTP(config)
   (ftp-worker-basic.js)    (ftp-worker-ssh.js)
```

1. **ดึง config ทั้งหมด** จาก DB ที่ `config_flag = '1'`
2. **วน config ทีละตัว** → เช็ค `config_type`
3. **Switch** ไปเรียก worker ที่ตรงกัน (`filezilla` → FTP, `sftp` → SFTP)
4. **แต่ละ worker** จะ connect, อ่านไฟล์, parse, insert DB, ย้ายไฟล์ backup

---

## 📊 ตารางฐานข้อมูลที่ใช้

### ตารางข้อมูลการขาย

| ตาราง | ข้อมูล | แหล่ง CSV |
|---|---|---|
| `tbl_order_omi` | ข้อมูลการขายรายชั่วโมง | โฟลเดอร์ `OMI/OMI` |
| `tbl_order_eodmeter` | ข้อมูลการขายรายวัน (Meter) | โฟลเดอร์ `EODmeter` |
| `tbl_order_eodtank` | ข้อมูล Stock สิ้นวัน (Tank) | โฟลเดอร์ `EODTank/{YYYYMM}/` |

### ตาราง Config

| ตาราง | คำอธิบาย |
|---|---|
| `tbl_connection_configs` | เก็บข้อมูลการเชื่อมต่อ FTP/SFTP |

---

## 🔌 REST API — Connection Configs

Base URL: `http://localhost:5555/api/connection-configs`

| Method | Path | คำอธิบาย |
|---|---|---|
| `GET` | `/` | ดึงข้อมูลทั้งหมด (เฉพาะ active) |
| `GET` | `/:id` | ดึงข้อมูลตาม ID |
| `POST` | `/` | เพิ่ม config ใหม่ |
| `PUT` | `/:id` | แก้ไข config |
| `DELETE` | `/:id` | ลบ config (soft delete) |

### ตัวอย่าง POST

```bash
curl -X POST http://localhost:5555/api/connection-configs \
  -H "Content-Type: application/json" \
  -d '{
    "config_name": "FTP Server 1",
    "config_type": "sftp",
    "host_address": "10.255.255.42",
    "port": 22,
    "username": "user",
    "password": "pass",
    "db_name": "tms_aos01",
    "config_flag": "1"
  }'
```

> **หมายเหตุ**: `config_type` ต้องเป็น `'filezilla'` หรือ `'sftp'` เท่านั้น เพื่อให้ Unified Worker เลือก connection ได้ถูกต้อง

---

## 📦 Dependencies

| Package | หน้าที่ |
|---|---|
| `basic-ftp` | เชื่อมต่อ FTP Server |
| `ssh2-sftp-client` | เชื่อมต่อ SFTP Server |
| `pg` | เชื่อมต่อ PostgreSQL |
| `express` | REST API framework |
| `node-cron` | ตั้งเวลา Cron Job |
| `dotenv` | อ่าน Environment Variables |
