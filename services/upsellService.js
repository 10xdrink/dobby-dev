const UpsellRule = require("../models/upsellRule");
const Product = require("../models/productModel");
const Cart = require("../models/Cart");
const logger = require("../config/logger");

class UpsellService {
  /**
   * Get applicable upsell/cross-sell rules for a cart
   * Priority: high → medium → low
   * Only returns rules from shops that have products in cart
   */
  async getApplicableRules({ cart, productId = null }) {
    try {
      logger.debug({
        event: "GET_APPLICABLE_RULES_START",
        cartId: cart._id,
        itemCount: cart.items.length,
        productId
      });

      // Get all shop IDs from cart items
      const shopIds = [...new Set(cart.items.map(item => 
        item.shop?._id?.toString() || item.shop?.toString()
      ))];

      if (shopIds.length === 0) {
        return [];
      }

      // Calculate cart total
      const cartTotal = cart.totalAmount || 0;

      // Build query
      const query = {
        shop: { $in: shopIds },
        isActive: true,
        "conditions.minCartValue": { $lte: cartTotal }
      };

      // If maxCartValue is set, apply it
      query.$or = [
        { "conditions.maxCartValue": 0 }, // No max limit
        { "conditions.maxCartValue": { $gte: cartTotal } }
      ];

      // If specific product triggers, add condition
      if (productId) {
        query.$and = [
          {
            $or: [
              { "conditions.triggerProducts": [] }, // No specific triggers
              { "conditions.triggerProducts": productId }
            ]
          }
        ];
      }

      // Fetch rules sorted by priority
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      
      let rules = await UpsellRule.find(query)
        .populate("offeredProducts", "productName unitPrice icon1 discountType discountValue")
        .populate("shop", "shopName")
        .lean();

      // Sort by priority (high first)
      rules.sort((a, b) => 
        priorityOrder[b.priority] - priorityOrder[a.priority]
      );

      // Group by shop and rule type
      const rulesByShop = {};
      
      for (const rule of rules) {
        const shopId = rule.shop._id.toString();
        
        if (!rulesByShop[shopId]) {
          rulesByShop[shopId] = {
            shopId,
            shopName: rule.shop.shopName,
            upsell: [],
            crossSell: []
          };
        }

        // Calculate final prices with upsell/cross-sell discount
        const enrichedProducts = rule.offeredProducts.map(product => {
          let basePrice = product.unitPrice;

          // Apply product's own discount first
          if (product.discountType === "flat") {
            basePrice = Math.max(0, basePrice - (product.discountValue || 0));
          } else if (product.discountType === "percentage") {
            basePrice = Math.max(0, basePrice - (basePrice * (product.discountValue || 0) / 100));
          }

          // Apply upsell/cross-sell discount
          let finalPrice = basePrice;
          if (rule.discountType === "flat") {
            finalPrice = Math.max(0, basePrice - rule.discountValue);
          } else if (rule.discountType === "percentage") {
            finalPrice = Math.max(0, basePrice - (basePrice * rule.discountValue / 100));
          }

          return {
            ...product,
            basePrice,
            upsellFinalPrice: finalPrice,
            upsellDiscount: basePrice - finalPrice,
            upsellDiscountType: rule.discountType,
            upsellDiscountValue: rule.discountValue
          };
        });

        const enrichedRule = {
          ...rule,
          offeredProducts: enrichedProducts
        };

        if (rule.ruleType === "upsell") {
          rulesByShop[shopId].upsell.push(enrichedRule);
        } else {
          rulesByShop[shopId].crossSell.push(enrichedRule);
        }
      }

      logger.info({
        event: "GET_APPLICABLE_RULES_SUCCESS",
        shopCount: Object.keys(rulesByShop).length,
        totalRules: rules.length
      });

      return rulesByShop;
    } catch (err) {
      logger.error({
        event: "GET_APPLICABLE_RULES_ERROR",
        error: err.message,
        stack: err.stack
      });
      throw err;
    }
  }

  /**
   * Apply upsell rule - Replace current product with upsell product
   */
  async applyUpsellRule({ cart, ruleId, selectedProductId, replacedProductId }) {
    try {
      logger.info({
        event: "APPLY_UPSELL_START",
        cartId: cart._id,
        ruleId,
        selectedProductId,
        replacedProductId
      });

      const rule = await UpsellRule.findById(ruleId).populate("offeredProducts shop");
      
      if (!rule || !rule.isActive) {
        throw new Error("Rule not found or inactive");
      }

      if (rule.ruleType !== "upsell") {
        throw new Error("This is not an upsell rule");
      }

      // Verify selected product is in offered products
      const selectedProduct = rule.offeredProducts.find(
        p => p._id.toString() === selectedProductId.toString()
      );

      if (!selectedProduct) {
        throw new Error("Selected product not in this rule");
      }

      // Find item to replace in cart
      const itemIndex = cart.items.findIndex(
        item => {
          // Handle case where product might be populated or not, or null (deleted)
          if (!item) return false;
          
          // Check by Product ID
          const productId = item.product?._id || item.product;
          if (productId && productId.toString() === replacedProductId.toString()) {
            return true;
          }
          
          // Fallback: Check by Cart Item ID (in case frontend sent item ID)
          if (item._id && item._id.toString() === replacedProductId.toString()) {
            return true;
          }
          
          return false;
        }
      );

      if (itemIndex === -1) {
        const availableIds = cart.items.map(i => {
          const pid = i.product?._id || i.product;
          return pid ? pid.toString() : 'null';
        }).join(', ');
        
        throw new Error(`Product to replace not found in cart. Looking for: ${replacedProductId}. Available in cart: ${availableIds}`);
      }

      const replacedItem = cart.items[itemIndex];
      const quantity = replacedItem.quantity;

      // Calculate price with upsell discount
      let basePrice = selectedProduct.unitPrice;

      // Apply product's own discount
      if (selectedProduct.discountType === "flat") {
        basePrice = Math.max(0, basePrice - (selectedProduct.discountValue || 0));
      } else if (selectedProduct.discountType === "percentage") {
        basePrice = Math.max(0, basePrice - (basePrice * (selectedProduct.discountValue || 0) / 100));
      }

      // Apply upsell discount
      let finalPrice = basePrice;
      if (rule.discountType === "flat") {
        finalPrice = Math.max(0, basePrice - rule.discountValue);
      } else if (rule.discountType === "percentage") {
        finalPrice = Math.max(0, basePrice - (basePrice * rule.discountValue / 100));
      }

      // Replace item in cart
      cart.items[itemIndex] = {
        product: selectedProductId,
        shop: rule.shop._id,
        quantity: quantity,
        priceAtAddition: finalPrice,
        upsellRuleApplied: {
          ruleId: rule._id,
          ruleName: rule.ruleName,
          discountType: rule.discountType,
          discountValue: rule.discountValue,
          originalProductId: replacedProductId,
          appliedAt: new Date()
        }
      };

      // Update rule stats
      rule.stats.conversions += 1;
      rule.stats.revenue += finalPrice * quantity;
      await rule.save();

      await cart.save();

      logger.info({
        event: "APPLY_UPSELL_SUCCESS",
        cartId: cart._id,
        ruleId: rule._id,
        oldProduct: replacedProductId,
        newProduct: selectedProductId
      });

      return cart;
    } catch (err) {
      logger.error({
        event: "APPLY_UPSELL_ERROR",
        error: err.message,
        stack: err.stack
      });
      throw err;
    }
  }

  /**
   * Apply cross-sell rule - Add complementary product to cart
   */
  async applyCrossSellRule({ cart, ruleId, selectedProductId }) {
    try {
      logger.info({
        event: "APPLY_CROSS_SELL_START",
        cartId: cart._id,
        ruleId,
        selectedProductId
      });

      const rule = await UpsellRule.findById(ruleId).populate("offeredProducts shop");
      
      if (!rule || !rule.isActive) {
        throw new Error("Rule not found or inactive");
      }

      if (rule.ruleType !== "cross-sell") {
        throw new Error("This is not a cross-sell rule");
      }

      // Verify selected product is in offered products
      const selectedProduct = rule.offeredProducts.find(
        p => p._id.toString() === selectedProductId.toString()
      );

      if (!selectedProduct) {
        throw new Error("Selected product not in this rule");
      }

      // Check if product already in cart
      const existingItemIndex = cart.items.findIndex(
        item => item.product.toString() === selectedProductId.toString()
      );

      // Calculate price with cross-sell discount
      let basePrice = selectedProduct.unitPrice;

      // Apply product's own discount
      if (selectedProduct.discountType === "flat") {
        basePrice = Math.max(0, basePrice - (selectedProduct.discountValue || 0));
      } else if (selectedProduct.discountType === "percentage") {
        basePrice = Math.max(0, basePrice - (basePrice * (selectedProduct.discountValue || 0) / 100));
      }

      // Apply cross-sell discount
      let finalPrice = basePrice;
      if (rule.discountType === "flat") {
        finalPrice = Math.max(0, basePrice - rule.discountValue);
      } else if (rule.discountType === "percentage") {
        finalPrice = Math.max(0, basePrice - (basePrice * rule.discountValue / 100));
      }

      if (existingItemIndex !== -1) {
        // Product already in cart, just increase quantity
        cart.items[existingItemIndex].quantity += 1;
        cart.items[existingItemIndex].crossSellRuleApplied = {
          ruleId: rule._id,
          ruleName: rule.ruleName,
          discountType: rule.discountType,
          discountValue: rule.discountValue,
          appliedAt: new Date()
        };
      } else {
        // Add new item to cart
        cart.items.push({
          product: selectedProductId,
          shop: rule.shop._id,
          quantity: 1,
          priceAtAddition: finalPrice,
          crossSellRuleApplied: {
            ruleId: rule._id,
            ruleName: rule.ruleName,
            discountType: rule.discountType,
            discountValue: rule.discountValue,
            appliedAt: new Date()
          }
        });
      }

      // Update rule stats
      rule.stats.conversions += 1;
      rule.stats.revenue += finalPrice;
      await rule.save();

      await cart.save();

      logger.info({
        event: "APPLY_CROSS_SELL_SUCCESS",
        cartId: cart._id,
        ruleId: rule._id,
        productId: selectedProductId
      });

      return cart;
    } catch (err) {
      logger.error({
        event: "APPLY_CROSS_SELL_ERROR",
        error: err.message,
        stack: err.stack
      });
      throw err;
    }
  }

  /**
   * Track rule impression (when shown to user)
   */
  async trackImpression(ruleId) {
    try {
      await UpsellRule.findByIdAndUpdate(
        ruleId,
        { $inc: { "stats.impressions": 1 } }
      );
    } catch (err) {
      logger.error({
        event: "TRACK_IMPRESSION_ERROR",
        ruleId,
        error: err.message
      });
      // Don't throw - this is analytics only
    }
  }
}

module.exports = new UpsellService();