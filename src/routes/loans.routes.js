const router = require("express").Router();
const Loan = require("../models/Loan");
const { protect } = require("../middleware/auth");
const { pick, wrap } = require("../utils/http");
const { createTransaction } = require("../services/ledger");

router.use(protect);

const FIELDS = ["name", "principal", "interestRate", "monthlyInstallment", "remainingBalance", "nextDueDate", "status"];

router.get("/", wrap(async (req, res) => {
  const items = await Loan.find({ user: req.user.id }).sort({ createdAt: -1 });
  res.json({ items });
}));

router.post("/", wrap(async (req, res) => {
  const data = pick(req.body, FIELDS);
  // Default remaining balance to the principal on creation.
  if (data.remainingBalance === undefined) data.remainingBalance = data.principal;
  const item = await Loan.create({ ...data, user: req.user.id });
  res.status(201).json({ item });
}));

router.patch("/:id", wrap(async (req, res) => {
  const item = await Loan.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    pick(req.body, FIELDS),
    { new: true, runValidators: true }
  );
  if (!item) return res.status(404).json({ message: "Loan not found." });
  res.json({ item });
}));

// POST /api/loans/:id/pay — record an installment (expense + reduce balance).
router.post("/:id/pay", wrap(async (req, res) => {
  const loan = await Loan.findOne({ _id: req.params.id, user: req.user.id });
  if (!loan) return res.status(404).json({ message: "Loan not found." });

  const amount = Number(req.body?.amount) || loan.monthlyInstallment;
  if (!(amount > 0)) return res.status(400).json({ message: "Amount must be positive." });

  await createTransaction({
    user: req.user.id, type: "expense", amount, category: "Loan",
    account: req.body?.account || null, date: new Date(),
    merchant: loan.name, source: "loan", notes: `Loan payment: ${loan.name}`,
  });

  loan.remainingBalance = Math.max(0, loan.remainingBalance - amount);
  loan.payments.push({ amount, note: req.body?.note || "" });
  if (loan.remainingBalance === 0) loan.status = "closed";
  await loan.save();
  res.json({ item: loan });
}));

router.delete("/:id", wrap(async (req, res) => {
  const item = await Loan.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!item) return res.status(404).json({ message: "Loan not found." });
  res.json({ message: "Loan deleted." });
}));

module.exports = router;
