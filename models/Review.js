const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, refPath: "customerModel", required: true },
    customerModel: {
      type: String,
      enum: ["Customer", "Student"],
      default: "Customer",
    },
    rating: { type: Number, min: 1, max: 5, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    status: { type: String, enum: ["pending", "published", "rejected"], default: "pending" },
  },
  { timestamps: true }
);

// prevent duplicate reviews by the same customer for the same product
reviewSchema.index({ product: 1, customer: 1 }, { unique: true });

module.exports = mongoose.model("Review", reviewSchema);
