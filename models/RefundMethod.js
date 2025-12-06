const mongoose = require('mongoose');

const refundMethodSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      unique: true, // Each customer can have only one refund method
    },
    preferredMethod: {
      type: String,
      enum: ['account', 'upi'],
      required: true,
    },
    bankAccountDetails: {
      accountHolderName: {
        type: String,
        required: function() {
          return this.preferredMethod === 'account';
        },
      },
      bankName: {
        type: String,
        required: function() {
          return this.preferredMethod === 'account';
        },
      },
      accountNumber: {
        type: String,
        required: function() {
          return this.preferredMethod === 'account';
        },
      },
      ifscCode: {
        type: String,
        required: function() {
          return this.preferredMethod === 'account';
        },
        uppercase: true,
        minlength: 11,
        maxlength: 11,
      },
    },
    upiDetails: {
      upiId: {
        type: String,
        required: function() {
          return this.preferredMethod === 'upi';
        },
        lowercase: true,
      },
    },
  },
  { timestamps: true }
);

// Index for faster lookups
refundMethodSchema.index({ customer: 1 });

// Ensure account number is encrypted (in production, use encryption)
refundMethodSchema.pre('save', function(next) {
  if (this.preferredMethod === 'account' && this.bankAccountDetails.ifscCode) {
    this.bankAccountDetails.ifscCode = this.bankAccountDetails.ifscCode.toUpperCase();
  }
  if (this.preferredMethod === 'upi' && this.upiDetails.upiId) {
    this.upiDetails.upiId = this.upiDetails.upiId.toLowerCase();
  }
  next();
});

const RefundMethod = mongoose.model('RefundMethod', refundMethodSchema);

module.exports = RefundMethod;
