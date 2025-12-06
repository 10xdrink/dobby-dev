const mongoose = require("mongoose");

const upsellRuleSchema = new mongoose.Schema(
  {
    shop: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Shop", 
      required: true 
    },
    ruleName: { 
      type: String, 
      required: true 
    },
    ruleType: { 
      type: String, 
      enum: ["upsell", "cross-sell"], 
      required: true 
    },
    discountType: { 
      type: String, 
      enum: ["flat", "percentage"], 
      default: "flat" 
    },
    discountValue: { 
      type: Number, 
      default: 0 
    },
    priority: { 
      type: String, 
      enum: ["low", "medium", "high"], 
      default: "medium" 
    },
    
    // Products that will be offered as upsell/cross-sell
    offeredProducts: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Product" 
    }],
    
    // NEW: Conditions for when this rule should trigger
    conditions: {
      // Minimum cart value to show this rule
      minCartValue: { 
        type: Number, 
        default: 0 
      },
      // Maximum cart value (0 means no limit)
      maxCartValue: { 
        type: Number, 
        default: 0 
      },
      // Specific products that trigger this rule (empty = all products)
      triggerProducts: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Product" 
      }],
      // Specific categories that trigger this rule
      triggerCategories: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "ProductCategory" 
      }]
    },
    
    description: { type: String },
    
    // Rule status
    isActive: { 
      type: Boolean, 
      default: true 
    },
    
    // Analytics
    stats: {
      impressions: { type: Number, default: 0 }, // How many times shown
      conversions: { type: Number, default: 0 }, // How many times accepted
      revenue: { type: Number, default: 0 } // Total revenue generated
    }
  },
  { timestamps: true }
);

// Index for faster queries
upsellRuleSchema.index({ shop: 1, isActive: 1, priority: -1 });
upsellRuleSchema.index({ "conditions.triggerProducts": 1 });

// Calculate conversion rate
upsellRuleSchema.virtual("conversionRate").get(function() {
  if (this.stats.impressions === 0) return 0;
  return ((this.stats.conversions / this.stats.impressions) * 100).toFixed(2);
});

upsellRuleSchema.set("toJSON", { virtuals: true });
upsellRuleSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("UpsellRule", upsellRuleSchema);