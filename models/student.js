const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: false, // Optional - will be filled during profile completion
    },
    studentType: {
      type: String,
      enum: ["school", "college"],
      required: false, // Will be filled during profile completion
    },
    // School Student Fields
    schoolname: {
      type: String,
      required: false,
    },
    class: {
      type: String,
      required: false,
    },
    // College Student Fields
    collegeName: {
      type: String,
      required: false,
    },
    course: {
      type: String,
      required: false,
    },
    year: {
      type: String,
      enum: ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"],
      required: false,
    },
    phone: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
    },
    email: {
      type: String,
      required: function () {
        return !this.phone;
      },
      match: [
        /^[a-zA-Z0-9]+([._%+-]?[a-zA-Z0-9]+)*@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?$/,
        "Please enter a valid email address",
      ],
      unique: true,
      sparse: true,
    },
    role: { type: String, enum: ["student"], default: "student" },
    parentName: {
      type: String,
      required: false,
    },
    parentPhone: {
      type: String,
      required: false,
    },
    address: {
      type: String,
      required: false,
    },

    affiliateCode: { type: String, unique: true, sparse: true },
    affiliateLink: { type: String },
    totalEarnings: { type: Number, default: 0 }, 
    profilePhoto: {
      type: String,
      default: null,
      required: false,
    },
    profilePhotoId: {
      type: String,
      default: null,
    },
    isActive: { type: Boolean, default: true }, 
    isBlocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Student", studentSchema);
