const Shop = require("../models/Shop");
const analyticsService = require("../services/analyticsService");
const cacheService = require("../services/cacheService");
const logger = require("../config/logger");
const crypto = require("crypto");


exports.getMyShopAnalytics = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = {
    route: "shopkeeperAnalyticsController.getMyShopAnalytics",
    requestId,
    userId: req.user?.id,
  };

  logger.info({
    ...context,
    event: "GET_SHOP_ANALYTICS_START",
  });

  try {
    const userId = req.user.id;

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
        message: "Your shop is not active. Please activate your shop to view analytics.",
      });
    }

    const shopId = shop._id;

    logger.info({
      ...context,
      event: "SHOP_FOUND",
      shopId: shopId.toString(),
      shopName: shop.shopName,
    });

    const cacheKey = `shop:${shopId}:myAnalytics:current`;
    const response = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      // Get current analytics (today)
      const analytics = await analyticsService.getCurrentShopAnalytics(shopId);

      logger.info({
        ...context,
        event: "ANALYTICS_RETRIEVED",
        shopId: shopId.toString(),
        totalSales: analytics.totalSales,
        totalOrders: analytics.totalOrders,
      });

      // Format response
      return {
        success: true,
        shopId: shopId.toString(),
        shopName: shop.shopName,
        period: "today",
        data: {
          stats: {
            totalSales: analytics.totalSales,
            totalOrders: analytics.totalOrders,
            averageOrderValue: analytics.averageOrderValue,
            conversionRate: analytics.conversionRate,
            salesGrowth: analytics.salesGrowth,
            ordersGrowth: analytics.ordersGrowth,
          },
          abandonedCart: {
            totalAbandoned: analytics.totalAbandonedCarts,
            recovered: analytics.recoveredCarts,
            conversionRate: analytics.conversionRate,
          },
          topProducts: analytics.topProducts.map((item, index) => ({
            sno: index + 1,
            productName: item.productName,
            category: item.category?.name || "Uncategorized",
            unitsSold: item.unitsSold,
            revenue: item.revenue,
            percentageOfSales: item.percentageOfSales,
            stockLevel: this._getStockStatus(item.currentStock),
            currentStock: item.currentStock,
          })),
          metrics: {
            totalRevenue: analytics.totalRevenue,
            totalCustomers: analytics.totalCustomers,
          },
        },
        calculatedAt: analytics.updatedAt,
      };
    });

    logger.info({
      ...context,
      event: "GET_SHOP_ANALYTICS_SUCCESS",
      shopId: shopId.toString(),
      topProductsCount: response.data.topProducts.length,
    });

    res.status(200).json(response);
  } catch (err) {
    logger.error({
      ...context,
      event: "GET_SHOP_ANALYTICS_ERROR",
      error: err.message,
      stack: err.stack,
    });

    res.status(500).json({
      success: false,
      message: "Error fetching shop analytics",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

exports.getMyShopAnalyticsByDateRange = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = {
    route: "shopkeeperAnalyticsController.getMyShopAnalyticsByDateRange",
    requestId,
    userId: req.user?.id,
  };

  logger.info({
    ...context,
    event: "GET_ANALYTICS_BY_DATE_RANGE_START",
    query: req.query,
  });

  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    // Validate dates
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
      logger.warn({
        ...context,
        event: "INVALID_DATE_FORMAT",
        startDate,
        endDate,
      });

      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD",
      });
    }

    if (start > end) {
      logger.warn({
        ...context,
        event: "INVALID_DATE_RANGE",
        startDate,
        endDate,
      });

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
        message: "Your shop is not active. Please activate your shop to view analytics.",
      });
    }

    const shopId = shop._id;

    logger.info({
      ...context,
      event: "SHOP_FOUND",
      shopId: shopId.toString(),
      shopName: shop.shopName,
      startDate,
      endDate,
    });

    const cacheKey = `shop:${shopId}:myAnalytics:${startDate}:${endDate}`;
    const response = await cacheService.remember(cacheKey, cacheService.TTL.DEFAULT, async () => {
      // Calculate analytics for the date range
      const analytics = await analyticsService.calculateShopAnalytics(
        shopId,
        start,
        end,
        "custom"
      );

      logger.info({
        ...context,
        event: "ANALYTICS_CALCULATED",
        shopId: shopId.toString(),
        totalSales: analytics.totalSales,
        totalOrders: analytics.totalOrders,
      });

      // Format response
      return {
        success: true,
        shopId: shopId.toString(),
        shopName: shop.shopName,
        period: {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
        },
        data: {
          stats: {
            totalSales: analytics.totalSales,
            totalOrders: analytics.totalOrders,
            averageOrderValue: analytics.averageOrderValue,
            conversionRate: analytics.conversionRate,
            salesGrowth: analytics.salesGrowth,
            ordersGrowth: analytics.ordersGrowth,
          },
          abandonedCart: {
            totalAbandoned: analytics.totalAbandonedCarts,
            recovered: analytics.recoveredCarts,
            conversionRate: analytics.conversionRate,
          },
          topProducts: analytics.topProducts.map((item, index) => ({
            sno: index + 1,
            productName: item.productName,
            category: item.category?.name || "Uncategorized",
            unitsSold: item.unitsSold,
            revenue: item.revenue,
            percentageOfSales: item.percentageOfSales,
            stockLevel: this._getStockStatus(item.currentStock),
            currentStock: item.currentStock,
          })),
          metrics: {
            totalRevenue: analytics.totalRevenue,
            totalCustomers: analytics.totalCustomers,
          },
        },
        calculatedAt: analytics.updatedAt,
      };
    });

    logger.info({
      ...context,
      event: "GET_ANALYTICS_BY_DATE_RANGE_SUCCESS",
      shopId: shopId.toString(),
      topProductsCount: response.data.topProducts.length,
    });

    res.status(200).json(response);
  } catch (err) {
    logger.error({
      ...context,
      event: "GET_ANALYTICS_BY_DATE_RANGE_ERROR",
      error: err.message,
      stack: err.stack,
    });

    res.status(500).json({
      success: false,
      message: "Error fetching shop analytics",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

exports.getMyTopSellingProducts = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = {
    route: "shopkeeperAnalyticsController.getMyTopSellingProducts",
    requestId,
    userId: req.user?.id,
  };

  logger.info({
    ...context,
    event: "GET_TOP_SELLING_PRODUCTS_START",
  });

  try {
    const userId = req.user.id;
    const { limit = 10 } = req.query;

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
        message: "Your shop is not active. Please activate your shop to view products.",
      });
    }

    const shopId = shop._id;

    const cacheKey = `shop:${shopId}:myTopSelling:${limit}`;
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.DEFAULT, async () => {
      // Get current analytics
      const analytics = await analyticsService.getCurrentShopAnalytics(shopId);

      // Limit top products
      const topProducts = analytics.topProducts
        .slice(0, parseInt(limit))
        .map((item, index) => ({
          sno: index + 1,
          productName: item.productName,
          category: item.category?.name || "Uncategorized",
          unitsSold: item.unitsSold,
          revenue: item.revenue,
          percentageOfSales: item.percentageOfSales,
          stockLevel: this._getStockStatus(item.currentStock),
          currentStock: item.currentStock,
        }));

      logger.info({
        ...context,
        event: "GET_TOP_SELLING_PRODUCTS_SUCCESS",
        shopId: shopId.toString(),
        count: topProducts.length,
      });

      return {
        success: true,
        shopId: shopId.toString(),
        shopName: shop.shopName,
        total: topProducts.length,
        data: topProducts,
      };
    });

    res.status(200).json(responseData);
  } catch (err) {
    logger.error({
      ...context,
      event: "GET_TOP_SELLING_PRODUCTS_ERROR",
      error: err.message,
      stack: err.stack,
    });

    res.status(500).json({
      success: false,
      message: "Error fetching top selling products",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

exports._getStockStatus = function(currentStock) {
  if (currentStock === 0) return "Out of Stock";
  if (currentStock <= 10) return "Low Stock";
  return "In Stock";
};


