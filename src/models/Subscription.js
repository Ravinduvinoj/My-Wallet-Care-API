const { Schema, model } = require("mongoose");

const subscriptionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: [true, "Name is required."], trim: true },
    amount: { type: Number, required: [true, "Amount is required."], min: 0 },
    // Currency this subscription is billed in (may differ from the user's base).
    currency: { type: String, default: "USD" },
    billingCycle: {
      type: String,
      enum: ["weekly", "monthly", "quarterly", "yearly"],
      default: "monthly",
    },
    category: { type: String, trim: true, default: "Subscription" },
    account: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    paymentMethod: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    nextRenewalDate: { type: Date, required: true },
    autoRenew: { type: Boolean, default: true },
    status: { type: String, enum: ["active", "cancelled"], default: "active" },
    lastRenewedAt: { type: Date },
    // One entry per paid cycle (auto or manually marked paid).
    payments: [
      {
        amount: Number, // in the subscription's currency
        currency: String,
        baseAmount: Number, // charged amount in the user's base currency
        date: { type: Date, default: Date.now }, // when it was paid/charged
        forDate: Date, // the renewal date this payment covers
        manual: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

module.exports = model("Subscription", subscriptionSchema);
