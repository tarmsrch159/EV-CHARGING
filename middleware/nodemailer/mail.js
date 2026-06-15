const nodemailer = require('nodemailer');

const ENV = {
  PROD: true
};

// ======= Config SMTP (Production & SIT) =======
const MAIL_CONFIGS = {
  production: {
    host: "smtp.bangchak.co.th",
    port: 25,
    secure: false,
    from: '"AOS System" <noreply@bangchak.co.th>'
  },
  sit: {
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: "mrxon2486@gmail.com",
      pass: "dcrckiikupzsbjny"
    },
    from: '"AOS System (SIT)" <noreply@bangchak.co.th>'
  }
};

// เลือก Config ตาม ENV
const currentConfig = ENV.PROD ? MAIL_CONFIGS.production : MAIL_CONFIGS.sit;



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
