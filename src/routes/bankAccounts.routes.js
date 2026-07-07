const router = require("express").Router();
const crypto = require("crypto");
const BankAccount = require("../models/BankAccount");
const { protect } = require("../middleware/auth");
const { pick, wrap } = require("../utils/http");

const FIELDS = ["label", "bankName", "accountNumber", "branch", "accountHolderName", "accountType", "shareEnabled"];

// --- PUBLIC (no auth) — must be declared before `router.use(protect)` --------

// GET /api/bank-accounts/share/:shareId — details for the public pay page.
router.get("/share/:shareId", wrap(async (req, res) => {
  const acc = await BankAccount.findOne({ shareId: req.params.shareId, shareEnabled: true });
  if (!acc) return res.status(404).json({ message: "This payment link is not available." });
  res.json({ account: acc.toShared() });
}));

// --- authenticated -----------------------------------------------------------
router.use(protect);

router.get("/", wrap(async (req, res) => {
  const items = await BankAccount.find({ user: req.user.id }).sort({ createdAt: -1 });
  res.json({ items });
}));

router.post("/", wrap(async (req, res) => {
  const item = await BankAccount.create({ ...pick(req.body, FIELDS), user: req.user.id });
  res.status(201).json({ item });
}));

router.get("/:id", wrap(async (req, res) => {
  const item = await BankAccount.findOne({ _id: req.params.id, user: req.user.id });
  if (!item) return res.status(404).json({ message: "Bank account not found." });
  res.json({ item });
}));

router.patch("/:id", wrap(async (req, res) => {
  const item = await BankAccount.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    pick(req.body, FIELDS),
    { new: true, runValidators: true }
  );
  if (!item) return res.status(404).json({ message: "Bank account not found." });
  res.json({ item });
}));

// POST /api/bank-accounts/:id/regenerate-share — revoke the old link, mint a new one.
router.post("/:id/regenerate-share", wrap(async (req, res) => {
  const item = await BankAccount.findOne({ _id: req.params.id, user: req.user.id });
  if (!item) return res.status(404).json({ message: "Bank account not found." });
  item.shareId = crypto.randomBytes(6).toString("hex");
  await item.save();
  res.json({ item });
}));

router.delete("/:id", wrap(async (req, res) => {
  const item = await BankAccount.softDeleteOne({ _id: req.params.id, user: req.user.id });
  if (!item) return res.status(404).json({ message: "Bank account not found." });
  res.json({ message: "Bank account deleted." });
}));

module.exports = router;
