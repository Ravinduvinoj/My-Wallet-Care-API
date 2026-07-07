// Advances subscriptions and recurring bills that have reached their due date:
// records an expense transaction, updates the account balance, and rolls the
// next due date forward. Called on server boot and on an interval (see server.js),
// and can be triggered manually via POST /api/system/run-recurring.
const Subscription = require("../models/Subscription");
const Bill = require("../models/Bill");
const { createTransaction } = require("./ledger");
const { notify } = require("./notifications");

const CYCLE_DAYS = { weekly: 7, monthly: 30, quarterly: 91, yearly: 365 };

/** Advance a date by one billing cycle (keeps day-of-month for month-based cycles). */
function advance(date, cycle) {
  const d = new Date(date);
  if (cycle === "weekly") d.setDate(d.getDate() + 7);
  else if (cycle === "monthly") d.setMonth(d.getMonth() + 1);
  else if (cycle === "quarterly") d.setMonth(d.getMonth() + 3);
  else if (cycle === "yearly") d.setFullYear(d.getFullYear() + 1);
  return d;
}

async function processSubscriptions(now) {
  const due = await Subscription.find({
    status: "active",
    autoRenew: true,
    nextRenewalDate: { $lte: now },
  });

  for (const sub of due) {
    // Catch up if several cycles were missed while the app was offline.
    let guard = 0;
    while (sub.nextRenewalDate <= now && guard++ < 60) {
      await createTransaction({
        user: sub.user,
        type: "expense",
        amount: sub.amount,
        category: sub.category || "Subscription",
        account: sub.account,
        date: new Date(sub.nextRenewalDate),
        merchant: sub.name,
        paymentMethod: sub.paymentMethod,
        source: "subscription",
        notes: `Auto renewal: ${sub.name}`,
      });
      sub.lastRenewedAt = new Date(sub.nextRenewalDate);
      sub.nextRenewalDate = advance(sub.nextRenewalDate, sub.billingCycle);
    }
    await sub.save();
    await notify(sub.user, {
      type: "subscription_renewal",
      title: "Subscription renewed",
      message: `${sub.name} renewed for ${sub.amount}.`,
      dedupeKey: `sub-renew-${sub.id}-${sub.lastRenewedAt?.toISOString()}`,
    });
  }
  return due.length;
}

async function processBills(now) {
  // Auto-recurring bills that are due create an expense and roll forward.
  const due = await Bill.find({
    autoRecurring: true,
    status: "unpaid",
    dueDate: { $lte: now },
  });

  for (const bill of due) {
    await createTransaction({
      user: bill.user,
      type: "expense",
      amount: bill.amount,
      category: bill.category || "Bills",
      account: bill.account,
      date: new Date(bill.dueDate),
      merchant: bill.name,
      source: "bill",
      notes: `Auto bill payment: ${bill.name}`,
    });
    bill.paidAt = new Date();
    // Roll the recurring bill to its next cycle and reset to unpaid.
    bill.dueDate = advance(bill.dueDate, bill.recurringCycle);
    bill.status = "unpaid";
    await bill.save();
  }
  return due.length;
}

async function runRecurring(now = new Date()) {
  const subs = await processSubscriptions(now);
  const bills = await processBills(now);
  return { subscriptions: subs, bills };
}

module.exports = { runRecurring, advance, CYCLE_DAYS };
