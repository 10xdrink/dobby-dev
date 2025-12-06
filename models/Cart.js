const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },

  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
  },

  quantity: { type: Number, min: 1, default: 1 },

  priceAtAddition: { type: Number, required: true },
  flashSaleSnapshot: {
    type: {
      flashSaleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FlashSale",
      },
      flashSaleName: { type: String },
      discountType: { type: String, enum: ["flat", "percentage"] },
      discountValue: { type: Number },
      addedAt: { type: Date, default: Date.now },
    },
    default: undefined
  },
  // NEW: Upsell rule applied to this item
  upsellRuleApplied: {
    type: {
      ruleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "UpsellRule",
      },
      ruleName: { type: String },
      discountType: { type: String, enum: ["flat", "percentage"] },
      discountValue: { type: Number },
      originalProductId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      }, // Product that was replaced
      appliedAt: { type: Date, default: Date.now },
    },
    default: undefined
  },

  // NEW: Cross-sell rule applied to this item
  crossSellRuleApplied: {
    type: {
      ruleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "UpsellRule",
      },
      ruleName: { type: String },
      discountType: { type: String, enum: ["flat", "percentage"] },
      discountValue: { type: Number },
      appliedAt: { type: Date, default: Date.now },
    },
    default: undefined
  },
});

const cartSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "customerModel",
      default: null,
    },
    customerModel: {
      type: String,
      enum: ["Customer", "Student"],
      default: "Customer",
    },
    sessionId: { type: String, default: null }, // guest cart
    items: [cartItemSchema],
    totalAmount: { type: Number, default: 0 },
    // Total shipping amount
    shippingAmount: {
      type: Number,
      default: 0,
    },

    couponDiscount: { type: Number, default: 0 },

    // ADDED: Applied coupon details
    appliedCoupon: {
      couponId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Coupon",
      },
      code: String,
      shop: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Shop",
      },
      discountType: {
        type: String,
        enum: ["flat", "percentage"],
      },
      discountValue: Number,
      discountAmount: Number,
    },

    // Detailed shipping breakdown by shop
    shippingBreakdown: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    itemsWithTax: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    
    // Assurance Plus (optional protection plan)
    assurancePlus: {
      isSelected: {
        type: Boolean,
        default: false,
      },
      price: {
        type: Number,
        default: 0,
      },
      name: {
        type: String,
        default: "Assurance Plus",
      },
      image: {
        type: String,
        default: "https://res.cloudinary.com/dcvi4yizg/image/upload/v1764850165/Group_1000004853_yaabi1.png",
      },
    },
  },
  { timestamps: true }
);

// Virtual for grand total (items + shipping + assurance plus)
cartSchema.virtual("grandTotal").get(function () {
  const assurancePlusAmount = this.assurancePlus?.isSelected ? (this.assurancePlus.price || 0) : 0;
  return this.totalAmount + (this.shippingAmount || 0) + assurancePlusAmount;
});

// Ensure virtuals are included in JSON/Object
cartSchema.set("toJSON", { virtuals: true });
cartSchema.set("toObject", { virtuals: true });

cartSchema.methods.calculateTotal = function () {
  this.totalAmount = this.items.reduce(
    (acc, i) => acc + i.priceAtAddition * i.quantity,
    0
  );
};

module.exports = mongoose.model("Cart", cartSchema);
