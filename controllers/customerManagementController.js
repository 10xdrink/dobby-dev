const customerManagementService = require("../services/customermanagementService");
const CustomerMailTemplate = require("../models/CustomerMailTemplate");
const logger = require("../config/logger");
const { sendEmail } = require("../utils/mailer");
const Customer = require("../models/Customer");
const CustomerGroup = require("../models/CustomerGroup");

async function sendCustomerTemplateMail(to, type, placeholders = {}) {
  const template = await CustomerMailTemplate.findOne({ templateType: type });
  if (!template || !template.isActive) {
    console.log(`Customer Template not found or inactive: ${type}`);
    return;
  }

  let mailBody = template.mailBody;
  for (const [key, value] of Object.entries(placeholders)) {
    mailBody = mailBody.replace(new RegExp(`{${key}}`, "g"), value);
  }

  // Page links
  let pageLinksHtml = "";
  for (const [key, value] of Object.entries(template.pageLinks || {})) {
    if (value.enabled) {
      pageLinksHtml += `<a href="${
        value.url
      }" style="margin:0 8px; color:#000; text-decoration:none; text-transform:capitalize;">
  ${key.replace(/([A-Z])/g, " $1")}
</a>`;
    }
  }
  const iconMap = {
    facebook:
      "https://res.cloudinary.com/demo/image/upload/v1729600000/facebook-black.png",
    instagram:
      "https://res.cloudinary.com/demo/image/upload/v1729600000/instagram-black.png",
    x: "https://res.cloudinary.com/demo/image/upload/v1729600000/x-black.png",
    linkedin:
      "https://res.cloudinary.com/demo/image/upload/v1729600000/linkedin-black.png",
    youtube:
      "https://res.cloudinary.com/demo/image/upload/v1729600000/youtube-black.png",
  };

  let socialLinksHtml = "";
  for (const [key, value] of Object.entries(template.socialMediaLinks || {})) {
    if (value.enabled && value.url) {
      const iconUrl =
        iconMap[key.toLowerCase()] ||
        "https://res.cloudinary.com/demo/image/upload/v1729600000/link-black.png";
      socialLinksHtml += `
      <a href="${value.url}" style="margin:0 5px;" target="_blank">
        <img src="${iconUrl}" alt="${key}" height="22" style="vertical-align:middle; display:inline-block;"/>
      </a>
    `;
    }
  }

  const htmlContent = `
 <div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto; padding:20px; background:#fff; border:1px solid #e0e0e0; border-radius:8px;">
    <div style="text-align:center; margin-bottom:20px;">
      <img src="${
        template.logoUrl
      }" alt="Logo" style="width:100px; height:100px; object-fit:contain; border-radius:8px;"/>
    </div>
      <h2 style="color:#333;">${template.title}</h2>
      <p style="color:#555; font-size:15px; line-height:1.6;">${mailBody}</p>
      <p style="color:#555; font-size:14px; line-height:1.6;">
        ${template.footerSectionText || ""}
      </p>
      <div style="text-align:center; margin-bottom:20px;">
        <img src="${template.iconUrl}" alt="Icon" style="height:60px;"/>
      </div>
      <div style="margin-top:20px; text-align:center;">${pageLinksHtml}</div>
      <div style="margin-top:20px; text-align:center;">${socialLinksHtml}</div>
      <hr style="border:none; border-top:1px solid #e0e0e0; margin:20px 0;"/>
      <p style="font-size:12px; color:#888; text-align:center;">
        ${template.copyrightText || ""}
      </p>
    </div>
  `;

  await sendEmail(to, template.title, htmlContent);
}

/**
 * Get all customers with aggregated order data
 * Supports filtering by group and status
 * Includes pagination
 */
exports.getAllCustomers = async (req, res) => {
  try {
    const result = await customerManagementService.getCustomers(req.query);

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    logger.error({
      route: "CustomerController.getAllCustomers",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get customer details by ID
 */
exports.getCustomerById = async (req, res) => {
  try {
    const { customerId } = req.params;

    const customer = await customerManagementService.getCustomerById(
      customerId
    );

    res.json({
      success: true,
      customer,
    });
  } catch (err) {
    logger.error({
      route: "CustomerController.getCustomerById",
      error: err.message,
      stack: err.stack,
      customerId: req.params.customerId,
    });

    const statusCode = err.message === "Customer not found" ? 404 : 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
};

/**
 * Get VIP customers only
 */
exports.getVIPCustomers = async (req, res) => {
  try {
    req.query.group = "vip";
    return exports.getAllCustomers(req, res);
  } catch (err) {
    logger.error({
      route: "CustomerController.getVIPCustomers",
      error: err.message,
    });
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get blocked customers only
 */
exports.getBlockedCustomers = async (req, res) => {
  try {
    req.query.status = "blocked";
    return exports.getAllCustomers(req, res);
  } catch (err) {
    logger.error({
      route: "CustomerController.getBlockedCustomers",
      error: err.message,
    });
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Block a customer
 */
exports.blockCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;

    logger.info({
      route: "CustomerController.blockCustomer",
      customerId,
      blockedBy: req.user?.email || req.employee?.id,
    });

    // Fetch customer details first to get email and name for notification
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    const result = await customerManagementService.blockCustomer(customerId);

    // Send Email Notification
    if (result.success && customer.email) {
      sendCustomerTemplateMail(customer.email, "account_block", {
        CustomerName: `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || "Customer",
      }).catch(err => {
        logger.error({
          event: "BLOCK_CUSTOMER_EMAIL_FAILED",
          customerId,
          error: err.message
        });
      });
    }

    res.json(result);
  } catch (err) {
    logger.error({
      route: "CustomerController.blockCustomer",
      error: err.message,
      stack: err.stack,
      customerId: req.params.customerId,
    });

    const statusCode =
      err.message === "Customer not found"
        ? 404
        : err.message === "Customer is already blocked"
        ? 400
        : 500;

    res.status(statusCode).json({ success: false, message: err.message });
  }
};

/**
 * Unblock a customer
 */
exports.unblockCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;

    logger.info({
      route: "CustomerController.unblockCustomer",
      customerId,
      unblockedBy: req.user?.email || req.employee?.id,
    });

    // Fetch customer details first to get email and name for notification
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    const result = await customerManagementService.unblockCustomer(customerId);

    // Send Email Notification
    if (result.success && customer.email) {
      sendCustomerTemplateMail(customer.email, "account_unblock", {
        CustomerName: `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || "Customer",
      }).catch(err => {
        logger.error({
          event: "UNBLOCK_CUSTOMER_EMAIL_FAILED",
          customerId,
          error: err.message
        });
      });
    }

    res.json(result);
  } catch (err) {
    logger.error({
      route: "CustomerController.unblockCustomer",
      error: err.message,
      stack: err.stack,
      customerId: req.params.customerId,
    });

    const statusCode =
      err.message === "Customer not found"
        ? 404
        : err.message === "Customer is not blocked"
        ? 400
        : 500;

    res.status(statusCode).json({ success: false, message: err.message });
  }
};

/**
 * Export customers to CSV
 */
exports.exportCustomers = async (req, res) => {
  try {
    const { group, status } = req.query;

    logger.info({
      route: "CustomerController.exportCustomers",
      filters: { group, status },
      requestedBy: req.user?.email || req.employee?.id,
    });

    // Get all customers without pagination
    const result = await customerManagementService.getCustomers({
      ...req.query,
      limit: 10000, // High limit for export
    });

    const exportData = result.customers.map((customer) => ({
      customerId: customer.customerId,
      name: customer.name,
      email: customer.email,
      phone: customer.phone || "",
      totalOrders: customer.totalOrders,
      totalSpent: customer.totalSpent.toFixed(2),
      group: customer.group,
      status: customer.status,
      joinedDate: new Date(customer.createdAt).toLocaleDateString(),
    }));

    logger.info({
      route: "CustomerController.exportCustomers",
      event: "SUCCESS",
      count: exportData.length,
    });

    res.json({
      success: true,
      data: exportData,
    });
  } catch (err) {
    logger.error({
      route: "CustomerController.exportCustomers",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get real-time customer statistics with percentage changes
 * - Total Customers (% from last month)
 * - Active Customers (% from last month)
 * - Blocked Accounts (% from yesterday)
 * - VIP Customers (% from last week)
 */
exports.getCustomerStats = async (req, res) => {
  try {
    logger.info({
      route: "CustomerController.getCustomerStats",
      requestedBy: req.user?.email || req.employee?.id,
    });

    const now = new Date();

    // Date ranges
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    lastWeekStart.setHours(0, 0, 0, 0);

    const lastMonthStart = new Date(now);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    lastMonthStart.setHours(0, 0, 0, 0);

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(thisWeekStart.getDate() - 7);
    thisWeekStart.setHours(0, 0, 0, 0);

    const thisMonthStart = new Date(now);
    thisMonthStart.setMonth(thisMonthStart.getMonth());
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    // Parallel queries for better performance
    const [
      // Current counts
      totalCustomers,
      activeCustomers,
      blockedAccounts,
      
      // Previous period counts
      totalCustomersLastMonth,
      activeCustomersLastMonth,
      blockedAccountsYesterday,
      
      // VIP data
      vipCustomers,
      vipCustomersLastWeek,
    ] = await Promise.all([
      // Current: Total Customers
      Customer.countDocuments({}),

      // Current: Active Customers
      Customer.countDocuments({ isBlocked: false }),

      // Current: Blocked Accounts
      Customer.countDocuments({ isBlocked: true }),

      // Previous: Total Customers (last month)
      Customer.countDocuments({
        createdAt: { $lt: lastMonthStart },
      }),

      // Previous: Active Customers (last month)
      Customer.countDocuments({
        isBlocked: false,
        createdAt: { $lt: lastMonthStart },
      }),

      // Previous: Blocked Accounts (yesterday)
      Customer.countDocuments({
        isBlocked: true,
        blockedAt: { $lt: yesterday },
      }),

      // Current: VIP Customers
      CustomerGroup.countDocuments({ currentGroup: "vip" }),

      // Previous: VIP Customers (last week)
      CustomerGroup.countDocuments({
        currentGroup: "vip",
        lastEvaluatedAt: { $lt: lastWeekStart },
      }),
    ]);

    // Calculate percentage changes
    const calculatePercentage = (current, previous) => {
      if (previous === 0) {
        return current > 0 ? 100 : 0;
      }
      const change = ((current - previous) / previous) * 100;
      return Math.round(change * 10) / 10; // Round to 1 decimal
    };

    const stats = {
      totalCustomers: {
        count: totalCustomers,
        change: calculatePercentage(totalCustomers, totalCustomersLastMonth),
        comparison: "from last month",
        isIncrease: totalCustomers >= totalCustomersLastMonth,
      },
      activeCustomers: {
        count: activeCustomers,
        change: calculatePercentage(activeCustomers, activeCustomersLastMonth),
        comparison: "from last month",
        isIncrease: activeCustomers >= activeCustomersLastMonth,
      },
      blockedAccounts: {
        count: blockedAccounts,
        change: calculatePercentage(blockedAccounts, blockedAccountsYesterday),
        comparison: "from yesterday",
        isIncrease: blockedAccounts >= blockedAccountsYesterday,
      },
      vipCustomers: {
        count: vipCustomers,
        change: calculatePercentage(vipCustomers, vipCustomersLastWeek),
        comparison: "from last week",
        isIncrease: vipCustomers >= vipCustomersLastWeek,
      },
    };

    // Additional summary
    const summary = {
      totalCustomers: totalCustomers,
      activeCustomers: activeCustomers,
      blockedAccounts: blockedAccounts,
      vipCustomers: vipCustomers,
      retailCustomers: totalCustomers - vipCustomers,
      activeRate: totalCustomers > 0 
        ? Math.round((activeCustomers / totalCustomers) * 100 * 10) / 10 
        : 0,
      blockedRate: totalCustomers > 0 
        ? Math.round((blockedAccounts / totalCustomers) * 100 * 10) / 10 
        : 0,
      vipRate: totalCustomers > 0 
        ? Math.round((vipCustomers / totalCustomers) * 100 * 10) / 10 
        : 0,
    };

    logger.info({
      route: "CustomerController.getCustomerStats",
      event: "SUCCESS",
      stats: summary,
    });

    res.json({
      success: true,
      stats,
      summary,
      timestamp: now,
    });
  } catch (err) {
    logger.error({
      route: "CustomerController.getCustomerStats",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get detailed customer statistics with breakdown
 */
exports.getDetailedStats = async (req, res) => {
  try {
    logger.info({
      route: "CustomerController.getDetailedStats",
      requestedBy: req.user?.email || req.employee?.id,
    });

    const now = new Date();

    // Get group distribution
    const groupDistribution = await CustomerGroup.aggregate([
      {
        $group: {
          _id: "$currentGroup",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get registration trends (last 30 days)
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const registrationTrend = await Customer.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
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
    ]);

    // Get blocking trends (last 30 days)
    const blockingTrend = await Customer.aggregate([
      {
        $match: {
          isBlocked: true,
          blockedAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$blockedAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Get auth provider distribution
    const authProviderDistribution = await Customer.aggregate([
      {
        $group: {
          _id: "$authProvider",
          count: { $sum: 1 },
        },
      },
    ]);

    const groupMap = {
      retail: 0,
      wholesale: 0,
      vip: 0,
    };
    groupDistribution.forEach((item) => {
      groupMap[item._id] = item.count;
    });

    const authProviderMap = {};
    authProviderDistribution.forEach((item) => {
      authProviderMap[item._id || "local"] = item.count;
    });

    logger.info({
      route: "CustomerController.getDetailedStats",
      event: "SUCCESS",
    });

    res.json({
      success: true,
      groupDistribution: groupMap,
      authProviderDistribution: authProviderMap,
      registrationTrend,
      blockingTrend,
      timestamp: now,
    });
  } catch (err) {
    logger.error({
      route: "CustomerController.getDetailedStats",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get customer growth analytics
 */
exports.getGrowthAnalytics = async (req, res) => {
  try {
    const { period = "monthly" } = req.query; // daily, weekly, monthly

    logger.info({
      route: "CustomerController.getGrowthAnalytics",
      period,
      requestedBy: req.user?.email || req.employee?.id,
    });

    const now = new Date();
    let dateFormat, startDate;

    switch (period) {
      case "daily":
        dateFormat = "%Y-%m-%d";
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        break;
      case "weekly":
        dateFormat = "%Y-W%V";
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 90);
        break;
      case "monthly":
      default:
        dateFormat = "%Y-%m";
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 12);
        break;
    }

    const growthData = await Customer.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            period: { $dateToString: { format: dateFormat, date: "$createdAt" } },
            isBlocked: "$isBlocked",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.period",
          total: { $sum: "$count" },
          active: {
            $sum: {
              $cond: [{ $eq: ["$_id.isBlocked", false] }, "$count", 0],
            },
          },
          blocked: {
            $sum: {
              $cond: [{ $eq: ["$_id.isBlocked", true] }, "$count", 0],
            },
          },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    logger.info({
      route: "CustomerController.getGrowthAnalytics",
      event: "SUCCESS",
      period,
      dataPoints: growthData.length,
    });

    res.json({
      success: true,
      period,
      data: growthData,
      timestamp: now,
    });
  } catch (err) {
    logger.error({
      route: "CustomerController.getGrowthAnalytics",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: err.message });
  }
};