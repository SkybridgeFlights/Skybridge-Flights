// utils/sendEmail.js
const nodemailer = require('nodemailer');

/**
 * إرسال بريد إلكتروني باستخدام SMTP
 * @param {Object} options
 * @param {string} options.to - البريد المستلم
 * @param {string} options.subject - موضوع البريد
 * @param {string} options.html - محتوى HTML للبريد
 * @param {string} [options.text] - نسخة نصية عادية
 */
const sendEmail = async (options) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT || 587),
      secure: process.env.EMAIL_SECURE === 'true', // false = STARTTLS
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false, // للتوافق مع بعض السيرفرات
      }
    });

    const mailOptions = {
      from: `"Skybridge Flights" <${process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${options.to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('SendEmail Error:', error);
    throw new Error('Failed to send email');
  }
};

module.exports = sendEmail;