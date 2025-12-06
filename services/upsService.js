const UpsIntegration = require("../models/UpsIntegration");
const Shop = require("../models/Shop");
const logger = require("../config/logger");

class UpsService {
  static async upsertIntegration(shopkeeperId, data) {
    logger.info("[UPSService] Upsert integration", { shopkeeperId });

    const shop = await Shop.findOne({ owner: shopkeeperId, status: "active" });
    if (!shop) {
      const err = new Error("Active shop required for UPS integration");
      err.status = 403;
      throw err;
    }

    const existing = await UpsIntegration.findOne({ shopkeeper: shopkeeperId });
    if (existing) {
      Object.assign(existing, data);
      if (data.clientSecret) existing.clientSecret = data.clientSecret;
      await existing.save();
      logger.info("[UPSService] Integration updated");
      return existing;
    } else {
      const newRec = new UpsIntegration({ shopkeeper: shopkeeperId, ...data });
      await newRec.save();
      logger.info("[UPSService] Integration created");
      return newRec;
    }
  }

  static async getIntegration(shopkeeperId) {
    const integration = await UpsIntegration.findOne({ shopkeeper: shopkeeperId }).select("-clientSecret");
    return integration;
  }
}

module.exports = UpsService;
