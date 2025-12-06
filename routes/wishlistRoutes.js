const { addToWishlist, getWishlist, removeFromWishlist, clearWishlist } = require("../controllers/wishlistController");
const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { cacheByUser, invalidateCache } = require("../middleware/cacheMiddleware");

const router = express.Router()

const invalidateUserCache = (req) => `user:${req.user._id}:*`;

// Wishlist routes - require authentication
router.post("/add", protect(["customer", "student"]), invalidateCache(invalidateUserCache), addToWishlist);
router.get("/", protect(["customer", "student"]), cacheByUser(), getWishlist);
router.delete("/:productId", protect(["customer", "student"]), invalidateCache(invalidateUserCache), removeFromWishlist);
router.delete("/clear/all", protect(["customer", "student"]), invalidateCache(invalidateUserCache), clearWishlist);

module.exports = router