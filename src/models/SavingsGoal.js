const { Schema, model } = require("mongoose");

// Covers both "Savings goals" and "Financial goals".
const savingsGoalSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: [true, "Name is required."], trim: true },
    type: {
      type: String,
      enum: [
        "general",
        "emergency_fund",
        "vacation",
        "car",
        "house",
        "education",
        "retirement",
      ],
      default: "general",
    },
    targetAmount: { type: Number, required: [true, "Target is required."], min: 0.01 },
    currentAmount: { type: Number, default: 0, min: 0 },
    deadline: { type: Date },
    completed: { type: Boolean, default: false },
    // Manual log of contributions.
    contributions: [
      {
        amount: Number,
        date: { type: Date, default: Date.now },
        note: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

module.exports = model("SavingsGoal", savingsGoalSchema);
