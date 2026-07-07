const { Schema, model } = require("mongoose");

// Audit trail: login history and significant user/system actions.
const activityLogSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    action: { type: String, required: true }, // e.g. "login", "register", "delete_transaction"
    detail: { type: String, default: "" },
    ip: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = model("ActivityLog", activityLogSchema);
