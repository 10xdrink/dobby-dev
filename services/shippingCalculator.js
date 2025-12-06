const ShippingRule = require("../models/ShippingRule");
const logger = require("../config/logger");

class ShippingCalculator {
  /**
   * Safely extract ObjectId string from potentially populated field
   * @param {Object|String} field - ObjectId or populated object
   * @returns {String|null} - ObjectId string or null
   */
  _extractObjectId(field) {
    if (!field) return null;
    if (typeof field === 'string') return field;
    if (field._id) return field._id.toString();
    // Fallback for ObjectId instances
    if (field.toString && typeof field.toString === 'function') {
      const str = field.toString();
      // Check if it's a valid ObjectId (24 hex characters)
      if (/^[0-9a-fA-F]{24}$/.test(str)) return str;
    }
    return null;
  }

  /**
   * Calculate shipping for cart items grouped by shop
   * Used by Cart Service
   * @param {Array} cartItems - Cart items with populated product and shop
   * @returns {Object} - { totalShipping, shopShippingBreakdown }
   */
  async calculateCartShipping(cartItems) {
    try {
      logger.info(`calculateCartShipping called with ${cartItems.length} items`);
      
      // Group items by shop
      const shopGroups = this._groupItemsByShop(cartItems);
      
      const shopShippingBreakdown = [];
      let totalShipping = 0;
      
      // Calculate shipping for each shop
      for (const [shopId, items] of Object.entries(shopGroups)) {
        const shopShipping = await this._calculateShopShipping(shopId, items);
        
        shopShippingBreakdown.push({
          shopId,
          shopName: items[0].product?.shop?.shopName || "Unknown Shop",
          items: items.map(i => ({
            productId: i.product._id,
            productName: i.product.productName,
            quantity: i.quantity,
            price: i.product.priceWithTax || i.product.unitPrice,
            individualShipping: i.product.shippingCost || 0,
          })),
          subtotal: shopShipping.subtotal,
          itemsWithIndividualShipping: shopShipping.itemsWithIndividualShipping,
          itemsForRuleCalculation: shopShipping.itemsForRuleCalculation,
          individualShippingTotal: shopShipping.individualShippingTotal,
          ruleBasedShipping: shopShipping.ruleBasedShipping,
          totalShipping: shopShipping.totalShipping,
          freeShippingApplied: shopShipping.freeShippingApplied,
          ruleActive: shopShipping.ruleActive,
        });
        
        totalShipping += shopShipping.totalShipping;
      }
      
      logger.info(`Cart shipping calculated: total=${totalShipping}, shops=${Object.keys(shopGroups).length}`);
      
      return {
        totalShipping,
        shopShippingBreakdown,
      };
    } catch (err) {
      logger.error(`calculateCartShipping error: ${err.message}`, { stack: err.stack });
      throw err;
    }
  }
  
  /**
   * Calculate shipping for items from a single shop
   * @private
   * @param {String} shopId 
   * @param {Array} items - Cart items for this shop
   * @returns {Object} Shipping breakdown for the shop
   */
  async _calculateShopShipping(shopId, items) {
    logger.debug(`Calculating shipping for shop ${shopId} with ${items.length} items`);
    
    // Separate items with individual shipping vs rule-based shipping
    const itemsWithIndividualShipping = [];
    const itemsForRuleCalculation = [];
    
    let individualShippingTotal = 0;
    let subtotalForRule = 0;
    let totalSubtotal = 0;
    
    // Process each item
    for (const item of items) {
      const product = item.product;
      const price = product.priceWithTax || product.unitPrice;
      const itemTotal = price * item.quantity;
      
      totalSubtotal += itemTotal;
      
      // Check if product has individual shipping
      if (product.shippingCost && product.shippingCost > 0) {
        itemsWithIndividualShipping.push(item);
        
        individualShippingTotal += product.shippingCost * item.quantity;
        logger.debug(`Product ${product._id} has individual shipping: ${product.shippingCost} × ${item.quantity} = ${product.shippingCost * item.quantity}`);
      } else {
        // This item will be part of rule calculation
        itemsForRuleCalculation.push(item);
        subtotalForRule += itemTotal;
        logger.debug(`Product ${product._id} eligible for rule-based shipping`);
      }
    }
    
    // Get shop's active shipping rule
    const shippingRule = await ShippingRule.findOne({ 
      shop: shopId, 
      isActive: true 
    });
    
    let ruleBasedShipping = 0;
    let freeShippingApplied = false;
    
    // Apply shipping rule only if:
    // 1. Rule exists and is active
    // 2. There are items without individual shipping
    if (shippingRule && itemsForRuleCalculation.length > 0) {
      logger.debug(`Shipping rule found for shop ${shopId}:`, {
        flatRate: shippingRule.flatRateAmount,
        threshold: shippingRule.freeShippingThreshold,
        subtotalForRule,
      });
      
      // Check if free shipping threshold is met
      if (shippingRule.freeShippingThreshold > 0 && 
          subtotalForRule >= shippingRule.freeShippingThreshold) {
        ruleBasedShipping = 0;
        freeShippingApplied = true;
        logger.info(`Free shipping applied for shop ${shopId} (threshold: ${shippingRule.freeShippingThreshold}, subtotal: ${subtotalForRule})`);
      } else {
        // Apply flat rate shipping
        ruleBasedShipping = shippingRule.flatRateAmount || 0;
        logger.info(`Flat rate shipping applied for shop ${shopId}: ${ruleBasedShipping}`);
      }
    } else {
      if (!shippingRule) {
        logger.debug(`No active shipping rule found for shop ${shopId}`);
      }
      if (itemsForRuleCalculation.length === 0) {
        logger.debug(`All items have individual shipping for shop ${shopId}`);
      }
    }
    
    const totalShipping = individualShippingTotal + ruleBasedShipping;
    
    logger.info(`Shop ${shopId} shipping calculated:`, {
      totalSubtotal,
      subtotalForRule,
      itemsWithIndividualShipping: itemsWithIndividualShipping.length,
      itemsForRuleCalculation: itemsForRuleCalculation.length,
      individualShippingTotal,
      ruleBasedShipping,
      totalShipping,
      freeShippingApplied,
    });
    
    return {
      subtotal: totalSubtotal,
      itemsWithIndividualShipping,
      itemsForRuleCalculation,
      individualShippingTotal,
      ruleBasedShipping,
      totalShipping,
      freeShippingApplied,
      ruleActive: !!shippingRule,
    };
  }
  
  /**
   * Group cart items by shop
   * @private
   * @param {Array} cartItems 
   * @returns {Object} Items grouped by shopId
   */
  _groupItemsByShop(cartItems) {
    const groups = {};
    
    for (const item of cartItems) {
      // Try to get shopId from item.shop or item.product.shop
      const shopId = this._extractObjectId(item.shop) || 
                     this._extractObjectId(item.product?.shop);
      
      if (!shopId) {
        logger.warn(`Item ${item.product?._id} has no shop reference - skipping`);
        continue;
      }
      
      if (!groups[shopId]) {
        groups[shopId] = [];
      }
      
      groups[shopId].push(item);
    }
    
    logger.debug(`Grouped ${cartItems.length} items into ${Object.keys(groups).length} shops`);
    
    return groups;
  }
  
  /**
   * Calculate shipping for order items
   * Used by Order Service when creating orders
   * @param {Array} orderItems - Order items with shop reference
   * @returns {Object} - { totalShipping, itemsWithShipping }
   */
  async calculateOrderShipping(orderItems) {
    try {
      logger.info(`calculateOrderShipping called with ${orderItems.length} items`);
      
      // Group by shop
      const shopGroups = {};
      
      for (const item of orderItems) {
        const shopId = item.shop?.toString();
        if (!shopId) {
          logger.warn(`Order item ${item.product} has no shop reference - skipping`);
          continue;
        }
        
        if (!shopGroups[shopId]) {
          shopGroups[shopId] = [];
        }
        shopGroups[shopId].push(item);
      }
      
      let totalShipping = 0;
      const itemsWithShipping = [];
      
      // Calculate for each shop
      for (const [shopId, items] of Object.entries(shopGroups)) {
        logger.debug(`Processing order shipping for shop ${shopId} with ${items.length} items`);
        
        let shopIndividualShipping = 0;
        let shopSubtotalForRule = 0;
        const itemsForRule = [];
        
        // Separate individual vs rule-based
        for (const item of items) {
          if (item.shippingCost && item.shippingCost > 0) {
            
            shopIndividualShipping += item.shippingCost * item.quantity;
            logger.debug(`Order item ${item.product} has individual shipping: ${item.shippingCost} × ${item.quantity}`);
          } else {
            const itemPrice = item.price || item.basePrice || 0;
            shopSubtotalForRule += itemPrice * item.quantity;
            itemsForRule.push(item);
            logger.debug(`Order item ${item.product} eligible for rule`);
          }
        }
        
        // Get shipping rule for this shop
        const rule = await ShippingRule.findOne({ shop: shopId, isActive: true });
        
        let shopRuleShipping = 0;
        if (rule && itemsForRule.length > 0) {
          logger.debug(`Order: Applying rule for shop ${shopId}`, {
            threshold: rule.freeShippingThreshold,
            subtotal: shopSubtotalForRule,
            flatRate: rule.flatRateAmount,
          });
          
          if (rule.freeShippingThreshold > 0 && 
              shopSubtotalForRule >= rule.freeShippingThreshold) {
            shopRuleShipping = 0;
            logger.info(`Order: Free shipping for shop ${shopId} (threshold met)`);
          } else {
            shopRuleShipping = rule.flatRateAmount || 0;
            logger.info(`Order: Flat rate ${shopRuleShipping} for shop ${shopId}`);
          }
        } else {
          if (!rule) {
            logger.debug(`Order: No active rule for shop ${shopId}`);
          }
          if (itemsForRule.length === 0) {
            logger.debug(`Order: All items have individual shipping for shop ${shopId}`);
          }
        }
        
        const shopTotalShipping = shopIndividualShipping + shopRuleShipping;
        totalShipping += shopTotalShipping;
        
        logger.info(`Order shop ${shopId} shipping breakdown:`, {
          individualShipping: shopIndividualShipping,
          ruleShipping: shopRuleShipping,
          totalShipping: shopTotalShipping,
        });
        
        // Mark items with their shipping allocation
        for (const item of items) {
          itemsWithShipping.push({
            ...item,
            allocatedShipping: item.shippingCost || 0,
          });
        }
      }
      
      logger.info(`Order total shipping calculated: ${totalShipping}`);
      
      return { 
        totalShipping, 
        itemsWithShipping 
      };
    } catch (err) {
      logger.error(`calculateOrderShipping error: ${err.message}`, { stack: err.stack });
      throw err;
    }
  }
}

// Export single instance
module.exports = new ShippingCalculator();