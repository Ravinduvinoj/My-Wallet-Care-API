const express = require("express");
const cors = require("cors");

const app = express();

// CORS origin restriction disabled — allow all origins.
// (Every data route still requires a JWT, so this doesn't expose data; it only
// lets any browser origin call the API.) Re-enable by uncommenting the block
// below and removing this line.
app.use(cors());

// --- Restricted CORS (commented out; uncomment to re-enable) ---------------
// // Exact origins allowed to call the API (comma-separated in CLIENT_ORIGINS).
// // Trailing slashes are stripped so "https://site.com/" and "https://site.com"
// // both work — a browser's Origin header never includes a trailing slash/path.
// const allowedOrigins = (process.env.CLIENT_ORIGINS || "http://localhost:3000")
//   .split(",")
//   .map((o) => o.trim().replace(/\/+$/, ""))
//   .filter(Boolean);
//
// // This project's Vercel deployments. Preview URLs get a fresh hash on every
// // deploy (e.g. my-wallet-care-<hash>-...vercel.app), so match by pattern
// // instead of listing each one — otherwise CORS breaks after every redeploy.
// const vercelPattern = /^https:\/\/my-wallet-care[a-z0-9-]*\.vercel\.app$/i;
//
// function isAllowedOrigin(origin) {
//   if (!origin) return true; // non-browser clients (curl, mobile, SSR) send no Origin
//   const normalized = origin.replace(/\/+$/, "");
//   return allowedOrigins.includes(normalized) || vercelPattern.test(normalized);
// }
//
// app.use(
//   cors({
//     origin(origin, cb) {
//       cb(null, isAllowedOrigin(origin));
//     },
//   })
// );
app.use(express.json({ limit: "25mb" })); // large enough for DB restore uploads

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// Feature routers.
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/auth/2fa", require("./routes/twofa.routes"));
app.use("/api/currency", require("./routes/currency.routes"));
app.use("/api/users", require("./routes/users.routes"));
app.use("/api/accounts", require("./routes/accounts.routes"));
app.use("/api/categories", require("./routes/categories.routes"));
app.use("/api/transactions", require("./routes/transactions.routes"));
app.use("/api/budgets", require("./routes/budgets.routes"));
app.use("/api/savings", require("./routes/savings.routes"));
app.use("/api/subscriptions", require("./routes/subscriptions.routes"));
app.use("/api/bills", require("./routes/bills.routes"));
app.use("/api/loans", require("./routes/loans.routes"));
app.use("/api/credit-cards", require("./routes/creditcards.routes"));
app.use("/api/investments", require("./routes/investments.routes"));
app.use("/api/bank-accounts", require("./routes/bankAccounts.routes"));
app.use("/api/share-bundles", require("./routes/shareBundles.routes"));
app.use("/api/receipts", require("./routes/receipts.routes"));
app.use("/api/notifications", require("./routes/notifications.routes"));
app.use("/api/settings", require("./routes/settings.routes"));
app.use("/api/dashboard", require("./routes/dashboard.routes"));
app.use("/api/reports", require("./routes/reports.routes"));
app.use("/api/calendar", require("./routes/calendar.routes"));
app.use("/api/system", require("./routes/system.routes"));
app.use("/api/admin", require("./routes/admin.routes"));

// 404 for unknown API paths.
app.use((_req, res) => res.status(404).json({ message: "Not found." }));

// Central error handler — return Mongoose validation messages when available.
app.use((err, _req, res, _next) => {
  if (err.name === "MulterError" || /image files/.test(err.message || "")) {
    const msg = err.code === "LIMIT_FILE_SIZE" ? "Image is too large (max 8 MB)." : err.message;
    return res.status(400).json({ message: msg });
  }
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors)[0]?.message || "Invalid input.";
    return res.status(400).json({ message });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ message: `Invalid ${err.path}.` });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: "A record with that value already exists." });
  }
  console.error(err);
  res.status(500).json({ message: "Something went wrong. Please try again." });
});

module.exports = app;
