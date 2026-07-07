const { Schema, model } = require("mongoose");

// user: null => global default category (seeded, not editable by users).
const categorySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    name: { type: String, required: [true, "Name is required."], trim: true },
    type: {
      type: String,
      enum: ["income", "expense", "subscription"],
      required: true,
    },
    icon: { type: String, default: "tag" },
    color: { type: String, default: "#059669" },
  },
  { timestamps: true }
);

module.exports = model("Category", categorySchema);
