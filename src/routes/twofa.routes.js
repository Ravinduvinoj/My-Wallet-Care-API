const router = require("express").Router();
const totp = require("../services/totp");
const QRCode = require("qrcode");
const User = require("../models/User");
const { protect } = require("../middleware/auth");
const { wrap } = require("../utils/http");
const { log } = require("../utils/audit");

router.use(protect);

// POST /api/auth/2fa/setup — generate a secret + QR. Not enabled until verified.
router.post("/setup", wrap(async (req, res) => {
  const secret = totp.generateSecret();
  const user = await User.findById(req.user.id);
  user.twoFactorSecret = secret;
  await user.save();

  const otpauth = totp.keyuri(user.email, "WalletCare", secret);
  const qr = await QRCode.toDataURL(otpauth);
  res.json({ secret, otpauth, qr });
}));

// POST /api/auth/2fa/enable — verify a code against the pending secret.
router.post("/enable", wrap(async (req, res) => {
  const { token } = req.body || {};
  const user = await User.findById(req.user.id).select("+twoFactorSecret");
  if (!user.twoFactorSecret) return res.status(400).json({ message: "Run setup first." });
  if (!totp.verify(token, user.twoFactorSecret)) {
    return res.status(400).json({ message: "Invalid code. Try again." });
  }
  user.twoFactorEnabled = true;
  await user.save();
  log(user.id, "2fa_enabled", user.email);
  res.json({ user: user.toPublic() });
}));

// POST /api/auth/2fa/disable — requires the account password.
router.post("/disable", wrap(async (req, res) => {
  const { password } = req.body || {};
  const user = await User.findById(req.user.id).select("+password");
  if (!(await user.comparePassword(String(password || "")))) {
    return res.status(400).json({ message: "Password is incorrect." });
  }
  user.twoFactorEnabled = false;
  user.twoFactorSecret = undefined;
  await user.save();
  log(user.id, "2fa_disabled", user.email);
  res.json({ user: user.toPublic() });
}));

module.exports = router;
