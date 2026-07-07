// Thin wrapper over otplib v13's functional API (whose verify() returns an
// object, not a boolean). Keeps the 2FA routes readable and version-insulated.
const otp = require("otplib");

module.exports = {
  generateSecret: () => otp.generateSecret(),
  keyuri: (email, issuer, secret) => otp.generateURI({ secret, label: email, issuer }),
  generate: (secret) => otp.generateSync({ secret }),
  verify: (token, secret) => {
    if (!token || !secret) return false;
    const result = otp.verifySync({ token: String(token), secret });
    return result === true || (result && result.valid === true);
  },
};
