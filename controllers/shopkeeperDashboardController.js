// controllers/shopAnalyticsController.js
const analyticsService = require("../services/analyticsService");
const cacheService = require("../services/cacheService");
const { successResponse, errorResponse } = require("../utils/responseHandler");
const logger = require("../config/logger");
const crypto = require("crypto");

/**
 * Get real-time dashboard stats for shopkeeper's own shop
 * Calculates percentage changes from last month
 */
exports.getDashboardStats = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = {
    route: "shopAnalyticsController.getDashboardStats",
    requestId,
    shopId: req.shop._id.toString(),
    userId: req.user.id,
  };

  logger.info({
    ...context,
    event: "DASHBOARD_STATS_REQUEST",
  });

  try {
    // Shop ID comes from checkActiveShop middleware
    const shopId = req.shop._id;
    const cacheKey = `shop:${shopId}:dashboard:stats`;

    const dashboardData = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      // Get current month stats (real-time calculation)
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      logger.debug({
        ...context,
        event: "CALCULATING_CURRENT_MONTH",
        currentMonthStart,
        currentMonthEnd,
      });

      const currentStats = await analyticsService.calculateShopAnalytics(
        shopId,
        currentMonthStart,
        currentMonthEnd,
        "monthly"
      );

      // Get last month stats for comparison
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

      logger.debug({
        ...context,
        event: "CALCULATING_LAST_MONTH",
        lastMonthStart,
        lastMonthEnd,
      });

      const lastMonthStats = await analyticsService.calculateShopAnalytics(
        shopId,
        lastMonthStart,
        lastMonthEnd,
        "monthly"
      );

      // Calculate percentage changes
      const salesChange = lastMonthStats.totalSales > 0
        ? parseFloat((((currentStats.totalSales - lastMonthStats.totalSales) / lastMonthStats.totalSales) * 100).toFixed(2))
        : currentStats.totalSales > 0 ? 100 : 0;

      const ordersChange = lastMonthStats.totalOrders > 0
        ? parseFloat((((currentStats.totalOrders - lastMonthStats.totalOrders) / lastMonthStats.totalOrders) * 100).toFixed(2))
        : currentStats.totalOrders > 0 ? 100 : 0;

      const customersChange = lastMonthStats.totalCustomers > 0
        ? parseFloat((((currentStats.totalCustomers - lastMonthStats.totalCustomers) / lastMonthStats.totalCustomers) * 100).toFixed(2))
        : currentStats.totalCustomers > 0 ? 100 : 0;

      // Get low stock products count
      const Product = require("../models/productModel");
      const lowStockProducts = await Product.countDocuments({
        shop: shopId,
        status: "active",
        $expr: { $lte: ["$currentStock", "$minStockQty"] }
      });

      const activeProducts = await Product.countDocuments({
        shop: shopId,
        status: "active"
      });

      // Get pending orders (orders with shipments for this shop that are pending/confirmed/packed)
      const Order = require("../models/Order");
      const pendingOrders = await Order.countDocuments({
        "shipments.shop": shopId,
        "shipments.status": { $in: ["pending", "confirmed", "packed"] }
      });

      const ordersToShip = await Order.countDocuments({
        "shipments.shop": shopId,
        "shipments.status": "confirmed"
      });

      // Calculate new customers percentage from total customers of this shop
      const totalCustomers = currentStats.totalCustomers || 0;
      const newCustomersThisMonth = currentStats.totalCustomers - lastMonthStats.totalCustomers;
      const newCustomersPercentage = totalCustomers > 0
        ? parseFloat(((newCustomersThisMonth / totalCustomers) * 100).toFixed(2))
        : 0;

      const dashboardData = {
        totalSales: {
          value: currentStats.totalSales,
          currency: "INR",
          percentageChange: salesChange,
          lastMonthValue: lastMonthStats.totalSales,
          trend: salesChange >= 0 ? "up" : "down"
        },

        activeProducts: {
          total: activeProducts,
          lowStock: lowStockProducts,
          percentageLowStock: activeProducts > 0
            ? parseFloat(((lowStockProducts / activeProducts) * 100).toFixed(2))
            : 0
        },

        pendingOrders: {
          total: pendingOrders,
          toShip: ordersToShip,
          percentageChange: ordersChange,
          trend: ordersChange >= 0 ? "up" : "down"
        },

        newCustomers: {
          total: newCustomersThisMonth,
          percentageOfTotal: newCustomersPercentage,
          totalCustomers: totalCustomers,
          percentageChange: customersChange,
          trend: customersChange >= 0 ? "up" : "down"
        },

        // Additional useful metrics
        averageOrderValue: currentStats.averageOrderValue,
        conversionRate: currentStats.conversionRate,
        totalOrders: currentStats.totalOrders,

        // Time period info
        period: {
          currentMonth: {
            start: currentMonthStart,
            end: currentMonthEnd
          },
          lastMonth: {
            start: lastMonthStart,
            end: lastMonthEnd
          }
        },

        // Last updated timestamp for real-time indication
        lastUpdated: new Date(),
      };

      logger.info({
        ...context,
        event: "DASHBOARD_STATS_SUCCESS",
        salesChange,
        ordersChange,
        customersChange,
        lowStockProducts,
      });

      return dashboardData;
    });

    successResponse(res, dashboardData);
  } catch (err) {
    logger.error({
      ...context,
      event: "DASHBOARD_STATS_ERROR",
      error: err.message,
      stack: err.stack,
    });
    errorResponse(res, err);
  }
};

/**
 * Get detailed analytics for a date range
 * Shopkeeper can only see their own shop's data
 */
exports.getAnalyticsRange = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = {
    route: "shopAnalyticsController.getAnalyticsRange",
    requestId,
    shopId: req.shop._id.toString(),
  };

  logger.info({
    ...context,
    event: "ANALYTICS_RANGE_REQUEST",
    query: req.query,
  });

  try {
    const shopId = req.shop._id;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      logger.error({
        ...context,
        event: "MISSING_DATE_PARAMETERS",
      });
      return res.status(400).json({
        message: "startDate and endDate are required"
      });
    }

    const cacheKey = `shop:${shopId}:analytics:range:${startDate}:${endDate}`;
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.DEFAULT, async () => {
      const analytics = await analyticsService.getShopAnalyticsRange(
        shopId,
        startDate,
        endDate
      );

      logger.info({
        ...context,
        event: "ANALYTICS_RANGE_SUCCESS",
        recordCount: analytics.length,
      });

      return {
        analytics,
        period: { startDate, endDate },
        shopId: shopId.toString(),
      };
    });

    successResponse(res, responseData);
  } catch (err) {
    logger.error({
      ...context,
      event: "ANALYTICS_RANGE_ERROR",
      error: err.message,
      stack: err.stack,
    });
    errorResponse(res, err);
  }
};

/**
 * Get product performance analytics for shopkeeper's products
 */
exports.getProductAnalytics = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = {
    route: "shopAnalyticsController.getProductAnalytics",
    requestId,
    shopId: req.shop._id.toString(),
  };

  logger.info({
    ...context,
    event: "PRODUCT_ANALYTICS_REQUEST",
    params: req.params,
    query: req.query,
  });

  try {
    const shopId = req.shop._id;
    const { productId } = req.params;
    const { startDate, endDate } = req.query;

    // Verify product belongs to this shop
    const Product = require("../models/productModel");
    const product = await Product.findOne({
      _id: productId,
      shop: shopId
    });

    if (!product) {
      logger.error({
        ...context,
        event: "PRODUCT_NOT_FOUND_OR_UNAUTHORIZED",
        productId,
      });
      return res.status(404).json({
        message: "Product not found or you don't have access"
      });
    }

    if (!startDate || !endDate) {
      logger.error({
        ...context,
        event: "MISSING_DATE_PARAMETERS",
      });
      return res.status(400).json({
        message: "startDate and endDate are required"
      });
    }

    const cacheKey = `shop:${shopId}:product:${productId}:analytics:${startDate}:${endDate}`;
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.DEFAULT, async () => {
      const analytics = await analyticsService.calculateProductAnalytics(
        shopId,
        productId,
        startDate,
        endDate
      );

      logger.info({
        ...context,
        event: "PRODUCT_ANALYTICS_SUCCESS",
        productId,
      });

      return {
        analytics,
        product: {
          id: product._id,
          name: product.productName,
          currentStock: product.currentStock,
        },
        period: { startDate, endDate },
      };
    });

    successResponse(res, responseData);
  } catch (err) {
    logger.error({
      ...context,
      event: "PRODUCT_ANALYTICS_ERROR",
      error: err.message,
      stack: err.stack,
    });
    errorResponse(res, err);
  }
};

/**
 * Get top performing products for shopkeeper's shop
 */
exports.getTopProducts = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = {
    route: "shopAnalyticsController.getTopProducts",
    requestId,
    shopId: req.shop._id.toString(),
  };

  logger.info({
    ...context,
    event: "TOP_PRODUCTS_REQUEST",
    query: req.query,
  });

  try {
    const shopId = req.shop._id;
    const { period = "month", limit = 10 } = req.query;

    const cacheKey = `shop:${shopId}:top_products:${period}:${limit}`;
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.DEFAULT, async () => {
      let startDate, endDate;
      const now = new Date();

      switch (period) {
        case "week":
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case "month":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case "year":
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);

      const analytics = await analyticsService.calculateShopAnalytics(
        shopId,
        startDate,
        endDate,
        "custom"
      );

      const topProducts = analytics.topProducts.slice(0, parseInt(limit));

      logger.info({
        ...context,
        event: "TOP_PRODUCTS_SUCCESS",
        productCount: topProducts.length,
        period,
      });

      return {
        topProducts,
        period: { startDate, endDate, type: period },
        totalProducts: analytics.topProducts.length,
      };
    });

    successResponse(res, responseData);
  } catch (err) {
    logger.error({
      ...context,
      event: "TOP_PRODUCTS_ERROR",
      error: err.message,
      stack: err.stack,
    });
    errorResponse(res, err);
  }
};