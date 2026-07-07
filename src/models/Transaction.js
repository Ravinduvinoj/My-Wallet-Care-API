const { Schema, model } = require("mongoose");

const transactionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["income", "expense"], required: true },
    amount: {
      type: Number,
      required: [true, "Amount is required."],
      min: [0.01, "Amount must be positive."],
    },
    category: { type: String, required: [true, "Category is required."], trim: true },
    account: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    date: { type: Date, default: Date.now },
    merchant: { type: String, trim: true, default: "" },
    paymentMethod: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    receiptUrl: { type: String, trim: true, default: "" },
    // Where this transaction came from (manual entry or an automated system).
    source: {
      type: String,
      enum: ["manual", "subscription", "bill", "loan", "credit_card", "transfer", "savings"],
      default: "manual",
    },
  },
  { timestamps: true }
);

transactionSchema.index({ user: 1, date: -1 });

module.exports = model("Transaction", transactionSchema);
