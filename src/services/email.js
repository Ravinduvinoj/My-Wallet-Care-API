// Email sending via Gmail SMTP (using an app password). If SMTP isn't
// configured, OTP codes are logged to the console so the flow still works
// in development.
const nodemailer = require("nodemailer");

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

const from = () => process.env.MAIL_FROM || `WalletCare <${process.env.SMTP_USER}>`;

function otpEmail(otp, purpose) {
  const heading =
    purpose === "verify" ? "Verify your email" : "Reset your password";
  const line =
    purpose === "verify"
      ? "Use this code to verify your WalletCare account:"
      : "Use this code to reset your WalletCare password:";
  const subject =
    purpose === "verify" ? "Your WalletCare verification code" : "Your WalletCare password reset code";
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0f172a">
    <h2 style="color:#059669;margin:0 0 8px">WalletCare</h2>
    <h3 style="margin:0 0 12px">${heading}</h3>
    <p style="color:#475569">${line}</p>
    <p style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#ecfdf5;color:#047857;
              text-align:center;padding:16px;border-radius:12px;margin:16px 0">${otp}</p>
    <p style="color:#64748b;font-size:13px">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
  </div>`;
  return { subject, html };
}

/** Send a one-time code. Never throws — logs on failure so auth flows aren't
 * blocked by a transient mail error (the code is stored; users can resend). */
async function sendOtp(to, otp, purpose) {
  const t = getTransporter();
  if (!t) {
    console.log(`[email disabled] OTP for ${to} (${purpose}): ${otp}`);
    return false;
  }
  try {
    const { subject, html } = otpEmail(otp, purpose);
    await t.sendMail({ from: from(), to, subject, html });
    return true;
  } catch (e) {
    console.error(`Failed to email OTP to ${to}:`, e.message);
    return false;
  }
}

/** Verify the SMTP connection/credentials (used at boot and in tests). */
async function verifyConnection() {
  const t = getTransporter();
  if (!t) return { configured: false };
  await t.verify();
  return { configured: true, ok: true };
}

module.exports = { sendOtp, verifyConnection };
