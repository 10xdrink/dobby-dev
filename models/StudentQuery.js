const mongoose = require("mongoose");

const studentQuerySchema = new mongoose.Schema({
  studentName: { type: String, required: true },
  email: { type: String, required: true },
  topic: { 
    type: String, 
    enum: ["Shop Registration", "Payment Issues", "Affiliate Link", "Others"], 
    required: true 
  },
  queryDetails: { type: String, required: true },
  image: { type: String, default: null },
   imagePublicId: { type: String, default: null },  
  status: { type: String, enum: ["Pending", "Resolved"], default: "Pending" },
}, { timestamps: true });

module.exports = mongoose.model("StudentQuery", studentQuerySchema);
