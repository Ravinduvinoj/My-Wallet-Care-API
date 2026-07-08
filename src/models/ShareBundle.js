const { Schema, model } = require("mongoose");
const crypto = require("crypto");

// A shareable link that bundles several saved bank accounts (yours and/or
// recipients') so you can share them all with one link.
const shareBundleSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    label: { type: String, trim: true, default: "" },
    note: { type: String, trim: true, default: "" },
    accounts: [{ type: Schema.Types.ObjectId, ref: "BankAccount" }],
    shareId: { type: String, unique: true, index: true, default: () => crypto.randomBytes(6).toString("hex") },
    shareEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = model("ShareBundle", shareBundleSchema);
