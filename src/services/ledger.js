// Central place to create/remove transactions so account balances stay in sync.
const Transaction = require("../models/Transaction");
const Account = require("../models/Account");

const signed = (type, amount) => (type === "income" ? amount : -amount);

/** Apply a transaction's effect to its account balance. */
async function applyToAccount(txn, direction = 1) {
  if (!txn.account) return;
  const delta = signed(txn.type, txn.amount) * direction;
  await Account.findByIdAndUpdate(txn.account, { $inc: { balance: delta } });
}

/** Create a transaction and update the linked account balance. */
async function createTransaction(data) {
  const txn = await Transaction.create(data);
  await applyToAccount(txn, 1);
  return txn;
}

/** Delete a transaction and reverse its balance effect. */
async function deleteTransaction(txn) {
  await applyToAccount(txn, -1);
  await txn.deleteOne();
}

/**
 * Update a transaction. Reverses the old effect, applies the new one — handles
 * changes to amount, type, or account.
 */
async function updateTransaction(txn, updates) {
  await applyToAccount(txn, -1); // remove old effect
  Object.assign(txn, updates);
  await txn.save();
  await applyToAccount(txn, 1); // apply new effect
  return txn;
}

module.exports = {
  signed,
  createTransaction,
  deleteTransaction,
  updateTransaction,
};
