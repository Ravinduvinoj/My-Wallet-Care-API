const { Schema, model } = require("mongoose");

// Optional module — basic holdings tracking (no live price feed).
const investmentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: [true, "Name is required."], trim: true },
    type: {
      type: String,
      enum: ["stock", "etf", "mutual_fund", "crypto", "gold", "fixed_deposit", "other"],
      default: "stock",
    },
    quantity: { type: Number, default: 0 },
    buyPrice: { type: Number, default: 0 }, // per unit
    currentPrice: { type: Number, default: 0 }, // per unit (manually updated)
    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

investmentSchema.virtual("invested").get(function () {
  return this.quantity * this.buyPrice;
});
investmentSchema.virtual("currentValue").get(function () {
  return this.quantity * this.currentPrice;
});
investmentSchema.virtual("profitLoss").get(function () {
  return this.currentValue - this.invested;
});
investmentSchema.set("toJSON", { virtuals: true });

module.exports = model("Investment", investmentSchema);
