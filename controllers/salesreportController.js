const Order = require("../models/Order");
const ProductCategory = require("../models/ProductCategory");
const Product = require("../models/productModel");

const logger = require("../config/logger");

exports.getRevenueTrend = async (req, res) => {
  try {
    const { period = "7days", startDate, endDate } = req.query;

    logger.info({
      route: "SalesReportController.getRevenueTrend",
      period,
      startDate,
      endDate,
      requestedBy: req.user?.email || req.employee?.email,
    });

    const now = new Date();
    let filterStartDate;
    let filterEndDate = now;
    let dateFormat = "%Y-%m-%d"; // Daily format
    let groupByFormat = {
      $dateToString: { format: dateFormat, date: "$createdAt" },
    };

    // Determine date range based on period
    switch (period) {
      case "7days":
        filterStartDate = new Date(now);
        filterStartDate.setDate(filterStartDate.getDate() - 7);
        break;

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
        dateFormat = "%Y-%m"; // Monthly format for year view
        groupByFormat = {
          $dateToString: { format: dateFormat, date: "$createdAt" },
        };
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

        // Auto-select format based on date range
        const daysDiff = Math.ceil(
          (filterEndDate - filterStartDate) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff > 90) {
          dateFormat = "%Y-%m";
          groupByFormat = {
            $dateToString: { format: dateFormat, date: "$createdAt" },
          };
        }
        break;

      default:
        filterStartDate = new Date(now);
        filterStartDate.setDate(filterStartDate.getDate() - 7);
    }

    logger.debug({
      route: "SalesReportController.getRevenueTrend",
      filterStartDate,
      filterEndDate,
      dateFormat,
    });

    // Aggregate revenue by date
    const revenueTrend = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: filterStartDate, $lte: filterEndDate },
          status: { $nin: ["cancelled", "refunded"] }, // Exclude cancelled/refunded
        },
      },
      {
        $group: {
          _id: groupByFormat,
          revenue: { $sum: "$total" },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: "$total" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Fill in missing dates with zero values
    const filledData = [];
    const currentDate = new Date(filterStartDate);
    const dataMap = {};

    revenueTrend.forEach((item) => {
      dataMap[item._id] = item;
    });

    if (
      period === "thisyear" ||
      (period === "custom" && dateFormat === "%Y-%m")
    ) {
      // Fill months
      while (currentDate <= filterEndDate) {
        const key = `${currentDate.getFullYear()}-${String(
          currentDate.getMonth() + 1
        ).padStart(2, "0")}`;
        filledData.push({
          date: key,
          revenue: dataMap[key]?.revenue || 0,
          orderCount: dataMap[key]?.orderCount || 0,
          avgOrderValue: dataMap[key]?.avgOrderValue || 0,
        });
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    } else {
      // Fill days
      while (currentDate <= filterEndDate) {
        const key = currentDate.toISOString().split("T")[0];
        filledData.push({
          date: key,
          revenue: Math.round((dataMap[key]?.revenue || 0) * 100) / 100,
          orderCount: dataMap[key]?.orderCount || 0,
          avgOrderValue:
            Math.round((dataMap[key]?.avgOrderValue || 0) * 100) / 100,
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    // Calculate summary
    const totalRevenue = filledData.reduce(
      (sum, item) => sum + item.revenue,
      0
    );
    const totalOrders = filledData.reduce(
      (sum, item) => sum + item.orderCount,
      0
    );
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Get previous period for comparison
    const periodDays = Math.ceil(
      (filterEndDate - filterStartDate) / (1000 * 60 * 60 * 24)
    );
    const prevStartDate = new Date(filterStartDate);
    prevStartDate.setDate(prevStartDate.getDate() - periodDays);
    const prevEndDate = new Date(filterStartDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);

    const prevPeriodData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: prevStartDate, $lte: prevEndDate },
          status: { $nin: ["cancelled", "refunded"] },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$total" },
          orderCount: { $sum: 1 },
        },
      },
    ]);

    const prevRevenue = prevPeriodData[0]?.revenue || 0;
    const prevOrders = prevPeriodData[0]?.orderCount || 0;
    const revenueChange =
      prevRevenue > 0
        ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100 * 10) /
          10
        : 100;
    const ordersChange =
      prevOrders > 0
        ? Math.round(((totalOrders - prevOrders) / prevOrders) * 100 * 10) / 10
        : 100;

    logger.info({
      route: "SalesReportController.getRevenueTrend",
      event: "SUCCESS",
      period,
      dataPoints: filledData.length,
      totalRevenue,
      totalOrders,
    });

    res.json({
      success: true,
      period,
      dateRange: {
        start: filterStartDate.toISOString().split("T")[0],
        end: filterEndDate.toISOString().split("T")[0],
      },
      data: filledData,
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalOrders,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        revenueChange,
        ordersChange,
        isRevenueIncrease: totalRevenue >= prevRevenue,
        isOrdersIncrease: totalOrders >= prevOrders,
      },
      timestamp: now,
    });
  } catch (err) {
    logger.error({
      route: "SalesReportController.getRevenueTrend",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSalesByCategory = async (req, res) => {
  try {
    const { period = "all", startDate, endDate } = req.query;

    logger.info({
      route: "SalesReportController.getSalesByCategory",
      period,
      startDate,
      endDate,
      requestedBy: req.user?.email || req.employee?.email,
    });

    const now = new Date();
    let filterStartDate;
    let filterEndDate = now;

    // Determine date range
    if (period !== "all") {
      switch (period) {
        case "7days":
          filterStartDate = new Date(now);
          filterStartDate.setDate(filterStartDate.getDate() - 7);
          break;

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
          period = "all";
      }
    }

    // Build date filter
    const dateFilter =
      period === "all"
        ? {}
        : { createdAt: { $gte: filterStartDate, $lte: filterEndDate } };

    logger.debug({
      route: "SalesReportController.getSalesByCategory",
      dateFilter,
    });

    // Aggregate sales by category
    const categorySales = await Order.aggregate([
      {
        $match: {
          ...dateFilter,
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
          totalRevenue: { $sum: "$items.lineTotalBeforeCoupon" },
          totalOrders: { $sum: 1 },
          totalQuantitySold: { $sum: "$items.quantity" },
          uniqueProducts: { $addToSet: "$items.product" },
        },
      },
      {
        $project: {
          _id: 1,
          categoryName: 1,
          totalRevenue: 1,
          totalOrders: 1,
          totalQuantitySold: 1,
          uniqueProductCount: { $size: "$uniqueProducts" },
        },
      },
      {
        $sort: { totalRevenue: -1 },
      },
    ]);

    // Get all categories (including those with no sales)
    const allCategories = await ProductCategory.find({ status: "active" })
      .select("name")
      .lean();

    // Create a map of category sales
    const salesMap = {};
    categorySales.forEach((cat) => {
      salesMap[cat.categoryName] = cat;
    });

    // Fill in categories with zero sales
    const completeData = allCategories.map((cat) => {
      const salesData = salesMap[cat.name];
      return {
        categoryId: cat._id,
        categoryName: cat.name,
        totalRevenue: Math.round((salesData?.totalRevenue || 0) * 100) / 100,
        totalOrders: salesData?.totalOrders || 0,
        totalQuantitySold: salesData?.totalQuantitySold || 0,
        uniqueProductCount: salesData?.uniqueProductCount || 0,
        avgOrderValue:
          salesData?.totalOrders > 0
            ? Math.round(
                (salesData.totalRevenue / salesData.totalOrders) * 100
              ) / 100
            : 0,
      };
    });

    // Sort by revenue
    completeData.sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Calculate totals
    const totalRevenue = completeData.reduce(
      (sum, cat) => sum + cat.totalRevenue,
      0
    );
    const totalOrders = completeData.reduce(
      (sum, cat) => sum + cat.totalOrders,
      0
    );
    const totalQuantity = completeData.reduce(
      (sum, cat) => sum + cat.totalQuantitySold,
      0
    );

    // Get previous period for comparison
    if (period !== "all") {
      const periodDays = Math.ceil(
        (filterEndDate - filterStartDate) / (1000 * 60 * 60 * 24)
      );
      const prevStartDate = new Date(filterStartDate);
      prevStartDate.setDate(prevStartDate.getDate() - periodDays);
      const prevEndDate = new Date(filterStartDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);

      const prevPeriodData = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: prevStartDate, $lte: prevEndDate },
            status: { $nin: ["cancelled", "refunded"] },
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$total" },
          },
        },
      ]);

      const prevRevenue = prevPeriodData[0]?.revenue || 0;
      const revenueChange =
        prevRevenue > 0
          ? Math.round(
              ((totalRevenue - prevRevenue) / prevRevenue) * 100 * 10
            ) / 10
          : 100;

      logger.info({
        route: "SalesReportController.getSalesByCategory",
        event: "SUCCESS",
        period,
        categoriesCount: completeData.length,
        totalRevenue,
        revenueChange,
      });

      res.json({
        success: true,
        period,
        dateRange: {
          start: filterStartDate.toISOString().split("T")[0],
          end: filterEndDate.toISOString().split("T")[0],
        },
        data: completeData,
        summary: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalOrders,
          totalQuantitySold: totalQuantity,
          categoriesWithSales: completeData.filter((c) => c.totalRevenue > 0)
            .length,
          revenueChange,
          isIncrease: totalRevenue >= prevRevenue,
        },
        timestamp: now,
      });
    } else {
      logger.info({
        route: "SalesReportController.getSalesByCategory",
        event: "SUCCESS",
        period: "all",
        categoriesCount: completeData.length,
        totalRevenue,
      });

      res.json({
        success: true,
        period: "all",
        data: completeData,
        summary: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalOrders,
          totalQuantitySold: totalQuantity,
          categoriesWithSales: completeData.filter((c) => c.totalRevenue > 0)
            .length,
        },
        timestamp: now,
      });
    }
  } catch (err) {
    logger.error({
      route: "SalesReportController.getSalesByCategory",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getProductSalesReport = async (req, res) => {
  try {
    const {
      period = "all",
      startDate,
      endDate,
      category,
      search,
      sortBy = "revenue",
      sortOrder = "desc",
    } = req.query;

    logger.info({
      route: "SalesReportController.getProductSalesReport",
      period,
      startDate,
      endDate,
      category,
      search,
      requestedBy: req.user?.email || req.employee?.email,
    });

    const now = new Date();
    let filterStartDate;
    let filterEndDate = now;

    // Determine date range based on period
    if (period !== "all") {
      switch (period) {
        case "7days":
          filterStartDate = new Date(now);
          filterStartDate.setDate(filterStartDate.getDate() - 7);
          break;

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
          period = "all";
      }
    }

    // Build date filter for orders
    const dateFilter =
      period === "all"
        ? {}
        : { createdAt: { $gte: filterStartDate, $lte: filterEndDate } };

    logger.debug({
      route: "SalesReportController.getProductSalesReport",
      dateFilter,
      period,
    });

    // Build aggregation pipeline
    const pipeline = [
      {
        $match: {
          ...dateFilter,
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
        $lookup: {
          from: "shops",
          localField: "items.shop",
          foreignField: "_id",
          as: "shopDetails",
        },
      },
      { $unwind: "$shopDetails" },
    ];

    // Add category filter if specified
    if (category) {
      pipeline.push({
        $match: {
          "categoryDetails._id": require("mongoose").Types.ObjectId(category),
        },
      });
    }

    // Add search filter if specified
    if (search) {
      pipeline.push({
        $match: {
          "productDetails.productName": { $regex: search, $options: "i" },
        },
      });
    }

    // Group by product to aggregate sales
    pipeline.push(
      {
        $group: {
          _id: "$items.product",
          productName: { $first: "$productDetails.productName" },
          categoryId: { $first: "$categoryDetails._id" },
          categoryName: { $first: "$categoryDetails.name" },
          sku: { $first: "$productDetails.sku" },
          unitPrice: { $first: "$productDetails.unitPrice" },

          // Total units sold
          unitsSold: { $sum: "$items.quantity" },

          // Total revenue (line total includes all discounts + tax)
          totalRevenue: { $sum: "$items.lineTotalBeforeCoupon" },

          // Number of orders this product appeared in
          orderCount: { $sum: 1 },

          // Unique shops selling this product
          shopCount: { $addToSet: "$shopDetails._id" },

          // Average price per unit sold (considering discounts)
          avgPriceSold: { $avg: "$items.finalUnitPrice" },
        },
      },
      {
        $project: {
          _id: 1,
          productName: 1,
          categoryId: 1,
          categoryName: 1,
          sku: 1,
          unitPrice: 1,
          unitsSold: 1,
          totalRevenue: 1,
          orderCount: 1,
          shopCount: { $size: "$shopCount" },
          avgPriceSold: 1,
        },
      }
    );

    // Execute aggregation
    const productSales = await Order.aggregate(pipeline);

    // Calculate total revenue for percentage calculation
    const totalRevenue = productSales.reduce(
      (sum, item) => sum + item.totalRevenue,
      0
    );
    const totalUnitsSold = productSales.reduce(
      (sum, item) => sum + item.unitsSold,
      0
    );

    // Enrich data with percentage and format
    const enrichedData = productSales.map((item) => ({
      productId: item._id,
      productName: item.productName,
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      sku: item.sku,
      unitPrice: Math.round(item.unitPrice * 100) / 100,
      unitsSold: item.unitsSold,
      totalRevenue: Math.round(item.totalRevenue * 100) / 100,
      percentOfTotal:
        totalRevenue > 0
          ? Math.round((item.totalRevenue / totalRevenue) * 100 * 10) / 10
          : 0,
      orderCount: item.orderCount,
      shopCount: item.shopCount,
      avgPriceSold: Math.round(item.avgPriceSold * 100) / 100,
      avgRevenuePerOrder:
        item.orderCount > 0
          ? Math.round((item.totalRevenue / item.orderCount) * 100) / 100
          : 0,
    }));

    // Sort data
    const sortField =
      sortBy === "revenue"
        ? "totalRevenue"
        : sortBy === "units"
        ? "unitsSold"
        : sortBy === "orders"
        ? "orderCount"
        : sortBy === "name"
        ? "productName"
        : "totalRevenue";

    enrichedData.sort((a, b) => {
      if (sortOrder === "asc") {
        return a[sortField] > b[sortField] ? 1 : -1;
      }
      return a[sortField] < b[sortField] ? 1 : -1;
    });

    // Get comparison data if period is not "all"
    let comparison = null;
    if (period !== "all") {
      const periodDays = Math.ceil(
        (filterEndDate - filterStartDate) / (1000 * 60 * 60 * 24)
      );
      const prevStartDate = new Date(filterStartDate);
      prevStartDate.setDate(prevStartDate.getDate() - periodDays);
      const prevEndDate = new Date(filterStartDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);

      const prevPeriodData = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: prevStartDate, $lte: prevEndDate },
            status: { $nin: ["cancelled", "refunded"] },
          },
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$items.lineTotalBeforeCoupon" },
            units: { $sum: "$items.quantity" },
          },
        },
      ]);

      const prevRevenue = prevPeriodData[0]?.revenue || 0;
      const prevUnits = prevPeriodData[0]?.units || 0;

      const revenueChange =
        prevRevenue > 0
          ? Math.round(
              ((totalRevenue - prevRevenue) / prevRevenue) * 100 * 10
            ) / 10
          : 100;

      const unitsChange =
        prevUnits > 0
          ? Math.round(((totalUnitsSold - prevUnits) / prevUnits) * 100 * 10) /
            10
          : 100;

      comparison = {
        revenueChange,
        unitsChange,
        isRevenueIncrease: totalRevenue >= prevRevenue,
        isUnitsIncrease: totalUnitsSold >= prevUnits,
      };
    }

    logger.info({
      route: "SalesReportController.getProductSalesReport",
      event: "SUCCESS",
      period,
      productsCount: enrichedData.length,
      totalRevenue,
      totalUnitsSold,
    });

    res.json({
      success: true,
      period,
      dateRange:
        period !== "all"
          ? {
              start: filterStartDate.toISOString().split("T")[0],
              end: filterEndDate.toISOString().split("T")[0],
            }
          : null,
      data: enrichedData,
      summary: {
        totalProducts: enrichedData.length,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalUnitsSold,
        avgRevenuePerProduct:
          enrichedData.length > 0
            ? Math.round((totalRevenue / enrichedData.length) * 100) / 100
            : 0,
        avgUnitsPerProduct:
          enrichedData.length > 0
            ? Math.round((totalUnitsSold / enrichedData.length) * 10) / 10
            : 0,
      },
      comparison,
      timestamp: now,
    });
  } catch (err) {
    logger.error({
      route: "SalesReportController.getProductSalesReport",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: err.message });
  }
};
