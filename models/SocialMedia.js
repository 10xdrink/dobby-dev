const mongoose = require("mongoose");

const socialMediaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: ["Facebook", "Instagram", "YouTube", "X", "LinkedIn"],
      required: true,
    },
    link: {
      type: String,
      required: true,
    },
  
    iconUrl: {
      type: String, 
    },
    iconPublicId: {
      type: String, 
    },
    status: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SocialMedia", socialMediaSchema);
