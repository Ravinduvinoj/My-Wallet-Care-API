const router = require("express").Router();
const Subscription = require("../models/Subscription");
const { protect } = require("../middleware/auth");
const { pick, wrap } = require("../utils/http");

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
  const item = await Subscription.create({ ...pick(req.body, FIELDS), user: req.user.id });
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

router.delete("/:id", wrap(async (req, res) => {
  const item = await Subscription.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!item) return res.status(404).json({ message: "Subscription not found." });
  res.json({ message: "Subscription deleted." });
}));

module.exports = router;
