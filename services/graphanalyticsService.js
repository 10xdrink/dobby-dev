// services/graphAnalyticsService.js
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/productModel");
const ProductCategory = require("../models/ProductCategory");
const logger = require("../config/logger");
const crypto = require("crypto");

class GraphAnalyticsService {
  /**
   * Get Sales Over Time data
   * Supports: daily, weekly, monthly grouping
   */
  async getSalesOverTime(shopId, startDate, endDate, groupBy = "daily") {
    const requestId = crypto.randomBytes(8).toString("hex");
    const context = {
      route: "GraphAnalyticsService.getSalesOverTime",
      requestId,
      shopId: shopId.toString(),
      groupBy,
    };

    logger.info({
      ...context,
      event: "SALES_OVER_TIME_START",
      startDate,
      endDate,
    });

    try {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // Define grouping format based on period
      let dateGroupFormat;
      let dateFormat;

      switch (groupBy) {
        case "daily":
          dateGroupFormat = {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          };
          dateFormat = "%Y-%m-%d";
          break;

        case "weekly":
          dateGroupFormat = {
            year: { $year: "$createdAt" },
            week: { $week: "$createdAt" },
          };
          dateFormat = "%Y-W%V";
          break;

        case "monthly":
          dateGroupFormat = {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          };
          dateFormat = "%Y-%m";
          break;

        default:
          throw new Error(`Invalid groupBy: ${groupBy}`);
      }

      logger.debug({
        ...context,
        event: "DATE_GROUP_FORMAT_SET",
        groupBy,
        dateFormat,
      });

      // Aggregation pipeline
      const pipeline = [
        // Match orders for this shop in date range
        {
          $match: {
            "shipments.shop": new mongoose.Types.ObjectId(shopId),
            status: { $nin: ["cancelled", "refunded"] },
            createdAt: { $gte: start, $lte: end },
          },
        },
        // Unwind items to calculate per-item revenue
        { $unwind: "$items" },
        // Filter items belonging to this shop
        {
          $match: {
            "items.shop": new mongoose.Types.ObjectId(shopId),
          },
        },
        // Calculate revenue per item
        {
          $addFields: {
            itemRevenue: {
              $multiply: ["$items.price", "$items.quantity"],
            },
          },
        },
        // Group by date period
        {
          $group: {
            _id: dateGroupFormat,
            totalSales: { $sum: "$itemRevenue" },
            orderCount: { $addToSet: "$_id" },
            date: { $first: "$createdAt" },
          },
        },
        // Count unique orders
        {
          $addFields: {
            orderCount: { $size: "$orderCount" },
          },
        },
        // Format date string
        {
          $addFields: {
            dateString: {
              $dateToString: {
                format: dateFormat,
                date: "$date",
              },
            },
          },
        },
        // Sort by date
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
        // Project final fields
        {
          $project: {
            _id: 0,
            period: "$dateString",
            date: "$date",
            totalSales: { $round: ["$totalSales", 2] },
            orderCount: 1,
          },
        },
      ];

      const results = await Order.aggregate(pipeline);

      logger.info({
        ...context,
        event: "SALES_OVER_TIME_CALCULATED",
        dataPoints: results.length,
        totalSales: results.reduce((sum, r) => sum + r.totalSales, 0),
      });

      // Fill missing dates with zero values
      const filledResults = this._fillMissingDates(
        results,
        start,
        end,
        groupBy
      );

      logger.info({
        ...context,
        event: "SALES_OVER_TIME_COMPLETE",
        originalDataPoints: results.length,
        filledDataPoints: filledResults.length,
      });

      return filledResults;
    } catch (err) {
      logger.error({
        ...context,
        event: "SALES_OVER_TIME_FAILED",
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }
  }

  /**
   * Get Sales by Category data
   */
  async getSalesByCategory(shopId, startDate, endDate) {
    const requestId = crypto.randomBytes(8).toString("hex");
    const context = {
      route: "GraphAnalyticsService.getSalesByCategory",
      requestId,
      shopId: shopId.toString(),
    };

    logger.info({
      ...context,
      event: "SALES_BY_CATEGORY_START",
      startDate,
      endDate,
    });

    try {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // Aggregation pipeline
      const pipeline = [
        // Match orders for this shop in date range
        {
          $match: {
            "shipments.shop": new mongoose.Types.ObjectId(shopId),
            status: { $nin: ["cancelled", "refunded"] },
            createdAt: { $gte: start, $lte: end },
          },
        },
        // Unwind items
        { $unwind: "$items" },
        // Filter items belonging to this shop
        {
          $match: {
            "items.shop": new mongoose.Types.ObjectId(shopId),
          },
        },
        // Lookup product details to get category
        {
          $lookup: {
            from: "products",
            localField: "items.product",
            foreignField: "_id",
            as: "productDetails",
          },
        },
        // Unwind product details
        { $unwind: { path: "$productDetails", preserveNullAndEmptyArrays: true } },
        // Lookup category details
        {
          $lookup: {
            from: "productcategories",
            localField: "productDetails.category",
            foreignField: "_id",
            as: "categoryDetails",
          },
        },
        // Unwind category details
        { $unwind: { path: "$categoryDetails", preserveNullAndEmptyArrays: true } },
        // Calculate revenue per item
        {
          $addFields: {
            itemRevenue: {
              $multiply: ["$items.price", "$items.quantity"],
            },
            categoryId: "$productDetails.category",
            categoryName: {
              $ifNull: ["$categoryDetails.name", "Uncategorized"],
            },
          },
        },
        // Group by category
        {
          $group: {
            _id: "$categoryId",
            categoryName: { $first: "$categoryName" },
            totalSales: { $sum: "$itemRevenue" },
            orderCount: { $addToSet: "$_id" },
            unitsSold: { $sum: "$items.quantity" },
          },
        },
        // Count unique orders
        {
          $addFields: {
            orderCount: { $size: "$orderCount" },
          },
        },
        // Sort by total sales (descending)
        { $sort: { totalSales: -1 } },
        // Project final fields
        {
          $project: {
            _id: 0,
            categoryId: "$_id",
            categoryName: 1,
            totalSales: { $round: ["$totalSales", 2] },
            orderCount: 1,
            unitsSold: 1,
          },
        },
      ];

      const results = await Order.aggregate(pipeline);

      // Calculate total for percentage
      const totalSales = results.reduce((sum, r) => sum + r.totalSales, 0);

      // Add percentage
      const resultsWithPercentage = results.map((item) => ({
        ...item,
        percentageOfSales: totalSales > 0
          ? parseFloat(((item.totalSales / totalSales) * 100).toFixed(2))
          : 0,
      }));

      logger.info({
        ...context,
        event: "SALES_BY_CATEGORY_CALCULATED",
        categoriesCount: resultsWithPercentage.length,
        totalSales,
      });

      return resultsWithPercentage;
    } catch (err) {
      logger.error({
        ...context,
        event: "SALES_BY_CATEGORY_FAILED",
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }
  }

  /**
   * Fill missing dates with zero values for continuous graph
   */
  _fillMissingDates(results, startDate, endDate, groupBy) {
    const filled = [];
    const resultMap = new Map();

    // Create map of existing results
    results.forEach((r) => {
      resultMap.set(r.period, r);
    });

    let currentDate = new Date(startDate);
    const end = new Date(endDate);

    while (currentDate <= end) {
      let periodKey;

      switch (groupBy) {
        case "daily":
          periodKey = this._formatDate(currentDate, "daily");
          break;

        case "weekly":
          periodKey = this._formatDate(currentDate, "weekly");
          break;

        case "monthly":
          periodKey = this._formatDate(currentDate, "monthly");
          break;
      }

      if (resultMap.has(periodKey)) {
        filled.push(resultMap.get(periodKey));
      } else {
        filled.push({
          period: periodKey,
          date: new Date(currentDate),
          totalSales: 0,
          orderCount: 0,
        });
      }

      // Increment date based on groupBy
      switch (groupBy) {
        case "daily":
          currentDate.setDate(currentDate.getDate() + 1);
          break;

        case "weekly":
          currentDate.setDate(currentDate.getDate() + 7);
          break;

        case "monthly":
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
      }
    }

    return filled;
  }

  /**
   * Format date based on grouping
   */
  _formatDate(date, groupBy) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    switch (groupBy) {
      case "daily":
        return `${year}-${month}-${day}`;

      case "weekly":
        const weekNum = this._getWeekNumber(date);
        return `${year}-W${String(weekNum).padStart(2, "0")}`;

      case "monthly":
        return `${year}-${month}`;

      default:
        return `${year}-${month}-${day}`;
    }
  }

  /**
   * Get ISO week number
   */
  _getWeekNumber(date) {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  }
}

module.exports = new GraphAnalyticsService();

