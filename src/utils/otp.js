const crypto = require("crypto");

/** A 5-digit numeric one-time code, e.g. "04821". */
function generateOtp() {
  return String(crypto.randomInt(0, 100000)).padStart(5, "0");
}

/** Store only the hash of an OTP, never the plain value. */
function hashOtp(otp) {
  return crypto.createHash("sha256").update(String(otp)).digest("hex");
}

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

module.exports = { generateOtp, hashOtp, OTP_TTL_MS };
