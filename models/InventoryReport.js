// models/StockMovement.js
const mongoose = require("mongoose");

const stockMovementSchema = new mongoose.Schema(
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
    
    type: {
      type: String,
      enum: ["in", "out", "adjustment", "return"],
      required: true,
    },
    
    quantity: {
      type: Number,
      required: true,
    },
    
    reason: {
      type: String,
      enum: [
        "purchase",
        "sale",
        "return_from_customer",
        "return_to_supplier",
        "damage",
        "theft",
        "adjustment",
        "restock",
        "initial_stock",
        "bulk_upload"
      ],
      required: true,
    },
    
    // Reference to order if movement is due to sale
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    
    // Stock before and after movement
    previousStock: {
      type: Number,
      required: true,
    },
    
    newStock: {
      type: Number,
      required: true,
    },
    
    // Location information (for location-based turnover)
    location: {
      city: { type: String },
      state: { type: String },
      pincode: { type: String },
    },
    
    notes: {
      type: String,
      default: null,
    },
    
    // User who performed the action
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { 
    timestamps: true,
    // TTL index to auto-delete old records after 2 years
    expireAfterSeconds: 63072000, // 2 years
  }
);

// Compound indexes for efficient querying
stockMovementSchema.index({ shop: 1, createdAt: -1 });
stockMovementSchema.index({ shop: 1, product: 1, createdAt: -1 });
stockMovementSchema.index({ shop: 1, type: 1, createdAt: -1 });
stockMovementSchema.index({ createdAt: -1 });

// Static method to record stock movement
stockMovementSchema.statics.recordMovement = async function({
  shop,
  product,
  type,
  quantity,
  reason,
  order = null,
  previousStock,
  newStock,
  location = null,
  notes = null,
  performedBy = null,
}) {
  try {
    const movement = await this.create({
      shop,
      product,
      type,
      quantity: Math.abs(quantity),
      reason,
      order,
      previousStock,
      newStock,
      location,
      notes,
      performedBy,
    });
    
    return movement;
  } catch (err) {
    console.error("Error recording stock movement:", err);
    throw err;
  }
};

module.exports = mongoose.model("StockMovement", stockMovementSchema);