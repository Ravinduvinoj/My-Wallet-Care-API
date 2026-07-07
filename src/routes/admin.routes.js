const router = require("express").Router();
const User = require("../models/User");
const Category = require("../models/Category");
const Transaction = require("../models/Transaction");
const ActivityLog = require("../models/ActivityLog");
const { protect, requireAdmin } = require("../middleware/auth");
const { pick, wrap } = require("../utils/http");
const { dump, restore } = require("../services/backup");
const { log } = require("../utils/audit");

router.use(protect, requireAdmin);

// --- database backup / restore ---------------------------------------------

// GET /api/admin/backup — download the whole database as JSON.
router.get("/backup", wrap(async (req, res) => {
  const data = await dump();
  log(req.user.id, "db_backup", `${Object.keys(data.collections).length} collections`);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="walletcare-backup-${Date.now()}.json"`);
  res.send(JSON.stringify(data));
}));

// POST /api/admin/restore — replace all collections from an uploaded backup.
router.post("/restore", wrap(async (req, res) => {
  const summary = await restore(req.body);
  log(req.user.id, "db_restore", JSON.stringify(summary));
  res.json({ message: "Database restored.", summary });
}));

// --- users -----------------------------------------------------------------

router.get("/users", wrap(async (_req, res) => {
  const users = await User.find().sort({ createdAt: 1 });
  res.json({ users: users.map((u) => u.toPublic()) });
}));

router.post("/users", wrap(async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required." });
  }
  const exists = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (exists) return res.status(409).json({ message: "Email already in use." });
  const user = await User.create({ name, email, password, role: role === "admin" ? "admin" : "user" });
  res.status(201).json({ user: user.toPublic() });
}));

router.patch("/users/:id", wrap(async (req, res) => {
  const updates = pick(req.body, ["name", "email", "role", "isSuspended"]);
  if (req.params.id === req.user.id && (updates.role === "user" || updates.isSuspended)) {
    return res.status(400).json({ message: "You can't demote or suspend yourself." });
  }
  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!user) return res.status(404).json({ message: "Account not found." });
  res.json({ user: user.toPublic() });
}));

router.patch("/users/:id/role", wrap(async (req, res) => {
  const { role } = req.body || {};
  if (!["admin", "user"].includes(role)) return res.status(400).json({ message: "Invalid role." });
  if (req.params.id === req.user.id) return res.status(400).json({ message: "You can't change your own role." });
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
  if (!user) return res.status(404).json({ message: "Account not found." });
  res.json({ user: user.toPublic() });
}));

router.post("/users/:id/suspend", wrap(async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ message: "You can't suspend yourself." });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "Account not found." });
  user.isSuspended = !user.isSuspended;
  await user.save();
  res.json({ user: user.toPublic() });
}));

router.delete("/users/:id", wrap(async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ message: "You can't remove your own account." });
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: "Account not found." });
  res.json({ message: "Account removed." });
}));

// --- stats / audit ---------------------------------------------------------

router.get("/stats", wrap(async (_req, res) => {
  const [users, admins, suspended, txns, income] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: "admin" }),
    User.countDocuments({ isSuspended: true }),
    Transaction.countDocuments(),
    Transaction.aggregate([
      { $match: { type: "income", source: { $ne: "transfer" } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);
  res.json({
    users, admins, suspended, transactions: txns,
    totalIncomeTracked: income[0]?.total || 0,
  });
}));

router.get("/audit", wrap(async (req, res) => {
  const logs = await ActivityLog.find()
    .sort({ createdAt: -1 })
    .limit(Math.min(200, parseInt(req.query.limit) || 100))
    .populate("user", "name email");
  res.json({ logs });
}));

// --- default categories ----------------------------------------------------

router.post("/categories", wrap(async (req, res) => {
  const cat = await Category.create({ ...pick(req.body, ["name", "type", "icon", "color"]), user: null });
  res.status(201).json({ item: cat });
}));

router.delete("/categories/:id", wrap(async (req, res) => {
  const cat = await Category.findOneAndDelete({ _id: req.params.id, user: null });
  if (!cat) return res.status(404).json({ message: "Default category not found." });
  res.json({ message: "Default category deleted." });
}));

module.exports = router;
