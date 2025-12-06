const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
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
  name: { type: String, required: true },
  sku: { type: String },
  quantity: { type: Number, required: true },

  

  // Original price
  originalPrice: { type: Number, required: true },

  // Product discount (shopkeeper's discount)
  productDiscountType: {
    type: String,
    enum: ["flat", "percentage", "none"],
    default: "none",
  },
  productDiscountValue: { type: Number, default: 0 },
  productDiscountAmount: { type: Number, default: 0 },
  priceAfterProductDiscount: { type: Number, required: true },

  // Flash sale discount
  flashSale: {
    flashSaleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FlashSale",
    },
    flashSaleName: { type: String },
    discountType: { type: String, enum: ["flat", "percentage"] },
    discountValue: { type: Number },
    discountAmount: { type: Number, default: 0 },
  },
  priceAfterFlashSale: { type: Number, required: true },

  pricingRule: {
    ruleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PricingRule",
    },
    ruleName: { type: String },
    discountType: { type: String, enum: ["flat", "percentage"] },
    discountValue: { type: Number },
    discountAmount: { type: Number, default: 0 },
    customerGroup: { type: String }, 
  },
  priceAfterPricingRule: { type: Number, required: true },


  upsellCrossSell: {
    ruleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UpsellRule",
    },
    ruleName: { type: String },
    ruleType: { type: String, enum: ["upsell", "cross-sell"] },
    discountType: { type: String, enum: ["flat", "percentage"] },
    discountValue: { type: Number },
    discountAmount: { type: Number, default: 0 },
    // For upsell: track what product was replaced
    originalProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    originalProductName: { type: String },
  },
  priceAfterUpsell: { type: Number }, // Only if upsell applied


  // Tax
  taxType: {
    type: String,
    enum: ["inclusive", "exclusive"],
    default: "exclusive",
  },
  taxRate: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  region: { type: String },

  // Final pricing
  finalUnitPrice: { type: Number, required: true }, // Price per unit after all discounts + tax
  lineTotalBeforeCoupon: { type: Number, required: true }, // finalUnitPrice * quantity

  // Shipping
  shippingCost: { type: Number, default: 0 },
  allocatedShipping: { type: Number, default: 0 },
});


const shipmentSchema = new mongoose.Schema({
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
  },
  trackingId: { type: String, default: null },
  shipmentId: { type: String, default: null },
  courierName: { type: String, default: null },
  status: {
    type: String,
    enum: [
      "pending",
      "confirmed",
      "packed",
      "shipped",
      "in_transit",
      "out_for_delivery",
      "delivered",
      "cancelled",
      "return_requested",
      "returned",
      "refund_processing",
      "refunded",
      "failed",
    ],

    default: "pending",
  },

  lastUpdated: { type: Date, default: Date.now },
  lastWebhookEventId: { type: String },
  lastStatus: { type: String },
});

shipmentSchema.index({ lastUpdated: -1 });

const orderSchema = new mongoose.Schema(
  {
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

    // customerGroups: {
    //   type: [String],
    //   enum: ["retail", "wholesale", "vip"],
    //   default: ["retail"],
    // },


    // all products (can belong to multiple shops)
    items: [orderItemSchema],

    // multiple shipments — one per shop
    shipments: [shipmentSchema],

    // pricing summary
    subtotal: { type: Number, required: true },
    shipping: { type: Number, default: 0 },
    taxes: { type: Number, default: 0 },
    total: { type: Number, required: true },

    appliedCoupon: {
      couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon" },
      discountAmount: { type: Number, default: 0 },
    },

    // address & payment info
    address: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Address",
      required: true,
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    paymentMethod: {
      type: String,
      enum: ["cod", "razorpay", "stripe", "paypal"],
      default: "cod",
    },

    // root-level order status (for summary)
    // automatically synced with per-shipment statuses
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "packed",
        "shipped",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "return_requested",
        "returned",
        "refund_processing",
        "refunded",
      ],
      default: "pending",
    },

    orderNumber: {
      type: String,
      unique: true,
      required: true,
      default: function () {
        return `ORD-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
      },
    },

    trackingId: {
      type: String,
      unique: true,
      default: function () {
        return `TRK-${Date.now()}-${Math.floor(Math.random() * 99999)}`;
      },
    },

    notes: { type: String, default: null },
    cancelledAt: { type: Date },
    deliveredAt: { type: Date },
    returnedAt: { type: Date },
  },
  { timestamps: true }
);

orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ "shipments.shop": 1, createdAt: -1 });

orderSchema.index({ payment: 1 }, { unique: true, sparse: true });

// Auto sync order.status based on shipments
orderSchema.pre("save", function (next) {
  if (this.isModified("shipments") && this.shipments.length > 0) {
    const statuses = this.shipments.map((s) => s.status);

    if (statuses.every((s) => s === "delivered")) {
      this.status = "delivered";
    } else if (statuses.every((s) => s === "cancelled")) {
      this.status = "cancelled";
    } else if (statuses.includes("refund_processing")) {
      this.status = "refund_processing";
    } else if (statuses.includes("returned")) {
      this.status = "returned";
    } else if (statuses.includes("return_requested")) {
      this.status = "return_requested";
    } else if (statuses.includes("out_for_delivery")) {
      this.status = "out_for_delivery";
    } else if (statuses.includes("in_transit")) {
      this.status = "in_transit";
    } else if (statuses.includes("shipped")) {
      this.status = "shipped";
    } else if (statuses.includes("packed")) {
      this.status = "packed";
    } else if (statuses.includes("confirmed")) {
      this.status = "confirmed";
    } else {
      this.status = "pending";
    }
  }
  next();
});

module.exports = mongoose.model("Order", orderSchema);
