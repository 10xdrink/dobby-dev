const Order = require("../models/Order");
const Customer = require("../models/Customer");
const logger = require("../config/logger");

/**
 * Get all orders for a specific customer
 * Admin/Employee can view any customer's orders
 *
 * Query params:
 *   - page: number (default 1)
 *   - limit: number (default 10)
 *   - status: string (filter by order status)
 *   - sortBy: string (default 'createdAt')
 *   - sortOrder: 'asc' | 'desc' (default 'desc')
 */
exports.getCustomerOrders = async (req, res) => {
  try {
    const { customerId } = req.params;
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    logger.info({
      route: "CustomerOrdersController.getCustomerOrders",
      customerId,
      page,
      limit,
      status,
      requestedBy: req.user?.email || req.employee?.email,
    });

    // Check if customer exists
    const customer = await Customer.findById(customerId)
      .select("firstName lastName email phone profilePhoto")
      .lean();

    if (!customer) {
      logger.warn({
        route: "CustomerOrdersController.getCustomerOrders",
        event: "CUSTOMER_NOT_FOUND",
        customerId,
      });
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Build filter
    const filter = { customer: customerId };
    if (status) {
      filter.status = status;
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get orders with pagination
    const orders = await Order.find(filter)
      .populate({
        path: "items.product",
        select: "productName icon1 sku",
      })
      .populate({
        path: "items.shop",
        select: "shopName",
      })
      .populate({
        path: "address",
        select: "street city state pincode country",
      })
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count
    const totalCount = await Order.countDocuments(filter);

    // Format orders for response
    const formattedOrders = orders.map((order) => ({
      _id: order._id,
      orderNumber: order.orderNumber,
      customerName:
        `${customer.firstName || ""} ${customer.lastName || ""}`.trim() ||
        "N/A",
      orderDate: order.createdAt,
      totalAmount: Math.round(order.total * 100) / 100,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      status: order.status,
      shipmentStatus:
        order.shipments?.map((s) => ({
          shop: s.shop,
          status: s.status,
          trackingId: s.trackingId,
        })) || [],
    }));

    // Get order statistics for this customer
    const orderStats = await Order.aggregate([
      {
        $match: {
          customer: customer._id,
          status: { $in: ["delivered", "confirmed", "shipped", "in_transit"] },
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: { $toDouble: "$total" } },
          avgOrderValue: { $avg: { $toDouble: "$total" } },
        },
      },
    ]);

    const stats = orderStats[0] || {
      totalOrders: 0,
      totalSpent: 0,
      avgOrderValue: 0,
    };

    logger.info({
      route: "CustomerOrdersController.getCustomerOrders",
      event: "SUCCESS",
      customerId,
      ordersReturned: formattedOrders.length,
      page: pageNum,
    });

    res.json({
      success: true,
      customer: {
        _id: customer._id,
        customerId: `#CUS-${customer._id.toString().slice(-6).toUpperCase()}`,
        name:
          `${customer.firstName || ""} ${customer.lastName || ""}`.trim() ||
          "N/A",
        email: customer.email,
        phone: customer.phone,
        profilePhoto: customer.profilePhoto,
      },
      orders: formattedOrders,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalRecords: totalCount,
        limit: limitNum,
      },
      statistics: {
        totalOrders: stats.totalOrders,
        totalSpent: Math.round(stats.totalSpent * 100) / 100,
        avgOrderValue: Math.round(stats.avgOrderValue * 100) / 100,
      },
      timestamp: new Date(),
    });
  } catch (err) {
    logger.error({
      route: "CustomerOrdersController.getCustomerOrders",
      error: err.message,
      stack: err.stack,
      customerId: req.params.customerId,
    });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Get detailed information for a specific order
 */
exports.getOrderDetails = async (req, res) => {
  try {
    const { customerId, orderId } = req.params;

    logger.info({
      route: "CustomerOrdersController.getOrderDetails",
      customerId,
      orderId,
      requestedBy: req.user?.email || req.employee?.email,
    });

    
    const order = await Order.findOne({
      _id: orderId,
      customer: customerId,
    })
      .populate({
        path: "items.product",
        select: "productName icon1 sku unitPrice",
      })
      .populate({
        path: "items.shop",
        select: "shopName shopAddress phone email",
      })
      .populate({
        path: "address",
        select:
          "firstName lastName street city state pincode country phone alternatePhone",
      })
      .populate({
        path: "customer",
        select: "firstName lastName email phone profilePhoto",
      })
      .populate({
        path: "payment",
        select: "gateway status amount createdAt",
      })
      .lean();

    if (!order) {
      logger.warn({
        route: "CustomerOrdersController.getOrderDetails",
        event: "ORDER_NOT_FOUND",
        orderId,
        customerId,
      });
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Format order items
    const formattedItems = order.items.map((item) => ({
      _id: item._id,
      productId: item.product?._id,
      productName: item.name || item.product?.productName,
      productImage: item.product?.icon1,
      sku: item.sku || item.product?.sku,
      quantity: item.quantity,
      originalPrice: item.originalPrice,
      finalUnitPrice: item.finalUnitPrice,
      lineTotal: item.lineTotalBeforeCoupon,
      shop: {
        _id: item.shop?._id,
        name: item.shop?.shopName,
      },
      // Discount details
      discounts: {
        product: item.productDiscountAmount || 0,
        flashSale: item.flashSale?.discountAmount || 0,
        pricingRule: item.pricingRule?.discountAmount || 0,
        upsell: item.upsellCrossSell?.discountAmount || 0,
      },
      // Tax details
      tax: {
        type: item.taxType,
        rate: item.taxRate,
        amount: item.taxAmount,
      },
    }));

    // Format shipments
    const formattedShipments = order.shipments.map((shipment) => ({
      _id: shipment._id,
      shop: shipment.shop,
      trackingId: shipment.trackingId,
      shipmentId: shipment.shipmentId,
      courierName: shipment.courierName,
      status: shipment.status,
      lastUpdated: shipment.lastUpdated,
    }));

    const orderDetails = {
      _id: order._id,
      orderNumber: order.orderNumber,

      // Customer info
      customer: order.customer
        ? {
            _id: order.customer._id,
            customerId: `#CUS-${order.customer._id
              .toString()
              .slice(-6)
              .toUpperCase()}`,
            name: `${order.customer.firstName || ""} ${
              order.customer.lastName || ""
            }`.trim(),
            email: order.customer.email,
            phone: order.customer.phone,
            profilePhoto: order.customer.profilePhoto,
          }
        : null,

      // Order dates
      orderDate: order.createdAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,

      // Items
      items: formattedItems,
      totalItems: order.items.reduce((sum, item) => sum + item.quantity, 0),

      // Pricing breakdown
      pricing: {
        subtotal: order.subtotal,
        shipping: order.shipping,
        taxes: order.taxes,
        couponDiscount: order.appliedCoupon?.discountAmount || 0,
        total: order.total,
      },

      // Coupon info
      coupon: order.appliedCoupon
        ? {
            couponId: order.appliedCoupon.couponId,
            discountAmount: order.appliedCoupon.discountAmount,
          }
        : null,

      // Delivery address
      deliveryAddress: order.address
        ? {
            name: `${order.address.firstName || ""} ${
              order.address.lastName || ""
            }`.trim(),
            street: order.address.street,
            city: order.address.city,
            state: order.address.state,
            pincode: order.address.pincode,
            country: order.address.country,
            phone: order.address.phone,
            alternatePhone: order.address.alternatePhone,
          }
        : null,

      // Payment info
      payment: order.payment
        ? {
            gateway: order.payment.gateway,
            status: order.payment.status,
            amount: order.payment.amount,
            paidAt: order.payment.createdAt,
          }
        : null,

      // Shipments
      shipments: formattedShipments,

      // Order status
      status: order.status,
      notes: order.notes,
    };

    logger.info({
      route: "CustomerOrdersController.getOrderDetails",
      event: "SUCCESS",
      orderId,
      customerId,
    });

    res.json({
      success: true,
      order: orderDetails,
      timestamp: new Date(),
    });
  } catch (err) {
    logger.error({
      route: "CustomerOrdersController.getOrderDetails",
      error: err.message,
      stack: err.stack,
      orderId: req.params.orderId,
      customerId: req.params.customerId,
    });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Get all customer orders across all customers
 * For admin dashboard - shows recent orders from all customers
 */
exports.getAllCustomerOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    logger.info({
      route: "CustomerOrdersController.getAllCustomerOrders",
      page,
      limit,
      status,
      search,
      requestedBy: req.user?.email || req.employee?.email,
    });

    // Build filter
    const filter = {};
    if (status) {
      filter.status = status;
    }

    // Search by order number or customer
    if (search) {
      const customers = await Customer.find({
        $or: [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      })
        .select("_id")
        .lean();

      const customerIds = customers.map((c) => c._id);

      filter.$or = [
        { orderNumber: { $regex: search, $options: "i" } },
        { customer: { $in: customerIds } },
      ];
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get orders
    const orders = await Order.find(filter)
      .populate({
        path: "customer",
        select: "firstName lastName email phone profilePhoto",
      })
      .populate({
        path: "items.product",
        select: "productName icon1",
      })
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalCount = await Order.countDocuments(filter);

    // Format orders
    const formattedOrders = orders.map((order) => ({
      _id: order._id,
      orderNumber: order.orderNumber,
      customer: order.customer
        ? {
            _id: order.customer._id,
            customerId: `#CUS-${order.customer._id
              .toString()
              .slice(-6)
              .toUpperCase()}`,
            name:
              `${order.customer.firstName || ""} ${
                order.customer.lastName || ""
              }`.trim() || "N/A",
            email: order.customer.email,
            phone: order.customer.phone,
            profilePhoto: order.customer.profilePhoto,
          }
        : null,
      orderDate: order.createdAt,
      totalAmount: Math.round(order.total * 100) / 100,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      status: order.status,
      paymentStatus: order.payment?.status || "pending",
    }));

    logger.info({
      route: "CustomerOrdersController.getAllCustomerOrders",
      event: "SUCCESS",
      ordersReturned: formattedOrders.length,
      page: pageNum,
    });

    res.json({
      success: true,
      orders: formattedOrders,
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
      route: "CustomerOrdersController.getAllCustomerOrders",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Get order management statistics
 * Returns: total orders, delivered, shipped, cancelled, revenue, average order value
 * Admin/Employee only
 */
exports.getOrderStats = async (req, res) => {
  try {
    logger.info({
      route: "CustomerOrdersController.getOrderStats",
      requestedBy: req.user?.email || req.employee?.email,
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

    // Parallel queries for better performance
    const [
      // Current counts
      totalOrders,
      deliveredOrders,
      shippedOrders,
      processingOrders,
      cancelledOrders,
      refundedOrders,

      // Previous period counts - Last Month
      totalOrdersLastMonth,
      deliveredOrdersLastMonth,
      cancelledOrdersLastMonth,
      refundedOrdersLastMonth,

      // Previous period counts - Yesterday
      shippedOrdersYesterday,

      // Previous period counts - Last Week
      processingOrdersLastWeek,

      // Revenue data (excluding cancelled and refunded)
      currentRevenue,
      revenueYesterday,

      // Average Order Value
      currentAOV,
      aovLastWeek,
    ] = await Promise.all([
      // ===== CURRENT COUNTS =====
      // Total Orders
      Order.countDocuments({
        status: { $ne: "refunded" }, // Exclude refunded from total
      }),

      // Delivered Orders
      Order.countDocuments({ status: "delivered" }),

      // Shipped Orders (shipped + in_transit)
      Order.countDocuments({ status: { $in: ["shipped", "in_transit"] } }),

      // Processing Orders (pending + confirmed + packed)
      Order.countDocuments({
        status: { $in: ["pending", "confirmed", "packed"] },
      }),

      // Cancelled Orders
      Order.countDocuments({ status: "cancelled" }),

      // Refunded Orders
      Order.countDocuments({ status: "refunded" }),

      
      Order.countDocuments({
        createdAt: { $lt: lastMonthStart },
        status: { $ne: "refunded" },
      }),

      Order.countDocuments({
        status: "delivered",
        deliveredAt: { $lt: lastMonthStart },
      }),

      Order.countDocuments({
        status: "cancelled",
        cancelledAt: { $lt: lastMonthStart },
      }),

      Order.countDocuments({
        status: "refunded",
        updatedAt: { $lt: lastMonthStart },
      }),

      // ===== PREVIOUS PERIOD - YESTERDAY =====
      Order.countDocuments({
        status: { $in: ["shipped", "in_transit"] },
        updatedAt: { $lt: yesterday },
      }),

      // ===== PREVIOUS PERIOD - LAST WEEK =====
      Order.countDocuments({
        status: { $in: ["pending", "confirmed", "packed"] },
        createdAt: { $lt: lastWeekStart },
      }),

      // ===== CURRENT REVENUE (TODAY) =====
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

      // ===== YESTERDAY REVENUE =====
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: yesterday, $lt: todayStart },
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

      // ===== CURRENT AOV (ALL TIME) =====
      Order.aggregate([
        {
          $match: {
            status: { $nin: ["cancelled", "refunded"] },
          },
        },
        {
          $group: {
            _id: null,
            avgOrderValue: { $avg: "$total" },
          },
        },
      ]),

      // ===== AOV LAST WEEK =====
      Order.aggregate([
        {
          $match: {
            createdAt: { $lt: lastWeekStart },
            status: { $nin: ["cancelled", "refunded"] },
          },
        },
        {
          $group: {
            _id: null,
            avgOrderValue: { $avg: "$total" },
          },
        },
      ]),
    ]);

    // Calculate percentage changes
    const calculatePercentage = (current, previous) => {
      if (previous === 0) {
        return current > 0 ? 100 : 0;
      }
      const change = ((current - previous) / previous) * 100;
      return Math.round(change * 10) / 10; // Round to 1 decimal
    };

    // Extract revenue values
    const todayRevenue = currentRevenue[0]?.totalRevenue || 0;
    const yesterdayRevenue = revenueYesterday[0]?.totalRevenue || 0;

    // Extract AOV values
    const currentAvgOrderValue = currentAOV[0]?.avgOrderValue || 0;
    const lastWeekAvgOrderValue = aovLastWeek[0]?.avgOrderValue || 0;

    const stats = {
      totalOrders: {
        count: totalOrders,
        change: calculatePercentage(totalOrders, totalOrdersLastMonth),
        comparison: "from last month",
        isIncrease: totalOrders >= totalOrdersLastMonth,
      },
      deliveredOrders: {
        count: deliveredOrders,
        change: calculatePercentage(deliveredOrders, deliveredOrdersLastMonth),
        comparison: "from last month",
        isIncrease: deliveredOrders >= deliveredOrdersLastMonth,
      },
      shippedOrders: {
        count: shippedOrders,
        change: calculatePercentage(shippedOrders, shippedOrdersYesterday),
        comparison: "from yesterday",
        isIncrease: shippedOrders >= shippedOrdersYesterday,
      },
      processingOrders: {
        count: processingOrders,
        change: calculatePercentage(processingOrders, processingOrdersLastWeek),
        comparison: "from last week",
        isIncrease: processingOrders >= processingOrdersLastWeek,
      },
      cancelledOrders: {
        count: cancelledOrders,
        change: calculatePercentage(cancelledOrders, cancelledOrdersLastMonth),
        comparison: "from last month",
        isIncrease: cancelledOrders >= cancelledOrdersLastMonth,
      },
      refundedOrders: {
        count: refundedOrders,
        change: calculatePercentage(refundedOrders, refundedOrdersLastMonth),
        comparison: "from last month",
        isIncrease: refundedOrders >= refundedOrdersLastMonth,
      },
      revenue: {
        amount: Math.round(todayRevenue * 100) / 100,
        change: calculatePercentage(todayRevenue, yesterdayRevenue),
        comparison: "from yesterday",
        isIncrease: todayRevenue >= yesterdayRevenue,
      },
      avgOrderValue: {
        amount: Math.round(currentAvgOrderValue * 100) / 100,
        change: calculatePercentage(
          currentAvgOrderValue,
          lastWeekAvgOrderValue
        ),
        comparison: "from last week",
        isIncrease: currentAvgOrderValue >= lastWeekAvgOrderValue,
      },
    };

    // Additional summary
    const summary = {
      totalOrders: totalOrders,
      deliveredOrders: deliveredOrders,
      shippedOrders: shippedOrders,
      processingOrders: processingOrders,
      cancelledOrders: cancelledOrders,
      refundedOrders: refundedOrders,
      revenue: Math.round(todayRevenue * 100) / 100,
      avgOrderValue: Math.round(currentAvgOrderValue * 100) / 100,
      deliveryRate:
        totalOrders > 0
          ? Math.round((deliveredOrders / totalOrders) * 100 * 10) / 10
          : 0,
      cancellationRate:
        totalOrders > 0
          ? Math.round((cancelledOrders / totalOrders) * 100 * 10) / 10
          : 0,
      refundRate:
        totalOrders > 0
          ? Math.round((refundedOrders / totalOrders) * 100 * 10) / 10
          : 0,
    };

    logger.info({
      route: "CustomerOrdersController.getOrderStats",
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
      route: "CustomerOrdersController.getOrderStats",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMonthlyOrderTrends = async (req, res) => {
  try {
    const { period = "12months" } = req.query;

    logger.info({
      route: "OrderAnalyticsController.getMonthlyOrderTrends",
      period,
      requestedBy: req.user?.email || req.employee?.email,
    });

    const now = new Date();
    let startDate, dateFormat;

    switch (period) {
      case "6months":
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 6);
        dateFormat = "%Y-%m";
        break;
      case "12months":
      default:
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 12);
        dateFormat = "%Y-%m";
        break;
      case "thisyear":
        startDate = new Date(now.getFullYear(), 0, 1);
        dateFormat = "%Y-%m";
        break;
    }

    // Aggregate orders by month
    const monthlyData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $ne: "cancelled" }, // Exclude cancelled orders
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: dateFormat, date: "$createdAt" },
          },
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: { $toDouble: "$total" } },
          averageOrderValue: { $avg: { $toDouble: "$total" } },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Get previous period for comparison
    const prevStartDate = new Date(startDate);
    const monthsDiff = Math.floor(
      (now - startDate) / (1000 * 60 * 60 * 24 * 30)
    );
    prevStartDate.setMonth(prevStartDate.getMonth() - monthsDiff);

    const prevPeriodData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: prevStartDate, $lt: startDate },
          status: { $ne: "cancelled" },
        },
      },
      {
        $group: {
          _id: null,
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: { $toDouble: "$total" } },
        },
      },
    ]);

    const currentPeriodTotal = monthlyData.reduce(
      (sum, m) => sum + m.orderCount,
      0
    );
    const prevPeriodTotal = prevPeriodData[0]?.orderCount || 0;

    const percentageChange =
      prevPeriodTotal > 0
        ? Math.round(
            ((currentPeriodTotal - prevPeriodTotal) / prevPeriodTotal) *
              100 *
              10
          ) / 10
        : 100;

    logger.info({
      route: "OrderAnalyticsController.getMonthlyOrderTrends",
      event: "SUCCESS",
      period,
      dataPoints: monthlyData.length,
    });

    res.json({
      success: true,
      period,
      data: monthlyData.map((item) => ({
        month: item._id,
        orderCount: item.orderCount,
        totalRevenue: Math.round(item.totalRevenue * 100) / 100,
        averageOrderValue: Math.round(item.averageOrderValue * 100) / 100,
      })),
      summary: {
        currentPeriod: currentPeriodTotal,
        previousPeriod: prevPeriodTotal,
        percentageChange,
        isIncrease: currentPeriodTotal >= prevPeriodTotal,
      },
      timestamp: now,
    });
  } catch (err) {
    logger.error({
      route: "OrderAnalyticsController.getMonthlyOrderTrends",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get order status distribution
 * Shows percentage breakdown of order statuses
 * Supports: This Month, Last Month, This Year filters
 */
exports.getOrderStatusDistribution = async (req, res) => {
  try {
    const { period = "thismonth" } = req.query;

    logger.info({
      route: "OrderAnalyticsController.getOrderStatusDistribution",
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
        const endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "thisyear":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Build filter
    const filter = { createdAt: { $gte: startDate } };

    // For last month, add end date filter
    if (period === "lastmonth") {
      const endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      endDate.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = endDate;
    }

    // Get total orders in period
    const totalOrders = await Order.countDocuments(filter);

    // Get status distribution
    const statusDistribution = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Create status map with all possible statuses
    const statusMap = {
      pending: 0,
      confirmed: 0,
      packed: 0,
      shipped: 0,
      in_transit: 0,
      delivered: 0,
      cancelled: 0,
      return_requested: 0,
      returned: 0,
      refund_processing: 0,
      refunded: 0,
    };

    statusDistribution.forEach((item) => {
      statusMap[item._id] = item.count;
    });

    // Calculate percentages
    const percentages = {};
    Object.keys(statusMap).forEach((status) => {
      percentages[status] =
        totalOrders > 0
          ? Math.round((statusMap[status] / totalOrders) * 100 * 100) / 100
          : 0;
    });

    // Group statuses for cleaner display
    const groupedData = {
      active: {
        count: statusMap.pending + statusMap.confirmed + statusMap.packed,
        percentage:
          percentages.pending + percentages.confirmed + percentages.packed,
        statuses: {
          pending: {
            count: statusMap.pending,
            percentage: percentages.pending,
          },
          confirmed: {
            count: statusMap.confirmed,
            percentage: percentages.confirmed,
          },
          packed: { count: statusMap.packed, percentage: percentages.packed },
        },
      },
      shipped: {
        count: statusMap.shipped + statusMap.in_transit,
        percentage: percentages.shipped + percentages.in_transit,
        statuses: {
          shipped: {
            count: statusMap.shipped,
            percentage: percentages.shipped,
          },
          in_transit: {
            count: statusMap.in_transit,
            percentage: percentages.in_transit,
          },
        },
      },
      delivered: {
        count: statusMap.delivered,
        percentage: percentages.delivered,
      },
      cancelled: {
        count: statusMap.cancelled,
        percentage: percentages.cancelled,
      },
      returns: {
        count:
          statusMap.return_requested +
          statusMap.returned +
          statusMap.refund_processing +
          statusMap.refunded,
        percentage:
          percentages.return_requested +
          percentages.returned +
          percentages.refund_processing +
          percentages.refunded,
        statuses: {
          return_requested: {
            count: statusMap.return_requested,
            percentage: percentages.return_requested,
          },
          returned: {
            count: statusMap.returned,
            percentage: percentages.returned,
          },
          refund_processing: {
            count: statusMap.refund_processing,
            percentage: percentages.refund_processing,
          },
          refunded: {
            count: statusMap.refunded,
            percentage: percentages.refunded,
          },
        },
      },
    };

    // Get previous period comparison
    let prevStartDate, prevEndDate;
    if (period === "thismonth") {
      prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
      prevEndDate.setHours(23, 59, 59, 999);
    } else if (period === "lastmonth") {
      prevStartDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      prevEndDate = new Date(now.getFullYear(), now.getMonth() - 1, 0);
      prevEndDate.setHours(23, 59, 59, 999);
    } else if (period === "thisyear") {
      prevStartDate = new Date(now.getFullYear() - 1, 0, 1);
      prevEndDate = new Date(now.getFullYear() - 1, 11, 31);
      prevEndDate.setHours(23, 59, 59, 999);
    }

    const prevPeriodTotal = await Order.countDocuments({
      createdAt: { $gte: prevStartDate, $lte: prevEndDate },
    });

    const percentageChange =
      prevPeriodTotal > 0
        ? Math.round(
            ((totalOrders - prevPeriodTotal) / prevPeriodTotal) * 100 * 10
          ) / 10
        : 100;

    logger.info({
      route: "OrderAnalyticsController.getOrderStatusDistribution",
      event: "SUCCESS",
      period,
      totalOrders,
    });

    res.json({
      success: true,
      period,
      totalOrders,
      distribution: groupedData,
      detailedStatusCounts: statusMap,
      detailedStatusPercentages: percentages,
      comparison: {
        currentPeriod: totalOrders,
        previousPeriod: prevPeriodTotal,
        percentageChange,
        isIncrease: totalOrders >= prevPeriodTotal,
      },
      timestamp: now,
    });
  } catch (err) {
    logger.error({
      route: "OrderAnalyticsController.getOrderStatusDistribution",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: err.message });
  }
};
