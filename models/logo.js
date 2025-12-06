const mongoose = require("mongoose");

const logoSchema = new mongoose.Schema(
  {
    headerLogo: { type: String },
    footerLogo: { type: String },
    favicon: { type: String },
    loadingGif: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Logo", logoSchema);
