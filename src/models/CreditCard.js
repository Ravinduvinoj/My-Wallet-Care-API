const { Schema, model } = require("mongoose");

const creditCardSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: [true, "Name is required."], trim: true },
    creditLimit: { type: Number, required: [true, "Credit limit is required."], min: 0 },
    currentBalance: { type: Number, default: 0 }, // amount owed
    dueDate: { type: Date },
    minimumPayment: { type: Number, default: 0 },
    statements: [
      {
        amount: Number,
        type: { type: String, enum: ["charge", "payment"], default: "charge" },
        date: { type: Date, default: Date.now },
        note: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

// availableCredit is derived, exposed via toJSON virtual.
creditCardSchema.virtual("availableCredit").get(function () {
  return Math.max(0, this.creditLimit - this.currentBalance);
});
creditCardSchema.set("toJSON", { virtuals: true });

module.exports = model("CreditCard", creditCardSchema);
