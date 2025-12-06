const mongoose = require("mongoose");
const referralHistorySchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  shopkeeperId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // User model (shopkeeper)
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
  amount: { type: Number, default: 1000 },
  status: { type: String, enum: ["pending","credited","rejected"], default: "pending" },
   createdAt: { type: Date, default: Date.now },
  creditedAt: { type: Date, default: null } 
});
module.exports = mongoose.model("ReferralHistory", referralHistorySchema);
