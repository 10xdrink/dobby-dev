const mongoose = require("mongoose");

const refundPolicySchema = new mongoose.Schema({
  description:{ type: String, required: true },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const RefundPolicy = mongoose.model("refundPolicy", refundPolicySchema);

module.exports = RefundPolicy;