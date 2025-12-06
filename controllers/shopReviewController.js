// controllers/reviewController.js
const ShopReview = require("../models/ShopReview");
const Shop = require("../models/Shop");

// Add Review
const addShopReview = async (req, res) => {
  try {
    const { shopId, rating } = req.body;

    // Validation
    if (!shopId || !rating) {
      return res.status(400).json({ 
        message: "Shop ID and rating are required" 
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ 
        message: "Rating must be between 1 and 5" 
      });
    }

    // Check if shop exists
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    // Create review
    const review = await ShopReview.create({
      shop: shopId,
      rating: parseInt(rating)
    });

    // Calculate new average rating
    const reviews = await ShopReview.find({ shop: shopId });
    const totalReviews = reviews.length;
    const sumRatings = reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = (sumRatings / totalReviews).toFixed(1);

    // Update shop
    await Shop.findByIdAndUpdate(shopId, {
      averageRating: parseFloat(averageRating),
      totalReviews: totalReviews
    });

    res.status(201).json({
      success: true,
      message: "Review added successfully",
      review,
      averageRating: parseFloat(averageRating),
      totalReviews
    });

  } catch (error) {
    console.error("Add Review Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get Shop Reviews
const getShopReviews = async (req, res) => {
  try {
    const { shopId } = req.params;

    const shop = await Shop.findById(shopId)
      .select("shopName averageRating totalReviews");

    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    const reviews = await ShopReview.find({ shop: shopId })
      .sort({ createdAt: -1 })
      .limit(100); // Last 100 reviews

    // Rating distribution
    const distribution = {
      5: reviews.filter(r => r.rating === 5).length,
      4: reviews.filter(r => r.rating === 4).length,
      3: reviews.filter(r => r.rating === 3).length,
      2: reviews.filter(r => r.rating === 2).length,
      1: reviews.filter(r => r.rating === 1).length,
    };

    res.status(200).json({
      success: true,
      shop: {
        name: shop.shopName,
        averageRating: shop.averageRating,
        totalReviews: shop.totalReviews
      },
      distribution,
      reviews
    });

  } catch (error) {
    console.error("Get Reviews Error:", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  addShopReview,
  getShopReviews
};