// controllers/graphAnalyticsController.js
const Shop = require("../models/Shop");
const graphAnalyticsService = require("../services/graphanalyticsService");
const cacheService = require("../services/cacheService");
const logger = require("../config/logger");
const crypto = require("crypto");

/**
 * Get Sales Over Time Graph Data
 */
exports.getSalesOverTimeGraph = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = {
    route: "graphAnalyticsController.getSalesOverTimeGraph",
    requestId,
    userId: req.user?.id,
  };

  logger.info({
    ...context,
    event: "GET_SALES_OVER_TIME_GRAPH_START",
    query: req.query,
  });

  try {
    const userId = req.user.id;
    const { startDate, endDate, groupBy = "daily" } = req.query;

    // Validate inputs
    if (!startDate || !endDate) {
      logger.warn({
        ...context,
        event: "MISSING_DATE_PARAMETERS",
        startDate,
        endDate,
      });

      return res.status(400).json({
        success: false,
        message: "startDate and endDate are required",
      });
    }

    if (!["daily", "weekly", "monthly"].includes(groupBy)) {
      logger.warn({
        ...context,
        event: "INVALID_GROUP_BY",
        groupBy,
      });

      return res.status(400).json({
        success: false,
        message: "groupBy must be 'daily', 'weekly', or 'monthly'",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD",
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: "startDate must be before endDate",
      });
    }

    // Find shopkeeper's active shop
    const shop = await Shop.findOne({ owner: userId, status: "active" });

    if (!shop) {
      logger.warn({
        ...context,
        event: "SHOP_NOT_FOUND_OR_INACTIVE",
        userId,
      });

      return res.status(403).json({
        success: false,
        message: "Your shop is not active",
      });
    }

    const shopId = shop._id;

    logger.info({
      ...context,
      event: "SHOP_FOUND",
      shopId: shopId.toString(),
      shopName: shop.shopName,
    });

    const cacheKey = `shop:${shopId}:salesGraph:${groupBy}:${startDate}:${endDate}`;
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.DEFAULT, async () => {
      // Get sales over time data
      const data = await graphAnalyticsService.getSalesOverTime(
        shopId,
        start,
        end,
        groupBy
      );

      logger.info({
        ...context,
        event: "SALES_OVER_TIME_GRAPH_SUCCESS",
        shopId: shopId.toString(),
        dataPoints: data.length,
      });

      return {
        success: true,
        shopId: shopId.toString(),
        shopName: shop.shopName,
        period: {
          startDate: start.toISOString().split("T")[0],
          endDate: end.toISOString().split("T")[0],
          groupBy,
        },
        data,
      };
    });

    res.status(200).json(responseData);
  } catch (err) {
    logger.error({
      ...context,
      event: "GET_SALES_OVER_TIME_GRAPH_ERROR",
      error: err.message,
      stack: err.stack,
    });

    res.status(500).json({
      success: false,
      message: "Error fetching sales over time data",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

/**
 * Get Sales by Category Graph Data
 */
exports.getSalesByCategoryGraph = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = {
    route: "graphAnalyticsController.getSalesByCategoryGraph",
    requestId,
    userId: req.user?.id,
  };

  logger.info({
    ...context,
    event: "GET_SALES_BY_CATEGORY_GRAPH_START",
    query: req.query,
  });

  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    // Validate inputs
    if (!startDate || !endDate) {
      logger.warn({
        ...context,
        event: "MISSING_DATE_PARAMETERS",
        startDate,
        endDate,
      });

      return res.status(400).json({
        success: false,
        message: "startDate and endDate are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD",
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: "startDate must be before endDate",
      });
    }

    // Find shopkeeper's active shop
    const shop = await Shop.findOne({ owner: userId, status: "active" });

    if (!shop) {
      logger.warn({
        ...context,
        event: "SHOP_NOT_FOUND_OR_INACTIVE",
        userId,
      });

      return res.status(403).json({
        success: false,
        message: "Your shop is not active",
      });
    }

    const shopId = shop._id;

    logger.info({
      ...context,
      event: "SHOP_FOUND",
      shopId: shopId.toString(),
      shopName: shop.shopName,
    });

    const cacheKey = `shop:${shopId}:categoryGraph:${startDate}:${endDate}`;
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.DEFAULT, async () => {
      // Get sales by category data
      const data = await graphAnalyticsService.getSalesByCategory(
        shopId,
        start,
        end
      );

      logger.info({
        ...context,
        event: "SALES_BY_CATEGORY_GRAPH_SUCCESS",
        shopId: shopId.toString(),
        categoriesCount: data.length,
      });

      return {
        success: true,
        shopId: shopId.toString(),
        shopName: shop.shopName,
        period: {
          startDate: start.toISOString().split("T")[0],
          endDate: end.toISOString().split("T")[0],
        },
        data,
      };
    });

    res.status(200).json(responseData);
  } catch (err) {
    logger.error({
      ...context,
      event: "GET_SALES_BY_CATEGORY_GRAPH_ERROR",
      error: err.message,
      stack: err.stack,
    });

    res.status(500).json({
      success: false,
      message: "Error fetching sales by category data",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};