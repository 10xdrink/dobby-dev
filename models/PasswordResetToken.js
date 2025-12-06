// models/PasswordResetToken.js
const mongoose = require("mongoose");

const passwordResetTokenSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: "customerModel",
    required: true,
  },
  customerModel: {
    type: String,
    enum: ["Customer", "Student"],
    default: "Customer",
  },
  token: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 60 * 60 * 1000), // 1 hour expiry
  },
  used: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  ipAddress: {
    type: String,
    default: null,
  },
  userAgent: {
    type: String,
    default: null,
  },
});

// Index for automatic cleanup of expired tokens
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for faster lookups
passwordResetTokenSchema.index({ token: 1 });
passwordResetTokenSchema.index({ customer: 1 });

module.exports = mongoose.model("PasswordResetToken", passwordResetTokenSchema);