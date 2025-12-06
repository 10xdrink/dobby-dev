const mongoose = require("mongoose");

const contactSupportSchema = new mongoose.Schema({
  shopName: { type: String, required: true },
  email: { type: String, required: true },          
  receiverEmail: { type: String, required: true },  
  subject: {
    type: String,
    enum: ["Technical Issue", "Billing", "General Query", "Others"],
    required: true
  },
  message: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model("ContactSupport", contactSupportSchema);
