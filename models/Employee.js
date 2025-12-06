const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  employeeImage: { type: String },   
  employeeImagePublicId: { type: String },   
  role: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "EmployeeRole", 
    required: true 
  },
  identityType: { type: String, enum: ["Aadhar", "Passport"], required: true },
  identityNumber: { type: String, required: true },
  identityImage: { type: String },
  identityImagePublicId: { type: String },

  email: { type: String, required: true, unique: true, lowercase:true },
  password: { type: String, required: true },

  status: { type: Boolean, default: true } 
}, { timestamps: true });

module.exports = mongoose.model("Employee", employeeSchema);
