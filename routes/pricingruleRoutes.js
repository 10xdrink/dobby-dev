const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const checkActiveShop = require("../middleware/checkActiveShop");
const pricingRuleController = require("../controllers/pricingruleController");

// All routes require shopkeeper authentication and active shop
router.use(protect(["shopkeeper"]), checkActiveShop);

/**
 * @route   POST /api/shopkeeper/pricing-rules
 * @desc    Create new pricing rule
 * @access  Private (Shopkeeper)
 */
router.post("/", pricingRuleController.createPricingRule);

/**
 * @route   GET /api/shopkeeper/pricing-rules
 * @desc    Get all pricing rules for shop
 * @access  Private (Shopkeeper)
 */
router.get("/", pricingRuleController.getPricingRules);

/**
 * @route   GET /api/shopkeeper/pricing-rules/:id
 * @desc    Get single pricing rule by ID
 * @access  Private (Shopkeeper)
 */
router.get("/:id", pricingRuleController.getPricingRuleById);

/**
 * @route   PUT /api/shopkeeper/pricing-rules/:id
 * @desc    Update pricing rule
 * @access  Private (Shopkeeper)
 */
router.put("/:id", pricingRuleController.updatePricingRule);

/**
 * @route   DELETE /api/shopkeeper/pricing-rules/:id
 * @desc    Delete pricing rule
 * @access  Private (Shopkeeper)
 */
router.delete("/:id", pricingRuleController.deletePricingRule);

/**
 * @route   PATCH /api/shopkeeper/pricing-rules/:id/toggle
 * @desc    Toggle pricing rule status (active/inactive)
 * @access  Private (Shopkeeper)
 */
router.patch("/:id/toggle", pricingRuleController.togglePricingRuleStatus);

/**
 * @route   GET /api/shopkeeper/pricing-rules/:id/stats
 * @desc    Get pricing rule usage statistics
 * @access  Private (Shopkeeper)
 */
router.get("/:id/stats", pricingRuleController.getPricingRuleStats);

/**
 * @route   POST /api/shopkeeper/pricing-rules/:id/duplicate
 * @desc    Duplicate pricing rule (simple copy)
 * @access  Private (Shopkeeper)
 */
router.post("/:id/duplicate", pricingRuleController.duplicatePricingRule);

/**
 * @route   POST /api/shopkeeper/pricing-rules/:id/duplicate-custom
 * @desc    Duplicate pricing rule with custom settings
 * @access  Private (Shopkeeper)
 */
router.post("/:id/duplicate-custom", pricingRuleController.duplicatePricingRuleCustom);

module.exports = router;