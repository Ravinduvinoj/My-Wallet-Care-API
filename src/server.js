require("dotenv").config();
const connectDB = require("./config/db");
const app = require("./app");
const { runRecurring } = require("./services/recurring");

const PORT = process.env.PORT || 5000;

connectDB()
  .then(async () => {
    // Process any subscriptions/bills that came due while offline, then hourly.
    await runRecurring().catch((e) => console.error("recurring (boot):", e.message));
    setInterval(
      () => runRecurring().catch((e) => console.error("recurring:", e.message)),
      60 * 60 * 1000
    );

    app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
