const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.type === "shop";
      },
    }, // shopkeeper
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
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    type: {
      type: String,
      enum: ["shop", "order"],
      required: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },

    gateway: {
      type: String,
      enum: ["razorpay", "stripe", "paypal", "cod"],
      required: true,
    },
    gatewayOrderId: { type: String, default: null },
    gatewayPaymentId: { type: String, default: null }, // final payment id
    clientSecret: { type: String, default: null },
    status: {
      type: String,
      enum: ["pending", "paid", "used", "failed", "verifying", "cancelled"],
      default: "pending",
    },
    metadata: { type: Object, default: {} },
    idempotencyKey: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

paymentSchema.index({ gatewayOrderId: 1 });
paymentSchema.index({ owner: 1, type: 1, status: 1 }); // For efficient shop payment queries

module.exports = mongoose.model("Payment", paymentSchema);
