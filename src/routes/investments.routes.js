const router = require("express").Router();
const Investment = require("../models/Investment");
const { protect } = require("../middleware/auth");
const { pick, wrap } = require("../utils/http");

router.use(protect);

const FIELDS = ["name", "type", "quantity", "buyPrice", "currentPrice", "notes"];

router.get("/", wrap(async (req, res) => {
  const items = await Investment.find({ user: req.user.id }).sort({ createdAt: -1 });
  const totals = items.reduce(
    (acc, i) => {
      acc.invested += i.invested;
      acc.currentValue += i.currentValue;
      return acc;
    },
    { invested: 0, currentValue: 0 }
  );
  totals.profitLoss = totals.currentValue - totals.invested;
  res.json({ items, totals });
}));

router.post("/", wrap(async (req, res) => {
  const item = await Investment.create({ ...pick(req.body, FIELDS), user: req.user.id });
  res.status(201).json({ item });
}));

router.patch("/:id", wrap(async (req, res) => {
  const item = await Investment.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    pick(req.body, FIELDS),
    { new: true, runValidators: true }
  );
  if (!item) return res.status(404).json({ message: "Investment not found." });
  res.json({ item });
}));

router.delete("/:id", wrap(async (req, res) => {
  const item = await Investment.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!item) return res.status(404).json({ message: "Investment not found." });
  res.json({ message: "Investment deleted." });
}));

module.exports = router;
