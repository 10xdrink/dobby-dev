const FedexIntegration = require("../models/FedxIntegration");
const Shop = require("../models/Shop");
const logger = require("../config/logger");

class FedexService {
  static async upsertIntegration(shopkeeperId, data) {
    logger.info("[FedExService] Upsert integration started", {
      shopkeeperId,
      data: { ...data, clientSecret: data.clientSecret ? "***" : undefined }, // mask secret
    });

    try {
      
      const shop = await Shop.findOne({ owner: shopkeeperId, status: "active" });
      if (!shop) {
        logger.warn("[FedExService] No active shop found", { shopkeeperId });
        const err = new Error("Active shop required for FedEx integration");
        err.status = 403;
        throw err;
      }

      
      const existing = await FedexIntegration.findOne({ shopkeeper: shopkeeperId });
      if (existing) {
        logger.info("[FedExService] Existing integration found, updating...", {
          shopkeeperId,
          integrationId: existing._id,
        });

        Object.assign(existing, data);
        if (data.clientSecret) existing.clientSecret = data.clientSecret;

        await existing.save();

        logger.info("[FedExService] Integration updated successfully", {
          shopkeeperId,
          integrationId: existing._id,
        });
        return existing;
      } else {
        logger.info("[FedExService] No integration found, creating new record", {
          shopkeeperId,
        });

        const newRec = new FedexIntegration({ shopkeeper: shopkeeperId, ...data });
        await newRec.save();

        logger.info("[FedExService] Integration created successfully", {
          shopkeeperId,
          integrationId: newRec._id,
        });
        return newRec;
      }
    } catch (error) {
      logger.error("[FedExService] Upsert integration failed", {
        shopkeeperId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  static async getIntegration(shopkeeperId) {
    logger.info("[FedExService] Fetching FedEx integration", { shopkeeperId });

    try {
      
      const shop = await Shop.findOne({ owner: shopkeeperId, status: "active" });
      if (!shop) {
        logger.warn("[FedExService] No active shop found", { shopkeeperId });
        const err = new Error("Active shop required to view FedEx integration");
        err.status = 403;
        throw err;
      }

      
      const integration = await FedexIntegration.findOne({ shopkeeper: shopkeeperId }).select(
        "-clientSecret"
      );

      if (integration) {
        logger.info("[FedExService] Integration fetched successfully", {
          shopkeeperId,
          integrationId: integration._id,
        });
      } else {
        logger.warn("[FedExService] No FedEx integration found", { shopkeeperId });
      }

      return integration;
    } catch (error) {
      logger.error("[FedExService] Failed to fetch integration", {
        shopkeeperId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

module.exports = FedexService;
