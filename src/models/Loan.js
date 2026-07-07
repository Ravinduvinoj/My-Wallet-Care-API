const { Schema, model } = require("mongoose");

const loanSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: [true, "Name is required."], trim: true },
    principal: { type: Number, required: [true, "Loan amount is required."], min: 0 },
    interestRate: { type: Number, default: 0 }, // annual %
    monthlyInstallment: { type: Number, default: 0 },
    remainingBalance: { type: Number, default: 0 },
    nextDueDate: { type: Date },
    status: { type: String, enum: ["active", "closed"], default: "active" },
    payments: [
      {
        amount: Number,
        date: { type: Date, default: Date.now },
        note: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

module.exports = model("Loan", loanSchema);
