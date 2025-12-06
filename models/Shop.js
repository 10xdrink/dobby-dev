// models/shopModel.js
const mongoose = require("mongoose");

const shopSchema = new mongoose.Schema(
  {
    shopName: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    address: { type: String, required: true },
    image: {
      url: { type: String, required: false },
      public_id: { type: String, required: false },
    },
    banner: {
      url: { type: String, required: false }, 
      public_id: { type: String, required: false },
    },

    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalReviews: {
      type: Number,
      default: 0
    },
    
    status: {
      type: String,
      enum: ["pending_payment", "active", "disabled"],
      default: "pending_payment",
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },

    // Additional fields
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Shop", shopSchema);
