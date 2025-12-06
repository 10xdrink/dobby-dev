const mongoose = require("mongoose");

const wishlistSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "customerModel",
      required: true,
      unique: true, 
    },
    customerModel: {
      type: String,
      enum: ["Customer", "Student"],
      default: "Customer",
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        addedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);


wishlistSchema.methods.hasProduct = function (productId) {
  return this.items.some((i) => i.product.toString() === productId);
};

module.exports = mongoose.model("Wishlist", wishlistSchema);
