const router = require("express").Router();
const { protect } = require("../middleware/auth");
const { wrap } = require("../utils/http");
const { runRecurring } = require("../services/recurring");
const { generateForUser } = require("../services/notifications");

router.use(protect);

// POST /api/system/run-recurring — process due subscriptions/bills now.
router.post("/run-recurring", wrap(async (_req, res) => {
  const result = await runRecurring(new Date());
  res.json({ message: "Recurring processed.", ...result });
}));

// POST /api/system/generate-notifications — refresh derived alerts for the user.
router.post("/generate-notifications", wrap(async (req, res) => {
  const created = await generateForUser(req.user.id);
  res.json({ message: "Notifications generated.", created });
}));

module.exports = router;
