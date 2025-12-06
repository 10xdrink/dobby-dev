const mongoose = require("mongoose");

const pricingRuleSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },

    ruleName: {
      type: String,
      required: true,
      trim: true,
    },

    // Discount configuration
    discountType: {
      type: String,
      enum: ["flat", "percentage"],
      required: true,
    },

    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },

    // Applicable products
    applicableProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    // Date range
    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    // Customer group targeting
    customerGroup: {
      type: String,
      enum: ["all", "retail", "wholesale", "vip"],
      required: true,
      default: "all",
    },

    // Optional minimum purchase amount
    minimumPurchaseAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Rule status
    status: {
      type: String,
      enum: ["active", "inactive", "expired"],
      default: "inactive",
    },

    // Priority (higher number = higher priority)
    priority: {
      type: Number,
      default: 0,
    },

    // Usage tracking
    usageCount: {
      type: Number,
      default: 0,
    },

    totalDiscountGiven: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
pricingRuleSchema.index({ shop: 1, status: 1 });
pricingRuleSchema.index({ shop: 1, customerGroup: 1, status: 1 });
pricingRuleSchema.index({ applicableProducts: 1, status: 1 });
pricingRuleSchema.index({ startDate: 1, endDate: 1, status: 1 });

// Pre-validate: Ensure all applicable products belong to the same shop as the pricing rule
pricingRuleSchema.pre("validate", async function(next) {
  if (!this.isModified("applicableProducts") && !this.isModified("shop")) {
    return next();
  }
  
  const ids = this.applicableProducts || [];
  if (ids.length === 0) {
    return next();
  }
  
  try {
    const Product = this.model("Product");
    const count = await Product.countDocuments({
      _id: { $in: ids },
      shop: this.shop
    });
    
    if (count !== ids.length) {
      return next(new Error("All pricing rule products must belong to your shop"));
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Validation: startDate must be before endDate
pricingRuleSchema.pre("save", function (next) {
  if (this.startDate >= this.endDate) {
    return next(new Error("Start date must be before end date"));
  }

  // Validate discount value
  if (this.discountType === "percentage" && this.discountValue > 100) {
    return next(new Error("Percentage discount cannot exceed 100%"));
  }

  next();
});

// Method to check if rule is currently valid
pricingRuleSchema.methods.isCurrentlyValid = function () {
  const now = new Date();
  return (
    this.status === "active" &&
    now >= this.startDate &&
    now <= this.endDate
  );
};

// Method to check if rule applies to a customer group
pricingRuleSchema.methods.appliesToCustomerGroup = function (customerGroup) {
  if (this.customerGroup === "all") return true;
  return this.customerGroup === customerGroup;
};

// Method to calculate discount amount for a given price
pricingRuleSchema.methods.calculateDiscount = function (price) {
  if (this.discountType === "flat") {
    return Math.min(this.discountValue, price);
  } else if (this.discountType === "percentage") {
    return (price * this.discountValue) / 100;
  }
  return 0;
};

// Static method to get active rules for a shop
pricingRuleSchema.statics.getActiveRulesForShop = async function (
  shopId,
  customerGroup = "all"
) {
  const now = new Date();
  
  const query = {
    shop: shopId,
    status: "active",
    startDate: { $lte: now },
    endDate: { $gte: now },
  };

  // If customer has a specific group, get rules for that group + "all" rules
  if (customerGroup && customerGroup !== "all") {
    query.customerGroup = { $in: [customerGroup, "all"] };
  }

  return this.find(query)
    .populate("applicableProducts", "productName unitPrice")
    .sort({ priority: -1, createdAt: -1 });
};

// Static method to auto-expire rules
pricingRuleSchema.statics.autoExpireRules = async function () {
  const now = new Date();
  
  const result = await this.updateMany(
    {
      status: "active",
      endDate: { $lt: now },
    },
    {
      $set: { status: "expired" },
    }
  );

  return result;
};

// Static method to auto-activate rules
pricingRuleSchema.statics.autoActivateRules = async function () {
  const now = new Date();
  
  const result = await this.updateMany(
    {
      status: "inactive",
      startDate: { $lte: now },
      endDate: { $gte: now },
    },
    {
      $set: { status: "active" },
    }
  );

  return result;
};

module.exports = mongoose.model("PricingRule", pricingRuleSchema);