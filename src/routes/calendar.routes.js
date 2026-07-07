const router = require("express").Router();
const Bill = require("../models/Bill");
const Subscription = require("../models/Subscription");
const Loan = require("../models/Loan");
const SavingsGoal = require("../models/SavingsGoal");
const { protect } = require("../middleware/auth");
const { wrap } = require("../utils/http");

router.use(protect);

// GET /api/calendar?from=&to= — dated events for the calendar view.
router.get("/", wrap(async (req, res) => {
  const from = req.query.from ? new Date(req.query.from) : new Date();
  const to = req.query.to
    ? new Date(req.query.to)
    : new Date(from.getFullYear(), from.getMonth() + 2, 0);

  const uid = req.user.id;
  const [bills, subs, loans, goals] = await Promise.all([
    Bill.find({ user: uid, dueDate: { $gte: from, $lte: to } }),
    Subscription.find({ user: uid, status: "active", nextRenewalDate: { $gte: from, $lte: to } }),
    Loan.find({ user: uid, status: "active", nextDueDate: { $gte: from, $lte: to } }),
    SavingsGoal.find({ user: uid, completed: false, deadline: { $gte: from, $lte: to } }),
  ]);

  const events = [
    ...bills.map((b) => ({ date: b.dueDate, type: "bill", title: b.name, amount: b.amount, status: b.status })),
    ...subs.map((s) => ({ date: s.nextRenewalDate, type: "subscription", title: s.name, amount: s.amount })),
    ...loans.map((l) => ({ date: l.nextDueDate, type: "loan", title: l.name, amount: l.monthlyInstallment })),
    ...goals.map((g) => ({ date: g.deadline, type: "goal", title: g.name, amount: g.targetAmount })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  res.json({ events });
}));

module.exports = router;
