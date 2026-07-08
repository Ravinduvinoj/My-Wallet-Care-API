const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const settingsSchema = new mongoose.Schema(
  {
    theme: { type: String, enum: ["light", "dark", "system"], default: "system" },
    currency: { type: String, default: "USD" },
    // Whether the user has explicitly chosen their currency (drives the
    // first-login prompt). Stays false until they pick one.
    currencyConfirmed: { type: Boolean, default: false },
    language: { type: String, default: "en" },
    dateFormat: { type: String, default: "MMM d, yyyy" },
    notifications: {
      billDue: { type: Boolean, default: true },
      budgetExceeded: { type: Boolean, default: true },
      subscriptionRenewal: { type: Boolean, default: true },
      savingsGoal: { type: Boolean, default: true },
      lowBalance: { type: Boolean, default: true },
      monthlySummary: { type: Boolean, default: true },
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Name is required."], trim: true },
    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please enter a valid email."],
    },
    // select:false keeps the hash out of queries unless explicitly requested.
    password: {
      type: String,
      required: [true, "Password is required."],
      minlength: [6, "Password must be at least 6 characters."],
      select: false,
    },
    role: { type: String, enum: ["admin", "user"], default: "user" },
    isSuspended: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    emailOtp: { type: String, select: false },
    emailOtpExpires: { type: Date, select: false },
    settings: { type: settingsSchema, default: () => ({}) },
    // TOTP two-factor auth. Secret is kept out of queries by default.
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
    lastLoginAt: { type: Date },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

// Hash the password whenever it is set/changed.
// (Mongoose 9: async middleware receives no `next` — just return.)
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

/** Shape exposed to the frontend. */
userSchema.methods.toPublic = function () {
  return {
    id: this.id,
    name: this.name,
    email: this.email,
    role: this.role,
    isSuspended: this.isSuspended,
    emailVerified: this.emailVerified,
    settings: this.settings,
    twoFactorEnabled: this.twoFactorEnabled,
    createdAt: this.createdAt,
    lastLoginAt: this.lastLoginAt,
  };
};

module.exports = mongoose.model("User", userSchema);
