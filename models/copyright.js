const mongoose = require("mongoose");

const copyrightSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Copyright", copyrightSchema);
