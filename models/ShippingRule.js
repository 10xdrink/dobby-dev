const mongoose = require("mongoose");

const shippingRuleSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      unique: true,
    },
    flatRateAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    freeShippingThreshold: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    localPickupText: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

shippingRuleSchema.index({ shop: 1, isActive: 1 });

module.exports = mongoose.model("ShippingRule", shippingRuleSchema);