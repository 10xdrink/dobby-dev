const Cart = require("../models/Cart");
const upsellService = require("../services/upsellService");
const cartService = require("../services/cartService");
const logger = require("../config/logger");

/**
 * Get applicable upsell/cross-sell rules for current cart
 * GET /api/customer/cart/upsell-rules
 */
exports.getApplicableRules = async (req, res) => {
  try {
    const customerId = req.user?._id || null;
    const sessionId = req.query.sessionId;

    if (!sessionId && !customerId) {
      return res.status(401).json({ 
        message: "Session ID or login required" 
      });
    }

    // Get cart
    const filter = customerId ? { customer: customerId } : { sessionId };
    const cart = await Cart.findOne(filter).populate("items.product");

    if (!cart || cart.items.length === 0) {
      return res.json({
        success: true,
        rules: {},
        message: "No applicable rules (cart is empty)"
      });
    }

    // Get applicable rules
    const rules = await upsellService.getApplicableRules({ cart });

    // Track impressions for all rules
    for (const shopData of Object.values(rules)) {
      for (const rule of [...shopData.upsell, ...shopData.crossSell]) {
        await upsellService.trackImpression(rule._id);
      }
    }

    res.json({
      success: true,
      rules
    });
  } catch (err) {
    logger.error({
      event: "GET_APPLICABLE_RULES_ERROR",
      error: err.message,
      stack: err.stack
    });
    res.status(500).json({ message: err.message });
  }
};

/**
 * Apply upsell rule (replace product)
 * POST /api/customer/cart/apply-upsell
 * Body: { ruleId, selectedProductId, replacedProductId, sessionId? }
 */
exports.applyUpsell = async (req, res) => {
  try {
    const customerId = req.user?._id || null;
    const { ruleId, selectedProductId, replacedProductId, sessionId } = req.body;

    if (!sessionId && !customerId) {
      return res.status(401).json({ 
        message: "Session ID or login required" 
      });
    }

    if (!ruleId || !selectedProductId || !replacedProductId) {
      return res.status(400).json({ 
        message: "ruleId, selectedProductId, and replacedProductId are required" 
      });
    }

    // Get cart
    const filter = customerId ? { customer: customerId } : { sessionId };
    let cart = await Cart.findOne(filter).populate("items.product");

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    // Apply upsell rule
    cart = await upsellService.applyUpsellRule({
      cart,
      ruleId,
      selectedProductId,
      replacedProductId
    });

    // Recalculate cart totals
    await cartService._recalculateCart(cart);
    await cart.save();

    // Reload cart with populated data
    cart = await Cart.findById(cart._id)
      .populate("items.product")
      .populate("items.shop");

    res.json({
      success: true,
      message: "Upsell applied successfully",
      cart
    });
  } catch (err) {
    logger.error({
      event: "APPLY_UPSELL_ERROR",
      error: err.message,
      stack: err.stack
    });
    res.status(500).json({ message: err.message });
  }
};

/**
 * Apply cross-sell rule (add product)
 * POST /api/customer/cart/apply-cross-sell
 * Body: { ruleId, selectedProductId, sessionId? }
 */
exports.applyCrossSell = async (req, res) => {
  try {
    const customerId = req.user?._id || null;
    const { ruleId, selectedProductId, sessionId } = req.body;

    if (!sessionId && !customerId) {
      return res.status(401).json({ 
        message: "Session ID or login required" 
      });
    }

    if (!ruleId || !selectedProductId) {
      return res.status(400).json({ 
        message: "ruleId and selectedProductId are required" 
      });
    }

    // Get cart
    const filter = customerId ? { customer: customerId } : { sessionId };
    let cart = await Cart.findOne(filter).populate("items.product");

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    // Apply cross-sell rule
    cart = await upsellService.applyCrossSellRule({
      cart,
      ruleId,
      selectedProductId
    });

    // Recalculate cart totals
    await cartService._recalculateCart(cart);
    await cart.save();

    // Reload cart with populated data
    cart = await Cart.findById(cart._id)
      .populate("items.product")
      .populate("items.shop");

    res.json({
      success: true,
      message: "Cross-sell applied successfully",
      cart
    });
  } catch (err) {
    logger.error({
      event: "APPLY_CROSS_SELL_ERROR",
      error: err.message,
      stack: err.stack
    });
    res.status(500).json({ message: err.message });
  }
};

/**
 * Remove upsell/cross-sell from cart item
 * DELETE /api/customer/cart/remove-upsell/:productId
 */
exports.removeUpsell = async (req, res) => {
  try {
    const customerId = req.user?._id || null;
    const { productId } = req.params;
    const sessionId = req.body?.sessionId || req.query.sessionId;

    if (!sessionId && !customerId) {
      return res.status(401).json({ 
        message: "Session ID or login required" 
      });
    }

    // Get cart
    const filter = customerId ? { customer: customerId } : { sessionId };
    let cart = await Cart.findOne(filter);

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    // Find item
    const item = cart.items.find(
      i => i.product.toString() === productId.toString()
    );

    if (!item) {
      return res.status(404).json({ message: "Product not found in cart" });
    }

    // Remove upsell/cross-sell metadata
    item.upsellRuleApplied = undefined;
    item.crossSellRuleApplied = undefined;

    await cart.save();

    // Recalculate
    await cartService._recalculateCart(cart);
    await cart.save();

    // Reload
    cart = await Cart.findById(cart._id)
      .populate("items.product")
      .populate("items.shop");

    res.json({
      success: true,
      message: "Upsell/cross-sell removed",
      cart
    });
  } catch (err) {
    logger.error({
      event: "REMOVE_UPSELL_ERROR",
      error: err.message,
      stack: err.stack
    });
    res.status(500).json({ message: err.message });
  }
};