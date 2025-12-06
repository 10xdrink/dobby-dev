const Order = require("../models/Order");
const Shop = require("../models/Shop");
const Customer = require("../models/Customer");
const mongoose = require("mongoose");
const cacheService = require("../services/cacheService");

// Helper function to filter shop-specific items and calculate totals
const filterShopData = (order, shopId) => {
  const shopItems = order.items.filter(
    (item) => item.shop.toString() === shopId.toString()
  );

  const shipment = order.shipments.find(
    (s) => s.shop.toString() === shopId.toString()
  );

  
  // Calculate shop's subtotal (items total including tax, excluding shipping)
  const subtotal = shopItems.reduce((sum, item) => {
    // lineTotalBeforeCoupon = finalUnitPrice × quantity (includes tax, after discounts)
    return sum + (item.lineTotalBeforeCoupon || 0);
  }, 0);

  // Calculate shop's shipping
  const shipping = shopItems.reduce((sum, item) => {
    return sum + (item.allocatedShipping || 0);
  }, 0);

  // Calculate shop's taxes (already included in finalUnitPrice)
  const taxes = shopItems.reduce((sum, item) => {
    return sum + (item.taxAmount || 0) * item.quantity;
  }, 0);

  // Total for this shop (subtotal already includes tax)
  const total = subtotal + shipping;

  return {
    shopItems,
    shipment,
    subtotal,
    shipping,
    taxes,
    total,
  };
};

// GET all orders for shop with stats
exports.getShopOrders = async (req, res) => {
  try {
    const shopkeeperId = req.user.id;

    const shop = await Shop.findOne({ owner: shopkeeperId });
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found for this shopkeeper",
      });
    }

    // Filters from query params
    const {
      status,
      channel,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

    const cacheKey = `shop:${shop._id}:orders:${status || 'all'}:${channel || 'all'}:${search || 'none'}:${startDate || 'none'}:${endDate || 'none'}:${page}:${limit}`;

    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      // Build filter query
      const filterQuery = { "shipments.shop": shop._id };

      // Date range filter
      if (startDate || endDate) {
        filterQuery.createdAt = {};
        if (startDate) filterQuery.createdAt.$gte = new Date(startDate);
        if (endDate) filterQuery.createdAt.$lte = new Date(endDate);
      }

      // Search by order number or customer name
      if (search) {
        const customers = await Customer.find({
          $or: [
            { firstName: { $regex: search, $options: "i" } },
            { lastName: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ],
        }).select("_id");

        filterQuery.$or = [
          { orderNumber: { $regex: search, $options: "i" } },
          { customer: { $in: customers.map((c) => c._id) } },
        ];
      }

      // Get all orders (we'll filter by shipment status in memory)
      let orders = await Order.find(filterQuery)
        .populate("customer", "firstName lastName email phone")
        .populate("items.product", "productName sku images")
        .populate("address")
        .sort({ createdAt: -1 });

      // Filter by shipment status if provided
      if (status && status !== "all") {
        orders = orders.filter((order) => {
          const shipment = order.shipments.find(
            (s) => s.shop.toString() === shop._id.toString()
          );
          return shipment && shipment.status === status;
        });
      }

      // Channel filter (you can extend this based on your channel logic)
      if (channel && channel !== "all") {
        // Add channel filtering logic here if needed
      }

      // Calculate stats
      const totalOrders = orders.length;

      const totalRevenue = orders.reduce((sum, order) => {
        const { total } = filterShopData(order, shop._id);
        return sum + total;
      }, 0);

      const pendingOrders = orders.filter((order) => {
        const shipment = order.shipments.find(
          (s) => s.shop.toString() === shop._id.toString()
        );
        return shipment && shipment.status === "pending";
      }).length;

      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Calculate percentage changes (last 30 days vs previous 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const lastMonthOrders = await Order.countDocuments({
        "shipments.shop": shop._id,
        createdAt: { $gte: thirtyDaysAgo },
      });

      const previousMonthOrders = await Order.countDocuments({
        "shipments.shop": shop._id,
        createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
      });

      const ordersPercentChange =
        previousMonthOrders > 0
          ? ((lastMonthOrders - previousMonthOrders) / previousMonthOrders) * 100
          : 0;

      // Get revenue for last month
      const lastMonthOrdersData = await Order.find({
        "shipments.shop": shop._id,
        createdAt: { $gte: thirtyDaysAgo },
      }).populate("items.product");

      const lastMonthRevenue = lastMonthOrdersData.reduce((sum, order) => {
        const { total } = filterShopData(order, shop._id);
        return sum + total;
      }, 0);

      const previousMonthOrdersData = await Order.find({
        "shipments.shop": shop._id,
        createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
      }).populate("items.product");

      const previousMonthRevenue = previousMonthOrdersData.reduce((sum, order) => {
        const { total } = filterShopData(order, shop._id);
        return sum + total;
      }, 0);

      const revenuePercentChange =
        previousMonthRevenue > 0
          ? ((lastMonthRevenue - previousMonthRevenue) / previousMonthRevenue) *
            100
          : 0;

      // Pagination
      const skip = (page - 1) * limit;
      const paginatedOrders = orders.slice(skip, skip + parseInt(limit));

      // Format orders for response
      const formattedOrders = paginatedOrders.map((order) => {
        const { shopItems, shipment, total } = filterShopData(order, shop._id);

        return {
          orderId: order.orderNumber,
          _id: order._id,
          trackingId: shipment?.trackingId || null,
          customerName: `${order.customer?.firstName || ""} ${
            order.customer?.lastName || ""
          }`.trim(),
          customerEmail: order.customer?.email || "",
          date: order.createdAt,
          total: total,
          items: shopItems.length,
          status: shipment?.status || "pending",
        };
      });

      return {
        success: true,
        stats: {
          totalOrders,
          ordersPercentChange: ordersPercentChange.toFixed(1),
          totalRevenue,
          revenuePercentChange: revenuePercentChange.toFixed(1),
          pendingOrders,
          pendingPercentChange: 2, // You can calculate this similarly
          avgOrderValue,
          avgOrderValuePercentChange: 6, // You can calculate this similarly
        },
        orders: formattedOrders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(orders.length / limit),
          totalOrders: orders.length,
          hasMore: skip + parseInt(limit) < orders.length,
        },
      };
    });

    res.json(responseData);
  } catch (err) {
    console.error("Error fetching shop orders:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

// GET single order details by ID
exports.getOrderById = async (req, res) => {
  try {
    const shopkeeperId = req.user.id;
    const { orderId } = req.params;

    const shop = await Shop.findOne({ owner: shopkeeperId });
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    const cacheKey = `shop:${shop._id}:order:${orderId}`;

    const response = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      const order = await Order.findById(orderId)
        .populate("customer", "firstName lastName email phone")
        .populate("items.product", "productName sku images unitPrice")
        .populate("address")
        .populate("payment");

      if (!order) {
        return { error: 404, message: "Order not found" };
      }

      // Check if this shop is part of this order
      const shipment = order.shipments.find(
        (s) => s.shop.toString() === shop._id.toString()
      );

      if (!shipment) {
        return { error: 403, message: "This order does not belong to your shop" };
      }

      // Filter to show only this shop's items
      const { shopItems, subtotal, shipping, taxes, total } = filterShopData(
        order,
        shop._id
      );

      const formattedItems = shopItems.map((item) => ({
        _id: item._id,
        productId: item.product?._id,
        name: item.name,
        sku: item.sku,
        image: item.product?.icon1 || null,
        quantity: item.quantity,

        originalPrice: item.originalPrice,
        finalUnitPrice: item.finalUnitPrice,  // After all discounts + tax
        lineTotal: item.lineTotalBeforeCoupon,  // finalUnitPrice × quantity

        // Discounts applied
        productDiscount: item.productDiscountAmount || 0,
        flashSaleDiscount: item.flashSale?.discountAmount || 0,
        pricingRuleDiscount: item.pricingRule?.discountAmount || 0,
        upsellDiscount: item.upsellCrossSell?.discountAmount || 0,

        // Tax details
        taxType: item.taxType,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,

        // Shipping
        allocatedShipping: item.allocatedShipping || 0,
      }));

      return {
        success: true,
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          status: shipment.status,
          createdAt: order.createdAt,
          notes: order.notes,

          customer: {
            _id: order.customer._id,
            name: `${order.customer.firstName || ""} ${
              order.customer.lastName || ""
            }`.trim(),
            email: order.customer.email,
            phone: order.customer.phone,
          },

          address: order.address
            ? {
                fullName: order.address.fullName,
                phone: order.address.phone,
                addressLine1: order.address.addressLine1,
                addressLine2: order.address.addressLine2,
                city: order.address.city,
                state: order.address.state,
                pincode: order.address.pincode,
                country: order.address.country,
              }
            : null,

          items: formattedItems,

          pricing: {
            subtotal,
            shipping,
            taxes,
            total,
          },

          shipment: {
            trackingId: shipment.trackingId,
            shipmentId: shipment.shipmentId,
            courierName: shipment.courierName,
            status: shipment.status,
            lastUpdated: shipment.lastUpdated,
          },

          payment: order.payment
            ? {
                gateway: order.payment.gateway,
                status: order.payment.status,
                amount: order.payment.amount,
              }
            : null,
        },
      };
    });

    if (response.error) {
      return res.status(response.error).json({
        success: false,
        message: response.message,
      });
    }

    res.json(response);
  } catch (err) {
    console.error("Error fetching order details:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

// UPDATE order shipment status
// exports.updateOrderStatus = async (req, res) => {
//   try {
//     const shopkeeperId = req.user.id;
//     const { orderId } = req.params;
//     const { status } = req.body;

//     const validStatuses = [
//       "pending",
//       "confirmed",
//       "packed",
//       "shipped",
//       "in_transit",
//       "out_for_delivery",
//       "delivered",
//       "cancelled",
//       "return_requested",
//       "returned",
//       "refund_processing",
//       "refunded",
//     ];

//     if (!validStatuses.includes(status)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid status",
//       });
//     }

//     const shop = await Shop.findOne({ owner: shopkeeperId });
//     if (!shop) {
//       return res.status(404).json({
//         success: false,
//         message: "Shop not found",
//       });
//     }

//     const order = await Order.findById(orderId);
//     if (!order) {
//       return res.status(404).json({
//         success: false,
//         message: "Order not found",
//       });
//     }

//     // Find the shipment for this shop
//     const shipmentIndex = order.shipments.findIndex(
//       (s) => s.shop.toString() === shop._id.toString()
//     );

//     if (shipmentIndex === -1) {
//       return res.status(403).json({
//         success: false,
//         message: "This order does not belong to your shop",
//       });
//     }

//     // Update shipment status
//     order.shipments[shipmentIndex].status = status;
//     order.shipments[shipmentIndex].lastUpdated = new Date();

//     await order.save(); // This will trigger the pre-save hook to update order.status

//     res.json({
//       success: true,
//       message: "Order status updated successfully",
//       order: {
//         _id: order._id,
//         orderNumber: order.orderNumber,
//         status: order.status,
//         shipmentStatus: order.shipments[shipmentIndex].status,
//       },
//     });
//   } catch (err) {
//     console.error("Error updating order status:", err);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: err.message,
//     });
//   }
// };

// GET order statistics for dashboard
exports.getOrderStats = async (req, res) => {
  try {
    const shopkeeperId = req.user.id;
    const { period = "30" } = req.query; // days

    const shop = await Shop.findOne({ owner: shopkeeperId });
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    const cacheKey = `shop:${shop._id}:orderStats:${period}`;
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(period));

      const orders = await Order.find({
        "shipments.shop": shop._id,
        createdAt: { $gte: daysAgo },
      }).populate("items.product");

      // Calculate stats
      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum, order) => {
        const { total } = filterShopData(order, shop._id);
        return sum + total;
      }, 0);

      const completedOrders = orders.filter((order) => {
        const shipment = order.shipments.find(
          (s) => s.shop.toString() === shop._id.toString()
        );
        return shipment && shipment.status === "delivered";
      }).length;

      const pendingOrders = orders.filter((order) => {
        const shipment = order.shipments.find(
          (s) => s.shop.toString() === shop._id.toString()
        );
        return shipment && shipment.status === "pending";
      }).length;

      const cancelledOrders = orders.filter((order) => {
        const shipment = order.shipments.find(
          (s) => s.shop.toString() === shop._id.toString()
        );
        return shipment && shipment.status === "cancelled";
      }).length;

      // Revenue by day for chart
      const revenueByDay = {};
      orders.forEach((order) => {
        const date = order.createdAt.toISOString().split("T")[0];
        const { total } = filterShopData(order, shop._id);
        revenueByDay[date] = (revenueByDay[date] || 0) + total;
      });

      const chartData = Object.entries(revenueByDay)
        .map(([date, revenue]) => ({
          date,
          revenue,
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      return {
        success: true,
        stats: {
          totalOrders,
          totalRevenue,
          completedOrders,
          pendingOrders,
          cancelledOrders,
          avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        },
        chartData,
      };
    });

    res.json(responseData);
  } catch (err) {
    console.error("Error fetching order stats:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

// Print invoice
exports.printInvoice = async (req, res) => {
  try {
    const shopkeeperId = req.user.id;
    const { orderId } = req.params;

    const shop = await Shop.findOne({ owner: shopkeeperId });
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    const order = await Order.findById(orderId)
      .populate("customer")
      .populate("items.product")
      .populate("address");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const shipment = order.shipments.find(
      (s) => s.shop.toString() === shop._id.toString()
    );

    if (!shipment) {
      return res.status(403).json({
        success: false,
        message: "This order does not belong to your shop",
      });
    }

    const { shopItems, subtotal, shipping, taxes, total } = filterShopData(
      order,
      shop._id
    );

    // Return invoice data (you can generate PDF on frontend)
    res.json({
      success: true,
      invoice: {
        orderNumber: order.orderNumber,
        date: order.createdAt,
        shop: {
          name: shop.shopName,
          address: shop.address,
          phone: shop.phoneNumber,
        },
        customer: {
          name: `${order.customer.firstName} ${order.customer.lastName}`,
          email: order.customer.email,
          phone: order.customer.phone,
        },
        shippingAddress: order.address,
        items: shopItems.map((item) => ({
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          // ✅ FIX: Use correct Order schema fields
          originalPrice: item.originalPrice,
          finalUnitPrice: item.finalUnitPrice,
          discounts: {
            product: item.productDiscountAmount || 0,
            flashSale: item.flashSale?.discountAmount || 0,
            pricingRule: item.pricingRule?.discountAmount || 0,
            upsell: item.upsellCrossSell?.discountAmount || 0,
          },
          taxAmount: item.taxAmount,
          total: item.lineTotalBeforeCoupon || 0,
        })),
        subtotal,
        shipping,
        taxes,
        total,
      },
    });
  } catch (err) {
    console.error("Error generating invoice:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};