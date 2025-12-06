// const mongoose = require("mongoose");
// const adminLoginSchema = new mongoose.Schema({
//   email: {
//     type: String,
//     required: [true, "Email is required"],
//     match: [
//       /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/,
//       "Please enter a valid email address",
//     ],
//     unique: true,
//   },
//   password: { type: String, required: true },
//   name: { type: String, default: null },

//   profilePhoto: { type: String, default: null },


//   resetOtpHash: { type: String, default: null },
//   resetOtpExpiry: { type: Date, default: null },
//   resetOtpVerified: { type: Boolean, default: false },
//   resetOtpAttempts: { type: Number, default: 0 },
// });

// module.exports = mongoose.model("Admin", adminLoginSchema);

const mongoose = require("mongoose");
const adminLoginSchema = new mongoose.Schema({
  email: {
    type: String,
    required: function() {
      return !this.phone;
    },
    match: [
      /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/,
      "Please enter a valid email address",
    ],
    unique: true,
    sparse: true,
    lowercase: true,
  },
  phone: {
    type: String,
    required: function() {
      return !this.email;
    },
    unique: true,
    sparse: true,
  },
  password: { type: String, required: true },
  name: { type: String, default: null },
  profilePhoto: { type: String, default: null },
  resetOtpHash: { type: String, default: null },
  resetOtpExpiry: { type: Date, default: null },
  resetOtpVerified: { type: Boolean, default: false },
  resetOtpAttempts: { type: Number, default: 0 },
});

// Validation: At least one of email or phone must be present
adminLoginSchema.pre('validate', function(next) {
  if (!this.email && !this.phone) {
    this.invalidate('email', 'Either email or phone is required');
    this.invalidate('phone', 'Either email or phone is required');
  }
  next();
});

module.exports = mongoose.model("Admin", adminLoginSchema);