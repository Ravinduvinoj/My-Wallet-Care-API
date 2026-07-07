const { Schema, model } = require("mongoose");

const subscriptionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: [true, "Name is required."], trim: true },
    amount: { type: Number, required: [true, "Amount is required."], min: 0 },
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
  },
  { timestamps: true }
);

module.exports = model("Subscription", subscriptionSchema);
