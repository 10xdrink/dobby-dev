const Product = require("../models/productModel");
const ProductCategory = require("../models/ProductCategory");
const Order = require("../models/Order");
const logger = require("../config/logger");

/**
 * GET STOCK LEVELS BY CATEGORY
 * Admin/Employee can see total stock across all shopkeepers grouped by category
 */
exports.getStockLevelsByCategory = async (req, res) => {
  try {
    logger.info({
      route: "inventoryReportController.getStockLevelsByCategory",
      event: "STOCK_LEVELS_REQUEST",
      requestedBy: req.user?.email || req.employee?.email,
    });

    // Get all active categories
    const categories = await ProductCategory.find({ status: "active" })
      .select("name")
      .lean();

    // Aggregate stock by category across all shopkeepers
    const stockByCategory = await Product.aggregate([
      {
        $match: {
          status: "active", // Only active products
        },
      },
      {
        $lookup: {
          from: "productcategories",
          localField: "category",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      { $unwind: "$categoryDetails" },
      {
        $match: {
          "categoryDetails.status": "active", // Only active categories
        },
      },
      {
        $group: {
          _id: "$categoryDetails._id",
          categoryName: { $first: "$categoryDetails.name" },
          totalStock: { $sum: "$currentStock" },
          productCount: { $sum: 1 },
          lowStockCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$currentStock", 0] },
                    { $lte: ["$currentStock", "$minStockQty"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          outOfStockCount: {
            $sum: {
              $cond: [{ $eq: ["$currentStock", 0] }, 1, 0],
            },
          },
        },
      },
      {
        $sort: { categoryName: 1 },
      },
    ]);

    // Create map for quick lookup
    const stockMap = {};
    stockByCategory.forEach((item) => {
      stockMap[item.categoryName] = item;
    });

    // Fill in categories with zero stock
    const completeData = categories.map((cat) => {
      const stockData = stockMap[cat.name];
      return {
        categoryId: cat._id,
        categoryName: cat.name,
        totalStock: stockData?.totalStock || 0,
        productCount: stockData?.productCount || 0,
        lowStockCount: stockData?.lowStockCount || 0,
        outOfStockCount: stockData?.outOfStockCount || 0,
      };
    });

    logger.info({
      route: "inventoryReportController.getStockLevelsByCategory",
      event: "STOCK_LEVELS_SUCCESS",
      categoriesCount: completeData.length,
    });

    res.json({
      success: true,
      data: completeData,
      timestamp: new Date(),
    });
  } catch (err) {
    logger.error({
      route: "inventoryReportController.getStockLevelsByCategory",
      event: "STOCK_LEVELS_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET INVENTORY TURNOVER BY CATEGORY
 * Shows items sold, average inventory, turnover ratio, and industry benchmark
 * Filterable by time period
 */
exports.getInventoryTurnover = async (req, res) => {
  try {
    const { period = "30days", startDate, endDate } = req.query;

    logger.info({
      route: "inventoryReportController.getInventoryTurnover",
      event: "TURNOVER_REQUEST",
      period,
      startDate,
      endDate,
      requestedBy: req.user?.email || req.employee?.email,
    });

    const now = new Date();
    let filterStartDate;
    let filterEndDate = now;

    // Determine date range based on period
    switch (period) {
      case "30days":
        filterStartDate = new Date(now);
        filterStartDate.setDate(filterStartDate.getDate() - 30);
        break;

      case "90days":
        filterStartDate = new Date(now);
        filterStartDate.setDate(filterStartDate.getDate() - 90);
        break;

      case "thisyear":
        filterStartDate = new Date(now.getFullYear(), 0, 1);
        break;

      case "custom":
        if (!startDate || !endDate) {
          return res.status(400).json({
            success: false,
            message: "startDate and endDate required for custom period",
          });
        }
        filterStartDate = new Date(startDate);
        filterEndDate = new Date(endDate);
        filterEndDate.setHours(23, 59, 59, 999);
        break;

      default:
        filterStartDate = new Date(now);
        filterStartDate.setDate(filterStartDate.getDate() - 30);
    }

    logger.debug({
      route: "inventoryReportController.getInventoryTurnover",
      filterStartDate,
      filterEndDate,
    });

    // Get all categories
    const categories = await ProductCategory.find({ status: "active" })
      .select("name")
      .lean();

    // Calculate items sold per category in the period
    const itemsSoldByCategory = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: filterStartDate, $lte: filterEndDate },
          status: { $nin: ["cancelled", "refunded"] },
        },
      },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $lookup: {
          from: "productcategories",
          localField: "productDetails.category",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      { $unwind: "$categoryDetails" },
      {
        $group: {
          _id: "$categoryDetails._id",
          categoryName: { $first: "$categoryDetails.name" },
          itemsSold: { $sum: "$items.quantity" },
        },
      },
    ]);

    // Calculate average inventory per category
    const avgInventoryByCategory = await Product.aggregate([
      {
        $match: {
          status: "active",
        },
      },
      {
        $lookup: {
          from: "productcategories",
          localField: "category",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      { $unwind: "$categoryDetails" },
      {
        $match: {
          "categoryDetails.status": "active",
        },
      },
      {
        $group: {
          _id: "$categoryDetails._id",
          categoryName: { $first: "$categoryDetails.name" },
          avgInventory: { $avg: "$currentStock" },
          totalInventory: { $sum: "$currentStock" },
        },
      },
    ]);

    // Create maps for quick lookup
    const soldMap = {};
    itemsSoldByCategory.forEach((item) => {
      soldMap[item.categoryName] = item;
    });

    const inventoryMap = {};
    avgInventoryByCategory.forEach((item) => {
      inventoryMap[item.categoryName] = item;
    });

    // Industry benchmarks by category (you can adjust these)
    const industryBenchmarks = {
      Electronics: 2.26,
      "Fitness Equipment": 2.89,
      "Home Goods": 1.57,
      Clothing: 3.81,
      Accessories: 1.84,
      // Add more categories as needed
    };

    // Combine data
    const turnoverData = categories.map((cat) => {
      const sold = soldMap[cat.name]?.itemsSold || 0;
      const avgInv = inventoryMap[cat.name]?.avgInventory || 0;
      const totalInv = inventoryMap[cat.name]?.totalInventory || 0;

      // Calculate turnover ratio
      // Turnover Ratio = Items Sold / Average Inventory
      const turnoverRatio = avgInv > 0 ? sold / avgInv : 0;

      return {
        categoryName: cat.name,
        itemsSold: sold,
        avgInventory: Math.round(avgInv * 100) / 100,
        totalInventory: totalInv,
        turnoverRatio: Math.round(turnoverRatio * 100) / 100,
        industryBenchmark: industryBenchmarks[cat.name] || 2.0,
      };
    });

    // Sort by items sold descending
    turnoverData.sort((a, b) => b.itemsSold - a.itemsSold);

    logger.info({
      route: "inventoryReportController.getInventoryTurnover",
      event: "TURNOVER_SUCCESS",
      period,
      categoriesCount: turnoverData.length,
    });

    res.json({
      success: true,
      period,
      dateRange: {
        start: filterStartDate.toISOString().split("T")[0],
        end: filterEndDate.toISOString().split("T")[0],
      },
      data: turnoverData,
      summary: {
        totalItemsSold: turnoverData.reduce((sum, cat) => sum + cat.itemsSold, 0),
        avgTurnoverRatio:
          turnoverData.length > 0
            ? Math.round(
                (turnoverData.reduce((sum, cat) => sum + cat.turnoverRatio, 0) /
                  turnoverData.length) *
                  100
              ) / 100
            : 0,
      },
      timestamp: now,
    });
  } catch (err) {
    logger.error({
      route: "inventoryReportController.getInventoryTurnover",
      event: "TURNOVER_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: err.message });
  }
};