const cron = require("node-cron");
const customerGroupingService = require("../services/customergroupingService");
const logger = require("../config/logger");

/**
 * Daily job to re-evaluate customer groups
 * Runs every day at 2:00 AM
 */
const startCustomerGroupingCron = () => {
  // Run daily at 2:00 AM
  cron.schedule("0 2 * * *", async () => {
    logger.info({
      event: "CUSTOMER_GROUPING_CRON_START",
      timestamp: new Date().toISOString(),
    });

    try {
      const result = await customerGroupingService.evaluateAllCustomers();

      logger.info({
        event: "CUSTOMER_GROUPING_CRON_COMPLETE",
        successCount: result.successCount,
        errorCount: result.errorCount,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.error({
        event: "CUSTOMER_GROUPING_CRON_ERROR",
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
      });
    }
  });

  logger.info({
    event: "CUSTOMER_GROUPING_CRON_REGISTERED",
    schedule: "Daily at 2:00 AM",
  });
};

module.exports = { startCustomerGroupingCron };

