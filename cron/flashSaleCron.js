const cron = require("node-cron");
const { updateFlashSaleStatuses } = require("../controllers/flashsaleController");
const logger = require("../config/logger");

// Run every 5 minutes to check and update flash sale statuses
// Cron pattern: */5 * * * * = Every 5 minutes
// You can change to */1 * * * * for every 1 minute during testing
const flashSaleCron = cron.schedule(
  "*/5 * * * *",
  async () => {
    const startTime = new Date();
    
    try {
      logger.info({
        event: "FLASH_SALE_CRON_STARTED",
        time: startTime.toISOString(),
        nextRun: "5 minutes"
      });

      const result = await updateFlashSaleStatuses();

      const endTime = new Date();
      const duration = endTime - startTime;

      logger.info({
        event: "FLASH_SALE_CRON_COMPLETED",
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: `${duration}ms`,
        result: {
          activated: result.activated,
          expired: result.expired,
        }
      });

      // Log summary if any changes were made
      if (result.activated > 0 || result.expired > 0) {
        logger.info({
          event: "FLASH_SALE_STATUS_CHANGES",
          activated: result.activated,
          expired: result.expired,
          message: `${result.activated} flash sale(s) activated, ${result.expired} flash sale(s) expired`
        });
      }
    } catch (err) {
      logger.error({
        event: "FLASH_SALE_CRON_ERROR",
        error: err.message,
        stack: err.stack,
        time: new Date().toISOString()
      });
    }
  },
  {
    scheduled: false, // Don't start automatically, we'll call .start()
    timezone: "Asia/Kolkata" // Indian timezone
  }
);

module.exports = flashSaleCron;