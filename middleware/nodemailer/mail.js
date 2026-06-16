const nodemailer = require('nodemailer');

const prod = process.env.IS_PROD === 'true';

// ======= Config SMTP (Production & SIT) =======
const MAIL_CONFIGS = {
  production: {
    host: process.env.MAIL_HOST_PROD || "smtp.bangchak.co.th",
    port: parseInt(process.env.MAIL_PORT_PROD || "25", 10),
    secure: process.env.MAIL_SECURE_PROD === 'true',
    auth: {
      user: process.env.MAIL_USER_PROD || "TMS-automail",
      pass: process.env.MAIL_PASS_PROD || "Tm$@1234"
    },
    from: process.env.MAIL_FROM_PROD || '"AOS System" <noreply@bangchak.co.th>'
  },
  sit: {
    host: process.env.MAIL_HOST_SIT || "smtp.gmail.com",
    port: parseInt(process.env.MAIL_PORT_SIT || "587", 10),
    secure: process.env.MAIL_SECURE_SIT === 'true',
    auth: {
      user: process.env.MAIL_USER_SIT || "mrxon2486@gmail.com",
      pass: process.env.MAIL_PASS_SIT || "dcrckiikupzsbjny"
    },
    from: process.env.MAIL_FROM_SIT || '"AOS System (SIT)" <noreply@bangchak.co.th>'
  }
};

// เลือก Config ตาม ENV
const currentConfig = prod ? MAIL_CONFIGS.production : MAIL_CONFIGS.sit;

console.log(currentConfig)



const transporter = nodemailer.createTransport({
  host: currentConfig.host,
  port: currentConfig.port,
  secure: currentConfig.secure,
  // auth: {
  //   user: currentConfig.auth.user,
  //   pass: currentConfig.auth.pass
  // }
});


/**
 *  ฟังก์ชันส่งอีเมล
 * @param {string} to - อีเมลผู้รับ
 * @param {string} subject - หัวข้อ
 * @param {string} html - เนื้อหา HTML
 * @param {Array} attachments - ไฟล์แนบ (Optional)
 */
exports.sendMail = async (to, subject, html, attachments = [], cc = "") => {
  try {
    const info = await transporter.sendMail({
      from: currentConfig.from,
      to,
      cc,
      subject,
      html,
      attachments
    });

    console.log(`   ✅ [MAIL SENT] to=${to} | subject=${subject} | msgId=${info.messageId} | Attachments: ${attachments.length}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`   ❌ [MAIL ERROR] host=${currentConfig.host}:${currentConfig.port} | code=${error.code} | cmd=${error.command} | msg=${error.message}`);
    return { success: false, error: error.message, code: error.code };
  }
};

exports.mailConfig = () => currentConfig;
