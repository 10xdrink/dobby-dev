const User = require("../models/User");
const Shop = require("../models/Shop");
const Order = require("../models/Order");
const Product = require("../models/productModel");
const CustomerGroup = require("../models/CustomerGroup");
const ReturnRequest = require("../models/ReturnRequest");
const Review = require("../models/Review");
const logger = require("../config/logger");

// get total shopkeeper, active shop, pending order, daily turnover, completed orders, return requests, reviews
exports.getAdminDashboardStats = async (req, res) => {
  try {
    const requestId = req.requestId || "admin-stats";
    const context = {
      route: "AdminDashboardController.getAdminDashboardStats",
      requestId,
    };

    logger.info({
      ...context,
      event: "DASHBOARD_STATS_REQUEST",
      requestedBy: req.user?.email || req.employee?.email,
    });

    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const lastMonthStart = new Date(now);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    lastMonthStart.setHours(0, 0, 0, 0);

    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    lastWeekStart.setHours(0, 0, 0, 0);

    const [
      totalShopkeepers,
      totalShopkeepersLastMonth,

      activeShops,
      activeShopsLastMonth,

      pendingOrders,
      pendingOrdersLastWeek,

      todayTurnover,
      yesterdayTurnover,

      
      completedOrders,
      completedOrdersLastMonth,

      
      returnRequests,
      returnRequestsLastWeek,

      
      newReviews,
      newReviewsLastWeek,
    ] = await Promise.all([
      User.countDocuments({ role: "shopkeeper" }),
      User.countDocuments({
        role: "shopkeeper",
        createdAt: { $lt: lastMonthStart },
      }),

      Shop.countDocuments({ status: "active" }),
      Shop.countDocuments({
        status: "active",
        createdAt: { $lt: lastMonthStart },
      }),

      Order.countDocuments({
        status: { $in: ["pending", "confirmed", "packed"] },
      }),
      Order.countDocuments({
        status: { $in: ["pending", "confirmed", "packed"] },
        createdAt: { $lt: lastWeekStart },
      }),

      // Today's Turnover
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: todayStart },
            status: { $nin: ["cancelled", "refunded"] },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$total" },
            orderCount: { $sum: 1 },
          },
        },
      ]),

      // Yesterday's Turnover
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: yesterdayStart, $lt: todayStart },
            status: { $nin: ["cancelled", "refunded"] },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$total" },
            orderCount: { $sum: 1 },
          },
        },
      ]),

      
      Order.countDocuments({ status: "delivered" }),

      
      Order.countDocuments({
        status: "delivered",
        deliveredAt: { $lt: lastMonthStart },
      }),

      
      ReturnRequest.countDocuments({ status: "processing" }),

      
      ReturnRequest.countDocuments({
        status: "processing",
        createdAt: { $lt: lastWeekStart },
      }),

      
      Review.countDocuments({ status: "pending" }),

      
      Review.countDocuments({
        status: "pending",
        createdAt: { $lt: lastWeekStart },
      }),
    ]);

    const calculatePercentage = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      const change = ((current - previous) / previous) * 100;
      return Math.round(change * 10) / 10;
    };

    // Extract turnover values
    const todayRevenue = todayTurnover[0]?.totalRevenue || 0;
    const yesterdayRevenue = yesterdayTurnover[0]?.totalRevenue || 0;

    const stats = {
      totalShopkeepers: {
        count: totalShopkeepers,
        change: calculatePercentage(
          totalShopkeepers,
          totalShopkeepersLastMonth
        ),
        comparison: "from last month",
        isIncrease: totalShopkeepers >= totalShopkeepersLastMonth,
      },
      activeShops: {
        count: activeShops,
        change: calculatePercentage(activeShops, activeShopsLastMonth),
        comparison: "from last month",
        isIncrease: activeShops >= activeShopsLastMonth,
      },
      pendingOrders: {
        count: pendingOrders,
        change: calculatePercentage(pendingOrders, pendingOrdersLastWeek),
        comparison: "from last week",
        isIncrease: pendingOrders >= pendingOrdersLastWeek,
      },
      dailyTurnover: {
        amount: Math.round(todayRevenue * 100) / 100,
        change: calculatePercentage(todayRevenue, yesterdayRevenue),
        comparison: "from yesterday",
        isIncrease: todayRevenue >= yesterdayRevenue,
        currency: "INR",
      },
      
      completedOrders: {
        count: completedOrders,
        change: calculatePercentage(completedOrders, completedOrdersLastMonth),
        comparison: "from last month",
        isIncrease: completedOrders >= completedOrdersLastMonth,
      },
      
      returnRequests: {
        count: returnRequests,
        change: calculatePercentage(returnRequests, returnRequestsLastWeek),
        comparison: "from last week",
        isIncrease: returnRequests >= returnRequestsLastWeek,
        status: "processing", 
      },
      
      newReviews: {
        count: newReviews,
        change: calculatePercentage(newReviews, newReviewsLastWeek),
        comparison: "from last week",
        isIncrease: newReviews >= newReviewsLastWeek,
        status: "pending", 
      },
    };

    logger.info({
      ...context,
      event: "DASHBOARD_STATS_SUCCESS",
      stats: {
        totalShopkeepers,
        activeShops,
        pendingOrders,
        dailyTurnover: todayRevenue,
        completedOrders,
        returnRequests,
        newReviews,
      },
    });

    res.json({
      success: true,
      stats,
      timestamp: new Date(),
    });
  } catch (err) {
    logger.error({
      route: "AdminDashboardController.getAdminDashboardStats",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


exports.getSalesAnalyticsByCategory = async (req, res) => {
  try {
    const { period = "last30days" } = req.query;
    const { page = 1, limit = 10 } = req.query;

    const requestId = req.requestId || "sales-analytics";
    const context = {
      route: "AdminDashboardController.getSalesAnalyticsByCategory",
      requestId,
    };

    logger.info({
      ...context,
      event: "SALES_ANALYTICS_REQUEST",
      period,
      page,
      limit,
      requestedBy: req.user?.email || req.employee?.email,
    });

    const now = new Date();
    let startDate;

    switch (period) {
      case "last7days":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "last30days":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        break;
      case "last90days":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 90);
        break;
      case "thisyear":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const categoryAnalytics = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $nin: ["cancelled", "refunded"] },
        },
      },

      { $unwind: "$items" },
      // Lookup product details
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      // Lookup category details
      {
        $lookup: {
          from: "productcategories",
          localField: "productDetails.category",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      { $unwind: "$categoryDetails" },
      // Group by category
      {
        $group: {
          _id: "$categoryDetails._id",
          categoryName: { $first: "$categoryDetails.name" },
          totalSales: { $sum: "$items.lineTotalBeforeCoupon" },
          totalOrders: { $sum: 1 },
          totalQuantity: { $sum: "$items.quantity" },
          avgOrderValue: { $avg: "$items.lineTotalBeforeCoupon" },
        },
      },
      // Sort by total sales descending
      { $sort: { totalSales: -1 } },
      // Pagination
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limitNum }],
          totalCount: [{ $count: "count" }],
        },
      },
    ]);

    const data = categoryAnalytics[0]?.data || [];
    const totalCount = categoryAnalytics[0]?.totalCount[0]?.count || 0;

    // Calculate total sales across all categories
    const totalSales = data.reduce((sum, cat) => sum + cat.totalSales, 0);

    // Add percentage contribution for each category
    const formattedData = data.map((item) => ({
      categoryId: item._id,
      categoryName: item.categoryName,
      totalSales: Math.round(item.totalSales * 100) / 100,
      totalOrders: item.totalOrders,
      totalQuantity: item.totalQuantity,
      avgOrderValue: Math.round(item.avgOrderValue * 100) / 100,
      percentageOfTotal:
        totalSales > 0
          ? Math.round((item.totalSales / totalSales) * 100 * 10) / 10
          : 0,
    }));

    logger.info({
      ...context,
      event: "SALES_ANALYTICS_SUCCESS",
      period,
      categoriesReturned: formattedData.length,
      totalSales,
    });

    res.json({
      success: true,
      period,
      data: formattedData,
      summary: {
        totalSales: Math.round(totalSales * 100) / 100,
        totalCategories: totalCount,
      },
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalRecords: totalCount,
        limit: limitNum,
      },
      timestamp: new Date(),
    });
  } catch (err) {
    logger.error({
      route: "AdminDashboardController.getSalesAnalyticsByCategory",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


exports.getRevenueByCustomerGroup = async (req, res) => {
  try {
    const { period = "thismonth" } = req.query;

    const requestId = req.requestId || "revenue-groups";
    const context = {
      route: "AdminDashboardController.getRevenueByCustomerGroup",
      requestId,
    };

    logger.info({
      ...context,
      event: "REVENUE_GROUPS_REQUEST",
      period,
      requestedBy: req.user?.email || req.employee?.email,
    });

    const now = new Date();
    let startDate, endDate;

    // Determine date range
    switch (period) {
      case "thismonth":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "lastmonth":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "thisquarter":
        const currentQuarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
        endDate = new Date(now.getFullYear(), currentQuarter * 3 + 3, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
    }

    // Get revenue by customer group
    const groupRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $nin: ["cancelled", "refunded"] },
        },
      },
      // Lookup customer group
      {
        $lookup: {
          from: "customergroups",
          localField: "customer",
          foreignField: "customer",
          as: "customerGroup",
        },
      },
      { $unwind: { path: "$customerGroup", preserveNullAndEmptyArrays: true } },
      // Group by customer group
      {
        $group: {
          _id: {
            $ifNull: ["$customerGroup.currentGroup", "retail"],
          },
          totalRevenue: { $sum: "$total" },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: "$total" },
        },
      },
    ]);

    // Calculate total revenue
    const totalRevenue = groupRevenue.reduce(
      (sum, group) => sum + group.totalRevenue,
      0
    );

    // Initialize all groups (even if no orders)
    const groupMap = {
      retail: { totalRevenue: 0, orderCount: 0, avgOrderValue: 0 },
      wholesale: { totalRevenue: 0, orderCount: 0, avgOrderValue: 0 },
      vip: { totalRevenue: 0, orderCount: 0, avgOrderValue: 0 },
    };

    groupRevenue.forEach((item) => {
      groupMap[item._id] = {
        totalRevenue: item.totalRevenue,
        orderCount: item.orderCount,
        avgOrderValue: item.avgOrderValue,
      };
    });

    const distribution = Object.entries(groupMap).map(([group, data]) => ({
      group,
      totalRevenue: Math.round(data.totalRevenue * 100) / 100,
      orderCount: data.orderCount,
      avgOrderValue: Math.round(data.avgOrderValue * 100) / 100,
      percentage:
        totalRevenue > 0
          ? Math.round((data.totalRevenue / totalRevenue) * 100 * 100) / 100
          : 0,
    }));

    // Sort by revenue (highest first)
    distribution.sort((a, b) => b.totalRevenue - a.totalRevenue);

    logger.info({
      ...context,
      event: "REVENUE_GROUPS_SUCCESS",
      period,
      totalRevenue,
      groups: distribution.length,
    });

    res.json({
      success: true,
      period,
      startDate,
      endDate,
      distribution,
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalOrders: groupRevenue.reduce((sum, g) => sum + g.orderCount, 0),
      },
      timestamp: new Date(),
    });
  } catch (err) {
    logger.error({
      route: "AdminDashboardController.getRevenueByCustomerGroup",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


exports.getCompletedOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, sortBy = "deliveredAt" } = req.query;

    const requestId = req.requestId || "completed-orders";
    const context = {
      route: "AdminDashboardController.getCompletedOrders",
      requestId,
    };

    logger.info({
      ...context,
      event: "COMPLETED_ORDERS_REQUEST",
      page,
      limit,
      requestedBy: req.user?.email || req.employee?.email,
    });

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const sortOptions = {};
    sortOptions[sortBy] = -1; // descending order

    const [orders, totalCount] = await Promise.all([
      Order.find({ status: "delivered" })
        .populate("customer", "firstName lastName email phone")
        .populate("items.shop", "shopName")
        .populate("address")
        .select(
          "orderNumber customer items total deliveredAt createdAt address"
        )
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),

      Order.countDocuments({ status: "delivered" }),
    ]);

    logger.info({
      ...context,
      event: "COMPLETED_ORDERS_SUCCESS",
      ordersReturned: orders.length,
      totalCount,
    });

    res.json({
      success: true,
      data: orders,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalRecords: totalCount,
        limit: limitNum,
      },
      timestamp: new Date(),
    });
  } catch (err) {
    logger.error({
      route: "AdminDashboardController.getCompletedOrders",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


exports.getReturnRequests = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = "processing" } = req.query;

    const requestId = req.requestId || "return-requests";
    const context = {
      route: "AdminDashboardController.getReturnRequests",
      requestId,
    };

    logger.info({
      ...context,
      event: "RETURN_REQUESTS_REQUEST",
      page,
      limit,
      status,
      requestedBy: req.user?.email || req.employee?.email,
    });

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (status && ["processing", "completed", "rejected"].includes(status)) {
      filter.status = status;
    }

    const [requests, totalCount] = await Promise.all([
      ReturnRequest.find(filter)
        .populate("customer", "firstName lastName email phone")
        .populate("shop", "shopName")
        .populate("product", "productName icon1")
        .populate("order", "orderNumber")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),

      ReturnRequest.countDocuments(filter),
    ]);

    logger.info({
      ...context,
      event: "RETURN_REQUESTS_SUCCESS",
      requestsReturned: requests.length,
      totalCount,
    });

    res.json({
      success: true,
      data: requests,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalRecords: totalCount,
        limit: limitNum,
      },
      timestamp: new Date(),
    });
  } catch (err) {
    logger.error({
      route: "AdminDashboardController.getReturnRequests",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


exports.getNewReviews = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = "pending" } = req.query;

    const requestId = req.requestId || "new-reviews";
    const context = {
      route: "AdminDashboardController.getNewReviews",
      requestId,
    };

    logger.info({
      ...context,
      event: "NEW_REVIEWS_REQUEST",
      page,
      limit,
      status,
      requestedBy: req.user?.email || req.employee?.email,
    });

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (status && ["pending", "published", "rejected"].includes(status)) {
      filter.status = status;
    }

    const [reviews, totalCount] = await Promise.all([
      Review.find(filter)
        .populate("customer", "firstName lastName email")
        .populate("product", "productName icon1 shop")
        .populate({
          path: "product",
          populate: {
            path: "shop",
            select: "shopName",
          },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),

      Review.countDocuments(filter),
    ]);

    logger.info({
      ...context,
      event: "NEW_REVIEWS_SUCCESS",
      reviewsReturned: reviews.length,
      totalCount,
    });

    res.json({
      success: true,
      data: reviews,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalRecords: totalCount,
        limit: limitNum,
      },
      timestamp: new Date(),
    });
  } catch (err) {
    logger.error({
      route: "AdminDashboardController.getNewReviews",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};