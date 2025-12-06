const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
  },
  
  name: {
    type: String,
    required: true,
    trim: true,
  },
  
  code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true,
  },
  
  type: {
    type: String,
    enum: ["promotional", "occasional"],
    required: true,
  },
  
  description: {
    type: String,
    default: "",
  },
  
  value: {
    type: Number,
    required: true,
    min: 0,
  },
  
  discountType: {
    type: String,
    enum: ["flat", "percentage"],
    default: "flat",
  },
  
  startDate: {
    type: Date,
    required: true,
  },
  
  endDate: {
    type: Date,
    required: true,
    validate: {
      validator: function (value) {
        return value > this.startDate;
      },
      message: "End date must be after start date",
    },
  },
  
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },
  
  usageCount: {
    type: Number,
    default: 0,
  },
  
  usedBy: [{
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "usedBy.customerModel",
    },
    customerModel: {
      type: String,
      enum: ["Customer", "Student"],
      default: "Customer",
    },
    usedAt: {
      type: Date,
      default: Date.now,
    },
    orderAmount: Number,
    discountAmount: Number,
  }],
  
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index: code must be unique per shop
couponSchema.index({ code: 1, shop: 1 }, { unique: true });

// Auto-deactivate expired coupons
couponSchema.pre("save", function (next) {
  const now = new Date();
  if (this.endDate < now && this.status === "active") {
    this.status = "inactive";
  }
  next();
});

module.exports = mongoose.model("Coupon", couponSchema);