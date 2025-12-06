const mongoose = require("mongoose");

const seoSettingsSchema = new mongoose.Schema({
  page: {
    type: String,
    required: true,
    enum: ["home", "about", "contact"],
  },
  pageTitle: { type: String, required: true },
  content: { type: String },
  keywords: [{ type: String }], 
}, { timestamps: true });

module.exports = mongoose.model("SeoSettings", seoSettingsSchema);
