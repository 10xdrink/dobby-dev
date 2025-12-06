const mongoose = require("mongoose");

const assurancePlusSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      default: "Assurance Plus",
    },
    description: {
      type: String,
      default: "Extended protection plan for your purchase",
    },
    price: {
      type: Number,
      required: true,
      default: 20,
    },
    image: {
      type: String,
      default: "https://res.cloudinary.com/dcvi4yizg/image/upload/v1764850165/Group_1000004853_yaabi1.png",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    features: [
      {
        type: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("AssurancePlus", assurancePlusSchema);
