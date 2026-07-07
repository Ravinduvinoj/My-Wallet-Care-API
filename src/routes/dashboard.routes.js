const router = require("express").Router();
const mongoose = require("mongoose");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");
const SavingsGoal = require("../models/SavingsGoal");
const Bill = require("../models/Bill");
const Subscription = require("../models/Subscription");
const { protect } = require("../middleware/auth");
const { wrap } = require("../utils/http");
const { monthRange, yearRange, lastMonths } = require("../utils/dates");
const { convert } = require("../services/rates");

router.use(protect);

const oid = (id) => new mongoose.Types.ObjectId(id);
const NOT_TRANSFER = { $ne: "transfer" };

/** Sum income/expense for a match, ignoring transfers. */
async function totals(userId, dateMatch) {
  const [agg] = await Transaction.aggregate([
    { $match: { user: oid(userId), source: NOT_TRANSFER, ...dateMatch } },
    {
      $group: {
        _id: null,
        income: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } },
        expense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] } },
      },
    },
  ]);
  return { income: agg?.income || 0, expense: agg?.expense || 0 };
}

// GET /api/dashboard
router.get("/", wrap(async (req, res) => {
  const uid = req.user.id;
  const now = new Date();
  const { start, end } = monthRange(now);
  const in30 = new Date(now.getTime() + 30 * 86400000);

  const [accounts, month, goals, budgets, recent, upcomingBills, upcomingSubs, byCategory, subs] =
    await Promise.all([
      Account.find({ user: uid }),
      totals(uid, { date: { $gte: start, $lte: end } }),
      SavingsGoal.find({ user: uid }),
      Budget.find({ user: uid, period: "monthly" }),
      Transaction.find({ user: uid }).sort({ date: -1 }).limit(6).populate("account", "name"),
      Bill.find({ user: uid, status: "unpaid", dueDate: { $gte: now, $lte: in30 } }).sort({ dueDate: 1 }).limit(5),
      Subscription.find({ user: uid, status: "active", nextRenewalDate: { $gte: now, $lte: in30 } }).sort({ nextRenewalDate: 1 }).limit(5),
      Transaction.aggregate([
        { $match: { user: oid(uid), type: "expense", source: NOT_TRANSFER, date: { $gte: start, $lte: end } } },
        { $group: { _id: "$category", total: { $sum: "$amount" } } },
        { $sort: { total: -1 } },
      ]),
      Subscription.find({ user: uid, status: "active" }),
    ]);

  // Monthly cash-flow series (last 6 months).
  const months = lastMonths(6, now);
  const flowAgg = await Transaction.aggregate([
    { $match: { user: oid(uid), source: NOT_TRANSFER, date: { $gte: months[0].start, $lte: months[months.length - 1].end } } },
    {
      $group: {
        _id: { y: { $year: "$date" }, m: { $month: "$date" } },
        income: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } },
        expense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] } },
      },
    },
  ]);
  const flowMap = new Map(flowAgg.map((f) => [`${f._id.y}-${String(f._id.m).padStart(2, "0")}`, f]));
  const cashFlow = months.map((mo) => ({
    label: mo.label,
    income: flowMap.get(mo.key)?.income || 0,
    expense: flowMap.get(mo.key)?.expense || 0,
  }));

  // Budgets with spend for the current month.
  const budgetProgress = await Promise.all(
    budgets.map(async (b) => {
      const m = { user: oid(uid), type: "expense", source: NOT_TRANSFER, date: { $gte: start, $lte: end } };
      if (b.category) m.category = b.category;
      const [a] = await Transaction.aggregate([{ $match: m }, { $group: { _id: null, spent: { $sum: "$amount" } } }]);
      const spent = a?.spent || 0;
      return { id: b.id, name: b.name, category: b.category, amount: b.amount, spent, percent: b.amount ? Math.round((spent / b.amount) * 100) : 0 };
    })
  );

  const perMonthCost = (s) =>
    ({ weekly: (s.amount * 52) / 12, monthly: s.amount, quarterly: s.amount / 3, yearly: s.amount / 12 }[s.billingCycle] || 0);
  // Convert each subscription's monthly cost from its own currency to the user's base.
  const baseCurrency = req.user.settings?.currency || "USD";
  let subMonthly = 0;
  for (const s of subs) {
    const m = perMonthCost(s);
    try {
      subMonthly += await convert(m, s.currency || "USD", baseCurrency);
    } catch {
      subMonthly += m;
    }
  }

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const totalSavings = goals.reduce((s, g) => s + g.currentAmount, 0);

  // A couple of simple text insights.
  const insights = [];
  if (month.expense > month.income) insights.push("You're spending more than you earn this month.");
  else if (month.income > 0) insights.push(`You've saved ${(((month.income - month.expense) / month.income) * 100).toFixed(0)}% of your income this month.`);
  if (byCategory[0]) insights.push(`Top spending category: ${byCategory[0]._id} (${byCategory[0].total.toFixed(2)}).`);

  res.json({
    totalBalance,
    totalIncome: month.income,
    totalExpenses: month.expense,
    totalSavings,
    monthlyCashFlow: month.income - month.expense,
    cashFlow,
    recentTransactions: recent,
    upcomingBills,
    upcomingRenewals: upcomingSubs,
    budgetProgress,
    savingsProgress: goals.map((g) => ({
      id: g.id, name: g.name, currentAmount: g.currentAmount, targetAmount: g.targetAmount,
      percent: g.targetAmount ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0,
    })),
    expenseByCategory: byCategory.map((c) => ({ category: c._id, total: c.total })),
    subscriptionCost: { monthly: subMonthly, yearly: subMonthly * 12, count: subs.length },
    insights,
    accounts,
  });
}));

module.exports = router;
