const mongoose = require("mongoose");

const smsconfigSchema = new mongoose.Schema({
  twoFactor: {
    apiKey: { type: String, default: "" },
    isActive: { type: Boolean, default: false },
  },

  twilio: {
    sid: { type: String, default: "" },
    token: { type: String, default: "" },
    from: { type: String, default: "" },
    messagingServiceSid: { type: String, default: "" },
    otpTemplate: { type: String, default: "" },
    isActive: { type: Boolean, default: false },
  },
});

module.exports = mongoose.model("SMS", smsconfigSchema);
