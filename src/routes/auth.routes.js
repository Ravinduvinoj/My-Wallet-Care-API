const crypto = require("crypto");
const router = require("express").Router();
const User = require("../models/User");
const { protect, signToken } = require("../middleware/auth");

const hashToken = (t) =>
  crypto.createHash("sha256").update(t.trim().toUpperCase()).digest("hex");

// POST /api/auth/register
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const existing = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const user = await User.create({ name, email, password });
    res.status(201).json({ token: signToken(user), user: user.toPublic() });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const user = await User.findOne({
      email: String(email || "").toLowerCase().trim(),
    }).select("+password");

    if (!user || !(await user.comparePassword(String(password || "")))) {
      return res.status(401).json({ message: "Incorrect email or password." });
    }

    res.json({ token: signToken(user), user: user.toPublic() });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — validate a stored token and return the fresh user.
router.get("/me", protect, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

// POST /api/auth/forgot-password
// A production build would email the reset code. Until an email service is
// wired up, the code is returned in the response so the flow works end-to-end.
router.post("/forgot-password", async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").toLowerCase().trim();
    const user = await User.findOne({ email });

    // Always respond 200 — never reveal whether an email is registered.
    if (!user) return res.json({ token: null });

    const token = crypto.randomBytes(4).toString("hex").toUpperCase(); // e.g. "A1B2C3D4"
    user.resetPasswordToken = hashToken(token);
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    await user.save();

    res.json({ token }); // TODO: replace with an email send in production.
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res, next) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token) return res.status(400).json({ message: "Reset code is required." });
    if (String(newPassword || "").length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters." });
    }

    const user = await User.findOne({
      resetPasswordToken: hashToken(String(token)),
      resetPasswordExpires: { $gt: new Date() },
    }).select("+resetPasswordToken +resetPasswordExpires");

    if (!user) {
      return res.status(400).json({ message: "This reset code is invalid or has expired." });
    }

    user.password = String(newPassword);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password has been reset." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
