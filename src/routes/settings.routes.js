const router = require("express").Router();
const { protect } = require("../middleware/auth");
const { wrap } = require("../utils/http");

router.use(protect);

// GET /api/settings
router.get("/", wrap(async (req, res) => {
  res.json({ settings: req.user.settings });
}));

// PATCH /api/settings — deep-merge the provided keys.
router.patch("/", wrap(async (req, res) => {
  const { theme, currency, language, dateFormat, notifications } = req.body || {};
  const s = req.user.settings;
  if (theme !== undefined) s.theme = theme;
  if (currency !== undefined) s.currency = currency;
  if (language !== undefined) s.language = language;
  if (dateFormat !== undefined) s.dateFormat = dateFormat;
  if (notifications && typeof notifications === "object") {
    Object.assign(s.notifications, notifications);
  }
  await req.user.save();
  res.json({ settings: req.user.settings });
}));

module.exports = router;
