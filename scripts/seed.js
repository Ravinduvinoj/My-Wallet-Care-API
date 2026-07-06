// Seeds the demo accounts. Run once: npm run seed
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");

const SEED_USERS = [
  { name: "Ava Admin", email: "admin@walletcare.app", password: "admin123", role: "admin" },
  { name: "Jordan Lee", email: "jordan@example.com", password: "password1", role: "user" },
];

(async () => {
  await connectDB();
  for (const data of SEED_USERS) {
    const existing = await User.findOne({ email: data.email });
    if (existing) {
      console.log(`skip   ${data.email} (already exists)`);
      continue;
    }
    await User.create(data); // password hashed by the pre-save hook
    console.log(`create ${data.email} (${data.role})`);
  }
  await mongoose.disconnect();
  console.log("Seed complete.");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
