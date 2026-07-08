const router = require("express").Router();
const crypto = require("crypto");
const ShareBundle = require("../models/ShareBundle");
const BankAccount = require("../models/BankAccount");
const { protect } = require("../middleware/auth");
const { pick, wrap } = require("../utils/http");

/** Keep only account ids that belong to the user (and still exist). */
async function ownedAccountIds(userId, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const owned = await BankAccount.find({ _id: { $in: ids }, user: userId }).select("_id");
  return owned.map((a) => a._id);
}

// --- PUBLIC (no auth) — must be before `router.use(protect)` -----------------

// GET /api/share-bundles/share/:shareId — all accounts in the bundle.
router.get("/share/:shareId", wrap(async (req, res) => {
  const bundle = await ShareBundle.findOne({ shareId: req.params.shareId, shareEnabled: true }).populate("accounts");
  if (!bundle) return res.status(404).json({ message: "This share link is not available." });
  const accounts = (bundle.accounts || []).filter(Boolean).map((a) => a.toShared());
  res.json({ label: bundle.label, note: bundle.note, accounts });
}));

// --- authenticated -----------------------------------------------------------
router.use(protect);

router.get("/", wrap(async (req, res) => {
  const items = await ShareBundle.find({ user: req.user.id })
    .sort({ createdAt: -1 })
    .populate("accounts", "label bankName accountHolderName kind");
  res.json({ items });
}));

router.post("/", wrap(async (req, res) => {
  const { label, note } = pick(req.body, ["label", "note"]);
  const accounts = await ownedAccountIds(req.user.id, req.body.accounts);
  if (accounts.length === 0) {
    return res.status(400).json({ message: "Select at least one account to share." });
  }
  const created = await ShareBundle.create({ label, note, accounts, user: req.user.id });
  const item = await created.populate("accounts", "label bankName accountHolderName kind");
  res.status(201).json({ item });
}));

router.patch("/:id", wrap(async (req, res) => {
  const updates = pick(req.body, ["label", "note", "shareEnabled"]);
  if (req.body.accounts !== undefined) {
    updates.accounts = await ownedAccountIds(req.user.id, req.body.accounts);
  }
  const item = await ShareBundle.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    updates,
    { new: true, runValidators: true }
  ).populate("accounts", "label bankName accountHolderName kind");
  if (!item) return res.status(404).json({ message: "Share link not found." });
  res.json({ item });
}));

router.post("/:id/regenerate-share", wrap(async (req, res) => {
  const item = await ShareBundle.findOne({ _id: req.params.id, user: req.user.id });
  if (!item) return res.status(404).json({ message: "Share link not found." });
  item.shareId = crypto.randomBytes(6).toString("hex");
  await item.save();
  await item.populate("accounts", "label bankName accountHolderName kind");
  res.json({ item });
}));

router.delete("/:id", wrap(async (req, res) => {
  const item = await ShareBundle.softDeleteOne({ _id: req.params.id, user: req.user.id });
  if (!item) return res.status(404).json({ message: "Share link not found." });
  res.json({ message: "Share link deleted." });
}));

module.exports = router;
