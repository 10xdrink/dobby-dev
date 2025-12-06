const mongoose = require("mongoose");

const trustedLogoSchema = new mongoose.Schema(
  {
    imageUrl: {
      type: String,
      required: true,
    },
    imagePublicId: {
      type: String,
      required: true,
    },
    published: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TrustedLogo", trustedLogoSchema);
