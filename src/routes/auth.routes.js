const router = require("express").Router();
const totp = require("../services/totp");
const User = require("../models/User");
const { protect, signToken } = require("../middleware/auth");
const { log } = require("../utils/audit");
const { sendOtp } = require("../services/email");
const { generateOtp, hashOtp, OTP_TTL_MS } = require("../utils/otp");

const codeHash = (c) => hashOtp(String(c || "").trim());
const normEmail = (e) => String(e || "").toLowerCase().trim();

/** Create a fresh email-verification OTP on the user and email it. */
async function issueVerifyOtp(user) {
  const otp = generateOtp();
  user.emailOtp = codeHash(otp);
  user.emailOtpExpires = new Date(Date.now() + OTP_TTL_MS);
  await user.save();
  await sendOtp(user.email, otp, "verify");
}

// POST /api/auth/register — creates the account (unverified) and emails an OTP.
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    const mail = normEmail(email);
    if (!name || !mail || !password) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const existing = await User.findOne({ email: mail });
    if (existing) {
      // Already verified -> real conflict. Not verified -> resend a code.
      if (existing.emailVerified) {
        return res.status(409).json({ message: "An account with this email already exists." });
      }
      await issueVerifyOtp(existing);
      return res.json({ verificationRequired: true, email: mail });
    }

    const user = await User.create({ name, email: mail, password });
    await issueVerifyOtp(user);
    log(user.id, "register", mail, req.ip);
    res.status(201).json({ verificationRequired: true, email: mail });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/verify-email — { email, otp } -> logs the user in on success.
router.post("/verify-email", async (req, res, next) => {
  try {
    const { email, otp } = req.body || {};
    const user = await User.findOne({ email: normEmail(email) }).select("+emailOtp +emailOtpExpires");
    if (!user) return res.status(400).json({ message: "Account not found." });
    if (user.emailVerified) return res.json({ token: signToken(user), user: user.toPublic() });

    if (!user.emailOtp || !user.emailOtpExpires || user.emailOtpExpires < new Date()) {
      return res.status(400).json({ message: "This code has expired. Please request a new one." });
    }
    if (user.emailOtp !== codeHash(otp)) {
      return res.status(400).json({ message: "Incorrect code. Please try again." });
    }

    user.emailVerified = true;
    user.emailOtp = undefined;
    user.emailOtpExpires = undefined;
    user.lastLoginAt = new Date();
    await user.save();
    log(user.id, "verify_email", user.email, req.ip);
    res.json({ token: signToken(user), user: user.toPublic() });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/resend-otp — { email }. Always 200 (don't reveal existence).
router.post("/resend-otp", async (req, res, next) => {
  try {
    const user = await User.findOne({ email: normEmail(req.body?.email) });
    if (user && !user.emailVerified) await issueVerifyOtp(user);
    res.json({ message: "If that account needs verifying, a new code is on its way." });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password, token } = req.body || {};
    const user = await User.findOne({ email: normEmail(email) }).select("+password +twoFactorSecret");

    if (!user || !(await user.comparePassword(String(password || "")))) {
      return res.status(401).json({ message: "Incorrect email or password." });
    }
    if (user.isSuspended) {
      return res.status(403).json({ message: "This account has been suspended." });
    }
    // Accounts that registered but never verified: send a fresh code and ask
    // the client to verify (200 so it's handled, not shown as an error).
    if (user.emailVerified === false) {
      await issueVerifyOtp(user);
      return res.json({ verificationRequired: true, email: user.email });
    }

    // Two-factor step-up: password is correct, now require a valid TOTP code.
    if (user.twoFactorEnabled) {
      if (!token) return res.json({ twoFactorRequired: true });
      if (!totp.verify(token, user.twoFactorSecret)) {
        return res.status(401).json({ message: "Invalid authentication code." });
      }
    }

    user.lastLoginAt = new Date();
    await user.save();
    log(user.id, "login", user.email, req.ip);
    res.json({ token: signToken(user), user: user.toPublic() });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — validate a stored token and return the fresh user.
router.get("/me", protect, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

// POST /api/auth/forgot-password — emails a 5-digit reset code.
router.post("/forgot-password", async (req, res, next) => {
  try {
    const mail = normEmail(req.body?.email);
    const user = await User.findOne({ email: mail });
    // Always respond 200 — never reveal whether an email is registered.
    if (user) {
      const otp = generateOtp();
      user.resetPasswordToken = codeHash(otp);
      user.resetPasswordExpires = new Date(Date.now() + OTP_TTL_MS);
      await user.save();
      await sendOtp(user.email, otp, "reset");
    }
    res.json({ message: "If that email is registered, a reset code has been sent." });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password — { email, otp, newPassword }
router.post("/reset-password", async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body || {};
    if (!otp) return res.status(400).json({ message: "Reset code is required." });
    if (String(newPassword || "").length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters." });
    }

    const user = await User.findOne({
      email: normEmail(email),
      resetPasswordExpires: { $gt: new Date() },
    }).select("+resetPasswordToken +resetPasswordExpires");

    if (!user || user.resetPasswordToken !== codeHash(otp)) {
      return res.status(400).json({ message: "This reset code is invalid or has expired." });
    }

    user.password = String(newPassword);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    // Resetting the password also confirms control of the email.
    user.emailVerified = true;
    await user.save();

    res.json({ message: "Password has been reset." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
