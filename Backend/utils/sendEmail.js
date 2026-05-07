// utils/sendEmail.js
const { Resend } = require('resend');

// Lazy: client is created on first use, not at import time.
let _resend = null;

const isEmailConfigured = () => !!process.env.RESEND_API_KEY;

const sendEmail = async ({ to, subject, html }) => {
  if (!isEmailConfigured()) {
    console.warn('[email] RESEND_API_KEY not configured — skipping email');
    return false;
  }

  try {
    if (!_resend) {
      _resend = new Resend(process.env.RESEND_API_KEY);
    }

    const response = await _resend.emails.send({
      from: `Skybridge Flights <${process.env.EMAIL_FROM}>`,
      to: [to],
      subject,
      html,
    });

    console.log('Email sent:', response);
    return response;
  } catch (error) {
    console.warn('[email] Failed to send email:', error.message);
    return false;
  }
};

module.exports = sendEmail;
module.exports.isEmailConfigured = isEmailConfigured;