const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/users.routes");
const adminRoutes = require("./routes/admin.routes");

const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);

// 404 for unknown API paths.
app.use((_req, res) => res.status(404).json({ message: "Not found." }));

// Central error handler — return Mongoose validation messages when available.
app.use((err, _req, res, _next) => {
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors)[0]?.message || "Invalid input.";
    return res.status(400).json({ message });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: "An account with this email already exists." });
  }
  console.error(err);
  res.status(500).json({ message: "Something went wrong. Please try again." });
});

module.exports = app;
