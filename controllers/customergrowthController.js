const Customer = require("../models/Customer");
const CustomerGroup = require("../models/CustomerGroup");
const logger = require("../config/logger");

/**
 * Get customer growth analytics with date range filters
 * Supports: Last 7 days, Last 30 days, Last 90 days, This year
 */
exports.getCustomerGrowth = async (req, res) => {
  try {
    const { period = "7days", startDate: customStart, endDate: customEnd } = req.query;

    logger.info({
      route: "CustomerAnalyticsController.getCustomerGrowth",
      period,
      customStart,
      customEnd,
      requestedBy: req.user?.email || req.employee?.email,
    });

    const now = new Date();
    let startDate, endDate, groupFormat;

    // Determine date range and grouping format
    if (period === "custom") {
      // Custom date range
      if (!customStart || !customEnd) {
        return res.status(400).json({
          success: false,
          message: "Start date and end date are required for custom range",
        });
      }

      startDate = new Date(customStart);
      endDate = new Date(customEnd);

      // Validate dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format. Use YYYY-MM-DD",
        });
      }

      if (startDate > endDate) {
        return res.status(400).json({
          success: false,
          message: "Start date cannot be after end date",
        });
      }

      // Set end date to end of day
      endDate.setHours(23, 59, 59, 999);

      // Determine grouping based on date range
      const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 31) {
        groupFormat = "%Y-%m-%d"; // Daily
      } else if (daysDiff <= 90) {
        groupFormat = "%Y-%m-%d"; // Daily
      } else if (daysDiff <= 365) {
        groupFormat = "%Y-W%V"; // Weekly
      } else {
        groupFormat = "%Y-%m"; // Monthly
      }
    } else {
      // Predefined periods
      endDate = new Date(now);
      
      switch (period) {
        case "7days":
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
          groupFormat = "%Y-%m-%d";
          break;
        case "30days":
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 30);
          groupFormat = "%Y-%m-%d";
          break;
        case "90days":
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 90);
          groupFormat = "%Y-%m-%d";
          break;
        case "thisyear":
          startDate = new Date(now.getFullYear(), 0, 1);
          groupFormat = "%Y-%m";
          break;
        default:
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
          groupFormat = "%Y-%m-%d";
      }
    }

    // Aggregate customer growth data
    const growthData = await Customer.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: groupFormat, date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Calculate cumulative total
    let cumulative = 0;
    const processedData = growthData.map((item) => {
      cumulative += item.count;
      return {
        date: item._id,
        newCustomers: item.count,
        totalCustomers: cumulative,
      };
    });

    // Get previous period for comparison
    const prevStartDate = new Date(startDate);
    const daysDiff = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
    prevStartDate.setDate(prevStartDate.getDate() - daysDiff);

    const prevPeriodCount = await Customer.countDocuments({
      createdAt: { $gte: prevStartDate, $lt: startDate },
    });

    const currentPeriodCount = await Customer.countDocuments({
      createdAt: { $gte: startDate },
    });

    const percentageChange =
      prevPeriodCount > 0
        ? Math.round(
            ((currentPeriodCount - prevPeriodCount) / prevPeriodCount) * 100 *
              10
          ) / 10
        : 100;

    logger.info({
      route: "CustomerAnalyticsController.getCustomerGrowth",
      event: "SUCCESS",
      period,
      dataPoints: processedData.length,
    });

    res.json({
      success: true,
      period,
      data: processedData,
      summary: {
        currentPeriod: currentPeriodCount,
        previousPeriod: prevPeriodCount,
        percentageChange,
        isIncrease: currentPeriodCount >= prevPeriodCount,
      },
      timestamp: now,
    });
  } catch (err) {
    logger.error({
      route: "CustomerAnalyticsController.getCustomerGrowth",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get customer group distribution
 * Returns percentage breakdown of VIP, Retail, Wholesale customers
 */
exports.getGroupDistribution = async (req, res) => {
  try {
    const { period = "thismonth" } = req.query;

    logger.info({
      route: "CustomerAnalyticsController.getGroupDistribution",
      period,
      requestedBy: req.user?.email || req.employee?.email,
    });

    const now = new Date();
    let startDate;

    // Determine date range
    switch (period) {
      case "thismonth":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "lastmonth":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        break;
      case "thisyear":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case "alltime":
        startDate = new Date(0);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Get total customers
    const totalCustomers = await Customer.countDocuments({
      createdAt: { $gte: startDate },
    });

    // Get group distribution
    const groupDistribution = await CustomerGroup.aggregate([
      {
        $lookup: {
          from: "customers",
          localField: "customer",
          foreignField: "_id",
          as: "customerData",
        },
      },
      {
        $unwind: "$customerData",
      },
      {
        $match: {
          "customerData.createdAt": { $gte: startDate },
        },
      },
      {
        $group: {
          _id: "$currentGroup",
          count: { $sum: 1 },
        },
      },
    ]);

    const groupMap = {
      vip: 0,
      retail: 0,
      wholesale: 0,
    };

    groupDistribution.forEach((item) => {
      groupMap[item._id] = item.count;
    });

    // Calculate percentages
    const total = Object.values(groupMap).reduce((sum, count) => sum + count, 0);
    const percentages = {
      vip: total > 0 ? Math.round((groupMap.vip / total) * 100 * 100) / 100 : 0,
      retail:
        total > 0 ? Math.round((groupMap.retail / total) * 100 * 100) / 100 : 0,
      wholesale:
        total > 0
          ? Math.round((groupMap.wholesale / total) * 100 * 100) / 100
          : 0,
    };

    logger.info({
      route: "CustomerAnalyticsController.getGroupDistribution",
      event: "SUCCESS",
      period,
    });

    res.json({
      success: true,
      period,
      distribution: {
        counts: groupMap,
        percentages,
        total,
      },
      totalCustomers,
      timestamp: now,
    });
  } catch (err) {
    logger.error({
      route: "CustomerAnalyticsController.getGroupDistribution",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get detailed customer group list
 * Returns list of customers in each group with their details
 */
exports.getGroupDetails = async (req, res) => {
  try {
    logger.info({
      route: "CustomerAnalyticsController.getGroupDetails",
      requestedBy: req.user?.email || req.employee?.email,
    });

    // Get all groups with customer counts
    const groupDetails = await CustomerGroup.aggregate([
      {
        $group: {
          _id: "$currentGroup",
          count: { $sum: 1 },
          customers: { $push: "$customer" },
        },
      },
    ]);

    const detailedGroups = await Promise.all(
      groupDetails.map(async (group) => {
        // Get first 10 customers from each group
        const customerSample = await Customer.find({
          _id: { $in: group.customers.slice(0, 10) },
        }).select("firstName lastName email phone profilePhoto createdAt");

        return {
          groupName: group._id,
          totalCount: group.count,
          sampleCustomers: customerSample.map((c) => ({
            _id: c._id,
            name: `${c.firstName || ""} ${c.lastName || ""}`.trim() || "N/A",
            email: c.email,
            phone: c.phone,
            profilePhoto: c.profilePhoto,
            joinedDate: c.createdAt,
          })),
        };
      })
    );

    // Sort by VIP > Wholesale > Retail
    const sortOrder = { vip: 0, wholesale: 1, retail: 2 };
    detailedGroups.sort(
      (a, b) => sortOrder[a.groupName] - sortOrder[b.groupName]
    );

    logger.info({
      route: "CustomerAnalyticsController.getGroupDetails",
      event: "SUCCESS",
    });

    res.json({
      success: true,
      groups: detailedGroups,
      timestamp: new Date(),
    });
  } catch (err) {
    logger.error({
      route: "CustomerAnalyticsController.getGroupDetails",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get comprehensive customer analytics dashboard data
 * Combines growth, distribution, and group details
 */
exports.getDashboardAnalytics = async (req, res) => {
  try {
    const { growthPeriod = "7days", distributionPeriod = "thismonth" } =
      req.query;

    logger.info({
      route: "CustomerAnalyticsController.getDashboardAnalytics",
      growthPeriod,
      distributionPeriod,
      requestedBy: req.user?.email || req.employee?.email,
    });

    // Get all analytics in parallel
    const [totalCustomers, groupDistribution, recentGrowth] = await Promise.all(
      [
        // Total customers
        Customer.countDocuments({}),

        // Group distribution
        CustomerGroup.aggregate([
          {
            $group: {
              _id: "$currentGroup",
              count: { $sum: 1 },
            },
          },
        ]),

        // Recent growth (last 7 days)
        Customer.aggregate([
          {
            $match: {
              createdAt: {
                $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              count: { $sum: 1 },
            },
          },
          {
            $sort: { _id: 1 },
          },
        ]),
      ]
    );

    const groupMap = {
      vip: 0,
      retail: 0,
      wholesale: 0,
    };

    groupDistribution.forEach((item) => {
      groupMap[item._id] = item.count;
    });

    const total = Object.values(groupMap).reduce((sum, count) => sum + count, 0);
    const percentages = {
      vip: total > 0 ? Math.round((groupMap.vip / total) * 100 * 100) / 100 : 0,
      retail:
        total > 0 ? Math.round((groupMap.retail / total) * 100 * 100) / 100 : 0,
      wholesale:
        total > 0
          ? Math.round((groupMap.wholesale / total) * 100 * 100) / 100
          : 0,
    };

    logger.info({
      route: "CustomerAnalyticsController.getDashboardAnalytics",
      event: "SUCCESS",
    });

    res.json({
      success: true,
      dashboard: {
        totalCustomers,
        groupDistribution: {
          counts: groupMap,
          percentages,
        },
        recentGrowth,
      },
      timestamp: new Date(),
    });
  } catch (err) {
    logger.error({
      route: "CustomerAnalyticsController.getDashboardAnalytics",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: err.message });
  }
};