const UpsellRule = require("../models/upsellRule");
const Product = require("../models/productModel");
const logger = require("../config/logger");
const cacheService = require("../services/cacheService");

// Create Rule
exports.createRule = async (req, res) => {
  try {
    const shop = req.shop;
    const { 
      ruleName, 
      ruleType, 
      discountType, 
      discountValue, 
      priority, 
      offeredProducts, 
      description,
      conditions 
    } = req.body;

    // Validate offered products belong to this shop
    const products = await Product.find({ 
      _id: { $in: offeredProducts }, 
      shop: shop._id 
    });
    
    if (products.length !== offeredProducts.length) {
      return res.status(400).json({ 
        message: "Some products do not belong to your shop" 
      });
    }

    // Validate trigger products if provided
    if (conditions?.triggerProducts && conditions.triggerProducts.length > 0) {
      const triggerProds = await Product.find({
        _id: { $in: conditions.triggerProducts },
        shop: shop._id
      });
      
      if (triggerProds.length !== conditions.triggerProducts.length) {
        return res.status(400).json({ 
          message: "Some trigger products do not belong to your shop" 
        });
      }
    }

    const rule = await UpsellRule.create({
      shop: shop._id,
      ruleName,
      ruleType,
      discountType,
      discountValue,
      priority,
      offeredProducts,
      description,
      conditions: conditions || {},
      isActive: true // Active by default
    });

    logger.info({
      event: "UPSELL_RULE_CREATED",
      shopId: shop._id,
      ruleId: rule._id,
      ruleType,
      priority
    });

    await cacheService.deletePattern(`shop:${shop._id}:upsell:*`);
    await cacheService.deletePattern(`public:shop:${shop._id}:upsell:*`);

    res.status(201).json({ success: true, rule });
  } catch (err) {
    logger.error({
      event: "CREATE_RULE_ERROR",
      error: err.message,
      stack: err.stack
    });
    res.status(500).json({ message: err.message });
  }
};

// Get Rules with filter & search
exports.getRules = async (req, res) => {
  try {
    const shop = req.shop;
    const { search, ruleType, status } = req.query;

    const cacheKey = `shop:${shop._id}:upsell:rules:${search || 'all'}:${ruleType || 'all'}:${status || 'all'}`;
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      let query = { shop: shop._id };

      if (ruleType) query.ruleType = ruleType;
      if (status === "active") query.isActive = true;
      if (status === "inactive") query.isActive = false;
      if (search) query.ruleName = { $regex: search, $options: "i" };

      const rules = await UpsellRule.find(query)
        .populate("offeredProducts", "productName unitPrice icon1")
        .populate("conditions.triggerProducts", "productName")
        .sort({ priority: -1, createdAt: -1 });

      return { success: true, rules };
    });

    res.json(responseData);
  } catch (err) {
    logger.error({
      event: "GET_RULES_ERROR",
      error: err.message
    });
    res.status(500).json({ message: err.message });
  }
};

// Update Rule
exports.updateRule = async (req, res) => {
  try {
    const shop = req.shop;
    const ruleId = req.params.id;

    let rule = await UpsellRule.findOne({ _id: ruleId, shop: shop._id });
    if (!rule) {
      return res.status(404).json({ message: "Rule not found" });
    }

    // Validate offered products if updated
    if (req.body.offeredProducts) {
      const products = await Product.find({ 
        _id: { $in: req.body.offeredProducts }, 
        shop: shop._id 
      });
      
      if (products.length !== req.body.offeredProducts.length) {
        return res.status(400).json({ 
          message: "Some products do not belong to your shop" 
        });
      }
    }

    // Validate trigger products if updated
    if (req.body.conditions?.triggerProducts) {
      const triggerProds = await Product.find({
        _id: { $in: req.body.conditions.triggerProducts },
        shop: shop._id
      });
      
      if (triggerProds.length !== req.body.conditions.triggerProducts.length) {
        return res.status(400).json({ 
          message: "Some trigger products do not belong to your shop" 
        });
      }
    }

    Object.assign(rule, req.body);
    await rule.save();

    await cacheService.deletePattern(`shop:${shop._id}:upsell:*`);
    await cacheService.deletePattern(`public:shop:${shop._id}:upsell:*`);

    logger.info({
      event: "UPSELL_RULE_UPDATED",
      shopId: shop._id,
      ruleId: rule._id
    });

    res.json({ success: true, rule });
  } catch (err) {
    logger.error({
      event: "UPDATE_RULE_ERROR",
      error: err.message
    });
    res.status(500).json({ message: err.message });
  }
};

// Toggle Rule Active Status
exports.toggleRuleStatus = async (req, res) => {
  try {
    const shop = req.shop;
    const ruleId = req.params.id;

    const rule = await UpsellRule.findOne({ _id: ruleId, shop: shop._id });
    if (!rule) {
      return res.status(404).json({ message: "Rule not found" });
    }

    rule.isActive = !rule.isActive;
    await rule.save();

    await cacheService.deletePattern(`shop:${shop._id}:upsell:*`);
    await cacheService.deletePattern(`public:shop:${shop._id}:upsell:*`);

    logger.info({
      event: "UPSELL_RULE_TOGGLED",
      shopId: shop._id,
      ruleId: rule._id,
      isActive: rule.isActive
    });

    res.json({ 
      success: true, 
      rule,
      message: `Rule ${rule.isActive ? 'activated' : 'deactivated'} successfully` 
    });
  } catch (err) {
    logger.error({
      event: "TOGGLE_RULE_ERROR",
      error: err.message
    });
    res.status(500).json({ message: err.message });
  }
};

// Delete Rule
exports.deleteRule = async (req, res) => {
  try {
    const shop = req.shop;
    const rule = await UpsellRule.findOne({ _id: req.params.id, shop: shop._id });
    if (!rule) {
      return res.status(404).json({ message: "Rule not found" });
    }

    await rule.deleteOne();
    
    await cacheService.deletePattern(`shop:${shop._id}:upsell:*`);
    await cacheService.deletePattern(`public:shop:${shop._id}:upsell:*`);

    logger.info({
      event: "UPSELL_RULE_DELETED",
      shopId: shop._id,
      ruleId: req.params.id
    });

    res.json({ message: "Rule deleted successfully" });
  } catch (err) {
    logger.error({
      event: "DELETE_RULE_ERROR",
      error: err.message
    });
    res.status(500).json({ message: err.message });
  }
};

// Get Single Rule (for shopkeeper)
exports.getRuleById = async (req, res) => {
  try {
    const shop = req.shop;
    const { id } = req.params;

    const cacheKey = `shop:${shop._id}:upsell:rule:${id}`;
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      const rule = await UpsellRule.findOne({ _id: id, shop: shop._id })
        .populate("offeredProducts", "productName unitPrice icon1 discountType discountValue")
        .populate("conditions.triggerProducts", "productName");

      if (!rule) {
        return { error: 404, message: "Rule not found" };
      }

      return { success: true, rule };
    });

    if (responseData.error) {
      return res.status(responseData.error).json({ message: responseData.message });
    }

    res.status(200).json(responseData);
  } catch (err) {
    logger.error({
      event: "GET_RULE_BY_ID_ERROR",
      error: err.message
    });
    res.status(500).json({ message: err.message });
  }
};

// Get Stats for a Rule
exports.getRuleStats = async (req, res) => {
  try {
    const shop = req.shop;
    const { id } = req.params;

    const cacheKey = `shop:${shop._id}:upsell:stats:${id}`;
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      const rule = await UpsellRule.findOne({ _id: id, shop: shop._id });
      if (!rule) {
        return { error: 404, message: "Rule not found" };
      }

      const conversionRate = rule.stats.impressions > 0 
        ? ((rule.stats.conversions / rule.stats.impressions) * 100).toFixed(2)
        : 0;

      return {
        success: true,
        stats: {
          ...rule.stats,
          conversionRate: `${conversionRate}%`
        }
      };
    });

    if (responseData.error) {
      return res.status(responseData.error).json({ message: responseData.message });
    }

    res.json(responseData);
  } catch (err) {
    logger.error({
      event: "GET_RULE_STATS_ERROR",
      error: err.message
    });
    res.status(500).json({ message: err.message });
  }
};


// Get Public Rules by Shop
exports.getPublicRules = async (req, res) => {
  try {
    const { shopId } = req.params;
    if (!shopId) {
      return res.status(400).json({ message: "shopId is required" });
    }

    const cacheKey = `public:shop:${shopId}:upsell:rules`;
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      const rules = await UpsellRule.find({
        shop: shopId,
        isActive: true
      })
        .populate("offeredProducts", "productName unitPrice discountType discountValue icon1")
        .sort({ priority: -1, createdAt: -1 });

      return {
        success: true,
        rules,
      };
    });

    res.status(200).json(responseData);
  } catch (err) {
    logger.error({
      event: "GET_PUBLIC_RULES_ERROR",
      error: err.message
    });
    res.status(500).json({ message: err.message });
  }
};

// Get Public Rule by ID
exports.getPublicRuleById = async (req, res) => {
  try {
    const { ruleId } = req.params;

    const cacheKey = `public:upsell:rule:${ruleId}`;
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      const rule = await UpsellRule.findOne({ 
        _id: ruleId,
        isActive: true 
      })
        .populate("offeredProducts", "productName unitPrice discountType discountValue icon1");

      if (!rule) {
        return { error: 404, message: "Rule not found" };
      }

      return { success: true, rule };
    });

    if (responseData.error) {
      return res.status(responseData.error).json({ message: responseData.message });
    }

    res.status(200).json(responseData);
  } catch (err) {
    logger.error({
      event: "GET_PUBLIC_RULE_BY_ID_ERROR",
      error: err.message
    });
    res.status(500).json({ message: err.message });
  }
};