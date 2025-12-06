// jobs/analyticsJob.js
const cron = require("node-cron");
const Shop = require("../models/Shop");
const analyticsService = require("../services/analyticsService");
const logger = require("../config/logger");
const crypto = require("crypto");

class AnalyticsJob {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Initialize all cron jobs
   */
  init() {
    logger.info({
      event: "ANALYTICS_CRON_INIT",
      message: "Initializing analytics cron jobs",
    });

    // Run every hour to update current day analytics
    this.scheduleHourlyUpdate();

    // Run at midnight to finalize previous day and start new day
    this.scheduleDailyFinalization();

    // Run every 6 hours to recalculate metrics
    this.schedulePeriodicRecalculation();

    logger.info({
      event: "ANALYTICS_CRON_INITIALIZED",
      message: "All analytics cron jobs scheduled",
    });
  }

  /**
   * Run every hour (0 minutes past the hour)
   * Updates current day analytics for all active shops
   */
  scheduleHourlyUpdate() {
    cron.schedule("0 * * * *", async () => {
      if (this.isRunning) {
        logger.warn({
          event: "HOURLY_UPDATE_SKIPPED",
          message: "Previous job still running",
        });
        return;
      }

      const requestId = crypto.randomBytes(8).toString("hex");
      const context = {
        route: "AnalyticsJob.hourlyUpdate",
        requestId,
      };

      this.isRunning = true;

      logger.info({
        ...context,
        event: "HOURLY_ANALYTICS_UPDATE_START",
        time: new Date().toISOString(),
      });

      try {
        const activeShops = await Shop.find({ status: "active" });

        logger.info({
          ...context,
          event: "ACTIVE_SHOPS_FOUND",
          count: activeShops.length,
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const now = new Date();

        let successCount = 0;
        let failCount = 0;

        for (const shop of activeShops) {
          try {
            logger.debug({
              ...context,
              event: "UPDATING_SHOP_ANALYTICS",
              shopId: shop._id.toString(),
              shopName: shop.shopName,
            });

            await analyticsService.calculateShopAnalytics(
              shop._id,
              today,
              now,
              "daily"
            );

            successCount++;

            logger.info({
              ...context,
              event: "SHOP_ANALYTICS_UPDATED",
              shopId: shop._id.toString(),
              shopName: shop.shopName,
            });
          } catch (shopErr) {
            failCount++;

            logger.error({
              ...context,
              event: "SHOP_ANALYTICS_UPDATE_FAILED",
              shopId: shop._id.toString(),
              shopName: shop.shopName,
              error: shopErr.message,
              stack: shopErr.stack,
            });
          }
        }

        logger.info({
          ...context,
          event: "HOURLY_ANALYTICS_UPDATE_COMPLETE",
          totalShops: activeShops.length,
          successCount,
          failCount,
          duration: Date.now() - new Date(context.startTime),
        });
      } catch (err) {
        logger.error({
          ...context,
          event: "HOURLY_ANALYTICS_UPDATE_ERROR",
          error: err.message,
          stack: err.stack,
        });
      } finally {
        this.isRunning = false;
      }
    });

    logger.info({
      event: "HOURLY_UPDATE_SCHEDULED",
      schedule: "Every hour at 0 minutes",
    });
  }

  /**
   * Run at midnight (00:00) every day
   * Finalizes the previous day's analytics
   */
  scheduleDailyFinalization() {
    cron.schedule("0 0 * * *", async () => {
      const requestId = crypto.randomBytes(8).toString("hex");
      const context = {
        route: "AnalyticsJob.dailyFinalization",
        requestId,
      };

      logger.info({
        ...context,
        event: "DAILY_ANALYTICS_FINALIZATION_START",
        time: new Date().toISOString(),
      });

      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const endOfYesterday = new Date(yesterday);
        endOfYesterday.setHours(23, 59, 59, 999);

        const activeShops = await Shop.find({ status: "active" });

        logger.info({
          ...context,
          event: "FINALIZING_YESTERDAY_ANALYTICS",
          date: yesterday.toISOString().split('T')[0],
          shopCount: activeShops.length,
        });

        let successCount = 0;
        let failCount = 0;

        for (const shop of activeShops) {
          try {
            await analyticsService.calculateShopAnalytics(
              shop._id,
              yesterday,
              endOfYesterday,
              "daily"
            );

            successCount++;

            logger.info({
              ...context,
              event: "SHOP_YESTERDAY_FINALIZED",
              shopId: shop._id.toString(),
              date: yesterday.toISOString().split('T')[0],
            });
          } catch (shopErr) {
            failCount++;

            logger.error({
              ...context,
              event: "SHOP_YESTERDAY_FINALIZATION_FAILED",
              shopId: shop._id.toString(),
              error: shopErr.message,
            });
          }
        }

        logger.info({
          ...context,
          event: "DAILY_FINALIZATION_COMPLETE",
          date: yesterday.toISOString().split('T')[0],
          successCount,
          failCount,
        });
      } catch (err) {
        logger.error({
          ...context,
          event: "DAILY_FINALIZATION_ERROR",
          error: err.message,
          stack: err.stack,
        });
      }
    });

    logger.info({
      event: "DAILY_FINALIZATION_SCHEDULED",
      schedule: "Every day at midnight (00:00)",
    });
  }

  /**
   * Run every 6 hours
   * Recalculates metrics for active shops
   */
  schedulePeriodicRecalculation() {
    cron.schedule("0 */6 * * *", async () => {
      const requestId = crypto.randomBytes(8).toString("hex");
      const context = {
        route: "AnalyticsJob.periodicRecalculation",
        requestId,
      };

      logger.info({
        ...context,
        event: "PERIODIC_RECALCULATION_START",
        time: new Date().toISOString(),
      });

      try {
        const activeShops = await Shop.find({ status: "active" });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const now = new Date();

        logger.info({
          ...context,
          event: "RECALCULATING_TODAY_ANALYTICS",
          shopCount: activeShops.length,
        });

        let successCount = 0;
        let failCount = 0;

        for (const shop of activeShops) {
          try {
            await analyticsService.calculateShopAnalytics(
              shop._id,
              today,
              now,
              "daily"
            );

            successCount++;

            logger.debug({
              ...context,
              event: "SHOP_RECALCULATED",
              shopId: shop._id.toString(),
            });
          } catch (shopErr) {
            failCount++;

            logger.error({
              ...context,
              event: "SHOP_RECALCULATION_FAILED",
              shopId: shop._id.toString(),
              error: shopErr.message,
            });
          }
        }

        logger.info({
          ...context,
          event: "PERIODIC_RECALCULATION_COMPLETE",
          successCount,
          failCount,
        });
      } catch (err) {
        logger.error({
          ...context,
          event: "PERIODIC_RECALCULATION_ERROR",
          error: err.message,
          stack: err.stack,
        });
      }
    });

    logger.info({
      event: "PERIODIC_RECALCULATION_SCHEDULED",
      schedule: "Every 6 hours",
    });
  }

  /**
   * Manual trigger for analytics update (useful for testing or admin actions)
   */
  async triggerManualUpdate(shopId = null) {
    const requestId = crypto.randomBytes(8).toString("hex");
    const context = {
      route: "AnalyticsJob.manualUpdate",
      requestId,
      shopId,
    };

    logger.info({
      ...context,
      event: "MANUAL_ANALYTICS_UPDATE_START",
    });

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const now = new Date();

      if (shopId) {
        // Update specific shop
        const shop = await Shop.findById(shopId);
        
        if (!shop) {
          throw new Error(`Shop not found: ${shopId}`);
        }

        if (shop.status !== "active") {
          throw new Error(`Shop is not active: ${shopId}`);
        }

        await analyticsService.calculateShopAnalytics(
          shopId,
          today,
          now,
          "daily"
        );

        logger.info({
          ...context,
          event: "MANUAL_UPDATE_SUCCESS",
          shopId: shop._id.toString(),
        });

        return { success: true, shopId: shop._id };
      } else {
        // Update all active shops
        const activeShops = await Shop.find({ status: "active" });

        let successCount = 0;
        let failCount = 0;
        const results = [];

        for (const shop of activeShops) {
          try {
            await analyticsService.calculateShopAnalytics(
              shop._id,
              today,
              now,
              "daily"
            );

            successCount++;
            results.push({ shopId: shop._id, success: true });
          } catch (shopErr) {
            failCount++;
            results.push({ 
              shopId: shop._id, 
              success: false, 
              error: shopErr.message 
            });

            logger.error({
              ...context,
              event: "SHOP_MANUAL_UPDATE_FAILED",
              shopId: shop._id.toString(),
              error: shopErr.message,
            });
          }
        }

        logger.info({
          ...context,
          event: "MANUAL_UPDATE_ALL_COMPLETE",
          totalShops: activeShops.length,
          successCount,
          failCount,
        });

        return { 
          success: true, 
          total: activeShops.length,
          successCount,
          failCount,
          results 
        };
      }
    } catch (err) {
      logger.error({
        ...context,
        event: "MANUAL_UPDATE_ERROR",
        error: err.message,
        stack: err.stack,
      });

      throw err;
    }
  }
}

module.exports = new AnalyticsJob();


// Initialize in your main app.js or server.js
// const analyticsJob = require("./jobs/analyticsJob");
// analyticsJob.init();