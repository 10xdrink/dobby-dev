const mongoose = require("mongoose");

const otpsettingsSchema = new mongoose.Schema({
  maxOtpAttempts: { type: Number, default: 3 },         
  otpResendTime: { type: Number, default: 60 },         // resend wait (seconds)
  tempOtpBlockTime: { type: Number, default: 21600 },   // otp block time (seconds)
  maxLoginAttempts: { type: Number, default: 3 },       // login max attempts
  tempLoginBlockTime: { type: Number, default: 21600 } ,
  otpExpiryTime: { type: Number, default: 90 }, // OTP valid for 5 minutes
 // login block time (seconds)
}, { timestamps: true });

module.exports = mongoose.model("OtpSettings", otpsettingsSchema);
