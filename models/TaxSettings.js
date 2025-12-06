const mongoose = require("mongoose");

const regionalTaxRateSchema = new mongoose.Schema({
  region: {
    type: String,
    required: true,
    trim: true,
  },
  taxRate: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
});

const taxSettingsSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      unique: true,
    },
    defaultTaxRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 18,
    },
    taxCalculationMethod: {
      type: String,
      enum: ["apply_tax_to_shipping", "exclude_shipping"],
      default: "exclude_shipping",
    },
    regionalTaxRates: [regionalTaxRateSchema],
  },
  { timestamps: true }
);

// Ensure unique region per shop
taxSettingsSchema.index({ shop: 1, "regionalTaxRates.region": 1 });

module.exports = mongoose.model("TaxSettings", taxSettingsSchema);