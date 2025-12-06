const mongoose = require("mongoose");
const referralClickSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  ipAddress: String,
  userAgent: String,
  refCode: String, 
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model("ReferralClick", referralClickSchema);
