const router = require("express").Router();
const Notification = require("../models/Notification");
const { protect } = require("../middleware/auth");
const { wrap } = require("../utils/http");
const { generateForUser } = require("../services/notifications");

router.use(protect);

// GET /api/notifications — refreshes derived alerts, then returns the list.
router.get("/", wrap(async (req, res) => {
  await generateForUser(req.user.id);
  const items = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(100);
  const unread = await Notification.countDocuments({ user: req.user.id, read: false });
  res.json({ items, unread });
}));

router.post("/:id/read", wrap(async (req, res) => {
  const item = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    { read: true },
    { new: true }
  );
  if (!item) return res.status(404).json({ message: "Notification not found." });
  res.json({ item });
}));

router.post("/read-all", wrap(async (req, res) => {
  await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
  res.json({ message: "All marked read." });
}));

router.delete("/:id", wrap(async (req, res) => {
  await Notification.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  res.json({ message: "Deleted." });
}));

module.exports = router;
