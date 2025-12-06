// services/inventoryService.js
const Product = require("../models/productModel");
const StockMovement = require("../models/InventoryReport");
const Order = require("../models/Order");
const ProductCategory = require("../models/ProductCategory");
const logger = require("../config/logger");
const crypto = require("crypto");

class InventoryService {
  /**
   * Get Inventory Status Table Data
   */
  async getInventoryStatus({ shopId, requestId }) {
    const context = { 
      route: "InventoryService.getInventoryStatus", 
      requestId: requestId || crypto.randomBytes(8).toString("hex"),
      shopId: shopId?.toString(),
    };

    logger.info({
      ...context,
      event: "INVENTORY_STATUS_START",
    });

    try {
      const products = await Product.find({ shop: shopId })
        .populate("category", "name")
        .select("productId productName category currentStock minStockQty updatedAt")
        .sort({ updatedAt: -1 })
        .lean();

      logger.debug({
        ...context,
        event: "PRODUCTS_FETCHED",
        count: products.length,
      });

      // Get last sold date for each product
      const productIds = products.map(p => p._id);
      
      const lastSoldData = await Order.aggregate([
        {
          $match: {
            status: {
              $in: [
                "delivered",
                "shipped",
                "confirmed",
                "packed",
                "in_transit",
                "out_for_delivery",
              ],
            },
          },
        },
        { $unwind: "$items" },
        { $match: { "items.product": { $in: productIds } } },
        {
          $group: {
            _id: "$items.product",
            lastSoldDate: { $max: "$createdAt" },
          },
        },
      ]);

      logger.debug({
        ...context,
        event: "LAST_SOLD_DATA_FETCHED",
        count: lastSoldData.length,
      });

      const lastSoldMap = {};
      lastSoldData.forEach(item => {
        lastSoldMap[item._id.toString()] = item.lastSoldDate;
      });

      const inventoryStatus = products.map((p, index) => {
        const lastSold = lastSoldMap[p._id.toString()];
        
        // Determine stock level status
        let stockLevel = "medium";
        if (p.currentStock === 0) {
          stockLevel = "out_of_stock";
        } else if (p.currentStock <= p.minStockQty) {
          stockLevel = "low_stock";
        }

        return {
          sno: index + 1,
          productId: p.productId || p._id.toString().slice(-8).toUpperCase(),
          productName: p.productName,
          category: p.category?.name || "Uncategorized",
          currentStock: p.currentStock,
          restockLevel: p.minStockQty,
          lastSold: lastSold ? new Date(lastSold).toLocaleDateString() : "Never",
          lastSoldDate: lastSold || null,
          stockLevel,
        };
      });

      logger.info({
        ...context,
        event: "INVENTORY_STATUS_SUCCESS",
        totalProducts: inventoryStatus.length,
      });

      return {
        success: true,
        data: inventoryStatus,
      };
    } catch (err) {
      logger.error({
        ...context,
        event: "INVENTORY_STATUS_ERROR",
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }
  }

  /**
   * Get Inventory Statistics
   */
  async getInventoryStats({ shopId, startDate, endDate, requestId }) {
    const context = { 
      route: "InventoryService.getInventoryStats", 
      requestId: requestId || crypto.randomBytes(8).toString("hex"),
      shopId: shopId?.toString(),
    };

    logger.info({
      ...context,
      event: "INVENTORY_STATS_START",
      dateRange: { startDate, endDate },
    });

    try {
      const products = await Product.find({ shop: shopId })
        .select("unitPrice currentStock minStockQty")
        .lean();

      logger.debug({
        ...context,
        event: "PRODUCTS_FETCHED_FOR_STATS",
        count: products.length,
      });

      // Calculate stats
      const totalInventoryValue = products.reduce(
        (sum, p) => sum + (p.unitPrice * p.currentStock),
        0
      );

      const productsInStock = products.filter(p => p.currentStock > 0).length;
      
      const lowStockItems = products.filter(
        p => p.currentStock > 0 && p.currentStock <= p.minStockQty
      ).length;
      
      const outOfStock = products.filter(p => p.currentStock === 0).length;

      // Get comparison data (previous period)
      let comparison = null;
      if (startDate && endDate) {
        const periodDuration = new Date(endDate) - new Date(startDate);
        const prevStartDate = new Date(new Date(startDate) - periodDuration);
        const prevEndDate = new Date(startDate);

        try {
          const prevStats = await this._calculatePeriodStats({
            shopId,
            startDate: prevStartDate,
            endDate: prevEndDate,
          });

          comparison = {
            totalValue: this._calculatePercentageChange(prevStats.totalValue, totalInventoryValue),
            inStock: this._calculatePercentageChange(prevStats.inStock, productsInStock),
            lowStock: this._calculatePercentageChange(prevStats.lowStock, lowStockItems),
            outOfStock: this._calculatePercentageChange(prevStats.outOfStock, outOfStock),
          };

          logger.debug({
            ...context,
            event: "COMPARISON_CALCULATED",
            comparison,
          });
        } catch (compErr) {
          logger.warn({
            ...context,
            event: "COMPARISON_CALCULATION_FAILED",
            error: compErr.message,
          });
        }
      }

      const stats = {
        totalInventoryValue: parseFloat(totalInventoryValue.toFixed(2)),
        productsInStock,
        lowStockItems,
        outOfStock,
        comparison,
      };

      logger.info({
        ...context,
        event: "INVENTORY_STATS_SUCCESS",
        stats,
      });

      return {
        success: true,
        data: stats,
      };
    } catch (err) {
      logger.error({
        ...context,
        event: "INVENTORY_STATS_ERROR",
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }
  }

  /**
   * Get Inventory Turnover Data
   */
  async getInventoryTurnover({ shopId, filterBy, filterValue, startDate, endDate, requestId }) {
    const context = { 
      route: "InventoryService.getInventoryTurnover", 
      requestId: requestId || crypto.randomBytes(8).toString("hex"),
      shopId: shopId?.toString(),
      filterBy,
      filterValue,
    };

    logger.info({
      ...context,
      event: "INVENTORY_TURNOVER_START",
      dateRange: { startDate, endDate },
    });

    try {
      let matchStage = {
        "items.shop": shopId,
        status: { $in: ["delivered", "shipped", "confirmed"] },
      };

      if (startDate && endDate) {
        matchStage.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }

      logger.debug({
        ...context,
        event: "MATCH_STAGE_BUILT",
        matchStage,
      });

      let groupBy = {};
      let lookupStage = {};
      let projectStage = {};

      switch (filterBy) {
        case "category":
          groupBy = "$items.product";
          lookupStage = {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product",
          };
          projectStage = {
            _id: 1,
            totalQuantity: 1,
            totalRevenue: 1,
            category: { $arrayElemAt: ["$product.category", 0] },
          };
          break;

        case "product":
          groupBy = "$items.product";
          lookupStage = {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product",
          };
          projectStage = {
            _id: 1,
            totalQuantity: 1,
            totalRevenue: 1,
            productName: { $arrayElemAt: ["$product.productName", 0] },
          };
          break;

        case "location":
          // Location-based turnover requires address lookup
          const turnoverData = await Order.aggregate([
            { $match: matchStage },
            { $unwind: "$items" },
            { $match: { "items.shop": shopId } },
            {
              $lookup: {
                from: "addresses",
                localField: "address",
                foreignField: "_id",
                as: "addressData",
              },
            },
            { $unwind: "$addressData" },
            {
              $group: {
                _id: "$addressData.city",
                totalQuantity: { $sum: "$items.quantity" },
                totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
                orderCount: { $sum: 1 },
              },
            },
            { $sort: { totalRevenue: -1 } },
            { $limit: 10 },
          ]);

          logger.info({
            ...context,
            event: "LOCATION_TURNOVER_SUCCESS",
            dataPoints: turnoverData.length,
          });

          return {
            success: true,
            data: turnoverData.map(item => ({
              label: item._id || "Unknown",
              quantity: item.totalQuantity,
              revenue: parseFloat(item.totalRevenue.toFixed(2)),
              orderCount: item.orderCount,
            })),
          };

        default:
          throw new Error("Invalid filterBy value");
      }

      // Execute aggregation for category and product
      const pipeline = [
        { $match: matchStage },
        { $unwind: "$items" },
        { $match: { "items.shop": shopId } },
        {
          $group: {
            _id: groupBy,
            totalQuantity: { $sum: "$items.quantity" },
            totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
          },
        },
        { $lookup: lookupStage },
        { $project: projectStage },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 },
      ];

      const turnoverData = await Order.aggregate(pipeline);

      logger.debug({
        ...context,
        event: "TURNOVER_AGGREGATION_COMPLETE",
        dataPoints: turnoverData.length,
      });

      // Format response based on filter type
      let formattedData = [];

      if (filterBy === "category") {
        // Lookup category names
        const categoryIds = turnoverData.map(item => item.category).filter(Boolean);
        const categories = await ProductCategory.find({ _id: { $in: categoryIds } })
          .select("name")
          .lean();

        const categoryMap = {};
        categories.forEach(cat => {
          categoryMap[cat._id.toString()] = cat.name;
        });

        formattedData = turnoverData.map(item => ({
          label: categoryMap[item.category?.toString()] || "Uncategorized",
          quantity: item.totalQuantity,
          revenue: parseFloat(item.totalRevenue.toFixed(2)),
        }));
      } else if (filterBy === "product") {
        formattedData = turnoverData.map(item => ({
          label: item.productName || "Unknown Product",
          quantity: item.totalQuantity,
          revenue: parseFloat(item.totalRevenue.toFixed(2)),
        }));
      }

      logger.info({
        ...context,
        event: "INVENTORY_TURNOVER_SUCCESS",
        dataPoints: formattedData.length,
      });

      return {
        success: true,
        data: formattedData,
      };
    } catch (err) {
      logger.error({
        ...context,
        event: "INVENTORY_TURNOVER_ERROR",
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }
  }

  /**
   * Get Stock Movement Report
   */
  async getStockMovement({ shopId, period, startDate, endDate, requestId }) {
    const context = { 
      route: "InventoryService.getStockMovement", 
      requestId: requestId || crypto.randomBytes(8).toString("hex"),
      shopId: shopId?.toString(),
      period,
    };

    logger.info({
      ...context,
      event: "STOCK_MOVEMENT_START",
      dateRange: { startDate, endDate },
    });

    try {
      // Determine date range based on period
      let dateFilter = {};
      const now = new Date();

      if (period === "7days") {
        dateFilter = {
          $gte: new Date(now - 7 * 24 * 60 * 60 * 1000),
          $lte: now,
        };
      } else if (period === "30days") {
        dateFilter = {
          $gte: new Date(now - 30 * 24 * 60 * 60 * 1000),
          $lte: now,
        };
      } else if (period === "thisMonth") {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = {
          $gte: startOfMonth,
          $lte: now,
        };
      } else if (startDate && endDate) {
        dateFilter = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      } else {
        // Default to last 7 days
        dateFilter = {
          $gte: new Date(now - 7 * 24 * 60 * 60 * 1000),
          $lte: now,
        };
      }

      logger.debug({
        ...context,
        event: "DATE_FILTER_BUILT",
        dateFilter,
      });

      // Get stock movements
      const movements = await StockMovement.aggregate([
        {
          $match: {
            shop: shopId,
            createdAt: dateFilter,
          },
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              type: "$type",
            },
            totalQuantity: { $sum: "$quantity" },
          },
        },
        { $sort: { "_id.date": 1 } },
      ]);

      logger.debug({
        ...context,
        event: "MOVEMENTS_FETCHED",
        count: movements.length,
      });

      // Format data for chart
      const dateMap = {};
      movements.forEach(item => {
        const date = item._id.date;
        if (!dateMap[date]) {
          dateMap[date] = { date, stockIn: 0, stockOut: 0 };
        }

        if (item._id.type === "in") {
          dateMap[date].stockIn += item.totalQuantity;
        } else if (item._id.type === "out") {
          dateMap[date].stockOut += item.totalQuantity;
        }
      });

      const chartData = Object.values(dateMap).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );

      logger.info({
        ...context,
        event: "STOCK_MOVEMENT_SUCCESS",
        dataPoints: chartData.length,
      });

      return {
        success: true,
        data: chartData,
      };
    } catch (err) {
      logger.error({
        ...context,
        event: "STOCK_MOVEMENT_ERROR",
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }
  }

  /**
   * Helper: Calculate period stats for comparison
   */
  async _calculatePeriodStats({ shopId, startDate, endDate }) {
    const products = await Product.find({ shop: shopId })
      .select("unitPrice currentStock minStockQty")
      .lean();

    const totalValue = products.reduce(
      (sum, p) => sum + (p.unitPrice * p.currentStock),
      0
    );

    const inStock = products.filter(p => p.currentStock > 0).length;
    const lowStock = products.filter(
      p => p.currentStock > 0 && p.currentStock <= p.minStockQty
    ).length;
    const outOfStock = products.filter(p => p.currentStock === 0).length;

    return { totalValue, inStock, lowStock, outOfStock };
  }

  /**
   * Helper: Calculate percentage change
   */
  _calculatePercentageChange(oldValue, newValue) {
    if (oldValue === 0) return newValue > 0 ? 100 : 0;
    return parseFloat((((newValue - oldValue) / oldValue) * 100).toFixed(2));
  }
}

module.exports = new InventoryService();