const mongoose = require("mongoose");

const companyReliabilitySchema = new mongoose.Schema({
  key: {
    type: String,
    enum: ["deliveryInfo", "safePayment", "returnPolicy", "authenticProduct"],
    required: true,
    unique: true,
  },
  title: { type: String, required: true },
  icon: { type: String }, 
  iconPublicId: { type: String }, 
  status: { type: Boolean, default: true },
});

module.exports = mongoose.model("CompanyReliability", companyReliabilitySchema);
