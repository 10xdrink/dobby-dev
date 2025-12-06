/*  const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  phone: String,
  password: String, // optional for OTP-based login
  role: { type: String, enum: ['student', 'admin', 'shopkeeper'], default: 'student' },
  otp: String,
  otpExpiry: Date,
  isApproved: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema); */

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String },
    lastName: { type: String },
    email: {
      type: String,
      match: [
        /^[a-zA-Z0-9]+([._%+-]?[a-zA-Z0-9]+)*@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?$/,
        "Please enter a valid email address",
      ],
      unique: true,
      sparse: true,
    }, 
    phone: { type: String, unique: true, sparse: true },
    password: String,
    role: { type: String, enum: ["shopkeeper"], default: "shopkeeper" },

    shopName: { type: String },
    shopAddress: { type: String },

    loginAttempts: { type: Number, default: 0 },
    loginBlockUntil: { type: Date, default: null },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },

    profile: {
      url: { type: String },
      public_id: { type: String },
    },

    refBy: { type: String, default: null },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      default: null,
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },
    blockedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);

// otp: String,
// otpExpiry: Date,
