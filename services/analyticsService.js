// services/analyticsService.js - FIXED VERSION
const mongoose = require("mongoose");
const ShopAnalytics = require("../models/ShopAnalytics");
const ProductAnalytics = require("../models/ProductAnalytics");
const Order = require("../models/Order");
const AbandonedCart = require("../models/AbandonedCart");
const Product = require("../models/productModel");
const logger = require("../config/logger");
const crypto = require("crypto");

class AnalyticsService {
  /**
   * Calculate analytics for a specific shop and date range
   */
  async calculateShopAnalytics(shopId, startDate, endDate, periodType = "daily") {
    const requestId = crypto.randomBytes(8).toString("hex");
    const context = { 
      route: "AnalyticsService.calculateShopAnalytics", 
      requestId,
      shopId: shopId.toString(),
    };

    logger.info({
      ...context,
      event: "ANALYTICS_CALCULATION_START",
      startDate,
      endDate,
      periodType,
    });

    try {
      // Validate shop ID
      if (!mongoose.Types.ObjectId.isValid(shopId)) {
        logger.error({
          ...context,
          event: "INVALID_SHOP_ID",
          shopId,
        });
        throw new Error("Invalid shop ID");
      }

      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      logger.debug({
        ...context,
        event: "DATE_RANGE_NORMALIZED",
        start,
        end,
      });

      // Get all orders for this shop in date range
      const orders = await Order.find({
        "shipments.shop": shopId,
        status: { $nin: ["cancelled", "refunded", "failed"] },
        createdAt: { $gte: start, $lte: end },
      })
        .populate("items.product")
        .populate("customer", "firstName lastName email");

      logger.info({
        ...context,
        event: "ORDERS_FETCHED",
        orderCount: orders.length,
      });

      // Calculate sales metrics
      let totalSales = 0;
      let totalOrders = 0; 
      const productSales = new Map();
      const uniqueCustomers = new Set();

      for (const order of orders) {
        
        if (!order.customer || !order.customer._id) {
          logger.warn({
            ...context,
            event: "ORDER_CUSTOMER_MISSING",
            orderId: order._id,
            orderNumber: order.orderNumber,
          });
          continue; // Skip this order
        }

        
        totalOrders++;
        uniqueCustomers.add(order.customer._id.toString());
        
        // Filter items that belong to this shop
        const shopItems = order.items.filter(
          (item) => item.shop && item.shop.toString() === shopId.toString()
        );

        for (const item of shopItems) {
          if (!item.product) {
            logger.warn({
              ...context,
              event: "ITEM_PRODUCT_MISSING",
              orderId: order._id,
              itemName: item.name,
            });
            continue;
          }

          
          const itemTotal = (item.finalUnitPrice || item.price || 0) * item.quantity;
          totalSales += itemTotal;

          // Track product sales
          const productId = item.product._id 
            ? item.product._id.toString() 
            : item.product.toString();

          if (!productSales.has(productId)) {
            productSales.set(productId, {
              product: item.product,
              productName: item.name,
              unitsSold: 0,
              revenue: 0,
              orderCount: 0,
            });
          }

          const productData = productSales.get(productId);
          productData.unitsSold += item.quantity;
          productData.revenue += itemTotal;
          productData.orderCount += 1;
        }
      }

      logger.info({
        ...context,
        event: "SALES_CALCULATED",
        totalSales,
        totalOrders,
        uniqueCustomers: uniqueCustomers.size,
        uniqueProducts: productSales.size,
      });

      // Calculate average order value
      const averageOrderValue = totalOrders > 0 
        ? parseFloat((totalSales / totalOrders).toFixed(2)) 
        : 0;

      // Get abandoned cart metrics
      const totalAbandonedCarts = await AbandonedCart.countDocuments({
        shop: shopId,
        status: { $in: ["pending", "sent"] },
        abandonedAt: { $gte: start, $lte: end },
      });

      const recoveredCarts = await AbandonedCart.countDocuments({
        shop: shopId,
        status: "recovered",
        recoveredAt: { $gte: start, $lte: end },
      });

      logger.info({
        ...context,
        event: "ABANDONED_CART_METRICS",
        totalAbandonedCarts,
        recoveredCarts,
      });

      // Calculate conversion rate
      const totalInteractions = totalAbandonedCarts + recoveredCarts;
      const conversionRate = totalInteractions > 0
        ? parseFloat(((recoveredCarts / totalInteractions) * 100).toFixed(2))
        : 0;

      // Sort products by revenue
      const sortedProducts = Array.from(productSales.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10); // Top 10 products

      logger.debug({
        ...context,
        event: "PRODUCTS_SORTED",
        topProductsCount: sortedProducts.length,
      });

      // Format top products with additional details
      const topProducts = [];
      
      for (const item of sortedProducts) {
        try {
          const productId = item.product._id 
            ? item.product._id 
            : item.product;

          const product = await Product.findById(productId)
            .populate("category")
            .select("productName category currentStock status");

          if (!product) {
            logger.warn({
              ...context,
              event: "PRODUCT_NOT_FOUND_IN_DB",
              productId: productId.toString(),
              productName: item.productName,
            });
            continue;
          }

          const percentageOfSales = totalSales > 0
            ? parseFloat(((item.revenue / totalSales) * 100).toFixed(2))
            : 0;

          topProducts.push({
            product: product._id,
            productName: product.productName,
            category: product.category?._id || null,
            unitsSold: item.unitsSold,
            revenue: parseFloat(item.revenue.toFixed(2)),
            percentageOfSales,
            currentStock: product.currentStock,
          });

          logger.debug({
            ...context,
            event: "TOP_PRODUCT_ADDED",
            productName: product.productName,
            revenue: item.revenue,
          });
        } catch (productErr) {
          logger.error({
            ...context,
            event: "TOP_PRODUCT_PROCESSING_ERROR",
            productId: item.product,
            error: productErr.message,
          });
        }
      }

      logger.info({
        ...context,
        event: "TOP_PRODUCTS_CALCULATED",
        count: topProducts.length,
      });

      // Get previous period for growth calculation
      const periodDuration = end - start;
      const previousStart = new Date(start.getTime() - periodDuration);
      const previousEnd = new Date(start.getTime() - 1);

      logger.debug({
        ...context,
        event: "CALCULATING_PREVIOUS_PERIOD",
        previousStart,
        previousEnd,
      });

      const previousOrders = await Order.find({
        "shipments.shop": shopId,
        status: { $nin: ["cancelled", "refunded", "failed"] },
        createdAt: { $gte: previousStart, $lte: previousEnd },
      });

      let previousSales = 0;
      let validPreviousOrders = 0;

      for (const order of previousOrders) {
        
        if (!order.customer) {
          continue;
        }
        validPreviousOrders++;

        const shopItems = order.items.filter(
          (item) => item.shop && item.shop.toString() === shopId.toString()
        );
        for (const item of shopItems) {
          previousSales += (item.finalUnitPrice || item.price || 0) * item.quantity;
        }
      }

      const salesGrowth = previousSales > 0
        ? parseFloat((((totalSales - previousSales) / previousSales) * 100).toFixed(2))
        : totalSales > 0 ? 100 : 0;

      const ordersGrowth = validPreviousOrders > 0
        ? parseFloat((((totalOrders - validPreviousOrders) / validPreviousOrders) * 100).toFixed(2))
        : totalOrders > 0 ? 100 : 0;

      logger.info({
        ...context,
        event: "GROWTH_CALCULATED",
        salesGrowth,
        ordersGrowth,
        previousSales,
        previousOrders: validPreviousOrders,
      });

      // Create or update analytics record
      const analyticsData = {
        shop: shopId,
        date: start,
        periodType,
        totalSales: parseFloat(totalSales.toFixed(2)),
        totalOrders,
        averageOrderValue,
        totalAbandonedCarts,
        recoveredCarts,
        conversionRate,
        topProducts,
        totalRevenue: parseFloat(totalSales.toFixed(2)),
        totalCustomers: uniqueCustomers.size,
        salesGrowth,
        ordersGrowth,
      };

      const analytics = await ShopAnalytics.findOneAndUpdate(
        { shop: shopId, date: start, periodType },
        analyticsData,
        { upsert: true, new: true, runValidators: true }
      );

      logger.info({
        ...context,
        event: "ANALYTICS_SAVED",
        analyticsId: analytics._id,
        totalSales: analytics.totalSales,
        totalOrders: analytics.totalOrders,
        conversionRate: analytics.conversionRate,
      });

      return analytics;
    } catch (err) {
      logger.error({
        ...context,
        event: "ANALYTICS_CALCULATION_FAILED",
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }
  }

  
  async getCurrentShopAnalytics(shopId) {
    const requestId = crypto.randomBytes(8).toString("hex");
    const context = { 
      route: "AnalyticsService.getCurrentShopAnalytics", 
      requestId,
      shopId: shopId.toString(),
    };

    logger.info({
      ...context,
      event: "GET_CURRENT_ANALYTICS_START",
    });

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if analytics exist for today
      let analytics = await ShopAnalytics.findOne({
        shop: shopId,
        date: today,
        periodType: "daily",
      })
        .populate("topProducts.product")
        .populate("topProducts.category");

      // If not found or outdated, calculate fresh
      if (!analytics || this._isAnalyticsOutdated(analytics)) {
        logger.info({
          ...context,
          event: "ANALYTICS_OUTDATED_RECALCULATING",
          existingAnalytics: !!analytics,
          lastUpdate: analytics?.updatedAt,
        });

        const endOfToday = new Date(today);
        endOfToday.setHours(23, 59, 59, 999);

        analytics = await this.calculateShopAnalytics(
          shopId,
          today,
          endOfToday,
          "daily"
        );
      } else {
        logger.info({
          ...context,
          event: "ANALYTICS_CACHE_HIT",
          analyticsId: analytics._id,
          lastUpdate: analytics.updatedAt,
        });
      }

      logger.info({
        ...context,
        event: "GET_CURRENT_ANALYTICS_SUCCESS",
        analyticsId: analytics._id,
      });

      return analytics;
    } catch (err) {
      logger.error({
        ...context,
        event: "GET_CURRENT_ANALYTICS_FAILED",
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }
  }

  
  _isAnalyticsOutdated(analytics) {
    if (!analytics || !analytics.updatedAt) {
      return true;
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return analytics.updatedAt < oneHourAgo;
  }

  
  async getShopAnalyticsRange(shopId, startDate, endDate) {
    const requestId = crypto.randomBytes(8).toString("hex");
    const context = { 
      route: "AnalyticsService.getShopAnalyticsRange", 
      requestId,
      shopId: shopId.toString(),
    };

    logger.info({
      ...context,
      event: "GET_ANALYTICS_RANGE_START",
      startDate,
      endDate,
    });

    try {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const analytics = await ShopAnalytics.find({
        shop: shopId,
        date: { $gte: start, $lte: end },
        periodType: "daily",
      })
        .sort({ date: 1 })
        .populate("topProducts.product")
        .populate("topProducts.category");

      logger.info({
        ...context,
        event: "GET_ANALYTICS_RANGE_SUCCESS",
        count: analytics.length,
        startDate: start,
        endDate: end,
      });

      return analytics;
    } catch (err) {
      logger.error({
        ...context,
        event: "GET_ANALYTICS_RANGE_FAILED",
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }
  }

  
  async calculateProductAnalytics(shopId, productId, startDate, endDate) {
    const requestId = crypto.randomBytes(8).toString("hex");
    const context = { 
      route: "AnalyticsService.calculateProductAnalytics", 
      requestId,
      shopId: shopId.toString(),
      productId: productId.toString(),
    };

    logger.info({
      ...context,
      event: "PRODUCT_ANALYTICS_CALCULATION_START",
      startDate,
      endDate,
    });

    try {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // Get product at start and end of period
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      // Get all orders containing this product
      const orders = await Order.find({
        "items.product": productId,
        "items.shop": shopId,
        status: { $nin: ["cancelled", "refunded", "failed"] },
        createdAt: { $gte: start, $lte: end },
      });

      let unitsSold = 0;
      let revenue = 0;
      let ordersCount = 0;

      for (const order of orders) {
        const productItems = order.items.filter(
          (item) => 
            item.product.toString() === productId.toString() &&
            item.shop.toString() === shopId.toString()
        );

        for (const item of productItems) {
          unitsSold += item.quantity;
          revenue += (item.finalUnitPrice || item.price || 0) * item.quantity;
        }

        if (productItems.length > 0) {
          ordersCount++;
        }
      }

      // Get abandoned cart data
      const abandonedCartCount = await AbandonedCart.countDocuments({
        shop: shopId,
        product: productId,
        status: { $in: ["pending", "sent"] },
        abandonedAt: { $gte: start, $lte: end },
      });

      const cartAdditions = abandonedCartCount + ordersCount;
      const conversionRate = cartAdditions > 0
        ? parseFloat(((ordersCount / cartAdditions) * 100).toFixed(2))
        : 0;

      const analyticsData = {
        shop: shopId,
        product: productId,
        date: start,
        unitsSold,
        revenue: parseFloat(revenue.toFixed(2)),
        ordersCount,
        stockAtStart: product.currentStock + unitsSold,
        stockAtEnd: product.currentStock,
        stockMovement: -unitsSold,
        cartAdditions,
        abandonedCartCount,
        conversionRate,
      };

      const analytics = await ProductAnalytics.findOneAndUpdate(
        { shop: shopId, product: productId, date: start },
        analyticsData,
        { upsert: true, new: true, runValidators: true }
      );

      logger.info({
        ...context,
        event: "PRODUCT_ANALYTICS_SAVED",
        analyticsId: analytics._id,
        unitsSold,
        revenue,
      });

      return analytics;
    } catch (err) {
      logger.error({
        ...context,
        event: "PRODUCT_ANALYTICS_CALCULATION_FAILED",
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }
  }

  
  async getDashboardStats(shopId, period = "today") {
    const requestId = crypto.randomBytes(8).toString("hex");
    const context = { 
      route: "AnalyticsService.getDashboardStats", 
      requestId,
      shopId: shopId.toString(),
      period,
    };

    logger.info({
      ...context,
      event: "GET_DASHBOARD_STATS_START",
    });

    try {
      let startDate, endDate;
      const now = new Date();

      switch (period) {
        case "today":
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setHours(23, 59, 59, 999);
          break;

        case "week":
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setHours(23, 59, 59, 999);
          break;

        case "month":
          startDate = new Date(now);
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setHours(23, 59, 59, 999);
          break;

        default:
          throw new Error(`Invalid period: ${period}`);
      }

      const analytics = await this.calculateShopAnalytics(
        shopId,
        startDate,
        endDate,
        period
      );

      logger.info({
        ...context,
        event: "GET_DASHBOARD_STATS_SUCCESS",
        period,
        totalSales: analytics.totalSales,
      });

      return analytics;
    } catch (err) {
      logger.error({
        ...context,
        event: "GET_DASHBOARD_STATS_FAILED",
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }
  }
}

module.exports = new AnalyticsService();