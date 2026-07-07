const router = require("express").Router();
const Category = require("../models/Category");
const { protect } = require("../middleware/auth");
const { pick, wrap } = require("../utils/http");

router.use(protect);

const FIELDS = ["name", "type", "icon", "color"];

// GET /api/categories?type=income — returns global defaults + the user's own.
router.get("/", wrap(async (req, res) => {
  const filter = { $or: [{ user: null }, { user: req.user.id }] };
  if (req.query.type) filter.type = req.query.type;
  const items = await Category.find(filter).sort({ name: 1 });
  res.json({ items });
}));

router.post("/", wrap(async (req, res) => {
  const item = await Category.create({ ...pick(req.body, FIELDS), user: req.user.id });
  res.status(201).json({ item });
}));

router.patch("/:id", wrap(async (req, res) => {
  const item = await Category.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id }, // cannot edit global defaults
    pick(req.body, FIELDS),
    { new: true, runValidators: true }
  );
  if (!item) return res.status(404).json({ message: "Category not found (or it's a default)." });
  res.json({ item });
}));

router.delete("/:id", wrap(async (req, res) => {
  const item = await Category.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!item) return res.status(404).json({ message: "Category not found (or it's a default)." });
  res.json({ message: "Category deleted." });
}));

module.exports = router;
