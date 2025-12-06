const mongoose = require("mongoose");

const InventoryAlertSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  productName: { type: String, required: true },
  currentStock: { type: Number, required: true },
  minStockQty: { type: Number, required: true },
  type: { type: String, enum: ["low_stock", "out_of_stock"], required: true },
  message: { type: String },
  actionType: { type: String, enum: ["Reorder", "Restock"] },
  seen: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("InventoryAlert", InventoryAlertSchema);
