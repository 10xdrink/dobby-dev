// OTPModel (models/OTPModel.js)
const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  email: { type: String, required: function() { return !this.phone; },  sparse: true },
  phone: { type: String, required: function() { return !this.email; },  sparse: true },
  otp: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  otpExpiry: { type: Date, default: null },
  attempts: { type: Number, default: 0 },
  blockUntil: { type: Date, default: null },
  lastSentAt: { type: Date },
  verified: { type: Boolean, default: false },
  
  
  signupData: {
    type: {
      email: String,
      phone: String,
      password: String,
      refBy: String,
    },
    default: undefined
  },
  context: {
    type: String,
    enum: [
      "signup",
      "login",
      "forgot_password",
      "generic",
      "customer_signup",
      "customer_login",
      "customer_forgot_password",
      "customer_account_delete",
      "student_login",
    ],
    default: "generic",
    index: true,
  },
});

module.exports = mongoose.model("OTP", otpSchema);
