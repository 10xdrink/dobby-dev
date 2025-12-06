const mongoose = require("mongoose");

const shopReviewSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    
    userId: {
      type: String, 
      required: false
    }
  },
  { timestamps: true }
);


shopReviewSchema.index({ shop: 1, createdAt: -1 });

module.exports = mongoose.model("ShopReview", shopReviewSchema);