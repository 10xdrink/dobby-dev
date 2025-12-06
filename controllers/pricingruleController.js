const PricingRule = require("../models/PricingRule");
const Product = require("../models/productModel");
const logger = require("../config/logger");
const cacheService = require("../services/cacheService");

/**
 * Create a new pricing rule
 * POST /api/shopkeeper/pricing-rules
 */
exports.createPricingRule = async (req, res) => {
  try {
    const shop = req.shop;
    const {
      ruleName,
      discountType,
      discountValue,
      applicableProducts,
      startDate,
      endDate,
      customerGroup,
      minimumPurchaseAmount,
      status,
    } = req.body;

    logger.info({
      event: "CREATE_PRICING_RULE",
      shopId: shop._id,
      ruleName,
    });

    // Validation
    if (!ruleName || !discountType || !discountValue || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({
        success: false,
        message: "Start date must be before end date",
      });
    }

    if (discountType === "percentage" && (discountValue < 0 || discountValue > 100)) {
      return res.status(400).json({
        success: false,
        message: "Percentage discount must be between 0 and 100",
      });
    }

    if (discountType === "flat" && discountValue < 0) {
      return res.status(400).json({
        success: false,
        message: "Flat discount cannot be negative",
      });
    }

    // Validate products belong to this shop
    if (applicableProducts && applicableProducts.length > 0) {
      const products = await Product.find({
        _id: { $in: applicableProducts },
        shop: shop._id,
        status: "active",
      });

      if (products.length !== applicableProducts.length) {
        return res.status(400).json({
          success: false,
          message: "Some products are invalid or do not belong to your shop",
        });
      }
    }

    // Create pricing rule
    const pricingRule = await PricingRule.create({
      shop: shop._id,
      ruleName,
      discountType,
      discountValue,
      applicableProducts: applicableProducts || [],
      startDate,
      endDate,
      customerGroup: customerGroup || "all",
      minimumPurchaseAmount: minimumPurchaseAmount || 0,
      status: status || "inactive",
    });

    await cacheService.deletePattern(`shop:${shop._id}:pricing:*`);

    logger.info({
      event: "PRICING_RULE_CREATED",
      ruleId: pricingRule._id,
      shopId: shop._id,
    });

    res.status(201).json({
      success: true,
      message: "Pricing rule created successfully",
      pricingRule,
    });
  } catch (err) {
    logger.error({
      event: "CREATE_PRICING_RULE_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Get all pricing rules for shopkeeper's shop
 * GET /api/shopkeeper/pricing-rules
 */
exports.getPricingRules = async (req, res) => {
  try {
    const shop = req.shop;

    const cacheKey = `shop:${shop._id}:pricing:rules:all`;
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      const pricingRules = await PricingRule.find({ shop: shop._id })
        .populate("applicableProducts", "productName unitPrice sku")
        .sort({ createdAt: -1 });

      return {
        success: true,
        count: pricingRules.length,
        pricingRules,
      };
    });

    res.json(responseData);
  } catch (err) {
    logger.error({
      event: "GET_PRICING_RULES_ERROR",
      error: err.message,
    });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Get single pricing rule
 * GET /api/shopkeeper/pricing-rules/:id
 */
exports.getPricingRuleById = async (req, res) => {
  try {
    const shop = req.shop;
    const { id } = req.params;

    const cacheKey = `shop:${shop._id}:pricing:rule:${id}`;
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      const pricingRule = await PricingRule.findOne({
        _id: id,
        shop: shop._id,
      }).populate("applicableProducts", "productName unitPrice sku");

      if (!pricingRule) {
        return { error: 404, message: "Pricing rule not found" };
      }

      return {
        success: true,
        pricingRule,
      };
    });

    if (responseData.error) {
      return res.status(responseData.error).json({
        success: false,
        message: responseData.message,
      });
    }

    res.json(responseData);
  } catch (err) {
    logger.error({
      event: "GET_PRICING_RULE_ERROR",
      error: err.message,
    });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Update pricing rule
 * PUT /api/shopkeeper/pricing-rules/:id
 */
exports.updatePricingRule = async (req, res) => {
  try {
    const shop = req.shop;
    const { id } = req.params;
    const updates = req.body;

    logger.info({
      event: "UPDATE_PRICING_RULE",
      ruleId: id,
      shopId: shop._id,
    });

    const pricingRule = await PricingRule.findOne({
      _id: id,
      shop: shop._id,
    });

    if (!pricingRule) {
      return res.status(404).json({
        success: false,
        message: "Pricing rule not found",
      });
    }

    // Validate date changes
    if (updates.startDate || updates.endDate) {
      const newStart = updates.startDate ? new Date(updates.startDate) : pricingRule.startDate;
      const newEnd = updates.endDate ? new Date(updates.endDate) : pricingRule.endDate;

      if (newStart >= newEnd) {
        return res.status(400).json({
          success: false,
          message: "Start date must be before end date",
        });
      }
    }

    // Validate discount changes
    if (updates.discountType === "percentage" && updates.discountValue > 100) {
      return res.status(400).json({
        success: false,
        message: "Percentage discount cannot exceed 100%",
      });
    }

    // Validate products if updated
    if (updates.applicableProducts && updates.applicableProducts.length > 0) {
      const products = await Product.find({
        _id: { $in: updates.applicableProducts },
        shop: shop._id,
        status: "active",
      });

      if (products.length !== updates.applicableProducts.length) {
        return res.status(400).json({
          success: false,
          message: "Some products are invalid or do not belong to your shop",
        });
      }
    }

    // Update rule
    Object.assign(pricingRule, updates);
    await pricingRule.save();

    await cacheService.deletePattern(`shop:${shop._id}:pricing:*`);

    logger.info({
      event: "PRICING_RULE_UPDATED",
      ruleId: pricingRule._id,
    });

    res.json({
      success: true,
      message: "Pricing rule updated successfully",
      pricingRule,
    });
  } catch (err) {
    logger.error({
      event: "UPDATE_PRICING_RULE_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Delete pricing rule
 * DELETE /api/shopkeeper/pricing-rules/:id
 */
exports.deletePricingRule = async (req, res) => {
  try {
    const shop = req.shop;
    const { id } = req.params;

    const pricingRule = await PricingRule.findOne({
      _id: id,
      shop: shop._id,
    });

    if (!pricingRule) {
      return res.status(404).json({
        success: false,
        message: "Pricing rule not found",
      });
    }

    await pricingRule.deleteOne();

    await cacheService.deletePattern(`shop:${shop._id}:pricing:*`);

    logger.info({
      event: "PRICING_RULE_DELETED",
      ruleId: id,
      shopId: shop._id,
    });

    res.json({
      success: true,
      message: "Pricing rule deleted successfully",
    });
  } catch (err) {
    logger.error({
      event: "DELETE_PRICING_RULE_ERROR",
      error: err.message,
    });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Toggle pricing rule status (active/inactive)
 * PATCH /api/shopkeeper/pricing-rules/:id/toggle
 */
exports.togglePricingRuleStatus = async (req, res) => {
  try {
    const shop = req.shop;
    const { id } = req.params;

    const pricingRule = await PricingRule.findOne({
      _id: id,
      shop: shop._id,
    });

    if (!pricingRule) {
      return res.status(404).json({
        success: false,
        message: "Pricing rule not found",
      });
    }

    // Toggle between active and inactive (don't change expired status)
    if (pricingRule.status === "expired") {
      return res.status(400).json({
        success: false,
        message: "Cannot toggle expired rule. Please create a new rule.",
      });
    }

    pricingRule.status = pricingRule.status === "active" ? "inactive" : "active";
    await pricingRule.save();

    await cacheService.deletePattern(`shop:${shop._id}:pricing:*`);

    logger.info({
      event: "PRICING_RULE_STATUS_TOGGLED",
      ruleId: pricingRule._id,
      newStatus: pricingRule.status,
    });

    res.json({
      success: true,
      message: `Pricing rule ${pricingRule.status === "active" ? "activated" : "deactivated"} successfully`,
      pricingRule,
    });
  } catch (err) {
    logger.error({
      event: "TOGGLE_PRICING_RULE_ERROR",
      error: err.message,
    });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Get pricing rule statistics
 * GET /api/shopkeeper/pricing-rules/:id/stats
 */
exports.getPricingRuleStats = async (req, res) => {
  try {
    const shop = req.shop;
    const { id } = req.params;

    const cacheKey = `shop:${shop._id}:pricing:stats:${id}`;
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      const pricingRule = await PricingRule.findOne({
        _id: id,
        shop: shop._id,
      });

      if (!pricingRule) {
        return { error: 404, message: "Pricing rule not found" };
      }

      const stats = {
        ruleName: pricingRule.ruleName,
        usageCount: pricingRule.usageCount,
        totalDiscountGiven: pricingRule.totalDiscountGiven,
        averageDiscountPerUse:
          pricingRule.usageCount > 0
            ? pricingRule.totalDiscountGiven / pricingRule.usageCount
            : 0,
        status: pricingRule.status,
        daysActive: Math.ceil(
          (new Date() - pricingRule.startDate) / (1000 * 60 * 60 * 24)
        ),
        daysRemaining: Math.ceil(
          (pricingRule.endDate - new Date()) / (1000 * 60 * 60 * 24)
        ),
      };

      return {
        success: true,
        stats,
      };
    });

    if (responseData.error) {
      return res.status(responseData.error).json({
        success: false,
        message: responseData.message,
      });
    }

    res.json(responseData);
  } catch (err) {
    logger.error({
      event: "GET_PRICING_RULE_STATS_ERROR",
      error: err.message,
    });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


/**
 * Duplicate pricing rule
 * POST /api/shopkeeper/pricing-rules/:id/duplicate
 */
exports.duplicatePricingRule = async (req, res) => {
  try {
    const shop = req.shop;
    const { id } = req.params;

    logger.info({
      event: "DUPLICATE_PRICING_RULE_REQUEST",
      ruleId: id,
      shopId: shop._id,
    });

    // Find original rule
    const originalRule = await PricingRule.findOne({
      _id: id,
      shop: shop._id,
    }).lean(); // Use .lean() for plain object

    if (!originalRule) {
      return res.status(404).json({
        success: false,
        message: "Pricing rule not found",
      });
    }

    // Create duplicate with modified data
    const duplicateData = {
      shop: originalRule.shop,
      ruleName: `${originalRule.ruleName} (Copy)`, // Add "(Copy)" to name
      discountType: originalRule.discountType,
      discountValue: originalRule.discountValue,
      applicableProducts: originalRule.applicableProducts || [],
      
      // Set dates to future (7 days from now for start, 14 days for end)
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      
      customerGroup: originalRule.customerGroup,
      minimumPurchaseAmount: originalRule.minimumPurchaseAmount || 0,
      
      // Set status as inactive by default (shopkeeper will activate after editing)
      status: "inactive",
      
      // Keep same priority
      priority: originalRule.priority || 0,
      
      // Reset usage stats (new rule should start fresh)
      usageCount: 0,
      totalDiscountGiven: 0,
    };

    // Create duplicate rule
    const duplicatedRule = await PricingRule.create(duplicateData);

    await cacheService.deletePattern(`shop:${shop._id}:pricing:*`);

    logger.info({
      event: "PRICING_RULE_DUPLICATED",
      originalRuleId: id,
      duplicatedRuleId: duplicatedRule._id,
      shopId: shop._id,
      originalName: originalRule.ruleName,
      duplicateName: duplicatedRule.ruleName,
    });

    // Populate products for response
    const populatedRule = await PricingRule.findById(duplicatedRule._id)
      .populate("applicableProducts", "productName unitPrice sku");

    res.status(201).json({
      success: true,
      message: "Pricing rule duplicated successfully",
      pricingRule: populatedRule,
      note: "Rule is set to inactive. Please review and activate when ready.",
    });
  } catch (err) {
    logger.error({
      event: "DUPLICATE_PRICING_RULE_ERROR",
      error: err.message,
      stack: err.stack,
      ruleId: req.params.id,
    });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Duplicate pricing rule with custom settings (optional advanced version)
 * POST /api/shopkeeper/pricing-rules/:id/duplicate-custom
 */
exports.duplicatePricingRuleCustom = async (req, res) => {
  try {
    const shop = req.shop;
    const { id } = req.params;
    const { 
      ruleName, 
      startDate, 
      endDate, 
      status,
      customerGroup,
      discountValue,
      applicableProducts 
    } = req.body;

    logger.info({
      event: "DUPLICATE_PRICING_RULE_CUSTOM_REQUEST",
      ruleId: id,
      shopId: shop._id,
      customizations: req.body,
    });

    // Find original rule
    const originalRule = await PricingRule.findOne({
      _id: id,
      shop: shop._id,
    }).lean();

    if (!originalRule) {
      return res.status(404).json({
        success: false,
        message: "Pricing rule not found",
      });
    }

    // Create duplicate with custom overrides
    const duplicateData = {
      shop: originalRule.shop,
      
      // Allow custom name or use default with (Copy)
      ruleName: ruleName || `${originalRule.ruleName} (Copy)`,
      
      discountType: originalRule.discountType,
      
      // Allow custom discount value or use original
      discountValue: discountValue !== undefined ? discountValue : originalRule.discountValue,
      
      // Allow custom products or use original
      applicableProducts: applicableProducts || originalRule.applicableProducts || [],
      
      // Allow custom dates or use future dates
      startDate: startDate ? new Date(startDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      endDate: endDate ? new Date(endDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      
      // Allow custom customer group or use original
      customerGroup: customerGroup || originalRule.customerGroup,
      
      minimumPurchaseAmount: originalRule.minimumPurchaseAmount || 0,
      
      // Allow custom status or default inactive
      status: status || "inactive",
      
      priority: originalRule.priority || 0,
      
      // Reset usage stats
      usageCount: 0,
      totalDiscountGiven: 0,
    };

    // Validate dates
    if (duplicateData.startDate >= duplicateData.endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date must be before end date",
      });
    }

    // Validate products if provided
    if (applicableProducts && applicableProducts.length > 0) {
      const Product = require("../models/productModel");
      const products = await Product.find({
        _id: { $in: applicableProducts },
        shop: shop._id,
        status: "active",
      });

      if (products.length !== applicableProducts.length) {
        return res.status(400).json({
          success: false,
          message: "Some products are invalid or do not belong to your shop",
        });
      }
    }

    // Create duplicate rule
    const duplicatedRule = await PricingRule.create(duplicateData);

    await cacheService.deletePattern(`shop:${shop._id}:pricing:*`);

    logger.info({
      event: "PRICING_RULE_DUPLICATED_CUSTOM",
      originalRuleId: id,
      duplicatedRuleId: duplicatedRule._id,
      shopId: shop._id,
    });

    // Populate products for response
    const populatedRule = await PricingRule.findById(duplicatedRule._id)
      .populate("applicableProducts", "productName unitPrice sku");

    res.status(201).json({
      success: true,
      message: "Pricing rule duplicated with custom settings",
      pricingRule: populatedRule,
    });
  } catch (err) {
    logger.error({
      event: "DUPLICATE_PRICING_RULE_CUSTOM_ERROR",
      error: err.message,
      stack: err.stack,
      ruleId: req.params.id,
    });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};