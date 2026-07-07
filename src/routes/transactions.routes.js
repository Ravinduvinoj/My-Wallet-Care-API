const router = require("express").Router();
const Transaction = require("../models/Transaction");
const { protect } = require("../middleware/auth");
const { pick, toCSV, wrap } = require("../utils/http");
const { createTransaction, updateTransaction, deleteTransaction } = require("../services/ledger");
const { transactionsPdf, transactionsXlsx } = require("../services/exporters");
const { log } = require("../utils/audit");

router.use(protect);

const FIELDS = [
  "type", "amount", "category", "account", "date",
  "merchant", "paymentMethod", "notes", "receiptUrl",
];

const SORTABLE = { date: "date", amount: "amount", category: "category", createdAt: "createdAt" };

/** Build a Mongo filter from query params (shared by list + export). */
function buildFilter(req) {
  const filter = { user: req.user.id };
  const { type, category, account, from, to, min, max, q, source } = req.query;

  if (type) filter.type = type;
  if (source) filter.source = source;
  if (category) filter.category = category;
  if (account) filter.account = account;

  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }
  if (min || max) {
    filter.amount = {};
    if (min) filter.amount.$gte = Number(min);
    if (max) filter.amount.$lte = Number(max);
  }
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ merchant: rx }, { notes: rx }, { category: rx }];
  }
  return filter;
}

// GET /api/transactions — filter, search, sort, paginate.
router.get("/", wrap(async (req, res) => {
  const filter = buildFilter(req);
  const sortKey = SORTABLE[req.query.sort] || "date";
  const order = req.query.order === "asc" ? 1 : -1;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 25));

  const [items, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ [sortKey]: order, _id: order })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("account", "name type"),
    Transaction.countDocuments(filter),
  ]);

  res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
}));

// GET /api/transactions/export?format=csv|xlsx|pdf — current filter, no pagination.
router.get("/export", wrap(async (req, res) => {
  const items = await Transaction.find(buildFilter(req)).sort({ date: -1 }).populate("account", "name");
  const format = req.query.format || "csv";
  if (format === "xlsx") return transactionsXlsx(res, items);
  if (format === "pdf") return transactionsPdf(res, items);
  const csv = toCSV(items, [
    { label: "Date", value: (t) => t.date.toISOString().slice(0, 10) },
    { label: "Type", value: "type" },
    { label: "Category", value: "category" },
    { label: "Merchant", value: "merchant" },
    { label: "Amount", value: "amount" },
    { label: "Account", value: (t) => t.account?.name || "" },
    { label: "Payment Method", value: "paymentMethod" },
    { label: "Notes", value: "notes" },
  ]);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="transactions.csv"');
  res.send(csv);
}));

router.post("/", wrap(async (req, res) => {
  const data = pick(req.body, FIELDS);
  if (!["income", "expense"].includes(data.type)) {
    return res.status(400).json({ message: "Type must be 'income' or 'expense'." });
  }
  const item = await createTransaction({ ...data, user: req.user.id, source: "manual" });
  res.status(201).json({ item });
}));

router.get("/:id", wrap(async (req, res) => {
  const item = await Transaction.findOne({ _id: req.params.id, user: req.user.id }).populate("account", "name");
  if (!item) return res.status(404).json({ message: "Transaction not found." });
  res.json({ item });
}));

router.patch("/:id", wrap(async (req, res) => {
  const txn = await Transaction.findOne({ _id: req.params.id, user: req.user.id });
  if (!txn) return res.status(404).json({ message: "Transaction not found." });
  await updateTransaction(txn, pick(req.body, FIELDS));
  res.json({ item: txn });
}));

router.delete("/:id", wrap(async (req, res) => {
  const txn = await Transaction.findOne({ _id: req.params.id, user: req.user.id });
  if (!txn) return res.status(404).json({ message: "Transaction not found." });
  await deleteTransaction(txn);
  log(req.user.id, "delete_transaction", `${txn.type} ${txn.amount}`);
  res.json({ message: "Transaction deleted." });
}));

module.exports = router;
