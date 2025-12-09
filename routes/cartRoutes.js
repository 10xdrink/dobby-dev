const express = require("express")
const { addToCart, getCart, removeFromCart, mergeGuestCart, updateCartItemQuantity, applyCoupon, removeCoupon, clearCart } = require("../controllers/cartController")
const { protect } = require("../middleware/authMiddleware")
const { optionalAuth } = require("../middleware/optionalAuth")
const { cacheByUser, invalidateCache } = require("../middleware/cacheMiddleware");

const router = express.Router()

const invalidateUserCache = (req) => {
  if (req.user?._id) {
    return `user:${req.user._id}:*`;
  }
  const sessionId = req.query.sessionId || req.body.sessionId;
  if (sessionId) {
    return `user:guest:*${sessionId}*`;
  }
  return null;
};

router.use(optionalAuth)

router.post("/", invalidateCache(invalidateUserCache), addToCart)
router.get("/", cacheByUser(), getCart)
router.patch("/:productId/quantity", invalidateCache(invalidateUserCache), updateCartItemQuantity)
router.delete("/:productId", invalidateCache(invalidateUserCache), removeFromCart)

router.post("/apply-coupon", protect(["customer", "student"]), invalidateCache(invalidateUserCache), applyCoupon);
router.delete("/remove-coupon", protect(["customer", "student"]), invalidateCache(invalidateUserCache), removeCoupon);
router.post("/merge", protect(["customer", "student"]), invalidateCache(invalidateUserCache), mergeGuestCart)
router.delete("/", invalidateCache(invalidateUserCache), clearCart)

module.exports = router