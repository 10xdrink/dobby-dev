// models/ShopAnalytics.js
const mongoose = require("mongoose");

const shopAnalyticsSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    
    // Date period for this analytics snapshot
    date: {
      type: Date,
      required: true,
      index: true,
    },
    
    periodType: {
      type: String,
      enum: ["daily", "weekly", "monthly","custom"],
      default: "daily",
      index: true,
    },
    
    // Sales metrics
    totalSales: {
      type: Number,
      default: 0,
    },
    
    totalOrders: {
      type: Number,
      default: 0,
    },
    
    averageOrderValue: {
      type: Number,
      default: 0,
    },
    
    // Conversion metrics
    totalAbandonedCarts: {
      type: Number,
      default: 0,
    },
    
    recoveredCarts: {
      type: Number,
      default: 0,
    },
    
    conversionRate: {
      type: Number,
      default: 0,
    },
    
    // Product performance
    topProducts: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        productName: String,
        category: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ProductCategory",
        },
        unitsSold: Number,
        revenue: Number,
        percentageOfSales: Number,
        currentStock: Number,
      },
    ],
    
    // Additional metrics
    totalRevenue: {
      type: Number,
      default: 0,
    },
    
    totalCustomers: {
      type: Number,
      default: 0,
    },
    
    // Comparison with previous period
    salesGrowth: {
      type: Number,
      default: 0,
    },
    
    ordersGrowth: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Compound index for efficient querying
shopAnalyticsSchema.index({ shop: 1, date: -1, periodType: 1 });

// Method to calculate conversion rate
shopAnalyticsSchema.methods.calculateConversionRate = function () {
  const totalInteractions = this.totalAbandonedCarts + this.recoveredCarts;
  if (totalInteractions === 0) return 0;
  return ((this.recoveredCarts / totalInteractions) * 100).toFixed(2);
};

// Method to calculate average order value
shopAnalyticsSchema.methods.calculateAverageOrderValue = function () {
  if (this.totalOrders === 0) return 0;
  return (this.totalSales / this.totalOrders).toFixed(2);
};

module.exports = mongoose.model("ShopAnalytics", shopAnalyticsSchema);

