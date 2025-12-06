const ShippingRule = require("../models/ShippingRule");
const logger = require("../config/logger");

// GET - Get shipping rule for logged-in shopkeeper's shop
exports.getShippingRule = async (req, res) => {
  try {
    const shopId = req.shop._id; // From checkActiveShop middleware
    
    let shippingRule = await ShippingRule.findOne({ shop: shopId });
    
    // Create default rule if doesn't exist
    if (!shippingRule) {
      shippingRule = await ShippingRule.create({
        shop: shopId,
        flatRateAmount: 0,
        freeShippingThreshold: 0,
        isActive: false,
      });
      logger.info(`Created default shipping rule for shop ${shopId}`);
    }
    
    res.status(200).json({ success: true, shippingRule });
  } catch (err) {
    logger.error(`getShippingRule error: ${err.message}`);
    res.status(500).json({ message: err.message });
  }
};

// POST - Create or Update shipping rule
exports.upsertShippingRule = async (req, res) => {
  try {
    const shopId = req.shop._id;
    const {
      flatRateAmount,
      freeShippingThreshold,
      isActive,
      localPickupText,
    } = req.body;
    
    // Validation
    if (flatRateAmount !== undefined && flatRateAmount < 0) {
      return res.status(400).json({ 
        message: "Flat rate amount cannot be negative" 
      });
    }
    
    if (freeShippingThreshold !== undefined && freeShippingThreshold < 0) {
      return res.status(400).json({ 
        message: "Free shipping threshold cannot be negative" 
      });
    }
    
    // Upsert (create or update)
    const shippingRule = await ShippingRule.findOneAndUpdate(
      { shop: shopId },
      {
        flatRateAmount: flatRateAmount !== undefined ? flatRateAmount : 0,
        freeShippingThreshold: freeShippingThreshold !== undefined ? freeShippingThreshold : 0,
        isActive: isActive !== undefined ? isActive : false,
        localPickupText: localPickupText || null,
      },
      { 
        new: true, 
        upsert: true, 
        runValidators: true 
      }
    );
    
    logger.info(`Shipping rule updated for shop ${shopId}`, {
      flatRateAmount: shippingRule.flatRateAmount,
      freeShippingThreshold: shippingRule.freeShippingThreshold,
      isActive: shippingRule.isActive,
    });
    
    res.status(200).json({ 
      success: true, 
      message: "Shipping rule updated successfully",
      shippingRule 
    });
  } catch (err) {
    logger.error(`upsertShippingRule error: ${err.message}`);
    res.status(500).json({ message: err.message });
  }
};

// PATCH - Toggle active/inactive
exports.toggleShippingRule = async (req, res) => {
  try {
    const shopId = req.shop._id;
    const { isActive } = req.body;
    
    const shippingRule = await ShippingRule.findOneAndUpdate(
      { shop: shopId },
      { isActive: isActive !== undefined ? isActive : false },
      { new: true, upsert: true }
    );
    
    logger.info(`Shipping rule toggled for shop ${shopId}: ${shippingRule.isActive}`);
    
    res.status(200).json({ 
      success: true, 
      message: `Shipping rule ${shippingRule.isActive ? 'activated' : 'deactivated'}`,
      shippingRule 
    });
  } catch (err) {
    logger.error(`toggleShippingRule error: ${err.message}`);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getShippingRule: exports.getShippingRule,
  upsertShippingRule: exports.upsertShippingRule,
  toggleShippingRule: exports.toggleShippingRule,
};