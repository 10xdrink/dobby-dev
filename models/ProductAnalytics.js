// models/ProductAnalytics.js
const mongoose = require("mongoose");

const productAnalyticsSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    
    date: {
      type: Date,
      required: true,
      index: true,
    },
    
    // Sales metrics
    unitsSold: {
      type: Number,
      default: 0,
    },
    
    revenue: {
      type: Number,
      default: 0,
    },
    
    ordersCount: {
      type: Number,
      default: 0,
    },
    
    // Stock metrics
    stockAtStart: {
      type: Number,
      default: 0,
    },
    
    stockAtEnd: {
      type: Number,
      default: 0,
    },
    
    stockMovement: {
      type: Number,
      default: 0,
    },
    
    // Performance metrics
    viewCount: {
      type: Number,
      default: 0,
    },
    
    cartAdditions: {
      type: Number,
      default: 0,
    },
    
    abandonedCartCount: {
      type: Number,
      default: 0,
    },
    
    conversionRate: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Compound index
productAnalyticsSchema.index({ shop: 1, product: 1, date: -1 });

module.exports = mongoose.model("ProductAnalytics", productAnalyticsSchema);