const mongoose = require("mongoose");

const paymentGatewaySchema = new mongoose.Schema({
  name: { type: String, required: true, enum: ["paypal", "razorpay", "stripe"] },
  credentials: {
    clientId: { type: String, default: null },      // PayPal
    clientSecret: { type: String, default: null },  // PayPal
    apiKey: { type: String, default: null },        // Stripe / Razorpay
    apiSecret: { type: String, default: null },
    webhookSecret: { 
      type: String, 
      default: null,
      required: function() {
        return this.name === "razorpay" || this.name === "stripe";
      }
    },     // Stripe / Razorpay
  },
  logoUrl: { type: String, default: null },        
  logoPublicId: { type: String, default: null },   
  title: { type: String, required: true },
  isActive: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("PaymentGateway", paymentGatewaySchema);
