// Advances subscriptions and recurring bills that have reached their due date:
// records an expense transaction, updates the account balance, and rolls the
// next due date forward. Called on server boot and on an interval (see server.js),
// and can be triggered manually via POST /api/system/run-recurring.
const Subscription = require("../models/Subscription");
const Bill = require("../models/Bill");
const User = require("../models/User");
const { createTransaction } = require("./ledger");
const { notify } = require("./notifications");
const { convert } = require("./rates");

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

async function baseCurrencyFor(userId, cache) {
  if (cache && cache.has(String(userId))) return cache.get(String(userId));
  const u = await User.findById(userId).select("settings");
  const base = u?.settings?.currency || "USD";
  if (cache) cache.set(String(userId), base);
  return base;
}

/**
 * Record one paid cycle for a subscription: converts the amount to the user's
 * base currency, creates the expense (updating the account balance), logs the
 * payment, and rolls the renewal date forward one cycle. Does NOT save — the
 * caller saves after (allowing catch-up loops). Reused by the auto engine and
 * the manual "mark paid" endpoint.
 */
async function chargeSubscriptionOnce(sub, { base, chargeDate, manual = false }) {
  let charge = sub.amount;
  try {
    charge = await convert(sub.amount, sub.currency || "USD", base);
  } catch {
    /* keep raw amount if conversion fails */
  }
  const forDate = new Date(sub.nextRenewalDate);
  await createTransaction({
    user: sub.user,
    type: "expense",
    amount: charge,
    category: sub.category || "Subscription",
    account: sub.account,
    date: chargeDate,
    merchant: sub.name,
    paymentMethod: sub.paymentMethod,
    source: "subscription",
    notes: `${manual ? "Payment" : "Auto renewal"}: ${sub.name}`,
  });
  sub.payments.push({ amount: sub.amount, currency: sub.currency || "USD", baseAmount: charge, date: chargeDate, forDate, manual });
  sub.lastRenewedAt = chargeDate;
  sub.nextRenewalDate = advance(sub.nextRenewalDate, sub.billingCycle);
  return charge;
}

async function processSubscriptions(now) {
  const due = await Subscription.find({
    status: "active",
    autoRenew: true,
    nextRenewalDate: { $lte: now },
  });

  const currencyCache = new Map(); // userId -> base currency

  for (const sub of due) {
    const base = await baseCurrencyFor(sub.user, currencyCache);
    // Catch up if several cycles were missed while the app was offline.
    let guard = 0;
    while (sub.nextRenewalDate <= now && guard++ < 60) {
      await chargeSubscriptionOnce(sub, { base, chargeDate: new Date(sub.nextRenewalDate) });
    }
    await sub.save();
    await notify(sub.user, {
      type: "subscription_renewal",
      title: "Subscription renewed",
      message: `${sub.name} renewed.`,
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

module.exports = { runRecurring, advance, CYCLE_DAYS, chargeSubscriptionOnce, baseCurrencyFor };
