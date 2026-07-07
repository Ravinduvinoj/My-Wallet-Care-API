const router = require("express").Router();
const SavingsGoal = require("../models/SavingsGoal");
const { protect } = require("../middleware/auth");
const { pick, wrap } = require("../utils/http");
const { notify } = require("../services/notifications");

router.use(protect);

const FIELDS = ["name", "type", "targetAmount", "currentAmount", "deadline"];

const withProgress = (g) => ({
  ...g.toObject(),
  percent: g.targetAmount ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0,
  remaining: Math.max(0, g.targetAmount - g.currentAmount),
});

router.get("/", wrap(async (req, res) => {
  const goals = await SavingsGoal.find({ user: req.user.id }).sort({ createdAt: -1 });
  res.json({ items: goals.map(withProgress) });
}));

router.post("/", wrap(async (req, res) => {
  const goal = await SavingsGoal.create({ ...pick(req.body, FIELDS), user: req.user.id });
  res.status(201).json({ item: withProgress(goal) });
}));

router.patch("/:id", wrap(async (req, res) => {
  const goal = await SavingsGoal.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    pick(req.body, FIELDS),
    { new: true, runValidators: true }
  );
  if (!goal) return res.status(404).json({ message: "Goal not found." });
  res.json({ item: withProgress(goal) });
}));

// POST /api/savings/:id/contribute — add money toward a goal.
router.post("/:id/contribute", wrap(async (req, res) => {
  const amount = Number(req.body?.amount);
  if (!(amount > 0)) return res.status(400).json({ message: "Amount must be positive." });

  const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.user.id });
  if (!goal) return res.status(404).json({ message: "Goal not found." });

  goal.currentAmount += amount;
  goal.contributions.push({ amount, note: req.body?.note || "" });

  const justCompleted = !goal.completed && goal.currentAmount >= goal.targetAmount;
  if (justCompleted) goal.completed = true;
  await goal.save();

  if (justCompleted) {
    await notify(req.user.id, {
      type: "savings_goal",
      title: "Goal completed 🎉",
      message: `You reached your "${goal.name}" goal!`,
      dedupeKey: `goal-done-${goal.id}`,
    });
  }
  res.json({ item: withProgress(goal) });
}));

router.delete("/:id", wrap(async (req, res) => {
  const goal = await SavingsGoal.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!goal) return res.status(404).json({ message: "Goal not found." });
  res.json({ message: "Goal deleted." });
}));

module.exports = router;
