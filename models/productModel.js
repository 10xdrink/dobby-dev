const mongoose = require("mongoose");
const Cart = require("./Cart");
const Wishlist = require("./Wishlist");
const CacheInvalidation = require("../utils/cacheInvalidation");
const logger = require("../config/logger");


const productSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      unique: true,
      
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },
    productName: { type: String, required: true },
    description: { type: String },

    
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductCategory", 
      required: true,
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductSubCategory", 
      required: true,
    },

    unit: {
      type: String,
      enum: ["piece", "kilogram", "meter", "kg"],
      required: true,
    },
    sku: { type: String, unique: true, required: true },
     searchTags: {
      type: [String],
      lowercase: true,
      index: true,
      set: (tags) =>
        Array.isArray(tags)
          ? [...new Set(tags.map((t) => t.trim().toLowerCase()))]
          : typeof tags === "string"
          ? [...new Set(tags.split(",").map((t) => t.trim().toLowerCase()))]
          : [],
    },

    // Pricing
    unitPrice: { type: Number, required: true },
    minOrderQty: { type: Number, default: 1 },
    currentStock: { type: Number, default: 0 },
    minStockQty: { type: Number, default: 0 },

    // Discount
    discountType: {
      type: String,
      enum: ["flat", "percentage"],
      default: "flat",
    },
    discountValue: { type: Number, default: 0 },

    // Tax
    taxType: {
      type: String,
      enum: ["inclusive", "exclusive"],
      default: "inclusive",
    },
    

    // Shipping
    shippingCost: { type: Number, default: 0 },

    averageRating: { type: Number, default: 0 },
reviewCount: { type: Number, default: 0 },


    // Media
    icon1: { type: String },
    icon1PublicId: { type: String },
   icon2: [{ type: String }],
icon2PublicIds: [{ type: String }],

    // Feature Images (for product detail page)
    featureImages: [
      {
        url: { type: String, required: true },
        title: { type: String, required: true },
        publicId: { type: String },
      },
    ],

    // Product-specific FAQs
    faqs: [
      {
        question: { type: String, required: true },
        answer: { type: String, required: true },
      },
    ],

    // Pricing & Discount Information
    pricingInfo: {
      description: { type: String },
      features: [
        {
          icon: { 
            type: String, 
            enum: ['package', 'ruler', 'scissors', 'wrench', 'plus-circle', 'tag', 'truck', 'shield', 'gift', 'star'],
          },
          text: { type: String },
        },
      ],
    },

    // Meta (SEO)
    metaTitle: { type: String },
    metaDescription: { type: String },
    metaImage: { type: String },
    metaImagePublicId: { type: String },

    // Status
    status: {
      type: String,
      enum: ["active", "inactive", "draft"],
      default: "draft",
    },
  },
  { timestamps: true }
);

productSchema.index(
  {
    productName: "text",
    description: "text",
    searchTags: "text",
  },
  {
    weights: {
      productName: 10,
      searchTags: 5,
      description: 2,
    },
  }
);

productSchema.virtual("finalPrice").get(function () {
  if (!this.unitPrice) return 0;
  if (this.discountType === "flat") {
    return Math.max(0, this.unitPrice - this.discountValue);
  }
  if (this.discountType === "percentage") {
    const discount = (this.unitPrice * this.discountValue) / 100;
    return Math.max(0, this.unitPrice - discount);
  }
  return this.unitPrice;
});

productSchema.virtual("priceWithTax").get(function () {
  // Calculate base price after discount only
  // Tax calculation will happen at cart/order level based on customer's region
  const basePrice =
    this.discountType === "flat"
      ? Math.max(0, this.unitPrice - this.discountValue)
      : this.discountType === "percentage"
      ? Math.max(0, this.unitPrice - (this.unitPrice * this.discountValue) / 100)
      : this.unitPrice;

  return basePrice; // Return price after discount, tax will be calculated later
});



productSchema.post("findOneAndUpdate", async function (doc) {
  if (doc && doc.status === "inactive") {
    const carts = await Cart.find({ "items.product": doc._id });
    for (const cart of carts) {
      cart.items = cart.items.filter(i => i.product.toString() !== doc._id.toString());
      cart.calculateTotal();
      await cart.save();
    }
  }
});

productSchema.post("findOneAndUpdate", async function (doc) {
  if (doc && doc.status === "inactive") {
    await Wishlist.updateMany(
      { "items.product": doc._id },
      { $pull: { items: { product: doc._id } } }
    );
  }
});

productSchema.post("save", async function (doc) {
  try {
    const CacheInvalidation = require("../utils/cacheInvalidation");
    await CacheInvalidation.invalidateProducts(doc._id);
    await CacheInvalidation.invalidateSalesReports();
    logger.debug({
      event: "PRODUCT_CACHE_INVALIDATED_ON_SAVE",
      productId: doc._id,
    });
  } catch (err) {
    logger.error({
      event: "PRODUCT_CACHE_INVALIDATION_ERROR",
      productId: doc._id,
      error: err.message,
    });
  }
});

productSchema.post("findOneAndUpdate", async function (doc) {
  try {
    const CacheInvalidation = require("../utils/cacheInvalidation");
    await CacheInvalidation.invalidateProducts(doc?._id);
    await CacheInvalidation.invalidateSalesReports();
    logger.debug({
      event: "PRODUCT_CACHE_INVALIDATED_ON_UPDATE",
      productId: doc?._id,
    });
  } catch (err) {
    logger.error({
      event: "PRODUCT_CACHE_INVALIDATION_ERROR",
      productId: doc?._id,
      error: err.message,
    });
  }
});

productSchema.post("deleteOne", { document: true }, async function (doc) {
  try {
    await CacheInvalidation.invalidateProducts(doc._id);
    await CacheInvalidation.invalidateSalesReports();
    logger.debug({
      event: "PRODUCT_CACHE_INVALIDATED_ON_DELETE",
      productId: doc._id,
    });
  } catch (err) {
    logger.error({
      event: "PRODUCT_CACHE_INVALIDATION_ERROR",
      productId: doc._id,
      error: err.message,
    });
  }
});

module.exports = mongoose.model("Product", productSchema);
