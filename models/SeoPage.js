// models/SeoPage.js
const mongoose = require("mongoose");

const seoPageSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true }, // e.g., "home", "about-us"
  title: String,
  description: String,
  keywords: [String],
  content: String
});

module.exports = mongoose.model("SeoPage", seoPageSchema);
