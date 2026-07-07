const router = require("express").Router();
const CreditCard = require("../models/CreditCard");
const { protect } = require("../middleware/auth");
const { pick, wrap } = require("../utils/http");
const { createTransaction } = require("../services/ledger");

router.use(protect);

const FIELDS = ["name", "creditLimit", "currentBalance", "dueDate", "minimumPayment"];

router.get("/", wrap(async (req, res) => {
  const items = await CreditCard.find({ user: req.user.id }).sort({ createdAt: -1 });
  res.json({ items });
}));

router.post("/", wrap(async (req, res) => {
  const item = await CreditCard.create({ ...pick(req.body, FIELDS), user: req.user.id });
  res.status(201).json({ item });
}));

router.patch("/:id", wrap(async (req, res) => {
  const item = await CreditCard.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    pick(req.body, FIELDS),
    { new: true, runValidators: true }
  );
  if (!item) return res.status(404).json({ message: "Card not found." });
  res.json({ item });
}));

// POST /api/credit-cards/:id/charge — add a charge to the card balance.
router.post("/:id/charge", wrap(async (req, res) => {
  const amount = Number(req.body?.amount);
  if (!(amount > 0)) return res.status(400).json({ message: "Amount must be positive." });
  const card = await CreditCard.findOne({ _id: req.params.id, user: req.user.id });
  if (!card) return res.status(404).json({ message: "Card not found." });

  card.currentBalance += amount;
  card.statements.push({ amount, type: "charge", note: req.body?.note || "" });
  await card.save();
  res.json({ item: card });
}));

// POST /api/credit-cards/:id/pay — pay down the card (expense + reduce balance).
router.post("/:id/pay", wrap(async (req, res) => {
  const amount = Number(req.body?.amount);
  if (!(amount > 0)) return res.status(400).json({ message: "Amount must be positive." });
  const card = await CreditCard.findOne({ _id: req.params.id, user: req.user.id });
  if (!card) return res.status(404).json({ message: "Card not found." });

  await createTransaction({
    user: req.user.id, type: "expense", amount, category: "Credit Card",
    account: req.body?.account || null, date: new Date(),
    merchant: card.name, source: "credit_card", notes: `Card payment: ${card.name}`,
  });

  card.currentBalance = Math.max(0, card.currentBalance - amount);
  card.statements.push({ amount, type: "payment", note: req.body?.note || "" });
  await card.save();
  res.json({ item: card });
}));

router.delete("/:id", wrap(async (req, res) => {
  const item = await CreditCard.softDeleteOne({ _id: req.params.id, user: req.user.id });
  if (!item) return res.status(404).json({ message: "Card not found." });
  res.json({ message: "Card deleted." });
}));

module.exports = router;
