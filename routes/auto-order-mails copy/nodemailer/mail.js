const nodemailer = require('nodemailer');
const moment = require('moment');

const prod = false;

// ======= ข้อมูล SMTP สำหรับส่งเมลจริง (Production) =======
const mailConfigProd = {
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "your-email@gmail.com",
    pass: "your-app-password" // ใช้ App Password 16 หลัก แทนรหัสผ่านปกติ
  },
  from: '"AOS System" <noreply@bangchak.co.th>'
};

// ======= ข้อมูล SMTP สำหรับส่งเมลจริง (SIT/Test) =======
const mailConfigSit = {
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "mrxon2486@gmail.com",
    pass: "iwvmuthdeksfpsed" // ใช้ App Password 16 หลัก (ลบช่องว่างออก)
  },
  from: '"AOS System (SIT)" <noreply@bangchak.co.th>'
};

// เลือก Config ตาม Environment
const currentConfig = (prod == true) ? mailConfigProd : mailConfigSit;

// สร้าง Transporter ครั้งเดียว
const transporter = nodemailer.createTransport({
  host: currentConfig.host,
  port: currentConfig.port,
  secure: currentConfig.secure,
  auth: {
    user: currentConfig.auth.user,
    pass: currentConfig.auth.pass
  }
});

/**
 *  ฟังก์ชันหลักสำหรับส่งอีเมล
 * @param {string} to - อีเมลผู้รับ
 * @param {string} subject - หัวข้ออีเมล
 * @param {string} html - เนื้อหาอีเมล (HTML)
 */
exports.sendMail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: currentConfig.from,
      to: to,
      subject: subject,
      html: html
    });

    console.log(`   ✅ [MAIL SENT] Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`   ❌ [MAIL ERROR]:`, error.message);
    return { success: false, error: error.message };
  }
};

exports.mailConfig = () => currentConfig;
