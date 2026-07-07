const router = require("express").Router();
const Bill = require("../models/Bill");
const { protect } = require("../middleware/auth");
const { pick, wrap } = require("../utils/http");
const { createTransaction } = require("../services/ledger");
const { advance } = require("../services/recurring");

router.use(protect);

const FIELDS = [
  "name", "category", "amount", "dueDate", "account",
  "status", "autoRecurring", "recurringCycle", "notes",
];

router.get("/", wrap(async (req, res) => {
  const filter = { user: req.user.id };
  if (req.query.status) filter.status = req.query.status;
  const items = await Bill.find(filter).sort({ dueDate: 1 });
  res.json({ items });
}));

router.post("/", wrap(async (req, res) => {
  const item = await Bill.create({ ...pick(req.body, FIELDS), user: req.user.id });
  res.status(201).json({ item });
}));

router.patch("/:id", wrap(async (req, res) => {
  const item = await Bill.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    pick(req.body, FIELDS),
    { new: true, runValidators: true }
  );
  if (!item) return res.status(404).json({ message: "Bill not found." });
  res.json({ item });
}));

// POST /api/bills/:id/pay — mark paid and record the expense.
router.post("/:id/pay", wrap(async (req, res) => {
  const bill = await Bill.findOne({ _id: req.params.id, user: req.user.id });
  if (!bill) return res.status(404).json({ message: "Bill not found." });
  if (bill.status === "paid") return res.status(400).json({ message: "Bill is already paid." });

  await createTransaction({
    user: req.user.id, type: "expense", amount: bill.amount,
    category: bill.category || "Bills", account: bill.account,
    date: new Date(), merchant: bill.name, source: "bill",
    notes: `Bill payment: ${bill.name}`,
  });

  if (bill.autoRecurring) {
    // Roll a recurring bill forward, staying unpaid for the next cycle.
    bill.dueDate = advance(bill.dueDate, bill.recurringCycle);
    bill.paidAt = new Date();
  } else {
    bill.status = "paid";
    bill.paidAt = new Date();
  }
  await bill.save();
  res.json({ item: bill });
}));

router.delete("/:id", wrap(async (req, res) => {
  const item = await Bill.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!item) return res.status(404).json({ message: "Bill not found." });
  res.json({ message: "Bill deleted." });
}));

module.exports = router;
