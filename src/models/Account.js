const { Schema, model } = require("mongoose");

const accountSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: [true, "Name is required."], trim: true },
    type: {
      type: String,
      enum: [
        "cash",
        "bank",
        "credit_card",
        "debit_card",
        "paypal",
        "apple_pay",
        "google_pay",
        "ewallet",
        "other",
      ],
      default: "bank",
    },
    balance: { type: Number, default: 0 },
    currency: { type: String, default: "USD" },
  },
  { timestamps: true }
);

module.exports = model("Account", accountSchema);
