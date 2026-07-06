const router = require("express").Router();
const User = require("../models/User");
const { protect, requireAdmin } = require("../middleware/auth");

router.use(protect, requireAdmin);

// GET /api/admin/users
router.get("/users", async (_req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: 1 });
    res.json({ users: users.map((u) => u.toPublic()) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:id/role
router.patch("/users/:id/role", async (req, res, next) => {
  try {
    const { role } = req.body || {};
    if (!["admin", "user"].includes(role)) {
      return res.status(400).json({ message: "Role must be 'admin' or 'user'." });
    }
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: "You cannot change your own role." });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ message: "Account not found." });

    res.json({ user: user.toPublic() });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/users/:id
router.delete("/users/:id", async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: "You cannot remove your own account." });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "Account not found." });
    res.json({ message: "Account removed." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
