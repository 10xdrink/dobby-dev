const Customer = require("../models/Customer");
const Order = require("../models/Order");
const CustomerGroup = require("../models/CustomerGroup");
const logger = require("../config/logger");
const mongoose = require("mongoose");

class CustomerManagementService {
  /**
   * Get customers with filters, pagination, and aggregated data
   */
  async getCustomers({
    page = 1,
    limit = 50,
    group,
    status,
    search,
    sortBy = "createdAt",
    sortOrder = "desc",
  }) {
    const context = {
      service: "CustomerManagementService.getCustomers",
    };

    try {
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      logger.info({
        ...context, 
        event: "GET_CUSTOMERS_START",
        filters: { page, limit, group, status, search, sortBy, sortOrder },
      });

      // If filtering by group, we need to get customer IDs from CustomerGroup first to support pagination
      let groupCustomerIds = null;
      if (group) {
        const groupMatches = await CustomerGroup.find({ currentGroup: group }).select("customer").lean();
        groupCustomerIds = groupMatches.map(g => g.customer);
      }

      // Build filter
      const filter = {};

      if (groupCustomerIds) {
        filter._id = { $in: groupCustomerIds };
      }

      if (status === "blocked") {
        filter.isBlocked = true;
      } else if (status === "active") {
        filter.isBlocked = false;
      }

      if (search) {
        filter.$or = [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ];
      }

      // Get customers
      let customers = await Customer.find(filter)
        .select(
          "firstName lastName email phone profilePhoto createdAt isBlocked authProvider"
        )
        .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

      const customerIds = customers.map((c) => c._id);

      // Get aggregated order data
      const orderStats = await this._getOrderStats(customerIds);
      const customerGroups = await this._getCustomerGroups(customerIds);

      // Create lookup maps
      const orderStatsMap = {};
      orderStats.forEach((stat) => {
        orderStatsMap[stat._id.toString()] = {
          totalOrders: stat.totalOrders,
          totalSpent: stat.totalSpent,
        };
      });

      const groupMap = {};
      customerGroups.forEach((cg) => {
        groupMap[cg.customer.toString()] = cg.currentGroup;
      });

      // Enrich customer data
      customers = customers.map((customer) => {
        const customerId = customer._id.toString();
        const stats = orderStatsMap[customerId] || {
          totalOrders: 0,
          totalSpent: 0,
        };
        const customerGroup = groupMap[customerId] || "retail";

        return {
          _id: customer._id,
          customerId: `#CUS-${customer._id.toString().slice(-6).toUpperCase()}`,
          name: `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || "N/A",
          email: customer.email,
          phone: customer.phone,
          profilePhoto: customer.profilePhoto,
          totalOrders: stats.totalOrders,
          totalSpent: Math.round(stats.totalSpent * 100) / 100,
          group: customerGroup,
          status: customer.isBlocked ? "blocked" : "active",
          createdAt: customer.createdAt,
          authProvider: customer.authProvider,
        };
      });

      // Get total count and summary
      const totalCount = await Customer.countDocuments(filter);
      const summary = await this._getCustomerSummary(customerIds, filter);

      logger.info({
        ...context,
        event: "GET_CUSTOMERS_SUCCESS",
        count: customers.length,
        page: pageNum,
      });

      return {
        customers,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalCount / limitNum),
          totalRecords: totalCount,
          limit: limitNum,
        },
        summary,
      };
    } catch (err) {
      logger.error({
        ...context,
        event: "GET_CUSTOMERS_ERROR",
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }
  }

  /**
   * Get customer details by ID
   */
  async getCustomerById(customerId) {
    const context = {
      service: "CustomerManagementService.getCustomerById",
      customerId,
    };

    try {
      logger.info({
        ...context,
        event: "GET_CUSTOMER_DETAILS_START",
      });

      const customer = await Customer.findById(customerId)
        .select("-password")
        .lean();

      if (!customer) {
        throw new Error("Customer not found");
      }

      // Get order statistics
      const orderStats = await Order.aggregate([
        {
          $match: {
            customer: customer._id,
            status: {
              $in: [
                "pending", 
                "confirmed", 
                "packed", 
                "shipped", 
                "in_transit", 
                "delivered"
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalSpent: { $sum: "$total" },
            avgOrderValue: { $avg: "$total" },
            highestOrder: { $max: "$total" },
          },
        },
      ]);

      // Get customer group details
      const customerGroup = await CustomerGroup.findOne({
        customer: customerId,
      }).lean();

      // Get recent orders
      const recentOrders = await Order.find({ customer: customerId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select("orderNumber total status createdAt shipments")
        .lean();

      // Get monthly order trend (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const monthlyTrend = await Order.aggregate([
        {
          $match: {
            customer: customer._id,
            createdAt: { $gte: sixMonthsAgo },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            orders: { $sum: 1 },
            spent: { $sum: "$total" },
          },
        },
        {
          $sort: { "_id.year": 1, "_id.month": 1 },
        },
      ]);

      const stats = orderStats[0] || {
        totalOrders: 0,
        totalSpent: 0,
        avgOrderValue: 0,
        highestOrder: 0,
      };

      const customerDetails = {
        _id: customer._id,
        customerId: `#CUS-${customer._id.toString().slice(-6).toUpperCase()}`,
        name: `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || "N/A",
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        profilePhoto: customer.profilePhoto,
        birthday: customer.birthday,
        createdAt: customer.createdAt,
        status: customer.isBlocked ? "blocked" : "active",
        authProvider: customer.authProvider || "local",
        group: {
          current: customerGroup?.currentGroup || "retail",
          allGroups: customerGroup?.groups || ["retail"],
          lastEvaluated: customerGroup?.lastEvaluatedAt,
          history: customerGroup?.groupHistory?.slice(-5) || [], // Last 5 changes
          metrics: customerGroup?.metrics || {},
        },
        statistics: {
          totalOrders: stats.totalOrders,
          totalSpent: Math.round(stats.totalSpent * 100) / 100,
          avgOrderValue: Math.round(stats.avgOrderValue * 100) / 100,
          highestOrder: Math.round(stats.highestOrder * 100) / 100,
        },
        recentOrders: recentOrders.map((order) => ({
          orderNumber: order.orderNumber,
          total: Math.round(order.total * 100) / 100,
          status: order.status,
          createdAt: order.createdAt,
          shipmentCount: order.shipments?.length || 0,
        })),
        monthlyTrend: monthlyTrend.map((m) => ({
          month: `${m._id.year}-${String(m._id.month).padStart(2, "0")}`,
          orders: m.orders,
          spent: Math.round(m.spent * 100) / 100,
        })),
      };

      logger.info({
        ...context,
        event: "GET_CUSTOMER_DETAILS_SUCCESS",
      });

      return customerDetails;
    } catch (err) {
      logger.error({
        ...context,
        event: "GET_CUSTOMER_DETAILS_ERROR",
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }
  }

  /**
   * Block a customer
   */
  async blockCustomer(customerId) {
    const context = {
      service: "CustomerManagementService.blockCustomer",
      customerId,
    };

    try {
      logger.info({
        ...context,
        event: "BLOCK_CUSTOMER_START",
      });

      const customer = await Customer.findById(customerId);
      if (!customer) {
        throw new Error("Customer not found");
      }

      if (customer.isBlocked) {
        throw new Error("Customer is already blocked");
      }

      customer.isBlocked = true;
      customer.blockedAt = new Date();
      await customer.save();

      logger.info({
        ...context,
        event: "BLOCK_CUSTOMER_SUCCESS",
      });

      return { success: true, message: "Customer blocked successfully" };
    } catch (err) {
      logger.error({
        ...context,
        event: "BLOCK_CUSTOMER_ERROR",
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Unblock a customer
   */
  async unblockCustomer(customerId) {
    const context = {
      service: "CustomerManagementService.unblockCustomer",
      customerId,
    };

    try {
      logger.info({
        ...context,
        event: "UNBLOCK_CUSTOMER_START",
      });

      const customer = await Customer.findById(customerId);
      if (!customer) {
        throw new Error("Customer not found");
      }

      if (!customer.isBlocked) {
        throw new Error("Customer is not blocked");
      }

      customer.isBlocked = false;
      customer.blockedAt = null;
      await customer.save();

      logger.info({
        ...context,
        event: "UNBLOCK_CUSTOMER_SUCCESS",
      });

      return { success: true, message: "Customer unblocked successfully" };
    } catch (err) {
      logger.error({
        ...context,
        event: "UNBLOCK_CUSTOMER_ERROR",
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Private helper methods
   */
  async _getOrderStats(customerIds) {
    // Ensure customerIds are ObjectId
    const objectIds = customerIds.map(id => new mongoose.Types.ObjectId(id));

    return await Order.aggregate([
      {
        $match: {
          customer: { $in: objectIds },
          status: { 
            $in: [
              "pending", 
              "confirmed", 
              "packed", 
              "shipped", 
              "in_transit",
              "out_for_delivery", // Included out_for_delivery
              "delivered"
            ] 
          },
        },
      },
      {
        $group: {
          _id: "$customer",
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: "$total" },
        },
      },
    ]);
  }

  async _getCustomerGroups(customerIds) {
    return await CustomerGroup.find({
      customer: { $in: customerIds },
    })
      .select("customer currentGroup")
      .lean();
  }

  async _getCustomerSummary(customerIds, filter) {
    const [groupCounts, statusCounts, totalCount] = await Promise.all([
      CustomerGroup.aggregate([
        { $match: { customer: { $in: customerIds } } },
        { $group: { _id: "$currentGroup", count: { $sum: 1 } } },
      ]),
      Customer.aggregate([
        { $match: filter },
        { $group: { _id: "$isBlocked", count: { $sum: 1 } } },
      ]),
      Customer.countDocuments(filter),
    ]);

    return {
      total: totalCount,
      retail: groupCounts.find((g) => g._id === "retail")?.count || 0,
      wholesale: groupCounts.find((g) => g._id === "wholesale")?.count || 0,
      vip: groupCounts.find((g) => g._id === "vip")?.count || 0,
      active: statusCounts.find((s) => s._id === false)?.count || 0,
      blocked: await Customer.countDocuments({ isBlocked: true }),
    };
  }
}

module.exports = new CustomerManagementService();