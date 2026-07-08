const router = require("express").Router();
const Subscription = require("../models/Subscription");
const { protect } = require("../middleware/auth");
const { pick, wrap } = require("../utils/http");
const { addMonths } = require("../utils/dates");
const { chargeSubscriptionOnce, baseCurrencyFor } = require("../services/recurring");

router.use(protect);

const FIELDS = [
  "name", "amount", "currency", "billingCycle", "category", "account",
  "paymentMethod", "notes", "nextRenewalDate", "autoRenew", "status",
];

router.get("/", wrap(async (req, res) => {
  const items = await Subscription.find({ user: req.user.id }).sort({ nextRenewalDate: 1 });
  res.json({ items });
}));

router.post("/", wrap(async (req, res) => {
  const data = pick(req.body, FIELDS);
  // Default the next renewal to one month from today if none was given.
  if (!data.nextRenewalDate) data.nextRenewalDate = addMonths(new Date(), 1);
  const item = await Subscription.create({ ...data, user: req.user.id });
  res.status(201).json({ item });
}));

router.patch("/:id", wrap(async (req, res) => {
  const item = await Subscription.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    pick(req.body, FIELDS),
    { new: true, runValidators: true }
  );
  if (!item) return res.status(404).json({ message: "Subscription not found." });
  res.json({ item });
}));

// Convenience toggles used by the UI switches.
router.post("/:id/toggle-auto-renew", wrap(async (req, res) => {
  const sub = await Subscription.findOne({ _id: req.params.id, user: req.user.id });
  if (!sub) return res.status(404).json({ message: "Subscription not found." });
  sub.autoRenew = !sub.autoRenew;
  await sub.save();
  res.json({ item: sub });
}));

router.post("/:id/status", wrap(async (req, res) => {
  const { status } = req.body || {};
  if (!["active", "cancelled"].includes(status)) {
    return res.status(400).json({ message: "Status must be 'active' or 'cancelled'." });
  }
  const sub = await Subscription.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    { status },
    { new: true }
  );
  if (!sub) return res.status(404).json({ message: "Subscription not found." });
  res.json({ item: sub });
}));

// POST /api/subscriptions/:id/pay — manually mark this cycle as paid (e.g. the
// bank deducted before the renewal date). Records the expense, converts to the
// user's base currency, logs the payment, and advances the renewal date.
router.post("/:id/pay", wrap(async (req, res) => {
  const sub = await Subscription.findOne({ _id: req.params.id, user: req.user.id });
  if (!sub) return res.status(404).json({ message: "Subscription not found." });
  if (sub.status !== "active") return res.status(400).json({ message: "Subscription is not active." });

  const base = await baseCurrencyFor(req.user.id);
  await chargeSubscriptionOnce(sub, { base, chargeDate: new Date(), manual: true });
  await sub.save();
  res.json({ item: sub });
}));

router.delete("/:id", wrap(async (req, res) => {
  const item = await Subscription.softDeleteOne({ _id: req.params.id, user: req.user.id });
  if (!item) return res.status(404).json({ message: "Subscription not found." });
  res.json({ message: "Subscription deleted." });
}));

module.exports = router;
