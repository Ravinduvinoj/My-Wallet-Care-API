const jwt = require("jsonwebtoken");
const User = require("../models/User");

/** Verifies the Bearer token and attaches the user document to req.user. */
async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    // Prefer the Authorization header; fall back to ?token= for <a> download
    // links (CSV/PDF/XLSX exports, DB backup) which can't set headers.
    const token = header.startsWith("Bearer ")
      ? header.slice(7)
      : req.query && req.query.token
        ? String(req.query.token)
        : null;
    if (!token) return res.status(401).json({ message: "Not signed in." });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ message: "Account no longer exists." });
    if (user.isSuspended) return res.status(403).json({ message: "This account has been suspended." });

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Session expired. Please log in again." });
  }
}

/** Must run after protect. */
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

module.exports = { protect, requireAdmin, signToken };
