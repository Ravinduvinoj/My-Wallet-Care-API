const mongoose = require("mongoose");

// Register the soft-delete plugin globally BEFORE any model is compiled.
// (This module is required before the models in both server.js and seed.js.)
mongoose.plugin(require("./softDelete"));

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not set. Copy .env.example to .env.");
  await mongoose.connect(uri);
  console.log(`MongoDB connected: ${mongoose.connection.host}`);
}

module.exports = connectDB;
