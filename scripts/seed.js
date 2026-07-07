// Seeds demo accounts, default categories, and sample financial data for Jordan.
// Run: npm run seed   (safe to re-run; skips what already exists)
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");
const Category = require("../src/models/Category");
const Account = require("../src/models/Account");
const Budget = require("../src/models/Budget");
const SavingsGoal = require("../src/models/SavingsGoal");
const Subscription = require("../src/models/Subscription");
const Bill = require("../src/models/Bill");
const { createTransaction } = require("../src/services/ledger");

const DEFAULT_CATEGORIES = [
  ...["Salary", "Business", "Freelance", "Investments", "Gifts", "Other"].map((name) => ({ name, type: "income" })),
  ...["Food", "Transport", "Rent", "Utilities", "Shopping", "Healthcare", "Education", "Entertainment", "Travel", "Insurance", "Other"].map((name) => ({ name, type: "expense" })),
  ...["Streaming", "Software", "Utilities"].map((name) => ({ name, type: "subscription" })),
];

async function seedDefaultCategories() {
  for (const c of DEFAULT_CATEGORIES) {
    const exists = await Category.findOne({ user: null, name: c.name, type: c.type });
    if (!exists) await Category.create({ ...c, user: null });
  }
  console.log(`default categories ready (${DEFAULT_CATEGORIES.length})`);
}

async function ensureUser({ name, email, password, role }) {
  let user = await User.findOne({ email });
  if (user) {
    console.log(`skip   ${email} (exists)`);
    return user;
  }
  user = await User.create({ name, email, password, role });
  console.log(`create ${email} (${role})`);
  return user;
}

async function seedDemoData(user) {
  if (await Account.findOne({ user: user.id })) {
    console.log("skip   demo financial data (already present)");
    return;
  }
  const daysAgo = (n) => new Date(Date.now() - n * 86400000);
  const inDays = (n) => new Date(Date.now() + n * 86400000);

  const checking = await Account.create({ user: user.id, name: "Checking", type: "bank", balance: 0 });
  const savings = await Account.create({ user: user.id, name: "Savings", type: "bank", balance: 0 });

  const txns = [
    { type: "income", amount: 3200, category: "Salary", account: checking.id, date: daysAgo(20), merchant: "Employer" },
    { type: "expense", amount: 1200, category: "Rent", account: checking.id, date: daysAgo(18), merchant: "Landlord" },
    { type: "expense", amount: 82.4, category: "Food", account: checking.id, date: daysAgo(15), merchant: "Whole Foods" },
    { type: "expense", amount: 54.2, category: "Transport", account: checking.id, date: daysAgo(10), merchant: "Shell" },
    { type: "expense", amount: 120, category: "Shopping", account: checking.id, date: daysAgo(6), merchant: "Amazon" },
    { type: "income", amount: 450, category: "Freelance", account: checking.id, date: daysAgo(4), merchant: "Client" },
    { type: "expense", amount: 60, category: "Entertainment", account: checking.id, date: daysAgo(2), merchant: "Cinema" },
  ];
  for (const t of txns) await createTransaction({ ...t, user: user.id, source: "manual" });

  await Budget.create([
    { user: user.id, name: "Food", category: "Food", amount: 500, period: "monthly" },
    { user: user.id, name: "Shopping", category: "Shopping", amount: 300, period: "monthly" },
    { user: user.id, name: "Overall monthly", category: "", amount: 2500, period: "monthly" },
  ]);
  await SavingsGoal.create([
    { user: user.id, name: "Emergency fund", type: "emergency_fund", targetAmount: 5000, currentAmount: 1500, deadline: inDays(180) },
    { user: user.id, name: "Vacation", type: "vacation", targetAmount: 2000, currentAmount: 400, deadline: inDays(120) },
  ]);
  await Subscription.create([
    { user: user.id, name: "Netflix", amount: 15.99, billingCycle: "monthly", category: "Streaming", account: checking.id, nextRenewalDate: inDays(9) },
    { user: user.id, name: "Spotify", amount: 9.99, billingCycle: "monthly", category: "Streaming", account: checking.id, nextRenewalDate: inDays(3) },
    { user: user.id, name: "ChatGPT Plus", amount: 20, billingCycle: "monthly", category: "Software", account: checking.id, nextRenewalDate: inDays(20) },
  ]);
  await Bill.create([
    { user: user.id, name: "Electricity", category: "Utilities", amount: 75, dueDate: inDays(5), account: checking.id, autoRecurring: true },
    { user: user.id, name: "Internet", category: "Utilities", amount: 45, dueDate: inDays(12), account: checking.id, autoRecurring: true },
  ]);
  console.log("create demo financial data for Jordan");
}

(async () => {
  await connectDB();
  await seedDefaultCategories();
  await ensureUser({ name: "Ava Admin", email: "admin@walletcare.app", password: "admin123", role: "admin" });
  const jordan = await ensureUser({ name: "Jordan Lee", email: "jordan@example.com", password: "password1", role: "user" });
  await seedDemoData(jordan);
  await mongoose.disconnect();
  console.log("Seed complete.");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
