const TaxSettings = require("../models/TaxSettings");
const Address = require("../models/Address");
const logger = require("../config/logger");

class TaxService {
  /**
   * Get tax rate for a specific shop and customer's region
   * @param {String} shopId - Shop ID
   * @param {String} customerId - Customer ID
   * @param {String} addressId - Address ID (optional)
   * @returns {Object} { taxRate, region, taxCalculationMethod }
   */
  async getTaxRateForCustomer(shopId, customerId, addressId = null) {
    try {
      // Get shop's tax settings
      const taxSettings = await TaxSettings.findOne({ shop: shopId });
      
      if (!taxSettings) {
        logger.warn(`No tax settings found for shop ${shopId}, using default 18%`);
        return {
          taxRate: 18,
          region: null,
          taxCalculationMethod: "exclude_shipping",
        };
      }

      // Get customer's address to determine region
      let customerAddress;
      
      if (addressId) {
        customerAddress = await Address.findOne({
          _id: addressId,
          customer: customerId,
        });
      } else {
        // Get default shipping address
        customerAddress = await Address.findOne({
          customer: customerId,
          type: "shipping",
          isDefault: true,
        });
      }

      if (!customerAddress || !customerAddress.state) {
        logger.warn(`No address/state found for customer ${customerId}, using default tax rate`);
        return {
          taxRate: taxSettings.defaultTaxRate,
          region: null,
          taxCalculationMethod: taxSettings.taxCalculationMethod,
        };
      }

      // Find matching regional tax rate (case-insensitive)
      const customerState = customerAddress.state.toLowerCase().trim();
      const regionalTax = taxSettings.regionalTaxRates.find(
        (rt) => rt.region.toLowerCase().trim() === customerState
      );

      if (regionalTax) {
        logger.debug(`Found regional tax for ${customerState}: ${regionalTax.taxRate}%`);
        return {
          taxRate: regionalTax.taxRate,
          region: customerAddress.state,
          taxCalculationMethod: taxSettings.taxCalculationMethod,
        };
      }

      // No regional match, use default
      logger.debug(`No regional tax found for ${customerState}, using default ${taxSettings.defaultTaxRate}%`);
      return {
        taxRate: taxSettings.defaultTaxRate,
        region: customerAddress.state,
        taxCalculationMethod: taxSettings.taxCalculationMethod,
      };
    } catch (err) {
      logger.error(`getTaxRateForCustomer error: ${err.message}`);
      // Fallback to default
      return {
        taxRate: 18,
        region: null,
        taxCalculationMethod: "exclude_shipping",
      };
    }
  }

  /**
   * Calculate tax amount based on settings
   * @param {Number} amount - Base amount
   * @param {Number} taxRate - Tax rate percentage
   * @param {String} taxType - "inclusive" or "exclusive"
   * @returns {Object} { taxAmount, amountWithTax, baseAmount }
   */
  calculateTax(amount, taxRate, taxType = "exclusive") {
    if (taxType === "inclusive") {
      // Tax is already included in amount
      // Extract tax: tax = amount - (amount / (1 + rate/100))
      const baseAmount = amount / (1 + taxRate / 100);
      const taxAmount = amount - baseAmount;
      return {
        taxAmount: Math.round(taxAmount * 100) / 100,
        amountWithTax: amount,
        baseAmount: Math.round(baseAmount * 100) / 100,
      };
    } else {
      // Tax is exclusive, add to amount
      const taxAmount = (amount * taxRate) / 100;
      const amountWithTax = amount + taxAmount;
      return {
        taxAmount: Math.round(taxAmount * 100) / 100,
        amountWithTax: Math.round(amountWithTax * 100) / 100,
        baseAmount: amount,
      };
    }
  }
}

module.exports = new TaxService();