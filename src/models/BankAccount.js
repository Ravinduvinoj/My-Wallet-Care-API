const { Schema, model } = require("mongoose");
const crypto = require("crypto");

// A user's own bank account details, saved so they can share a link for
// others to send them money. (Separate from the balance-tracking Account model.)
const bankAccountSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    label: { type: String, trim: true, default: "" }, // optional nickname
    bankName: { type: String, required: [true, "Bank name is required."], trim: true },
    accountNumber: { type: String, required: [true, "Account number is required."], trim: true },
    branch: { type: String, trim: true, default: "" },
    accountHolderName: { type: String, required: [true, "Account holder name is required."], trim: true },
    accountType: {
      type: String,
      enum: ["savings", "current", "checking", "salary", "fixed_deposit", "other"],
      default: "savings",
    },
    // Capability token for the public share link.
    shareId: { type: String, unique: true, index: true, default: () => crypto.randomBytes(6).toString("hex") },
    shareEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/** Public fields shown on the share/pay page (no user id, no internal data). */
bankAccountSchema.methods.toShared = function () {
  return {
    label: this.label,
    bankName: this.bankName,
    accountNumber: this.accountNumber,
    branch: this.branch,
    accountHolderName: this.accountHolderName,
    accountType: this.accountType,
  };
};

module.exports = model("BankAccount", bankAccountSchema);
