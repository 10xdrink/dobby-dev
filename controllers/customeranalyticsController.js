const Customer = require("../models/Customer");
const Order = require("../models/Order");
const CustomerGroup = require("../models/CustomerGroup");
const logger = require("../config/logger");
const { sendEmail } = require("../utils/mailer");


exports.getCustomerRetentionByGroup = async (req, res) => {
  try {
    const { period = "30days", startDate, endDate } = req.query;

    logger.info({
      route: "customerAnalyticsController.getCustomerRetentionByGroup",
      event: "RETENTION_REQUEST",
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

    // Get all customer groups
    const groups = ["retail", "wholesale", "vip"];
    const retentionData = [];

    for (const group of groups) {
      // Get customers in this group
      const customerGroups = await CustomerGroup.find({
        currentGroup: group,
      }).select("customer");

      const customerIds = customerGroups.map((cg) => cg.customer);
      const totalCustomers = customerIds.length;

      // Calculate retention (customers who made repeat orders in period)
      const retainedCustomers = await Order.aggregate([
        {
          $match: {
            customer: { $in: customerIds },
            createdAt: { $gte: filterStartDate, $lte: filterEndDate },
            status: { $nin: ["cancelled", "refunded"] },
          },
        },
        {
          $group: {
            _id: "$customer",
            orderCount: { $sum: 1 },
          },
        },
        {
          $match: {
            orderCount: { $gte: 2 }, // At least 2 orders = retained
          },
        },
      ]);

      const retainedCount = retainedCustomers.length;
      const retentionRate =
        totalCustomers > 0
          ? Math.round((retainedCount / totalCustomers) * 100 * 100) / 100
          : 0;

      retentionData.push({
        group,
        totalCustomers,
        retainedCustomers: retainedCount,
        retentionRate,
      });
    }

    logger.info({
      route: "customerAnalyticsController.getCustomerRetentionByGroup",
      event: "RETENTION_SUCCESS",
      period,
      data: retentionData,
    });

    res.json({
      success: true,
      period,
      dateRange: {
        start: filterStartDate.toISOString().split("T")[0],
        end: filterEndDate.toISOString().split("T")[0],
      },
      data: retentionData,
      timestamp: now,
    });
  } catch (err) {
    logger.error({
      route: "customerAnalyticsController.getCustomerRetentionByGroup",
      event: "RETENTION_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: err.message });
  }
};


exports.getPurchaseFrequencyByGroup = async (req, res) => {
  try {
    const { period = "30days", startDate, endDate } = req.query;

    logger.info({
      route: "customerAnalyticsController.getPurchaseFrequencyByGroup",
      event: "FREQUENCY_REQUEST",
      period,
      startDate,
      endDate,
      requestedBy: req.user?.email || req.employee?.email,
    });

    const now = new Date();
    let filterStartDate;
    let filterEndDate = now;

    // Determine date range
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

    const groups = ["retail", "wholesale", "vip"];
    const frequencyData = [];

    for (const group of groups) {
      // Get customers in this group
      const customerGroups = await CustomerGroup.find({
        currentGroup: group,
      }).select("customer");

      const customerIds = customerGroups.map((cg) => cg.customer);
      const totalCustomers = customerIds.length;

      // Calculate purchase frequency
      const purchaseStats = await Order.aggregate([
        {
          $match: {
            customer: { $in: customerIds },
            createdAt: { $gte: filterStartDate, $lte: filterEndDate },
            status: { $nin: ["cancelled", "refunded"] },
          },
        },
        {
          $group: {
            _id: "$customer",
            orderCount: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: null,
            avgOrders: { $avg: "$orderCount" },
            totalOrders: { $sum: "$orderCount" },
            activeCustomers: { $sum: 1 },
          },
        },
      ]);

      const stats = purchaseStats[0] || {
        avgOrders: 0,
        totalOrders: 0,
        activeCustomers: 0,
      };

      frequencyData.push({
        group,
        totalCustomers,
        activeCustomers: stats.activeCustomers,
        totalOrders: stats.totalOrders,
        avgPurchaseFrequency: Math.round(stats.avgOrders * 100) / 100,
      });
    }

    logger.info({
      route: "customerAnalyticsController.getPurchaseFrequencyByGroup",
      event: "FREQUENCY_SUCCESS",
      period,
      data: frequencyData,
    });

    res.json({
      success: true,
      period,
      dateRange: {
        start: filterStartDate.toISOString().split("T")[0],
        end: filterEndDate.toISOString().split("T")[0],
      },
      data: frequencyData,
      timestamp: now,
    });
  } catch (err) {
    logger.error({
      route: "customerAnalyticsController.getPurchaseFrequencyByGroup",
      event: "FREQUENCY_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: err.message });
  }
};


exports.getCustomerActivityStatus = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", group = "" } = req.query;

    logger.info({
      route: "customerAnalyticsController.getCustomerActivityStatus",
      event: "ACTIVITY_REQUEST",
      page,
      limit,
      search,
      group,
      requestedBy: req.user?.email || req.employee?.email,
    });

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Check if CustomerGroup collection has data
    const totalGroups = await CustomerGroup.countDocuments();
    
    if (totalGroups === 0) {
      logger.warn({
        route: "customerAnalyticsController.getCustomerActivityStatus",
        event: "NO_CUSTOMER_GROUPS",
        message: "CustomerGroup collection is empty. Run sync script.",
      });
      
      return res.json({
        success: true,
        data: [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: 0,
          pages: 0,
        },
        message: "No customer groups found. Please run: node scripts/syncCustomerGroups.js",
        timestamp: new Date(),
      });
    }

    // Build query for customer groups
    let groupQuery = {};
    if (group && ["retail", "wholesale", "vip"].includes(group)) {
      groupQuery.currentGroup = group;
    }

    // Get customer groups with filter
    const customerGroups = await CustomerGroup.find(groupQuery)
      .populate("customer", "firstName lastName email phone")
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await CustomerGroup.countDocuments(groupQuery);

    // Enhance with order data
    const activityData = [];

    for (const cg of customerGroups) {
      if (!cg.customer) continue;

      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const fullName = `${cg.customer.firstName || ""} ${
          cg.customer.lastName || ""
        }`.toLowerCase();
        const email = (cg.customer.email || "").toLowerCase();

        if (!fullName.includes(searchLower) && !email.includes(searchLower)) {
          continue;
        }
      }

      // Get last order
      const lastOrder = await Order.findOne({
        customer: cg.customer._id,
        status: { $nin: ["cancelled", "refunded"] },
      })
        .sort({ createdAt: -1 })
        .select("createdAt")
        .lean();

      // Get total orders across all shops
      const totalOrders = await Order.countDocuments({
        customer: cg.customer._id,
        status: { $nin: ["cancelled", "refunded"] },
      });

      // Get total spent
      const spentData = await Order.aggregate([
        {
          $match: {
            customer: cg.customer._id,
            status: { $nin: ["cancelled", "refunded"] },
          },
        },
        {
          $group: {
            _id: null,
            totalSpent: { $sum: "$total" },
          },
        },
      ]);

      const totalSpent = spentData[0]?.totalSpent || 0;

      activityData.push({
        customerId: cg.customer._id,
        customerName: `${cg.customer.firstName || ""} ${
          cg.customer.lastName || ""
        }`.trim(),
        email: cg.customer.email || "N/A",
        phone: cg.customer.phone || "N/A",
        lastPurchase: lastOrder
          ? new Date(lastOrder.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "Never",
        totalOrders,
        totalSpent: `₹${totalSpent.toLocaleString("en-IN")}`,
        totalSpentRaw: totalSpent,
        group: cg.currentGroup,
      });
    }

    logger.info({
      route: "customerAnalyticsController.getCustomerActivityStatus",
      event: "ACTIVITY_SUCCESS",
      page: pageNum,
      limit: limitNum,
      total,
      resultCount: activityData.length,
    });

    res.json({
      success: true,
      data: activityData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
      timestamp: new Date(),
    });
  } catch (err) {
    logger.error({
      route: "customerAnalyticsController.getCustomerActivityStatus",
      event: "ACTIVITY_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * SEND EMAIL TO CUSTOMER
 * Admin/Employee can send personalized email to customer
 */
exports.sendCustomerEmail = async (req, res) => {
  try {
    const {
      customerId,
      customerName,
      customerEmail,
      lastPurchase,
      totalOrders,
      totalSpent,
      message,
      senderEmail,
    } = req.body;

    logger.info({
      route: "customerAnalyticsController.sendCustomerEmail",
      event: "EMAIL_SEND_REQUEST",
      customerId,
      customerEmail,
      senderEmail: senderEmail || req.user?.email || req.employee?.email,
    });

    // Validation
    if (!customerId || !customerEmail || !message) {
      return res.status(400).json({
        success: false,
        message: "Customer ID, email, and message are required",
      });
    }

    // Verify customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Get sender email (admin or employee)
    const fromEmail =
      senderEmail || req.user?.email || req.employee?.email || "noreply@dobby.com";

    // Prepare email content
    const emailHTML = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #fff; border: 1px solid #e0e0e0; border-radius: 8px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #333;">Message from Dobby</h2>
      </div>
      
      <div style="margin-bottom: 20px;">
        <p style="color: #555; font-size: 15px; line-height: 1.6;">
          Dear ${customerName || "Valued Customer"},
        </p>
        <p style="color: #555; font-size: 15px; line-height: 1.6;">
          ${message}
        </p>
      </div>

      <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="color: #333; margin-top: 0;">Your Account Summary</h3>
        <p style="color: #555; margin: 5px 0;"><strong>Last Purchase:</strong> ${
          lastPurchase || "N/A"
        }</p>
        <p style="color: #555; margin: 5px 0;"><strong>Total Orders:</strong> ${
          totalOrders || 0
        }</p>
        <p style="color: #555; margin: 5px 0;"><strong>Total Spent:</strong> ${
          totalSpent || "₹0"
        }</p>
      </div>

      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
      
      <p style="font-size: 12px; color: #888; text-align: center;">
        This email was sent from ${fromEmail}. If you have any questions, please reply to this email.
      </p>
    </div>
    `;

    // Send email
    await sendEmail(customerEmail, "Message from Dobby", emailHTML);

    logger.info({
      route: "customerAnalyticsController.sendCustomerEmail",
      event: "EMAIL_SENT_SUCCESS",
      customerId,
      customerEmail,
    });

    res.json({
      success: true,
      message: "Email sent successfully",
    });
  } catch (err) {
    logger.error({
      route: "customerAnalyticsController.sendCustomerEmail",
      event: "EMAIL_SEND_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: err.message });
  }
};