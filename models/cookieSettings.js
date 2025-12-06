const mongoose = require("mongoose");

const cookieSettingsSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    default: "About Dobby Mall"
  },
  isActive: {
    type: Boolean,
    default: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: true
  }
}, {
  timestamps: true
});

// Only one document should exist
cookieSettingsSchema.statics.getSetting = async function() {
  let setting = await this.findOne();
  if (!setting) {
    // Create default setting if not exists
    setting = await this.create({
      description: "About Dobby Mall",
      isActive: true,
      updatedBy: null
    });
  }
  return setting;
};

module.exports = mongoose.model("CookieSettings", cookieSettingsSchema);