// Full-database export/import (admin only). The export includes hidden User
// fields (password hash, 2FA secret) so a restore reproduces working logins.
const MODELS = {
  User: require("../models/User"),
  Category: require("../models/Category"),
  Account: require("../models/Account"),
  Transaction: require("../models/Transaction"),
  Budget: require("../models/Budget"),
  SavingsGoal: require("../models/SavingsGoal"),
  Subscription: require("../models/Subscription"),
  Bill: require("../models/Bill"),
  Loan: require("../models/Loan"),
  CreditCard: require("../models/CreditCard"),
  Investment: require("../models/Investment"),
  Notification: require("../models/Notification"),
  ActivityLog: require("../models/ActivityLog"),
};

async function dump() {
  const collections = {};
  for (const [name, Model] of Object.entries(MODELS)) {
    const q = Model.find().lean();
    // Include select:false fields for User so passwords survive a restore.
    if (name === "User") q.select("+password +twoFactorSecret");
    collections[name] = await q;
  }
  return { version: 1, exportedAt: new Date().toISOString(), collections };
}

async function restore(data) {
  if (!data || !data.collections) throw new Error("Invalid backup file.");
  const summary = {};
  for (const [name, Model] of Object.entries(MODELS)) {
    const docs = data.collections[name];
    if (!Array.isArray(docs)) continue;
    await Model.deleteMany({});
    if (docs.length) await Model.insertMany(docs, { ordered: false });
    summary[name] = docs.length;
  }
  return summary;
}

module.exports = { dump, restore, MODELS };
