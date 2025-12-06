const ShiprocketIntegration = require("../models/ShiprocketIntegration");
const Shop = require("../models/Shop");
const logger = require("../config/logger");

class ShiprocketService {
  /**
   * Internal: create or update integration
   */
  static async integrateShiprocket(shopkeeperId, data) {
    try {
      logger.info("Starting Shiprocket integration", {
        shopkeeperId,
        email: data.shiprocketEmail,
      });

      const existing = await ShiprocketIntegration.findOne({ shopkeeper: shopkeeperId });

      if (existing) {
        logger.info("Existing Shiprocket integration found — updating record", { shopkeeperId });

        Object.assign(existing, data);

        if (data.shiprocketPassword) {
          existing.shiprocketPassword = data.shiprocketPassword; // will encrypt in pre-save
          logger.debug("Shiprocket password updated for shopkeeper", { shopkeeperId });
        }

        await existing.save();
        logger.info("Shiprocket integration updated successfully", { shopkeeperId });

        return existing;
      } else {
        logger.info("No integration found — creating new Shiprocket integration", { shopkeeperId });

        const newIntegration = new ShiprocketIntegration({
          shopkeeper: shopkeeperId,
          ...data,
        });

        await newIntegration.save();
        logger.info("New Shiprocket integration created successfully", { shopkeeperId });

        return newIntegration;
      }
    } catch (error) {
      logger.error("Error during Shiprocket integration", {
        shopkeeperId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Internal: fetch integration (without password)
   */
  static async getShiprocketIntegration(shopkeeperId) {
    try {
      logger.info("Fetching Shiprocket integration", { shopkeeperId });

      const integration = await ShiprocketIntegration.findOne({ shopkeeper: shopkeeperId }).select(
        "-shiprocketPassword"
      );

      if (!integration) {
        logger.warn("No Shiprocket integration found for shopkeeper", { shopkeeperId });
      } else {
        logger.info("Shiprocket integration fetched successfully", { shopkeeperId });
      }

      return integration;
    } catch (error) {
      logger.error("Error fetching Shiprocket integration", {
        shopkeeperId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Verify stored password (optional helper)
   */
  static async verifyPassword(shopkeeperId, plainPassword) {
    try {
      logger.debug("Verifying Shiprocket password for shopkeeper", { shopkeeperId });

      const record = await ShiprocketIntegration.findOne({ shopkeeper: shopkeeperId });
      if (!record) {
        logger.warn("No Shiprocket integration found during password verification", { shopkeeperId });
        return false;
      }

      const decrypted = record.getDecryptedPassword ? record.getDecryptedPassword() : null;
      const isMatch = decrypted === plainPassword;

      logger.debug("Shiprocket password verification result", { shopkeeperId, isMatch });
      return isMatch;
    } catch (error) {
      logger.error("Error verifying Shiprocket password", {
        shopkeeperId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * PUBLIC wrappers with safety check
   */
  static async upsertIntegration(shopkeeperId, data) {
    const shop = await Shop.findOne({ owner: shopkeeperId, status: "active" });
    if (!shop) {
      const err = new Error("Active shop required for Shiprocket integration");
      err.status = 403;
      throw err;
    }
    return this.integrateShiprocket(shopkeeperId, data);
  }

  static async getIntegration(shopkeeperId) {
    const shop = await Shop.findOne({ owner: shopkeeperId, status: "active" });
    if (!shop) {
      const err = new Error("Active shop required to view Shiprocket integration");
      err.status = 403;
      throw err;
    }
    return this.getShiprocketIntegration(shopkeeperId);
  }
}

module.exports = ShiprocketService;
