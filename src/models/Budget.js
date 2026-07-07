const { Schema, model } = require("mongoose");

const budgetSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, trim: true, default: "" },
    // Category budget: set category. Overall budget: leave category empty.
    category: { type: String, trim: true, default: "" },
    amount: { type: Number, required: [true, "Amount is required."], min: 0 },
    period: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
    // First day of the budget period.
    startDate: { type: Date, default: () => new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
  },
  { timestamps: true }
);

module.exports = model("Budget", budgetSchema);
