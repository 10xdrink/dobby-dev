const PricingRule = require("../models/PricingRule");
const CustomerGroup = require("../models/CustomerGroup");
const Product = require("../models/productModel");
const logger = require("../config/logger");

class PricingRuleService {
  /**
   * Get applicable pricing rules for products in cart/order
   * @param {Array} items - Cart/order items with product and shop
   * @param {String} customerId - Customer ID
   * @returns {Object} Map of productId -> applicable pricing rule
   */
  async getApplicablePricingRules(items, customerId) {
    const context = {
      service: "PricingRuleService.getApplicablePricingRules",
      customerId: customerId?.toString(),
    };

    try {
      logger.debug({
        ...context,
        event: "GET_PRICING_RULES_START",
        itemCount: items.length,
      });

      // Get customer group
      let customerGroup = "retail"; // Default
      if (customerId) {
        const groupDoc = await CustomerGroup.findOne({ customer: customerId });
        if (groupDoc) {
          customerGroup = groupDoc.currentGroup;
        }
      }

      logger.debug({
        ...context,
        event: "CUSTOMER_GROUP_IDENTIFIED",
        customerGroup,
      });

      // Group items by shop
      const shopProducts = {};
      for (const item of items) {
        const shopId = item.shop?._id?.toString() || item.shop?.toString();
        const productId = item.product?._id?.toString() || item.product?.toString();

        if (!shopId || !productId) continue;

        if (!shopProducts[shopId]) {
          shopProducts[shopId] = [];
        }
        shopProducts[shopId].push(productId);
      }

      // Get active pricing rules for each shop
      const pricingRuleMap = {}; // productId -> rule
      const now = new Date();

      for (const [shopId, productIds] of Object.entries(shopProducts)) {
        const rules = await PricingRule.find({
          shop: shopId,
          status: "active",
          startDate: { $lte: now },
          endDate: { $gte: now },
          $or: [
            { customerGroup: "all" },
            { customerGroup: customerGroup },
          ],
          applicableProducts: { $in: productIds },
        })
          .populate("applicableProducts")
          .sort({ priority: -1, discountValue: -1 })
          .lean();

        logger.debug({
          ...context,
          event: "RULES_FOUND_FOR_SHOP",
          shopId,
          rulesCount: rules.length,
        });

        // Map rules to products (highest priority/value wins)
        for (const rule of rules) {
          for (const productId of rule.applicableProducts) {
            const prodIdStr = productId._id?.toString() || productId.toString();
            
            // Only apply if product is in cart
            if (productIds.includes(prodIdStr)) {
              // If no rule exists for this product, or this rule has higher priority
              if (!pricingRuleMap[prodIdStr]) {
                pricingRuleMap[prodIdStr] = rule;
              }
            }
          }
        }
      }

      logger.info({
        ...context,
        event: "PRICING_RULES_MAPPED",
        productsWithRules: Object.keys(pricingRuleMap).length,
        customerGroup,
      });

      return pricingRuleMap;
    } catch (err) {
      logger.error({
        ...context,
        event: "GET_PRICING_RULES_ERROR",
        error: err.message,
        stack: err.stack,
      });
      return {};
    }
  }

  /**
   * Calculate pricing rule discount for a product
   * @param {Object} rule - Pricing rule object
   * @param {Number} basePrice - Price after product discount and flash sale
   * @param {Number} quantity - Product quantity
   * @returns {Object} Discount calculation
   */
  calculatePricingRuleDiscount(rule, basePrice, quantity = 1) {
    if (!rule) {
      return {
        discountAmount: 0,
        priceAfterDiscount: basePrice,
      };
    }

    let discountAmount = 0;

    if (rule.discountType === "flat") {
      discountAmount = Math.min(rule.discountValue, basePrice);
    } else if (rule.discountType === "percentage") {
      discountAmount = (basePrice * rule.discountValue) / 100;
    }

    const priceAfterDiscount = Math.max(0, basePrice - discountAmount);

    return {
      discountAmount,
      priceAfterDiscount,
      ruleInfo: {
        ruleId: rule._id,
        ruleName: rule.ruleName,
        discountType: rule.discountType,
        discountValue: rule.discountValue,
      },
    };
  }

  /**
   * Check if cart meets minimum purchase requirement for pricing rules
   * @param {Array} items - Cart items with shop info
   * @param {String} shopId - Shop ID to check
   * @returns {Object} Shop subtotal and applicable rules
   */
  async checkMinimumPurchaseRequirement(items, shopId, customerId) {
    const context = {
      service: "PricingRuleService.checkMinimumPurchaseRequirement",
      shopId,
    };

    try {
      // Calculate shop subtotal (before pricing rules)
      const shopItems = items.filter(
        (item) =>
          (item.shop?._id?.toString() || item.shop?.toString()) === shopId
      );

      const shopSubtotal = shopItems.reduce((sum, item) => {
        return sum + (item.priceAfterFlashSale || item.basePrice || 0) * item.quantity;
      }, 0);

      // Get customer group
      let customerGroup = "retail";
      if (customerId) {
        const groupDoc = await CustomerGroup.findOne({ customer: customerId });
        if (groupDoc) {
          customerGroup = groupDoc.currentGroup;
        }
      }

      // Get rules with minimum purchase requirements
      const now = new Date();
      const rulesWithMinimum = await PricingRule.find({
        shop: shopId,
        status: "active",
        startDate: { $lte: now },
        endDate: { $gte: now },
        $or: [
          { customerGroup: "all" },
          { customerGroup: customerGroup },
        ],
        minimumPurchaseAmount: { $gt: 0 },
      }).lean();

      // Filter rules that meet minimum purchase
      const applicableRules = rulesWithMinimum.filter(
        (rule) => shopSubtotal >= rule.minimumPurchaseAmount
      );

      logger.debug({
        ...context,
        event: "MINIMUM_PURCHASE_CHECK",
        shopSubtotal,
        rulesChecked: rulesWithMinimum.length,
        rulesApplicable: applicableRules.length,
      });

      return {
        shopSubtotal,
        applicableRules,
        meetsMinimum: applicableRules.length > 0,
      };
    } catch (err) {
      logger.error({
        ...context,
        event: "MINIMUM_PURCHASE_CHECK_ERROR",
        error: err.message,
      });
      return {
        shopSubtotal: 0,
        applicableRules: [],
        meetsMinimum: false,
      };
    }
  }

  /**
   * Track pricing rule usage after order completion
   * @param {String} ruleId - Pricing rule ID
   * @param {Number} discountAmount - Discount amount given
   */
  async trackRuleUsage(ruleId, discountAmount) {
    const context = {
      service: "PricingRuleService.trackRuleUsage",
      ruleId,
    };

    try {
      await PricingRule.findByIdAndUpdate(ruleId, {
        $inc: {
          usageCount: 1,
          totalDiscountGiven: discountAmount,
        },
      });

      logger.debug({
        ...context,
        event: "RULE_USAGE_TRACKED",
        discountAmount,
      });
    } catch (err) {
      logger.error({
        ...context,
        event: "RULE_USAGE_TRACKING_ERROR",
        error: err.message,
      });
    }
  }
}

module.exports = new PricingRuleService();