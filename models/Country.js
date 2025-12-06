const mongoose = require("mongoose");

const languageSchema = new mongoose.Schema({
  code: String,
  name: String,
});

const countrySchema = new mongoose.Schema({
  name: { type: String, required: true },
  iso2: { type: String, required: true, unique: true, index: true },
  currency: String,
  flag: String,
  languages: [languageSchema],
});

module.exports = mongoose.model("Country", countrySchema);
