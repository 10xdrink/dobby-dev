const mongoose = require("mongoose");

const shopCustomerStatusSchema = new mongoose.Schema({
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: "customerModel",
    required: true,
  },
  customerModel: {
    type: String,
    enum: ["Customer", "Student"],
    default: "Customer",
  },
  status: {
    type: String,
    enum: ["active", "deactivated"],
    default: "active",
  },
  updatedAt: { type: Date, default: Date.now },
});

shopCustomerStatusSchema.index({ shop: 1, customer: 1 }, { unique: true });

module.exports = mongoose.model("ShopCustomerStatus", shopCustomerStatusSchema);
