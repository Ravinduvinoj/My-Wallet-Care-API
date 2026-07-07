const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const Bill = require("../models/Bill");
const Subscription = require("../models/Subscription");
const Budget = require("../models/Budget");
const Transaction = require("../models/Transaction");
const { monthRange } = require("../utils/dates");

const oid = (id) => new mongoose.Types.ObjectId(id);

/** Create a notification, skipping duplicates via dedupeKey. */
async function notify(user, { type, title, message, dedupeKey }) {
  if (dedupeKey) {
    const existing = await Notification.findOne({ user, dedupeKey });
    if (existing) return existing;
  }
  return Notification.create({ user, type, title, message, dedupeKey });
}

const daysBetween = (a, b) => Math.ceil((a - b) / (1000 * 60 * 60 * 24));

/**
 * Scan a user's data and create notifications for upcoming/exceeded events.
 * Idempotent thanks to dedupeKey. Returns the number created this run.
 */
async function generateForUser(userId, now = new Date()) {
  let created = 0;
  const track = async (payload) => {
    const before = payload.dedupeKey
      ? await Notification.findOne({ user: userId, dedupeKey: payload.dedupeKey })
      : null;
    await notify(userId, payload);
    if (!before) created++;
  };

  // Bills due within 7 days.
  const bills = await Bill.find({ user: userId, status: "unpaid" });
  for (const bill of bills) {
    const days = daysBetween(bill.dueDate, now);
    if (days >= 0 && days <= 7) {
      await track({
        type: "bill_due",
        title: `Bill due in ${days} day${days === 1 ? "" : "s"}`,
        message: `${bill.name} (${bill.amount}) is due ${bill.dueDate.toDateString()}.`,
        dedupeKey: `bill-due-${bill.id}-${bill.dueDate.toISOString().slice(0, 10)}`,
      });
    }
  }

  // Subscription renewals within 7 days.
  const subs = await Subscription.find({ user: userId, status: "active" });
  for (const sub of subs) {
    const days = daysBetween(sub.nextRenewalDate, now);
    if (days >= 0 && days <= 7) {
      await track({
        type: "subscription_renewal",
        title: `${sub.name} renews in ${days} day${days === 1 ? "" : "s"}`,
        message: `${sub.name} (${sub.amount}) renews ${sub.nextRenewalDate.toDateString()}.`,
        dedupeKey: `sub-due-${sub.id}-${sub.nextRenewalDate.toISOString().slice(0, 10)}`,
      });
    }
  }

  // Budgets exceeded this month.
  const { start, end } = monthRange(now);
  const budgets = await Budget.find({ user: userId, period: "monthly" });
  for (const budget of budgets) {
    const match = { user: oid(userId), type: "expense", date: { $gte: start, $lte: end } };
    if (budget.category) match.category = budget.category;
    const [agg] = await Transaction.aggregate([
      { $match: match },
      { $group: { _id: null, spent: { $sum: "$amount" } } },
    ]);
    const spent = agg?.spent || 0;
    if (spent > budget.amount) {
      await track({
        type: "budget_exceeded",
        title: "Budget exceeded",
        message: `${budget.category || "Overall"} budget exceeded: spent ${spent.toFixed(
          2
        )} of ${budget.amount}.`,
        dedupeKey: `budget-${budget.id}-${start.toISOString().slice(0, 7)}`,
      });
    }
  }

  return created;
}

module.exports = { notify, generateForUser };
