const mongoose = require("mongoose");

const privacySchema = new mongoose.Schema(
  {
    description:{ type: String, required: true },
  createdAt: {
    type: Date,
    default: Date.now
  }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Privacy", privacySchema);
