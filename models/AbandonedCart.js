const mongoose = require("mongoose");

const abandonedCartSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },

    
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "customerModel",
      default: null,
    },
    customerModel: {
      type: String,
      enum: ["Customer", "Student"],
      default: "Customer",
    },

    sessionId: {
      type: String,
      default: null, 
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    quantity: { type: Number, default: 1 },
    value: { type: Number, required: true },

    status: {
      type: String,
      enum: ["pending", "sent", "recovered"],
      default: "pending",
    },

    abandonedAt: { type: Date, default: Date.now },
    recoveredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AbandonedCart", abandonedCartSchema);
