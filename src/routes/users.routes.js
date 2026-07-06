const router = require("express").Router();
const User = require("../models/User");
const { protect } = require("../middleware/auth");

router.use(protect);

// PATCH /api/users/me — update own profile (name/email).
router.patch("/me", async (req, res, next) => {
  try {
    const { name, email } = req.body || {};

    if (email !== undefined) {
      const normalized = String(email).toLowerCase().trim();
      const taken = await User.findOne({ email: normalized, _id: { $ne: req.user.id } });
      if (taken) return res.status(409).json({ message: "That email is already in use." });
      req.user.email = normalized;
    }
    if (name !== undefined) req.user.name = String(name).trim();

    await req.user.save();
    res.json({ user: req.user.toPublic() });
  } catch (err) {
    next(err);
  }
});

// POST /api/users/me/password — change own password.
router.post("/me/password", async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (String(newPassword || "").length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters." });
    }

    const user = await User.findById(req.user.id).select("+password");
    if (!(await user.comparePassword(String(currentPassword || "")))) {
      return res.status(400).json({ message: "Your current password is incorrect." });
    }

    user.password = String(newPassword);
    await user.save();
    res.json({ message: "Password changed." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
