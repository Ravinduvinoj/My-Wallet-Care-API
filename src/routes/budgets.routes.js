const router = require("express").Router();
const mongoose = require("mongoose");
const Budget = require("../models/Budget");
const Transaction = require("../models/Transaction");
const { protect } = require("../middleware/auth");
const { pick, wrap } = require("../utils/http");
const { monthRange, yearRange } = require("../utils/dates");

router.use(protect);

const FIELDS = ["name", "category", "amount", "period", "startDate"];
const oid = (id) => new mongoose.Types.ObjectId(id);

/** Spend for a budget within its current period. */
async function spentFor(userId, budget, now = new Date()) {
  const { start, end } = budget.period === "yearly" ? yearRange(now) : monthRange(now);
  const match = {
    user: oid(userId),
    type: "expense",
    source: { $ne: "transfer" },
    date: { $gte: start, $lte: end },
  };
  if (budget.category) match.category = budget.category;
  const [agg] = await Transaction.aggregate([
    { $match: match },
    { $group: { _id: null, spent: { $sum: "$amount" } } },
  ]);
  return agg?.spent || 0;
}

// GET /api/budgets — each budget with spent / remaining / exceeded.
router.get("/", wrap(async (req, res) => {
  const budgets = await Budget.find({ user: req.user.id }).sort({ createdAt: -1 });
  const items = await Promise.all(
    budgets.map(async (b) => {
      const spent = await spentFor(req.user.id, b);
      return {
        ...b.toObject(),
        spent,
        remaining: b.amount - spent,
        percent: b.amount ? Math.round((spent / b.amount) * 100) : 0,
        exceeded: spent > b.amount,
      };
    })
  );
  res.json({ items });
}));

router.post("/", wrap(async (req, res) => {
  const item = await Budget.create({ ...pick(req.body, FIELDS), user: req.user.id });
  res.status(201).json({ item });
}));

router.patch("/:id", wrap(async (req, res) => {
  const item = await Budget.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    pick(req.body, FIELDS),
    { new: true, runValidators: true }
  );
  if (!item) return res.status(404).json({ message: "Budget not found." });
  res.json({ item });
}));

router.delete("/:id", wrap(async (req, res) => {
  const item = await Budget.softDeleteOne({ _id: req.params.id, user: req.user.id });
  if (!item) return res.status(404).json({ message: "Budget not found." });
  res.json({ message: "Budget deleted." });
}));

module.exports = router;
