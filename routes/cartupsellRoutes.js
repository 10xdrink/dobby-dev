const express = require("express");
const { 
  getApplicableRules, 
  applyUpsell, 
  applyCrossSell,
  removeUpsell 
} = require("../controllers/cartUpsellController");
const { optionalAuth } = require("../middleware/optionalAuth");
const { invalidateCache } = require("../middleware/cacheMiddleware");

const router = express.Router();

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

router.use(optionalAuth);

// Get applicable upsell/cross-sell rules for cart
router.get("/upsell-rules", getApplicableRules);

// Apply upsell rule (replace product)
router.post("/apply-upsell", invalidateCache(invalidateUserCache), applyUpsell);

// Apply cross-sell rule (add product)
router.post("/apply-cross-sell", invalidateCache(invalidateUserCache), applyCrossSell);

// Remove upsell/cross-sell from item
router.delete("/remove-upsell/:productId", invalidateCache(invalidateUserCache), removeUpsell);

module.exports = router;