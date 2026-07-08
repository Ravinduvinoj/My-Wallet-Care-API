require("dotenv").config();
const connectDB = require("./config/db");
const app = require("./app");
const { runRecurring } = require("./services/recurring");
const { verifyConnection } = require("./services/email");

const PORT = process.env.PORT || 5000;

connectDB()
  .then(async () => {
    // Process any subscriptions/bills that came due while offline, then hourly.
    await runRecurring().catch((e) => console.error("recurring (boot):", e.message));
    setInterval(
      () => runRecurring().catch((e) => console.error("recurring:", e.message)),
      60 * 60 * 1000
    );

    verifyConnection()
      .then((r) => console.log(r.configured ? "Email (SMTP) ready." : "Email not configured — OTP codes will be logged to the console."))
      .catch((e) => console.warn("Email SMTP check failed:", e.message));

    app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
