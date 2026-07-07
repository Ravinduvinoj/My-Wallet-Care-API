const router = require("express").Router();
const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const Account = require("../models/Account");
const Investment = require("../models/Investment");
const Loan = require("../models/Loan");
const CreditCard = require("../models/CreditCard");
const { protect } = require("../middleware/auth");
const { wrap, toCSV } = require("../utils/http");
const { rangeForPeriod } = require("../utils/dates");
const { reportPdf, reportXlsx } = require("../services/exporters");

router.use(protect);

const oid = (id) => new mongoose.Types.ObjectId(id);
const NOT_TRANSFER = { $ne: "transfer" };

async function report(userId, { period, from, to }) {
  const { start, end } = rangeForPeriod(period, from, to);
  const match = { user: oid(userId), source: NOT_TRANSFER, date: { $gte: start, $lte: end } };

  const [byCat, totalsAgg] = await Promise.all([
    Transaction.aggregate([
      { $match: match },
      { $group: { _id: { type: "$type", category: "$category" }, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          income: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } },
          expense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] } },
        },
      },
    ]),
  ]);

  const income = totalsAgg[0]?.income || 0;
  const expense = totalsAgg[0]?.expense || 0;
  return {
    range: { start, end },
    income,
    expense,
    net: income - expense,
    incomeByCategory: byCat.filter((c) => c._id.type === "income").map((c) => ({ category: c._id.category, total: c.total, count: c.count })),
    expenseByCategory: byCat.filter((c) => c._id.type === "expense").map((c) => ({ category: c._id.category, total: c.total, count: c.count })),
  };
}

// GET /api/reports?period=monthly|weekly|daily|yearly&from=&to=
router.get("/", wrap(async (req, res) => {
  const data = await report(req.user.id, req.query);

  // Net worth = accounts + investments - loans - credit-card balances.
  const [accounts, investments, loans, cards] = await Promise.all([
    Account.find({ user: req.user.id }),
    Investment.find({ user: req.user.id }),
    Loan.find({ user: req.user.id, status: "active" }),
    CreditCard.find({ user: req.user.id }),
  ]);
  const assets =
    accounts.reduce((s, a) => s + a.balance, 0) +
    investments.reduce((s, i) => s + i.currentValue, 0);
  const liabilities =
    loans.reduce((s, l) => s + l.remainingBalance, 0) +
    cards.reduce((s, c) => s + c.currentBalance, 0);

  res.json({ ...data, netWorth: { assets, liabilities, net: assets - liabilities } });
}));

// GET /api/reports/export?format=csv|xlsx|pdf — category totals for the period.
router.get("/export", wrap(async (req, res) => {
  const data = await report(req.user.id, req.query);
  const format = req.query.format || "csv";
  if (format === "xlsx") return reportXlsx(res, data);
  if (format === "pdf") return reportPdf(res, data, String(req.query.period || "monthly"));
  const rows = [
    ...data.incomeByCategory.map((c) => ({ type: "income", ...c })),
    ...data.expenseByCategory.map((c) => ({ type: "expense", ...c })),
  ];
  const csv = toCSV(rows, [
    { label: "Type", value: "type" },
    { label: "Category", value: "category" },
    { label: "Total", value: "total" },
    { label: "Count", value: "count" },
  ]);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="report.csv"');
  res.send(csv);
}));

module.exports = router;
