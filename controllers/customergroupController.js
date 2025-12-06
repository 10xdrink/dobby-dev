const CustomerGroup = require("../models/CustomerGroup");
const customerGroupingService = require("../services/customergroupingService");
const logger = require("../config/logger");

/**
 * Get customer group distribution for admin dashboard
 */
exports.getGroupDistribution = async (req, res) => {
  try {
    logger.info({
      event: "GET_GROUP_DISTRIBUTION",
      adminId: req.user?.id,
    });

    const distribution = await CustomerGroup.getGroupDistribution();

    const total = distribution.retail + distribution.wholesale + distribution.vip;

    res.json({
      success: true,
      data: {
        distribution,
        total,
        percentages: {
          retail: total > 0 ? ((distribution.retail / total) * 100).toFixed(2) : 0,
          wholesale: total > 0 ? ((distribution.wholesale / total) * 100).toFixed(2) : 0,
          vip: total > 0 ? ((distribution.vip / total) * 100).toFixed(2) : 0,
        },
      },
    });
  } catch (err) {
    logger.error({
      event: "GET_GROUP_DISTRIBUTION_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: "Failed to get group distribution",
    });
  }
};

/**
 * Get customers by group with pagination
 */
exports.getCustomersByGroup = async (req, res) => {
  try {
    const { group } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    logger.info({
      event: "GET_CUSTOMERS_BY_GROUP",
      adminId: req.user?.id,
      group,
      page,
      limit,
    });

    if (!["retail", "wholesale", "vip"].includes(group)) {
      return res.status(400).json({
        success: false,
        message: "Invalid group. Must be: retail, wholesale, or vip",
      });
    }

    const result = await CustomerGroup.getCustomersByGroup(group, page, limit);

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    logger.error({
      event: "GET_CUSTOMERS_BY_GROUP_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: "Failed to get customers",
    });
  }
};

/**
 * Get detailed customer group info
 */
exports.getCustomerGroupDetails = async (req, res) => {
  try {
    const { customerId } = req.params;

    logger.info({
      event: "GET_CUSTOMER_GROUP_DETAILS",
      adminId: req.user?.id,
      customerId,
    });

    const customerGroup = await CustomerGroup.findOne({
      customer: customerId,
    }).populate("customer", "firstName lastName email phone createdAt");

    if (!customerGroup) {
      return res.status(404).json({
        success: false,
        message: "Customer group record not found",
      });
    }

    res.json({
      success: true,
      data: customerGroup,
    });
  } catch (err) {
    logger.error({
      event: "GET_CUSTOMER_GROUP_DETAILS_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: "Failed to get customer details",
    });
  }
};

/**
 * Manually trigger group re-evaluation for a customer
 */
exports.reevaluateCustomerGroup = async (req, res) => {
  try {
    const { customerId } = req.params;

    logger.info({
      event: "MANUAL_GROUP_REEVALUATION",
      adminId: req.user?.id,
      customerId,
    });

    const result = await customerGroupingService.evaluateCustomerGroup(
      customerId
    );

    res.json({
      success: true,
      message: "Customer group re-evaluated successfully",
      data: result,
    });
  } catch (err) {
    logger.error({
      event: "MANUAL_GROUP_REEVALUATION_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: "Failed to re-evaluate customer group",
    });
  }
};

/**
 * Get group statistics with advanced metrics
 */
exports.getGroupStatistics = async (req, res) => {
  try {
    logger.info({
      event: "GET_GROUP_STATISTICS",
      adminId: req.user?.id,
    });

    // Get distribution
    const distribution = await CustomerGroup.getGroupDistribution();

    // Get aggregate statistics by group
    const stats = await CustomerGroup.aggregate([
      {
        $group: {
          _id: "$currentGroup",
          totalCustomers: { $sum: 1 },
          avgTotalSpent: { $avg: "$metrics.totalSpent" },
          avgTotalOrders: { $avg: "$metrics.totalOrders" },
          avgOrderValue: { $avg: "$metrics.avgOrderValue" },
          totalRevenue: { $sum: "$metrics.totalSpent" },
        },
      },
    ]);

    // Format stats
    const formattedStats = {
      retail: { totalCustomers: 0, avgTotalSpent: 0, avgTotalOrders: 0, avgOrderValue: 0, totalRevenue: 0 },
      wholesale: { totalCustomers: 0, avgTotalSpent: 0, avgTotalOrders: 0, avgOrderValue: 0, totalRevenue: 0 },
      vip: { totalCustomers: 0, avgTotalSpent: 0, avgTotalOrders: 0, avgOrderValue: 0, totalRevenue: 0 },
    };

    stats.forEach((stat) => {
      if (formattedStats[stat._id]) {
        formattedStats[stat._id] = {
          totalCustomers: stat.totalCustomers,
          avgTotalSpent: Math.round(stat.avgTotalSpent || 0),
          avgTotalOrders: Math.round(stat.avgTotalOrders || 0),
          avgOrderValue: Math.round(stat.avgOrderValue || 0),
          totalRevenue: Math.round(stat.totalRevenue || 0),
        };
      }
    });

    // Get recent group changes
    const recentChanges = await CustomerGroup.find({
      "groupHistory.0": { $exists: true },
    })
      .sort({ "groupHistory.changedAt": -1 })
      .limit(10)
      .populate("customer", "firstName lastName email")
      .select("customer currentGroup groupHistory")
      .lean();

    const recentChangesFormatted = recentChanges.map((cg) => ({
      customer: cg.customer,
      currentGroup: cg.currentGroup,
      latestChange: cg.groupHistory[cg.groupHistory.length - 1],
    }));

    res.json({
      success: true,
      data: {
        distribution,
        statistics: formattedStats,
        recentChanges: recentChangesFormatted,
      },
    });
  } catch (err) {
    logger.error({
      event: "GET_GROUP_STATISTICS_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: "Failed to get group statistics",
    });
  }
};

/**
 * Bulk re-evaluate all customers (admin only)
 */
exports.bulkReevaluateGroups = async (req, res) => {
  try {
    logger.info({
      event: "BULK_GROUP_REEVALUATION",
      adminId: req.user?.id,
    });

    // This should be run as a background job, but for now return accepted
    res.status(202).json({
      success: true,
      message: "Bulk re-evaluation started. This may take a few minutes.",
    });

    // Start evaluation in background
    customerGroupingService.evaluateAllCustomers().catch((err) => {
      logger.error({
        event: "BULK_REEVALUATION_ERROR",
        error: err.message,
      });
    });
  } catch (err) {
    logger.error({
      event: "BULK_GROUP_REEVALUATION_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: "Failed to start bulk re-evaluation",
    });
  }
};