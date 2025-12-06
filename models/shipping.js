const mongoose = require("mongoose");

const ShippingSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true,
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Shipping", ShippingSchema);
