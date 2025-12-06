const mongoose = require("mongoose");

const paymentSettingsSchema = new mongoose.Schema(
  {
    digitalPaymentEnabled: {
      type: Boolean,
      default: true,
    },
    cashOnDeliveryEnabled: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Ensure only one settings document exists
paymentSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({
      digitalPaymentEnabled: true,
      cashOnDeliveryEnabled: true,
    });
  }
  return settings;
};

module.exports = mongoose.model("PaymentSettings", paymentSettingsSchema);

