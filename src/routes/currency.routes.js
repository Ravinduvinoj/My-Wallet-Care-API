const router = require("express").Router();
const { protect } = require("../middleware/auth");
const { wrap } = require("../utils/http");
const { getRates, convert } = require("../services/rates");

router.use(protect);

// GET /api/currency/rates — full USD-based rate table (+ whether live or fallback).
router.get("/rates", wrap(async (_req, res) => {
  const { rates, live, fetchedAt } = await getRates();
  res.json({ base: "USD", live, fetchedAt, rates });
}));

// GET /api/currency/convert?amount=&from=&to=
router.get("/convert", wrap(async (req, res) => {
  const { amount, from, to } = req.query;
  if (!amount || !from || !to) {
    return res.status(400).json({ message: "amount, from, and to are required." });
  }
  try {
    const result = await convert(Number(amount), from, to);
    res.json({ amount: Number(amount), from, to, result });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}));

module.exports = router;
