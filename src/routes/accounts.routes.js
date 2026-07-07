const router = require("express").Router();
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const { protect } = require("../middleware/auth");
const { pick, wrap } = require("../utils/http");
const { createTransaction } = require("../services/ledger");

router.use(protect);

const FIELDS = ["name", "type", "balance", "currency"];

router.get("/", wrap(async (req, res) => {
  const items = await Account.find({ user: req.user.id }).sort({ createdAt: 1 });
  res.json({ items });
}));

router.post("/", wrap(async (req, res) => {
  const item = await Account.create({ ...pick(req.body, FIELDS), user: req.user.id });
  res.status(201).json({ item });
}));

router.get("/:id", wrap(async (req, res) => {
  const item = await Account.findOne({ _id: req.params.id, user: req.user.id });
  if (!item) return res.status(404).json({ message: "Account not found." });
  res.json({ item });
}));

router.patch("/:id", wrap(async (req, res) => {
  const item = await Account.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    pick(req.body, FIELDS),
    { new: true, runValidators: true }
  );
  if (!item) return res.status(404).json({ message: "Account not found." });
  res.json({ item });
}));

router.delete("/:id", wrap(async (req, res) => {
  const item = await Account.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!item) return res.status(404).json({ message: "Account not found." });
  res.json({ message: "Account deleted." });
}));

// POST /api/accounts/transfer — move money between two accounts.
router.post("/transfer", wrap(async (req, res) => {
  const { fromId, toId, amount, notes } = req.body || {};
  const value = Number(amount);
  if (!fromId || !toId || fromId === toId) {
    return res.status(400).json({ message: "Choose two different accounts." });
  }
  if (!(value > 0)) return res.status(400).json({ message: "Amount must be positive." });

  const [from, to] = await Promise.all([
    Account.findOne({ _id: fromId, user: req.user.id }),
    Account.findOne({ _id: toId, user: req.user.id }),
  ]);
  if (!from || !to) return res.status(404).json({ message: "Account not found." });

  const date = new Date();
  await createTransaction({
    user: req.user.id, type: "expense", amount: value, category: "Transfer",
    account: from.id, date, merchant: `Transfer to ${to.name}`, source: "transfer", notes,
  });
  await createTransaction({
    user: req.user.id, type: "income", amount: value, category: "Transfer",
    account: to.id, date, merchant: `Transfer from ${from.name}`, source: "transfer", notes,
  });

  res.json({ message: "Transfer complete." });
}));

module.exports = router;
