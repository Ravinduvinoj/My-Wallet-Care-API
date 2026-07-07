const router = require("express").Router();
const multer = require("multer");
const Receipt = require("../models/Receipt");
const { protect } = require("../middleware/auth");
const { pick, wrap } = require("../utils/http");
const { readText } = require("../services/ocr");
const { parseReceipt } = require("../services/receiptParser");

router.use(protect);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (_req, file, cb) =>
    /^image\//.test(file.mimetype) ? cb(null, true) : cb(new Error("Only image files are allowed.")),
});

/** Receipt shape for the client — never includes the raw image bytes. */
function toPublic(r, { withRaw = false } = {}) {
  const o = r.toObject ? r.toObject() : r;
  return {
    _id: o._id,
    merchant: o.merchant,
    date: o.date,
    currency: o.currency,
    items: o.items || [],
    subtotal: o.subtotal,
    discount: o.discount,
    tax: o.tax,
    total: o.total,
    ...(withRaw ? { rawText: o.rawText || "" } : {}),
    image: o.image?.contentType
      ? { contentType: o.image.contentType, filename: o.image.filename, size: o.image.size }
      : null,
    createdAt: o.createdAt,
  };
}

const EDITABLE = ["merchant", "date", "currency", "items", "subtotal", "discount", "tax", "total"];

// POST /api/receipts/scan — upload an image, OCR + parse it, store both.
router.post("/scan", upload.single("image"), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Please attach an image." });

  let rawText = "";
  let parsed = { merchant: "", currency: "USD", items: [], subtotal: 0, discount: 0, tax: 0, total: 0 };
  try {
    rawText = await readText(req.file.buffer);
    parsed = parseReceipt(rawText);
  } catch (e) {
    // OCR failed — still save the image so the user can enter items manually.
    console.error("OCR error:", e.message);
  }

  const receipt = await Receipt.create({
    user: req.user.id,
    ...parsed,
    rawText,
    image: {
      data: req.file.buffer,
      contentType: req.file.mimetype,
      filename: req.file.originalname || "receipt",
      size: req.file.size,
    },
  });

  res.status(201).json({ receipt: toPublic(receipt, { withRaw: true }) });
}));

// GET /api/receipts — list (no image bytes, no raw text).
router.get("/", wrap(async (req, res) => {
  const receipts = await Receipt.find({ user: req.user.id }).sort({ createdAt: -1 });
  res.json({ items: receipts.map((r) => toPublic(r)) });
}));

// GET /api/receipts/:id — one receipt with its OCR text.
router.get("/:id", wrap(async (req, res) => {
  const r = await Receipt.findOne({ _id: req.params.id, user: req.user.id }).select("+rawText");
  if (!r) return res.status(404).json({ message: "Receipt not found." });
  res.json({ receipt: toPublic(r, { withRaw: true }) });
}));

// GET /api/receipts/:id/image — download the stored image.
router.get("/:id/image", wrap(async (req, res) => {
  const r = await Receipt.findOne({ _id: req.params.id, user: req.user.id }).select("+image.data");
  if (!r || !r.image?.data) return res.status(404).json({ message: "Image not found." });
  res.setHeader("Content-Type", r.image.contentType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${r.image.filename || "receipt"}"`);
  res.send(r.image.data);
}));

// PATCH /api/receipts/:id — correct parsed fields.
router.patch("/:id", wrap(async (req, res) => {
  const updates = pick(req.body, EDITABLE);
  const r = await Receipt.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    updates,
    { new: true, runValidators: true }
  );
  if (!r) return res.status(404).json({ message: "Receipt not found." });
  res.json({ receipt: toPublic(r) });
}));

// DELETE /api/receipts/:id
router.delete("/:id", wrap(async (req, res) => {
  const r = await Receipt.softDeleteOne({ _id: req.params.id, user: req.user.id });
  if (!r) return res.status(404).json({ message: "Receipt not found." });
  res.json({ message: "Receipt deleted." });
}));

module.exports = router;
