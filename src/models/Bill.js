const { Schema, model } = require("mongoose");

const billSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: [true, "Name is required."], trim: true },
    category: { type: String, trim: true, default: "Bills" },
    amount: { type: Number, required: [true, "Amount is required."], min: 0 },
    dueDate: { type: Date, required: true },
    account: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    status: { type: String, enum: ["unpaid", "paid"], default: "unpaid" },
    autoRecurring: { type: Boolean, default: false },
    recurringCycle: {
      type: String,
      enum: ["weekly", "monthly", "quarterly", "yearly"],
      default: "monthly",
    },
    notes: { type: String, trim: true, default: "" },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = model("Bill", billSchema);
