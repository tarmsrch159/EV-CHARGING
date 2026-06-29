const nodemailer = require("nodemailer");

const prod = process.env.IS_PROD === "true";

// ======= Config SMTP (Production & SIT) =======
const MAIL_CONFIGS = {
  production: {
    host: process.env.MAIL_HOST_PROD || "172.19.100.100",
    port: parseInt(process.env.MAIL_PORT_PROD || "25", 10),
    secure: false,
    auth: {},
    from: process.env.MAIL_FROM_PROD || '"AOS System" <noreply@bangchak.co.th>',
    tls: {
      rejectUnauthorized: false,
    },
  },
  sit: {
    host: process.env.MAIL_HOST_SIT || "smtp.gmail.com",
    port: parseInt(process.env.MAIL_PORT_SIT || "587", 10),
    secure: false,
    auth: {
      user: process.env.MAIL_USER_SIT || "mrxon2486@gmail.com",
      pass: process.env.MAIL_PASS_SIT || "dcrckiikupzsbjny",
    },
    from:
      process.env.MAIL_FROM_SIT ||
      '"AOS System (SIT)" <noreply@bangchak.co.th>',
  },
};

// เลือก Config ตาม ENV
const currentConfig = prod ? MAIL_CONFIGS.production : MAIL_CONFIGS.sit;

console.log(currentConfig);

const transporter = nodemailer.createTransport({
  host: currentConfig.host,
  port: currentConfig.port,
  secure: currentConfig.secure,
  auth: currentConfig.auth,
  tls: currentConfig.tls,
});

/**
 *  ฟังก์ชันส่งอีเมล
 * @param {string} to - อีเมลผู้รับ
 * @param {string} subject - หัวข้อ
 * @param {string} html - เนื้อหา HTML
 * @param {Array} attachments - ไฟล์แนบ (Optional)
 */
exports.sendMail = async (to, subject, html, attachments = [], cc = "") => {
  const ccList = process.env.IS_PROD
    ? [
        "ornwara_tr@dtc.co.th",
        "somporn@wssoft.co.th",
        "pitawat_ru@dtc.co.th",
        "athiphat_ch@dtc.co.th",
        "puautarm@gmail.com",
      ]
    : ["puautarm@gmail.com"];
  try {
    const info = await transporter.sendMail({
      from: currentConfig.from,
      to: prod ? "amnart_pg@dtc.co.th" : "tarmsrch159@gmail.com",
      cc: ccList,
      subject,
      html,
      attachments,
    });

    console.log(
      `   ✅ [MAIL SENT] to=${to} | subject=${subject} | msgId=${info.messageId} | Attachments: ${attachments.length}`,
    );
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(
      `   ❌ [MAIL ERROR] host=${currentConfig.host}:${currentConfig.port} | code=${error.code} | cmd=${error.command} | msg=${error.message}`,
    );
    return { success: false, error: error.message, code: error.code };
  }
};

exports.mailConfig = () => currentConfig;
