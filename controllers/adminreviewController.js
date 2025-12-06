const Review = require("../models/Review");
const Product = require("../models/productModel");
const Customer = require("../models/Customer");


exports.getAllReviews = async (req, res) => {
  try {
    const { status, rating } = req.query;
    let filter = {};

    if (status) filter.status = status;
    if (rating) filter.rating = Number(rating);

    
    const reviews = await Review.find(filter)
      .populate("product", "productName icon1")
      .populate("customer", "firstName lastName")
      .sort({ createdAt: -1 });

    
    const statsResult = await Review.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    
    const stats = {
      pendingCount:
        statsResult.find((item) => item._id === "pending")?.count || 0,
      publishedCount:
        statsResult.find((item) => item._id === "published")?.count || 0,
      rejectedCount:
        statsResult.find((item) => item._id === "rejected")?.count || 0,
    };

    
    res.json({
      success: true,
      reviews,
      stats,
    });
  } catch (err) {
    console.error("Error in getAllReviews:", err);
    res.status(500).json({ message: err.message });
  }
};


exports.updateReviewStatus = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { status } = req.body;

    if (!["published", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const review = await Review.findById(reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });

    review.status = status;
    await review.save();

    // Update product average rating if published or rejected
    const publishedReviews = await Review.find({
      product: review.product,
      status: "published",
    });
    const avgRating =
      publishedReviews.reduce((acc, r) => acc + r.rating, 0) /
      (publishedReviews.length || 1);

    await Product.findByIdAndUpdate(review.product, {
      averageRating: avgRating ? avgRating.toFixed(1) : 0,
      reviewCount: publishedReviews.length,
    });

    res.json({ success: true, message: "Review updated", review });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

exports.getReviewbyId = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const review = await Review.findById(reviewId)
      .populate("product", "productName icon1")
      .populate("customer", "firstName lastName email");
    if (!review) return res.status(404).json({ message: "Review not found" });
    res.json({ success: true, review });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const review = await Review.findById(reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });

    await review.deleteOne();

    // Recalculate product rating after delete
    const publishedReviews = await Review.find({
      product: review.product,
      status: "published",
    });
    const avgRating =
      publishedReviews.reduce((acc, r) => acc + r.rating, 0) /
      (publishedReviews.length || 1);

    await Product.findByIdAndUpdate(review.product, {
      averageRating: avgRating ? avgRating.toFixed(1) : 0,
      reviewCount: publishedReviews.length,
    });

    res.json({ success: true, message: "Review deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
