const cron = require("node-cron");
const PricingRule = require("../models/PricingRule");
const logger = require("../config/logger");

/**
 * Auto-activate pricing rules that have reached their start date
 * Auto-expire pricing rules that have passed their end date
 * Runs every hour
 */
const pricingRuleCron = cron.schedule("0 * * * *", async () => {
  const context = {
    service: "PricingRuleCron",
    timestamp: new Date().toISOString(),
  };

  try {
    logger.info({
      ...context,
      event: "PRICING_RULE_CRON_START",
    });

    // Auto-activate rules
    const activateResult = await PricingRule.autoActivateRules();
    
    logger.info({
      ...context,
      event: "RULES_AUTO_ACTIVATED",
      count: activateResult.modifiedCount,
    });

    // Auto-expire rules
    const expireResult = await PricingRule.autoExpireRules();
    
    logger.info({
      ...context,
      event: "RULES_AUTO_EXPIRED",
      count: expireResult.modifiedCount,
    });

    logger.info({
      ...context,
      event: "PRICING_RULE_CRON_COMPLETE",
      activated: activateResult.modifiedCount,
      expired: expireResult.modifiedCount,
    });
  } catch (err) {
    logger.error({
      ...context,
      event: "PRICING_RULE_CRON_ERROR",
      error: err.message,
      stack: err.stack,
    });
  }
});

module.exports = pricingRuleCron;

