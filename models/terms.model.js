const mongoose = require("mongoose");

const termsSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true, 
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Terms", termsSchema);
