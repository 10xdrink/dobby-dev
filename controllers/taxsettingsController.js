const TaxSettings = require("../models/TaxSettings");
const logger = require("../config/logger");
const cacheService = require("../services/cacheService");


exports.getTaxSettings = async (req, res) => {
  try {
    const shop = req.shop;

    const cacheKey = `shop:${shop._id}:taxSettings`;
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.DEFAULT, async () => {
      let taxSettings = await TaxSettings.findOne({ shop: shop._id });

      if (!taxSettings) {
        // Create default tax settings
        taxSettings = await TaxSettings.create({
          shop: shop._id,
          defaultTaxRate: 18,
          taxCalculationMethod: "exclude_shipping",
          regionalTaxRates: [],
        });
      }

      return { success: true, taxSettings };
    });

    res.status(200).json(responseData);
  } catch (err) {
    logger.error(`getTaxSettings error: ${err.message}`);
    res.status(500).json({ message: err.message });
  }
};


exports.saveTaxSettings = async (req, res) => {
  try {
    const shop = req.shop;
    const { defaultTaxRate, taxCalculationMethod, regionalTaxRates } = req.body;

    // Validation
    if (defaultTaxRate == null || defaultTaxRate < 0 || defaultTaxRate > 100) {
      return res.status(400).json({ message: "Default tax rate must be between 0 and 100" });
    }

    if (!["apply_tax_to_shipping", "exclude_shipping"].includes(taxCalculationMethod)) {
      return res.status(400).json({ message: "Invalid tax calculation method" });
    }

    // Validate regional tax rates
    if (regionalTaxRates && Array.isArray(regionalTaxRates)) {
      for (const rt of regionalTaxRates) {
        if (!rt.region || !rt.region.trim()) {
          return res.status(400).json({ message: "Region name is required" });
        }
        if (rt.taxRate == null || rt.taxRate < 0 || rt.taxRate > 100) {
          return res.status(400).json({ message: "Tax rate must be between 0 and 100" });
        }
      }

      // Check for duplicate regions (case-insensitive)
      const regions = regionalTaxRates.map((rt) => rt.region.toLowerCase().trim());
      const uniqueRegions = new Set(regions);
      if (regions.length !== uniqueRegions.size) {
        return res.status(400).json({ message: "Duplicate regions are not allowed" });
      }
    }

    // Update or create tax settings
    let taxSettings = await TaxSettings.findOne({ shop: shop._id });

    if (taxSettings) {
      taxSettings.defaultTaxRate = defaultTaxRate;
      taxSettings.taxCalculationMethod = taxCalculationMethod;
      taxSettings.regionalTaxRates = regionalTaxRates || [];
      await taxSettings.save();
    } else {
      taxSettings = await TaxSettings.create({
        shop: shop._id,
        defaultTaxRate,
        taxCalculationMethod,
        regionalTaxRates: regionalTaxRates || [],
      });
    }

    await cacheService.delete(`shop:${shop._id}:taxSettings`);

    res.status(200).json({ 
      success: true, 
      message: "Tax settings saved successfully",
      taxSettings 
    });
  } catch (err) {
    logger.error(`saveTaxSettings error: ${err.message}`);
    res.status(500).json({ message: err.message });
  }
};


exports.updateRegionalTaxRate = async (req, res) => {
  try {
    const shop = req.shop;
    const { regionId } = req.params;
    const { region, taxRate } = req.body;

    if (taxRate == null || taxRate < 0 || taxRate > 100) {
      return res.status(400).json({ message: "Tax rate must be between 0 and 100" });
    }

    const taxSettings = await TaxSettings.findOne({ shop: shop._id });

    if (!taxSettings) {
      return res.status(404).json({ message: "Tax settings not found" });
    }

    const regionalTax = taxSettings.regionalTaxRates.id(regionId);

    if (!regionalTax) {
      return res.status(404).json({ message: "Regional tax rate not found" });
    }

    if (region && region.trim()) {
      regionalTax.region = region.trim();
    }
    regionalTax.taxRate = taxRate;

    await taxSettings.save();

    await cacheService.delete(`shop:${shop._id}:taxSettings`);

    res.status(200).json({ 
      success: true, 
      message: "Regional tax rate updated successfully",
      taxSettings 
    });
  } catch (err) {
    logger.error(`updateRegionalTaxRate error: ${err.message}`);
    res.status(500).json({ message: err.message });
  }
};


exports.removeRegionalTaxRate = async (req, res) => {
  try {
    const shop = req.shop;
    const { regionId } = req.params;

    const taxSettings = await TaxSettings.findOne({ shop: shop._id });

    if (!taxSettings) {
      return res.status(404).json({ message: "Tax settings not found" });
    }

    taxSettings.regionalTaxRates.pull(regionId);
    await taxSettings.save();

    await cacheService.delete(`shop:${shop._id}:taxSettings`);

    res.status(200).json({ 
      success: true, 
      message: "Regional tax rate removed successfully",
      taxSettings 
    });
  } catch (err) {
    logger.error(`removeRegionalTaxRate error: ${err.message}`);
    res.status(500).json({ message: err.message });
  }
};