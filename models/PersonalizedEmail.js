const mongoose = require("mongoose");

const personalizedEmailSchema = new mongoose.Schema({
  subscriber: { type: mongoose.Schema.Types.ObjectId, ref: "Subscriber", required: true },
  email: { type: String, required: true }, 
  subject: { type: String, required: true }, 
  content: { type: String, required: true },
  discountCode: { type: String },            
  productUrl: { type: String },              
  sentAt: { type: Date, default: Date.now }, 
  sentBy: { type: String },                  
}, { timestamps: true });

module.exports = mongoose.model("PersonalizedEmail", personalizedEmailSchema);
