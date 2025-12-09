const cartService = require("../services/cartService");
const { successResponse, errorResponse } = require("../utils/responseHandler");
const logger = require("../config/logger");

exports.addToCart = async (req, res) => {
  try {
    const cart = await cartService.addToCart(req);
    successResponse(res, cart);
  } catch (err) {
    errorResponse(res, err);
  }
};

exports.getCart = async (req, res) => {
  const startTime = Date.now();
  const customerId = req.user?._id;

  try {
    logger.info({
      event: "GET_CART_START",
      customerId: customerId?.toString() || "guest",
      sessionId: req.query.sessionId,
    });

    const cart = await cartService.getCart(req);

    // Calculate discount summary for display
    let totalProductDiscounts = 0;
    let totalFlashSaleDiscounts = 0;
    let totalPricingRuleDiscounts = 0;
    let totalUpsellDiscounts = 0;
    let totalTaxAmount = 0;
    let originalTotal = 0;

    if (cart.itemsWithTax && cart.itemsWithTax.length > 0) {
      cart.itemsWithTax.forEach((item) => {
        originalTotal += item.originalPrice * item.quantity;
        totalProductDiscounts += (item.productDiscount || 0) * item.quantity;
        totalFlashSaleDiscounts +=
          (item.flashSaleDiscount || 0) * item.quantity;
        totalPricingRuleDiscounts +=
          (item.pricingRuleDiscount || 0) * item.quantity; // NEW
        totalUpsellDiscounts += (item.upsellDiscount || 0) * item.quantity;
        totalTaxAmount += (item.taxAmount || 0) * item.quantity;
      });
    }

    const response = {
      items: cart.items, // Basic items with product refs
      itemsWithTax: cart.itemsWithTax, // Detailed breakdown for each item

      // Pricing summary
      originalTotal: originalTotal, // Total before any discounts
      totalAmount: cart.totalAmount, // Subtotal after all discounts (before shipping)
      shippingAmount: cart.shippingAmount,
      shippingBreakdown: cart.shippingBreakdown,

      // Discount breakdown (UPDATED WITH PRICING RULES)
      discountBreakdown: {
        productDiscounts: totalProductDiscounts,
        flashSaleDiscounts: totalFlashSaleDiscounts,
        pricingRuleDiscounts: totalPricingRuleDiscounts, // NEW
        upsellDiscounts: totalUpsellDiscounts,
        couponDiscount: cart.couponDiscount || 0,
        totalDiscounts:
          totalProductDiscounts +
          totalFlashSaleDiscounts +
          totalPricingRuleDiscounts +
          totalUpsellDiscounts +
          (cart.couponDiscount || 0),
      },

      // Tax summary
      totalTax: totalTaxAmount,

      // Coupon info
      couponDiscount: cart.couponDiscount || 0,
      appliedCoupon:
        cart.appliedCoupon && cart.appliedCoupon.couponId
          ? cart.appliedCoupon
          : null,

      // Grand total
      grandTotal: cart.grandTotal,

      // Savings summary
      totalSavings: originalTotal - cart.totalAmount, // How much customer saved
    };

    const duration = Date.now() - startTime;

    logger.info({
      event: "GET_CART_SUCCESS",
      customerId: customerId?.toString() || "guest",
      itemCount: cart.items.length,
      originalTotal,
      discounts: response.discountBreakdown,
      grandTotal: cart.grandTotal,
      duration: `${duration}ms`,
    });

    successResponse(res, response);
  } catch (err) {
    const duration = Date.now() - startTime;

    logger.error({
      event: "GET_CART_ERROR",
      customerId: customerId?.toString() || "guest",
      error: err.message,
      stack: err.stack,
      duration: `${duration}ms`,
    });

    errorResponse(res, err);
  }
};

exports.updateCartItemQuantity = async (req, res) => {
  try {
    const cart = await cartService.updateCartItemQuantity(req);
    successResponse(res, cart);
  } catch (err) {
    errorResponse(res, err);
  }
};

exports.removeFromCart = async (req, res) => {
  try {
    const cart = await cartService.removeFromCart(req);
    successResponse(res, cart);
  } catch (err) {
    errorResponse(res, err);
  }
};

exports.applyCoupon = async (req, res) => {
  try {
    const cart = await cartService.applyCoupon({
      user: req.user,
      body: req.body,
    });
    
    // Calculate discount summary for display (same as getCart)
    let totalProductDiscounts = 0;
    let totalFlashSaleDiscounts = 0;
    let totalPricingRuleDiscounts = 0;
    let totalUpsellDiscounts = 0;
    let totalTaxAmount = 0;
    let originalTotal = 0;

    if (cart.itemsWithTax && cart.itemsWithTax.length > 0) {
      cart.itemsWithTax.forEach((item) => {
        originalTotal += item.originalPrice * item.quantity;
        totalProductDiscounts += (item.productDiscount || 0) * item.quantity;
        totalFlashSaleDiscounts += (item.flashSaleDiscount || 0) * item.quantity;
        totalPricingRuleDiscounts += (item.pricingRuleDiscount || 0) * item.quantity;
        totalUpsellDiscounts += (item.upsellDiscount || 0) * item.quantity;
        totalTaxAmount += (item.taxAmount || 0) * item.quantity;
      });
    }

    const response = {
      items: cart.items,
      itemsWithTax: cart.itemsWithTax,
      originalTotal: originalTotal,
      totalAmount: cart.totalAmount,
      shippingAmount: cart.shippingAmount,
      shippingBreakdown: cart.shippingBreakdown,
      discountBreakdown: {
        productDiscounts: totalProductDiscounts,
        flashSaleDiscounts: totalFlashSaleDiscounts,
        pricingRuleDiscounts: totalPricingRuleDiscounts,
        upsellDiscounts: totalUpsellDiscounts,
        couponDiscount: cart.couponDiscount || 0,
        totalDiscounts:
          totalProductDiscounts +
          totalFlashSaleDiscounts +
          totalPricingRuleDiscounts +
          totalUpsellDiscounts +
          (cart.couponDiscount || 0),
      },
      totalTax: totalTaxAmount,
      couponDiscount: cart.couponDiscount || 0,
      appliedCoupon: cart.appliedCoupon && cart.appliedCoupon.couponId ? cart.appliedCoupon : null,
      grandTotal: cart.grandTotal,
      totalSavings: originalTotal - cart.totalAmount,
    };

    successResponse(res, response, "Coupon applied successfully");
  } catch (err) {
    errorResponse(res, err);
  }
};

exports.removeCoupon = async (req, res) => {
  try {
    const cart = await cartService.removeCoupon({
      user: req.user,
    });
    
    // Calculate discount summary for display (same as getCart)
    let totalProductDiscounts = 0;
    let totalFlashSaleDiscounts = 0;
    let totalPricingRuleDiscounts = 0;
    let totalUpsellDiscounts = 0;
    let totalTaxAmount = 0;
    let originalTotal = 0;

    if (cart.itemsWithTax && cart.itemsWithTax.length > 0) {
      cart.itemsWithTax.forEach((item) => {
        originalTotal += item.originalPrice * item.quantity;
        totalProductDiscounts += (item.productDiscount || 0) * item.quantity;
        totalFlashSaleDiscounts += (item.flashSaleDiscount || 0) * item.quantity;
        totalPricingRuleDiscounts += (item.pricingRuleDiscount || 0) * item.quantity;
        totalUpsellDiscounts += (item.upsellDiscount || 0) * item.quantity;
        totalTaxAmount += (item.taxAmount || 0) * item.quantity;
      });
    }

    const response = {
      items: cart.items,
      itemsWithTax: cart.itemsWithTax,
      originalTotal: originalTotal,
      totalAmount: cart.totalAmount,
      shippingAmount: cart.shippingAmount,
      shippingBreakdown: cart.shippingBreakdown,
      discountBreakdown: {
        productDiscounts: totalProductDiscounts,
        flashSaleDiscounts: totalFlashSaleDiscounts,
        pricingRuleDiscounts: totalPricingRuleDiscounts,
        upsellDiscounts: totalUpsellDiscounts,
        couponDiscount: cart.couponDiscount || 0,
        totalDiscounts:
          totalProductDiscounts +
          totalFlashSaleDiscounts +
          totalPricingRuleDiscounts +
          totalUpsellDiscounts +
          (cart.couponDiscount || 0),
      },
      totalTax: totalTaxAmount,
      couponDiscount: cart.couponDiscount || 0,
      appliedCoupon: null, // Coupon was removed
      grandTotal: cart.grandTotal,
      totalSavings: originalTotal - cart.totalAmount,
    };

    successResponse(res, response);
  } catch (err) {
    errorResponse(res, err);
  }
};

exports.mergeGuestCart = async (req, res) => {
  try {
    const cart = await cartService.mergeGuestCart(req);
    successResponse(res, cart);
  } catch (err) {
    errorResponse(res, err);
  }
};

exports.clearCart = async (req, res) => {
  try {
    const cart = await cartService.clearCart(req);
    successResponse(res, { message: "Cart cleared successfully", cart });
  } catch (err) {
    errorResponse(res, err);
  }
};

