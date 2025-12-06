const mongoose = require("mongoose");

const flashSaleSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: [true, "Flash sale name is required"],
      trim: true 
    },

    startDate: { 
      type: Date, 
      required: [true, "Start date is required"],
      index: true
    },
    
    endDate: { 
      type: Date, 
      required: [true, "End date is required"],
      index: true,
      validate: {
        validator: function(value) {
          return value > this.startDate;
        },
        message: "End date must be after start date"
      }
    },

    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: [true, "Shop is required"],
      index: true
    },

    discountType: {
      type: String,
      enum: {
        values: ["flat", "percentage"],
        message: "Discount type must be flat or percentage"
      },
      required: [true, "Discount type is required"]
    },

    discountValue: { 
      type: Number, 
      required: [true, "Discount value is required"],
      min: [0, "Discount value cannot be negative"],
      validate: {
        validator: function(value) {
          if (this.discountType === "percentage") {
            return value >= 0 && value <= 100;
          }
          return value >= 0;
        },
        message: "Percentage discount must be between 0 and 100"
      }
    },

    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
    ],

    promotionalBanner: { type: String },
    promotionalBannerPublicId: { type: String },

    description: { type: String, default: "" },

    status: {
      type: String,
      enum: {
        values: ["scheduled", "active", "expired", "manually_deactivated"],
        message: "Invalid status"
      },
      default: "scheduled",
      index: true
    },

    // Track deactivation
    deactivatedAt: { type: Date },
    deactivatedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    },
    deactivationReason: { 
      type: String,
      enum: ["manual", "expired", "system"],
      default: "system"
    },

    createdAt: { type: Date, default: Date.now },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound index for efficient queries
flashSaleSchema.index({ shop: 1, status: 1, endDate: -1 });
flashSaleSchema.index({ status: 1, startDate: 1, endDate: 1 });
flashSaleSchema.index({ products: 1, status: 1 });

// Virtual: Check if flash sale is currently active
flashSaleSchema.virtual("isActive").get(function() {
  const now = new Date();
  return (
    this.status === "active" &&
    this.startDate <= now &&
    this.endDate >= now
  );
});

// Virtual: Time remaining in milliseconds
flashSaleSchema.virtual("timeRemaining").get(function() {
  const now = new Date();
  if (this.endDate <= now) return 0;
  return this.endDate - now;
});

// Pre-validate: Ensure all products belong to the same shop as the flash sale
flashSaleSchema.pre("validate", async function(next) {
  if (!this.isModified("products") && !this.isModified("shop")) {
    return next();
  }
  
  if (!this.products || this.products.length === 0) {
    return next();
  }
  
  try {
    const Product = this.model("Product");
    const count = await Product.countDocuments({
      _id: { $in: this.products },
      shop: this.shop
    });
    
    if (count !== this.products.length) {
      return next(new Error("All flash sale products must belong to your shop"));
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Pre-save hook: Auto-update status based on dates
flashSaleSchema.pre("save", function(next) {
  // Skip if manually deactivated
  if (this.status === "manually_deactivated") {
    return next();
  }

  const now = new Date();
  
  // Scheduled: Not started yet
  if (now < this.startDate) {
    this.status = "scheduled";
  } 
  // Active: Within start and end date
  else if (now >= this.startDate && now <= this.endDate) {
    this.status = "active";
  } 
  // Expired: Past end date
  else if (now > this.endDate) {
    this.status = "expired";
    if (!this.deactivatedAt) {
      this.deactivatedAt = now;
      this.deactivationReason = "expired";
    }
  }
  
  next();
});

// Static method: Find active flash sales for products
flashSaleSchema.statics.findActiveForProducts = async function(productIds) {
  const now = new Date();
  return this.find({
    products: { $in: productIds },
    status: "active",
    startDate: { $lte: now },
    endDate: { $gte: now },
  });
};

// Static method: Find active flash sales for a shop
flashSaleSchema.statics.findActiveForShop = async function(shopId) {
  const now = new Date();
  return this.find({
    shop: shopId,
    status: "active",
    startDate: { $lte: now },
    endDate: { $gte: now },
  });
};

// Instance method: Manually deactivate
flashSaleSchema.methods.deactivateManually = async function(userId) {
  this.status = "manually_deactivated";
  this.deactivatedAt = new Date();
  this.deactivatedBy = userId;
  this.deactivationReason = "manual";
  await this.save();
};

module.exports = mongoose.model("FlashSale", flashSaleSchema);