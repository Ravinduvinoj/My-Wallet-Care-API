const { Schema, model } = require("mongoose");

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: [
        "bill_due",
        "budget_exceeded",
        "subscription_renewal",
        "loan_payment",
        "credit_card_payment",
        "savings_goal",
        "low_balance",
        "large_spending",
        "monthly_summary",
        "system",
      ],
      default: "system",
    },
    title: { type: String, required: true },
    message: { type: String, default: "" },
    read: { type: Boolean, default: false },
    // Dedupe key so the generator doesn't create duplicates for the same event.
    dedupeKey: { type: String, index: true },
  },
  { timestamps: true }
);

module.exports = model("Notification", notificationSchema);
